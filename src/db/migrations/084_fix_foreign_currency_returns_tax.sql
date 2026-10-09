-- Migration 084: Fix foreign currency returns tax and discount amounts
-- Ensure parent tax_amount and discount_amount match document currency lines, not local EGP journal amounts

UPDATE "purchase_returns" pr SET
  tax_amount = COALESCE((SELECT SUM(pri.vat_amount) FROM "purchase_return_items" pri WHERE pri.return_id = pr.id AND pri.vat_amount > 0), pr.tax_amount)
WHERE EXISTS (SELECT 1 FROM "purchase_return_items" pri WHERE pri.return_id = pr.id AND pri.vat_amount > 0);

UPDATE "returns" r SET
  tax_amount = COALESCE((SELECT SUM(ri.vat_amount) FROM "return_items" ri WHERE ri.return_id = r.id AND ri.vat_amount > 0), r.tax_amount)
WHERE EXISTS (SELECT 1 FROM "return_items" ri WHERE ri.return_id = r.id AND ri.vat_amount > 0);

UPDATE "purchase_returns" pr SET
  discount_amount = COALESCE((SELECT SUM(pri.discount_amount) FROM "purchase_return_items" pri WHERE pri.return_id = pr.id AND pri.discount_amount > 0), pr.discount_amount)
WHERE EXISTS (SELECT 1 FROM "purchase_return_items" pri WHERE pri.return_id = pr.id AND pri.discount_amount > 0);

UPDATE "returns" r SET
  discount_amount = COALESCE((SELECT SUM(ri.discount_amount) FROM "return_items" ri WHERE ri.return_id = r.id AND ri.discount_amount > 0), r.discount_amount)
WHERE EXISTS (SELECT 1 FROM "return_items" ri WHERE ri.return_id = r.id AND ri.discount_amount > 0);
