-- 058_add_withholding_tax_support.sql
-- Add Withholding Tax (ضريبة الخصم والإضافة - ض.خ.إ) columns to products, invoices, purchase_invoices, returns, and purchase_returns

-- 1. Products table
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sales_withholding_tax_account_id" VARCHAR(36);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sales_withholding_tax_account_name" VARCHAR(255);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sales_withholding_tax_rate" DECIMAL(10, 4) DEFAULT 0;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "purchase_withholding_tax_account_id" VARCHAR(36);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "purchase_withholding_tax_account_name" VARCHAR(255);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "purchase_withholding_tax_rate" DECIMAL(10, 4) DEFAULT 0;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "purchase_vat_rate" DECIMAL(10, 4) DEFAULT 14;

-- 2. Sales Invoices & Items
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "withholding_tax_amount" DECIMAL(18, 4) DEFAULT 0;
ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "withholding_tax_rate" DECIMAL(10, 4) DEFAULT 0;
ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "withholding_tax_amount" DECIMAL(18, 4) DEFAULT 0;

-- 3. Purchase Invoices & Items
ALTER TABLE "purchase_invoices" ADD COLUMN IF NOT EXISTS "withholding_tax_amount" DECIMAL(18, 4) DEFAULT 0;
ALTER TABLE "purchase_invoice_items" ADD COLUMN IF NOT EXISTS "withholding_tax_rate" DECIMAL(10, 4) DEFAULT 0;
ALTER TABLE "purchase_invoice_items" ADD COLUMN IF NOT EXISTS "withholding_tax_amount" DECIMAL(18, 4) DEFAULT 0;

-- 4. Sales Returns & Items
ALTER TABLE "returns" ADD COLUMN IF NOT EXISTS "withholding_tax_amount" DECIMAL(18, 4) DEFAULT 0;
ALTER TABLE "return_items" ADD COLUMN IF NOT EXISTS "withholding_tax_rate" DECIMAL(10, 4) DEFAULT 0;
ALTER TABLE "return_items" ADD COLUMN IF NOT EXISTS "withholding_tax_amount" DECIMAL(18, 4) DEFAULT 0;

-- 5. Purchase Returns & Items
ALTER TABLE "purchase_returns" ADD COLUMN IF NOT EXISTS "withholding_tax_amount" DECIMAL(18, 4) DEFAULT 0;
ALTER TABLE "purchase_return_items" ADD COLUMN IF NOT EXISTS "withholding_tax_rate" DECIMAL(10, 4) DEFAULT 0;
ALTER TABLE "purchase_return_items" ADD COLUMN IF NOT EXISTS "withholding_tax_amount" DECIMAL(18, 4) DEFAULT 0;
