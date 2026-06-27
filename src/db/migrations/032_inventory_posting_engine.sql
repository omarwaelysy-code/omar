-- Inventory Posting Engine Migration (Phase 3)
-- Adds columns to inventory_movement_lines and creates stock_card table

-- 1. Add snapshot columns to inventory_movement_lines
ALTER TABLE "inventory_movement_lines" ADD COLUMN IF NOT EXISTS "before_quantity" DECIMAL(18, 4) DEFAULT 0;
ALTER TABLE "inventory_movement_lines" ADD COLUMN IF NOT EXISTS "after_quantity" DECIMAL(18, 4) DEFAULT 0;
ALTER TABLE "inventory_movement_lines" ADD COLUMN IF NOT EXISTS "before_cost" DECIMAL(18, 4) DEFAULT 0;
ALTER TABLE "inventory_movement_lines" ADD COLUMN IF NOT EXISTS "after_cost" DECIMAL(18, 4) DEFAULT 0;

-- 2. Create stock_card table for posting logs
CREATE TABLE IF NOT EXISTS "stock_card" (
  "id" VARCHAR(36) PRIMARY KEY,
  "company_id" VARCHAR(36) NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "warehouse_id" VARCHAR(36) REFERENCES "warehouses"("id"),
  "product_id" VARCHAR(36) NOT NULL REFERENCES "products"("id"),
  "movement_id" VARCHAR(36) NOT NULL REFERENCES "inventory_movements_v2"("id") ON DELETE CASCADE,
  "movement_line_id" VARCHAR(36) NOT NULL REFERENCES "inventory_movement_lines"("id") ON DELETE CASCADE,
  "movement_date" DATE NOT NULL,
  "quantity" DECIMAL(18, 4) NOT NULL,
  "direction" VARCHAR(10) NOT NULL CHECK ("direction" IN ('IN', 'OUT')),
  "before_qty" DECIMAL(18, 4) NOT NULL,
  "after_qty" DECIMAL(18, 4) NOT NULL,
  "before_cost" DECIMAL(18, 4) NOT NULL,
  "after_cost" DECIMAL(18, 4) NOT NULL,
  "unit_cost" DECIMAL(18, 4) NOT NULL,
  "total_cost" DECIMAL(18, 4) NOT NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "idx_stock_card_company" ON "stock_card"("company_id");
CREATE INDEX IF NOT EXISTS "idx_stock_card_product" ON "stock_card"("product_id");
CREATE INDEX IF NOT EXISTS "idx_stock_card_date" ON "stock_card"("movement_date");
