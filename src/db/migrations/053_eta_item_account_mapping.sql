-- 053_eta_item_account_mapping.sql
-- Allow mapping ETA items to Chart of Accounts (accounts) as well as products

-- 1. Make product_id nullable in eta_item_mappings so items can be mapped to an account instead
ALTER TABLE "eta_item_mappings" ALTER COLUMN "product_id" DROP NOT NULL;

-- 2. Add account_id column referencing accounts table
ALTER TABLE "eta_item_mappings" ADD COLUMN IF NOT EXISTS "account_id" VARCHAR(36) REFERENCES "accounts"("id") ON DELETE SET NULL;

-- 3. Add mapping_type column ('product' | 'account')
ALTER TABLE "eta_item_mappings" ADD COLUMN IF NOT EXISTS "mapping_type" VARCHAR(20) DEFAULT 'product';

-- 4. Create index on account_id
CREATE INDEX IF NOT EXISTS "idx_eta_item_mappings_comp_acc" ON "eta_item_mappings"("company_id", "account_id");
