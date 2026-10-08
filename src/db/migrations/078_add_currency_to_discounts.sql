-- Migration 078: Add multi-currency support to customer_discounts and supplier_discounts

ALTER TABLE "customer_discounts"
ADD COLUMN IF NOT EXISTS "currency" VARCHAR(10) DEFAULT 'EGP',
ADD COLUMN IF NOT EXISTS "currency_id" VARCHAR(36),
ADD COLUMN IF NOT EXISTS "exchange_rate" NUMERIC(15, 6) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS "currency_amount" NUMERIC(15, 2);

ALTER TABLE "supplier_discounts"
ADD COLUMN IF NOT EXISTS "currency" VARCHAR(10) DEFAULT 'EGP',
ADD COLUMN IF NOT EXISTS "currency_id" VARCHAR(36),
ADD COLUMN IF NOT EXISTS "exchange_rate" NUMERIC(15, 6) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS "currency_amount" NUMERIC(15, 2);
