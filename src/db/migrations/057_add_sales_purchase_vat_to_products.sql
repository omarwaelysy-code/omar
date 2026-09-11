-- 057_add_sales_purchase_vat_to_products.sql
-- Add separate sales VAT and purchase VAT accounts to products table

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sales_vat_account_id" VARCHAR(36);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sales_vat_account_name" VARCHAR(255);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "purchase_vat_account_id" VARCHAR(36);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "purchase_vat_account_name" VARCHAR(255);

-- Backfill from existing vat_account_id / vat_account_name if not already set
UPDATE products 
SET sales_vat_account_id = COALESCE(sales_vat_account_id, vat_account_id),
    sales_vat_account_name = COALESCE(sales_vat_account_name, vat_account_name),
    purchase_vat_account_id = COALESCE(purchase_vat_account_id, vat_account_id),
    purchase_vat_account_name = COALESCE(purchase_vat_account_name, vat_account_name)
WHERE vat_account_id IS NOT NULL;
