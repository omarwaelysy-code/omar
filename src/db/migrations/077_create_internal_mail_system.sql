CREATE TABLE IF NOT EXISTS internal_messages (
    id VARCHAR(36) PRIMARY KEY,
    company_id VARCHAR(36) REFERENCES companies(id) ON DELETE CASCADE,
    category VARCHAR(20) NOT NULL DEFAULT 'company',
    sender_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_name VARCHAR(255) NOT NULL,
    sender_email VARCHAR(255),
    to_users JSONB NOT NULL DEFAULT '[]'::jsonb,
    cc_users JSONB NOT NULL DEFAULT '[]'::jsonb,
    subject VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    parent_id VARCHAR(36),
    is_starred JSONB NOT NULL DEFAULT '[]'::jsonb,
    read_by JSONB NOT NULL DEFAULT '[]'::jsonb,
    archived_by JSONB NOT NULL DEFAULT '[]'::jsonb,
    deleted_by JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_internal_messages_company ON internal_messages(company_id);
CREATE INDEX IF NOT EXISTS idx_internal_messages_category ON internal_messages(category);
CREATE INDEX IF NOT EXISTS idx_internal_messages_sender ON internal_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_internal_messages_created_at ON internal_messages(created_at DESC);
