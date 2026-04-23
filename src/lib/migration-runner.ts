import fs from 'fs';
import path from 'path';
import pool from '../lib/postgres';

export async function runMigrations() {
  console.log('🔄 Running Database Migrations...');
  
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

    // Add a safety check to migrate from my previous '_migrations' if it exists (additive)
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

    // Path to migration files
    const dbDir = path.join(process.cwd(), 'src', 'db');
    const masterMigrationPath = path.join(dbDir, 'master-migration.sql');
    const migrationsDir = path.join(dbDir, 'migrations');

    // 1. Run Master Migration if not done
    if (fs.existsSync(masterMigrationPath)) {
      const { rows } = await client.query('SELECT id FROM migrations WHERE name = $1', ['master-migration']);
      if (rows.length === 0) {
        console.log('📦 Applying Master Migration...');
        const sql = fs.readFileSync(masterMigrationPath, 'utf8');
        await client.query(sql);
        await client.query('INSERT INTO migrations (name) VALUES ($1)', ['master-migration']);
        console.log('✅ Master Migration applied successfully.');
      }
    }

    // 2. Run sequential migrations from the migrations folder
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
        }
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}
