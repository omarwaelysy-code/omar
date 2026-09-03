-- 046_eta_partner_cache.sql
-- Persistent cache for partner (supplier/receiver) addresses from ETA e-Invoicing system

CREATE TABLE IF NOT EXISTS "eta_partner_cache" (
    "tax_number" VARCHAR(50) PRIMARY KEY,
    "name" TEXT,
    "address" TEXT,
    "governate" VARCHAR(100),
    "city" VARCHAR(100),
    "street" TEXT,
    "building_number" VARCHAR(50),
    "postal_code" VARCHAR(20),
    "country" VARCHAR(10) DEFAULT 'EG',
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_eta_partner_cache_tax" ON "eta_partner_cache"("tax_number");
