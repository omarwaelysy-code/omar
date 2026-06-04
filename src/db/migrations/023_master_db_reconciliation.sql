-- =============================================================================
-- Migration 023: Master Database Reconciliation
-- =============================================================================
--
-- PURPOSE:
--   A single, fully-idempotent migration that closes every gap between an older
--   production database and the current codebase schema.  It is safe to run on
--   any database state, including:
--     * Fresh installs (all CREATE IF NOT EXISTS guards)
--     * Databases that ran only some of migrations 001-022
--     * Databases where prior migrations partially succeeded
--     * Databases where column types were left as UUID instead of VARCHAR(36)
--
-- STRUCTURE:
--   Phase A  – Missing tables (dependency-ordered)
--   Phase B  – Missing columns (table by table)
--   Phase C  – Wrong column types  (UUID → VARCHAR(36), safe cast)
--   Phase D  – Orphan data cleanup (NULL-out / DELETE before FK creation)
--   Phase E  – Foreign key reconciliation (drop-then-re-add)
--   Phase F  – Missing indexes
--   Phase G  – Schema version stamp
--
-- ALL statements are guarded by existence checks – running this migration
-- multiple times is safe.
-- =============================================================================

DO $$
DECLARE
    v_type TEXT;
    r      RECORD;
BEGIN

-- ============================================================
-- PHASE A: MISSING TABLES  (dependency order)
-- ============================================================

-- A1. currencies (no FK deps beyond companies)
IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'currencies') THEN
    CREATE TABLE currencies (
        id          VARCHAR(36) PRIMARY KEY,
        company_id  VARCHAR(36),
        code        VARCHAR(10)  NOT NULL,
        name_ar     VARCHAR(100) NOT NULL,
        name_en     VARCHAR(100) NOT NULL,
        symbol      VARCHAR(10),
        is_active   BOOLEAN DEFAULT TRUE,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
END IF;

-- A2. exchange_rates → currencies
IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'exchange_rates') THEN
    CREATE TABLE exchange_rates (
        id            VARCHAR(36) PRIMARY KEY,
        company_id    VARCHAR(36),
        currency_id   VARCHAR(36),
        exchange_rate DECIMAL(18,6) NOT NULL,
        rate_date     DATE NOT NULL,
        notes         TEXT,
        created_by    VARCHAR(36),
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
END IF;

-- A3. departments (self-referencing)
IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'departments') THEN
    CREATE TABLE departments (
        id               VARCHAR(36) PRIMARY KEY,
        company_id       VARCHAR(36),
        code             VARCHAR(50) UNIQUE,
        name             VARCHAR(255) NOT NULL,
        description      TEXT,
        parent_id        VARCHAR(36),
        manager_user_id  VARCHAR(36),
        is_active        BOOLEAN DEFAULT true,
        created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
END IF;

-- A4. cost_centers → departments
IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cost_centers') THEN
    CREATE TABLE cost_centers (
        id            VARCHAR(36) PRIMARY KEY,
        company_id    VARCHAR(36),
        department_id VARCHAR(36),
        code          VARCHAR(50) UNIQUE,
        name          VARCHAR(255) NOT NULL,
        description   TEXT,
        budget        DECIMAL(18,4),
        currency      VARCHAR(10),
        is_active     BOOLEAN DEFAULT true,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
END IF;

-- A5. operation_categories (self-referencing)
IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operation_categories') THEN
    CREATE TABLE operation_categories (
        id          VARCHAR(36) PRIMARY KEY,
        company_id  VARCHAR(36),
        name        VARCHAR(255) NOT NULL,
        code        VARCHAR(50),
        parent_id   VARCHAR(36),
        is_final    BOOLEAN DEFAULT FALSE,
        level       INT DEFAULT 0,
        full_path   TEXT,
        description TEXT,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
END IF;

-- A6. operation_fields → operation_categories
IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operation_fields') THEN
    CREATE TABLE operation_fields (
        id                   VARCHAR(36) PRIMARY KEY,
        company_id           VARCHAR(36),
        category_id          VARCHAR(36),
        operation_category_id VARCHAR(36),
        name                 VARCHAR(255) NOT NULL,
        label                VARCHAR(255),
        code                 VARCHAR(50) UNIQUE,
        description          TEXT,
        type                 VARCHAR(50) NOT NULL,
        unit                 VARCHAR(50),
        default_value        TEXT,
        is_required          BOOLEAN DEFAULT false,
        options              JSONB,
        sort_order           INTEGER DEFAULT 0,
        department_id        VARCHAR(36),
        created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
END IF;

-- A7. operations → operation_categories, departments, cost_centers
IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operations') THEN
    CREATE TABLE operations (
        id                    VARCHAR(36) PRIMARY KEY,
        company_id            VARCHAR(36),
        category_id           VARCHAR(36),
        operation_category_id VARCHAR(36),
        department_id         VARCHAR(36),
        cost_center_id        VARCHAR(36),
        operation_number      VARCHAR(50) UNIQUE,
        operation_date        DATE,
        date                  DATE,
        customer_id           VARCHAR(36),
        customer_name         VARCHAR(255),
        description           TEXT,
        status                VARCHAR(20) DEFAULT 'pending',
        created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
END IF;

-- A8. operation_field_values → operations, operation_fields
IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operation_field_values') THEN
    CREATE TABLE operation_field_values (
        id           VARCHAR(36) PRIMARY KEY,
        operation_id VARCHAR(36),
        field_id     VARCHAR(36),
        value        TEXT,
        company_id   VARCHAR(36),
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
END IF;

-- A9. field_operation_categories  (join table)
IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'field_operation_categories') THEN
    CREATE TABLE field_operation_categories (
        id          VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        field_id    VARCHAR(36),
        category_id VARCHAR(36),
        company_id  VARCHAR(36),
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
END IF;

-- A10. purchase_return_items → purchase_returns
IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_return_items') THEN
    CREATE TABLE purchase_return_items (
        id                VARCHAR(36) PRIMARY KEY,
        return_id         VARCHAR(36),
        product_id        VARCHAR(36),
        company_id        VARCHAR(36),
        description       TEXT,
        quantity          DECIMAL(18,4) NOT NULL,
        unit_price        DECIMAL(18,4) NOT NULL,
        total             DECIMAL(18,4) NOT NULL,
        product_name      VARCHAR(255),
        product_code      VARCHAR(100),
        product_image_url TEXT,
        created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
END IF;

-- A11. audit_logs
IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
    CREATE TABLE audit_logs (
        id          VARCHAR(36) PRIMARY KEY,
        company_id  VARCHAR(36),
        user_id     VARCHAR(36),
        username    VARCHAR(255),
        user_email  VARCHAR(255),
        action      VARCHAR(100) NOT NULL,
        module      VARCHAR(100),
        details     TEXT,
        entity_type VARCHAR(100),
        entity_id   VARCHAR(100),
        ip_address  VARCHAR(45),
        metadata    JSONB DEFAULT '{}'::jsonb,
        created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
END IF;

-- A12. item_groups
IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'item_groups') THEN
    CREATE TABLE item_groups (
        id              VARCHAR(36) PRIMARY KEY,
        company_id      VARCHAR(36),
        name            VARCHAR(255) NOT NULL,
        code            VARCHAR(100) NOT NULL,
        type            VARCHAR(100) NOT NULL,
        sequence_number INTEGER DEFAULT 1,
        description     TEXT,
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
END IF;

-- A13. _system_settings  (for schema version tracking)
IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '_system_settings') THEN
    CREATE TABLE _system_settings (
        key        VARCHAR(100) PRIMARY KEY,
        value      JSONB,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
END IF;

-- ============================================================
-- PHASE B: MISSING COLUMNS
-- ============================================================

-- B1. companies
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'companies') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='logo_url') THEN ALTER TABLE companies ADD COLUMN logo_url TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='website') THEN ALTER TABLE companies ADD COLUMN website VARCHAR(255); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='subscription_status') THEN ALTER TABLE companies ADD COLUMN subscription_status VARCHAR(20) DEFAULT 'trial'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='subscription_plan') THEN ALTER TABLE companies ADD COLUMN subscription_plan VARCHAR(20) DEFAULT 'basic'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='subscription_start') THEN ALTER TABLE companies ADD COLUMN subscription_start TIMESTAMP; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='subscription_end') THEN ALTER TABLE companies ADD COLUMN subscription_end TIMESTAMP; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='subscription_expiry') THEN ALTER TABLE companies ADD COLUMN subscription_expiry TIMESTAMP; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='subscription_days') THEN ALTER TABLE companies ADD COLUMN subscription_days INTEGER DEFAULT 30; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='users_limit') THEN ALTER TABLE companies ADD COLUMN users_limit INTEGER DEFAULT 5; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='transactions_limit') THEN ALTER TABLE companies ADD COLUMN transactions_limit INTEGER DEFAULT 1000; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='company_status') THEN ALTER TABLE companies ADD COLUMN company_status VARCHAR(20) DEFAULT 'active'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='features') THEN ALTER TABLE companies ADD COLUMN features JSONB DEFAULT '[]'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='settings') THEN ALTER TABLE companies ADD COLUMN settings JSONB DEFAULT '{}'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='tax_number') THEN ALTER TABLE companies ADD COLUMN tax_number VARCHAR(50); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='commercial_register') THEN ALTER TABLE companies ADD COLUMN commercial_register VARCHAR(50); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='address') THEN ALTER TABLE companies ADD COLUMN address TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='phone') THEN ALTER TABLE companies ADD COLUMN phone VARCHAR(20); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='email') THEN ALTER TABLE companies ADD COLUMN email VARCHAR(100); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='created_at') THEN ALTER TABLE companies ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='updated_at') THEN ALTER TABLE companies ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='vat_enabled') THEN ALTER TABLE companies ADD COLUMN vat_enabled BOOLEAN DEFAULT FALSE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='wht_enabled') THEN ALTER TABLE companies ADD COLUMN wht_enabled BOOLEAN DEFAULT FALSE; END IF;
END IF;

