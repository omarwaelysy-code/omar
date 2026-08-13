-- Migration 040: Add Packaging Type and Fractional Allowance Fields to Products
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "allow_issue_fraction" BOOLEAN DEFAULT FALSE;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "allow_receipt_fraction" BOOLEAN DEFAULT FALSE;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "allow_issue_fraction_pct" DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "allow_receipt_fraction_pct" DECIMAL(10, 2) DEFAULT 0;
