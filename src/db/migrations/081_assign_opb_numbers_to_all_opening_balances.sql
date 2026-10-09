-- Migration: 081_assign_opb_numbers_to_all_opening_balances.sql
-- Assigns unique OPB-YYYY-MM-XXXXXX numbers to all opening balance journal entries across all entities (customers, suppliers, banks/safes, accounts)
-- and synchronizes atomic document sequence counters.

DO $$
DECLARE
    rec RECORD;
    v_year_month TEXT;
    v_db_max INT;
    v_seq_max INT;
    v_next_seq INT;
    v_ref TEXT;
BEGIN
    -- Loop through all opening balance journal entries missing a reference_number
    FOR rec IN (
        SELECT id, company_id, date, entry_number
        FROM journal_entries
        WHERE reference_type = 'opening_balance'
          AND (reference_number IS NULL OR reference_number = '')
        ORDER BY company_id, date ASC, entry_number ASC, created_at ASC, id ASC
    ) LOOP
        v_year_month := TO_CHAR(rec.date, 'YYYY-MM');

        -- 1. Get max sequence from existing journal_entries for this company & month
        SELECT COALESCE(MAX(
            CASE 
                WHEN reference_number ~ ('^OPB-' || v_year_month || '-[0-9]+$') 
                THEN SUBSTRING(reference_number FROM '\d+$')::INTEGER 
                ELSE 0 
            END
        ), 0)
        INTO v_db_max
        FROM journal_entries
        WHERE company_id = rec.company_id
          AND reference_number LIKE 'OPB-' || v_year_month || '-%';

        -- 2. Get max sequence from document_sequences table if present
        SELECT COALESCE(last_seq, 0)
        INTO v_seq_max
        FROM document_sequences
        WHERE company_id = rec.company_id
          AND module = 'opening_balances'
          AND period = v_year_month;

        -- 3. Calculate next sequence number
        v_next_seq := GREATEST(COALESCE(v_db_max, 0), COALESCE(v_seq_max, 0)) + 1;
        v_ref := 'OPB-' || v_year_month || '-' || LPAD(v_next_seq::TEXT, 6, '0');

        -- 4. Update the journal entry
        UPDATE journal_entries
        SET reference_number = v_ref
        WHERE id = rec.id;

        -- 5. Record sequence counter atomically
        INSERT INTO document_sequences (id, company_id, module, period, last_seq, updated_at)
        VALUES (
            rec.company_id || ':opening_balances:' || v_year_month,
            rec.company_id,
            'opening_balances',
            v_year_month,
            v_next_seq,
            NOW()
        )
        ON CONFLICT (company_id, module, period)
        DO UPDATE SET 
            last_seq = GREATEST(document_sequences.last_seq, EXCLUDED.last_seq),
            updated_at = NOW();

    END LOOP;
END $$;
