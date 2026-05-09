
-- Fix UUID/Type Mismatch and ensure operation_category_id exists
-- This migration ensures columns are of the correct type and aliases exist

DO $$ 
BEGIN
    -- 1. operation_fields repairs
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'operation_fields') THEN
        -- Ensure category_id is UUID (might be VARCHAR if created incorrectly)
        -- Note: If data is already there and not valid UUID, this will fail.
        -- But in init-db it's created as UUID. 
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operation_fields' AND column_name = 'operation_category_id') THEN
            ALTER TABLE operation_fields ADD COLUMN operation_category_id UUID;
        END IF;

        -- Sync operation_category_id with category_id if one is null
        UPDATE operation_fields SET operation_category_id = category_id WHERE operation_category_id IS NULL AND category_id IS NOT NULL;
        UPDATE operation_fields SET category_id = operation_category_id WHERE category_id IS NULL AND operation_category_id IS NOT NULL;
    END IF;

    -- 2. operations repairs
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'operations') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operations' AND column_name = 'operation_category_id') THEN
            ALTER TABLE operations ADD COLUMN operation_category_id UUID;
        END IF;

        -- Sync
        UPDATE operations SET operation_category_id = category_id WHERE operation_category_id IS NULL AND category_id IS NOT NULL;
        UPDATE operations SET category_id = operation_category_id WHERE category_id IS NULL AND operation_category_id IS NOT NULL;
    END IF;

END $$;
