-- 048_eta_supplier_mappings.sql
-- Mapping table between ETA portal suppliers (by tax number) and internal ERP suppliers

CREATE TABLE IF NOT EXISTS "eta_supplier_mappings" (
    "id" VARCHAR(36) PRIMARY KEY,
    "company_id" VARCHAR(36) NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "eta_tax_number" VARCHAR(50) NOT NULL,
    "eta_supplier_name" VARCHAR(255),
    "supplier_id" VARCHAR(36) NOT NULL REFERENCES "suppliers"("id") ON DELETE CASCADE,
    "notes" TEXT,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "uq_eta_supplier_mappings_comp_tax" UNIQUE ("company_id", "eta_tax_number")
);

CREATE INDEX IF NOT EXISTS "idx_eta_supplier_mappings_comp_tax" ON "eta_supplier_mappings"("company_id", "eta_tax_number");
CREATE INDEX IF NOT EXISTS "idx_eta_supplier_mappings_comp_sup" ON "eta_supplier_mappings"("company_id", "supplier_id");
