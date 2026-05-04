-- Flexible Operations System Migration
DO $$ 
BEGIN 
    -- 1. Create operation_categories table
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operation_categories') THEN
        CREATE TABLE operation_categories (
            id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            parent_id VARCHAR(36) REFERENCES operation_categories(id) ON DELETE SET NULL,
            company_id VARCHAR(36) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    END IF;

    -- 2. Add category_id to operations
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operations' AND column_name='category_id') THEN
        ALTER TABLE operations ADD COLUMN category_id VARCHAR(36) REFERENCES operation_categories(id) ON DELETE SET NULL;
    END IF;

    -- 3. Add columns to operation_fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operation_fields' AND column_name='category_id') THEN
        ALTER TABLE operation_fields ADD COLUMN category_id VARCHAR(36) REFERENCES operation_categories(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operation_fields' AND column_name='department_id') THEN
        ALTER TABLE operation_fields ADD COLUMN department_id VARCHAR(36); -- Assuming department logic exists elsewhere or is generic
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operation_fields' AND column_name='sort_order') THEN
        ALTER TABLE operation_fields ADD COLUMN sort_order INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operation_fields' AND column_name='is_required') THEN
        ALTER TABLE operation_fields ADD COLUMN is_required BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operation_fields' AND column_name='options') THEN
        ALTER TABLE operation_fields ADD COLUMN options JSONB; -- For dropdown choices
    END IF;

END $$;
