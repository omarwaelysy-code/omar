-- Migration 066: Support Other / General Cheques (non-supplier cheques)
-- Allow supplier_id to be NULL and add debit_account_id, debit_account_name, cheque_type

DO $$
BEGIN
  -- 1. Drop NOT NULL constraint on supplier_id if present
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'issued_cheques' 
      AND column_name = 'supplier_id' 
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "issued_cheques" ALTER COLUMN "supplier_id" DROP NOT NULL;
  END IF;

  -- 2. Add cheque_type column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'issued_cheques' AND column_name = 'cheque_type'
  ) THEN
    ALTER TABLE "issued_cheques" ADD COLUMN "cheque_type" VARCHAR(50) DEFAULT 'supplier';
  END IF;

  -- 3. Add debit_account_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'issued_cheques' AND column_name = 'debit_account_id'
  ) THEN
    ALTER TABLE "issued_cheques" ADD COLUMN "debit_account_id" VARCHAR(36) REFERENCES "accounts"("id");
  END IF;

  -- 4. Add debit_account_name column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'issued_cheques' AND column_name = 'debit_account_name'
  ) THEN
    ALTER TABLE "issued_cheques" ADD COLUMN "debit_account_name" VARCHAR(255);
  END IF;

  -- 5. Backfill existing cheques to cheque_type = 'supplier' where null
  UPDATE "issued_cheques" SET "cheque_type" = 'supplier' WHERE "cheque_type" IS NULL;

END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_issued_cheques_type" ON "issued_cheques"("company_id", "cheque_type");
CREATE INDEX IF NOT EXISTS "idx_issued_cheques_debit_account" ON "issued_cheques"("company_id", "debit_account_id");
