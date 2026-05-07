-- Repair Operations Module Schema
-- Added by AI Aide to fix synchronization issues

DO $$
BEGIN
    -- 1. Repair operation_fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operation_fields' AND column_name='label') THEN
        ALTER TABLE operation_fields ADD COLUMN label VARCHAR(255);
    END IF;

    -- 2. Repair operations
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operations' AND column_name='customer_id') THEN
        ALTER TABLE operations ADD COLUMN customer_id UUID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operations' AND column_name='customer_name') THEN
        ALTER TABLE operations ADD COLUMN customer_name VARCHAR(255);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operations' AND column_name='description') THEN
        ALTER TABLE operations ADD COLUMN description TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operations' AND column_name='date') THEN
        ALTER TABLE operations ADD COLUMN date DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operations' AND column_name='status') THEN
        ALTER TABLE operations ADD COLUMN status VARCHAR(50) DEFAULT 'draft';
    END IF;

    -- 3. Repair operation_field_values
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operation_field_values' AND column_name='company_id') THEN
        ALTER TABLE operation_field_values ADD COLUMN company_id VARCHAR(36);
    END IF;

    -- 4. Repair activity_logs
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activity_logs' AND column_name='created_at') THEN
        ALTER TABLE activity_logs ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        -- If timestamp exists, we can sync them, but usually timestamp handles it.
    END IF;

    -- Ensure UUID types for foreign keys (Double check)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operations' AND column_name = 'customer_id' AND data_type = 'character varying') THEN
        ALTER TABLE operations ALTER COLUMN customer_id TYPE UUID USING customer_id::uuid;
    END IF;

END $$;
