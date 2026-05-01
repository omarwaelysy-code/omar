-- Migration: 002_fix_activity_logs
-- Adds missing columns to activity_logs table for comprehensive auditing

ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS username VARCHAR(100);
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS category JSONB;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS document_id VARCHAR(36);
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS changes JSONB;

-- Add index for category for faster filtering
CREATE INDEX IF NOT EXISTS idx_activity_logs_category ON activity_logs USING GIN (category);
