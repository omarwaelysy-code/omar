
-- Comprehensive Schema Repair for Operations Module
-- This migration ensures all tables have the columns required by the code and EXPECTED_SCHEMA

DO $$ 
BEGIN
    -- 1. operation_categories table repairs
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'operation_categories') THEN
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
    END IF;

    -- 2. operation_fields table repairs
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'operation_fields') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operation_fields' AND column_name = 'code') THEN
            ALTER TABLE operation_fields ADD COLUMN code VARCHAR(50);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operation_fields' AND column_name = 'description') THEN
            ALTER TABLE operation_fields ADD COLUMN description TEXT;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operation_fields' AND column_name = 'unit') THEN
            ALTER TABLE operation_fields ADD COLUMN unit VARCHAR(50);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operation_fields' AND column_name = 'default_value') THEN
            ALTER TABLE operation_fields ADD COLUMN default_value TEXT;
        END IF;
    END IF;

    -- 3. operation_field_values table repairs
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'operation_field_values') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operation_field_values' AND column_name = 'company_id') THEN
            ALTER TABLE operation_field_values ADD COLUMN company_id VARCHAR(36);
        END IF;
    END IF;

    -- 4. Create missing field_operation_categories table
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'field_operation_categories') THEN
        CREATE TABLE field_operation_categories (
            field_id VARCHAR(36) REFERENCES operation_fields(id) ON DELETE CASCADE,
            category_id VARCHAR(36) REFERENCES operation_categories(id) ON DELETE CASCADE,
            company_id VARCHAR(36),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (field_id, category_id)
        );
    END IF;

END $$;