-- B2. users
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='mobile') THEN ALTER TABLE users ADD COLUMN mobile VARCHAR(20); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='name') THEN ALTER TABLE users ADD COLUMN name VARCHAR(255); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='status') THEN ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'active'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='temp_password') THEN ALTER TABLE users ADD COLUMN temp_password VARCHAR(255); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='permissions') THEN ALTER TABLE users ADD COLUMN permissions JSONB DEFAULT '{}'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='must_change_password') THEN ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT FALSE; END IF;
END IF;

-- B3. audit_logs
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='user_email') THEN ALTER TABLE audit_logs ADD COLUMN user_email VARCHAR(255); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='username') THEN ALTER TABLE audit_logs ADD COLUMN username VARCHAR(255); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='module') THEN ALTER TABLE audit_logs ADD COLUMN module VARCHAR(100); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='details') THEN ALTER TABLE audit_logs ADD COLUMN details TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='entity_type') THEN ALTER TABLE audit_logs ADD COLUMN entity_type VARCHAR(100); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='entity_id') THEN ALTER TABLE audit_logs ADD COLUMN entity_id VARCHAR(100); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='metadata') THEN ALTER TABLE audit_logs ADD COLUMN metadata JSONB DEFAULT '{}'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='ip_address') THEN ALTER TABLE audit_logs ADD COLUMN ip_address VARCHAR(45); END IF;
END IF;

-- B4. activity_logs
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activity_logs') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activity_logs' AND column_name='created_at') THEN ALTER TABLE activity_logs ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activity_logs' AND column_name='company_id') THEN ALTER TABLE activity_logs ADD COLUMN company_id VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activity_logs' AND column_name='user_id') THEN ALTER TABLE activity_logs ADD COLUMN user_id VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activity_logs' AND column_name='username') THEN ALTER TABLE activity_logs ADD COLUMN username VARCHAR(100); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activity_logs' AND column_name='details') THEN ALTER TABLE activity_logs ADD COLUMN details TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activity_logs' AND column_name='ip_address') THEN ALTER TABLE activity_logs ADD COLUMN ip_address VARCHAR(45); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activity_logs' AND column_name='entity') THEN ALTER TABLE activity_logs ADD COLUMN entity JSONB; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activity_logs' AND column_name='account_id') THEN ALTER TABLE activity_logs ADD COLUMN account_id VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activity_logs' AND column_name='document_id') THEN ALTER TABLE activity_logs ADD COLUMN document_id VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activity_logs' AND column_name='changes') THEN ALTER TABLE activity_logs ADD COLUMN changes JSONB; END IF;
END IF;

-- B5. accounts
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'accounts') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounts' AND column_name='parent_id') THEN ALTER TABLE accounts ADD COLUMN parent_id VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounts' AND column_name='opening_balance') THEN ALTER TABLE accounts ADD COLUMN opening_balance DECIMAL(18,4) DEFAULT 0; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounts' AND column_name='is_active') THEN ALTER TABLE accounts ADD COLUMN is_active BOOLEAN DEFAULT TRUE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounts' AND column_name='required_sub_account') THEN ALTER TABLE accounts ADD COLUMN required_sub_account BOOLEAN DEFAULT FALSE; END IF;
END IF;

-- B6. customers
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='account_id') THEN ALTER TABLE customers ADD COLUMN account_id VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='code') THEN ALTER TABLE customers ADD COLUMN code VARCHAR(50); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='opening_balance') THEN ALTER TABLE customers ADD COLUMN opening_balance DECIMAL(18,4) DEFAULT 0; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='opening_balance_date') THEN ALTER TABLE customers ADD COLUMN opening_balance_date DATE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='counter_account_id') THEN ALTER TABLE customers ADD COLUMN counter_account_id VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='account_name') THEN ALTER TABLE customers ADD COLUMN account_name VARCHAR(255); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='tax_number') THEN ALTER TABLE customers ADD COLUMN tax_number VARCHAR(50); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='created_at') THEN ALTER TABLE customers ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='updated_at') THEN ALTER TABLE customers ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP; END IF;
END IF;

-- B7. suppliers
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suppliers') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='account_id') THEN ALTER TABLE suppliers ADD COLUMN account_id VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='code') THEN ALTER TABLE suppliers ADD COLUMN code VARCHAR(50); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='opening_balance') THEN ALTER TABLE suppliers ADD COLUMN opening_balance DECIMAL(18,4) DEFAULT 0; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='opening_balance_date') THEN ALTER TABLE suppliers ADD COLUMN opening_balance_date DATE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='counter_account_id') THEN ALTER TABLE suppliers ADD COLUMN counter_account_id VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='account_name') THEN ALTER TABLE suppliers ADD COLUMN account_name VARCHAR(255); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='tax_number') THEN ALTER TABLE suppliers ADD COLUMN tax_number VARCHAR(50); END IF;
END IF;

