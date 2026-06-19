import fs from 'fs';
import path from 'path';
import pool from './postgres';

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

    // 0. Programmatic Column Migrations (Requested by User)
    console.log('🛠️ Checking for required columns...');
    const columnsToSync = [
      { table: 'journal_entries', column: 'entry_number', type: 'VARCHAR(50)' },
      { table: 'receipt_vouchers', column: 'account_id', type: 'VARCHAR(36) REFERENCES accounts(id)' },
      { table: 'payment_vouchers', column: 'account_id', type: 'VARCHAR(36) REFERENCES accounts(id)' },
      { table: 'activity_logs', column: 'account_id', type: 'VARCHAR(36) REFERENCES accounts(id)' },
      { table: 'activity_logs', column: 'entity', type: 'JSONB' },
      { table: 'operations', column: 'category_id', type: 'VARCHAR(36) REFERENCES operation_categories(id)' },
      { table: 'operations', column: 'customer_id', type: 'VARCHAR(36)' },
      { table: 'operations', column: 'customer_name', type: 'VARCHAR(255)' },
      { table: 'operations', column: 'description', type: 'TEXT' },
      { table: 'operations', column: 'date', type: 'DATE' },
      { table: 'operations', column: 'status', type: "VARCHAR(50) DEFAULT 'draft'" },
      { table: 'operation_fields', column: 'category_id', type: 'VARCHAR(36) REFERENCES operation_categories(id)' },
      { table: 'operation_fields', column: 'label', type: 'VARCHAR(255)' },
      { table: 'operation_categories', column: 'code', type: 'VARCHAR(50)' },
      { table: 'operation_categories', column: 'is_final', type: 'BOOLEAN DEFAULT FALSE' },
      { table: 'operation_categories', column: 'level', type: 'INT DEFAULT 0' },
      { table: 'operation_categories', column: 'full_path', type: 'TEXT' },
      { table: 'operation_categories', column: 'description', type: 'TEXT' },
      { table: 'operation_fields', column: 'code', type: 'VARCHAR(50)' },
      { table: 'operation_fields', column: 'description', type: 'TEXT' },
      { table: 'operation_fields', column: 'unit', type: 'VARCHAR(50)' },
      { table: 'operation_fields', column: 'default_value', type: 'TEXT' },
      { table: 'operation_field_values', column: 'company_id', type: 'VARCHAR(36)' },
      { table: 'field_operation_categories', column: 'id', type: 'VARCHAR(36) PRIMARY KEY' },
      { table: 'invoices', column: 'payment_type', type: "VARCHAR(20) DEFAULT 'cash'" },
      { table: 'invoices', column: 'description', type: 'TEXT' },
      { table: 'invoices', column: 'currency_id', type: 'VARCHAR(36)' },
      { table: 'invoices', column: 'exchange_rate', type: 'DECIMAL(18, 6) DEFAULT 1' },
      { table: 'returns', column: 'description', type: 'TEXT' },
      { table: 'returns', column: 'currency_id', type: 'VARCHAR(36)' },
      { table: 'returns', column: 'exchange_rate', type: 'DECIMAL(18, 6) DEFAULT 1' },
      { table: 'return_items', column: 'operation_id', type: 'VARCHAR(36)' },
      { table: 'return_items', column: 'department_id', type: 'VARCHAR(36)' },
      { table: 'return_items', column: 'cost_center_id', type: 'VARCHAR(36)' },
      { table: 'purchase_invoices', column: 'description', type: 'TEXT' },
      { table: 'purchase_invoices', column: 'currency_id', type: 'VARCHAR(36)' },
      { table: 'purchase_invoices', column: 'exchange_rate', type: 'DECIMAL(18, 6) DEFAULT 1' },
      { table: 'purchase_invoice_items', column: 'operation_id', type: 'VARCHAR(36)' },
      { table: 'purchase_invoice_items', column: 'department_id', type: 'VARCHAR(36)' },
      { table: 'purchase_invoice_items', column: 'cost_center_id', type: 'VARCHAR(36)' },
      { table: 'purchase_invoice_items', column: 'vat_rate', type: 'DECIMAL(18, 6) DEFAULT 0' },
      { table: 'purchase_invoice_items', column: 'vat_amount', type: 'DECIMAL(18, 6) DEFAULT 0' },
      { table: 'purchase_returns', column: 'description', type: 'TEXT' },
      { table: 'purchase_returns', column: 'currency_id', type: 'VARCHAR(36)' },
      { table: 'purchase_returns', column: 'exchange_rate', type: 'DECIMAL(18, 6) DEFAULT 1' },
      { table: 'purchase_return_items', column: 'operation_id', type: 'VARCHAR(36)' },
      { table: 'purchase_return_items', column: 'department_id', type: 'VARCHAR(36)' },
      { table: 'purchase_return_items', column: 'cost_center_id', type: 'VARCHAR(36)' },
      { table: 'sales_orders', column: 'currency_id', type: 'VARCHAR(36)' },
      { table: 'sales_orders', column: 'exchange_rate', type: 'DECIMAL(18, 6) DEFAULT 1' },
      { table: 'sales_order_items', column: 'operation_id', type: 'VARCHAR(36)' },
      { table: 'sales_order_items', column: 'department_id', type: 'VARCHAR(36)' },
      { table: 'sales_order_items', column: 'cost_center_id', type: 'VARCHAR(36)' },
      { table: 'purchase_orders', column: 'currency_id', type: 'VARCHAR(36)' },
      { table: 'purchase_orders', column: 'exchange_rate', type: 'DECIMAL(18, 6) DEFAULT 1' },
      { table: 'purchase_order_items', column: 'operation_id', type: 'VARCHAR(36)' },
      { table: 'purchase_order_items', column: 'department_id', type: 'VARCHAR(36)' },
      { table: 'purchase_order_items', column: 'cost_center_id', type: 'VARCHAR(36)' },
      { table: 'customers', column: 'created_at', type: 'TIMESTAMP DEFAULT NOW()' },
      { table: 'customers', column: 'updated_at', type: 'TIMESTAMP DEFAULT NOW()' },
      { table: 'products', column: 'created_at', type: 'TIMESTAMP DEFAULT NOW()' },
      { table: 'products', column: 'updated_at', type: 'TIMESTAMP DEFAULT NOW()' },
      { table: 'products', column: 'inventory_account_id', type: 'VARCHAR(36)' },
      { table: 'products', column: 'inventory_account_name', type: 'VARCHAR(255)' },
      { table: 'products', column: 'vat_account_id', type: 'VARCHAR(36)' },
      { table: 'products', column: 'vat_account_name', type: 'VARCHAR(255)' },
      { table: 'products', column: 'vat_rate', type: 'DECIMAL(10,4) DEFAULT 0' },
      { table: 'companies', column: 'vat_enabled', type: 'BOOLEAN DEFAULT FALSE' },
      { table: 'companies', column: 'wht_enabled', type: 'BOOLEAN DEFAULT FALSE' },
      { table: 'accounts', column: 'required_sub_account', type: 'BOOLEAN DEFAULT FALSE' },
      { table: 'journal_entry_lines', column: 'company_id', type: 'VARCHAR(36)' },
      { table: 'journal_entry_lines', column: 'account_name', type: 'VARCHAR(255)' },
      { table: 'journal_entry_lines', column: 'customer_id', type: 'VARCHAR(36)' },
      { table: 'journal_entry_lines', column: 'supplier_id', type: 'VARCHAR(36)' },
      { table: 'journal_entry_lines', column: 'customer_name', type: 'VARCHAR(255)' },
      { table: 'journal_entry_lines', column: 'supplier_name', type: 'VARCHAR(255)' },
      { table: 'journal_entry_lines', column: 'created_at', type: 'TIMESTAMP DEFAULT NOW()' },
      { table: 'journal_entry_lines', column: 'sub_account_id', type: 'VARCHAR(36)' },
      { table: 'journal_entry_lines', column: 'sub_account_type', type: 'VARCHAR(50)' }
    ];

    for (const item of columnsToSync) {
      // First ensure the table exists
      const { rows: tableRows } = await client.query(`
        SELECT 1 FROM information_schema.tables WHERE table_name = $1
      `, [item.table]);

      if (tableRows.length === 0) {
        console.warn(`  ⚠️ Skipping column sync for ${item.table} as it does not exist yet.`);
        continue;
      }

      const { rows: colRows } = await client.query(`
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = $2
      `, [item.table, item.column]);

      if (colRows.length === 0) {
        console.log(`🚀 Adding missing column: "${item.table}"."${item.column}"...`);
        try {
          await client.query(`ALTER TABLE "${item.table}" ADD COLUMN IF NOT EXISTS "${item.column}" ${item.type}`);
          console.log(`✅ Column "${item.table}"."${item.column}" added successfully.`);
          appliedCount++;
        } catch (colError: any) {
          console.error(`❌ Failed to add column "${item.table}"."${item.column}":`, colError.message);
          // Don't throw here to allow other columns to sync, but we should know it failed
        }
      }
    }

    // Add Index for payment_type
    const tablesWithPaymentType = ['invoices', 'returns', 'purchase_invoices', 'purchase_returns'];
    for (const table of tablesWithPaymentType) {
      await client.query(`CREATE INDEX IF NOT EXISTS idx_${table}_payment_type ON ${table}(payment_type)`);
    }

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
