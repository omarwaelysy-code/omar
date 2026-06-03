-- Centralized Audit Logging System
-- Ensures audit_logs table exists and is optimized for production
-- This migration is fully idempotent: safe to run on fresh and existing databases.

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
            module VARCHAR(100),
            details TEXT,
            entity_type VARCHAR(100),
            entity_id VARCHAR(100),
            ip_address VARCHAR(45),
            metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    END IF;

    -- 2. Add missing columns to existing tables (idempotent ADD COLUMN IF NOT EXISTS)

    -- user_email: needed by erp-api.ts logAudit()
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='user_email') THEN
        ALTER TABLE audit_logs ADD COLUMN user_email VARCHAR(255);
    END IF;

    -- username: needed by erp-api.ts logAudit()
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='username') THEN
        ALTER TABLE audit_logs ADD COLUMN username VARCHAR(255);
    END IF;

    -- module: needed by erp-api.ts logAudit() and ActivityLog.tsx UI filter
    -- Was missing from init-db.ts schema, which caused idx_audit_logs_module to fail.
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='module') THEN
        ALTER TABLE audit_logs ADD COLUMN module VARCHAR(100);
    END IF;

    -- details: needed by erp-api.ts logAudit()
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='details') THEN
        ALTER TABLE audit_logs ADD COLUMN details TEXT;
    END IF;

    -- entity_type: needed by erp-api.ts logAudit()
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='entity_type') THEN
        ALTER TABLE audit_logs ADD COLUMN entity_type VARCHAR(100);
    END IF;

    -- entity_id: needed by erp-api.ts logAudit()
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='entity_id') THEN
        ALTER TABLE audit_logs ADD COLUMN entity_id VARCHAR(100);
    END IF;

    -- metadata: needed by erp-api.ts logAudit()
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='metadata') THEN
        ALTER TABLE audit_logs ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;

    -- 3. Add performance indexes (all guarded with IF NOT EXISTS — idempotent)

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_logs_company_id') THEN
        CREATE INDEX idx_audit_logs_company_id ON audit_logs(company_id);
    END IF;

    -- Only create the module index when the module column is confirmed to exist
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='module') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_logs_module') THEN
            CREATE INDEX idx_audit_logs_module ON audit_logs(module);
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_logs_action') THEN
        CREATE INDEX idx_audit_logs_action ON audit_logs(action);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_logs_created_at') THEN
        CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
    END IF;

    -- 4. Ensure created_at in activity_logs (legacy support fallback)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activity_logs' AND column_name='created_at') THEN
        ALTER TABLE activity_logs ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;

END $$;
