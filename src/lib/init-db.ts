import pool from './postgres';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { runMigrations } from './migration-runner';

/**
 * ERP V2 Database Initialization
 * Ensures tables are created in correct dependency order and
 * performance indices are applied only after tables exist.
 */
export async function initDatabase() {
  console.log('🚀 Initializing PostgreSQL ERP V2 Core...');
  
  let client;
  let retries = 5;
  let delay = 2000;

  // Connection Resilience Loop
  while (retries > 0) {
    try {
      client = await pool.connect();
      console.log('✅ Successfully connected to PostgreSQL.');
      break;
    } catch (err: any) {
      retries--;
      console.error(`⚠️ Failed to connect to PostgreSQL (Retries left: ${retries}):`, err.message);
      if (retries === 0) {
        console.error('❌ CRITICAL: Could not establish a connection to PostgreSQL after multiple attempts.');
        throw err;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 1.5;
    }
  }
  
  if (!client) return;

  try {
    // 0. Base Tracking
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Start Transaction for Schema Integrity
    await client.query('BEGIN');

    // ==========================================
    // PHASE 1: CORE IDENTITY CLUSTER
    // ==========================================
    console.log('  - Building Identity Cluster...');
    
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

      CREATE TABLE IF NOT EXISTS roles (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        description TEXT
      );

      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        username VARCHAR(100) NOT NULL,
        name VARCHAR(255),
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        mobile VARCHAR(20),
        role VARCHAR(20) DEFAULT 'user',
        company_id VARCHAR(36) REFERENCES companies(id),
        status VARCHAR(20) DEFAULT 'active',
        temp_password VARCHAR(255),
        permissions JSONB DEFAULT '{}',
        must_change_password BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ==========================================
    // PHASE 2: FINANCIAL ARMATURE
    // ==========================================
    console.log('  - Wiring Financial Armature...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS account_types (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) REFERENCES companies(id),
        code VARCHAR(20) NOT NULL,
        name VARCHAR(100) NOT NULL,
        statement_type VARCHAR(50) NOT NULL,
        classification VARCHAR(50) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS accounts (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) REFERENCES companies(id),
        type_id VARCHAR(36) REFERENCES account_types(id),
        parent_id VARCHAR(36) REFERENCES accounts(id),
        code VARCHAR(20) NOT NULL,
        name VARCHAR(200) NOT NULL,
        opening_balance DECIMAL(18, 4) DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS expense_categories (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) REFERENCES companies(id),
        code VARCHAR(20) NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        account_id VARCHAR(36) REFERENCES accounts(id),
        account_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ==========================================
    // PHASE 3: STAKEHOLDERS & ASSETS
    // ==========================================
    console.log('  - Mapping Stakeholders & Assets...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) REFERENCES companies(id),
        account_id VARCHAR(36) REFERENCES accounts(id),
        account_name VARCHAR(255),
        code VARCHAR(50),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(100),
        mobile VARCHAR(20),
        address TEXT,
        tax_number VARCHAR(50),
        opening_balance DECIMAL(18, 4) DEFAULT 0,
        opening_balance_date DATE,
        counter_account_id VARCHAR(36),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS suppliers (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) REFERENCES companies(id),
        account_id VARCHAR(36) REFERENCES accounts(id),
        account_name VARCHAR(255),
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50),
        email VARCHAR(100),
        mobile VARCHAR(20),
        address TEXT,
        tax_number VARCHAR(50),
        opening_balance DECIMAL(18, 4) DEFAULT 0,
        opening_balance_date DATE,
        counter_account_id VARCHAR(36),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS payment_methods (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) REFERENCES companies(id),
        account_id VARCHAR(36) REFERENCES accounts(id),
        account_name VARCHAR(255),
        code VARCHAR(50),
        name VARCHAR(100) NOT NULL,
        type VARCHAR(20) DEFAULT 'cash',
        opening_balance DECIMAL(18, 4) DEFAULT 0,
        opening_balance_date DATE,
        counter_account_id VARCHAR(36),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

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
        counter_account_id VARCHAR(36),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ==========================================
    // PHASE 4: TRANSACTIONAL LAYER (PARENTS)
    // ==========================================
    console.log('  - Initiating Transactional Layer...');

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
        status VARCHAR(20) DEFAULT 'posted',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS invoices (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) REFERENCES companies(id),
        customer_id VARCHAR(36) REFERENCES customers(id),
        customer_name VARCHAR(255),
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
        payment_method_name VARCHAR(255),
        notes TEXT,
        created_by VARCHAR(36) REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS returns (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) REFERENCES companies(id),
        customer_id VARCHAR(36) REFERENCES customers(id),
        customer_name VARCHAR(255),
        return_number VARCHAR(50) NOT NULL,
        date DATE NOT NULL,
        total_amount DECIMAL(18, 4) NOT NULL,
        payment_type VARCHAR(20) DEFAULT 'cash',
        payment_method_id VARCHAR(36) REFERENCES payment_methods(id),
        payment_method_name VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS purchase_invoices (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) REFERENCES companies(id),
        supplier_id VARCHAR(36) REFERENCES suppliers(id),
        supplier_name VARCHAR(255),
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
        payment_method_name VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS purchase_returns (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) REFERENCES companies(id),
        supplier_id VARCHAR(36) REFERENCES suppliers(id),
        supplier_name VARCHAR(255),
        return_number VARCHAR(50) NOT NULL,
        date DATE NOT NULL,
        total_amount DECIMAL(18, 4) NOT NULL,
        payment_type VARCHAR(20) DEFAULT 'cash',
        payment_method_id VARCHAR(36) REFERENCES payment_methods(id),
        payment_method_name VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS receipt_vouchers (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) REFERENCES companies(id),
        customer_id VARCHAR(36) REFERENCES customers(id),
        customer_name VARCHAR(255),
        voucher_number VARCHAR(50),
        date DATE NOT NULL,
        amount DECIMAL(18, 4) NOT NULL,
        description TEXT,
        payment_method_id VARCHAR(36) REFERENCES payment_methods(id),
        payment_method_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS payment_vouchers (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) REFERENCES companies(id),
        supplier_id VARCHAR(36) REFERENCES suppliers(id),
        supplier_name VARCHAR(255),
        expense_category_id VARCHAR(36) REFERENCES expense_categories(id),
        category_name VARCHAR(255),
        date DATE NOT NULL,
        amount DECIMAL(18, 4) NOT NULL,
        description TEXT,
        payment_method_id VARCHAR(36) REFERENCES payment_methods(id),
        payment_method_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS cash_transfers (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) REFERENCES companies(id),
        date DATE NOT NULL,
        amount DECIMAL(18, 4) NOT NULL,
        from_payment_method_id VARCHAR(36) REFERENCES payment_methods(id),
        to_payment_method_id VARCHAR(36) REFERENCES payment_methods(id),
        from_payment_method_name VARCHAR(255),
        to_payment_method_name VARCHAR(255),
        description TEXT,
        created_by VARCHAR(36) REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ==========================================
    // PHASE 5: DETAIL LAYER (CHILDREN / LINES)
    // ==========================================
    console.log('  - Linking Financial Details...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS journal_entry_lines (
        id VARCHAR(36) PRIMARY KEY,
        journal_entry_id VARCHAR(36) REFERENCES journal_entries(id) ON DELETE CASCADE,
        account_id VARCHAR(36) REFERENCES accounts(id),
        account_name VARCHAR(255),
        description TEXT,
        debit DECIMAL(18, 4) DEFAULT 0,
        credit DECIMAL(18, 4) DEFAULT 0,
        customer_id VARCHAR(36) REFERENCES customers(id),
        supplier_id VARCHAR(36) REFERENCES suppliers(id),
        customer_name VARCHAR(255),
        supplier_name VARCHAR(255)
      );

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

      CREATE TABLE IF NOT EXISTS purchase_invoice_items (
        id VARCHAR(36) PRIMARY KEY,
        invoice_id VARCHAR(36) REFERENCES purchase_invoices(id) ON DELETE CASCADE,
        product_id VARCHAR(36) REFERENCES products(id),
        expense_category_id VARCHAR(36) REFERENCES expense_categories(id),
        description TEXT,
        quantity DECIMAL(18, 4) NOT NULL,
        unit_price DECIMAL(18, 4) NOT NULL,
        total DECIMAL(18, 4) NOT NULL,
        product_name VARCHAR(255),
        category_name VARCHAR(100),
        product_code VARCHAR(100),
        product_image_url TEXT
      );

      CREATE TABLE IF NOT EXISTS purchase_return_items (
        id VARCHAR(36) PRIMARY KEY,
        return_id VARCHAR(36) REFERENCES purchase_returns(id) ON DELETE CASCADE,
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

    // ==========================================
    // PHASE 6: SYSTEM UTILITIES & CONFIG
    // ==========================================
    console.log('  - Applying System Infrastructure...');

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

      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36),
        user_email VARCHAR(100),
        action VARCHAR(100) NOT NULL,
        resource VARCHAR(100) NOT NULL,
        resource_id VARCHAR(36),
        changes JSONB,
        severity VARCHAR(20) DEFAULT 'info',
        ip_address VARCHAR(45),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        company_id VARCHAR(36)
      );

      CREATE TABLE IF NOT EXISTS system_config (
        id VARCHAR(50) PRIMARY KEY,
        maintenance_mode BOOLEAN DEFAULT FALSE,
        maintenance_message TEXT,
        allowed_users JSONB DEFAULT '[]',
        min_client_version VARCHAR(20) DEFAULT '2.0.0',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by VARCHAR(36)
      );

      CREATE TABLE IF NOT EXISTS customer_discounts (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) REFERENCES companies(id),
        customer_id VARCHAR(36) REFERENCES customers(id),
        customer_name VARCHAR(255),
        date DATE NOT NULL,
        amount DECIMAL(18, 4) NOT NULL,
        description TEXT
      );

      CREATE TABLE IF NOT EXISTS supplier_discounts (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) REFERENCES companies(id),
        supplier_id VARCHAR(36) REFERENCES suppliers(id),
        supplier_name VARCHAR(255),
        date DATE NOT NULL,
        amount DECIMAL(18, 4) NOT NULL,
        description TEXT
      );

      CREATE TABLE IF NOT EXISTS settings (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) REFERENCES companies(id),
        type VARCHAR(50),
        key VARCHAR(100),
        value TEXT,
        customer_discount_account_id VARCHAR(36),
        supplier_discount_account_id VARCHAR(36),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ==========================================
    // PHASE 7: PERFORMANCE INDICES
    // ==========================================
    console.log('  - Hardening with Performance Indices...');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_company_timestamp ON activity_logs(company_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_category ON activity_logs USING GIN (category);
      
      CREATE INDEX IF NOT EXISTS idx_journal_entries_company_date ON journal_entries(company_id, date DESC);
      CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account_id ON journal_entry_lines(account_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_company_date ON invoices(company_id, date DESC);
      CREATE INDEX IF NOT EXISTS idx_returns_company_date ON returns(company_id, date DESC);
      CREATE INDEX IF NOT EXISTS idx_receipt_vouchers_company_date ON receipt_vouchers(company_id, date DESC);
      CREATE INDEX IF NOT EXISTS idx_payment_vouchers_company_date ON payment_vouchers(company_id, date DESC);
      CREATE INDEX IF NOT EXISTS idx_cash_transfers_company_date ON cash_transfers(company_id, date DESC);
      CREATE INDEX IF NOT EXISTS idx_purchase_invoices_company_date ON purchase_invoices(company_id, date DESC);
      CREATE INDEX IF NOT EXISTS idx_purchase_returns_company_date ON purchase_returns(company_id, date DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_company_timestamp ON audit_logs(company_id, timestamp DESC);
    `);

    await client.query('COMMIT');
    console.log('✅ Base Schema and Relational Guardrails established.');

    // 8. Seeding & Post-Init
    await seedDatabase(client);
    await runMigrations();

    console.log('🔥 Database initialization process complete.');
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('❌ FATAL: Error during database initialization:');
    console.error(error);
    throw error;
  } finally {
    if (client) client.release();
  }
}

/**
 * System Data Seeding
 */
async function seedDatabase(client: any) {
  console.log('  - Applying System Seeding...');
  
  // 1. Super Admin
  const adminEmail = 'omarwaelysy@gmail.com';
  try {
    const { rows } = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    if (rows.length === 0) {
      console.log(`    + Seeding Super Admin: ${adminEmail}`);
      const hashedPassword = await bcrypt.hash('123456', 10);
      await client.query(
        'INSERT INTO users (id, username, name, email, password_hash, role, company_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [uuidv4(), 'omar_admin', 'Omar Super Admin', adminEmail, hashedPassword, 'super_admin', 'SYSTEM']
      );
    }
  } catch (e) {
    console.warn('    ! Admin seeding check failed:', e);
  }

  // 2. Default System Config
  try {
    const { rows } = await client.query('SELECT id FROM system_config WHERE id = $1', ['global_config']);
    if (rows.length === 0) {
      console.log('    + Initializing Global Configuration');
      await client.query(
        'INSERT INTO system_config (id, maintenance_mode, min_client_version) VALUES ($1, $2, $3)',
        ['global_config', false, '2.0.0']
      );
    }
  } catch (e) {
    console.warn('    ! System config seeding check failed:', e);
  }
}
