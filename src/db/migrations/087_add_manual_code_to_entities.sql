-- Migration 087: Add manual_code to customers, suppliers, and products
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "manual_code" VARCHAR(100);
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "manual_code" VARCHAR(100);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "manual_code" VARCHAR(100);
