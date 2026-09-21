-- Migration 069: Add attachments to customers and suppliers, and bank_accounts to suppliers

ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "attachments" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "attachments" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "bank_accounts" JSONB DEFAULT '[]'::jsonb;
