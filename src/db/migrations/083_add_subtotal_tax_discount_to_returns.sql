-- Migration 083: Add subtotal, tax_amount, discount_amount to returns and purchase_returns
-- Safe, additive changes to bridge document lines, taxes, and discounts with journal entries

-- 1. Add columns to purchase_returns
ALTER TABLE "purchase_returns" ADD COLUMN IF NOT EXISTS "subtotal" NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE "purchase_returns" ADD COLUMN IF NOT EXISTS "tax_amount" NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE "purchase_returns" ADD COLUMN IF NOT EXISTS "discount_amount" NUMERIC(18, 4) DEFAULT 0;

-- 2. Add columns to purchase_return_items
ALTER TABLE "purchase_return_items" ADD COLUMN IF NOT EXISTS "vat_rate" NUMERIC(10, 4) DEFAULT 0;
ALTER TABLE "purchase_return_items" ADD COLUMN IF NOT EXISTS "vat_amount" NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE "purchase_return_items" ADD COLUMN IF NOT EXISTS "discount_amount" NUMERIC(18, 4) DEFAULT 0;

-- 3. Add columns to returns
ALTER TABLE "returns" ADD COLUMN IF NOT EXISTS "subtotal" NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE "returns" ADD COLUMN IF NOT EXISTS "tax_amount" NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE "returns" ADD COLUMN IF NOT EXISTS "discount_amount" NUMERIC(18, 4) DEFAULT 0;

-- 4. Add columns to return_items
ALTER TABLE "return_items" ADD COLUMN IF NOT EXISTS "vat_rate" NUMERIC(10, 4) DEFAULT 0;
ALTER TABLE "return_items" ADD COLUMN IF NOT EXISTS "vat_amount" NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE "return_items" ADD COLUMN IF NOT EXISTS "discount_amount" NUMERIC(18, 4) DEFAULT 0;

-- 5. Backfill existing purchase_returns from items and journal entries
UPDATE "purchase_returns" pr SET
  subtotal = COALESCE((SELECT SUM(pri.total) FROM "purchase_return_items" pri WHERE pri.return_id = pr.id), pr.total_amount),
  tax_amount = COALESCE((
    SELECT SUM(jel.credit) 
    FROM "journal_entries" je 
    JOIN "journal_entry_lines" jel ON jel.journal_entry_id = je.id 
    JOIN "accounts" a ON a.id = jel.account_id 
    WHERE je.reference_id = pr.id AND (a.code LIKE '222%' OR a.name ILIKE '%قيمة مضافة%')
  ), 0),
  discount_amount = COALESCE((
    SELECT SUM(jel.debit) 
    FROM "journal_entries" je 
    JOIN "journal_entry_lines" jel ON jel.journal_entry_id = je.id 
    JOIN "accounts" a ON a.id = jel.account_id 
    WHERE je.reference_id = pr.id AND (a.code = '512' OR a.name ILIKE '%خصم%')
  ), 0)
WHERE pr.subtotal IS NULL OR pr.subtotal = 0;

-- 6. Backfill existing returns from items and journal entries
UPDATE "returns" r SET
  subtotal = COALESCE((SELECT SUM(ri.total) FROM "return_items" ri WHERE ri.return_id = r.id), r.total_amount),
  tax_amount = COALESCE((
    SELECT SUM(jel.debit) 
    FROM "journal_entries" je 
    JOIN "journal_entry_lines" jel ON jel.journal_entry_id = je.id 
    JOIN "accounts" a ON a.id = jel.account_id 
    WHERE je.reference_id = r.id AND (a.code LIKE '222%' OR a.name ILIKE '%قيمة مضافة%')
  ), 0),
  discount_amount = COALESCE((
    SELECT SUM(jel.credit) 
    FROM "journal_entries" je 
    JOIN "journal_entry_lines" jel ON jel.journal_entry_id = je.id 
    JOIN "accounts" a ON a.id = jel.account_id 
    WHERE je.reference_id = r.id AND (a.code = '412' OR a.name ILIKE '%خصم%')
  ), 0)
WHERE r.subtotal IS NULL OR r.subtotal = 0;

-- 7. Backfill item VAT rates and amounts for purchase_return_items where tax exists on parent
UPDATE "purchase_return_items" pri SET
  vat_rate = COALESCE(NULLIF(p.vat_rate, 0), 14),
  vat_amount = ROUND(pri.total * (COALESCE(NULLIF(p.vat_rate, 0), 14) / 100), 2)
FROM "products" p, "purchase_returns" pr
WHERE pri.product_id = p.id
  AND pr.id = pri.return_id
  AND pr.tax_amount > 0
  AND (pri.vat_amount IS NULL OR pri.vat_amount = 0);

-- 8. Backfill item VAT rates and amounts for return_items where tax exists on parent
UPDATE "return_items" ri SET
  vat_rate = COALESCE(NULLIF(p.vat_rate, 0), 14),
  vat_amount = ROUND(ri.total * (COALESCE(NULLIF(p.vat_rate, 0), 14) / 100), 2)
FROM "products" p, "returns" r
WHERE ri.product_id = p.id
  AND r.id = ri.return_id
  AND r.tax_amount > 0
  AND (ri.vat_amount IS NULL OR ri.vat_amount = 0);
