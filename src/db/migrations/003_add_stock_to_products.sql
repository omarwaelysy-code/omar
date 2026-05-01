-- Migration to add missing stock, account name, category and unit columns to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock DECIMAL(18, 4) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS revenue_account_name VARCHAR(255);
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_account_name VARCHAR(255);
ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit VARCHAR(50);
