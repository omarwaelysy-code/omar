-- Migration 075: Add missing columns to issued_cheques
ALTER TABLE "issued_cheques" ADD COLUMN IF NOT EXISTS "signatory_name" VARCHAR(255);
ALTER TABLE "issued_cheques" ADD COLUMN IF NOT EXISTS "supplier_name" VARCHAR(255);
ALTER TABLE "issued_cheques" ADD COLUMN IF NOT EXISTS "settlements" JSONB DEFAULT '[]';
