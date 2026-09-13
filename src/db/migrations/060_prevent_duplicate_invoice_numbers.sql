-- Migration 060: Add UNIQUE constraint on (invoice_number, company_id)
-- Purpose: Prevent duplicate invoices with the same number per company,
--          which was the root cause of unbalanced journal entries from backfill.

-- First: remove any remaining duplicates before adding constraint
-- (keep the one with invoice_items, remove the ghost)
DO $$
DECLARE
  dup RECORD;
  ghost_id TEXT;
BEGIN
  FOR dup IN
    SELECT invoice_number, company_id
    FROM invoices
    GROUP BY invoice_number, company_id
    HAVING COUNT(*) > 1
  LOOP
    -- Find the duplicate that has NO items (ghost) - delete it
    SELECT id INTO ghost_id
    FROM invoices i
    WHERE i.invoice_number = dup.invoice_number
      AND i.company_id = dup.company_id
      AND NOT EXISTS (
        SELECT 1 FROM invoice_items ii WHERE ii.invoice_id = i.id
      )
    LIMIT 1;

    IF ghost_id IS NOT NULL THEN
      RAISE NOTICE 'Removing ghost invoice: % (%)', dup.invoice_number, ghost_id;
      -- Remove any associated journal entries first
      DELETE FROM journal_entry_lines WHERE journal_entry_id IN (
        SELECT id FROM journal_entries WHERE reference_id = ghost_id
      );
      DELETE FROM journal_entries WHERE reference_id = ghost_id;
      DELETE FROM invoices WHERE id = ghost_id;
    END IF;
  END LOOP;
END $$;

-- Now add the UNIQUE constraint safely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'invoices_invoice_number_company_id_unique'
      AND conrelid = 'invoices'::regclass
  ) THEN
    ALTER TABLE invoices
      ADD CONSTRAINT invoices_invoice_number_company_id_unique
      UNIQUE (invoice_number, company_id);
    RAISE NOTICE 'Added UNIQUE constraint on invoices(invoice_number, company_id)';
  ELSE
    RAISE NOTICE 'UNIQUE constraint already exists, skipping.';
  END IF;
END $$;
