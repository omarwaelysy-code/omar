-- Migration 062: Add credit_account_id and credit_account_name to issued_cheques
-- Ensures each issued cheque can track its specific credit account (e.g. Notes Payable or designated liability/bank)

ALTER TABLE "issued_cheques" 
ADD COLUMN IF NOT EXISTS "credit_account_id" VARCHAR(36) REFERENCES "accounts"("id"),
ADD COLUMN IF NOT EXISTS "credit_account_name" VARCHAR(255);

CREATE INDEX IF NOT EXISTS "idx_issued_cheques_credit_account" ON "issued_cheques"("company_id", "credit_account_id");

-- Ensure notes_payable account exists for each company that lacks one
DO $$
DECLARE
  comp RECORD;
  v_parent_id VARCHAR(36);
  v_acc_id VARCHAR(36);
BEGIN
  FOR comp IN SELECT id FROM companies LOOP
    IF NOT EXISTS (
      SELECT 1 FROM accounts 
      WHERE company_id = comp.id 
      AND (account_usage = 'notes_payable' OR code IN ('210102', '212') OR name LIKE '%أوراق دفع%')
    ) THEN
      -- Try to locate parent liabilities account
      SELECT id INTO v_parent_id FROM accounts WHERE company_id = comp.id AND code = '2101' LIMIT 1;
      IF v_parent_id IS NULL THEN
        SELECT id INTO v_parent_id FROM accounts WHERE company_id = comp.id AND code = '21' LIMIT 1;
      END IF;
      
      v_acc_id := gen_random_uuid()::text;
      INSERT INTO accounts (id, company_id, parent_id, code, name, account_usage, is_active)
      VALUES (v_acc_id, comp.id, v_parent_id, '210102', 'أوراق دفع - شيكات صادرة', 'notes_payable', true);
    END IF;
  END LOOP;
END $$;
