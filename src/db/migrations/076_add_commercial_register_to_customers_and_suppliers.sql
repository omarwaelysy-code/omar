-- Migration 076: Add commercial_register column to customers and suppliers tables
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "commercial_register" VARCHAR(50);
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "commercial_register" VARCHAR(50);