-- B8. products
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='type') THEN ALTER TABLE products ADD COLUMN type VARCHAR(50) DEFAULT 'product'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='description') THEN ALTER TABLE products ADD COLUMN description TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='image_url') THEN ALTER TABLE products ADD COLUMN image_url TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='category') THEN ALTER TABLE products ADD COLUMN category VARCHAR(100); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='unit') THEN ALTER TABLE products ADD COLUMN unit VARCHAR(50); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='cost_price') THEN ALTER TABLE products ADD COLUMN cost_price DECIMAL(18,4) DEFAULT 0; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='sale_price') THEN ALTER TABLE products ADD COLUMN sale_price DECIMAL(18,4) DEFAULT 0; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='stock') THEN ALTER TABLE products ADD COLUMN stock DECIMAL(18,4) DEFAULT 0; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='min_stock') THEN ALTER TABLE products ADD COLUMN min_stock DECIMAL(18,4) DEFAULT 0; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='current_stock') THEN ALTER TABLE products ADD COLUMN current_stock DECIMAL(18,4) DEFAULT 0; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='is_service') THEN ALTER TABLE products ADD COLUMN is_service BOOLEAN DEFAULT FALSE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='counter_account_id') THEN ALTER TABLE products ADD COLUMN counter_account_id VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='revenue_account_id') THEN ALTER TABLE products ADD COLUMN revenue_account_id VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='cost_account_id') THEN ALTER TABLE products ADD COLUMN cost_account_id VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='revenue_account_name') THEN ALTER TABLE products ADD COLUMN revenue_account_name VARCHAR(255); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='cost_account_name') THEN ALTER TABLE products ADD COLUMN cost_account_name VARCHAR(255); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='barcode') THEN ALTER TABLE products ADD COLUMN barcode VARCHAR(100); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='weighted_average_cost') THEN ALTER TABLE products ADD COLUMN weighted_average_cost DECIMAL(18,4) DEFAULT 0; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='item_group_id') THEN ALTER TABLE products ADD COLUMN item_group_id VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='item_group_name') THEN ALTER TABLE products ADD COLUMN item_group_name VARCHAR(255); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='inventory_account_id') THEN ALTER TABLE products ADD COLUMN inventory_account_id VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='inventory_account_name') THEN ALTER TABLE products ADD COLUMN inventory_account_name VARCHAR(255); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='vat_account_id') THEN ALTER TABLE products ADD COLUMN vat_account_id VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='vat_account_name') THEN ALTER TABLE products ADD COLUMN vat_account_name VARCHAR(255); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='vat_rate') THEN ALTER TABLE products ADD COLUMN vat_rate DECIMAL(10,4) DEFAULT 0; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='created_at') THEN ALTER TABLE products ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='updated_at') THEN ALTER TABLE products ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP; END IF;
END IF;

-- B9. payment_methods
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_methods') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_methods' AND column_name='account_id') THEN ALTER TABLE payment_methods ADD COLUMN account_id VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_methods' AND column_name='code') THEN ALTER TABLE payment_methods ADD COLUMN code VARCHAR(50); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_methods' AND column_name='type') THEN ALTER TABLE payment_methods ADD COLUMN type VARCHAR(20) DEFAULT 'cash'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_methods' AND column_name='opening_balance') THEN ALTER TABLE payment_methods ADD COLUMN opening_balance DECIMAL(18,4) DEFAULT 0; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_methods' AND column_name='opening_balance_date') THEN ALTER TABLE payment_methods ADD COLUMN opening_balance_date DATE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_methods' AND column_name='counter_account_id') THEN ALTER TABLE payment_methods ADD COLUMN counter_account_id VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_methods' AND column_name='account_name') THEN ALTER TABLE payment_methods ADD COLUMN account_name VARCHAR(255); END IF;
END IF;

-- B10. invoices
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='due_date') THEN ALTER TABLE invoices ADD COLUMN due_date DATE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='subtotal') THEN ALTER TABLE invoices ADD COLUMN subtotal DECIMAL(18,4) DEFAULT 0; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='tax_amount') THEN ALTER TABLE invoices ADD COLUMN tax_amount DECIMAL(18,4) DEFAULT 0; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='discount_amount') THEN ALTER TABLE invoices ADD COLUMN discount_amount DECIMAL(18,4) DEFAULT 0; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='total_amount') THEN ALTER TABLE invoices ADD COLUMN total_amount DECIMAL(18,4) DEFAULT 0; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='payment_type') THEN ALTER TABLE invoices ADD COLUMN payment_type VARCHAR(20) DEFAULT 'cash'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='payment_method_id') THEN ALTER TABLE invoices ADD COLUMN payment_method_id VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='description') THEN ALTER TABLE invoices ADD COLUMN description TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='notes') THEN ALTER TABLE invoices ADD COLUMN notes TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='created_by') THEN ALTER TABLE invoices ADD COLUMN created_by VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='customer_name') THEN ALTER TABLE invoices ADD COLUMN customer_name VARCHAR(255); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='payment_method_name') THEN ALTER TABLE invoices ADD COLUMN payment_method_name VARCHAR(255); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='warehouse_id') THEN ALTER TABLE invoices ADD COLUMN warehouse_id VARCHAR(36); END IF;
END IF;

-- B11. returns
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'returns') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='returns' AND column_name='total_amount') THEN ALTER TABLE returns ADD COLUMN total_amount DECIMAL(18,4) DEFAULT 0; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='returns' AND column_name='payment_type') THEN ALTER TABLE returns ADD COLUMN payment_type VARCHAR(20) DEFAULT 'cash'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='returns' AND column_name='payment_method_id') THEN ALTER TABLE returns ADD COLUMN payment_method_id VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='returns' AND column_name='description') THEN ALTER TABLE returns ADD COLUMN description TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='returns' AND column_name='notes') THEN ALTER TABLE returns ADD COLUMN notes TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='returns' AND column_name='customer_name') THEN ALTER TABLE returns ADD COLUMN customer_name VARCHAR(255); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='returns' AND column_name='payment_method_name') THEN ALTER TABLE returns ADD COLUMN payment_method_name VARCHAR(255); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='returns' AND column_name='warehouse_id') THEN ALTER TABLE returns ADD COLUMN warehouse_id VARCHAR(36); END IF;
END IF;

-- B12. purchase_invoices
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_invoices') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_invoices' AND column_name='due_date') THEN ALTER TABLE purchase_invoices ADD COLUMN due_date DATE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_invoices' AND column_name='subtotal') THEN ALTER TABLE purchase_invoices ADD COLUMN subtotal DECIMAL(18,4) DEFAULT 0; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_invoices' AND column_name='tax_amount') THEN ALTER TABLE purchase_invoices ADD COLUMN tax_amount DECIMAL(18,4) DEFAULT 0; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_invoices' AND column_name='discount_amount') THEN ALTER TABLE purchase_invoices ADD COLUMN discount_amount DECIMAL(18,4) DEFAULT 0; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_invoices' AND column_name='total_amount') THEN ALTER TABLE purchase_invoices ADD COLUMN total_amount DECIMAL(18,4) DEFAULT 0; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_invoices' AND column_name='status') THEN ALTER TABLE purchase_invoices ADD COLUMN status VARCHAR(20) DEFAULT 'draft'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_invoices' AND column_name='payment_type') THEN ALTER TABLE purchase_invoices ADD COLUMN payment_type VARCHAR(20) DEFAULT 'cash'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_invoices' AND column_name='payment_method_id') THEN ALTER TABLE purchase_invoices ADD COLUMN payment_method_id VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_invoices' AND column_name='description') THEN ALTER TABLE purchase_invoices ADD COLUMN description TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_invoices' AND column_name='notes') THEN ALTER TABLE purchase_invoices ADD COLUMN notes TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_invoices' AND column_name='supplier_name') THEN ALTER TABLE purchase_invoices ADD COLUMN supplier_name VARCHAR(255); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_invoices' AND column_name='payment_method_name') THEN ALTER TABLE purchase_invoices ADD COLUMN payment_method_name VARCHAR(255); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_invoices' AND column_name='warehouse_id') THEN ALTER TABLE purchase_invoices ADD COLUMN warehouse_id VARCHAR(36); END IF;
END IF;

