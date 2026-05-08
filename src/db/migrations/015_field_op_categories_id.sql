-- Add ID column to field_operation_categories for CRUD support
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'field_operation_categories') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'field_operation_categories' AND column_name = 'id') THEN
            ALTER TABLE field_operation_categories ADD COLUMN id UUID DEFAULT gen_random_uuid();
            -- If we want it to be part of the primary key or a new primary key
            -- For standard CRUD, a single primary key 'id' is best.
            ALTER TABLE field_operation_categories DROP CONSTRAINT IF EXISTS field_operation_categories_pkey;
            ALTER TABLE field_operation_categories ADD PRIMARY KEY (id);
        END IF;
    END IF;
END $$;
