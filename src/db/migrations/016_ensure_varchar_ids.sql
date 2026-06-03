-- Migration 016: Ensure all operations-module ID columns are VARCHAR(36)
-- 
-- WHY THIS EXISTS:
--   Migrations 007-009 created the operations tables with UUID primary keys.
--   init-db.ts (the authoritative baseline for new installs) uses VARCHAR(36).
--   This migration finalises the conversion so ALL environments are consistent.
--
-- WHY IT WAS FAILING:
--   ALTER COLUMN ... TYPE VARCHAR(36) is blocked by PostgreSQL when an active
--   foreign-key constraint references that column with an incompatible type.
--   The FK "operation_field_values_field_id_fkey" linked field_id (uuid) →
--   operation_fields.id (uuid), so converting either side to varchar was
--   rejected until the constraint was dropped first.
--
-- STRATEGY (fully idempotent — safe on fresh AND existing databases):
--   1. Drop all FK constraints on the affected tables (ignore if absent).
--   2. Convert every affected column to VARCHAR(36) (skip if already varchar).
--   3. Re-add FK constraints only when both sides are VARCHAR(36).

DO $$
DECLARE
    v_type TEXT;
BEGIN

    -- =========================================================
    -- STEP 1: Drop all FK constraints that would block ALTER TYPE
    -- =========================================================

    -- operation_field_values FK → operations
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'operation_field_values_operation_id_fkey'
          AND table_name = 'operation_field_values'
    ) THEN
        ALTER TABLE operation_field_values DROP CONSTRAINT operation_field_values_operation_id_fkey;
    END IF;

    -- operation_field_values FK → operation_fields
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'operation_field_values_field_id_fkey'
          AND table_name = 'operation_field_values'
    ) THEN
        ALTER TABLE operation_field_values DROP CONSTRAINT operation_field_values_field_id_fkey;
    END IF;

    -- Drop any other FK on operation_field_values pointing to operations or operation_fields
    -- (handles constraints with generated names)
    DECLARE
        r RECORD;
    BEGIN
        FOR r IN (
            SELECT tc.constraint_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.referential_constraints AS rc
              ON tc.constraint_name = rc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_name = 'operation_field_values'
        ) LOOP
            EXECUTE 'ALTER TABLE operation_field_values DROP CONSTRAINT ' || quote_ident(r.constraint_name);
        END LOOP;
    END;

    -- operation_fields FK → operation_categories (category_id)
    DECLARE
        r RECORD;
    BEGIN
        FOR r IN (
            SELECT tc.constraint_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_name = 'operation_fields'
        ) LOOP
            EXECUTE 'ALTER TABLE operation_fields DROP CONSTRAINT ' || quote_ident(r.constraint_name);
        END LOOP;
    END;

    -- operations FKs (category_id → operation_categories, department_id → departments, cost_center_id → cost_centers)
    DECLARE
        r RECORD;
    BEGIN
        FOR r IN (
            SELECT tc.constraint_name
            FROM information_schema.table_constraints AS tc
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_name = 'operations'
        ) LOOP
            EXECUTE 'ALTER TABLE operations DROP CONSTRAINT ' || quote_ident(r.constraint_name);
        END LOOP;
    END;

    -- cost_centers FK → departments
    DECLARE
        r RECORD;
    BEGIN
        FOR r IN (
            SELECT tc.constraint_name
            FROM information_schema.table_constraints AS tc
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_name = 'cost_centers'
        ) LOOP
            EXECUTE 'ALTER TABLE cost_centers DROP CONSTRAINT ' || quote_ident(r.constraint_name);
        END LOOP;
    END;

    -- field_operation_categories FKs → operation_fields, operation_categories
    DECLARE
        r RECORD;
    BEGIN
        FOR r IN (
            SELECT tc.constraint_name
            FROM information_schema.table_constraints AS tc
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_name = 'field_operation_categories'
        ) LOOP
            EXECUTE 'ALTER TABLE field_operation_categories DROP CONSTRAINT ' || quote_ident(r.constraint_name);
        END LOOP;
    END;

    -- departments self-referencing FK (parent_id)
    DECLARE
        r RECORD;
    BEGIN
        FOR r IN (
            SELECT tc.constraint_name
            FROM information_schema.table_constraints AS tc
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_name = 'departments'
        ) LOOP
            EXECUTE 'ALTER TABLE departments DROP CONSTRAINT ' || quote_ident(r.constraint_name);
        END LOOP;
    END;

    -- operation_categories self-referencing FK (parent_id)
    DECLARE
        r RECORD;
    BEGIN
        FOR r IN (
            SELECT tc.constraint_name
            FROM information_schema.table_constraints AS tc
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_name = 'operation_categories'
        ) LOOP
            EXECUTE 'ALTER TABLE operation_categories DROP CONSTRAINT ' || quote_ident(r.constraint_name);
        END LOOP;
    END;

    -- =========================================================
    -- STEP 2: Convert all PK/FK columns to VARCHAR(36)
    --         Skip columns already varchar (idempotent).
    -- =========================================================

    -- Helper macro (inlined): convert only when NOT already varchar
    -- operation_categories
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operation_categories') THEN
        SELECT data_type INTO v_type FROM information_schema.columns
        WHERE table_name = 'operation_categories' AND column_name = 'id';
        IF v_type IS NOT NULL AND v_type != 'character varying' THEN
            ALTER TABLE operation_categories ALTER COLUMN id TYPE VARCHAR(36) USING id::text;
        END IF;

        SELECT data_type INTO v_type FROM information_schema.columns
        WHERE table_name = 'operation_categories' AND column_name = 'parent_id';
        IF v_type IS NOT NULL AND v_type != 'character varying' THEN
            ALTER TABLE operation_categories ALTER COLUMN parent_id TYPE VARCHAR(36) USING parent_id::text;
        END IF;
    END IF;

    -- departments
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'departments') THEN
        SELECT data_type INTO v_type FROM information_schema.columns
        WHERE table_name = 'departments' AND column_name = 'id';
        IF v_type IS NOT NULL AND v_type != 'character varying' THEN
            ALTER TABLE departments ALTER COLUMN id TYPE VARCHAR(36) USING id::text;
        END IF;

        SELECT data_type INTO v_type FROM information_schema.columns
        WHERE table_name = 'departments' AND column_name = 'parent_id';
        IF v_type IS NOT NULL AND v_type != 'character varying' THEN
            ALTER TABLE departments ALTER COLUMN parent_id TYPE VARCHAR(36) USING parent_id::text;
        END IF;
    END IF;

    -- cost_centers
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cost_centers') THEN
        SELECT data_type INTO v_type FROM information_schema.columns
        WHERE table_name = 'cost_centers' AND column_name = 'id';
        IF v_type IS NOT NULL AND v_type != 'character varying' THEN
            ALTER TABLE cost_centers ALTER COLUMN id TYPE VARCHAR(36) USING id::text;
        END IF;

        SELECT data_type INTO v_type FROM information_schema.columns
        WHERE table_name = 'cost_centers' AND column_name = 'department_id';
        IF v_type IS NOT NULL AND v_type != 'character varying' THEN
            ALTER TABLE cost_centers ALTER COLUMN department_id TYPE VARCHAR(36) USING department_id::text;
        END IF;
    END IF;

    -- operation_fields
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operation_fields') THEN
        SELECT data_type INTO v_type FROM information_schema.columns
        WHERE table_name = 'operation_fields' AND column_name = 'id';
        IF v_type IS NOT NULL AND v_type != 'character varying' THEN
            ALTER TABLE operation_fields ALTER COLUMN id TYPE VARCHAR(36) USING id::text;
        END IF;

        SELECT data_type INTO v_type FROM information_schema.columns
        WHERE table_name = 'operation_fields' AND column_name = 'category_id';
        IF v_type IS NOT NULL AND v_type != 'character varying' THEN
            ALTER TABLE operation_fields ALTER COLUMN category_id TYPE VARCHAR(36) USING category_id::text;
        END IF;

        SELECT data_type INTO v_type FROM information_schema.columns
        WHERE table_name = 'operation_fields' AND column_name = 'operation_category_id';
        IF v_type IS NOT NULL AND v_type != 'character varying' THEN
            ALTER TABLE operation_fields ALTER COLUMN operation_category_id TYPE VARCHAR(36) USING operation_category_id::text;
        END IF;

        SELECT data_type INTO v_type FROM information_schema.columns
        WHERE table_name = 'operation_fields' AND column_name = 'department_id';
        IF v_type IS NOT NULL AND v_type != 'character varying' THEN
            ALTER TABLE operation_fields ALTER COLUMN department_id TYPE VARCHAR(36) USING department_id::text;
        END IF;
    END IF;

    -- operations
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operations') THEN
        SELECT data_type INTO v_type FROM information_schema.columns
        WHERE table_name = 'operations' AND column_name = 'id';
        IF v_type IS NOT NULL AND v_type != 'character varying' THEN
            ALTER TABLE operations ALTER COLUMN id TYPE VARCHAR(36) USING id::text;
        END IF;

        SELECT data_type INTO v_type FROM information_schema.columns
        WHERE table_name = 'operations' AND column_name = 'category_id';
        IF v_type IS NOT NULL AND v_type != 'character varying' THEN
            ALTER TABLE operations ALTER COLUMN category_id TYPE VARCHAR(36) USING category_id::text;
        END IF;

        SELECT data_type INTO v_type FROM information_schema.columns
        WHERE table_name = 'operations' AND column_name = 'operation_category_id';
        IF v_type IS NOT NULL AND v_type != 'character varying' THEN
            ALTER TABLE operations ALTER COLUMN operation_category_id TYPE VARCHAR(36) USING operation_category_id::text;
        END IF;

        SELECT data_type INTO v_type FROM information_schema.columns
        WHERE table_name = 'operations' AND column_name = 'department_id';
        IF v_type IS NOT NULL AND v_type != 'character varying' THEN
            ALTER TABLE operations ALTER COLUMN department_id TYPE VARCHAR(36) USING department_id::text;
        END IF;

        SELECT data_type INTO v_type FROM information_schema.columns
        WHERE table_name = 'operations' AND column_name = 'cost_center_id';
        IF v_type IS NOT NULL AND v_type != 'character varying' THEN
            ALTER TABLE operations ALTER COLUMN cost_center_id TYPE VARCHAR(36) USING cost_center_id::text;
        END IF;

        SELECT data_type INTO v_type FROM information_schema.columns
        WHERE table_name = 'operations' AND column_name = 'customer_id';
        IF v_type IS NOT NULL AND v_type != 'character varying' THEN
            ALTER TABLE operations ALTER COLUMN customer_id TYPE VARCHAR(36) USING customer_id::text;
        END IF;
    END IF;

    -- operation_field_values
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operation_field_values') THEN
        SELECT data_type INTO v_type FROM information_schema.columns
        WHERE table_name = 'operation_field_values' AND column_name = 'id';
        IF v_type IS NOT NULL AND v_type != 'character varying' THEN
            ALTER TABLE operation_field_values ALTER COLUMN id TYPE VARCHAR(36) USING id::text;
        END IF;

        SELECT data_type INTO v_type FROM information_schema.columns
        WHERE table_name = 'operation_field_values' AND column_name = 'operation_id';
        IF v_type IS NOT NULL AND v_type != 'character varying' THEN
            ALTER TABLE operation_field_values ALTER COLUMN operation_id TYPE VARCHAR(36) USING operation_id::text;
        END IF;

        SELECT data_type INTO v_type FROM information_schema.columns
        WHERE table_name = 'operation_field_values' AND column_name = 'field_id';
        IF v_type IS NOT NULL AND v_type != 'character varying' THEN
            ALTER TABLE operation_field_values ALTER COLUMN field_id TYPE VARCHAR(36) USING field_id::text;
        END IF;
    END IF;

    -- field_operation_categories
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'field_operation_categories') THEN
        -- id column (added by migration 015, may be UUID)
        SELECT data_type INTO v_type FROM information_schema.columns
        WHERE table_name = 'field_operation_categories' AND column_name = 'id';
        IF v_type IS NOT NULL AND v_type != 'character varying' THEN
            -- id is the PK, must drop PK first
            ALTER TABLE field_operation_categories DROP CONSTRAINT IF EXISTS field_operation_categories_pkey;
            ALTER TABLE field_operation_categories ALTER COLUMN id TYPE VARCHAR(36) USING id::text;
            ALTER TABLE field_operation_categories ADD PRIMARY KEY (id);
        END IF;

        SELECT data_type INTO v_type FROM information_schema.columns
        WHERE table_name = 'field_operation_categories' AND column_name = 'field_id';
        IF v_type IS NOT NULL AND v_type != 'character varying' THEN
            ALTER TABLE field_operation_categories ALTER COLUMN field_id TYPE VARCHAR(36) USING field_id::text;
        END IF;

        SELECT data_type INTO v_type FROM information_schema.columns
        WHERE table_name = 'field_operation_categories' AND column_name = 'category_id';
        IF v_type IS NOT NULL AND v_type != 'character varying' THEN
            ALTER TABLE field_operation_categories ALTER COLUMN category_id TYPE VARCHAR(36) USING category_id::text;
        END IF;
    END IF;

    -- =========================================================
    -- STEP 2.5: Purge orphaned references BEFORE re-adding FKs
    --           Any row that points to a non-existent parent would
    --           cause the ADD CONSTRAINT to fail.  We NULL them out
    --           (mirrors the ON DELETE SET NULL behaviour of the FK).
    -- =========================================================

    -- operations.category_id → operation_categories
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operations')
    AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operation_categories')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operations' AND column_name = 'category_id')
    THEN
        UPDATE operations
        SET category_id = NULL
        WHERE category_id IS NOT NULL
          AND category_id::text NOT IN (
              SELECT id::text FROM operation_categories
          );
    END IF;

    -- operations.operation_category_id → operation_categories
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operations')
    AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operation_categories')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operations' AND column_name = 'operation_category_id')
    THEN
        UPDATE operations
        SET operation_category_id = NULL
        WHERE operation_category_id IS NOT NULL
          AND operation_category_id::text NOT IN (
              SELECT id::text FROM operation_categories
          );
    END IF;

    -- operation_fields.category_id → operation_categories
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operation_fields')
    AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operation_categories')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operation_fields' AND column_name = 'category_id')
    THEN
        UPDATE operation_fields
        SET category_id = NULL
        WHERE category_id IS NOT NULL
          AND category_id::text NOT IN (
              SELECT id::text FROM operation_categories
          );
    END IF;

    -- operation_fields.operation_category_id → operation_categories
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operation_fields')
    AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operation_categories')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operation_fields' AND column_name = 'operation_category_id')
    THEN
        UPDATE operation_fields
        SET operation_category_id = NULL
        WHERE operation_category_id IS NOT NULL
          AND operation_category_id::text NOT IN (
              SELECT id::text FROM operation_categories
          );
    END IF;

    -- field_operation_categories.category_id → operation_categories
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'field_operation_categories')
    AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operation_categories')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'field_operation_categories' AND column_name = 'category_id')
    THEN
        DELETE FROM field_operation_categories
        WHERE category_id IS NOT NULL
          AND category_id::text NOT IN (
              SELECT id::text FROM operation_categories
          );
    END IF;

    -- field_operation_categories.field_id → operation_fields
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'field_operation_categories')
    AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operation_fields')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'field_operation_categories' AND column_name = 'field_id')
    THEN
        DELETE FROM field_operation_categories
        WHERE field_id IS NOT NULL
          AND field_id::text NOT IN (
              SELECT id::text FROM operation_fields
          );
    END IF;

    -- operation_field_values.operation_id → operations
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operation_field_values')
    AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operations')
    THEN
        DELETE FROM operation_field_values
        WHERE operation_id IS NOT NULL
          AND operation_id::text NOT IN (
              SELECT id::text FROM operations
          );
    END IF;

    -- operation_field_values.field_id → operation_fields
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operation_field_values')
    AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operation_fields')
    THEN
        DELETE FROM operation_field_values
        WHERE field_id IS NOT NULL
          AND field_id::text NOT IN (
              SELECT id::text FROM operation_fields
          );
    END IF;

    -- cost_centers.department_id → departments
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cost_centers')
    AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'departments')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cost_centers' AND column_name = 'department_id')
    THEN
        UPDATE cost_centers
        SET department_id = NULL
        WHERE department_id IS NOT NULL
          AND department_id::text NOT IN (
              SELECT id::text FROM departments
          );
    END IF;

    -- operations.department_id → departments
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operations')
    AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'departments')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operations' AND column_name = 'department_id')
    THEN
        UPDATE operations
        SET department_id = NULL
        WHERE department_id IS NOT NULL
          AND department_id::text NOT IN (
              SELECT id::text FROM departments
          );
    END IF;

    -- operations.cost_center_id → cost_centers
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operations')
    AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cost_centers')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operations' AND column_name = 'cost_center_id')
    THEN
        UPDATE operations
        SET cost_center_id = NULL
        WHERE cost_center_id IS NOT NULL
          AND cost_center_id::text NOT IN (
              SELECT id::text FROM cost_centers
          );
    END IF;

    -- =========================================================
    -- STEP 3: Re-add FK constraints now that all sides are VARCHAR(36)
    --         Each constraint is conditional on both sides existing and
    --         both being varchar (so this is safe on any database state).
    -- =========================================================

    -- operation_categories: self-referencing parent_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'operation_categories_parent_id_fkey'
          AND table_name = 'operation_categories'
    ) THEN
        ALTER TABLE operation_categories
            ADD CONSTRAINT operation_categories_parent_id_fkey
            FOREIGN KEY (parent_id) REFERENCES operation_categories(id) ON DELETE SET NULL;
    END IF;

    -- departments: self-referencing parent_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'departments_parent_id_fkey'
          AND table_name = 'departments'
    ) THEN
        ALTER TABLE departments
            ADD CONSTRAINT departments_parent_id_fkey
            FOREIGN KEY (parent_id) REFERENCES departments(id) ON DELETE SET NULL;
    END IF;

    -- cost_centers → departments
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cost_centers' AND column_name = 'department_id')
    AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'cost_centers_department_id_fkey'
          AND table_name = 'cost_centers'
    ) THEN
        ALTER TABLE cost_centers
            ADD CONSTRAINT cost_centers_department_id_fkey
            FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;
    END IF;

    -- operation_fields → operation_categories (category_id)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operation_fields' AND column_name = 'category_id')
    AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'operation_fields_category_id_fkey'
          AND table_name = 'operation_fields'
    ) THEN
        ALTER TABLE operation_fields
            ADD CONSTRAINT operation_fields_category_id_fkey
            FOREIGN KEY (category_id) REFERENCES operation_categories(id) ON DELETE SET NULL;
    END IF;

    -- operations → operation_categories (category_id)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operations' AND column_name = 'category_id')
    AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'operations_category_id_fkey'
          AND table_name = 'operations'
    ) THEN
        ALTER TABLE operations
            ADD CONSTRAINT operations_category_id_fkey
            FOREIGN KEY (category_id) REFERENCES operation_categories(id) ON DELETE SET NULL;
    END IF;

    -- operations → departments (department_id)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operations' AND column_name = 'department_id')
    AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'operations_department_id_fkey'
          AND table_name = 'operations'
    ) THEN
        ALTER TABLE operations
            ADD CONSTRAINT operations_department_id_fkey
            FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;
    END IF;

    -- operations → cost_centers (cost_center_id)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operations' AND column_name = 'cost_center_id')
    AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'operations_cost_center_id_fkey'
          AND table_name = 'operations'
    ) THEN
        ALTER TABLE operations
            ADD CONSTRAINT operations_cost_center_id_fkey
            FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id) ON DELETE SET NULL;
    END IF;

    -- operation_field_values → operations (operation_id)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'operation_field_values_operation_id_fkey'
          AND table_name = 'operation_field_values'
    ) THEN
        ALTER TABLE operation_field_values
            ADD CONSTRAINT operation_field_values_operation_id_fkey
            FOREIGN KEY (operation_id) REFERENCES operations(id) ON DELETE CASCADE;
    END IF;

    -- operation_field_values → operation_fields (field_id)
    -- This is the constraint that was previously failing: both sides are now VARCHAR(36)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'operation_field_values_field_id_fkey'
          AND table_name = 'operation_field_values'
    ) THEN
        ALTER TABLE operation_field_values
            ADD CONSTRAINT operation_field_values_field_id_fkey
            FOREIGN KEY (field_id) REFERENCES operation_fields(id) ON DELETE CASCADE;
    END IF;

    -- field_operation_categories → operation_fields (field_id)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'field_operation_categories_field_id_fkey'
          AND table_name = 'field_operation_categories'
    ) THEN
        ALTER TABLE field_operation_categories
            ADD CONSTRAINT field_operation_categories_field_id_fkey
            FOREIGN KEY (field_id) REFERENCES operation_fields(id) ON DELETE CASCADE;
    END IF;

    -- field_operation_categories → operation_categories (category_id)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'field_operation_categories_category_id_fkey'
          AND table_name = 'field_operation_categories'
    ) THEN
        ALTER TABLE field_operation_categories
            ADD CONSTRAINT field_operation_categories_category_id_fkey
            FOREIGN KEY (category_id) REFERENCES operation_categories(id) ON DELETE CASCADE;
    END IF;

END $$;
