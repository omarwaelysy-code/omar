-- Migration: 001_ensure_audit_fields
-- Adds unified audit fields to key tables if they are missing

ALTER TABLE companies ADD COLUMN IF NOT EXISTS updated_by VARCHAR(36);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS created_by VARCHAR(36);
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS company_id VARCHAR(36);

-- Add index for invoice numbers
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
