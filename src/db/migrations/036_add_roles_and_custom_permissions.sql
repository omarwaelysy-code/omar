-- Migration 036: Add roles and custom permissions columns
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "permissions" JSONB DEFAULT '{}';
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "company_id" VARCHAR(36);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role_ids" JSONB DEFAULT '[]';
