-- Migration 018: Aggressive UUID-to-VARCHAR(36) conversion (REVISED)
--
-- ORIGINAL PROBLEM: The original version iterated all UUID columns and
-- called ALTER COLUMN TYPE directly. This fails when FK constraints exist
-- between two UUID columns because PostgreSQL requires both sides of a
-- FK to have the same type — and you cannot change one side without
-- first dropping the constraint.
--
-- FIX: Migration 016 now handles FK-aware type conversion for all
-- operations-module tables (the main source of UUID columns in this
-- codebase). Migration 018 is now a no-op catch-all that is safe to run
-- on any database, including ones where 016 has already fully converted
-- everything. It only converts any remaining UUID columns that have NO
-- FK dependencies (so no constraint-drop is required).
--
-- This migration is fully idempotent.

DO $$
DECLARE
    r RECORD;
    fk_count INTEGER;
BEGIN
    -- Convert any remaining UUID columns that are NOT referenced by a FK constraint.
    -- Columns that ARE referenced by FKs must already have been converted by migration 016.
    FOR r IN (
        SELECT c.table_name, c.column_name
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.data_type = 'uuid'
          -- Skip columns that are FK targets (i.e. referenced by another table's FK)
          AND NOT EXISTS (
              SELECT 1 FROM information_schema.referential_constraints rc
              JOIN information_schema.key_column_usage kcu_ref
                ON rc.unique_constraint_name = kcu_ref.constraint_name
              WHERE kcu_ref.table_name = c.table_name
                AND kcu_ref.column_name = c.column_name
          )
          -- Skip columns that ARE a FK (pointing elsewhere); those need FK-drop first
          AND NOT EXISTS (
              SELECT 1 FROM information_schema.key_column_usage kcu
              JOIN information_schema.table_constraints tc
                ON kcu.constraint_name = tc.constraint_name
              WHERE tc.constraint_type = 'FOREIGN KEY'
                AND kcu.table_name = c.table_name
                AND kcu.column_name = c.column_name
          )
    ) LOOP
        BEGIN
            EXECUTE format(
                'ALTER TABLE %I ALTER COLUMN %I TYPE VARCHAR(36) USING %I::text',
                r.table_name, r.column_name, r.column_name
            );
            RAISE NOTICE 'Converted %.% uuid → VARCHAR(36)', r.table_name, r.column_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Could not convert %.%: %', r.table_name, r.column_name, SQLERRM;
        END;
    END LOOP;
END $$;
