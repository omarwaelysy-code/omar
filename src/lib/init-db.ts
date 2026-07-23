import pool from './postgres';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

/**
 * ERP V2 Database Initialization (Strict Dependency Ordered)
 * This script is designed to be idempotent and migration-safe.
 */
export async function initDatabase() {

  let client;
  let retries = 5;
  let delay = 2000;

  while (retries > 0) {
    try {
      client = await pool.connect();

      break;
    } catch (err: any) {
      retries--;
      console.error(`⚠️ PostgreSQL Connection Failed (Retries: ${retries}):`, err.message);
      if (retries === 0) throw err;
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 1.5;
    }
  }
  
  if (!client) return;

  try {
    // 0. Preliminary - Non-transactional
    await client.query(`
      CREATE TABLE IF NOT EXISTS "migrations" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR(255) UNIQUE NOT NULL,
        "run_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Helper to check if a column exists
    const checkColumnExists = async (tableName: string, columnName: string) => {
      try {
        const { rows } = await client.query(`
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = $1 AND column_name = $2
        `, [tableName, columnName]);
        return rows.length > 0;
      } catch (e) {
        return false;
      }
    };

    // Safe execution helper
    const safeQuery = async (query: string, description: string) => {
      try {
        await client.query(query);
      } catch (err: any) {
        console.warn(`  ⚠️ [Skipped] ${description}: ${err.message}`);
      }
    };

    // 1. Core Tables Initialization

    // Phase 1: Identity
    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "companies" (
        "id" VARCHAR(36) PRIMARY KEY,
        "name" VARCHAR(255) NOT NULL,
        "code" VARCHAR(50) UNIQUE NOT NULL,
        "tax_number" VARCHAR(50),
        "commercial_register" VARCHAR(50),
        "address" TEXT,
        "phone" VARCHAR(20),
        "email" VARCHAR(100),
        "logo_url" TEXT,
        "website" VARCHAR(255),
        "subscription_status" VARCHAR(20) DEFAULT 'trial',
        "subscription_plan" VARCHAR(20) DEFAULT 'basic',
        "subscription_expiry" TIMESTAMP,
        "subscription_days" INTEGER DEFAULT 30,
        "users_limit" INTEGER DEFAULT 5,
        "transactions_limit" INTEGER DEFAULT 1000,
        "company_status" VARCHAR(20) DEFAULT 'active',
        "features" JSONB DEFAULT '[]',
        "settings" JSONB DEFAULT '{}',
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'companies table');

    // Document Sequences Table - Atomic counter per company+module+period
    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "document_sequences" (
        "id" VARCHAR(100) PRIMARY KEY,
        "company_id" VARCHAR(36) NOT NULL,
        "module" VARCHAR(50) NOT NULL,
        "period" VARCHAR(20) NOT NULL,
        "last_seq" INTEGER NOT NULL DEFAULT 0,
        "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE("company_id", "module", "period")
      );
    `, 'document_sequences table');

    await safeQuery(`
      CREATE INDEX IF NOT EXISTS "idx_doc_seq_lookup" ON "document_sequences"("company_id", "module", "period");
    `, 'document_sequences index');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "roles" (
        "id" VARCHAR(36) PRIMARY KEY,
        "name" VARCHAR(50) NOT NULL,
        "description" TEXT
      );
    `, 'roles table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" VARCHAR(36) PRIMARY KEY,
        "username" VARCHAR(100) NOT NULL,
        "name" VARCHAR(255),
        "email" VARCHAR(100) UNIQUE NOT NULL,
        "password_hash" VARCHAR(255) NOT NULL,
        "mobile" VARCHAR(20),
        "role" VARCHAR(20) DEFAULT 'user',
        "company_id" VARCHAR(36) REFERENCES "companies"("id"),
        "status" VARCHAR(20) DEFAULT 'active',
        "temp_password" VARCHAR(255),
        "permissions" JSONB DEFAULT '{}',
        "must_change_password" BOOLEAN DEFAULT FALSE,
        "active_session_token" TEXT,
        "last_active_at" TIMESTAMP,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'users table');

    await safeQuery('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "active_session_token" TEXT;', 'active_session_token col');
    await safeQuery('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_active_at" TIMESTAMP;', 'last_active_at col');
    await safeQuery("UPDATE accounts SET account_usage = NULL WHERE account_usage = 'other';", 'clean legacy other usage');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "system_config" (
        "id" VARCHAR(50) PRIMARY KEY,
        "maintenance_mode" BOOLEAN DEFAULT FALSE,
        "maintenance_message" TEXT,
        "allowed_users" JSONB DEFAULT '[]',
        "min_client_version" VARCHAR(20) DEFAULT '2.0.0',
        "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updated_by" VARCHAR(36)
      );
    `, 'system_config table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" VARCHAR(36) PRIMARY KEY,
        "company_id" VARCHAR(36),
        "user_id" VARCHAR(36),
        "username" VARCHAR(255),
        "user_email" VARCHAR(255),
        "action" VARCHAR(100) NOT NULL,
        "module" VARCHAR(100),
        "details" TEXT,
        "entity_type" VARCHAR(100),
        "entity_id" VARCHAR(100),
        "ip_address" VARCHAR(45),
        "metadata" JSONB DEFAULT '{}',
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "browser" VARCHAR(255),
        "operating_system" VARCHAR(255),
        "device" VARCHAR(255),
        "branch" VARCHAR(255),
        "record_name" VARCHAR(255),
        "record_id" VARCHAR(255),
        "old_values" JSONB DEFAULT '{}',
        "new_values" JSONB DEFAULT '{}',
        "success" BOOLEAN DEFAULT TRUE,
        "execution_time" INTEGER DEFAULT 0
      );
    `, 'audit_logs table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "period_closings" (
        "id" VARCHAR(36) PRIMARY KEY,
        "company_id" VARCHAR(36) NOT NULL,
        "module_name" VARCHAR(100) NOT NULL,
        "closing_date" DATE NOT NULL,
        "password_hash" VARCHAR(255) NOT NULL,
        "is_closed" BOOLEAN DEFAULT TRUE,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "unique_company_module" UNIQUE("company_id", "module_name")
      );
    `, 'period_closings table');

    // Phase 2: Accounts
    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "account_types" (
        "id" VARCHAR(36) PRIMARY KEY,
        "company_id" VARCHAR(36) REFERENCES "companies"("id"),
        "code" VARCHAR(20) NOT NULL,
        "name" VARCHAR(100) NOT NULL,
        "statement_type" VARCHAR(50) NOT NULL,
        "classification" VARCHAR(50) NOT NULL,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'account_types table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "accounts" (
        "id" VARCHAR(36) PRIMARY KEY,
        "company_id" VARCHAR(36) REFERENCES "companies"("id"),
        "type_id" VARCHAR(36) REFERENCES "account_types"("id"),
        "parent_id" VARCHAR(36) REFERENCES "accounts"("id"),
        "code" VARCHAR(20) NOT NULL,
        "name" VARCHAR(200) NOT NULL,
        "opening_balance" DECIMAL(18, 4) DEFAULT 0,
        "required_sub_account" BOOLEAN DEFAULT FALSE,
        "is_active" BOOLEAN DEFAULT TRUE,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'accounts table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "activity_logs" (
        "id" BIGSERIAL PRIMARY KEY,
        "company_id" VARCHAR(36),
        "user_id" VARCHAR(36),
        "username" VARCHAR(100),
        "action" VARCHAR(100) NOT NULL,
        "details" TEXT,
        "ip_address" VARCHAR(45),
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "entity" JSONB,
        "account_id" VARCHAR(36),
        "document_id" VARCHAR(36),
        "changes" JSONB
      );
    `, 'activity_logs table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "currencies" (
        "id" VARCHAR(36) PRIMARY KEY,
        "company_id" VARCHAR(36) REFERENCES "companies"("id"),
        "code" VARCHAR(10) NOT NULL,
        "name_ar" VARCHAR(100) NOT NULL,
        "name_en" VARCHAR(100) NOT NULL,
        "symbol" VARCHAR(10),
        "is_active" BOOLEAN DEFAULT TRUE,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'currencies table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "exchange_rates" (
        "id" VARCHAR(36) PRIMARY KEY,
        "company_id" VARCHAR(36) REFERENCES "companies"("id"),
        "currency_id" VARCHAR(36) REFERENCES "currencies"("id") ON DELETE CASCADE,
        "exchange_rate" DECIMAL(18, 6) NOT NULL,
        "rate_date" DATE NOT NULL,
        "notes" TEXT,
        "created_by" VARCHAR(36),
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'exchange_rates table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "currency_rates" (
        "id" VARCHAR(36) PRIMARY KEY,
        "currency_id" VARCHAR(36) REFERENCES "currencies"("id") ON DELETE CASCADE,
        "rate" DECIMAL(18, 6) NOT NULL,
        "rate_date" DATE NOT NULL,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'currency_rates table');

    // Phase 3: Masters
    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "warehouses" (
        "id" VARCHAR(36) PRIMARY KEY,
        "company_id" VARCHAR(36) REFERENCES "companies"("id") ON DELETE CASCADE,
        "code" VARCHAR(50) NOT NULL,
        "name" VARCHAR(255) NOT NULL,
        "description" TEXT,
        "address" TEXT,
        "phone" VARCHAR(50),
        "storekeeper" VARCHAR(100),
        "storekeeper_phone" VARCHAR(50),
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'warehouses table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "expense_categories" (
        "id" VARCHAR(36) PRIMARY KEY,
        "company_id" VARCHAR(36) REFERENCES "companies"("id"),
        "account_id" VARCHAR(36),
        "code" VARCHAR(20) NOT NULL,
        "name" VARCHAR(100) NOT NULL,
        "description" TEXT,
        "account_name" VARCHAR(255),
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'expense_categories table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "customers" (
        "id" VARCHAR(36) PRIMARY KEY,
        "company_id" VARCHAR(36) REFERENCES "companies"("id"),
        "account_id" VARCHAR(36),
        "code" VARCHAR(50),
        "name" VARCHAR(255) NOT NULL,
        "email" VARCHAR(100),
        "mobile" VARCHAR(20),
        "address" TEXT,
        "tax_number" VARCHAR(50),
        "opening_balance" DECIMAL(18, 4) DEFAULT 0,
        "opening_balance_date" DATE,
        "counter_account_id" VARCHAR(36),
        "account_name" VARCHAR(255),
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'customers table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "suppliers" (
        "id" VARCHAR(36) PRIMARY KEY,
        "company_id" VARCHAR(36) REFERENCES "companies"("id"),
        "account_id" VARCHAR(36),
        "name" VARCHAR(255) NOT NULL,
        "code" VARCHAR(50),
        "email" VARCHAR(100),
        "mobile" VARCHAR(20),
        "address" TEXT,
        "tax_number" VARCHAR(50),
        "opening_balance" DECIMAL(18, 4) DEFAULT 0,
        "opening_balance_date" DATE,
        "counter_account_id" VARCHAR(36),
        "account_name" VARCHAR(255),
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'suppliers table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "payment_methods" (
        "id" VARCHAR(36) PRIMARY KEY,
        "company_id" VARCHAR(36) REFERENCES "companies"("id"),
        "account_id" VARCHAR(36),
        "name" VARCHAR(100) NOT NULL,
        "code" VARCHAR(50),
        "type" VARCHAR(20) DEFAULT 'cash',
        "opening_balance" DECIMAL(18, 4) DEFAULT 0,
        "opening_balance_date" DATE,
        "counter_account_id" VARCHAR(36),
        "account_name" VARCHAR(255),
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'payment_methods table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "products" (
        "id" VARCHAR(36) PRIMARY KEY,
        "company_id" VARCHAR(36) REFERENCES "companies"("id"),
        "revenue_account_id" VARCHAR(36),
        "cost_account_id" VARCHAR(36),
        "name" VARCHAR(255) NOT NULL,
        "code" VARCHAR(100),
        "barcode" VARCHAR(100),
        "type" VARCHAR(50) DEFAULT 'product',
        "description" TEXT,
        "image_url" TEXT,
        "category" VARCHAR(100),
        "unit" VARCHAR(50),
        "cost_price" DECIMAL(18, 4) DEFAULT 0,
        "sale_price" DECIMAL(18, 4) DEFAULT 0,
        "stock" DECIMAL(18, 4) DEFAULT 0,
        "min_stock" DECIMAL(18, 4) DEFAULT 0,
        "current_stock" DECIMAL(18, 4) DEFAULT 0,
        "is_service" BOOLEAN DEFAULT FALSE,
        "counter_account_id" VARCHAR(36),
        "revenue_account_name" VARCHAR(255),
        "cost_account_name" VARCHAR(255),
        "item_group_id" VARCHAR(36),
        "item_group_name" VARCHAR(255),
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'products table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "item_groups" (
        "id" VARCHAR(36) PRIMARY KEY,
        "company_id" VARCHAR(36) REFERENCES "companies"("id"),
        "name" VARCHAR(255) NOT NULL,
        "code" VARCHAR(100) NOT NULL,
        "type" VARCHAR(100) NOT NULL,
        "sequence_number" INTEGER NOT NULL DEFAULT 1,
        "description" TEXT,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'item_groups table');

    // Phase 4: Core Transactions
    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "journal_entries" (
        "id" VARCHAR(36) PRIMARY KEY,
        "company_id" VARCHAR(36) REFERENCES "companies"("id"),
        "entry_number" VARCHAR(50),
        "date" DATE NOT NULL,
        "description" TEXT,
        "reference_id" VARCHAR(36),
        "reference_type" VARCHAR(50),
        "reference_number" VARCHAR(50),
        "total_debit" DECIMAL(18, 4) NOT NULL,
        "total_credit" DECIMAL(18, 4) NOT NULL,
        "status" VARCHAR(20) DEFAULT 'posted',
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'journal_entries table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "invoices" (
        "id" VARCHAR(36) PRIMARY KEY,
        "company_id" VARCHAR(36) REFERENCES "companies"("id"),
        "customer_id" VARCHAR(36),
        "warehouse_id" VARCHAR(36),
        "invoice_number" VARCHAR(50) NOT NULL,
        "date" DATE NOT NULL,
        "due_date" DATE,
        "subtotal" DECIMAL(18, 4) NOT NULL,
        "tax_amount" DECIMAL(18, 4) DEFAULT 0,
        "discount_amount" DECIMAL(18, 4) DEFAULT 0,
        "total_amount" DECIMAL(18, 4) NOT NULL,
        "status" VARCHAR(20) DEFAULT 'draft',
        "payment_type" VARCHAR(20) DEFAULT 'cash',
        "payment_method_id" VARCHAR(36),
        "description" TEXT,
        "notes" TEXT,
        "created_by" VARCHAR(36),
        "customer_name" VARCHAR(255),
        "payment_method_name" VARCHAR(255),
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'invoices table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "returns" (
        "id" VARCHAR(36) PRIMARY KEY,
        "company_id" VARCHAR(36) REFERENCES "companies"("id"),
        "customer_id" VARCHAR(36),
        "warehouse_id" VARCHAR(36),
        "return_number" VARCHAR(50) NOT NULL,
        "date" DATE NOT NULL,
        "total_amount" DECIMAL(18, 4) NOT NULL,
        "payment_type" VARCHAR(20) DEFAULT 'cash',
        "payment_method_id" VARCHAR(36),
        "description" TEXT,
        "notes" TEXT,
        "customer_name" VARCHAR(255),
        "payment_method_name" VARCHAR(255),
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'returns table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "purchase_invoices" (
        "id" VARCHAR(36) PRIMARY KEY,
        "company_id" VARCHAR(36) REFERENCES "companies"("id"),
        "supplier_id" VARCHAR(36),
        "warehouse_id" VARCHAR(36),
        "invoice_number" VARCHAR(50) NOT NULL,
        "date" DATE NOT NULL,
        "due_date" DATE,
        "subtotal" DECIMAL(18, 4) NOT NULL,
        "tax_amount" DECIMAL(18, 4) DEFAULT 0,
        "discount_amount" DECIMAL(18, 4) DEFAULT 0,
        "total_amount" DECIMAL(18, 4) NOT NULL,
        "status" VARCHAR(20) DEFAULT 'draft',
        "payment_type" VARCHAR(20) DEFAULT 'cash',
        "payment_method_id" VARCHAR(36),
        "description" TEXT,
        "notes" TEXT,
        "supplier_name" VARCHAR(255),
        "payment_method_name" VARCHAR(255),
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'purchase_invoices table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "purchase_returns" (
        "id" VARCHAR(36) PRIMARY KEY,
        "company_id" VARCHAR(36) REFERENCES "companies"("id"),
        "supplier_id" VARCHAR(36),
        "warehouse_id" VARCHAR(36),
        "return_number" VARCHAR(50) NOT NULL,
        "date" DATE NOT NULL,
        "total_amount" DECIMAL(18, 4) NOT NULL,
        "payment_type" VARCHAR(20) DEFAULT 'cash',
        "payment_method_id" VARCHAR(36),
        "description" TEXT,
        "notes" TEXT,
        "supplier_name" VARCHAR(255),
        "payment_method_name" VARCHAR(255),
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'purchase_returns table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "receipt_vouchers" (
        "id" VARCHAR(36) PRIMARY KEY,
        "company_id" VARCHAR(36) REFERENCES "companies"("id"),
        "customer_id" VARCHAR(36),
        "voucher_number" VARCHAR(50),
        "date" DATE NOT NULL,
        "amount" DECIMAL(18, 4) NOT NULL,
        "description" TEXT,
        "payment_method_id" VARCHAR(36),
        "account_id" VARCHAR(36),
        "customer_name" VARCHAR(255),
        "payment_method_name" VARCHAR(255),
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'receipt_vouchers table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "payment_vouchers" (
        "id" VARCHAR(36) PRIMARY KEY,
        "company_id" VARCHAR(36) REFERENCES "companies"("id"),
        "supplier_id" VARCHAR(36),
        "expense_category_id" VARCHAR(36),
        "date" DATE NOT NULL,
        "amount" DECIMAL(18, 4) NOT NULL,
        "description" TEXT,
        "payment_method_id" VARCHAR(36),
        "account_id" VARCHAR(36),
        "supplier_name" VARCHAR(255),
        "category_name" VARCHAR(255),
        "payment_method_name" VARCHAR(255),
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'payment_vouchers table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "cash_transfers" (
        "id" VARCHAR(36) PRIMARY KEY,
        "company_id" VARCHAR(36) REFERENCES "companies"("id"),
        "date" DATE NOT NULL,
        "amount" DECIMAL(18, 4) NOT NULL,
        "from_payment_method_id" VARCHAR(36),
        "to_payment_method_id" VARCHAR(36),
        "description" TEXT,
        "created_by" VARCHAR(36),
        "from_payment_method_name" VARCHAR(255),
        "to_payment_method_name" VARCHAR(255),
        "transfer_number" VARCHAR(50),
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'cash_transfers table');

    // Phase 5: Transaction Items
    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "journal_entry_lines" (
        "id" VARCHAR(36) PRIMARY KEY,
        "journal_entry_id" VARCHAR(36) REFERENCES "journal_entries"("id") ON DELETE CASCADE,
        "account_id" VARCHAR(36),
        "company_id" VARCHAR(36) REFERENCES "companies"("id"),
        "account_name" VARCHAR(255),
        "description" TEXT,
        "debit" DECIMAL(18, 4) DEFAULT 0,
        "credit" DECIMAL(18, 4) DEFAULT 0,
        "customer_id" VARCHAR(36),
        "supplier_id" VARCHAR(36),
        "customer_name" VARCHAR(255),
        "supplier_name" VARCHAR(255),
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'journal_entry_lines table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "invoice_items" (
        "id" VARCHAR(36) PRIMARY KEY,
        "invoice_id" VARCHAR(36) REFERENCES "invoices"("id") ON DELETE CASCADE,
        "product_id" VARCHAR(36),
        "company_id" VARCHAR(36),
        "description" TEXT,
        "quantity" DECIMAL(18, 4) NOT NULL,
        "unit_price" DECIMAL(18, 4) NOT NULL,
        "total" DECIMAL(18, 4) NOT NULL,
        "product_name" VARCHAR(255),
        "product_code" VARCHAR(100),
        "product_image_url" TEXT,
        "unit_cost" DECIMAL(18, 4) DEFAULT 0,
        "total_cost" DECIMAL(18, 4) DEFAULT 0,
        "costing_method_used" VARCHAR(50),
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'invoice_items table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "warehouse_transfers" (
        "id" VARCHAR(36) PRIMARY KEY,
        "company_id" VARCHAR(36) REFERENCES "companies"("id") ON DELETE CASCADE,
        "transfer_number" VARCHAR(50) NOT NULL,
        "from_warehouse_id" VARCHAR(36) REFERENCES "warehouses"("id"),
        "to_warehouse_id" VARCHAR(36) REFERENCES "warehouses"("id"),
        "from_warehouse_name" VARCHAR(255),
        "to_warehouse_name" VARCHAR(255),
        "date" DATE NOT NULL,
        "description" TEXT,
        "created_by" VARCHAR(36),
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'warehouse_transfers table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "warehouse_transfer_items" (
        "id" VARCHAR(36) PRIMARY KEY,
        "transfer_id" VARCHAR(36) REFERENCES "warehouse_transfers"("id") ON DELETE CASCADE,
        "product_id" VARCHAR(36) REFERENCES "products"("id"),
        "product_name" VARCHAR(255),
        "product_code" VARCHAR(100),
        "quantity" DECIMAL(18, 4) NOT NULL,
        "unit_cost" DECIMAL(18, 4) DEFAULT 0,
        "total_cost" DECIMAL(18, 4) DEFAULT 0,
        "company_id" VARCHAR(36),
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'warehouse_transfer_items table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "opening_stock_balances" (
        "id" VARCHAR(36) PRIMARY KEY,
        "company_id" VARCHAR(36) REFERENCES "companies"("id") ON DELETE CASCADE,
        "document_number" VARCHAR(50) NOT NULL,
        "date" DATE NOT NULL,
        "debit_account_id" VARCHAR(36) REFERENCES "accounts"("id"),
        "debit_account_name" VARCHAR(255),
        "credit_account_id" VARCHAR(36) REFERENCES "accounts"("id"),
        "credit_account_name" VARCHAR(255),
        "description" TEXT,
        "created_by" VARCHAR(36),
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'opening_stock_balances table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "opening_stock_items" (
        "id" VARCHAR(36) PRIMARY KEY,
        "opening_stock_id" VARCHAR(36) REFERENCES "opening_stock_balances"("id") ON DELETE CASCADE,
        "product_id" VARCHAR(36) REFERENCES "products"("id"),
        "product_name" VARCHAR(255),
        "product_code" VARCHAR(100),
        "warehouse_id" VARCHAR(36) REFERENCES "warehouses"("id"),
        "warehouse_name" VARCHAR(255),
        "quantity" DECIMAL(18, 4) NOT NULL,
        "unit_cost" DECIMAL(18, 4) DEFAULT 0,
        "total_cost" DECIMAL(18, 4) DEFAULT 0,
        "company_id" VARCHAR(36),
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'opening_stock_items table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "stock_adjustments" (
        "id" VARCHAR(36) PRIMARY KEY,
        "company_id" VARCHAR(36) REFERENCES "companies"("id") ON DELETE CASCADE,
        "adjustment_number" VARCHAR(50) NOT NULL,
        "date" DATE NOT NULL,
        "account_id" VARCHAR(36) REFERENCES "accounts"("id"),
        "account_name" VARCHAR(255),
        "description" TEXT,
        "created_by" VARCHAR(36),
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'stock_adjustments table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "stock_adjustment_items" (
        "id" VARCHAR(36) PRIMARY KEY,
        "adjustment_id" VARCHAR(36) REFERENCES "stock_adjustments"("id") ON DELETE CASCADE,
        "product_id" VARCHAR(36) REFERENCES "products"("id"),
        "product_name" VARCHAR(255),
        "product_code" VARCHAR(100),
        "warehouse_id" VARCHAR(36) REFERENCES "warehouses"("id"),
        "warehouse_name" VARCHAR(255),
        "quantity" DECIMAL(18, 4) NOT NULL,
        "unit_cost" DECIMAL(18, 4) DEFAULT 0,
        "total_cost" DECIMAL(18, 4) DEFAULT 0,
        "company_id" VARCHAR(36),
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'stock_adjustment_items table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "inventory_movements" (
        "id" VARCHAR(36) PRIMARY KEY,
        "company_id" VARCHAR(36) REFERENCES "companies"("id"),
        "warehouse_id" VARCHAR(36),
        "product_id" VARCHAR(36) REFERENCES "products"("id"),
        "movement_type" VARCHAR(50) NOT NULL,
        "reference_id" VARCHAR(36) NOT NULL,
        "reference_type" VARCHAR(50) NOT NULL,
        "reference_number" VARCHAR(100),
        "date" DATE NOT NULL,
        "quantity" DECIMAL(18, 4) NOT NULL,
        "unit_cost" DECIMAL(18, 4) NOT NULL,
        "total_cost" DECIMAL(18, 4) NOT NULL,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'inventory_movements table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "inventory_layers" (
        "id" VARCHAR(36) PRIMARY KEY,
        "company_id" VARCHAR(36) REFERENCES "companies"("id"),
        "warehouse_id" VARCHAR(36),
        "product_id" VARCHAR(36) REFERENCES "products"("id"),
        "purchase_date" DATE NOT NULL,
        "original_qty" DECIMAL(18, 4) NOT NULL,
        "qty_remaining" DECIMAL(18, 4) NOT NULL,
        "unit_cost" DECIMAL(18, 4) NOT NULL,
        "reference_type" VARCHAR(50) NOT NULL,
        "reference_id" VARCHAR(36) NOT NULL,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'inventory_layers table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "return_items" (
        "id" VARCHAR(36) PRIMARY KEY,
        "return_id" VARCHAR(36) REFERENCES "returns"("id") ON DELETE CASCADE,
        "product_id" VARCHAR(36),
        "company_id" VARCHAR(36),
        "description" TEXT,
        "quantity" DECIMAL(18, 4) NOT NULL,
        "unit_price" DECIMAL(18, 4) NOT NULL,
        "total" DECIMAL(18, 4) NOT NULL,
        "product_name" VARCHAR(255),
        "product_code" VARCHAR(100),
        "product_image_url" TEXT,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'return_items table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "purchase_invoice_items" (
        "id" VARCHAR(36) PRIMARY KEY,
        "invoice_id" VARCHAR(36) REFERENCES "purchase_invoices"("id") ON DELETE CASCADE,
        "product_id" VARCHAR(36),
        "company_id" VARCHAR(36),
        "description" TEXT,
        "quantity" DECIMAL(18, 4) NOT NULL,
        "unit_price" DECIMAL(18, 4) NOT NULL,
        "total" DECIMAL(18, 4) NOT NULL,
        "product_name" VARCHAR(255),
        "category_name" VARCHAR(100),
        "product_code" VARCHAR(100),
        "product_image_url" TEXT,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'purchase_invoice_items table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "purchase_return_items" (
        "id" VARCHAR(36) PRIMARY KEY,
        "return_id" VARCHAR(36) REFERENCES "purchase_returns"("id") ON DELETE CASCADE,
        "product_id" VARCHAR(36),
        "company_id" VARCHAR(36),
        "description" TEXT,
        "quantity" DECIMAL(18, 4) NOT NULL,
        "unit_price" DECIMAL(18, 4) NOT NULL,
        "total" DECIMAL(18, 4) NOT NULL,
        "product_name" VARCHAR(255),
        "product_code" VARCHAR(100),
        "product_image_url" TEXT,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'purchase_return_items table');

    // Phase 6: System Settings
    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "settings" (
        "id" VARCHAR(36) PRIMARY KEY,
        "company_id" VARCHAR(36) REFERENCES "companies"("id"),
        "type" VARCHAR(50),
        "key" VARCHAR(100),
        "value" TEXT,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'settings table');

    // Phase 7: Flexible Operations System
    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "departments" (
        "id" VARCHAR(36) PRIMARY KEY,
        "company_id" VARCHAR(36) REFERENCES "companies"("id"),
        "code" VARCHAR(50) UNIQUE,
        "name" VARCHAR(255) NOT NULL,
        "description" TEXT,
        "parent_id" VARCHAR(36) REFERENCES "departments"("id"),
        "manager_user_id" VARCHAR(36),
        "is_active" BOOLEAN DEFAULT true,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'departments table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "cost_centers" (
        "id" VARCHAR(36) PRIMARY KEY,
        "company_id" VARCHAR(36) REFERENCES "companies"("id"),
        "department_id" VARCHAR(36) REFERENCES "departments"("id"),
        "code" VARCHAR(50) UNIQUE,
        "name" VARCHAR(255) NOT NULL,
        "description" TEXT,
        "budget" DECIMAL(18, 4),
        "currency" VARCHAR(10),
        "is_active" BOOLEAN DEFAULT true,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'cost_centers table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "operation_categories" (
        "id" VARCHAR(36) PRIMARY KEY,
        "company_id" VARCHAR(36) REFERENCES "companies"("id"),
        "name" VARCHAR(255) NOT NULL,
        "code" VARCHAR(50),
        "parent_id" VARCHAR(36) REFERENCES "operation_categories"("id"),
        "is_final" BOOLEAN DEFAULT FALSE,
        "level" INT DEFAULT 0,
        "full_path" TEXT,
        "description" TEXT,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'operation_categories table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "field_operation_categories" (
        "field_id" VARCHAR(36) REFERENCES "operation_fields"("id") ON DELETE CASCADE,
        "category_id" VARCHAR(36) REFERENCES "operation_categories"("id") ON DELETE CASCADE,
        "company_id" VARCHAR(36) REFERENCES "companies"("id"),
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY ("field_id", "category_id")
      );
    `, 'field_operation_categories table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "operation_fields" (
        "id" VARCHAR(36) PRIMARY KEY,
        "company_id" VARCHAR(36) REFERENCES "companies"("id"),
        "category_id" VARCHAR(36) REFERENCES "operation_categories"("id"),
        "operation_category_id" VARCHAR(36),
        "name" VARCHAR(255) NOT NULL,
        "label" VARCHAR(255),
        "code" VARCHAR(50) UNIQUE,
        "description" TEXT,
        "type" VARCHAR(50) NOT NULL,
        "unit" VARCHAR(50),
        "default_value" TEXT,
        "is_required" BOOLEAN DEFAULT false,
        "options" JSONB,
        "sort_order" INTEGER DEFAULT 0,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'operation_fields table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "operations" (
        "id" VARCHAR(36) PRIMARY KEY,
        "company_id" VARCHAR(36) REFERENCES "companies"("id"),
        "category_id" VARCHAR(36) REFERENCES "operation_categories"("id"),
        "operation_category_id" VARCHAR(36),
        "department_id" VARCHAR(36) REFERENCES "departments"("id"),
        "cost_center_id" VARCHAR(36) REFERENCES "cost_centers"("id"),
        "operation_number" VARCHAR(50) UNIQUE,
        "operation_date" DATE,
        "customer_id" VARCHAR(36),
        "customer_name" VARCHAR(255),
        "description" TEXT,
        "status" VARCHAR(20) DEFAULT 'pending',
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'operations table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "operation_field_values" (
        "id" VARCHAR(36) PRIMARY KEY,
        "operation_id" VARCHAR(36) REFERENCES "operations"("id") ON DELETE CASCADE,
        "field_id" VARCHAR(36) REFERENCES "operation_fields"("id") ON DELETE CASCADE,
        "value" TEXT,
        "company_id" VARCHAR(36) REFERENCES "companies"("id"),
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'operation_field_values table');

    // 2. Safe Indices

    await safeQuery(`
      ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "weighted_average_cost" DECIMAL(18, 4) DEFAULT 0;
    `, 'add weighted_average_cost to products');

    await safeQuery('CREATE INDEX IF NOT EXISTS "idx_users_email" ON "users"("email");', 'idx_users_email');
    await safeQuery('CREATE INDEX IF NOT EXISTS "idx_users_company_id" ON "users"("company_id");', 'idx_users_company_id');

    if (await checkColumnExists('activity_logs', 'created_at')) {
      await safeQuery('CREATE INDEX IF NOT EXISTS "idx_activity_logs_company_at" ON "activity_logs"("company_id", "created_at" DESC);', 'activity_logs index');
    }
    
    if (await checkColumnExists('audit_logs', 'created_at')) {
      await safeQuery('CREATE INDEX IF NOT EXISTS "idx_audit_logs_company_at" ON "audit_logs"("company_id", "created_at" DESC);', 'audit_logs index');
    }

    if (await checkColumnExists('journal_entries', 'created_at')) {
      await safeQuery('CREATE INDEX IF NOT EXISTS "idx_journal_entries_at" ON "journal_entries"("company_id", "created_at" DESC);', 'journal_entries created_at index');
    }
    
    await safeQuery('CREATE INDEX IF NOT EXISTS "idx_journal_entries_date" ON "journal_entries"("company_id", "date" DESC);', 'journal_entries date index');
    await safeQuery('CREATE INDEX IF NOT EXISTS "idx_invoices_date" ON "invoices"("company_id", "date" DESC);', 'invoices date index');
    await safeQuery('CREATE INDEX IF NOT EXISTS "idx_accounts_code" ON "accounts"("company_id", "code");', 'accounts code index');

    // Performance Optimization Indices
    await safeQuery('CREATE INDEX IF NOT EXISTS "idx_journal_entries_ref_id" ON "journal_entries"("reference_id");', 'idx_journal_entries_ref_id');
    await safeQuery('CREATE INDEX IF NOT EXISTS "idx_invoice_items_invoice_id" ON "invoice_items"("invoice_id");', 'idx_invoice_items_invoice_id');
    await safeQuery('CREATE INDEX IF NOT EXISTS "idx_purchase_invoice_items_invoice_id" ON "purchase_invoice_items"("invoice_id");', 'idx_purchase_invoice_items_invoice_id');
    await safeQuery('CREATE INDEX IF NOT EXISTS "idx_journal_entry_lines_je_id" ON "journal_entry_lines"("journal_entry_id");', 'idx_journal_entry_lines_je_id');
    await safeQuery('CREATE INDEX IF NOT EXISTS "idx_receipt_vouchers_company_id" ON "receipt_vouchers"("company_id");', 'idx_receipt_vouchers_company_id');
    await safeQuery('CREATE INDEX IF NOT EXISTS "idx_payment_vouchers_company_id" ON "payment_vouchers"("company_id");', 'idx_payment_vouchers_company_id');
    await safeQuery('CREATE INDEX IF NOT EXISTS "idx_returns_company_id" ON "returns"("company_id");', 'idx_returns_company_id');
    await safeQuery('CREATE INDEX IF NOT EXISTS "idx_purchase_returns_company_id" ON "purchase_returns"("company_id");', 'idx_purchase_returns_company_id');
    await safeQuery('CREATE INDEX IF NOT EXISTS "idx_purchase_invoices_date" ON "purchase_invoices"("company_id", "date" DESC);', 'idx_purchase_invoices_date');
    await safeQuery('CREATE INDEX IF NOT EXISTS "idx_return_items_return_id" ON "return_items"("return_id");', 'idx_return_items_return_id');
    await safeQuery('CREATE INDEX IF NOT EXISTS "idx_purchase_return_items_return_id" ON "purchase_return_items"("return_id");', 'idx_purchase_return_items_return_id');
    await safeQuery('CREATE INDEX IF NOT EXISTS "idx_sales_order_items_order_id" ON "sales_order_items"("order_id");', 'idx_sales_order_items_order_id');
    await safeQuery('CREATE INDEX IF NOT EXISTS "idx_purchase_order_items_order_id" ON "purchase_order_items"("order_id");', 'idx_purchase_order_items_order_id');
    await safeQuery('CREATE INDEX IF NOT EXISTS "idx_warehouse_transfer_items_transfer_id" ON "warehouse_transfer_items"("transfer_id");', 'idx_warehouse_transfer_items_transfer_id');
    await safeQuery('CREATE INDEX IF NOT EXISTS "idx_opening_stock_items_opening_stock_id" ON "opening_stock_items"("opening_stock_id");', 'idx_opening_stock_items_opening_stock_id');
    await safeQuery('CREATE INDEX IF NOT EXISTS "idx_stock_adjustment_items_adjustment_id" ON "stock_adjustment_items"("adjustment_id");', 'idx_stock_adjustment_items_adjustment_id');

    // Add item_group_id and item_group_name column safeguards if they do not exist
    if (!(await checkColumnExists('products', 'item_group_id'))) {
      await safeQuery('ALTER TABLE "products" ADD COLUMN "item_group_id" VARCHAR(36);', 'add item_group_id to products');
    }
    if (!(await checkColumnExists('products', 'item_group_name'))) {
      await safeQuery('ALTER TABLE "products" ADD COLUMN "item_group_name" VARCHAR(255);', 'add item_group_name to products');
    }

    // Add is_active column safeguards if they do not exist
    if (!(await checkColumnExists('customers', 'is_active'))) {
      await safeQuery('ALTER TABLE "customers" ADD COLUMN "is_active" BOOLEAN DEFAULT TRUE;', 'add is_active to customers');
    }
    if (!(await checkColumnExists('suppliers', 'is_active'))) {
      await safeQuery('ALTER TABLE "suppliers" ADD COLUMN "is_active" BOOLEAN DEFAULT TRUE;', 'add is_active to suppliers');
    }
    if (!(await checkColumnExists('products', 'is_active'))) {
      await safeQuery('ALTER TABLE "products" ADD COLUMN "is_active" BOOLEAN DEFAULT TRUE;', 'add is_active to products');
    }
    if (!(await checkColumnExists('account_types', 'is_active'))) {
      await safeQuery('ALTER TABLE "account_types" ADD COLUMN "is_active" BOOLEAN DEFAULT TRUE;', 'add is_active to account_types');
    }

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "exchange_rate_history" (
        "id" VARCHAR(36) PRIMARY KEY,
        "company_id" VARCHAR(36) REFERENCES "companies"("id"),
        "currency_code" VARCHAR(10) NOT NULL,
        "exchange_rate" DECIMAL(18, 6) NOT NULL,
        "provider" VARCHAR(50) NOT NULL,
        "retrieved_date" VARCHAR(20) NOT NULL,
        "retrieved_time" VARCHAR(20) NOT NULL,
        "updated_by" VARCHAR(100) NOT NULL,
        "status" VARCHAR(20) NOT NULL,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'exchange_rate_history table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "dashboards" (
        "id" VARCHAR(36) PRIMARY KEY,
        "company_id" VARCHAR(36) REFERENCES "companies"("id"),
        "owner_user_id" VARCHAR(36) REFERENCES "users"("id"),
        "name" VARCHAR(255) NOT NULL,
        "description" TEXT,
        "is_default" BOOLEAN DEFAULT FALSE,
        "is_system" BOOLEAN DEFAULT FALSE,
        "icon" VARCHAR(100),
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'dashboards table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "widgets" (
        "id" VARCHAR(36) PRIMARY KEY,
        "dashboard_id" VARCHAR(36) REFERENCES "dashboards"("id") ON DELETE CASCADE,
        "widget_type" VARCHAR(100) NOT NULL,
        "title" VARCHAR(255) NOT NULL,
        "x" INTEGER NOT NULL,
        "y" INTEGER NOT NULL,
        "w" INTEGER NOT NULL,
        "h" INTEGER NOT NULL,
        "settings" JSONB DEFAULT '{}',
        "filters" JSONB DEFAULT '{}',
        "order" INTEGER DEFAULT 0,
        "visible" BOOLEAN DEFAULT TRUE,
        "locked" BOOLEAN DEFAULT FALSE,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'widgets table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "attendance" (
        "id" VARCHAR(36) PRIMARY KEY,
        "company_id" VARCHAR(36) REFERENCES "companies"("id") ON DELETE CASCADE,
        "employee_id" VARCHAR(36) REFERENCES "employees"("id") ON DELETE CASCADE,
        "employee_name" VARCHAR(255),
        "date" DATE,
        "check_in" TIMESTAMP,
        "check_out" TIMESTAMP,
        "status" VARCHAR(50),
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'attendance table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "payroll" (
        "id" VARCHAR(36) PRIMARY KEY,
        "company_id" VARCHAR(36) REFERENCES "companies"("id") ON DELETE CASCADE,
        "employee_id" VARCHAR(36) REFERENCES "employees"("id") ON DELETE CASCADE,
        "employee_name" VARCHAR(255),
        "month" INTEGER,
        "year" INTEGER,
        "date" DATE,
        "basic_salary" DECIMAL(18, 4) DEFAULT 0,
        "allowances" DECIMAL(18, 4) DEFAULT 0,
        "deductions" DECIMAL(18, 4) DEFAULT 0,
        "net_salary" DECIMAL(18, 4) DEFAULT 0,
        "status" VARCHAR(50),
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'payroll table');

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS "assets" (
        "id" VARCHAR(36) PRIMARY KEY,
        "company_id" VARCHAR(36) REFERENCES "companies"("id") ON DELETE CASCADE,
        "code" VARCHAR(100),
        "name" VARCHAR(255) NOT NULL,
        "category" VARCHAR(100),
        "purchase_date" DATE,
        "purchase_cost" DECIMAL(18, 4) DEFAULT 0,
        "current_value" DECIMAL(18, 4) DEFAULT 0,
        "depreciation_rate" DECIMAL(5, 2) DEFAULT 0,
        "status" VARCHAR(50),
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'assets table');

    await safeQuery('CREATE INDEX IF NOT EXISTS "idx_dashboards_company" ON "dashboards"("company_id");', 'idx_dashboards_company');
    await safeQuery('CREATE INDEX IF NOT EXISTS "idx_dashboards_owner" ON "dashboards"("owner_user_id");', 'idx_dashboards_owner');
    await safeQuery('CREATE INDEX IF NOT EXISTS "idx_widgets_dashboard" ON "widgets"("dashboard_id");', 'idx_widgets_dashboard');
    await safeQuery('CREATE INDEX IF NOT EXISTS "idx_attendance_company" ON "attendance"("company_id");', 'idx_attendance_company');
    await safeQuery('CREATE INDEX IF NOT EXISTS "idx_payroll_company" ON "payroll"("company_id");', 'idx_payroll_company');
    await safeQuery('CREATE INDEX IF NOT EXISTS "idx_assets_company" ON "assets"("company_id");', 'idx_assets_company');

    // Seeding
    await seedDatabase(client);

  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('❌ Schema Initialization Failed (System will continue):');
    console.error(error);
    // Don't rethrow to keep server running
  } finally {
    if (client) client.release();
  }
}

