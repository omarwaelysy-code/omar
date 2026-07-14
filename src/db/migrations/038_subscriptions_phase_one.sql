CREATE TABLE IF NOT EXISTS company_subscriptions (
    id VARCHAR(36) PRIMARY KEY,
    company_id VARCHAR(36) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    plan_type VARCHAR(50) NOT NULL,
    subscription_status VARCHAR(50) NOT NULL,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    trial_until TIMESTAMP,
    max_users INT DEFAULT 0,
    max_branches INT DEFAULT 0,
    max_warehouses INT DEFAULT 0,
    max_devices INT DEFAULT 0,
    max_monthly_transactions INT DEFAULT 0,
    current_users INT DEFAULT 0,
    current_branches INT DEFAULT 0,
    current_warehouses INT DEFAULT 0,
    current_devices INT DEFAULT 0,
    current_monthly_transactions INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_company_subscriptions_company_id ON company_subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_company_subscriptions_status ON company_subscriptions(subscription_status);

CREATE TABLE IF NOT EXISTS subscription_history (
    id SERIAL PRIMARY KEY,
    company_id VARCHAR(36) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    old_plan VARCHAR(50),
    new_plan VARCHAR(50),
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    changed_by VARCHAR(255),
    change_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscription_history_company_id ON subscription_history(company_id);
