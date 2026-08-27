-- Migration 043: Egyptian Tax Authority (ETA) Company Settings
-- Creates the eta_settings table to store ETA company configurations and credentials

CREATE TABLE IF NOT EXISTS "eta_settings" (
    "id" VARCHAR(36) PRIMARY KEY,
    "company_id" VARCHAR(36) NOT NULL UNIQUE REFERENCES "companies"("id") ON DELETE CASCADE,
    "environment" VARCHAR(20) NOT NULL DEFAULT 'preprod' CHECK ("environment" IN ('preprod', 'production')),
    "activity_code" VARCHAR(50),
    "branch_id" VARCHAR(50) DEFAULT '0',
    "country_code" VARCHAR(10) DEFAULT 'EG',
    "governorate" VARCHAR(100),
    "city" VARCHAR(100),
    "street" VARCHAR(255),
    "building_number" VARCHAR(50),
    "postal_code" VARCHAR(50),
    "client_id" TEXT,
    "client_secret" TEXT,
    "is_configured" BOOLEAN DEFAULT FALSE,
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_eta_settings_company_id" ON "eta_settings"("company_id");
