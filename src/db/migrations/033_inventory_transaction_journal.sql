-- Inventory Transaction Journal Migration (Phase 4)
-- Creates inventory_transaction_journal table

CREATE TABLE IF NOT EXISTS "inventory_transaction_journal" (
  "id" VARCHAR(36) PRIMARY KEY,
  "company_id" VARCHAR(36) NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "warehouse_id" VARCHAR(36) REFERENCES "warehouses"("id"),
  "movement_id" VARCHAR(36) REFERENCES "inventory_movements_v2"("id") ON DELETE SET NULL,
  "movement_type" VARCHAR(50) NOT NULL REFERENCES "inventory_movement_types"("id"),
  "source_document_type" VARCHAR(50),
  "source_document_id" VARCHAR(36),
  "reference_number" VARCHAR(50) NOT NULL,
  "status" VARCHAR(20) NOT NULL CHECK ("status" IN ('Draft', 'Posted', 'Cancelled', 'Reversed')),
  "created_by" VARCHAR(36) REFERENCES "users"("id"),
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "posted_at" TIMESTAMP,
  "cancelled_at" TIMESTAMP,
  "notes" TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "idx_itj_company" ON "inventory_transaction_journal"("company_id");
CREATE INDEX IF NOT EXISTS "idx_itj_movement" ON "inventory_transaction_journal"("movement_id");
CREATE INDEX IF NOT EXISTS "idx_itj_doc" ON "inventory_transaction_journal"("source_document_type", "source_document_id");
CREATE INDEX IF NOT EXISTS "idx_itj_created" ON "inventory_transaction_journal"("created_at");
