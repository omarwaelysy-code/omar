-- 1. Companies Extensions
ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS website VARCHAR(255);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_start TIMESTAMP;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_end TIMESTAMP;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_days INTEGER DEFAULT 30;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS users_limit INTEGER DEFAULT 5;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS transactions_limit INTEGER DEFAULT 1000;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';

-- 2. Users Extensions
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS temp_password VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';

-- 3. Inventory & Trading Extensions
-- Customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS code VARCHAR(50);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS opening_balance DECIMAL(18, 4) DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS opening_balance_date DATE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS counter_account_id VARCHAR(36);

-- Suppliers
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS opening_balance DECIMAL(18, 4) DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS opening_balance_date DATE;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS counter_account_id VARCHAR(36);

-- Products
ALTER TABLE products ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'product';
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS counter_account_id VARCHAR(36);

-- Payment Methods
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS code VARCHAR(50);
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'cash';
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS opening_balance DECIMAL(18, 4) DEFAULT 0;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS opening_balance_date DATE;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS counter_account_id VARCHAR(36);

-- Invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_method_id VARCHAR(36);

-- 4. Audit & Denormalization (Optional but helpful for performance)
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS product_name VARCHAR(255);
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS product_code VARCHAR(100);

ALTER TABLE return_items ADD COLUMN IF NOT EXISTS product_name VARCHAR(255);
ALTER TABLE return_items ADD COLUMN IF NOT EXISTS product_code VARCHAR(100);

-- Ensure indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(date);
CREATE INDEX IF NOT EXISTS idx_companies_code ON companies(code);
