import pool from './postgres';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

/**
 * ERP V2 Database Initialization (Strict Dependency Ordered)
 * This script is designed to be idempotent and migration-safe.
 */
export async function initDatabase() {
  console.log('🚀 [PostgreSQL] Initializing ERP V2 Core System...');
  
  let client;
  let retries = 5;
  let delay = 2000;

  while (retries > 0) {
    try {
      client = await pool.connect();
      console.log('✅ Connected to PostgreSQL.');
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
    console.log('  - Building Tables...');

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
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'users table');

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
        "user_email" VARCHAR(100),
        "action" VARCHAR(100) NOT NULL,
        "resource" VARCHAR(100) NOT NULL,
        "resource_id" VARCHAR(36),
        "changes" JSONB,
        "severity" VARCHAR(20) DEFAULT 'info',
        "ip_address" VARCHAR(45),
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'audit_logs table');

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
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    console.log('  - Securing Indices...');

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

    // Add item_group_id and item_group_name column safeguards if they do not exist
    if (!(await checkColumnExists('products', 'item_group_id'))) {
      await safeQuery('ALTER TABLE "products" ADD COLUMN "item_group_id" VARCHAR(36);', 'add item_group_id to products');
    }
    if (!(await checkColumnExists('products', 'item_group_name'))) {
      await safeQuery('ALTER TABLE "products" ADD COLUMN "item_group_name" VARCHAR(255);', 'add item_group_name to products');
    }

    console.log('✅ Base Schema Guardrails active.');

    // Seeding
    await seedDatabase(client);

    console.log('🔥 [PostgreSQL] Initialized Successfully.');
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
  console.log('  - Seeding System Defaults...');
  
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
}