-- B13. purchase_returns
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_returns') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_returns' AND column_name='total_amount') THEN ALTER TABLE purchase_returns ADD COLUMN total_amount DECIMAL(18,4) DEFAULT 0; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_returns' AND column_name='payment_type') THEN ALTER TABLE purchase_returns ADD COLUMN payment_type VARCHAR(20) DEFAULT 'cash'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_returns' AND column_name='payment_method_id') THEN ALTER TABLE purchase_returns ADD COLUMN payment_method_id VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_returns' AND column_name='description') THEN ALTER TABLE purchase_returns ADD COLUMN description TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_returns' AND column_name='notes') THEN ALTER TABLE purchase_returns ADD COLUMN notes TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_returns' AND column_name='supplier_name') THEN ALTER TABLE purchase_returns ADD COLUMN supplier_name VARCHAR(255); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_returns' AND column_name='payment_method_name') THEN ALTER TABLE purchase_returns ADD COLUMN payment_method_name VARCHAR(255); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_returns' AND column_name='warehouse_id') THEN ALTER TABLE purchase_returns ADD COLUMN warehouse_id VARCHAR(36); END IF;
END IF;

-- B14. purchase_return_items
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_return_items') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_return_items' AND column_name='company_id') THEN ALTER TABLE purchase_return_items ADD COLUMN company_id VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_return_items' AND column_name='description') THEN ALTER TABLE purchase_return_items ADD COLUMN description TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_return_items' AND column_name='product_name') THEN ALTER TABLE purchase_return_items ADD COLUMN product_name VARCHAR(255); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_return_items' AND column_name='product_code') THEN ALTER TABLE purchase_return_items ADD COLUMN product_code VARCHAR(100); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_return_items' AND column_name='product_image_url') THEN ALTER TABLE purchase_return_items ADD COLUMN product_image_url TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_return_items' AND column_name='created_at') THEN ALTER TABLE purchase_return_items ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP; END IF;
END IF;

-- B15. invoice_items
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoice_items') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_items' AND column_name='product_name') THEN ALTER TABLE invoice_items ADD COLUMN product_name VARCHAR(255); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_items' AND column_name='product_code') THEN ALTER TABLE invoice_items ADD COLUMN product_code VARCHAR(100); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_items' AND column_name='product_image_url') THEN ALTER TABLE invoice_items ADD COLUMN product_image_url TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_items' AND column_name='unit_cost') THEN ALTER TABLE invoice_items ADD COLUMN unit_cost DECIMAL(18,4) DEFAULT 0; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_items' AND column_name='total_cost') THEN ALTER TABLE invoice_items ADD COLUMN total_cost DECIMAL(18,4) DEFAULT 0; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_items' AND column_name='costing_method_used') THEN ALTER TABLE invoice_items ADD COLUMN costing_method_used VARCHAR(50); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_items' AND column_name='description') THEN ALTER TABLE invoice_items ADD COLUMN description TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_items' AND column_name='company_id') THEN ALTER TABLE invoice_items ADD COLUMN company_id VARCHAR(36); END IF;
END IF;

-- B16. return_items
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'return_items') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='return_items' AND column_name='product_name') THEN ALTER TABLE return_items ADD COLUMN product_name VARCHAR(255); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='return_items' AND column_name='product_code') THEN ALTER TABLE return_items ADD COLUMN product_code VARCHAR(100); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='return_items' AND column_name='product_image_url') THEN ALTER TABLE return_items ADD COLUMN product_image_url TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='return_items' AND column_name='description') THEN ALTER TABLE return_items ADD COLUMN description TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='return_items' AND column_name='company_id') THEN ALTER TABLE return_items ADD COLUMN company_id VARCHAR(36); END IF;
END IF;

-- B17. receipt_vouchers
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'receipt_vouchers') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='receipt_vouchers' AND column_name='payment_method_id') THEN ALTER TABLE receipt_vouchers ADD COLUMN payment_method_id VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='receipt_vouchers' AND column_name='customer_name') THEN ALTER TABLE receipt_vouchers ADD COLUMN customer_name VARCHAR(255); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='receipt_vouchers' AND column_name='voucher_number') THEN ALTER TABLE receipt_vouchers ADD COLUMN voucher_number VARCHAR(50); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='receipt_vouchers' AND column_name='payment_method_name') THEN ALTER TABLE receipt_vouchers ADD COLUMN payment_method_name VARCHAR(255); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='receipt_vouchers' AND column_name='account_id') THEN ALTER TABLE receipt_vouchers ADD COLUMN account_id VARCHAR(36); END IF;
END IF;

-- B18. payment_vouchers
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_vouchers') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_vouchers' AND column_name='payment_method_id') THEN ALTER TABLE payment_vouchers ADD COLUMN payment_method_id VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_vouchers' AND column_name='supplier_name') THEN ALTER TABLE payment_vouchers ADD COLUMN supplier_name VARCHAR(255); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_vouchers' AND column_name='voucher_number') THEN ALTER TABLE payment_vouchers ADD COLUMN voucher_number VARCHAR(50); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_vouchers' AND column_name='category_name') THEN ALTER TABLE payment_vouchers ADD COLUMN category_name VARCHAR(255); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_vouchers' AND column_name='payment_method_name') THEN ALTER TABLE payment_vouchers ADD COLUMN payment_method_name VARCHAR(255); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_vouchers' AND column_name='account_id') THEN ALTER TABLE payment_vouchers ADD COLUMN account_id VARCHAR(36); END IF;
END IF;

-- B19. cash_transfers
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cash_transfers') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cash_transfers' AND column_name='from_payment_method_name') THEN ALTER TABLE cash_transfers ADD COLUMN from_payment_method_name VARCHAR(255); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cash_transfers' AND column_name='to_payment_method_name') THEN ALTER TABLE cash_transfers ADD COLUMN to_payment_method_name VARCHAR(255); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cash_transfers' AND column_name='created_by') THEN ALTER TABLE cash_transfers ADD COLUMN created_by VARCHAR(36); END IF;
END IF;

-- B20. journal_entries
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'journal_entries') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='journal_entries' AND column_name='entry_number') THEN ALTER TABLE journal_entries ADD COLUMN entry_number VARCHAR(50); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='journal_entries' AND column_name='reference_id') THEN ALTER TABLE journal_entries ADD COLUMN reference_id VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='journal_entries' AND column_name='reference_type') THEN ALTER TABLE journal_entries ADD COLUMN reference_type VARCHAR(50); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='journal_entries' AND column_name='reference_number') THEN ALTER TABLE journal_entries ADD COLUMN reference_number VARCHAR(50); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='journal_entries' AND column_name='status') THEN ALTER TABLE journal_entries ADD COLUMN status VARCHAR(20) DEFAULT 'posted'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='journal_entries' AND column_name='total_debit') THEN ALTER TABLE journal_entries ADD COLUMN total_debit DECIMAL(18,4) DEFAULT 0; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='journal_entries' AND column_name='total_credit') THEN ALTER TABLE journal_entries ADD COLUMN total_credit DECIMAL(18,4) DEFAULT 0; END IF;
END IF;

