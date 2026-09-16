-- Migration 064: Add bank details to payment_methods
-- Adds bank_name_en, bank_code, bank_logo, bank_website, bank_hotline

ALTER TABLE "payment_methods" ADD COLUMN IF NOT EXISTS "bank_name_en" VARCHAR(255);
ALTER TABLE "payment_methods" ADD COLUMN IF NOT EXISTS "bank_code" VARCHAR(50);
ALTER TABLE "payment_methods" ADD COLUMN IF NOT EXISTS "bank_logo" TEXT;
ALTER TABLE "payment_methods" ADD COLUMN IF NOT EXISTS "bank_website" TEXT;
ALTER TABLE "payment_methods" ADD COLUMN IF NOT EXISTS "bank_hotline" VARCHAR(50);
