-- Migration 050: Add tax_item_code and tax_code_type to products
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "tax_item_code" VARCHAR(100);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "tax_code_type" VARCHAR(50) DEFAULT 'EGS';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "eta_item_code" VARCHAR(100);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "eta_code_type" VARCHAR(50) DEFAULT 'EGS';

CREATE INDEX IF NOT EXISTS "idx_products_tax_item_code" ON "products" ("tax_item_code");
CREATE INDEX IF NOT EXISTS "idx_products_eta_item_code" ON "products" ("eta_item_code");
