-- Revert UUID columns to VARCHAR(36)
DO $$ 
BEGIN
    -- operation_categories
    ALTER TABLE IF EXISTS operation_categories ALTER COLUMN id TYPE VARCHAR(36);
    ALTER TABLE IF EXISTS operation_categories ALTER COLUMN parent_id TYPE VARCHAR(36);

    -- departments
    ALTER TABLE IF EXISTS departments ALTER COLUMN id TYPE VARCHAR(36);
    ALTER TABLE IF EXISTS departments ALTER COLUMN parent_id TYPE VARCHAR(36);

    -- cost_centers
    ALTER TABLE IF EXISTS cost_centers ALTER COLUMN id TYPE VARCHAR(36);
    ALTER TABLE IF EXISTS cost_centers ALTER COLUMN department_id TYPE VARCHAR(36);

    -- operation_fields
    ALTER TABLE IF EXISTS operation_fields ALTER COLUMN id TYPE VARCHAR(36);
    ALTER TABLE IF EXISTS operation_fields ALTER COLUMN category_id TYPE VARCHAR(36);
    ALTER TABLE IF EXISTS operation_fields ALTER COLUMN operation_category_id TYPE VARCHAR(36);

    -- operations
    ALTER TABLE IF EXISTS operations ALTER COLUMN id TYPE VARCHAR(36);
    ALTER TABLE IF EXISTS operations ALTER COLUMN category_id TYPE VARCHAR(36);
    ALTER TABLE IF EXISTS operations ALTER COLUMN operation_category_id TYPE VARCHAR(36);
    ALTER TABLE IF EXISTS operations ALTER COLUMN department_id TYPE VARCHAR(36);
    ALTER TABLE IF EXISTS operations ALTER COLUMN cost_center_id TYPE VARCHAR(36);

    -- operation_field_values
    ALTER TABLE IF EXISTS operation_field_values ALTER COLUMN id TYPE VARCHAR(36);
    ALTER TABLE IF EXISTS operation_field_values ALTER COLUMN operation_id TYPE VARCHAR(36);
    ALTER TABLE IF EXISTS operation_field_values ALTER COLUMN field_id TYPE VARCHAR(36);

    -- field_operation_categories
    ALTER TABLE IF EXISTS field_operation_categories ALTER COLUMN field_id TYPE VARCHAR(36);
    ALTER TABLE IF EXISTS field_operation_categories ALTER COLUMN category_id TYPE VARCHAR(36);

END $$;
