-- Migration: Add sub-account logic to accounts
-- Adds required_sub_account column to accounts table

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'required_sub_account') THEN
        ALTER TABLE "accounts" ADD COLUMN "required_sub_account" BOOLEAN DEFAULT FALSE;
    END IF;
END $$;
