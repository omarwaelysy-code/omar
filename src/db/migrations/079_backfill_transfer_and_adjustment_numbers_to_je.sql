-- Migration 079: Backfill transfer_number and adjustment_number into journal_entries.reference_number
-- Ensures transfer and adjustment reference numbers appear in Detailed Journal Entries, Journal Entries list, and General Ledger.

UPDATE journal_entries je
SET reference_number = ct.transfer_number
FROM cash_transfers ct
WHERE (je.reference_id = ct.id::text OR je.reference_id = ct.transfer_number)
  AND (je.reference_number IS NULL OR je.reference_number = '')
  AND je.reference_type IN ('cash_transfer', 'transfer');

UPDATE journal_entries je
SET reference_number = sa.adjustment_number
FROM stock_adjustments sa
WHERE (je.reference_id = sa.id::text OR je.reference_id = sa.adjustment_number)
  AND (je.reference_number IS NULL OR je.reference_number = '')
  AND je.reference_type = 'stock_adjustment';
