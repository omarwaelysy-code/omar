-- Migration 037: Smart Goods Receipt Matching Mode and Tracking Columns
ALTER TABLE companies ADD COLUMN IF NOT EXISTS goods_receipt_matching_mode VARCHAR(50) DEFAULT 'SmartMatching';

ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS billing_status VARCHAR(50) DEFAULT 'uninvoiced';

ALTER TABLE goods_receipt_items ADD COLUMN IF NOT EXISTS billed_quantity DECIMAL(15, 4) DEFAULT 0;
ALTER TABLE goods_receipt_items ADD COLUMN IF NOT EXISTS remaining_quantity DECIMAL(15, 4);

-- Backfill remaining_quantity for existing items
UPDATE goods_receipt_items SET remaining_quantity = quantity WHERE remaining_quantity IS NULL;
