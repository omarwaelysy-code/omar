-- Inventory Movement Engine Migration (Phase 1 - Revised)
-- Creates tables: inventory_movement_types, inventory_movements_v2, inventory_movement_lines

-- 1. Movement Types Registry
CREATE TABLE IF NOT EXISTS "inventory_movement_types" (
  "id" VARCHAR(50) PRIMARY KEY,
  "name_en" VARCHAR(100) NOT NULL,
  "name_ar" VARCHAR(100) NOT NULL,
  "default_direction" VARCHAR(10) NOT NULL CHECK ("default_direction" IN ('IN', 'OUT', 'NONE')),
  "description" TEXT,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed standard 14 movement types
INSERT INTO "inventory_movement_types" ("id", "name_en", "name_ar", "default_direction", "description") VALUES
('goods_receipt', 'Goods Receipt', 'استلام مخزني', 'IN', 'Receipt of goods in warehouse'),
('purchase', 'Purchase', 'شراء', 'IN', 'Goods purchased from suppliers'),
('purchase_return', 'Purchase Return', 'مرتجع شراء', 'OUT', 'Return of purchased goods to suppliers'),
('sales', 'Sales', 'بيع', 'OUT', 'Goods sold to customers'),
('sales_return', 'Sales Return', 'مرتجع بيع', 'IN', 'Return of sold goods from customers'),
('warehouse_transfer', 'Warehouse Transfer', 'تحويل مخازن', 'NONE', 'Transfer of goods between warehouses'),
('inventory_adjustment', 'Inventory Adjustment', 'تسوية مخزنية', 'NONE', 'Inventory adjustment or count'),
('opening_balance', 'Opening Balance', 'رصيد افتتاحي', 'IN', 'Opening balance of inventory'),
('production_receipt', 'Production Receipt', 'استلام إنتاج', 'IN', 'Output from production process'),
('production_consumption', 'Production Consumption', 'استهلاك إنتاج', 'OUT', 'Consumption of raw materials in production'),
('damage', 'Damage', 'تالف', 'OUT', 'Damaged goods'),
('scrap', 'Scrap', 'إتلاف / خرداوات', 'OUT', 'Scrapped goods'),
('consumption', 'Consumption', 'استهلاك', 'OUT', 'General consumption of inventory'),
('gift', 'Gift', 'هدايا', 'OUT', 'Promotional gifts or free samples')
ON CONFLICT (id) DO NOTHING;

-- 2. Inventory Movements Header (v2 to avoid collision with old flat table)
CREATE TABLE IF NOT EXISTS "inventory_movements_v2" (
  "id" VARCHAR(36) PRIMARY KEY,
  "company_id" VARCHAR(36) NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "branch_id" VARCHAR(36) DEFAULT NULL,
  "warehouse_id" VARCHAR(36) REFERENCES "warehouses"("id"),
  "movement_number" VARCHAR(50) NOT NULL,
  "movement_type" VARCHAR(50) NOT NULL REFERENCES "inventory_movement_types"("id"),
  "source_document_type" VARCHAR(50),
  "source_document_id" VARCHAR(36),
  "movement_date" DATE NOT NULL,
  "status" VARCHAR(20) DEFAULT 'draft',
  "notes" TEXT,
  "created_by" VARCHAR(36) REFERENCES "users"("id"),
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "uq_movements_v2_company_number" UNIQUE ("company_id", "movement_number")
);

-- 3. Inventory Movement Lines Details
CREATE TABLE IF NOT EXISTS "inventory_movement_lines" (
  "id" VARCHAR(36) PRIMARY KEY,
  "movement_id" VARCHAR(36) NOT NULL REFERENCES "inventory_movements_v2"("id") ON DELETE CASCADE,
  "product_id" VARCHAR(36) NOT NULL REFERENCES "products"("id"),
  "unit_id" VARCHAR(36) NOT NULL,
  "quantity" DECIMAL(18, 4) NOT NULL,
  "direction" VARCHAR(10) NOT NULL CHECK ("direction" IN ('IN', 'OUT')),
  "unit_cost" DECIMAL(18, 4) DEFAULT 0,
  "total_cost" DECIMAL(18, 4) DEFAULT 0,
  "batch_id" VARCHAR(36) DEFAULT NULL,
  "serial_number" VARCHAR(100) DEFAULT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "idx_movements_v2_company" ON "inventory_movements_v2"("company_id");
CREATE INDEX IF NOT EXISTS "idx_movements_v2_date" ON "inventory_movements_v2"("movement_date");
CREATE INDEX IF NOT EXISTS "idx_movement_lines_movement" ON "inventory_movement_lines"("movement_id");
CREATE INDEX IF NOT EXISTS "idx_movement_lines_product" ON "inventory_movement_lines"("product_id");
