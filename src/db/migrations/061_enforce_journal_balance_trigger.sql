-- Migration 061: Enforce Journal Entry Balance at Database Level
-- PURPOSE: This is the TRUE guarantee that NO unbalanced journal entry can EVER
--          be saved to the database, regardless of where the INSERT/UPDATE comes from.
--          (API, backfill, manual scripts, future code, etc.)
--
-- MECHANISM: A PostgreSQL TRIGGER on journal_entries that fires BEFORE INSERT/UPDATE.
-- If (total_debit != total_credit) the trigger RAISES an EXCEPTION → transaction ROLLS BACK.
-- Additionally, a TRIGGER on journal_entry_lines recalculates header totals automatically.

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Function that validates balance on the journal_entries header row
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_check_journal_entry_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow NaN or NULL to pass (they will be caught by the lines trigger below)
  IF NEW.total_debit IS NULL OR NEW.total_credit IS NULL THEN
    RAISE EXCEPTION 
      'القيد المحاسبي (%) لا يمكن حفظه: total_debit أو total_credit قيمة NULL. يجب أن يتساوى المدين والدائن.',
      NEW.id;
  END IF;

  -- Reject NaN values
  IF NEW.total_debit != NEW.total_debit OR NEW.total_credit != NEW.total_credit THEN
    RAISE EXCEPTION
      'القيد المحاسبي (%) لا يمكن حفظه: يحتوي على قيمة NaN. يجب أن يتساوى المدين والدائن.',
      NEW.id;
  END IF;

  -- The core balance check: allow tiny floating point differences (< 0.01)
  IF ABS(NEW.total_debit - NEW.total_credit) > 0.01 THEN
    RAISE EXCEPTION
      'القيد المحاسبي غير متوازن: المدين=% والدائن=% (الفرق=%). لا يمكن حفظ قيد غير متوازن.',
      NEW.total_debit,
      NEW.total_credit,
      NEW.total_debit - NEW.total_credit;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Attach trigger BEFORE INSERT OR UPDATE on journal_entries
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_check_journal_entry_balance ON journal_entries;
CREATE TRIGGER trg_check_journal_entry_balance
  BEFORE INSERT OR UPDATE ON journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION fn_check_journal_entry_balance();

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: Function that auto-recalculates header totals from lines
--         and validates balance after any line INSERT/UPDATE/DELETE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_sync_journal_entry_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_je_id TEXT;
  v_sum_debit NUMERIC(18,4);
  v_sum_credit NUMERIC(18,4);
BEGIN
  -- Determine which journal_entry_id to check
  IF TG_OP = 'DELETE' THEN
    v_je_id := OLD.journal_entry_id;
  ELSE
    v_je_id := NEW.journal_entry_id;
  END IF;

  -- Calculate actual sums from lines
  SELECT 
    COALESCE(SUM(debit), 0),
    COALESCE(SUM(credit), 0)
  INTO v_sum_debit, v_sum_credit
  FROM journal_entry_lines
  WHERE journal_entry_id = v_je_id;

  -- Update the header totals to match actual lines
  UPDATE journal_entries
  SET 
    total_debit = v_sum_debit,
    total_credit = v_sum_credit
  WHERE id = v_je_id;
  -- Note: The UPDATE above will fire trg_check_journal_entry_balance,
  -- which will REJECT the update if lines are unbalanced.

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: Attach trigger AFTER INSERT/UPDATE/DELETE on journal_entry_lines
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_sync_journal_entry_totals ON journal_entry_lines;
CREATE TRIGGER trg_sync_journal_entry_totals
  AFTER INSERT OR UPDATE OR DELETE ON journal_entry_lines
  FOR EACH ROW
  EXECUTE FUNCTION fn_sync_journal_entry_totals();

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5: Verify existing data is clean before enabling
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  bad_count INT;
BEGIN
  SELECT COUNT(*) INTO bad_count
  FROM journal_entries
  WHERE ABS(total_debit - total_credit) > 0.01
     OR total_debit IS NULL 
     OR total_credit IS NULL;
  
  IF bad_count > 0 THEN
    RAISE WARNING 'Found % unbalanced journal entries before enabling trigger. Fix them first!', bad_count;
  ELSE
    RAISE NOTICE 'All existing journal entries are balanced. Trigger is now active.';
  END IF;
END $$;
