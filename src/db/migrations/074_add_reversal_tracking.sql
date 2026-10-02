-- Migration 074: Add Reversal Tracking Columns
DO $$
BEGIN
  -- 1. Invoices
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'invoices') THEN
    ALTER TABLE "invoices" 
      ADD COLUMN IF NOT EXISTS "is_reversed" BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS "reversed_at" TIMESTAMP NULL,
      ADD COLUMN IF NOT EXISTS "reversal_reason" TEXT NULL,
      ADD COLUMN IF NOT EXISTS "reversed_by_doc_id" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "reversed_by_doc_number" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "reversed_by_entry_id" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "reversed_by_entry_number" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "is_reversal_doc" BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS "original_doc_id" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "original_doc_number" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "original_entry_id" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "original_entry_number" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "reversal_settlement_number" VARCHAR(100) NULL;
  END IF;

  -- 2. Purchase Invoices
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'purchase_invoices') THEN
    ALTER TABLE "purchase_invoices" 
      ADD COLUMN IF NOT EXISTS "is_reversed" BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS "reversed_at" TIMESTAMP NULL,
      ADD COLUMN IF NOT EXISTS "reversal_reason" TEXT NULL,
      ADD COLUMN IF NOT EXISTS "reversed_by_doc_id" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "reversed_by_doc_number" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "reversed_by_entry_id" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "reversed_by_entry_number" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "is_reversal_doc" BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS "original_doc_id" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "original_doc_number" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "original_entry_id" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "original_entry_number" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "reversal_settlement_number" VARCHAR(100) NULL;
  END IF;

  -- 3. Sales Returns
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'returns') THEN
    ALTER TABLE "returns" 
      ADD COLUMN IF NOT EXISTS "is_reversed" BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS "reversed_at" TIMESTAMP NULL,
      ADD COLUMN IF NOT EXISTS "reversal_reason" TEXT NULL,
      ADD COLUMN IF NOT EXISTS "reversed_by_doc_id" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "reversed_by_doc_number" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "reversed_by_entry_id" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "reversed_by_entry_number" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "is_reversal_doc" BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS "original_doc_id" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "original_doc_number" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "original_entry_id" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "original_entry_number" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "reversal_settlement_number" VARCHAR(100) NULL;
  END IF;

  -- 4. Purchase Returns
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'purchase_returns') THEN
    ALTER TABLE "purchase_returns" 
      ADD COLUMN IF NOT EXISTS "is_reversed" BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS "reversed_at" TIMESTAMP NULL,
      ADD COLUMN IF NOT EXISTS "reversal_reason" TEXT NULL,
      ADD COLUMN IF NOT EXISTS "reversed_by_doc_id" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "reversed_by_doc_number" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "reversed_by_entry_id" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "reversed_by_entry_number" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "is_reversal_doc" BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS "original_doc_id" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "original_doc_number" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "original_entry_id" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "original_entry_number" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "reversal_settlement_number" VARCHAR(100) NULL;
  END IF;

  -- 5. Receipt Vouchers
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'receipt_vouchers') THEN
    ALTER TABLE "receipt_vouchers" 
      ADD COLUMN IF NOT EXISTS "is_reversed" BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS "reversed_at" TIMESTAMP NULL,
      ADD COLUMN IF NOT EXISTS "reversal_reason" TEXT NULL,
      ADD COLUMN IF NOT EXISTS "reversed_by_doc_id" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "reversed_by_doc_number" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "reversed_by_entry_id" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "reversed_by_entry_number" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "is_reversal_doc" BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS "original_doc_id" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "original_doc_number" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "original_entry_id" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "original_entry_number" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "reversal_settlement_number" VARCHAR(100) NULL;
  END IF;

  -- 6. Payment Vouchers
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payment_vouchers') THEN
    ALTER TABLE "payment_vouchers" 
      ADD COLUMN IF NOT EXISTS "is_reversed" BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS "reversed_at" TIMESTAMP NULL,
      ADD COLUMN IF NOT EXISTS "reversal_reason" TEXT NULL,
      ADD COLUMN IF NOT EXISTS "reversed_by_doc_id" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "reversed_by_doc_number" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "reversed_by_entry_id" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "reversed_by_entry_number" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "is_reversal_doc" BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS "original_doc_id" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "original_doc_number" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "original_entry_id" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "original_entry_number" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "reversal_settlement_number" VARCHAR(100) NULL;
  END IF;

  -- 7. Cash Transfers
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cash_transfers') THEN
    ALTER TABLE "cash_transfers" 
      ADD COLUMN IF NOT EXISTS "is_reversed" BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS "reversed_at" TIMESTAMP NULL,
      ADD COLUMN IF NOT EXISTS "reversal_reason" TEXT NULL,
      ADD COLUMN IF NOT EXISTS "reversed_by_doc_id" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "reversed_by_doc_number" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "reversed_by_entry_id" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "reversed_by_entry_number" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "is_reversal_doc" BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS "original_doc_id" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "original_doc_number" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "original_entry_id" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "original_entry_number" VARCHAR(100) NULL;
  END IF;

  -- 8. Customer Discounts
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'customer_discounts') THEN
    ALTER TABLE "customer_discounts" 
      ADD COLUMN IF NOT EXISTS "is_reversed" BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS "reversed_at" TIMESTAMP NULL,
      ADD COLUMN IF NOT EXISTS "reversal_reason" TEXT NULL,
      ADD COLUMN IF NOT EXISTS "reversed_by_doc_id" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "reversed_by_doc_number" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "reversed_by_entry_id" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "reversed_by_entry_number" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "is_reversal_doc" BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS "original_doc_id" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "original_doc_number" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "original_entry_id" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "original_entry_number" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "reversal_settlement_number" VARCHAR(100) NULL;
  END IF;

  -- 9. Opening Stock Balances
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'opening_stock_balances') THEN
    ALTER TABLE "opening_stock_balances" 
      ADD COLUMN IF NOT EXISTS "is_reversed" BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS "reversed_at" TIMESTAMP NULL,
      ADD COLUMN IF NOT EXISTS "reversal_reason" TEXT NULL,
      ADD COLUMN IF NOT EXISTS "reversed_by_doc_id" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "reversed_by_doc_number" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "reversed_by_entry_id" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "reversed_by_entry_number" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "is_reversal_doc" BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS "original_doc_id" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "original_doc_number" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "original_entry_id" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "original_entry_number" VARCHAR(100) NULL;
  END IF;

  -- 10. Journal Entries
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'journal_entries') THEN
    ALTER TABLE "journal_entries" 
      ADD COLUMN IF NOT EXISTS "is_reversed" BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS "reversed_at" TIMESTAMP NULL,
      ADD COLUMN IF NOT EXISTS "reversal_reason" TEXT NULL,
      ADD COLUMN IF NOT EXISTS "reversed_by_entry_id" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "reversed_by_entry_number" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "is_reversal_entry" BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS "original_entry_id" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "original_entry_number" VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
