-- Migration 071: Create document import batches table and add batch_number to transaction tables

-- 1. Add batch_number to transaction tables
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "batch_number" VARCHAR(100);
ALTER TABLE "purchase_invoices" ADD COLUMN IF NOT EXISTS "batch_number" VARCHAR(100);
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "batch_number" VARCHAR(100);
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "batch_number" VARCHAR(100);
ALTER TABLE "returns" ADD COLUMN IF NOT EXISTS "batch_number" VARCHAR(100);
ALTER TABLE "purchase_returns" ADD COLUMN IF NOT EXISTS "batch_number" VARCHAR(100);

-- 2. Create document_import_batches table
CREATE TABLE IF NOT EXISTS "document_import_batches" (
  "id" VARCHAR(255) PRIMARY KEY,
  "company_id" VARCHAR(255) NOT NULL,
  "batch_number" VARCHAR(100) NOT NULL,
  "batch_type" VARCHAR(50) NOT NULL, -- 'sales' or 'purchases'
  "batch_date" DATE NOT NULL,
  "total_documents" INTEGER DEFAULT 0,
  "total_amount" NUMERIC(15, 2) DEFAULT 0,
  "details" JSONB DEFAULT '[]'::jsonb,
  "status" VARCHAR(50) DEFAULT 'posted',
  "created_by" VARCHAR(255),
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS "idx_import_batches_company" ON "document_import_batches"("company_id");
CREATE INDEX IF NOT EXISTS "idx_import_batches_number" ON "document_import_batches"("company_id", "batch_number");
CREATE INDEX IF NOT EXISTS "idx_invoices_batch_num" ON "invoices"("company_id", "batch_number");
CREATE INDEX IF NOT EXISTS "idx_purchase_invoices_batch_num" ON "purchase_invoices"("company_id", "batch_number");
CREATE INDEX IF NOT EXISTS "idx_sales_orders_batch_num" ON "sales_orders"("company_id", "batch_number");
CREATE INDEX IF NOT EXISTS "idx_purchase_orders_batch_num" ON "purchase_orders"("company_id", "batch_number");
CREATE INDEX IF NOT EXISTS "idx_returns_batch_num" ON "returns"("company_id", "batch_number");
CREATE INDEX IF NOT EXISTS "idx_purchase_returns_batch_num" ON "purchase_returns"("company_id", "batch_number");
