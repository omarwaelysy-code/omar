-- Migration 088: Invert amounts and quantities for reversal documents to negative (-)

-- 1. Invoices
UPDATE invoices 
SET subtotal = -ABS(subtotal),
    tax_amount = -ABS(tax_amount),
    total_amount = -ABS(total_amount),
    discount_amount = CASE WHEN discount_amount > 0 THEN -ABS(discount_amount) ELSE discount_amount END,
    withholding_tax_amount = CASE WHEN withholding_tax_amount > 0 THEN -ABS(withholding_tax_amount) ELSE withholding_tax_amount END
WHERE is_reversal_doc = true;

-- 2. Invoice Items
UPDATE invoice_items 
SET quantity = -ABS(quantity),
    total = -ABS(total),
    vat_amount = CASE WHEN vat_amount > 0 THEN -ABS(vat_amount) ELSE vat_amount END
WHERE invoice_id IN (SELECT id FROM invoices WHERE is_reversal_doc = true);

-- 3. Purchase Invoices
UPDATE purchase_invoices 
SET subtotal = -ABS(subtotal),
    tax_amount = -ABS(tax_amount),
    total_amount = -ABS(total_amount),
    discount_amount = CASE WHEN discount_amount > 0 THEN -ABS(discount_amount) ELSE discount_amount END,
    withholding_tax_amount = CASE WHEN withholding_tax_amount > 0 THEN -ABS(withholding_tax_amount) ELSE withholding_tax_amount END
WHERE is_reversal_doc = true;

-- 4. Purchase Invoice Items
UPDATE purchase_invoice_items 
SET quantity = -ABS(quantity),
    total = -ABS(total),
    vat_amount = CASE WHEN vat_amount > 0 THEN -ABS(vat_amount) ELSE vat_amount END
WHERE purchase_invoice_id IN (SELECT id FROM purchase_invoices WHERE is_reversal_doc = true);

-- 5. Returns
UPDATE returns 
SET subtotal = -ABS(subtotal),
    tax_amount = -ABS(tax_amount),
    total_amount = -ABS(total_amount),
    discount_amount = CASE WHEN discount_amount > 0 THEN -ABS(discount_amount) ELSE discount_amount END,
    withholding_tax_amount = CASE WHEN withholding_tax_amount > 0 THEN -ABS(withholding_tax_amount) ELSE withholding_tax_amount END
WHERE is_reversal_doc = true;

-- 6. Return Items
UPDATE return_items 
SET quantity = -ABS(quantity),
    total = -ABS(total)
WHERE return_id IN (SELECT id FROM returns WHERE is_reversal_doc = true);

-- 7. Purchase Returns
UPDATE purchase_returns 
SET subtotal = -ABS(subtotal),
    tax_amount = -ABS(tax_amount),
    total_amount = -ABS(total_amount),
    discount_amount = CASE WHEN discount_amount > 0 THEN -ABS(discount_amount) ELSE discount_amount END,
    withholding_tax_amount = CASE WHEN withholding_tax_amount > 0 THEN -ABS(withholding_tax_amount) ELSE withholding_tax_amount END
WHERE is_reversal_doc = true;

-- 8. Purchase Return Items
UPDATE purchase_return_items 
SET quantity = -ABS(quantity),
    total = -ABS(total)
WHERE purchase_return_id IN (SELECT id FROM purchase_returns WHERE is_reversal_doc = true);

-- 9. Receipt Vouchers
UPDATE receipt_vouchers 
SET amount = -ABS(amount)
WHERE is_reversal_doc = true;

-- 10. Payment Vouchers
UPDATE payment_vouchers 
SET amount = -ABS(amount)
WHERE is_reversal_doc = true;
