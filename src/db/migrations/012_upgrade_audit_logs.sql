-- Migration 012: Upgrade Audit Logs to support advanced attributes
DO $$
BEGIN
    -- Add browser column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='browser') THEN
        ALTER TABLE audit_logs ADD COLUMN browser VARCHAR(255);
    END IF;

    -- Add operating_system column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='operating_system') THEN
        ALTER TABLE audit_logs ADD COLUMN operating_system VARCHAR(255);
    END IF;

    -- Add device column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='device') THEN
        ALTER TABLE audit_logs ADD COLUMN device VARCHAR(255);
    END IF;

    -- Add branch column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='branch') THEN
        ALTER TABLE audit_logs ADD COLUMN branch VARCHAR(255);
    END IF;

    -- Add record_name column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='record_name') THEN
        ALTER TABLE audit_logs ADD COLUMN record_name VARCHAR(255);
    END IF;

    -- Add record_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='record_id') THEN
        ALTER TABLE audit_logs ADD COLUMN record_id VARCHAR(255);
    END IF;

    -- Add old_values column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='old_values') THEN
        ALTER TABLE audit_logs ADD COLUMN old_values JSONB DEFAULT '{}'::jsonb;
    END IF;

    -- Add new_values column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='new_values') THEN
        ALTER TABLE audit_logs ADD COLUMN new_values JSONB DEFAULT '{}'::jsonb;
    END IF;

    -- Add success column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='success') THEN
        ALTER TABLE audit_logs ADD COLUMN success BOOLEAN DEFAULT TRUE;
    END IF;

    -- Add execution_time column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='execution_time') THEN
        ALTER TABLE audit_logs ADD COLUMN execution_time INTEGER DEFAULT 0;
    END IF;

    -- Add indexes for filters
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_logs_browser') THEN
        CREATE INDEX idx_audit_logs_browser ON audit_logs(browser);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_logs_operating_system') THEN
        CREATE INDEX idx_audit_logs_operating_system ON audit_logs(operating_system);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_logs_device') THEN
        CREATE INDEX idx_audit_logs_device ON audit_logs(device);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_logs_branch') THEN
        CREATE INDEX idx_audit_logs_branch ON audit_logs(branch);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_logs_success') THEN
        CREATE INDEX idx_audit_logs_success ON audit_logs(success);
    END IF;
END $$;
