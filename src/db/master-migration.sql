-- ERP MASTER MIGRATION - SAFE ADDITIVE CHANGES ONLY
-- This file acts as a baseline sync and runs on every system start.

-- 1. Companies Table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS website VARCHAR(255);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) DEFAULT 'trial';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(20) DEFAULT 'basic';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_start TIMESTAMP;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_end TIMESTAMP;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_expiry TIMESTAMP;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_days INTEGER DEFAULT 30;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS users_limit INTEGER DEFAULT 5;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS transactions_limit INTEGER DEFAULT 1000;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS company_status VARCHAR(20) DEFAULT 'active';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 2. Users Table
ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS temp_password VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;

-- 3. Customers Table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS account_id VARCHAR(36);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS code VARCHAR(50);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS opening_balance DECIMAL(18, 4) DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS opening_balance_date DATE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS counter_account_id VARCHAR(36);

-- 4. Suppliers Table
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS account_id VARCHAR(36);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS code VARCHAR(50);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS opening_balance DECIMAL(18, 4) DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS opening_balance_date DATE;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS counter_account_id VARCHAR(36);

-- 5. Products Table
ALTER TABLE products ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'product';
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit VARCHAR(50);
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price DECIMAL(18, 4) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_price DECIMAL(18, 4) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock DECIMAL(18, 4) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock DECIMAL(18, 4) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS current_stock DECIMAL(18, 4) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_service BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS counter_account_id VARCHAR(36);
ALTER TABLE products ADD COLUMN IF NOT EXISTS revenue_account_id VARCHAR(36);
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_account_id VARCHAR(36);
ALTER TABLE products ADD COLUMN IF NOT EXISTS revenue_account_name VARCHAR(255);
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_account_name VARCHAR(255);

-- 6. Accounts Table
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS parent_id VARCHAR(36);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS opening_balance DECIMAL(18, 4) DEFAULT 0;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 7. Invoices Table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subtotal DECIMAL(18, 4) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(18, 4) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(18, 4) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_amount DECIMAL(18, 4) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_method_id VARCHAR(36);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_by VARCHAR(36);

-- 8. Purchase Invoices Table
ALTER TABLE purchase_invoices ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE purchase_invoices ADD COLUMN IF NOT EXISTS subtotal DECIMAL(18, 4) DEFAULT 0;
ALTER TABLE purchase_invoices ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(18, 4) DEFAULT 0;
ALTER TABLE purchase_invoices ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(18, 4) DEFAULT 0;
ALTER TABLE purchase_invoices ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft';
ALTER TABLE purchase_invoices ADD COLUMN IF NOT EXISTS payment_type VARCHAR(20) DEFAULT 'cash';
ALTER TABLE purchase_invoices ADD COLUMN IF NOT EXISTS payment_method_id VARCHAR(36);
ALTER TABLE purchase_invoices ADD COLUMN IF NOT EXISTS notes TEXT;

-- 9. Denormalized Fields for Items (Audit/UI)
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS product_name VARCHAR(255);
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS product_code VARCHAR(100);
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS product_image_url TEXT;

ALTER TABLE return_items ADD COLUMN IF NOT EXISTS product_name VARCHAR(255);
ALTER TABLE return_items ADD COLUMN IF NOT EXISTS product_code VARCHAR(100);
ALTER TABLE return_items ADD COLUMN IF NOT EXISTS product_image_url TEXT;

-- 10. Receipt & Payment Vouchers
ALTER TABLE receipt_vouchers ADD COLUMN IF NOT EXISTS payment_method_id VARCHAR(36);
ALTER TABLE payment_vouchers ADD COLUMN IF NOT EXISTS payment_method_id VARCHAR(36);

-- 11. Activity Logs
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS company_id VARCHAR(36);
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS user_id VARCHAR(36);
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS username VARCHAR(100);
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS details TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS category JSONB;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS document_id VARCHAR(36);
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS changes JSONB;

-- 12. Journal Entries
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS reference_id VARCHAR(36);
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50);
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS reference_number VARCHAR(50);
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'posted';

-- 13. Payment Methods
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS account_id VARCHAR(36);
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS code VARCHAR(50);
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'cash';
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS opening_balance DECIMAL(18, 4) DEFAULT 0;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS opening_balance_date DATE;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS counter_account_id VARCHAR(36);

-- Indices 
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_company_timestamp ON activity_logs(company_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_category ON activity_logs USING GIN (category);

-- Report Optimization Indices
CREATE INDEX IF NOT EXISTS idx_journal_entries_company_date ON journal_entries(company_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account_id ON journal_entry_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company_date ON invoices(company_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_returns_company_date ON returns(company_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_receipt_vouchers_company_date ON receipt_vouchers(company_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_company_date ON payment_vouchers(company_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_transfers_company_date ON cash_transfers(company_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_company_date ON purchase_invoices(company_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_company_date ON purchase_returns(company_id, date DESC);

-- 14. Custom System Check Table (for tracking)
CREATE TABLE IF NOT EXISTS _system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO _system_settings (key, value) VALUES ('schema_version', '{"version": "1.0.1"}') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;
