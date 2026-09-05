-- Migration 049: Enforce accounting account association for suppliers and customers
-- Ensures that NO supplier or customer can EVER be inserted or updated without a linked accounting account.

-- 1. Suppliers trigger
CREATE OR REPLACE FUNCTION trg_enforce_supplier_account()
RETURNS TRIGGER AS $$
DECLARE
  v_default_account_id VARCHAR(36);
  v_default_account_name VARCHAR(255);
BEGIN
  -- If account_id is empty or null, attempt auto-resolution from company's chart of accounts
  IF NEW.account_id IS NULL OR length(trim(NEW.account_id)) = 0 THEN
    SELECT id, name INTO v_default_account_id, v_default_account_name
    FROM accounts
    WHERE company_id = NEW.company_id
      AND (
        account_usage IN ('supplier', 'accounts_payable')
        OR code = '210101'
        OR code LIKE '2101%'
        OR name LIKE '%مورد%'
      )
      AND (is_active IS NULL OR is_active = true)
    ORDER BY
      CASE 
        WHEN account_usage = 'supplier' THEN 1
        WHEN account_usage = 'accounts_payable' THEN 2
        WHEN code = '210101' THEN 3
        WHEN code LIKE '2101%' THEN 4
        ELSE 5
      END,
      code ASC
    LIMIT 1;

    IF v_default_account_id IS NOT NULL THEN
      NEW.account_id := v_default_account_id;
      IF NEW.account_name IS NULL OR length(trim(COALESCE(NEW.account_name, ''))) = 0 THEN
        NEW.account_name := v_default_account_name;
      END IF;
    ELSE
      RAISE EXCEPTION 'خطأ فادح: لا يمكن حفظ أو إنشاء المورد بدون تحديد حساب محاسبي للموردين بدليل الحسابات.';
    END IF;
  END IF;

  -- Ensure account_name is populated if missing
  IF (NEW.account_name IS NULL OR length(trim(COALESCE(NEW.account_name, ''))) = 0) AND NEW.account_id IS NOT NULL THEN
    SELECT name INTO v_default_account_name FROM accounts WHERE id = NEW.account_id;
    IF v_default_account_name IS NOT NULL THEN
      NEW.account_name := v_default_account_name;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_supplier_account ON suppliers;
CREATE TRIGGER trg_check_supplier_account
BEFORE INSERT OR UPDATE ON suppliers
FOR EACH ROW
EXECUTE FUNCTION trg_enforce_supplier_account();

-- 2. Customers trigger
CREATE OR REPLACE FUNCTION trg_enforce_customer_account()
RETURNS TRIGGER AS $$
DECLARE
  v_default_account_id VARCHAR(36);
  v_default_account_name VARCHAR(255);
BEGIN
  -- If account_id is empty or null, attempt auto-resolution from company's chart of accounts
  IF NEW.account_id IS NULL OR length(trim(NEW.account_id)) = 0 THEN
    SELECT id, name INTO v_default_account_id, v_default_account_name
    FROM accounts
    WHERE company_id = NEW.company_id
      AND (
        account_usage IN ('customer', 'accounts_receivable')
        OR code = '110201'
        OR code = '111'
        OR code LIKE '1102%'
        OR name LIKE '%عميل%'
        OR name LIKE '%عملاء%'
      )
      AND (is_active IS NULL OR is_active = true)
    ORDER BY
      CASE 
        WHEN account_usage = 'customer' THEN 1
        WHEN account_usage = 'accounts_receivable' THEN 2
        WHEN code = '110201' THEN 3
        WHEN code LIKE '1102%' THEN 4
        ELSE 5
      END,
      code ASC
    LIMIT 1;

    IF v_default_account_id IS NOT NULL THEN
      NEW.account_id := v_default_account_id;
      IF NEW.account_name IS NULL OR length(trim(COALESCE(NEW.account_name, ''))) = 0 THEN
        NEW.account_name := v_default_account_name;
      END IF;
    ELSE
      RAISE EXCEPTION 'خطأ فادح: لا يمكن حفظ أو إنشاء العميل بدون تحديد حساب محاسبي للعملاء بدليل الحسابات.';
    END IF;
  END IF;

  -- Ensure account_name is populated if missing
  IF (NEW.account_name IS NULL OR length(trim(COALESCE(NEW.account_name, ''))) = 0) AND NEW.account_id IS NOT NULL THEN
    SELECT name INTO v_default_account_name FROM accounts WHERE id = NEW.account_id;
    IF v_default_account_name IS NOT NULL THEN
      NEW.account_name := v_default_account_name;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_customer_account ON customers;
CREATE TRIGGER trg_check_customer_account
BEFORE INSERT OR UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION trg_enforce_customer_account();