-- B21. journal_entry_lines
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'journal_entry_lines') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='journal_entry_lines' AND column_name='account_name') THEN ALTER TABLE journal_entry_lines ADD COLUMN account_name VARCHAR(255); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='journal_entry_lines' AND column_name='customer_id') THEN ALTER TABLE journal_entry_lines ADD COLUMN customer_id VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='journal_entry_lines' AND column_name='supplier_id') THEN ALTER TABLE journal_entry_lines ADD COLUMN supplier_id VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='journal_entry_lines' AND column_name='customer_name') THEN ALTER TABLE journal_entry_lines ADD COLUMN customer_name VARCHAR(255); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='journal_entry_lines' AND column_name='supplier_name') THEN ALTER TABLE journal_entry_lines ADD COLUMN supplier_name VARCHAR(255); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='journal_entry_lines' AND column_name='company_id') THEN ALTER TABLE journal_entry_lines ADD COLUMN company_id VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='journal_entry_lines' AND column_name='description') THEN ALTER TABLE journal_entry_lines ADD COLUMN description TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='journal_entry_lines' AND column_name='created_at') THEN ALTER TABLE journal_entry_lines ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='journal_entry_lines' AND column_name='sub_account_id') THEN ALTER TABLE journal_entry_lines ADD COLUMN sub_account_id VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='journal_entry_lines' AND column_name='sub_account_type') THEN ALTER TABLE journal_entry_lines ADD COLUMN sub_account_type VARCHAR(50); END IF;
END IF;

-- B22. expense_categories
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expense_categories') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expense_categories' AND column_name='account_name') THEN ALTER TABLE expense_categories ADD COLUMN account_name VARCHAR(255); END IF;
END IF;

-- B23. settings
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'settings') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='settings' AND column_name='updated_at') THEN ALTER TABLE settings ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='settings' AND column_name='customer_discount_account_id') THEN ALTER TABLE settings ADD COLUMN customer_discount_account_id VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='settings' AND column_name='supplier_discount_account_id') THEN ALTER TABLE settings ADD COLUMN supplier_discount_account_id VARCHAR(36); END IF;
END IF;

-- B24. operation_categories
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operation_categories') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operation_categories' AND column_name='code') THEN ALTER TABLE operation_categories ADD COLUMN code VARCHAR(50); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operation_categories' AND column_name='is_final') THEN ALTER TABLE operation_categories ADD COLUMN is_final BOOLEAN DEFAULT FALSE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operation_categories' AND column_name='level') THEN ALTER TABLE operation_categories ADD COLUMN level INT DEFAULT 0; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operation_categories' AND column_name='full_path') THEN ALTER TABLE operation_categories ADD COLUMN full_path TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operation_categories' AND column_name='description') THEN ALTER TABLE operation_categories ADD COLUMN description TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operation_categories' AND column_name='updated_at') THEN ALTER TABLE operation_categories ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP; END IF;
END IF;

-- B25. operation_fields
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operation_fields') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operation_fields' AND column_name='label') THEN ALTER TABLE operation_fields ADD COLUMN label VARCHAR(255); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operation_fields' AND column_name='code') THEN ALTER TABLE operation_fields ADD COLUMN code VARCHAR(50); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operation_fields' AND column_name='description') THEN ALTER TABLE operation_fields ADD COLUMN description TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operation_fields' AND column_name='unit') THEN ALTER TABLE operation_fields ADD COLUMN unit VARCHAR(50); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operation_fields' AND column_name='default_value') THEN ALTER TABLE operation_fields ADD COLUMN default_value TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operation_fields' AND column_name='is_required') THEN ALTER TABLE operation_fields ADD COLUMN is_required BOOLEAN DEFAULT false; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operation_fields' AND column_name='options') THEN ALTER TABLE operation_fields ADD COLUMN options JSONB; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operation_fields' AND column_name='sort_order') THEN ALTER TABLE operation_fields ADD COLUMN sort_order INTEGER DEFAULT 0; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operation_fields' AND column_name='category_id') THEN ALTER TABLE operation_fields ADD COLUMN category_id VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operation_fields' AND column_name='operation_category_id') THEN ALTER TABLE operation_fields ADD COLUMN operation_category_id VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operation_fields' AND column_name='department_id') THEN ALTER TABLE operation_fields ADD COLUMN department_id VARCHAR(36); END IF;
END IF;

-- B26. operations
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operations') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operations' AND column_name='category_id') THEN ALTER TABLE operations ADD COLUMN category_id VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operations' AND column_name='operation_category_id') THEN ALTER TABLE operations ADD COLUMN operation_category_id VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operations' AND column_name='department_id') THEN ALTER TABLE operations ADD COLUMN department_id VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operations' AND column_name='cost_center_id') THEN ALTER TABLE operations ADD COLUMN cost_center_id VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operations' AND column_name='operation_number') THEN ALTER TABLE operations ADD COLUMN operation_number VARCHAR(50) UNIQUE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operations' AND column_name='operation_date') THEN ALTER TABLE operations ADD COLUMN operation_date DATE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operations' AND column_name='date') THEN ALTER TABLE operations ADD COLUMN date DATE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operations' AND column_name='customer_id') THEN ALTER TABLE operations ADD COLUMN customer_id VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operations' AND column_name='customer_name') THEN ALTER TABLE operations ADD COLUMN customer_name VARCHAR(255); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operations' AND column_name='description') THEN ALTER TABLE operations ADD COLUMN description TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operations' AND column_name='status') THEN ALTER TABLE operations ADD COLUMN status VARCHAR(20) DEFAULT 'pending'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operations' AND column_name='updated_at') THEN ALTER TABLE operations ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP; END IF;
END IF;

-- B27. operation_field_values
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operation_field_values') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operation_field_values' AND column_name='company_id') THEN ALTER TABLE operation_field_values ADD COLUMN company_id VARCHAR(36); END IF;
END IF;

-- B28. field_operation_categories – ensure id column exists as PK
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'field_operation_categories') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='field_operation_categories' AND column_name='id') THEN
        ALTER TABLE field_operation_categories DROP CONSTRAINT IF EXISTS field_operation_categories_pkey;
        ALTER TABLE field_operation_categories ADD COLUMN id VARCHAR(36) DEFAULT gen_random_uuid()::text;
        ALTER TABLE field_operation_categories ADD PRIMARY KEY (id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='field_operation_categories' AND column_name='company_id') THEN ALTER TABLE field_operation_categories ADD COLUMN company_id VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='field_operation_categories' AND column_name='created_at') THEN ALTER TABLE field_operation_categories ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP; END IF;
END IF;

-- B29. departments
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'departments') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='departments' AND column_name='code') THEN ALTER TABLE departments ADD COLUMN code VARCHAR(50); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='departments' AND column_name='description') THEN ALTER TABLE departments ADD COLUMN description TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='departments' AND column_name='parent_id') THEN ALTER TABLE departments ADD COLUMN parent_id VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='departments' AND column_name='manager_user_id') THEN ALTER TABLE departments ADD COLUMN manager_user_id VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='departments' AND column_name='is_active') THEN ALTER TABLE departments ADD COLUMN is_active BOOLEAN DEFAULT true; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='departments' AND column_name='created_at') THEN ALTER TABLE departments ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP; END IF;
END IF;

-- B30. cost_centers
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cost_centers') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cost_centers' AND column_name='department_id') THEN ALTER TABLE cost_centers ADD COLUMN department_id VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cost_centers' AND column_name='code') THEN ALTER TABLE cost_centers ADD COLUMN code VARCHAR(50); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cost_centers' AND column_name='description') THEN ALTER TABLE cost_centers ADD COLUMN description TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cost_centers' AND column_name='budget') THEN ALTER TABLE cost_centers ADD COLUMN budget DECIMAL(18,4); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cost_centers' AND column_name='currency') THEN ALTER TABLE cost_centers ADD COLUMN currency VARCHAR(10); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cost_centers' AND column_name='is_active') THEN ALTER TABLE cost_centers ADD COLUMN is_active BOOLEAN DEFAULT true; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cost_centers' AND column_name='created_at') THEN ALTER TABLE cost_centers ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP; END IF;
END IF;

