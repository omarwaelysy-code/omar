-- Migration: 082_set_reference_number_for_manual_journal_entries.sql
-- Sets reference_number = entry_number for all general/manual journal entries missing a reference_number
-- so that "رقم الحركة" displays the entry number (e.g. JE-2026-06-18-00001).

UPDATE journal_entries
SET reference_number = entry_number
WHERE (reference_type IN ('manual', 'journal_entry', 'create_journal_entry') OR reference_type IS NULL OR reference_type = '')
  AND (reference_number IS NULL OR reference_number = '');
