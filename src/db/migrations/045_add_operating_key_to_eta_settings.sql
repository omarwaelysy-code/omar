-- Migration 045: Add operating_key and notification tracking to eta_settings
-- Stores the ETA ERP Operating Key (مفتاح التشغيل) securely per company configuration

ALTER TABLE "eta_settings" ADD COLUMN IF NOT EXISTS "operating_key" TEXT;
ALTER TABLE "eta_settings" ADD COLUMN IF NOT EXISTS "last_notification_at" TIMESTAMP;