-- B31. currencies (extra columns guard)
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'currencies') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='currencies' AND column_name='symbol') THEN ALTER TABLE currencies ADD COLUMN symbol VARCHAR(10); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='currencies' AND column_name='is_active') THEN ALTER TABLE currencies ADD COLUMN is_active BOOLEAN DEFAULT TRUE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='currencies' AND column_name='created_at') THEN ALTER TABLE currencies ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='currencies' AND column_name='company_id') THEN ALTER TABLE currencies ADD COLUMN company_id VARCHAR(36); END IF;
END IF;

-- B32. exchange_rates (extra columns guard)
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'exchange_rates') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='exchange_rates' AND column_name='notes') THEN ALTER TABLE exchange_rates ADD COLUMN notes TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='exchange_rates' AND column_name='created_by') THEN ALTER TABLE exchange_rates ADD COLUMN created_by VARCHAR(36); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='exchange_rates' AND column_name='created_at') THEN ALTER TABLE exchange_rates ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='exchange_rates' AND column_name='company_id') THEN ALTER TABLE exchange_rates ADD COLUMN company_id VARCHAR(36); END IF;
END IF;

-- ============================================================
-- PHASE C: WRONG COLUMN TYPES (UUID → VARCHAR(36))
--   Strategy: drop all FKs first, convert, then re-add in Phase E
-- ============================================================

-- C1: Drop ALL FK constraints from all affected tables at once.
--     We use a loop so we catch every constraint name regardless of
--     what each individual migration may have called it.

FOR r IN (
    SELECT tc.table_name, tc.constraint_name
    FROM information_schema.table_constraints tc
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name IN (
          'operation_categories', 'operation_fields', 'operations',
          'operation_field_values', 'field_operation_categories',
          'departments', 'cost_centers'
      )
) LOOP
    BEGIN
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I',
                       r.table_name, r.constraint_name);
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Could not drop FK %.%: %', r.table_name, r.constraint_name, SQLERRM;
    END;
END LOOP;

-- C2: Convert UUID columns to VARCHAR(36) only when still uuid type.
--     We check the type before attempting conversion, so re-running is safe.

-- Helper inline macro (repeated pattern):
-- operation_categories
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operation_categories') THEN
    SELECT data_type INTO v_type FROM information_schema.columns WHERE table_name='operation_categories' AND column_name='id';
    IF v_type = 'uuid' THEN ALTER TABLE operation_categories ALTER COLUMN id TYPE VARCHAR(36) USING id::text; END IF;
    SELECT data_type INTO v_type FROM information_schema.columns WHERE table_name='operation_categories' AND column_name='parent_id';
    IF v_type = 'uuid' THEN ALTER TABLE operation_categories ALTER COLUMN parent_id TYPE VARCHAR(36) USING parent_id::text; END IF;
END IF;

-- departments
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'departments') THEN
    SELECT data_type INTO v_type FROM information_schema.columns WHERE table_name='departments' AND column_name='id';
    IF v_type = 'uuid' THEN ALTER TABLE departments ALTER COLUMN id TYPE VARCHAR(36) USING id::text; END IF;
    SELECT data_type INTO v_type FROM information_schema.columns WHERE table_name='departments' AND column_name='parent_id';
    IF v_type = 'uuid' THEN ALTER TABLE departments ALTER COLUMN parent_id TYPE VARCHAR(36) USING parent_id::text; END IF;
END IF;

-- cost_centers
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cost_centers') THEN
    SELECT data_type INTO v_type FROM information_schema.columns WHERE table_name='cost_centers' AND column_name='id';
    IF v_type = 'uuid' THEN ALTER TABLE cost_centers ALTER COLUMN id TYPE VARCHAR(36) USING id::text; END IF;
    SELECT data_type INTO v_type FROM information_schema.columns WHERE table_name='cost_centers' AND column_name='department_id';
    IF v_type = 'uuid' THEN ALTER TABLE cost_centers ALTER COLUMN department_id TYPE VARCHAR(36) USING department_id::text; END IF;
END IF;

-- operation_fields
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operation_fields') THEN
    SELECT data_type INTO v_type FROM information_schema.columns WHERE table_name='operation_fields' AND column_name='id';
    IF v_type = 'uuid' THEN ALTER TABLE operation_fields ALTER COLUMN id TYPE VARCHAR(36) USING id::text; END IF;
    SELECT data_type INTO v_type FROM information_schema.columns WHERE table_name='operation_fields' AND column_name='category_id';
    IF v_type = 'uuid' THEN ALTER TABLE operation_fields ALTER COLUMN category_id TYPE VARCHAR(36) USING category_id::text; END IF;
    SELECT data_type INTO v_type FROM information_schema.columns WHERE table_name='operation_fields' AND column_name='operation_category_id';
    IF v_type = 'uuid' THEN ALTER TABLE operation_fields ALTER COLUMN operation_category_id TYPE VARCHAR(36) USING operation_category_id::text; END IF;
    SELECT data_type INTO v_type FROM information_schema.columns WHERE table_name='operation_fields' AND column_name='department_id';
    IF v_type = 'uuid' THEN ALTER TABLE operation_fields ALTER COLUMN department_id TYPE VARCHAR(36) USING department_id::text; END IF;
END IF;

-- operations
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operations') THEN
    SELECT data_type INTO v_type FROM information_schema.columns WHERE table_name='operations' AND column_name='id';
    IF v_type = 'uuid' THEN ALTER TABLE operations ALTER COLUMN id TYPE VARCHAR(36) USING id::text; END IF;
    SELECT data_type INTO v_type FROM information_schema.columns WHERE table_name='operations' AND column_name='category_id';
    IF v_type = 'uuid' THEN ALTER TABLE operations ALTER COLUMN category_id TYPE VARCHAR(36) USING category_id::text; END IF;
    SELECT data_type INTO v_type FROM information_schema.columns WHERE table_name='operations' AND column_name='operation_category_id';
    IF v_type = 'uuid' THEN ALTER TABLE operations ALTER COLUMN operation_category_id TYPE VARCHAR(36) USING operation_category_id::text; END IF;
    SELECT data_type INTO v_type FROM information_schema.columns WHERE table_name='operations' AND column_name='department_id';
    IF v_type = 'uuid' THEN ALTER TABLE operations ALTER COLUMN department_id TYPE VARCHAR(36) USING department_id::text; END IF;
    SELECT data_type INTO v_type FROM information_schema.columns WHERE table_name='operations' AND column_name='cost_center_id';
    IF v_type = 'uuid' THEN ALTER TABLE operations ALTER COLUMN cost_center_id TYPE VARCHAR(36) USING cost_center_id::text; END IF;
    SELECT data_type INTO v_type FROM information_schema.columns WHERE table_name='operations' AND column_name='customer_id';
    IF v_type = 'uuid' THEN ALTER TABLE operations ALTER COLUMN customer_id TYPE VARCHAR(36) USING customer_id::text; END IF;
END IF;

-- operation_field_values
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operation_field_values') THEN
    SELECT data_type INTO v_type FROM information_schema.columns WHERE table_name='operation_field_values' AND column_name='id';
    IF v_type = 'uuid' THEN ALTER TABLE operation_field_values ALTER COLUMN id TYPE VARCHAR(36) USING id::text; END IF;
    SELECT data_type INTO v_type FROM information_schema.columns WHERE table_name='operation_field_values' AND column_name='operation_id';
    IF v_type = 'uuid' THEN ALTER TABLE operation_field_values ALTER COLUMN operation_id TYPE VARCHAR(36) USING operation_id::text; END IF;
    SELECT data_type INTO v_type FROM information_schema.columns WHERE table_name='operation_field_values' AND column_name='field_id';
    IF v_type = 'uuid' THEN ALTER TABLE operation_field_values ALTER COLUMN field_id TYPE VARCHAR(36) USING field_id::text; END IF;
