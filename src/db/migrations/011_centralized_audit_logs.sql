-- Centralized Audit Logging System
-- Ensures audit_logs table exists and is optimized for production

DO $$ 
BEGIN
    -- 1. Create audit_logs table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
        CREATE TABLE audit_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id VARCHAR(36),
            user_id VARCHAR(36),
            username VARCHAR(255),
            user_email VARCHAR(255),
            action VARCHAR(100) NOT NULL,
            module VARCHAR(100) NOT NULL,
            details TEXT,
            entity_type VARCHAR(100),
            entity_id VARCHAR(100),
            ip_address VARCHAR(45),
            metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    END IF;

    -- Add user_email column if it doesn't exist (for existing tables)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='user_email') THEN
        ALTER TABLE audit_logs ADD COLUMN user_email VARCHAR(255);
    END IF;

    -- 2. Add performance indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_logs_company_id') THEN
        CREATE INDEX idx_audit_logs_company_id ON audit_logs(company_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_logs_module') THEN
        CREATE INDEX idx_audit_logs_module ON audit_logs(module);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_logs_action') THEN
        CREATE INDEX idx_audit_logs_action ON audit_logs(action);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_logs_created_at') THEN
        CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
    END IF;

    -- 3. Ensure created_at in activity_logs (legacy support fallback)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activity_logs' AND column_name='created_at') THEN
        ALTER TABLE activity_logs ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;

END $$;
