-- Migration 041: POS Feature Activation and Branch Linking Foundation
-- Safely and additively adds pos_enabled to companies and creates pos_branch_linking_codes table

ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "pos_enabled" BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS "pos_branch_linking_codes" (
    "id" VARCHAR(36) PRIMARY KEY,
    "company_id" VARCHAR(36) NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "department_id" VARCHAR(36) REFERENCES "departments"("id") ON DELETE SET NULL,
    "warehouse_id" VARCHAR(36) REFERENCES "warehouses"("id") ON DELETE SET NULL,
    "code" VARCHAR(50) UNIQUE NOT NULL,
    "status" VARCHAR(20) DEFAULT 'pending',
    "expires_at" TIMESTAMP NOT NULL,
    "created_by" VARCHAR(36),
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "used_at" TIMESTAMP,
    "used_by_device" VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS "idx_pos_linking_company" ON "pos_branch_linking_codes"("company_id");
CREATE INDEX IF NOT EXISTS "idx_pos_linking_code" ON "pos_branch_linking_codes"("code");
