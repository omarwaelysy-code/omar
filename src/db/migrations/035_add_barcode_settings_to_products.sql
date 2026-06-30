-- Migration 035: Add barcode_settings to products
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "barcode_settings" JSONB;
