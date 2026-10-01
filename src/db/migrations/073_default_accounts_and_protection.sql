-- Migration 073: Default Accounts Mappings & Deletion Protection
-- 1. Create default_account_mappings table
CREATE TABLE IF NOT EXISTS default_account_mappings (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  setting_key VARCHAR(100) NOT NULL,
  account_id VARCHAR(36) NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  account_code VARCHAR(50),
  account_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unq_company_setting_key UNIQUE(company_id, setting_key)
);

CREATE INDEX IF NOT EXISTS idx_default_account_mappings_company ON default_account_mappings(company_id);
CREATE INDEX IF NOT EXISTS idx_default_account_mappings_account ON default_account_mappings(account_id);

-- 2. Trigger function to prevent deletion of default or currently mapped accounts
CREATE OR REPLACE FUNCTION trg_prevent_delete_default_account()
RETURNS TRIGGER AS $$
DECLARE
  v_is_mapped BOOLEAN := FALSE;
BEGIN
  -- Check if account is mapped in default_account_mappings
  SELECT EXISTS (
    SELECT 1 FROM default_account_mappings WHERE account_id = OLD.id
  ) INTO v_is_mapped;

  IF v_is_mapped THEN
    RAISE EXCEPTION 'خطأ: لا يمكن حذف هذا الحساب لأنه محدد كحساب افتراضي في شاشة الحسابات الافتراضية.';
  END IF;

  -- Check if account is mapped in discount_settings
  IF EXISTS (
    SELECT 1 FROM settings 
    WHERE (customer_discount_account_id = OLD.id OR supplier_discount_account_id = OLD.id)
  ) THEN
    RAISE EXCEPTION 'خطأ: لا يمكن حذف هذا الحساب لأنه محدد كحساب افتراضي في إعدادات الخصم.';
  END IF;

  -- Check if account is one of the core default accounts by code
  IF OLD.code IN (
    '110101', '110103', '110201', '110301', '110402', '110403',
    '210101', '210202', '210203', '3101', '3103', '3104',
    '4101', '4103', '4104', '5101', '5103', '5104', '5105',
    '420201', '630201', '420202', '630202'
  ) THEN
    RAISE EXCEPTION 'خطأ: لا يمكن حذف هذا الحساب لأنه من الحسابات الافتراضية الأساسية للنظام.';
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_account_deletion ON accounts;
CREATE TRIGGER trg_check_account_deletion
BEFORE DELETE ON accounts
FOR EACH ROW
EXECUTE FUNCTION trg_prevent_delete_default_account();
