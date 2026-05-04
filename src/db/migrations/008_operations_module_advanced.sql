-- Operations Module Advanced Migration
DO $$ 
BEGIN 
    -- 1. Create departments table
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'departments') THEN
        CREATE TABLE departments (
            id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
            code VARCHAR(50) UNIQUE,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            parent_id VARCHAR(36) REFERENCES departments(id) ON DELETE SET NULL,
            manager_user_id VARCHAR(36),
            company_id VARCHAR(36) NOT NULL,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    END IF;

    -- 2. Create cost_centers table
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cost_centers') THEN
        CREATE TABLE cost_centers (
            id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
            code VARCHAR(50) UNIQUE,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            department_id VARCHAR(36) REFERENCES departments(id) ON DELETE SET NULL,
            company_id VARCHAR(36) NOT NULL,
            budget DECIMAL(18, 4),
            currency VARCHAR(10),
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
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
        ALTER TABLE operations ADD COLUMN cost_center_id VARCHAR(36) REFERENCES cost_centers(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operations' AND column_name='operation_date') THEN
        ALTER TABLE operations ADD COLUMN operation_date DATE;
    END IF;

    -- Ensure department_id exists if it didn't
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operations' AND column_name='department_id') THEN
        ALTER TABLE operations ADD COLUMN department_id VARCHAR(36) REFERENCES departments(id) ON DELETE SET NULL;
    END IF;

    -- 5. Create operation_field_values table (EAV Pattern)
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operation_field_values') THEN
        CREATE TABLE operation_field_values (
            id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
            operation_id VARCHAR(36) NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
            field_id VARCHAR(36) NOT NULL REFERENCES operation_fields(id) ON DELETE CASCADE,
            value TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    END IF;

END $$;
