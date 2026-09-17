-- Migration 065: Add serial_number, is_crossed, is_not_negotiable to issued_cheques
-- Non-destructive backward-compatible schema addition

ALTER TABLE "issued_cheques" 
ADD COLUMN IF NOT EXISTS "serial_number" VARCHAR(100),
ADD COLUMN IF NOT EXISTS "is_crossed" BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS "is_not_negotiable" BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS "idx_issued_cheques_serial_number" ON "issued_cheques"("company_id", "serial_number");

-- Backfill existing records with sequential serial_number CHQ-YYYY-MM-000001
WITH numbered AS (
  SELECT id, 
         'CHQ-' || TO_CHAR(COALESCE(issue_date, created_at::date, CURRENT_DATE), 'YYYY-MM') || '-' || LPAD(ROW_NUMBER() OVER (PARTITION BY company_id, TO_CHAR(COALESCE(issue_date, created_at::date, CURRENT_DATE), 'YYYY-MM') ORDER BY created_at, id)::text, 6, '0') AS gen_serial
  FROM "issued_cheques"
  WHERE "serial_number" IS NULL
)
UPDATE "issued_cheques" c
SET "serial_number" = n.gen_serial
FROM numbered n
WHERE c.id = n.id AND c.serial_number IS NULL;
