-- 058_add_eta_columns_to_invoices.sql
-- Add eta_uuid and eta_invoice_number columns to invoices and returns tables for ETA electronic invoice integration

ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "eta_uuid" VARCHAR(255);
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "eta_invoice_number" VARCHAR(255);

ALTER TABLE "returns" ADD COLUMN IF NOT EXISTS "eta_uuid" VARCHAR(255);
ALTER TABLE "returns" ADD COLUMN IF NOT EXISTS "eta_invoice_number" VARCHAR(255);

CREATE INDEX IF NOT EXISTS "idx_invoices_eta_uuid" ON "invoices"("eta_uuid");
CREATE INDEX IF NOT EXISTS "idx_invoices_eta_inv_num" ON "invoices"("eta_invoice_number");

CREATE INDEX IF NOT EXISTS "idx_returns_eta_uuid" ON "returns"("eta_uuid");
CREATE INDEX IF NOT EXISTS "idx_returns_eta_inv_num" ON "returns"("eta_invoice_number");

-- Safe non-destructive backfill from existing Sent documents in eta_documents
UPDATE invoices i
SET eta_invoice_number = ed.internal_id,
    eta_uuid = ed.uuid
FROM eta_documents ed
WHERE ed.direction = 'Sent'
  AND (i.eta_uuid = ed.uuid OR i.invoice_number = ed.internal_id)
  AND (i.eta_invoice_number IS NULL OR i.eta_invoice_number = '');
