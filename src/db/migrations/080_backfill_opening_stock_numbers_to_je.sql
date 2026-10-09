-- Migration 080: Backfill opening_stock_balances document_number into journal_entries.reference_number
-- Ensures opening stock balance document numbers (e.g. OPB-2026-06-02-00001) appear in Detailed Journal Entries, Journal Entries list, and General Ledger.

UPDATE journal_entries je
SET reference_number = opb.document_number
FROM opening_stock_balances opb
WHERE (je.reference_id = opb.id::text OR je.reference_id = opb.document_number)
  AND (je.reference_number IS NULL OR je.reference_number = '')
  AND je.reference_type IN ('opening_stock_balance', 'opening_stock_balances', 'opening_stock');

-- Also backfill any stock adjustments that might have been created without reference_number
UPDATE journal_entries je
SET reference_number = sa.adjustment_number
FROM stock_adjustments sa
WHERE (je.reference_id = sa.id::text OR je.reference_id = sa.adjustment_number)
  AND (je.reference_number IS NULL OR je.reference_number = '')
  AND je.reference_type IN ('stock_adjustment', 'stock_adjustments');
