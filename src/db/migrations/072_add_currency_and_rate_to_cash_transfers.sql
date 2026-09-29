-- Migration 072: Add currency and exchange rate fields to cash_transfers
-- Enables multi-currency transfers between banks and cash safes

ALTER TABLE "cash_transfers"
ADD COLUMN IF NOT EXISTS "from_currency" VARCHAR(10) DEFAULT 'EGP',
ADD COLUMN IF NOT EXISTS "to_currency" VARCHAR(10) DEFAULT 'EGP',
ADD COLUMN IF NOT EXISTS "exchange_rate" DECIMAL(18, 6) DEFAULT 1,
ADD COLUMN IF NOT EXISTS "converted_amount" DECIMAL(18, 4);
