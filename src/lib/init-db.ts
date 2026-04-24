import pool from './postgres';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { runMigrations } from './migration-runner';

export async function initDatabase() {
  console.log('Initializing PostgreSQL Database...');
  
  let client;
  let retries = 3;
  let delay = 2000;

  while (retries > 0) {
    try {
      client = await pool.connect();
      console.log('Successfully connected to PostgreSQL.');
      break;
    } catch (err: any) {
      retries--;
      console.error(`Failed to connect to PostgreSQL (Retries left: ${retries}):`, err.message);
      if (retries === 0) {
        console.error('CRITICAL: Could not establish a connection to PostgreSQL after multiple attempts.');
        console.error('Please check your DB_HOST, DB_USER, DB_PASSWORD, and DB_NAME in the environment variables.');
        throw err;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
  
  if (!client) return;

  // NOTE FOR DEVELOPERS:
  // When adding new columns to tables below, you MUST ALSO add an 
  // "ALTER TABLE ... ADD COLUMN IF NOT EXISTS ..." statement to 
  // src/db/master-migration.sql to ensure existing databases are updated.

  try {
    // 0. Ensure Migrations Table exists (Additive & Required for Tracking)
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Start transaction
    await client.query('BEGIN');

    // 1. Companies
    await client.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        tax_number VARCHAR(50),
        commercial_register VARCHAR(50),
        address TEXT,
        phone VARCHAR(20),
        email VARCHAR(100),
        logo_url TEXT,
        website VARCHAR(255),
        subscription_status VARCHAR(20) DEFAULT 'trial',
        subscription_plan VARCHAR(20) DEFAULT 'basic',
        subscription_start TIMESTAMP,
        subscription_end TIMESTAMP,
        subscription_expiry TIMESTAMP,
        subscription_days INTEGER DEFAULT 30,
        users_limit INTEGER DEFAULT 5,
        transactions_limit INTEGER DEFAULT 1000,
        company_status VARCHAR(20) DEFAULT 'active',
        features JSONB DEFAULT '[]',
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Roles
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        description TEXT
      );
    `);

    // 3. Users
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        username VARCHAR(100) NOT NULL,
        name VARCHAR(255),
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        mobile VARCHAR(20),
        role VARCHAR(20) DEFAULT 'user',
        company_id VARCHAR(36),
        status VARCHAR(20) DEFAULT 'active',
        temp_password VARCHAR(255),
        permissions JSONB DEFAULT '{}',
        must_change_password BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
    `);

    // 4. Account Types
    await client.query(`
      CREATE TABLE IF NOT EXISTS account_types (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) REFERENCES companies(id),
        code VARCHAR(20) NOT NULL,
        name VARCHAR(100) NOT NULL,
        statement_type VARCHAR(50) NOT NULL,
        classification VARCHAR(50) NOT NULL
      );
    `);

    // 5. Chart of Accounts
    await client.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) REFERENCES companies(id),
        type_id VARCHAR(36) REFERENCES account_types(id),
        parent_id VARCHAR(36) REFERENCES accounts(id),
        code VARCHAR(20) NOT NULL,
        name VARCHAR(200) NOT NULL,
        opening_balance DECIMAL(18, 4) DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE
      );
    `);

    // 6. Customers
    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) REFERENCES companies(id),
        account_id VARCHAR(36) REFERENCES accounts(id),
        code VARCHAR(50),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(100),
        mobile VARCHAR(20),
        address TEXT,
        tax_number VARCHAR(50),
        opening_balance DECIMAL(18, 4) DEFAULT 0,
        opening_balance_date DATE,
        counter_account_id VARCHAR(36)
      );
    `);

    // 7. Suppliers
    await client.query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) REFERENCES companies(id),
        account_id VARCHAR(36) REFERENCES accounts(id),
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50),
        email VARCHAR(100),
        mobile VARCHAR(20),
        address TEXT,
        tax_number VARCHAR(50),
        opening_balance DECIMAL(18, 4) DEFAULT 0,
        opening_balance_date DATE,
        counter_account_id VARCHAR(36)
      );
    `);

    // 8. Products
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) REFERENCES companies(id),
        revenue_account_id VARCHAR(36) REFERENCES accounts(id),
        cost_account_id VARCHAR(36) REFERENCES accounts(id),
        revenue_account_name VARCHAR(255),
        cost_account_name VARCHAR(255),
        name VARCHAR(255) NOT NULL,
        code VARCHAR(100),
        barcode VARCHAR(100),
        type VARCHAR(50) DEFAULT 'product',
        description TEXT,
        image_url TEXT,
        category VARCHAR(100),
        unit VARCHAR(50),
        cost_price DECIMAL(18, 4) DEFAULT 0,
        sale_price DECIMAL(18, 4) DEFAULT 0,
        stock DECIMAL(18, 4) DEFAULT 0,
        min_stock DECIMAL(18, 4) DEFAULT 0,
        current_stock DECIMAL(18, 4) DEFAULT 0,
        is_service BOOLEAN DEFAULT FALSE,
        counter_account_id VARCHAR(36)
      );
    `);

    // 9. Invoices
    await client.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) REFERENCES companies(id),
        customer_id VARCHAR(36) REFERENCES customers(id),
        invoice_number VARCHAR(50) NOT NULL,
        date DATE NOT NULL,
        due_date DATE,
        subtotal DECIMAL(18, 4) NOT NULL,
        tax_amount DECIMAL(18, 4) DEFAULT 0,
        discount_amount DECIMAL(18, 4) DEFAULT 0,
        total_amount DECIMAL(18, 4) NOT NULL,
        status VARCHAR(20) DEFAULT 'draft',
        payment_type VARCHAR(20) DEFAULT 'cash',
        payment_method_id VARCHAR(36),
        notes TEXT,
        created_by VARCHAR(36) REFERENCES users(id)
      );
    `);

    // 10. Invoice Items
    await client.query(`
      CREATE TABLE IF NOT EXISTS invoice_items (
        id VARCHAR(36) PRIMARY KEY,
        invoice_id VARCHAR(36) REFERENCES invoices(id) ON DELETE CASCADE,
        product_id VARCHAR(36) REFERENCES products(id),
        description TEXT,
        quantity DECIMAL(18, 4) NOT NULL,
        unit_price DECIMAL(18, 4) NOT NULL,
        total DECIMAL(18, 4) NOT NULL,
        product_name VARCHAR(255),
        product_code VARCHAR(100),
        product_image_url TEXT
      );
    `);

    // 11. Journal Entries
    await client.query(`
      CREATE TABLE IF NOT EXISTS journal_entries (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) REFERENCES companies(id),
        date DATE NOT NULL,
        description TEXT,
        reference_id VARCHAR(36),
        reference_type VARCHAR(50),
        reference_number VARCHAR(50),
        total_debit DECIMAL(18, 4) NOT NULL,
        total_credit DECIMAL(18, 4) NOT NULL,
        status VARCHAR(20) DEFAULT 'posted'
      );
    `);

    // 12. Journal Entry Lines
    await client.query(`
      CREATE TABLE IF NOT EXISTS journal_entry_lines (
        id VARCHAR(36) PRIMARY KEY,
        journal_entry_id VARCHAR(36) REFERENCES journal_entries(id) ON DELETE CASCADE,
        account_id VARCHAR(36) REFERENCES accounts(id),
        description TEXT,
        debit DECIMAL(18, 4) DEFAULT 0,
        credit DECIMAL(18, 4) DEFAULT 0
      );
    `);

    // 13. Payment Methods
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_methods (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) REFERENCES companies(id),
        account_id VARCHAR(36) REFERENCES accounts(id),
        code VARCHAR(50),
        name VARCHAR(100) NOT NULL,
        type VARCHAR(20) DEFAULT 'cash',
        opening_balance DECIMAL(18, 4) DEFAULT 0,
        opening_balance_date DATE,
        counter_account_id VARCHAR(36)
      );
    `);

    // 14. Activity Logs
    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id BIGSERIAL PRIMARY KEY,
        company_id VARCHAR(36),
        user_id VARCHAR(36),
        username VARCHAR(100),
        action VARCHAR(100) NOT NULL,
        details TEXT,
        ip_address VARCHAR(45),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        category JSONB,
        document_id VARCHAR(36),
        changes JSONB
      );
      CREATE INDEX IF NOT EXISTS idx_activity_logs_company_timestamp ON activity_logs(company_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_category ON activity_logs USING GIN (category);
    `);

    // 15. Returns
    await client.query(`
      CREATE TABLE IF NOT EXISTS returns (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) REFERENCES companies(id),
        customer_id VARCHAR(36) REFERENCES customers(id),
        return_number VARCHAR(50) NOT NULL,
        date DATE NOT NULL,
        total_amount DECIMAL(18, 4) NOT NULL,
        payment_type VARCHAR(20) DEFAULT 'cash',
        payment_method_id VARCHAR(36) REFERENCES payment_methods(id),
        notes TEXT
      );
    `);

    // 16. Return Items
    await client.query(`
      CREATE TABLE IF NOT EXISTS return_items (
        id VARCHAR(36) PRIMARY KEY,
        return_id VARCHAR(36) REFERENCES returns(id) ON DELETE CASCADE,
        product_id VARCHAR(36) REFERENCES products(id),
        description TEXT,
        quantity DECIMAL(18, 4) NOT NULL,
        unit_price DECIMAL(18, 4) NOT NULL,
        total DECIMAL(18, 4) NOT NULL,
        product_name VARCHAR(255),
        product_code VARCHAR(100),
        product_image_url TEXT
      );
    `);

    // 17. Purchase Invoices
    await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_invoices (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) REFERENCES companies(id),
        supplier_id VARCHAR(36) REFERENCES suppliers(id),
        invoice_number VARCHAR(50) NOT NULL,
        date DATE NOT NULL,
        due_date DATE,
        subtotal DECIMAL(18, 4) NOT NULL,
        tax_amount DECIMAL(18, 4) DEFAULT 0,
        discount_amount DECIMAL(18, 4) DEFAULT 0,
        total_amount DECIMAL(18, 4) NOT NULL,
        status VARCHAR(20) DEFAULT 'draft',
        payment_type VARCHAR(20) DEFAULT 'cash',
        payment_method_id VARCHAR(36) REFERENCES payment_methods(id),
        notes TEXT
      );
    `);

    // 18. Purchase Returns
    await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_returns (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) REFERENCES companies(id),
        supplier_id VARCHAR(36) REFERENCES suppliers(id),
        return_number VARCHAR(50) NOT NULL,
        date DATE NOT NULL,
        total_amount DECIMAL(18, 4) NOT NULL,
        payment_type VARCHAR(20) DEFAULT 'cash',
        payment_method_id VARCHAR(36) REFERENCES payment_methods(id),
        notes TEXT
      );
    `);

    // 19. Customer Discounts
    await client.query(`
      CREATE TABLE IF NOT EXISTS customer_discounts (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) REFERENCES companies(id),
        customer_id VARCHAR(36) REFERENCES customers(id),
        date DATE NOT NULL,
        amount DECIMAL(18, 4) NOT NULL,
        description TEXT
      );
    `);

    // 20. Supplier Discounts
    await client.query(`
      CREATE TABLE IF NOT EXISTS supplier_discounts (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) REFERENCES companies(id),
        supplier_id VARCHAR(36) REFERENCES suppliers(id),
        date DATE NOT NULL,
        amount DECIMAL(18, 4) NOT NULL,
        description TEXT
      );
    `);

    // 21. Receipt Vouchers
    await client.query(`
      CREATE TABLE IF NOT EXISTS receipt_vouchers (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) REFERENCES companies(id),
        customer_id VARCHAR(36) REFERENCES customers(id),
        date DATE NOT NULL,
        amount DECIMAL(18, 4) NOT NULL,
        description TEXT,
        payment_method_id VARCHAR(36) REFERENCES payment_methods(id)
      );
    `);

    // 22. Payment Vouchers
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_vouchers (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) REFERENCES companies(id),
        supplier_id VARCHAR(36),
        expense_category_id VARCHAR(36),
        date DATE NOT NULL,
        amount DECIMAL(18, 4) NOT NULL,
        description TEXT,
        payment_method_id VARCHAR(36) REFERENCES payment_methods(id)
      );
    `);

    // 23. Cash Transfers
    await client.query(`
      CREATE TABLE IF NOT EXISTS cash_transfers (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) REFERENCES companies(id),
        date DATE NOT NULL,
        amount DECIMAL(18, 4) NOT NULL,
        from_payment_method_id VARCHAR(36) REFERENCES payment_methods(id),
        to_payment_method_id VARCHAR(36) REFERENCES payment_methods(id),
        description TEXT,
        created_by VARCHAR(36) REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 24. Expense Categories
    await client.query(`
      CREATE TABLE IF NOT EXISTS expense_categories (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) REFERENCES companies(id),
        code VARCHAR(20) NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        account_id VARCHAR(36) REFERENCES accounts(id)
      );
    `);

    await client.query('COMMIT');
    console.log('✅ PostgreSQL Base Tables initialized successfully.');

    // Run Migrations for existing systems
    await runMigrations();

    // Seed Super Admin
    const adminEmail = 'omarwaelysy@gmail.com';
    try {
      const { rows } = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
      if (rows.length === 0) {
        console.log(`Creating default Super Admin: ${adminEmail}...`);
        const hashedPassword = await bcrypt.hash('123456', 10);
        await client.query(
          'INSERT INTO users (id, username, name, email, password_hash, role, company_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [uuidv4(), 'omar_admin', 'Omar Super Admin', adminEmail, hashedPassword, 'super_admin', 'system']
        );
        console.log('Admin created');
      } else {
        console.log('Admin already exists');
      }
    } catch (adminError) {
      console.error('Error creating admin:', adminError);
      // We don't throw here to allow the server to start, but it's logged
    }

    // Seed Activity Logs if empty
    try {
      const { rows: logRows } = await client.query('SELECT id FROM activity_logs LIMIT 1');
      if (logRows.length === 0) {
        console.log('Seeding initial activity logs...');
        const { rows: userRows } = await client.query('SELECT id, username, company_id FROM users LIMIT 1');
        if (userRows.length > 0) {
          const firstUser = userRows[0];
          await client.query(
            'INSERT INTO activity_logs (company_id, user_id, username, action, details, category) VALUES ($1, $2, $3, $4, $5, $6)',
            [firstUser.company_id, firstUser.id, firstUser.username, 'تهيئة النظام', 'تم بدء تشغيل سجل النشاط بنجاح', JSON.stringify(['system'])]
          );
        }
      }
    } catch (logSeedError) {
      console.warn('Could not seed activity logs:', logSeedError);
    }

    console.log('🔥 Database initialization process complete.');
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('❌ FATAL: Error during PostgreSQL database initialization:');
    console.error(error);
    throw error;
  } finally {
    if (client) client.release();
  }
}
