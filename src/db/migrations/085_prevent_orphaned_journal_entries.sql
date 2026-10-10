-- Migration 085: Clean orphaned journal entries and add database-level triggers to prevent future orphans

-- 1. Remove the confirmed orphaned journal entry in Sadway (JE-2026-06-01-00002) linked to non-existent voucher 4cde354f-7a24-4813-bcc8-da4ccbcfc1ac
DELETE FROM journal_entry_lines 
WHERE journal_entry_id = '899b3f0f-b97e-4ec9-a7e6-a13a94fe5d8f';

DELETE FROM journal_entries 
WHERE id = '899b3f0f-b97e-4ec9-a7e6-a13a94fe5d8f';

-- 2. General Trigger function to cascade-clean linked journal entries whenever a source document is deleted
CREATE OR REPLACE FUNCTION clean_orphaned_journal_entries()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM journal_entry_lines 
    WHERE journal_entry_id IN (
        SELECT id FROM journal_entries 
        WHERE reference_id = OLD.id::text
    );
    DELETE FROM journal_entries 
    WHERE reference_id = OLD.id::text;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 3. Attach triggers to transactional tables
DROP TRIGGER IF EXISTS trg_clean_je_payment_vouchers ON payment_vouchers;
CREATE TRIGGER trg_clean_je_payment_vouchers
AFTER DELETE ON payment_vouchers
FOR EACH ROW EXECUTE FUNCTION clean_orphaned_journal_entries();

DROP TRIGGER IF EXISTS trg_clean_je_receipt_vouchers ON receipt_vouchers;
CREATE TRIGGER trg_clean_je_receipt_vouchers
AFTER DELETE ON receipt_vouchers
FOR EACH ROW EXECUTE FUNCTION clean_orphaned_journal_entries();

DROP TRIGGER IF EXISTS trg_clean_je_customers ON customers;
CREATE TRIGGER trg_clean_je_customers
AFTER DELETE ON customers
FOR EACH ROW EXECUTE FUNCTION clean_orphaned_journal_entries();

DROP TRIGGER IF EXISTS trg_clean_je_suppliers ON suppliers;
CREATE TRIGGER trg_clean_je_suppliers
AFTER DELETE ON suppliers
FOR EACH ROW EXECUTE FUNCTION clean_orphaned_journal_entries();

DROP TRIGGER IF EXISTS trg_clean_je_payment_methods ON payment_methods;
CREATE TRIGGER trg_clean_je_payment_methods
AFTER DELETE ON payment_methods
FOR EACH ROW EXECUTE FUNCTION clean_orphaned_journal_entries();
