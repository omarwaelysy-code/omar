-- Migration: 039_subscription_features_grace_period.sql
-- Description: Add grace period to company_subscriptions and create subscription_features table

ALTER TABLE "company_subscriptions" ADD COLUMN IF NOT EXISTS "grace_period_days" INT DEFAULT 7;

CREATE TABLE IF NOT EXISTS "subscription_features" (
  "id" VARCHAR(36) PRIMARY KEY,
  "company_id" VARCHAR(36) NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "feature_name" VARCHAR(100) NOT NULL,
  "is_enabled" BOOLEAN DEFAULT TRUE,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("company_id", "feature_name")
);

CREATE INDEX IF NOT EXISTS "idx_subscription_features_company_id" ON "subscription_features"("company_id");
