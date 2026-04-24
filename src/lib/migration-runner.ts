import fs from 'fs';
import path from 'path';
import pool from '../lib/postgres';

export async function runMigrations() {
  console.log('🔄 Running Database Migrations...');
  let appliedCount = 0;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create migrations table if it doesn't exist (using the user's requested schema)
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Safety check for previous table name
    await client.query(`
      DO $$ 
      BEGIN 
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = '_migrations') THEN
          INSERT INTO migrations (name, run_at)
          SELECT name, applied_at FROM _migrations
          ON CONFLICT (name) DO NOTHING;
        END IF;
      END $$;
    `);

    const dbDir = path.join(process.cwd(), 'src', 'db');
    const masterMigrationPath = path.join(dbDir, 'master-migration.sql');
    const migrationsDir = path.join(dbDir, 'migrations');

    // 1. Run Master Migration
    if (fs.existsSync(masterMigrationPath)) {
      console.log('📦 Checking Master Migration...');
      const sql = fs.readFileSync(masterMigrationPath, 'utf8');
      
      // We run master migration EVERY TIME because it uses "IF NOT EXISTS"
      // and we want it to act as a baseline sync.
      try {
        await client.query(sql);
        
        // Still track it in migrations table for record keeping
        const { rows } = await client.query('SELECT id FROM migrations WHERE name = $1', ['master-migration']);
        if (rows.length === 0) {
          await client.query('INSERT INTO migrations (name) VALUES ($1)', ['master-migration']);
        }
        
        console.log('✅ Master Migration synced.');
      } catch (masterError) {
        console.warn('⚠️ Master Migration sync warning (non-fatal):', masterError instanceof Error ? masterError.message : masterError);
        // We don't fail the whole process for master errors because it might have partial successes
      }
    }

    // 2. Run sequential migrations
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

      for (const file of files) {
        const { rows } = await client.query('SELECT id FROM migrations WHERE name = $1', [file]);
        if (rows.length === 0) {
          console.log(`🚀 Applying Migration: ${file}...`);
          const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
          await client.query(sql);
          await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
          console.log(`✅ Migration ${file} applied successfully.`);
          appliedCount++;
        }
      }
    }

    await client.query('COMMIT');
    return { success: true, appliedCount };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}