END IF;

-- field_operation_categories
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'field_operation_categories') THEN
    -- id may need PK drop first
    SELECT data_type INTO v_type FROM information_schema.columns WHERE table_name='field_operation_categories' AND column_name='id';
    IF v_type = 'uuid' THEN
        ALTER TABLE field_operation_categories DROP CONSTRAINT IF EXISTS field_operation_categories_pkey;
        ALTER TABLE field_operation_categories ALTER COLUMN id TYPE VARCHAR(36) USING id::text;
        ALTER TABLE field_operation_categories ADD PRIMARY KEY (id);
    END IF;
    SELECT data_type INTO v_type FROM information_schema.columns WHERE table_name='field_operation_categories' AND column_name='field_id';
    IF v_type = 'uuid' THEN ALTER TABLE field_operation_categories ALTER COLUMN field_id TYPE VARCHAR(36) USING field_id::text; END IF;
    SELECT data_type INTO v_type FROM information_schema.columns WHERE table_name='field_operation_categories' AND column_name='category_id';
    IF v_type = 'uuid' THEN ALTER TABLE field_operation_categories ALTER COLUMN category_id TYPE VARCHAR(36) USING category_id::text; END IF;
END IF;

-- ============================================================
-- PHASE D: ORPHAN DATA CLEANUP
--   NULL or DELETE rows that reference non-existent parents,
--   because PostgreSQL will reject ADD CONSTRAINT on dirty data.
-- ============================================================

-- D1. operations.category_id → operation_categories
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='operations')
AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='operation_categories')
AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operations' AND column_name='category_id')
THEN
    UPDATE operations SET category_id = NULL
    WHERE category_id IS NOT NULL
      AND category_id::text NOT IN (SELECT id::text FROM operation_categories);
END IF;

-- D2. operations.operation_category_id → operation_categories
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='operations')
AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='operation_categories')
AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operations' AND column_name='operation_category_id')
THEN
    UPDATE operations SET operation_category_id = NULL
    WHERE operation_category_id IS NOT NULL
      AND operation_category_id::text NOT IN (SELECT id::text FROM operation_categories);
END IF;

-- D3. operations.department_id → departments
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='operations')
AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='departments')
AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operations' AND column_name='department_id')
THEN
    UPDATE operations SET department_id = NULL
    WHERE department_id IS NOT NULL
      AND department_id::text NOT IN (SELECT id::text FROM departments);
END IF;

-- D4. operations.cost_center_id → cost_centers
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='operations')
AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='cost_centers')
AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operations' AND column_name='cost_center_id')
THEN
    UPDATE operations SET cost_center_id = NULL
    WHERE cost_center_id IS NOT NULL
      AND cost_center_id::text NOT IN (SELECT id::text FROM cost_centers);
END IF;

-- D5. operation_fields.category_id → operation_categories
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='operation_fields')
AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='operation_categories')
AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operation_fields' AND column_name='category_id')
THEN
    UPDATE operation_fields SET category_id = NULL
    WHERE category_id IS NOT NULL
      AND category_id::text NOT IN (SELECT id::text FROM operation_categories);
END IF;

-- D6. operation_fields.operation_category_id → operation_categories
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='operation_fields')
AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='operation_categories')
AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operation_fields' AND column_name='operation_category_id')
THEN
    UPDATE operation_fields SET operation_category_id = NULL
    WHERE operation_category_id IS NOT NULL
      AND operation_category_id::text NOT IN (SELECT id::text FROM operation_categories);
END IF;

-- D7. cost_centers.department_id → departments
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='cost_centers')
AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='departments')
AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cost_centers' AND column_name='department_id')
THEN
    UPDATE cost_centers SET department_id = NULL
    WHERE department_id IS NOT NULL
      AND department_id::text NOT IN (SELECT id::text FROM departments);
END IF;

-- D8. field_operation_categories: delete orphan category refs
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='field_operation_categories')
AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='operation_categories')
AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='field_operation_categories' AND column_name='category_id')
THEN
    DELETE FROM field_operation_categories
    WHERE category_id IS NOT NULL
      AND category_id::text NOT IN (SELECT id::text FROM operation_categories);
END IF;

-- D9. field_operation_categories: delete orphan field refs
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='field_operation_categories')
AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='operation_fields')
AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='field_operation_categories' AND column_name='field_id')
THEN
    DELETE FROM field_operation_categories
    WHERE field_id IS NOT NULL
      AND field_id::text NOT IN (SELECT id::text FROM operation_fields);
END IF;

-- D10. operation_field_values.operation_id → operations
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='operation_field_values')
AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='operations')
THEN
    DELETE FROM operation_field_values
    WHERE operation_id IS NOT NULL
      AND operation_id::text NOT IN (SELECT id::text FROM operations);
END IF;

-- D11. operation_field_values.field_id → operation_fields
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='operation_field_values')
AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='operation_fields')
THEN
    DELETE FROM operation_field_values
    WHERE field_id IS NOT NULL
      AND field_id::text NOT IN (SELECT id::text FROM operation_fields);
END IF;

-- D12. operation_categories.parent_id self-ref
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='operation_categories') THEN
    UPDATE operation_categories SET parent_id = NULL
    WHERE parent_id IS NOT NULL
      AND parent_id::text NOT IN (SELECT id::text FROM operation_categories);
END IF;

-- D13. departments.parent_id self-ref
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='departments') THEN
    UPDATE departments SET parent_id = NULL
    WHERE parent_id IS NOT NULL
      AND parent_id::text NOT IN (SELECT id::text FROM departments);
END IF;

-- ============================================================
-- PHASE E: FOREIGN KEY RECONCILIATION
--   Add each FK only when: both tables exist, both columns exist,
--   the constraint does not already exist, and data is clean.
-- ============================================================

-- E1. operation_categories.parent_id (self)
IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
               WHERE constraint_name='operation_categories_parent_id_fkey' AND table_name='operation_categories')
THEN
    ALTER TABLE operation_categories
        ADD CONSTRAINT operation_categories_parent_id_fkey
        FOREIGN KEY (parent_id) REFERENCES operation_categories(id) ON DELETE SET NULL;
END IF;

-- E2. departments.parent_id (self)
IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
               WHERE constraint_name='departments_parent_id_fkey' AND table_name='departments')
THEN
    ALTER TABLE departments
        ADD CONSTRAINT departments_parent_id_fkey
        FOREIGN KEY (parent_id) REFERENCES departments(id) ON DELETE SET NULL;
END IF;

-- E3. cost_centers.department_id → departments
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cost_centers' AND column_name='department_id')
AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name='cost_centers_department_id_fkey' AND table_name='cost_centers')
THEN
    ALTER TABLE cost_centers
        ADD CONSTRAINT cost_centers_department_id_fkey
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;
END IF;

-- E4. operation_fields.category_id → operation_categories
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operation_fields' AND column_name='category_id')
AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name='operation_fields_category_id_fkey' AND table_name='operation_fields')
THEN
    ALTER TABLE operation_fields
        ADD CONSTRAINT operation_fields_category_id_fkey
        FOREIGN KEY (category_id) REFERENCES operation_categories(id) ON DELETE SET NULL;
END IF;

-- E5. operations.category_id → operation_categories
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operations' AND column_name='category_id')
AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name='operations_category_id_fkey' AND table_name='operations')
THEN
    ALTER TABLE operations
        ADD CONSTRAINT operations_category_id_fkey
        FOREIGN KEY (category_id) REFERENCES operation_categories(id) ON DELETE SET NULL;
END IF;

-- E6. operations.department_id → departments
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operations' AND column_name='department_id')
AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name='operations_department_id_fkey' AND table_name='operations')
THEN
    ALTER TABLE operations
        ADD CONSTRAINT operations_department_id_fkey
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;
END IF;

