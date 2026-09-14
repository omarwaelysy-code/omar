-- Migration 062: Add credit_account_id and credit_account_name to issued_cheques
-- Strictly adds columns and index only. No accounts are created.

ALTER TABLE "issued_cheques" 
ADD COLUMN IF NOT EXISTS "credit_account_id" VARCHAR(36) REFERENCES "accounts"("id"),
ADD COLUMN IF NOT EXISTS "credit_account_name" VARCHAR(255);

CREATE INDEX IF NOT EXISTS "idx_issued_cheques_credit_account" ON "issued_cheques"("company_id", "credit_account_id");
