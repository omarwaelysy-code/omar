-- Migration 086: Update trg_prevent_delete_default_account to allow deleting duplicate default accounts while protecting single instances

CREATE OR REPLACE FUNCTION trg_prevent_delete_default_account()
RETURNS TRIGGER AS $$
DECLARE
  v_is_mapped BOOLEAN := FALSE;
  v_count INT := 0;
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

  -- Check if this code is a default account AND is the last/only instance in this company
  IF OLD.code IN (
    '110101', '110103', '110201', '110301', '110402', '110403',
    '210101', '210202', '210203', '3101', '3103', '3104',
    '4101', '4103', '4104', '5101', '5103', '5104', '5105',
    '420201', '630201', '420202', '630202'
  ) THEN
    SELECT count(*) INTO v_count FROM accounts WHERE company_id = OLD.company_id AND code = OLD.code;
    IF v_count <= 1 THEN
      RAISE EXCEPTION 'خطأ: لا يمكن حذف هذا الحساب لأنه من الحسابات الافتراضية الأساسية للنظام.';
    END IF;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
