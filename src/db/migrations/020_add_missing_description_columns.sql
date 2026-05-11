-- Migration: Add description columns to various tables
-- Invoices, Returns, Purchase Invoices, Purchase Returns

DO $$ 
BEGIN 
    -- invoices
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'description') THEN
        ALTER TABLE "invoices" ADD COLUMN "description" TEXT;
    END IF;

    -- returns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'returns' AND column_name = 'description') THEN
        ALTER TABLE "returns" ADD COLUMN "description" TEXT;
    END IF;

    -- purchase_invoices
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_invoices' AND column_name = 'description') THEN
        ALTER TABLE "purchase_invoices" ADD COLUMN "description" TEXT;
    END IF;

    -- purchase_returns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_returns' AND column_name = 'description') THEN
        ALTER TABLE "purchase_returns" ADD COLUMN "description" TEXT;
    END IF;
END $$;