-- E7. operations.cost_center_id → cost_centers
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='operations' AND column_name='cost_center_id')
AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name='operations_cost_center_id_fkey' AND table_name='operations')
THEN
    ALTER TABLE operations
        ADD CONSTRAINT operations_cost_center_id_fkey
        FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id) ON DELETE SET NULL;
END IF;

-- E8. operation_field_values.operation_id → operations
IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
               WHERE constraint_name='operation_field_values_operation_id_fkey' AND table_name='operation_field_values')
THEN
    ALTER TABLE operation_field_values
        ADD CONSTRAINT operation_field_values_operation_id_fkey
        FOREIGN KEY (operation_id) REFERENCES operations(id) ON DELETE CASCADE;
END IF;

-- E9. operation_field_values.field_id → operation_fields
IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
               WHERE constraint_name='operation_field_values_field_id_fkey' AND table_name='operation_field_values')
THEN
    ALTER TABLE operation_field_values
        ADD CONSTRAINT operation_field_values_field_id_fkey
        FOREIGN KEY (field_id) REFERENCES operation_fields(id) ON DELETE CASCADE;
END IF;

-- E10. field_operation_categories.field_id → operation_fields
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='field_operation_categories' AND column_name='field_id')
AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name='field_operation_categories_field_id_fkey' AND table_name='field_operation_categories')
THEN
    ALTER TABLE field_operation_categories
        ADD CONSTRAINT field_operation_categories_field_id_fkey
        FOREIGN KEY (field_id) REFERENCES operation_fields(id) ON DELETE CASCADE;
END IF;

-- E11. field_operation_categories.category_id → operation_categories
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='field_operation_categories' AND column_name='category_id')
AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name='field_operation_categories_category_id_fkey' AND table_name='field_operation_categories')
THEN
    ALTER TABLE field_operation_categories
        ADD CONSTRAINT field_operation_categories_category_id_fkey
        FOREIGN KEY (category_id) REFERENCES operation_categories(id) ON DELETE CASCADE;
END IF;

-- ============================================================
-- PHASE F: MISSING INDEXES
-- ============================================================

-- Core lookup indexes
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_users_email')              THEN CREATE INDEX idx_users_email ON users(email); END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_users_company_id')         THEN CREATE INDEX idx_users_company_id ON users(company_id); END IF;

-- audit_logs
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='company_id') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_audit_logs_company_id') THEN CREATE INDEX idx_audit_logs_company_id ON audit_logs(company_id); END IF;
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='module') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_audit_logs_module') THEN CREATE INDEX idx_audit_logs_module ON audit_logs(module); END IF;
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_audit_logs_action')        THEN CREATE INDEX idx_audit_logs_action ON audit_logs(action); END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_audit_logs_created_at')    THEN CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC); END IF;

-- activity_logs
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activity_logs' AND column_name='created_at') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_activity_logs_company_at') THEN CREATE INDEX idx_activity_logs_company_at ON activity_logs(company_id, created_at DESC); END IF;
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_activity_logs_user_id')    THEN CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id); END IF;

-- journal_entries
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_journal_entries_company_date') THEN CREATE INDEX idx_journal_entries_company_date ON journal_entries(company_id, date DESC); END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_journal_entries_date')     THEN CREATE INDEX idx_journal_entries_date ON journal_entries(company_id, date DESC); END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_journal_entry_lines_account_id') THEN CREATE INDEX idx_journal_entry_lines_account_id ON journal_entry_lines(account_id); END IF;

-- invoices / purchase_invoices
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_invoices_company_date')    THEN CREATE INDEX idx_invoices_company_date ON invoices(company_id, date DESC); END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_invoices_date')            THEN CREATE INDEX idx_invoices_date ON invoices(company_id, date DESC); END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_purchase_invoices_company_date') THEN CREATE INDEX idx_purchase_invoices_company_date ON purchase_invoices(company_id, date DESC); END IF;

-- returns
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_returns_company_date')     THEN CREATE INDEX idx_returns_company_date ON returns(company_id, date DESC); END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_purchase_returns_company_date') THEN CREATE INDEX idx_purchase_returns_company_date ON purchase_returns(company_id, date DESC); END IF;

-- vouchers
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_receipt_vouchers_company_date')  THEN CREATE INDEX idx_receipt_vouchers_company_date ON receipt_vouchers(company_id, date DESC); END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_payment_vouchers_company_date')  THEN CREATE INDEX idx_payment_vouchers_company_date ON payment_vouchers(company_id, date DESC); END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_cash_transfers_company_date')    THEN CREATE INDEX idx_cash_transfers_company_date ON cash_transfers(company_id, date DESC); END IF;

-- accounts
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_accounts_code')            THEN CREATE INDEX idx_accounts_code ON accounts(company_id, code); END IF;

-- operations module
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_op_categories_parent')     THEN CREATE INDEX idx_op_categories_parent ON operation_categories(parent_id); END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_op_categories_code')       THEN CREATE INDEX idx_op_categories_code ON operation_categories(code); END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_op_categories_company')    THEN CREATE INDEX idx_op_categories_company ON operation_categories(company_id); END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_operations_company')       THEN CREATE INDEX idx_operations_company ON operations(company_id); END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_operations_category')      THEN CREATE INDEX idx_operations_category ON operations(category_id); END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_field_op_cats_field')      THEN CREATE INDEX idx_field_op_cats_field ON field_operation_categories(field_id); END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_field_op_cats_cat')        THEN CREATE INDEX idx_field_op_cats_cat ON field_operation_categories(category_id); END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_field_op_cats_company')    THEN CREATE INDEX idx_field_op_cats_company ON field_operation_categories(company_id); END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_op_field_values_op')       THEN CREATE INDEX idx_op_field_values_op ON operation_field_values(operation_id); END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_op_field_values_field')    THEN CREATE INDEX idx_op_field_values_field ON operation_field_values(field_id); END IF;

-- payment_type (needed by migration-runner.ts programmatic loop)
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='payment_type') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_invoices_payment_type') THEN CREATE INDEX idx_invoices_payment_type ON invoices(payment_type); END IF;
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='returns' AND column_name='payment_type') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_returns_payment_type') THEN CREATE INDEX idx_returns_payment_type ON returns(payment_type); END IF;
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_invoices' AND column_name='payment_type') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_purchase_invoices_payment_type') THEN CREATE INDEX idx_purchase_invoices_payment_type ON purchase_invoices(payment_type); END IF;
END IF;
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_returns' AND column_name='payment_type') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_purchase_returns_payment_type') THEN CREATE INDEX idx_purchase_returns_payment_type ON purchase_returns(payment_type); END IF;
END IF;

-- currencies / exchange_rates
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_currencies_company_id')          THEN CREATE INDEX idx_currencies_company_id ON currencies(company_id); END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_exchange_rates_currency_id')     THEN CREATE INDEX idx_exchange_rates_currency_id ON exchange_rates(currency_id); END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_exchange_rates_company_id')      THEN CREATE INDEX idx_exchange_rates_company_id ON exchange_rates(company_id); END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_exchange_rates_date')            THEN CREATE INDEX idx_exchange_rates_date ON exchange_rates(rate_date DESC); END IF;

-- ============================================================
-- PHASE G: SCHEMA VERSION STAMP
-- ============================================================

INSERT INTO _system_settings (key, value)
VALUES ('schema_version', '{"version": "2.1.0", "reconciled_at": "2026-06-03"}'::jsonb)
ON CONFLICT (key) DO UPDATE
    SET value      = EXCLUDED.value,
        updated_at = CURRENT_TIMESTAMP;

END $$;
