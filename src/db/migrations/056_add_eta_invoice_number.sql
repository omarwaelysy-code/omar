-- 056_add_eta_invoice_number.sql
-- Add eta_invoice_number column to link purchase invoices and purchase returns with ETA internal document numbers (e.g. DN1-2026-00203)

ALTER TABLE "purchase_invoices" ADD COLUMN IF NOT EXISTS "eta_invoice_number" VARCHAR(255);
ALTER TABLE "purchase_returns" ADD COLUMN IF NOT EXISTS "eta_invoice_number" VARCHAR(255);

CREATE INDEX IF NOT EXISTS "idx_purchase_invoices_eta_inv_num" ON "purchase_invoices"("eta_invoice_number");
CREATE INDEX IF NOT EXISTS "idx_purchase_returns_eta_inv_num" ON "purchase_returns"("eta_invoice_number");

-- Backfill eta_invoice_number from eta_documents where eta_uuid is already set
UPDATE purchase_invoices pi
SET eta_invoice_number = ed.internal_id
FROM eta_documents ed
WHERE pi.eta_uuid = ed.uuid AND (pi.eta_invoice_number IS NULL OR pi.eta_invoice_number = '');

UPDATE purchase_returns pr
SET eta_invoice_number = ed.internal_id
FROM eta_documents ed
WHERE pr.eta_uuid = ed.uuid AND (pr.eta_invoice_number IS NULL OR pr.eta_invoice_number = '');
