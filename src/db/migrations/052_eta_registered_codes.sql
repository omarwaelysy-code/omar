-- 052_eta_registered_codes.sql
-- Persistent cache for registered EGS/GS1 item codes from ETA portal (Codes Usage Requests)

CREATE TABLE IF NOT EXISTS "eta_registered_codes" (
    "id" VARCHAR(36) PRIMARY KEY,
    "company_id" VARCHAR(36) NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "item_code" VARCHAR(100) NOT NULL,
    "code_type" VARCHAR(50) DEFAULT 'EGS',
    "code_name_ar" TEXT,
    "code_name_en" TEXT,
    "description_ar" TEXT,
    "description_en" TEXT,
    "parent_item_code" VARCHAR(50),
    "parent_code_name" TEXT,
    "status" VARCHAR(50) DEFAULT 'Approved',
    "active_from" TIMESTAMP WITH TIME ZONE,
    "active_to" TIMESTAMP WITH TIME ZONE,
    "active" BOOLEAN DEFAULT true,
    "raw_data" JSONB,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "uq_eta_registered_codes_comp_code" UNIQUE ("company_id", "item_code")
);

CREATE INDEX IF NOT EXISTS "idx_eta_registered_codes_comp_code" ON "eta_registered_codes"("company_id", "item_code");
