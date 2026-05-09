-- Sync category_id and operation_category_id for consistency
DO $$ 
BEGIN
    -- For operation_fields
    -- 1. Sync category_id from operation_category_id if NULL
    UPDATE operation_fields 
    SET category_id = operation_category_id 
    WHERE category_id IS NULL AND operation_category_id IS NOT NULL;

    -- 2. Sync operation_category_id from category_id if NULL
    UPDATE operation_fields 
    SET operation_category_id = category_id 
    WHERE operation_category_id IS NULL AND category_id IS NOT NULL;

    -- For operations
    -- 1. Sync category_id from operation_category_id if NULL
    UPDATE operations 
    SET category_id = operation_category_id 
    WHERE category_id IS NULL AND operation_category_id IS NOT NULL;

    -- 2. Sync operation_category_id from category_id if NULL
    UPDATE operations 
    SET operation_category_id = category_id 
    WHERE operation_category_id IS NULL AND category_id IS NOT NULL;

END $$;
