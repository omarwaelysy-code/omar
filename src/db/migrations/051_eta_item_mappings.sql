-- 051_eta_item_mappings.sql
-- Mapping table between ETA portal item codes and internal ERP products

CREATE TABLE IF NOT EXISTS "eta_item_mappings" (
    "id" VARCHAR(36) PRIMARY KEY,
    "company_id" VARCHAR(36) NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "eta_item_code" VARCHAR(100) NOT NULL,
    "eta_item_name" VARCHAR(255),
    "eta_item_type" VARCHAR(50) DEFAULT 'EGS',
    "product_id" VARCHAR(36) NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
    "notes" TEXT,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "uq_eta_item_mappings_comp_code" UNIQUE ("company_id", "eta_item_code")
);

CREATE INDEX IF NOT EXISTS "idx_eta_item_mappings_comp_code" ON "eta_item_mappings"("company_id", "eta_item_code");
CREATE INDEX IF NOT EXISTS "idx_eta_item_mappings_comp_prod" ON "eta_item_mappings"("company_id", "product_id");
