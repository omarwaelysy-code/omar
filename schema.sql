-- PostgreSQL Schema for ERP System

-- 1. Companies
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

-- 2. Roles
CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description TEXT
);

-- 3. Users
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

-- 4. Account Types
CREATE TABLE IF NOT EXISTS account_types (
    id VARCHAR(36) PRIMARY KEY,
    company_id VARCHAR(36) REFERENCES companies(id),
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    statement_type VARCHAR(50) NOT NULL,
    classification VARCHAR(50) NOT NULL
);

-- 5. Chart of Accounts
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

-- 6. Customers
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

-- 7. Suppliers
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

-- 8. Products
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

-- 9. Invoices
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

-- 10. Invoice Items
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

-- 11. Journal Entries
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

-- 12. Journal Entry Lines
CREATE TABLE IF NOT EXISTS journal_entry_lines (
    id VARCHAR(36) PRIMARY KEY,
    journal_entry_id VARCHAR(36) REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id VARCHAR(36) REFERENCES accounts(id),
    description TEXT,
    debit DECIMAL(18, 4) DEFAULT 0,
    credit DECIMAL(18, 4) DEFAULT 0
);

-- 13. Payment Methods
CREATE TABLE IF NOT EXISTS payment_methods (
    id VARCHAR(36) PRIMARY KEY,
    company_id VARCHAR(36) REFERENCES companies(id),
    account_id VARCHAR(36) REFERENCES accounts(id),
    name VARCHAR(100) NOT NULL
);

-- 14. Activity Logs
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
