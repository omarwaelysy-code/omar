-- 059_add_eta_status_to_invoices_and_returns.sql
-- Add eta_status, eta_submission_uuid, eta_submitted_at, and eta_error columns to invoices and returns tables

ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "eta_status" VARCHAR(50);
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "eta_submission_uuid" VARCHAR(255);
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "eta_submitted_at" TIMESTAMP;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "eta_error" TEXT;

ALTER TABLE "returns" ADD COLUMN IF NOT EXISTS "eta_status" VARCHAR(50);
ALTER TABLE "returns" ADD COLUMN IF NOT EXISTS "eta_submission_uuid" VARCHAR(255);
ALTER TABLE "returns" ADD COLUMN IF NOT EXISTS "eta_submitted_at" TIMESTAMP;
ALTER TABLE "returns" ADD COLUMN IF NOT EXISTS "eta_error" TEXT;

CREATE INDEX IF NOT EXISTS "idx_invoices_eta_status" ON "invoices"("eta_status");
CREATE INDEX IF NOT EXISTS "idx_returns_eta_status" ON "returns"("eta_status");
