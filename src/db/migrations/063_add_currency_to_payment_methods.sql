-- Migration 063: Add currency to payment_methods
-- Adds currency column with default 'EGP'

ALTER TABLE "payment_methods" 
ADD COLUMN IF NOT EXISTS "currency" VARCHAR(10) DEFAULT 'EGP';