async function seedDatabase(client: any) {

  // 1. Ensure 'SYSTEM' Company Exists
  try {
    const { rows: companyRows } = await client.query('SELECT id FROM companies WHERE id = $1', ['SYSTEM']);
    if (companyRows.length === 0) {
      await client.query(
        'INSERT INTO companies (id, name, code) VALUES ($1, $2, $3)',
        ['SYSTEM', 'System Infrastructure', 'SYS-ROOT']
      );
    }
  } catch (e) {
    console.warn('    ! Company seeding failed:', e);
  }

  // 2. Super Admin
  const adminEmail = 'omarwaelysy@gmail.com';
  try {
    const { rows } = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    if (rows.length === 0) {
      const hashedPassword = await bcrypt.hash('123456', 10);
      await client.query(
        'INSERT INTO users (id, username, name, email, password_hash, role, company_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [uuidv4(), 'omar_admin', 'Omar Super Admin', adminEmail, hashedPassword, 'super_admin', 'SYSTEM']
      );
    }
  } catch (e) {
    console.warn('    ! User seeding failed:', e);
  }

  // 2b. Update Wael Ragab to Super Admin & Restore Company
  try {
    await client.query(
      `UPDATE users 
       SET role = 'super_admin', 
           company_id = COALESCE(
             (SELECT id FROM companies WHERE id != 'SYSTEM' ORDER BY created_at ASC LIMIT 1), 
             'SYSTEM'
           )
       WHERE email = $1`,
      ['acc.wael2005@gmail.com']
    );
  } catch (e) {
    console.warn('    ! Updating Wael Super Admin role failed:', e);
  }

  // 3. Global Config
  try {
    const { rows } = await client.query('SELECT id FROM system_config WHERE id = $1', ['global_config']);
    if (rows.length === 0) {
      await client.query(
        'INSERT INTO system_config (id, maintenance_mode, min_client_version) VALUES ($1, $2, $3)',
        ['global_config', false, '2.0.0']
      );
    }
  } catch (e) {
    console.warn('    ! Config seeding failed:', e);
  }

  // 4. Default Dashboard Template
  try {
    const defaultTemplateId = 'system-default-dashboard';
    const { rows: dashRows } = await client.query('SELECT id FROM dashboards WHERE id = $1', [defaultTemplateId]);
    if (dashRows.length === 0) {

      await client.query(`
        INSERT INTO dashboards (id, company_id, owner_user_id, name, description, is_default, is_system, icon)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [defaultTemplateId, 'SYSTEM', null, 'Default Workspace', 'System default dashboard layout template', true, true, 'LayoutDashboard']);

      // Seed default widgets for this template
      const defaultWidgets = [
        {
          id: 'widget-default-kpi-sales',
          widget_type: 'kpi_card',
          title: 'Sales KPI',
          x: 0, y: 0, w: 3, h: 2,
          settings: { metric: 'sales_total', comparison: 'previous_month' },
          filters: {},
          order: 0
        },
        {
          id: 'widget-default-kpi-profit',
          widget_type: 'profit',
          title: 'Profit Overview',
          x: 3, y: 0, w: 3, h: 2,
          settings: { metric: 'net_profit' },
          filters: {},
          order: 1
        },
        {
          id: 'widget-default-revenue-chart',
          widget_type: 'line_chart',
          title: 'Monthly Revenue Trend',
          x: 0, y: 2, w: 6, h: 4,
          settings: { dataKey: 'revenue', timeRange: '12_months' },
          filters: {},
          order: 2
        },
        {
          id: 'widget-default-recent-activities',
          widget_type: 'recent_activities',
          title: 'Recent Activity Logs',
          x: 6, y: 0, w: 6, h: 6,
          settings: { limit: 10 },
          filters: {},
          order: 3
        }
      ];

      for (const w of defaultWidgets) {
        await client.query(`
          INSERT INTO widgets (id, dashboard_id, widget_type, title, x, y, w, h, settings, filters, "order")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [w.id, defaultTemplateId, w.widget_type, w.title, w.x, w.y, w.w, w.h, JSON.stringify(w.settings), JSON.stringify(w.filters), w.order]);
      }

    }
  } catch (e) {
    console.warn('    ! Dashboard template seeding failed:', e);
  }

  // 5. Cleanup existing legacy reversed movements to free up movement numbers
  try {
    const renameRes = await client.query(`
      UPDATE "inventory_movements_v2" 
      SET "movement_number" = "movement_number" || '-REV-' || SUBSTRING("id" FROM 1 FOR 8) 
      WHERE "status" = 'reversed' AND "movement_number" NOT LIKE '%-REV-%'
    `);
    if (renameRes.rowCount > 0) {
      console.log(`    * Free'd up ${renameRes.rowCount} movement numbers by renaming legacy reversed movements.`);
    }
  } catch (e) {
    console.warn('    ! Legacy reversed movements renaming failed:', e);
  }

  // 6. Fix multi-tenant users unique constraint
  try {
    await client.query(`
      ALTER TABLE "users" DROP CONSTRAINT IF EXISTS users_email_key;
      ALTER TABLE "users" ADD CONSTRAINT users_email_company_key UNIQUE (email, company_id);
    `);
    console.log('    * Applied multi-tenant unique constraint for users table.');
  } catch (e) {
    console.warn('    ! Migration for users table unique constraint failed:', e);
  }
}
