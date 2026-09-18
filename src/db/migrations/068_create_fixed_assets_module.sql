-- Migration 068: Create Complete Fixed Assets Module
-- Tables: asset_categories, fixed_assets, asset_components, asset_depreciation_runs,
-- asset_depreciation_items, asset_transfers, asset_maintenance, asset_revaluations, asset_disposals

-- 1. Asset Categories
CREATE TABLE IF NOT EXISTS "asset_categories" (
  "id" VARCHAR(36) PRIMARY KEY,
  "company_id" VARCHAR(36) NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "parent_id" VARCHAR(36) REFERENCES "asset_categories"("id") ON DELETE SET NULL,
  "code" VARCHAR(50) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "name_en" VARCHAR(255),
  "description" TEXT,
  "asset_account_id" VARCHAR(36) REFERENCES "accounts"("id") ON DELETE SET NULL,
  "accumulated_depreciation_account_id" VARCHAR(36) REFERENCES "accounts"("id") ON DELETE SET NULL,
  "depreciation_expense_account_id" VARCHAR(36) REFERENCES "accounts"("id") ON DELETE SET NULL,
  "gain_account_id" VARCHAR(36) REFERENCES "accounts"("id") ON DELETE SET NULL,
  "loss_account_id" VARCHAR(36) REFERENCES "accounts"("id") ON DELETE SET NULL,
  "default_depreciation_method" VARCHAR(50) DEFAULT 'STRAIGHT_LINE',
  "default_useful_life" NUMERIC(10, 2) DEFAULT 5.0,
  "default_salvage_value" NUMERIC(15, 4) DEFAULT 0.0,
  "is_active" BOOLEAN DEFAULT TRUE,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_asset_categories_company" ON "asset_categories"("company_id");
CREATE INDEX IF NOT EXISTS "idx_asset_categories_parent" ON "asset_categories"("parent_id");

-- 2. Fixed Assets Register
CREATE TABLE IF NOT EXISTS "fixed_assets" (
  "id" VARCHAR(36) PRIMARY KEY,
  "company_id" VARCHAR(36) NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "asset_number" VARCHAR(100) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "name_ar" VARCHAR(255),
  "name_en" VARCHAR(255),
  "category_id" VARCHAR(36) REFERENCES "asset_categories"("id") ON DELETE SET NULL,
  "description" TEXT,
  "serial_number" VARCHAR(100),
  "barcode" VARCHAR(100),
  "manufacturer" VARCHAR(150),
  "model" VARCHAR(150),
  
  -- Financial & Depreciation parameters
  "acquisition_date" DATE NOT NULL,
  "capitalization_date" DATE,
  "depreciation_start_date" DATE,
  "last_depreciation_date" DATE,
  
  "acquisition_cost" NUMERIC(15, 4) NOT NULL DEFAULT 0.0,
  "additional_cost" NUMERIC(15, 4) NOT NULL DEFAULT 0.0,
  "capitalized_cost" NUMERIC(15, 4) NOT NULL DEFAULT 0.0,
  "salvage_value" NUMERIC(15, 4) NOT NULL DEFAULT 0.0,
  
  "useful_life" NUMERIC(10, 2) NOT NULL DEFAULT 5.0,
  "useful_life_unit" VARCHAR(20) DEFAULT 'YEARS',
  "depreciation_method" VARCHAR(50) NOT NULL DEFAULT 'STRAIGHT_LINE',
  
  "accumulated_depreciation" NUMERIC(15, 4) NOT NULL DEFAULT 0.0,
  "net_book_value" NUMERIC(15, 4) NOT NULL DEFAULT 0.0,
  
  -- Organizational Structure & Custody
  "warehouse_id" VARCHAR(36) REFERENCES "warehouses"("id") ON DELETE SET NULL,
  "department_id" VARCHAR(36) REFERENCES "departments"("id") ON DELETE SET NULL,
  "cost_center_id" VARCHAR(36) REFERENCES "cost_centers"("id") ON DELETE SET NULL,
  "location_name" VARCHAR(255),
  "custodian_id" VARCHAR(36) REFERENCES "employees"("id") ON DELETE SET NULL,
  "custodian_name" VARCHAR(255),
  "custody_date" DATE,
  
  -- Supplier & Purchase linking
  "supplier_id" VARCHAR(36) REFERENCES "suppliers"("id") ON DELETE SET NULL,
  "purchase_invoice_id" VARCHAR(36) REFERENCES "purchase_invoices"("id") ON DELETE SET NULL,
  "purchase_order_number" VARCHAR(100),
  "invoice_date" DATE,
  
  -- Financial GL Accounts
  "asset_account_id" VARCHAR(36) REFERENCES "accounts"("id") ON DELETE SET NULL,
  "accumulated_depreciation_account_id" VARCHAR(36) REFERENCES "accounts"("id") ON DELETE SET NULL,
  "depreciation_expense_account_id" VARCHAR(36) REFERENCES "accounts"("id") ON DELETE SET NULL,
  "gain_account_id" VARCHAR(36) REFERENCES "accounts"("id") ON DELETE SET NULL,
  "loss_account_id" VARCHAR(36) REFERENCES "accounts"("id") ON DELETE SET NULL,
  
  "status" VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  "capitalization_journal_entry_id" VARCHAR(36) REFERENCES "journal_entries"("id") ON DELETE SET NULL,
  "disposal_journal_entry_id" VARCHAR(36) REFERENCES "journal_entries"("id") ON DELETE SET NULL,
  "attachments" JSONB DEFAULT '[]'::jsonb,
  "created_by" VARCHAR(36),
  "updated_by" VARCHAR(36),
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "uq_fixed_assets_company_asset_number" UNIQUE ("company_id", "asset_number")
);

CREATE INDEX IF NOT EXISTS "idx_fixed_assets_company_status" ON "fixed_assets"("company_id", "status");
CREATE INDEX IF NOT EXISTS "idx_fixed_assets_category" ON "fixed_assets"("company_id", "category_id");
CREATE INDEX IF NOT EXISTS "idx_fixed_assets_custodian" ON "fixed_assets"("company_id", "custodian_id");
CREATE INDEX IF NOT EXISTS "idx_fixed_assets_department" ON "fixed_assets"("company_id", "department_id");
CREATE INDEX IF NOT EXISTS "idx_fixed_assets_cost_center" ON "fixed_assets"("company_id", "cost_center_id");
CREATE INDEX IF NOT EXISTS "idx_fixed_assets_warehouse" ON "fixed_assets"("company_id", "warehouse_id");
CREATE INDEX IF NOT EXISTS "idx_fixed_assets_asset_number" ON "fixed_assets"("company_id", "asset_number");

-- 3. Asset Components
CREATE TABLE IF NOT EXISTS "asset_components" (
  "id" VARCHAR(36) PRIMARY KEY,
  "asset_id" VARCHAR(36) NOT NULL REFERENCES "fixed_assets"("id") ON DELETE CASCADE,
  "name" VARCHAR(255) NOT NULL,
  "serial_number" VARCHAR(100),
  "cost" NUMERIC(15, 4) NOT NULL DEFAULT 0.0,
  "useful_life" NUMERIC(10, 2),
  "depreciation_method" VARCHAR(50),
  "depreciation_start_date" DATE,
  "status" VARCHAR(50) DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_asset_components_asset_id" ON "asset_components"("asset_id");

-- 4. Asset Depreciation Runs
CREATE TABLE IF NOT EXISTS "asset_depreciation_runs" (
  "id" VARCHAR(36) PRIMARY KEY,
  "company_id" VARCHAR(36) NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "run_number" VARCHAR(100) NOT NULL,
  "period_name" VARCHAR(100) NOT NULL,
  "from_date" DATE NOT NULL,
  "to_date" DATE NOT NULL,
  "total_assets" INTEGER DEFAULT 0,
  "total_depreciation" NUMERIC(15, 4) DEFAULT 0.0,
  "status" VARCHAR(50) DEFAULT 'DRAFT',
  "journal_entry_id" VARCHAR(36) REFERENCES "journal_entries"("id") ON DELETE SET NULL,
  "notes" TEXT,
  "created_by" VARCHAR(36),
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_asset_depr_runs_company" ON "asset_depreciation_runs"("company_id", "from_date", "to_date");

-- 5. Asset Depreciation Items (Details)
CREATE TABLE IF NOT EXISTS "asset_depreciation_items" (
  "id" VARCHAR(36) PRIMARY KEY,
  "run_id" VARCHAR(36) NOT NULL REFERENCES "asset_depreciation_runs"("id") ON DELETE CASCADE,
  "asset_id" VARCHAR(36) NOT NULL REFERENCES "fixed_assets"("id") ON DELETE RESTRICT,
  "opening_nbv" NUMERIC(15, 4) NOT NULL,
  "depreciation_amount" NUMERIC(15, 4) NOT NULL,
  "accumulated_depreciation" NUMERIC(15, 4) NOT NULL,
  "closing_nbv" NUMERIC(15, 4) NOT NULL,
  "journal_entry_id" VARCHAR(36) REFERENCES "journal_entries"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_asset_depr_items_run" ON "asset_depreciation_items"("run_id");
CREATE INDEX IF NOT EXISTS "idx_asset_depr_items_asset" ON "asset_depreciation_items"("asset_id");

-- 6. Asset Transfers (Movement & Custody history)
CREATE TABLE IF NOT EXISTS "asset_transfers" (
  "id" VARCHAR(36) PRIMARY KEY,
  "company_id" VARCHAR(36) NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "asset_id" VARCHAR(36) NOT NULL REFERENCES "fixed_assets"("id") ON DELETE RESTRICT,
  "transfer_date" DATE NOT NULL,
  "from_warehouse_id" VARCHAR(36) REFERENCES "warehouses"("id") ON DELETE SET NULL,
  "to_warehouse_id" VARCHAR(36) REFERENCES "warehouses"("id") ON DELETE SET NULL,
  "from_department_id" VARCHAR(36) REFERENCES "departments"("id") ON DELETE SET NULL,
  "to_department_id" VARCHAR(36) REFERENCES "departments"("id") ON DELETE SET NULL,
  "from_cost_center_id" VARCHAR(36) REFERENCES "cost_centers"("id") ON DELETE SET NULL,
  "to_cost_center_id" VARCHAR(36) REFERENCES "cost_centers"("id") ON DELETE SET NULL,
  "from_custodian_id" VARCHAR(36) REFERENCES "employees"("id") ON DELETE SET NULL,
  "to_custodian_id" VARCHAR(36) REFERENCES "employees"("id") ON DELETE SET NULL,
  "from_location" VARCHAR(255),
  "to_location" VARCHAR(255),
  "reason" TEXT,
  "notes" TEXT,
  "created_by" VARCHAR(36),
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_asset_transfers_asset" ON "asset_transfers"("asset_id");
CREATE INDEX IF NOT EXISTS "idx_asset_transfers_company" ON "asset_transfers"("company_id");

-- 7. Asset Maintenance
CREATE TABLE IF NOT EXISTS "asset_maintenance" (
  "id" VARCHAR(36) PRIMARY KEY,
  "company_id" VARCHAR(36) NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "asset_id" VARCHAR(36) NOT NULL REFERENCES "fixed_assets"("id") ON DELETE RESTRICT,
  "maintenance_date" DATE NOT NULL,
  "maintenance_type" VARCHAR(100) NOT NULL,
  "supplier_id" VARCHAR(36) REFERENCES "suppliers"("id") ON DELETE SET NULL,
  "cost" NUMERIC(15, 4) NOT NULL DEFAULT 0.0,
  "description" TEXT,
  "invoice_number" VARCHAR(100),
  "next_maintenance_date" DATE,
  "is_capitalized" BOOLEAN DEFAULT FALSE,
  "journal_entry_id" VARCHAR(36) REFERENCES "journal_entries"("id") ON DELETE SET NULL,
  "created_by" VARCHAR(36),
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_asset_maintenance_asset" ON "asset_maintenance"("asset_id");
CREATE INDEX IF NOT EXISTS "idx_asset_maintenance_company" ON "asset_maintenance"("company_id");

-- 8. Asset Revaluations
CREATE TABLE IF NOT EXISTS "asset_revaluations" (
  "id" VARCHAR(36) PRIMARY KEY,
  "company_id" VARCHAR(36) NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "asset_id" VARCHAR(36) NOT NULL REFERENCES "fixed_assets"("id") ON DELETE RESTRICT,
  "revaluation_date" DATE NOT NULL,
  "old_value" NUMERIC(15, 4) NOT NULL,
  "new_value" NUMERIC(15, 4) NOT NULL,
  "difference" NUMERIC(15, 4) NOT NULL,
  "reason" TEXT,
  "journal_entry_id" VARCHAR(36) REFERENCES "journal_entries"("id") ON DELETE SET NULL,
  "status" VARCHAR(50) DEFAULT 'APPROVED',
  "created_by" VARCHAR(36),
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_asset_revaluations_asset" ON "asset_revaluations"("asset_id");
CREATE INDEX IF NOT EXISTS "idx_asset_revaluations_company" ON "asset_revaluations"("company_id");

-- 9. Asset Disposals & Sales
CREATE TABLE IF NOT EXISTS "asset_disposals" (
  "id" VARCHAR(36) PRIMARY KEY,
  "company_id" VARCHAR(36) NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "asset_id" VARCHAR(36) NOT NULL REFERENCES "fixed_assets"("id") ON DELETE RESTRICT,
  "disposal_date" DATE NOT NULL,
  "disposal_type" VARCHAR(50) NOT NULL,
  "original_cost" NUMERIC(15, 4) NOT NULL,
  "accumulated_depreciation" NUMERIC(15, 4) NOT NULL,
  "net_book_value" NUMERIC(15, 4) NOT NULL,
  "disposal_proceeds" NUMERIC(15, 4) NOT NULL DEFAULT 0.0,
  "gain_loss_amount" NUMERIC(15, 4) NOT NULL DEFAULT 0.0,
  "buyer_name" VARCHAR(255),
  "customer_id" VARCHAR(36) REFERENCES "customers"("id") ON DELETE SET NULL,
  "payment_account_id" VARCHAR(36) REFERENCES "accounts"("id") ON DELETE SET NULL,
  "invoice_number" VARCHAR(100),
  "journal_entry_id" VARCHAR(36) REFERENCES "journal_entries"("id") ON DELETE SET NULL,
  "notes" TEXT,
  "created_by" VARCHAR(36),
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_asset_disposals_asset" ON "asset_disposals"("asset_id");
CREATE INDEX IF NOT EXISTS "idx_asset_disposals_company" ON "asset_disposals"("company_id");
