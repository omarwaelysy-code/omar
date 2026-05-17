-- 022_add_currencies_and_exchange_rates.sql
-- Add currencies and exchange_rates tables to support multi-currency system

CREATE TABLE IF NOT EXISTS currencies (
    id VARCHAR(36) PRIMARY KEY,
    company_id VARCHAR(36) NOT NULL,
    code VARCHAR(10) NOT NULL,
    name_ar VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_currencies_company_id ON currencies(company_id);

CREATE TABLE IF NOT EXISTS exchange_rates (
    id VARCHAR(36) PRIMARY KEY,
    company_id VARCHAR(36) NOT NULL,
    currency_id VARCHAR(36) NOT NULL REFERENCES currencies(id) ON DELETE CASCADE,
    exchange_rate DECIMAL(18, 6) NOT NULL,
    rate_date DATE NOT NULL,
    notes TEXT,
    created_by VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_currency_id ON exchange_rates(currency_id);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_company_id ON exchange_rates(company_id);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_date ON exchange_rates(rate_date DESC);
