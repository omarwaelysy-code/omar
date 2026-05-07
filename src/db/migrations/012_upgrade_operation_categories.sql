-- Upgrade Operation Categories structure
-- Safely adds hierarchy and metadata columns

DO $$ 
BEGIN
    -- 1. Add missing columns to operation_categories
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operation_categories' AND column_name = 'code') THEN
        ALTER TABLE operation_categories ADD COLUMN code VARCHAR(50);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operation_categories' AND column_name = 'is_final') THEN
        ALTER TABLE operation_categories ADD COLUMN is_final BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operation_categories' AND column_name = 'level') THEN
        ALTER TABLE operation_categories ADD COLUMN level INT DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operation_categories' AND column_name = 'full_path') THEN
        ALTER TABLE operation_categories ADD COLUMN full_path TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operation_categories' AND column_name = 'description') THEN
        ALTER TABLE operation_categories ADD COLUMN description TEXT;
    END IF;

    -- 2. Add indexes for performance
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_op_categories_parent') THEN
        CREATE INDEX idx_op_categories_parent ON operation_categories(parent_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_op_categories_code') THEN
        CREATE INDEX idx_op_categories_code ON operation_categories(code);
    END IF;

END $$;
