-- Migration 009: Fix UUID types for operation_field_values (REVISED)
--
-- ORIGINAL PROBLEM: This migration added FK constraints with UUID types, then
-- subsequent migrations (016, 018) tried to convert those same columns to
-- VARCHAR(36) — but the FK constraints blocked the ALTER TYPE.
--
-- FIX: This migration is now type-aware. It checks the actual current type
-- of the referenced PK columns and adds FKs accordingly, so it is safe to
-- run in any order relative to 016/018.
--
-- NOTE: The definitive FK re-establishment after type conversion is now done
-- in migration 016. This migration only ensures the FK exists if the table
-- was freshly created and 016 has not yet run.

DO $$ 
DECLARE
    v_fields_id_type TEXT;
    v_ops_id_type TEXT;
    v_fv_field_id_type TEXT;
    v_fv_op_id_type TEXT;
BEGIN

    -- Get current types of the referenced PK columns
    SELECT data_type INTO v_fields_id_type
    FROM information_schema.columns
    WHERE table_name = 'operation_fields' AND column_name = 'id';

    SELECT data_type INTO v_ops_id_type
    FROM information_schema.columns
    WHERE table_name = 'operations' AND column_name = 'id';

    -- Ensure operation_fields.id is consistent with whatever type operations.id is
    -- (do NOT force UUID if varchar is already present — 016 handles the conversion)
    IF v_fields_id_type = 'character varying' AND v_ops_id_type = 'uuid' THEN
        -- Mixed state — skip, migration 016 will resolve this
        RAISE NOTICE 'Mixed type state detected. Migration 016 will handle type unification.';
        RETURN;
    END IF;

    -- Ensure operation_field_values exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operation_field_values') THEN
        -- Create with VARCHAR(36) to match the init-db.ts baseline
        CREATE TABLE operation_field_values (
            id VARCHAR(36) PRIMARY KEY,
            operation_id VARCHAR(36) REFERENCES operations(id) ON DELETE CASCADE,
            field_id VARCHAR(36) REFERENCES operation_fields(id) ON DELETE CASCADE,
            value TEXT,
            company_id VARCHAR(36),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        RETURN;
    END IF;

    -- Drop any existing FKs on operation_field_values before attempting to re-add
    DECLARE
        r RECORD;
    BEGIN
        FOR r IN (
            SELECT tc.constraint_name
            FROM information_schema.table_constraints tc
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_name = 'operation_field_values'
        ) LOOP
            EXECUTE 'ALTER TABLE operation_field_values DROP CONSTRAINT ' || quote_ident(r.constraint_name);
        END LOOP;
    END;

    -- Get actual current types of FK columns in operation_field_values
    SELECT data_type INTO v_fv_field_id_type
    FROM information_schema.columns
    WHERE table_name = 'operation_field_values' AND column_name = 'field_id';

    SELECT data_type INTO v_fv_op_id_type
    FROM information_schema.columns
    WHERE table_name = 'operation_field_values' AND column_name = 'operation_id';

    -- Only add FKs when types on both sides match
    IF v_fv_op_id_type = v_ops_id_type THEN
        ALTER TABLE operation_field_values
            ADD CONSTRAINT operation_field_values_operation_id_fkey
            FOREIGN KEY (operation_id) REFERENCES operations(id) ON DELETE CASCADE;
    ELSE
        RAISE NOTICE 'Skipping FK operation_field_values.operation_id: type mismatch (% vs %). Will be fixed by migration 016.',
            v_fv_op_id_type, v_ops_id_type;
    END IF;

    IF v_fv_field_id_type = v_fields_id_type THEN
        ALTER TABLE operation_field_values
            ADD CONSTRAINT operation_field_values_field_id_fkey
            FOREIGN KEY (field_id) REFERENCES operation_fields(id) ON DELETE CASCADE;
    ELSE
        RAISE NOTICE 'Skipping FK operation_field_values.field_id: type mismatch (% vs %). Will be fixed by migration 016.',
            v_fv_field_id_type, v_fields_id_type;
    END IF;

END $$;
