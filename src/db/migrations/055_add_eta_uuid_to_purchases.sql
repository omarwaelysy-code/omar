-- 055_add_eta_uuid_to_purchases.sql
-- Add eta_uuid column to link purchase invoices and purchase returns with ETA official documents

ALTER TABLE "purchase_invoices" ADD COLUMN IF NOT EXISTS "eta_uuid" VARCHAR(255);
ALTER TABLE "purchase_returns" ADD COLUMN IF NOT EXISTS "eta_uuid" VARCHAR(255);

CREATE INDEX IF NOT EXISTS "idx_purchase_invoices_eta_uuid" ON "purchase_invoices"("eta_uuid");
CREATE INDEX IF NOT EXISTS "idx_purchase_returns_eta_uuid" ON "purchase_returns"("eta_uuid");
