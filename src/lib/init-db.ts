import pool from './postgres';

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

  try {
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
        subscription_status VARCHAR(20) DEFAULT 'trial',
        subscription_plan VARCHAR(20) DEFAULT 'basic',
        subscription_expiry TIMESTAMP,
        company_status VARCHAR(20) DEFAULT 'active',
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
        name VARCHAR(255) NOT NULL,
        email VARCHAR(100),
        mobile VARCHAR(20),
        address TEXT,
        tax_number VARCHAR(50)
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
        tax_number VARCHAR(50)
      );
    `);

    // 8. Products
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) REFERENCES companies(id),
        revenue_account_id VARCHAR(36) REFERENCES accounts(id),
        cost_account_id VARCHAR(36) REFERENCES accounts(id),
        name VARCHAR(255) NOT NULL,
        code VARCHAR(100),
        barcode VARCHAR(100),
        cost_price DECIMAL(18, 4) DEFAULT 0,
        sale_price DECIMAL(18, 4) DEFAULT 0,
        min_stock DECIMAL(18, 4) DEFAULT 0,
        current_stock DECIMAL(18, 4) DEFAULT 0,
        is_service BOOLEAN DEFAULT FALSE
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
        total DECIMAL(18, 4) NOT NULL
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
        name VARCHAR(100) NOT NULL
      );
    `);

    // 14. Activity Logs
    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id BIGSERIAL PRIMARY KEY,
        company_id VARCHAR(36),
        user_id VARCHAR(36),
        action VARCHAR(100) NOT NULL,
        details TEXT,
        ip_address VARCHAR(45),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_activity_logs_company_id ON activity_logs(company_id);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
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
        total DECIMAL(18, 4) NOT NULL
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
    console.log('PostgreSQL Database initialized successfully.');

    // Seed Super Admin
    const adminEmail = 'omarwaelysy@gmail.com';
    const { rows } = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    if (rows.length === 0) {
      console.log('Seeding default Super Admin...');
      const bcrypt = await import('bcryptjs');
      const { v4: uuidv4 } = await import('uuid');
      const hashedPassword = await bcrypt.default.hash('123456', 10);
      await client.query(
        'INSERT INTO users (id, username, name, email, password_hash, role, company_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [uuidv4(), 'omar_admin', 'Omar Super Admin', adminEmail, hashedPassword, 'super_admin', 'system']
      );
      console.log('Super Admin seeded.');
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error initializing PostgreSQL database:', error);
    throw error;
  } finally {
    client.release();
  }
}
