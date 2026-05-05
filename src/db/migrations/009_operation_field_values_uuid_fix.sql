-- Fix UUID types for operation_field_values to ensure foreign key compatibility
DO $$ 
BEGIN 
    -- Ensure operations.id is UUID (should already be from 007/008)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operations' AND column_name = 'id' AND data_type = 'character varying') THEN
        ALTER TABLE operations ALTER COLUMN id TYPE UUID USING id::uuid;
        ALTER TABLE operations ALTER COLUMN id SET DEFAULT gen_random_uuid();
    END IF;

    -- Ensure operation_fields.id is UUID
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operation_fields' AND column_name = 'id' AND data_type = 'character varying') THEN
        ALTER TABLE operation_fields ALTER COLUMN id TYPE UUID USING id::uuid;
        ALTER TABLE operation_fields ALTER COLUMN id SET DEFAULT gen_random_uuid();
    END IF;

    -- Fix operation_field_values
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operation_field_values') THEN
        
        -- Drop foreign keys if they exist with wrong types or just to be safe
        DECLARE
            r RECORD;
        BEGIN
            FOR r IN (
                SELECT tc.constraint_name 
                FROM information_schema.table_constraints AS tc 
                JOIN information_schema.key_column_usage AS kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                WHERE tc.constraint_type = 'FOREIGN KEY' 
                AND tc.table_name = 'operation_field_values'
                AND kcu.column_name IN ('operation_id', 'field_id')
            ) LOOP
                EXECUTE 'ALTER TABLE operation_field_values DROP CONSTRAINT ' || quote_ident(r.constraint_name);
            END LOOP;
        END;

        -- Change column types to UUID
        IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'operation_field_values' AND column_name = 'id') = 'character varying' THEN
            ALTER TABLE operation_field_values ALTER COLUMN id TYPE UUID USING id::uuid;
            ALTER TABLE operation_field_values ALTER COLUMN id SET DEFAULT gen_random_uuid();
        END IF;

        IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'operation_field_values' AND column_name = 'operation_id') = 'character varying' THEN
            -- Handle possible nulls or empty strings before conversion if necessary, 
            -- but usually UUID using id::uuid handles valid UUID strings.
            ALTER TABLE operation_field_values ALTER COLUMN operation_id TYPE UUID USING operation_id::uuid;
        END IF;

        IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'operation_field_values' AND column_name = 'field_id') = 'character varying' THEN
            ALTER TABLE operation_field_values ALTER COLUMN field_id TYPE UUID USING field_id::uuid;
        END IF;

        -- Re-add foreign keys
        ALTER TABLE operation_field_values 
            ADD CONSTRAINT operation_field_values_operation_id_fkey 
            FOREIGN KEY (operation_id) REFERENCES operations(id) ON DELETE CASCADE;
            
        ALTER TABLE operation_field_values 
            ADD CONSTRAINT operation_field_values_field_id_fkey 
            FOREIGN KEY (field_id) REFERENCES operation_fields(id) ON DELETE CASCADE;
            
    ELSE
        -- Fallback: Create table correctly if it doesn't exist
        CREATE TABLE operation_field_values (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            operation_id UUID NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
            field_id UUID NOT NULL REFERENCES operation_fields(id) ON DELETE CASCADE,
            value TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    END IF;

END $$;
