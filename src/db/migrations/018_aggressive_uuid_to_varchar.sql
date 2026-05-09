-- High-intensity migration to force all UUID columns to VARCHAR(36)
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    -- Iterate through all columns in the public schema that are of type 'uuid'
    FOR r IN (
        SELECT table_name, column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND data_type = 'uuid'
    ) LOOP
        EXECUTE format('ALTER TABLE %I ALTER COLUMN %I TYPE VARCHAR(36) USING %I::text', 
                       r.table_name, r.column_name, r.column_name);
        RAISE NOTICE 'Converted %.% to VARCHAR(36)', r.table_name, r.column_name;
    END LOOP;

    -- Also ensure primary keys that might be missed if they were not explicitly UUID but referenced
    -- specific operation module tables that the user mentioned.
    
    -- operation_categories
    ALTER TABLE IF EXISTS operation_categories ALTER COLUMN id TYPE VARCHAR(36) USING id::text;
    ALTER TABLE IF EXISTS operation_categories ALTER COLUMN parent_id TYPE VARCHAR(36) USING parent_id::text;
    
    -- departments
    ALTER TABLE IF EXISTS departments ALTER COLUMN id TYPE VARCHAR(36) USING id::text;
    ALTER TABLE IF EXISTS departments ALTER COLUMN parent_id TYPE VARCHAR(36) USING parent_id::text;
    
    -- cost_centers
    ALTER TABLE IF EXISTS cost_centers ALTER COLUMN id TYPE VARCHAR(36) USING id::text;
    ALTER TABLE IF EXISTS cost_centers ALTER COLUMN department_id TYPE VARCHAR(36) USING department_id::text;
    
    -- operation_fields
    ALTER TABLE IF EXISTS operation_fields ALTER COLUMN id TYPE VARCHAR(36) USING id::text;
    ALTER TABLE IF EXISTS operation_fields ALTER COLUMN category_id TYPE VARCHAR(36) USING category_id::text;
    ALTER TABLE IF EXISTS operation_fields ALTER COLUMN operation_category_id TYPE VARCHAR(36) USING operation_category_id::text;
    
    -- operations
    ALTER TABLE IF EXISTS operations ALTER COLUMN id TYPE VARCHAR(36) USING id::text;
    ALTER TABLE IF EXISTS operations ALTER COLUMN category_id TYPE VARCHAR(36) USING category_id::text;
    ALTER TABLE IF EXISTS operations ALTER COLUMN operation_category_id TYPE VARCHAR(36) USING operation_category_id::text;
    ALTER TABLE IF EXISTS operations ALTER COLUMN department_id TYPE VARCHAR(36) USING department_id::text;
    ALTER TABLE IF EXISTS operations ALTER COLUMN cost_center_id TYPE VARCHAR(36) USING cost_center_id::text;
    
    -- operation_field_values
    ALTER TABLE IF EXISTS operation_field_values ALTER COLUMN id TYPE VARCHAR(36) USING id::text;
    ALTER TABLE IF EXISTS operation_field_values ALTER COLUMN operation_id TYPE VARCHAR(36) USING operation_id::text;
    ALTER TABLE IF EXISTS operation_field_values ALTER COLUMN field_id TYPE VARCHAR(36) USING field_id::text;
    
    -- field_operation_categories
    ALTER TABLE IF EXISTS field_operation_categories ALTER COLUMN id TYPE VARCHAR(36) USING id::text;
    ALTER TABLE IF EXISTS field_operation_categories ALTER COLUMN field_id TYPE VARCHAR(36) USING field_id::text;
    ALTER TABLE IF EXISTS field_operation_categories ALTER COLUMN category_id TYPE VARCHAR(36) USING category_id::text;

    -- companies
    ALTER TABLE IF EXISTS companies ALTER COLUMN id TYPE VARCHAR(36) USING id::text;

END $$;
