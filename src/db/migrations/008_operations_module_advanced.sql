-- Operations Module Advanced Migration
DO $$ 
BEGIN 
    -- 1. Create departments table
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'departments') THEN
        CREATE TABLE departments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            code VARCHAR(50) UNIQUE,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            parent_id UUID REFERENCES departments(id) ON DELETE SET NULL,
            manager_user_id VARCHAR(36),
            company_id VARCHAR(36) NOT NULL,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    ELSE
        -- Ensure ID is UUID
        IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'departments' AND column_name = 'id') = 'character varying' THEN
            ALTER TABLE departments ALTER COLUMN id TYPE UUID USING id::uuid;
            ALTER TABLE departments ALTER COLUMN id SET DEFAULT gen_random_uuid();
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'departments' AND column_name = 'parent_id') THEN
                ALTER TABLE departments ALTER COLUMN parent_id TYPE UUID USING parent_id::uuid;
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

    -- 2. Create cost_centers table
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cost_centers') THEN
        CREATE TABLE cost_centers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            code VARCHAR(50) UNIQUE,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
            company_id VARCHAR(36) NOT NULL,
            budget DECIMAL(18, 4),
            currency VARCHAR(10),
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    ELSE
        -- Ensure types are UUID
        IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'cost_centers' AND column_name = 'id') = 'character varying' THEN
            ALTER TABLE cost_centers ALTER COLUMN id TYPE UUID USING id::uuid;
            ALTER TABLE cost_centers ALTER COLUMN id SET DEFAULT gen_random_uuid();
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cost_centers' AND column_name = 'department_id') THEN
                ALTER TABLE cost_centers ALTER COLUMN department_id TYPE UUID USING department_id::uuid;
            END IF;
        END IF;
    END IF;

    -- 3. Enhance operation_fields (idempotent addition of new columns)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operation_fields' AND column_name='code') THEN
        ALTER TABLE operation_fields ADD COLUMN code VARCHAR(50) UNIQUE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operation_fields' AND column_name='description') THEN
        ALTER TABLE operation_fields ADD COLUMN description TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operation_fields' AND column_name='unit') THEN
        ALTER TABLE operation_fields ADD COLUMN unit VARCHAR(50);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operation_fields' AND column_name='default_value') THEN
        ALTER TABLE operation_fields ADD COLUMN default_value TEXT;
    END IF;

    -- 4. Enhance operations
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operations' AND column_name='operation_number') THEN
        ALTER TABLE operations ADD COLUMN operation_number VARCHAR(50) UNIQUE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operations' AND column_name='cost_center_id') THEN
        ALTER TABLE operations ADD COLUMN cost_center_id UUID REFERENCES cost_centers(id) ON DELETE SET NULL;
    ELSE
        IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'operations' AND column_name = 'cost_center_id') = 'character varying' THEN
            ALTER TABLE operations ALTER COLUMN cost_center_id TYPE UUID USING cost_center_id::uuid;
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operations' AND column_name='operation_date') THEN
        ALTER TABLE operations ADD COLUMN operation_date DATE;
    END IF;

    -- Ensure department_id exists if it didn't
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operations' AND column_name='department_id') THEN
        ALTER TABLE operations ADD COLUMN department_id UUID REFERENCES departments(id) ON DELETE SET NULL;
    ELSE
        IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'operations' AND column_name = 'department_id') = 'character varying' THEN
            ALTER TABLE operations ALTER COLUMN department_id TYPE UUID USING department_id::uuid;
        END IF;
    END IF;

    -- 5. Create operation_field_values table (EAV Pattern)
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operation_field_values') THEN
        CREATE TABLE operation_field_values (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            operation_id UUID NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
            field_id UUID NOT NULL REFERENCES operation_fields(id) ON DELETE CASCADE,
            value TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    ELSE
        -- Fix types
        IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'operation_field_values' AND column_name = 'id') = 'character varying' THEN
            ALTER TABLE operation_field_values ALTER COLUMN id TYPE UUID USING id::uuid;
            ALTER TABLE operation_field_values ALTER COLUMN id SET DEFAULT gen_random_uuid();
        END IF;
        IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'operation_field_values' AND column_name = 'operation_id') = 'character varying' THEN
            ALTER TABLE operation_field_values ALTER COLUMN operation_id TYPE UUID USING operation_id::uuid;
        END IF;
        IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'operation_field_values' AND column_name = 'field_id') = 'character varying' THEN
            ALTER TABLE operation_field_values ALTER COLUMN field_id TYPE UUID USING field_id::uuid;
        END IF;
    END IF;

END $$;
