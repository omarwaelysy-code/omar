-- Flexible Operations System Migration
DO $$ 
BEGIN 
    -- 1. Create operation_categories table
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operation_categories') THEN
        CREATE TABLE operation_categories (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            parent_id UUID REFERENCES operation_categories(id) ON DELETE SET NULL,
            company_id VARCHAR(36) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    ELSE
        -- Ensure ID is UUID
        IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'operation_categories' AND column_name = 'id') = 'character varying' THEN
            ALTER TABLE operation_categories ALTER COLUMN id TYPE UUID USING id::uuid;
            ALTER TABLE operation_categories ALTER COLUMN id SET DEFAULT gen_random_uuid();
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operation_categories' AND column_name = 'parent_id') THEN
                ALTER TABLE operation_categories ALTER COLUMN parent_id TYPE UUID USING parent_id::uuid;
            END IF;
        END IF;
    END IF;

    -- 1.1 Ensure operations table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operations') THEN
        CREATE TABLE operations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id VARCHAR(36) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    ELSE
        -- Ensure ID is UUID
        IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'operations' AND column_name = 'id') = 'character varying' THEN
            ALTER TABLE operations ALTER COLUMN id TYPE UUID USING id::uuid;
            ALTER TABLE operations ALTER COLUMN id SET DEFAULT gen_random_uuid();
        END IF;
    END IF;

    -- 1.2 Ensure operation_fields table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operation_fields') THEN
        CREATE TABLE operation_fields (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id VARCHAR(36) NOT NULL,
            name VARCHAR(255) NOT NULL,
            type VARCHAR(50) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    ELSE
        -- Ensure ID is UUID
        IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'operation_fields' AND column_name = 'id') = 'character varying' THEN
            ALTER TABLE operation_fields ALTER COLUMN id TYPE UUID USING id::uuid;
            ALTER TABLE operation_fields ALTER COLUMN id SET DEFAULT gen_random_uuid();
        END IF;
    END IF;

    -- 2. Add category_id to operations
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operations' AND column_name='category_id') THEN
        ALTER TABLE operations ADD COLUMN category_id UUID REFERENCES operation_categories(id) ON DELETE SET NULL;
    ELSE
        -- Fix type if it was VARCHAR
        IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'operations' AND column_name = 'category_id') = 'character varying' THEN
            ALTER TABLE operations ALTER COLUMN category_id TYPE UUID USING category_id::uuid;
        END IF;
    END IF;

    -- 3. Add columns to operation_fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operation_fields' AND column_name='category_id') THEN
        ALTER TABLE operation_fields ADD COLUMN category_id UUID REFERENCES operation_categories(id) ON DELETE SET NULL;
    ELSE
        -- Fix type if it was VARCHAR
        IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'operation_fields' AND column_name = 'category_id') = 'character varying' THEN
            ALTER TABLE operation_fields ALTER COLUMN category_id TYPE UUID USING category_id::uuid;
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operation_fields' AND column_name='department_id') THEN
        ALTER TABLE operation_fields ADD COLUMN department_id UUID; 
    ELSE
        -- Fix type if it was VARCHAR
        IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'operation_fields' AND column_name = 'department_id') = 'character varying' THEN
            ALTER TABLE operation_fields ALTER COLUMN department_id TYPE UUID USING department_id::uuid;
        END IF;
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
