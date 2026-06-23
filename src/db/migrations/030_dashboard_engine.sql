-- Create dashboards table
CREATE TABLE IF NOT EXISTS dashboards (
    id VARCHAR(36) PRIMARY KEY,
    company_id VARCHAR(36) REFERENCES companies(id),
    owner_user_id VARCHAR(36) REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    is_system BOOLEAN DEFAULT FALSE,
    icon VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create widgets table
CREATE TABLE IF NOT EXISTS widgets (
    id VARCHAR(36) PRIMARY KEY,
    dashboard_id VARCHAR(36) REFERENCES dashboards(id) ON DELETE CASCADE,
    widget_type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    x INT NOT NULL,
    y INT NOT NULL,
    w INT NOT NULL,
    h INT NOT NULL,
    settings JSONB DEFAULT '{}',
    filters JSONB DEFAULT '{}',
    "order" INT DEFAULT 0,
    visible BOOLEAN DEFAULT TRUE,
    locked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_dashboards_company ON dashboards(company_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_owner ON dashboards(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_widgets_dashboard ON widgets(dashboard_id);
