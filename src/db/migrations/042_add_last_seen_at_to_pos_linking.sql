-- Migration 042: Add last_seen_at to pos_branch_linking_codes
-- Dedicated last_seen_at column for POS heartbeat tracking without modifying used_at

ALTER TABLE "pos_branch_linking_codes" ADD COLUMN IF NOT EXISTS "last_seen_at" TIMESTAMP NULL;
