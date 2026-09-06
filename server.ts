import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import cors from "cors";
import fs from "fs";
import { initDatabase } from "./src/lib/init-db";
import { runMigrations } from "./src/lib/migration-runner";
import erpRouter from "./src/lib/erp-api";
import subscriptionRouter from "./src/lib/subscription/subscription-api";
import importRouter from "./src/lib/import-router";
import etaNotificationsRouter from "./src/routes/eta-notifications";
import { generatePDF } from "./src/lib/pdf-generator";

async function startServer() {
  // Initialize PostgreSQL FIRST
  try {
    const pool = (await import("./src/lib/postgres")).default;
    await initDatabase();
    
    // FORCED SCHEMA SYNC for known missing columns that block the user
    console.log("🛠️ FORCING CRITICAL SCHEMA SYNC...");
    const syncQueries = [
      // Invoices
      'ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "description" TEXT',
      'ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "notes" TEXT',
      'ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "settlements" JSONB',
      'ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "settlement_number" VARCHAR(50)',
      'ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "settlement_date" VARCHAR(50)',
      'ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "operation_id" VARCHAR(36)',
      'ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "department_id" VARCHAR(36)',
      'ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "cost_center_id" VARCHAR(36)',
      'ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      'ALTER TABLE "purchase_invoices" ADD COLUMN IF NOT EXISTS "operation_id" VARCHAR(36)',
      'ALTER TABLE "purchase_invoices" ADD COLUMN IF NOT EXISTS "department_id" VARCHAR(36)',
      'ALTER TABLE "purchase_invoices" ADD COLUMN IF NOT EXISTS "cost_center_id" VARCHAR(36)',
      'ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "barcode" VARCHAR(255)',
      'ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "image_url" TEXT',
      'ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "product_code" VARCHAR(100)',
      'ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "product_image_url" TEXT',
      'ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "operation_id" VARCHAR(36)',
      'ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "department_id" VARCHAR(36)',
      'ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "cost_center_id" VARCHAR(36)',
      'ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "vat_rate" DECIMAL(10, 4) DEFAULT 0',
      'ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "vat_amount" DECIMAL(18, 4) DEFAULT 0',
      'ALTER TABLE "purchase_invoice_items" ADD COLUMN IF NOT EXISTS "operation_id" VARCHAR(36)',
      'ALTER TABLE "purchase_invoice_items" ADD COLUMN IF NOT EXISTS "department_id" VARCHAR(36)',
      'ALTER TABLE "purchase_invoice_items" ADD COLUMN IF NOT EXISTS "cost_center_id" VARCHAR(36)',
      'ALTER TABLE "purchase_invoice_items" ADD COLUMN IF NOT EXISTS "vat_rate" DECIMAL(10, 4) DEFAULT 0',
      'ALTER TABLE "purchase_invoice_items" ADD COLUMN IF NOT EXISTS "vat_amount" DECIMAL(18, 4) DEFAULT 0',
      
      // Journal Entries
      'ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "entry_number" VARCHAR(50)',
      'ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "description" TEXT',
      'ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "reference_id" VARCHAR(36)',
      'ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "reference_type" VARCHAR(50)',
      'ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "reference_number" VARCHAR(50)',
      'ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "total_debit" DECIMAL(18, 4) DEFAULT 0',
      'ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "total_credit" DECIMAL(18, 4) DEFAULT 0',
      'ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT \'posted\'',
      'ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "company_id" VARCHAR(36)',
      
      // Journal Entry Lines
      'ALTER TABLE "journal_entry_lines" ADD COLUMN IF NOT EXISTS "description" TEXT',
      'ALTER TABLE "journal_entry_lines" ADD COLUMN IF NOT EXISTS "account_name" VARCHAR(255)',
      'ALTER TABLE "journal_entry_lines" ADD COLUMN IF NOT EXISTS "debit" DECIMAL(18, 4) DEFAULT 0',
      'ALTER TABLE "journal_entry_lines" ADD COLUMN IF NOT EXISTS "credit" DECIMAL(18, 4) DEFAULT 0',
      'ALTER TABLE "journal_entry_lines" ADD COLUMN IF NOT EXISTS "customer_id" VARCHAR(36)',
      'ALTER TABLE "journal_entry_lines" ADD COLUMN IF NOT EXISTS "supplier_id" VARCHAR(36)',
      'ALTER TABLE "journal_entry_lines" ADD COLUMN IF NOT EXISTS "customer_name" VARCHAR(255)',
      'ALTER TABLE "journal_entry_lines" ADD COLUMN IF NOT EXISTS "supplier_name" VARCHAR(255)',
      'ALTER TABLE "journal_entry_lines" ADD COLUMN IF NOT EXISTS "sub_account_id" VARCHAR(36)',
      'ALTER TABLE "journal_entry_lines" ADD COLUMN IF NOT EXISTS "sub_account_type" VARCHAR(50)',
      'ALTER TABLE "journal_entry_lines" ADD COLUMN IF NOT EXISTS "company_id" VARCHAR(36)',
      'ALTER TABLE "journal_entry_lines" ADD COLUMN IF NOT EXISTS "product_name" VARCHAR(255)',
      'ALTER TABLE "journal_entry_lines" ADD COLUMN IF NOT EXISTS "operation_id" VARCHAR(36)',
      'ALTER TABLE "journal_entry_lines" ADD COLUMN IF NOT EXISTS "department_id" VARCHAR(36)',
      'ALTER TABLE "journal_entry_lines" ADD COLUMN IF NOT EXISTS "cost_center_id" VARCHAR(36)',
      'ALTER TABLE "journal_entry_lines" ADD COLUMN IF NOT EXISTS "currency" VARCHAR(10)',
      'ALTER TABLE "journal_entry_lines" ADD COLUMN IF NOT EXISTS "exchange_rate" DECIMAL(18, 4) DEFAULT 1',
      'ALTER TABLE "journal_entry_lines" ADD COLUMN IF NOT EXISTS "foreign_amount" DECIMAL(18, 4) DEFAULT 0',

      // Vouchers
      'ALTER TABLE "payment_vouchers" ADD COLUMN IF NOT EXISTS "description" TEXT',
      'ALTER TABLE "payment_vouchers" ADD COLUMN IF NOT EXISTS "voucher_number" VARCHAR(50)',
      'ALTER TABLE "payment_vouchers" ADD COLUMN IF NOT EXISTS "items" JSONB',
      'ALTER TABLE "payment_vouchers" ADD COLUMN IF NOT EXISTS "internal_reference" VARCHAR(50)',
      'ALTER TABLE "payment_vouchers" ADD COLUMN IF NOT EXISTS "manual_reference" VARCHAR(50)',
      'ALTER TABLE "payment_vouchers" ADD COLUMN IF NOT EXISTS "voucher_type" VARCHAR(50)',
      'ALTER TABLE "payment_vouchers" ADD COLUMN IF NOT EXISTS "customer_id" VARCHAR(36)',
      'ALTER TABLE "payment_vouchers" ADD COLUMN IF NOT EXISTS "customer_name" VARCHAR(255)',

      'ALTER TABLE "receipt_vouchers" ADD COLUMN IF NOT EXISTS "description" TEXT',
      'ALTER TABLE "receipt_vouchers" ADD COLUMN IF NOT EXISTS "voucher_number" VARCHAR(50)',
      'ALTER TABLE "receipt_vouchers" ADD COLUMN IF NOT EXISTS "items" JSONB',
      'ALTER TABLE "receipt_vouchers" ADD COLUMN IF NOT EXISTS "internal_reference" VARCHAR(50)',
      'ALTER TABLE "receipt_vouchers" ADD COLUMN IF NOT EXISTS "manual_reference" VARCHAR(50)',
      'ALTER TABLE "receipt_vouchers" ADD COLUMN IF NOT EXISTS "voucher_type" VARCHAR(50)',
      'ALTER TABLE "receipt_vouchers" ADD COLUMN IF NOT EXISTS "supplier_id" VARCHAR(36)',
      'ALTER TABLE "receipt_vouchers" ADD COLUMN IF NOT EXISTS "supplier_name" VARCHAR(255)',
      
      // Returns
      'CREATE TABLE IF NOT EXISTS "contact_messages" ("id" VARCHAR(36) PRIMARY KEY, "name" VARCHAR(255) NOT NULL, "email" VARCHAR(255) NOT NULL, "phone" VARCHAR(50), "message" TEXT NOT NULL, "status" VARCHAR(20) DEFAULT \'new\', "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP, "read_at" TIMESTAMP, "handled_by" VARCHAR(100), "notes" TEXT)',
      'ALTER TABLE "returns" ADD COLUMN IF NOT EXISTS "description" TEXT',
      'ALTER TABLE "returns" ADD COLUMN IF NOT EXISTS "warehouse_id" VARCHAR(36)',
      'ALTER TABLE "purchase_invoices" ADD COLUMN IF NOT EXISTS "description" TEXT',
      'ALTER TABLE "purchase_invoices" ADD COLUMN IF NOT EXISTS "warehouse_id" VARCHAR(36)',
      'ALTER TABLE "purchase_invoices" ADD COLUMN IF NOT EXISTS "settlements" JSONB',
      'ALTER TABLE "purchase_invoices" ADD COLUMN IF NOT EXISTS "settlement_number" VARCHAR(50)',
      'ALTER TABLE "purchase_invoices" ADD COLUMN IF NOT EXISTS "settlement_date" VARCHAR(50)',
      'ALTER TABLE "purchase_returns" ADD COLUMN IF NOT EXISTS "description" TEXT',
      'ALTER TABLE "purchase_returns" ADD COLUMN IF NOT EXISTS "warehouse_id" VARCHAR(36)',
      'ALTER TABLE "purchase_invoice_items" ADD COLUMN IF NOT EXISTS "expense_category_id" VARCHAR(36)',
      'ALTER TABLE "purchase_return_items" ADD COLUMN IF NOT EXISTS "expense_category_id" VARCHAR(36)',
      'ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "warehouse_id" VARCHAR(36)',
      'ALTER TABLE "inventory_movements" ADD COLUMN IF NOT EXISTS "warehouse_id" VARCHAR(36)',
      'ALTER TABLE "inventory_layers" ADD COLUMN IF NOT EXISTS "warehouse_id" VARCHAR(36)',
      
      // Other
      'CREATE TABLE IF NOT EXISTS "issued_cheques" ("id" VARCHAR(36) PRIMARY KEY, "company_id" VARCHAR(36) NOT NULL, "cheque_number" VARCHAR(100) NOT NULL, "supplier_id" VARCHAR(36) NOT NULL, "bank_account_id" VARCHAR(36) NOT NULL, "bank_name" VARCHAR(255), "account_number" VARCHAR(100), "amount" DECIMAL(18, 4) NOT NULL, "currency" VARCHAR(10) DEFAULT \'EGP\', "exchange_rate" DECIMAL(18, 6) DEFAULT 1.0, "issue_date" DATE NOT NULL, "due_date" DATE NOT NULL, "status" VARCHAR(20) NOT NULL DEFAULT \'DRAFT\', "description" TEXT, "notes" TEXT, "payee_name" VARCHAR(255), "payment_date" DATE, "return_date" DATE, "return_reason" TEXT, "old_due_date" DATE, "new_due_date" DATE, "postponement_reason" TEXT, "cancelled_at" TIMESTAMP, "cancelled_by" VARCHAR(36), "cancel_reason" TEXT, "issue_journal_entry_id" VARCHAR(36), "payment_journal_entry_id" VARCHAR(36), "cancel_journal_entry_id" VARCHAR(36), "attachments" JSONB DEFAULT \'[]\', "created_by" VARCHAR(36), "updated_by" VARCHAR(36), "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
      'ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "required_sub_account" BOOLEAN DEFAULT FALSE',
      'ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "account_usage" VARCHAR(50) DEFAULT \'other\'',
      'ALTER TABLE "payment_methods" ADD COLUMN IF NOT EXISTS "type" VARCHAR(50) DEFAULT \'cash\'',
      
      // Products specific columns from arabic request
      'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "inventory_account_id" VARCHAR(36)',
      'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "inventory_account_name" VARCHAR(255)',
      'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "inventory_cost_method" VARCHAR(20) DEFAULT \'wac\'',
      'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "vat_account_id" VARCHAR(36)',
      'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "vat_account_name" VARCHAR(255)',
      'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "vat_rate" DECIMAL(10,4) DEFAULT 0',
      'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "tax_item_code" VARCHAR(100)',
      'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "tax_code_type" VARCHAR(50) DEFAULT \'EGS\'',
      'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "eta_item_code" VARCHAR(100)',
      'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "eta_code_type" VARCHAR(50) DEFAULT \'EGS\'',
      'ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "unit_cost" DECIMAL(18, 4) DEFAULT 0',
      'ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "total_cost" DECIMAL(18, 4) DEFAULT 0',
      'ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "costing_method_used" VARCHAR(50)',
      'ALTER TABLE "return_items" ADD COLUMN IF NOT EXISTS "unit_cost" DECIMAL(18, 4) DEFAULT 0',
      'ALTER TABLE "purchase_return_items" ADD COLUMN IF NOT EXISTS "unit_cost" DECIMAL(18, 4) DEFAULT 0',

      
      // Companies
      'ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "logo_url" TEXT',
      'ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "country" VARCHAR(100)',
      'ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "currency" VARCHAR(50)',
      'ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "fiscal_year_end" DATE',
      'ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "vat_enabled" BOOLEAN DEFAULT FALSE',
      'ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "wht_enabled" BOOLEAN DEFAULT FALSE',
      
      // Currencies
      'ALTER TABLE "currencies" ADD COLUMN IF NOT EXISTS "flag" VARCHAR(20)',
      
      // Cost policy preservation column
      'ALTER TABLE "inventory_movements" ADD COLUMN IF NOT EXISTS "cost_policy" VARCHAR(20)',

      // Sales & Purchase Orders
      'CREATE TABLE IF NOT EXISTS "sales_orders" ("id" VARCHAR(36) PRIMARY KEY, "company_id" VARCHAR(36), "customer_id" VARCHAR(36), "customer_name" VARCHAR(255), "warehouse_id" VARCHAR(36), "order_number" VARCHAR(50) NOT NULL, "date" DATE NOT NULL, "delivery_date" DATE, "subtotal" DECIMAL(18, 4) NOT NULL, "tax_amount" DECIMAL(18, 4) DEFAULT 0, "discount_amount" DECIMAL(18, 4) DEFAULT 0, "total_amount" DECIMAL(18, 4) NOT NULL, "status" VARCHAR(20) DEFAULT \'pending\', "invoice_id" VARCHAR(36), "invoice_number" VARCHAR(50), "description" TEXT, "notes" TEXT, "created_by" VARCHAR(36), "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
      'CREATE TABLE IF NOT EXISTS "sales_order_items" ("id" VARCHAR(36) PRIMARY KEY, "order_id" VARCHAR(36) REFERENCES "sales_orders"("id") ON DELETE CASCADE, "product_id" VARCHAR(36), "company_id" VARCHAR(36), "description" TEXT, "quantity" DECIMAL(18, 4) NOT NULL, "unit_price" DECIMAL(18, 4) NOT NULL, "total" DECIMAL(18, 4) NOT NULL, "product_name" VARCHAR(255), "product_code" VARCHAR(100), "product_image_url" TEXT, "barcode" VARCHAR(255), "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
      'CREATE TABLE IF NOT EXISTS "purchase_orders" ("id" VARCHAR(36) PRIMARY KEY, "company_id" VARCHAR(36), "supplier_id" VARCHAR(36), "supplier_name" VARCHAR(255), "warehouse_id" VARCHAR(36), "order_number" VARCHAR(50) NOT NULL, "date" DATE NOT NULL, "delivery_date" DATE, "subtotal" DECIMAL(18, 4) NOT NULL, "tax_amount" DECIMAL(18, 4) DEFAULT 0, "discount_amount" DECIMAL(18, 4) DEFAULT 0, "total_amount" DECIMAL(18, 4) NOT NULL, "status" VARCHAR(20) DEFAULT \'pending\', "invoice_id" VARCHAR(36), "invoice_number" VARCHAR(50), "description" TEXT, "notes" TEXT, "created_by" VARCHAR(36), "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
      'CREATE TABLE IF NOT EXISTS "purchase_order_items" ("id" VARCHAR(36) PRIMARY KEY, "order_id" VARCHAR(36) REFERENCES "purchase_orders"("id") ON DELETE CASCADE, "product_id" VARCHAR(36), "company_id" VARCHAR(36), "description" TEXT, "quantity" DECIMAL(18, 4) NOT NULL, "unit_price" DECIMAL(18, 4) NOT NULL, "total" DECIMAL(18, 4) NOT NULL, "product_name" VARCHAR(255), "product_code" VARCHAR(100), "product_image_url" TEXT, "barcode" VARCHAR(255), "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
      
      // Link columns on invoices
      'ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "source_orders" TEXT',
      'ALTER TABLE "purchase_invoices" ADD COLUMN IF NOT EXISTS "source_orders" TEXT',

      // Employees
      'CREATE TABLE IF NOT EXISTS "employees" ("id" VARCHAR(36) PRIMARY KEY, "company_id" VARCHAR(36), "employee_code" VARCHAR(50) UNIQUE NOT NULL, "name" VARCHAR(255) NOT NULL, "nationality" VARCHAR(100), "national_id" VARCHAR(50), "gender" VARCHAR(20), "marital_status" VARCHAR(20), "birth_date" DATE, "hire_date" DATE, "contract_type" VARCHAR(20), "contract_expiry_date" DATE, "photo_url" TEXT, "documents" TEXT, "created_by" VARCHAR(36), "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
      'ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "job_title" VARCHAR(255)',
      'ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "manager_id" VARCHAR(36)',
      'ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "department_id" VARCHAR(36)',

      // Payment Configurations, Credit Limits, and Payment Terms (Customers & Suppliers)
      'ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "payment_method" VARCHAR(50)',
      'ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "credit_limit" DECIMAL(18, 4) DEFAULT 0',
      'ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "payment_terms" VARCHAR(100)',
      'ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "payment_terms_days" INTEGER DEFAULT 0',
      'ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "advance_percentage" DECIMAL(5, 2) DEFAULT 0',
      'ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "payment_method" VARCHAR(50)',
      'ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "credit_limit" DECIMAL(18, 4) DEFAULT 0',
      'ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "payment_terms" VARCHAR(100)',
      'ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "payment_terms_days" INTEGER DEFAULT 0',
      'ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "advance_percentage" DECIMAL(5, 2) DEFAULT 0',

      // Payment Terms on Invoices & Purchase Invoices
      'ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "payment_terms" VARCHAR(100)',
      'ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "payment_terms_days" INTEGER DEFAULT 0',
      'ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "advance_percentage" DECIMAL(5, 2) DEFAULT 0',
      'ALTER TABLE "purchase_invoices" ADD COLUMN IF NOT EXISTS "payment_terms" VARCHAR(100)',
      'ALTER TABLE "purchase_invoices" ADD COLUMN IF NOT EXISTS "payment_terms_days" INTEGER DEFAULT 0',
      'ALTER TABLE "purchase_invoices" ADD COLUMN IF NOT EXISTS "advance_percentage" DECIMAL(5, 2) DEFAULT 0',
      
      // Cash Transfers Serial
      'ALTER TABLE "cash_transfers" ADD COLUMN IF NOT EXISTS "transfer_number" VARCHAR(50)',

      // Currency Rates
      'CREATE TABLE IF NOT EXISTS "currency_rates" ("id" VARCHAR(36) PRIMARY KEY, "currency_id" VARCHAR(36) REFERENCES "currencies"("id") ON DELETE CASCADE, "rate" DECIMAL(18, 6) NOT NULL, "rate_date" DATE NOT NULL, "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
      'CREATE TABLE IF NOT EXISTS "exchange_rate_history" ("id" VARCHAR(36) PRIMARY KEY, "company_id" VARCHAR(36) REFERENCES "companies"("id"), "currency_code" VARCHAR(10) NOT NULL, "exchange_rate" DECIMAL(18, 6) NOT NULL, "provider" VARCHAR(50) NOT NULL, "retrieved_date" VARCHAR(20) NOT NULL, "retrieved_time" VARCHAR(20) NOT NULL, "updated_by" VARCHAR(100) NOT NULL, "status" VARCHAR(20) NOT NULL, "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',

      // Performance Indexes for fast loading
      'CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON invoices(company_id)',
      'CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date DESC)',
      'CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id)',
      'CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id)',
      'CREATE INDEX IF NOT EXISTS idx_purchase_invoices_company_id ON purchase_invoices(company_id)',
      'CREATE INDEX IF NOT EXISTS idx_purchase_invoices_date ON purchase_invoices(date DESC)',
      'CREATE INDEX IF NOT EXISTS idx_purchase_invoices_supplier_id ON purchase_invoices(supplier_id)',
      'CREATE INDEX IF NOT EXISTS idx_purchase_invoice_items_invoice_id ON purchase_invoice_items(invoice_id)',
      'CREATE INDEX IF NOT EXISTS idx_journal_entries_company_id ON journal_entries(company_id)',
      'CREATE INDEX IF NOT EXISTS idx_journal_entries_reference_id ON journal_entries(reference_id)',
      'CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_je_id ON journal_entry_lines(journal_entry_id)',
      'CREATE INDEX IF NOT EXISTS idx_returns_company_id ON returns(company_id)',
      'CREATE INDEX IF NOT EXISTS idx_return_items_return_id ON return_items(return_id)',
      'CREATE INDEX IF NOT EXISTS idx_purchase_returns_company_id ON purchase_returns(company_id)',
      'CREATE INDEX IF NOT EXISTS idx_purchase_return_items_return_id ON purchase_return_items(return_id)',
      'CREATE TABLE IF NOT EXISTS "attendance" ("id" VARCHAR(36) PRIMARY KEY, "company_id" VARCHAR(36), "employee_id" VARCHAR(36), "employee_name" VARCHAR(255), "date" DATE, "check_in" TIMESTAMP, "check_out" TIMESTAMP, "status" VARCHAR(50), "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
      'CREATE TABLE IF NOT EXISTS "payroll" ("id" VARCHAR(36) PRIMARY KEY, "company_id" VARCHAR(36), "employee_id" VARCHAR(36), "employee_name" VARCHAR(255), "month" INTEGER, "year" INTEGER, "date" DATE, "basic_salary" DECIMAL(18, 4) DEFAULT 0, "allowances" DECIMAL(18, 4) DEFAULT 0, "deductions" DECIMAL(18, 4) DEFAULT 0, "net_salary" DECIMAL(18, 4) DEFAULT 0, "status" VARCHAR(50), "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
      'CREATE TABLE IF NOT EXISTS "assets" ("id" VARCHAR(36) PRIMARY KEY, "company_id" VARCHAR(36), "code" VARCHAR(100), "name" VARCHAR(255) NOT NULL, "category" VARCHAR(100), "purchase_date" DATE, "purchase_cost" DECIMAL(18, 4) DEFAULT 0, "current_value" DECIMAL(18, 4) DEFAULT 0, "depreciation_rate" DECIMAL(5, 2) DEFAULT 0, "status" VARCHAR(50), "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
      'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "barcode_settings" JSONB',
      'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "allow_issue_fraction" BOOLEAN DEFAULT FALSE',
      'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "allow_receipt_fraction" BOOLEAN DEFAULT FALSE',
      'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "allow_issue_fraction_pct" DECIMAL(10, 2) DEFAULT 0',
      'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "allow_receipt_fraction_pct" DECIMAL(10, 2) DEFAULT 0',

      // ETA E-Invoicing persistent tables and column schema enforcement
      'CREATE TABLE IF NOT EXISTS "eta_settings" ("id" VARCHAR(36) PRIMARY KEY, "company_id" VARCHAR(36) NOT NULL UNIQUE REFERENCES "companies"("id") ON DELETE CASCADE, "environment" VARCHAR(20) NOT NULL DEFAULT \'preprod\', "activity_code" VARCHAR(50), "branch_id" VARCHAR(50) DEFAULT \'0\', "country_code" VARCHAR(10) DEFAULT \'EG\', "governorate" VARCHAR(100), "city" VARCHAR(100), "street" VARCHAR(255), "building_number" VARCHAR(50), "postal_code" VARCHAR(50), "client_id" TEXT, "client_secret" TEXT, "operating_key" TEXT, "last_notification_at" TIMESTAMP, "is_configured" BOOLEAN DEFAULT FALSE, "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
      'ALTER TABLE "eta_settings" ADD COLUMN IF NOT EXISTS "operating_key" TEXT',
      'ALTER TABLE "eta_settings" ADD COLUMN IF NOT EXISTS "last_notification_at" TIMESTAMP',
      'CREATE TABLE IF NOT EXISTS "eta_documents" ("id" VARCHAR(255) PRIMARY KEY, "company_id" VARCHAR(36) NOT NULL, "uuid" VARCHAR(255) NOT NULL, "submission_uuid" VARCHAR(255), "long_id" TEXT, "internal_id" VARCHAR(255) DEFAULT \'\', "type_name" VARCHAR(20) DEFAULT \'I\', "document_type_name" VARCHAR(100) DEFAULT \'فاتورة\', "document_type_version" VARCHAR(20) DEFAULT \'1.0\', "direction" VARCHAR(20) NOT NULL DEFAULT \'Received\', "status" VARCHAR(50) DEFAULT \'Valid\', "date_time_issued" TIMESTAMP WITH TIME ZONE, "date_time_received" TIMESTAMP WITH TIME ZONE, "issuer_id" VARCHAR(50), "issuer_name" TEXT, "issuer_type" VARCHAR(20), "issuer_address" TEXT, "receiver_id" VARCHAR(50), "receiver_name" TEXT, "receiver_type" VARCHAR(20), "receiver_address" TEXT, "total_sales_amount" NUMERIC(18, 4) DEFAULT 0, "total_discount_amount" NUMERIC(18, 4) DEFAULT 0, "net_amount" NUMERIC(18, 4) DEFAULT 0, "tax_amount" NUMERIC(18, 4) DEFAULT 0, "total_amount" NUMERIC(18, 4) DEFAULT 0, "extra_discount_amount" NUMERIC(18, 4) DEFAULT 0, "total_items_discount_amount" NUMERIC(18, 4) DEFAULT 0, "currency" VARCHAR(10) DEFAULT \'EGP\', "raw_data" JSONB, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, "last_synced_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "uq_eta_documents_company_uuid" UNIQUE ("company_id", "uuid"))',
      'ALTER TABLE "eta_documents" ALTER COLUMN "id" TYPE VARCHAR(255)',
      'ALTER TABLE "eta_documents" ALTER COLUMN "uuid" TYPE VARCHAR(255)',
      'ALTER TABLE "eta_documents" ALTER COLUMN "submission_uuid" TYPE VARCHAR(255)',
      'ALTER TABLE "eta_documents" ALTER COLUMN "long_id" TYPE TEXT',
      'ALTER TABLE "eta_documents" ALTER COLUMN "internal_id" TYPE VARCHAR(255)',
      'ALTER TABLE "eta_documents" ALTER COLUMN "internal_id" DROP NOT NULL',
      'CREATE INDEX IF NOT EXISTS "idx_eta_documents_company_dir" ON "eta_documents"("company_id", "direction")',
      'CREATE INDEX IF NOT EXISTS "idx_eta_documents_company_issued" ON "eta_documents"("company_id", "date_time_issued" DESC)',
      'CREATE INDEX IF NOT EXISTS "idx_eta_documents_uuid" ON "eta_documents"("uuid")',
      'CREATE TABLE IF NOT EXISTS "eta_supplier_mappings" ("id" VARCHAR(36) PRIMARY KEY, "company_id" VARCHAR(36) NOT NULL, "eta_tax_number" VARCHAR(50) NOT NULL, "eta_supplier_name" VARCHAR(255), "supplier_id" VARCHAR(36) NOT NULL, "notes" TEXT, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "uq_eta_supplier_mappings_comp_tax" UNIQUE ("company_id", "eta_tax_number"))',
      'CREATE INDEX IF NOT EXISTS "idx_eta_supplier_mappings_comp_tax" ON "eta_supplier_mappings"("company_id", "eta_tax_number")',
      'CREATE INDEX IF NOT EXISTS "idx_eta_supplier_mappings_comp_sup" ON "eta_supplier_mappings"("company_id", "supplier_id")',
      'CREATE TABLE IF NOT EXISTS "eta_item_mappings" ("id" VARCHAR(36) PRIMARY KEY, "company_id" VARCHAR(36) NOT NULL, "eta_item_code" VARCHAR(100) NOT NULL, "eta_item_name" VARCHAR(255), "eta_item_type" VARCHAR(50) DEFAULT \'EGS\', "product_id" VARCHAR(36) NOT NULL, "notes" TEXT, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "uq_eta_item_mappings_comp_code" UNIQUE ("company_id", "eta_item_code"))',
      'CREATE INDEX IF NOT EXISTS "idx_eta_item_mappings_comp_code" ON "eta_item_mappings"("company_id", "eta_item_code")',
      'CREATE INDEX IF NOT EXISTS "idx_eta_item_mappings_comp_prod" ON "eta_item_mappings"("company_id", "product_id")',
      'CREATE TABLE IF NOT EXISTS "eta_partner_cache" ("tax_id" VARCHAR(50) PRIMARY KEY, "name" TEXT, "address" TEXT, "cached_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP)'
    ];
    
    for (const q of syncQueries) {
      await pool.query(q).catch(e => console.warn(`⚠️ Forced sync warning on [${q.substring(0, 30)}...]:`, e.message));
    }

    // Initialize existing movements cost_policy to match their product's costing method
    await pool.query(`
      UPDATE inventory_movements m 
      SET cost_policy = COALESCE(p.inventory_cost_method, 'wac') 
      FROM products p 
      WHERE m.product_id = p.id AND m.cost_policy IS NULL
    `).catch(e => console.warn('⚠️ Failed to migrate cost_policy:', e.message));

    await pool.query(`
      UPDATE inventory_movements 
      SET cost_policy = 'wac' 
      WHERE cost_policy IS NULL
    `).catch(e => console.warn('⚠️ Failed to set fallback cost_policy:', e.message));

    // Restore historical movements before the policy change (before or on 2026-05-31) to WAC costing policy
    await pool.query(`
      UPDATE inventory_movements 
      SET cost_policy = 'wac' 
      WHERE date <= '2026-05-31'
    `).catch(e => console.warn('⚠️ Failed to restore historical WAC movements:', e.message));

    // Backfill transfer_number for existing cash_transfers
    await pool.query(`
      UPDATE "cash_transfers" 
      SET "transfer_number" = 'CT-' || TO_CHAR(date, 'YYYY-MM') || '-' || LPAD(SUBSTRING(id FROM 1 FOR 8), 6, '0') 
      WHERE "transfer_number" IS NULL
    `).catch(e => console.warn('⚠️ Failed to backfill transfer_number:', e.message));

    await runMigrations();

    // Auto-backfill any missing journal entries for documents on server start (in background)
    import("./src/lib/backfill.js")
      .then(({ backfillMissingJournalEntries }) => {
        backfillMissingJournalEntries(pool).catch((err: any) => {
          console.error("⚠️ Failed to backfill missing journal entries:", err.message);
        });
      })
      .catch((e) => {
        console.error("⚠️ Failed to load backfill module:", e.message);
      });

    // Auto-reconcile Goods Receipt quantities and statuses on startup (in background)
    setTimeout(async () => {
      console.log("🔄 Reconciling Goods Receipt quantities and statuses in background...");
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        // 1. Reconcile all Auto-Generated Goods Receipts
        await client.query(`
          UPDATE goods_receipt_items 
          SET billed_quantity = quantity, remaining_quantity = 0 
          WHERE goods_receipt_id IN (
            SELECT id FROM goods_receipts 
            WHERE document_origin = 'Purchase Invoice (Auto Generated)'
          )
        `);
        await client.query(`
          UPDATE goods_receipts 
          SET billing_status = 'fully_invoiced' 
          WHERE document_origin = 'Purchase Invoice (Auto Generated)'
        `);

        // 2. Reset manual Goods Receipts
        await client.query(`
          UPDATE goods_receipt_items 
          SET billed_quantity = 0, remaining_quantity = quantity 
          WHERE goods_receipt_id IN (
            SELECT id FROM goods_receipts 
            WHERE document_origin IS NULL OR document_origin != 'Purchase Invoice (Auto Generated)'
          )
        `);
        await client.query(`
          UPDATE goods_receipts 
          SET billing_status = 'uninvoiced' 
          WHERE document_origin IS NULL OR document_origin != 'Purchase Invoice (Auto Generated)'
        `);

        // 3. Re-allocate manual links FIFO-style
        const linksRes = await client.query(`
          SELECT pigr.purchase_invoice_id, pigr.goods_receipt_id, pi.date, pi.company_id
          FROM purchase_invoice_goods_receipts pigr
          JOIN purchase_invoices pi ON pigr.purchase_invoice_id = pi.id
          JOIN goods_receipts gr ON pigr.goods_receipt_id = gr.id
          WHERE gr.document_origin IS NULL OR gr.document_origin != 'Purchase Invoice (Auto Generated)'
          ORDER BY pi.date ASC, pi.created_at ASC
        `);

        const links = linksRes.rows;
        for (const link of links) {
          const invoiceId = link.purchase_invoice_id;
          const grId = link.goods_receipt_id;

          const invItemsRes = await client.query(
            "SELECT product_id, quantity FROM purchase_invoice_items WHERE invoice_id = $1",
            [invoiceId]
          );
          const invoiceItems = invItemsRes.rows;

          const grItemsRes = await client.query(
            "SELECT id, product_id, quantity, billed_quantity, remaining_quantity FROM goods_receipt_items WHERE goods_receipt_id = $1",
            [grId]
          );
          const grItems = grItemsRes.rows.map((item: any) => ({
            ...item,
            quantity: parseFloat(item.quantity || '0'),
            billed_quantity: parseFloat(item.billed_quantity || '0'),
            remaining_quantity: parseFloat(item.remaining_quantity !== null && item.remaining_quantity !== undefined ? item.remaining_quantity : (item.quantity || '0'))
          }));

          for (const invItem of invoiceItems) {
            const prodId = invItem.product_id;
            const invoiceQty = parseFloat(invItem.quantity || '0');
            if (invoiceQty <= 0) continue;

            let unallocatedQty = invoiceQty;
            for (const grItem of grItems) {
              if (grItem.product_id !== prodId) continue;
              if (unallocatedQty <= 0) break;

              const availableToBill = grItem.remaining_quantity;
              if (availableToBill <= 0) continue;

              const allocation = Math.min(unallocatedQty, availableToBill);
              grItem.billed_quantity = parseFloat((grItem.billed_quantity + allocation).toFixed(4));
              grItem.remaining_quantity = parseFloat((grItem.remaining_quantity - allocation).toFixed(4));
              unallocatedQty = parseFloat((unallocatedQty - allocation).toFixed(4));

              await client.query(
                "UPDATE goods_receipt_items SET billed_quantity = $1, remaining_quantity = $2 WHERE id = $3",
                [grItem.billed_quantity, grItem.remaining_quantity, grItem.id]
              );
            }
          }
        }

        // 4. Recalculate overall billing status for all Goods Receipts
        const allGrsRes = await client.query("SELECT id FROM goods_receipts");
        for (const gr of allGrsRes.rows) {
          const grId = gr.id;
          const itemsRes = await client.query(
            "SELECT quantity, billed_quantity, remaining_quantity FROM goods_receipt_items WHERE goods_receipt_id = $1",
            [grId]
          );
          const grItemsList = itemsRes.rows.map((item: any) => ({
            quantity: parseFloat(item.quantity || '0'),
            billed_quantity: parseFloat(item.billed_quantity || '0'),
            remaining_quantity: parseFloat(item.remaining_quantity !== null && item.remaining_quantity !== undefined ? item.remaining_quantity : (item.quantity || '0'))
          }));

          let billingStatus = 'uninvoiced';
          if (grItemsList.length > 0) {
            const allFullyBilled = grItemsList.every((i: any) => i.remaining_quantity <= 0.0001);
            const allUnbilled = grItemsList.every((i: any) => i.billed_quantity <= 0.0001);
            if (allFullyBilled) {
              billingStatus = 'fully_invoiced';
            } else if (allUnbilled) {
              billingStatus = 'uninvoiced';
            } else {
              billingStatus = 'partially_invoiced';
            }
          }

          await client.query(
            "UPDATE goods_receipts SET billing_status = $1 WHERE id = $2",
            [billingStatus, grId]
          );
        }

        await client.query('COMMIT');
        console.log("✅ Goods Receipt reconciliation complete.");
      } catch (err: any) {
        await client.query('ROLLBACK');
        console.error("⚠️ Failed to reconcile Goods Receipts:", err.message);
      } finally {
        client.release();
      }
    }, 0);
    
    // Auto-fix orphaned movements on startup (in background)
    setTimeout(async () => {
      console.log("🧹 Cleaning up orphaned inventory movements in background...");
      try {
        const tables = [
          { type: 'invoice', table: 'invoices' },
          { type: 'purchase_invoice', table: 'purchase_invoices' },
          { type: 'returns', table: 'returns' },
          { type: 'purchase_returns', table: 'purchase_returns' }
        ];
        for (const { type, table } of tables) {
          await pool.query(`DELETE FROM inventory_movements WHERE reference_type = $1 AND reference_id NOT IN (SELECT id FROM "${table}")`, [type]);
        }
        console.log("✅ Orphan cleanup complete.");
      } catch(err: any) {
        console.error("⚠️ Failed to clean orphans:", err.message);
      }
    }, 0);
    
  } catch (err) {
    console.error("❌ CRITICAL: Failed to initialize PostgreSQL database or run migrations. Server will start but may be degraded.");
  }
  
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // PDF Printing Endpoint
  app.post("/api/erp/print/pdf", async (req, res, next) => {
    const { templateName, dto } = req.body;
    console.log('[PDF-ENDPOINT] ▶ ENTER POST /api/erp/print/pdf | template:', templateName);
    try {
      // ─ STEP: validate input ──────────────────────────────────────────
      if (!templateName || !dto) {
        console.warn('[PDF-ENDPOINT] ⚠ Missing templateName or dto in request body');
        return res.status(400).json({ error: "Missing templateName or dto" });
      }
      // ─ STEP: read data ─────────────────────────────────────────────
      console.log('[PDF-ENDPOINT] ▶ Data received | templateName:', templateName, '| dto keys:', Object.keys(dto || {}).join(', '));
      // ─ STEP: generate PDF ─────────────────────────────────────────
      console.log('[PDF-ENDPOINT] ▶ Calling generatePDF...');
      const pdfBuffer = await generatePDF(templateName, dto);
      // ─ STEP: send response ────────────────────────────────────────
      console.log('[PDF-ENDPOINT] ✓ PDF generated successfully | size:', pdfBuffer.length, 'bytes | Sending response 200');
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="document.pdf"');
      res.send(pdfBuffer);
    } catch (err: any) {
      // Parse failing file and line number from stack trace
      const stack = err.stack || '';
      const lines = stack.split('\n');
      const targetLine = lines[1] || '';
      const match = targetLine.match(/at\s+(?:.*\s+)?\(?([^:]+):(\d+):(\d+)\)?/);
      const fileName = match ? match[1] : 'Unknown File';
      const lineNumber = match ? match[2] : 'Unknown Line';

      // Output complete structured diagnostics to console
      console.error("=================== PDF GENERATION FAILURE ===================");
      console.error(`[PDF-ENDPOINT] ❌ FAILED POST /api/erp/print/pdf`);
      console.error(`- template: ${templateName}`);
      console.error(`- Failed File: ${fileName}`);
      console.error(`- Line Number: ${lineNumber}`);
      console.error(`- Exception Name: ${err.name || 'Error'}`);
      console.error(`- Exception Message: ${err.message}`);
      console.error(`- Stack Trace:\n${stack}`);
      console.error("==============================================================");

      // Return generic safe error to client without leaking internal paths or stack traces
      res.status(500).json({
        error: "PDF Generation failed",
        message: "An error occurred while generating the document"
      });
    }
  });


  // ERP API Routes
  app.use("/api/erp", erpRouter);

  // Excel Import Routes
  app.use("/api/erp", importRouter);

  // Subscription API Routes
  app.use("/api/subscriptions", subscriptionRouter);

  // ETA ERP Document Notification Callback Routes (Official ETA Webhook Endpoint)
  // Public URLs:
  // - https://obrain.tech/notifications/documents
  // - https://obrain.tech/api/v1.0/notifications/documents
  // - https://obrain.tech/api/v1/notifications/documents
  app.use("/notifications", etaNotificationsRouter);
  app.use("/api/v1.0/notifications", etaNotificationsRouter);
  app.use("/api/v1/notifications", etaNotificationsRouter);
  app.use("/api/erp/notifications", etaNotificationsRouter);

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "alive", version: "v2-robust-items-sync-bfd9ae1" });
  });

  // Catch-all for API routes to prevent HTML response on missing endpoints
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
  });

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    
    console.error(`[ERROR] ${req.method} ${req.url}:`, {
      message,
      stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack,
      status
    });

    res.status(status).json({
      error: message,
      status,
      timestamp: new Date().toISOString()
    });
  });

  // Root test
  app.get("/", (req, res, next) => {
    if (req.query.test === 'true') {
      return res.send("<h1>Root is Alive</h1><script>document.body.style.backgroundColor = 'orange';</script>");
    }
    next();
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting in DEVELOPMENT mode with Vite middleware");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting in PRODUCTION mode");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      }
    }));
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  try {
      const { default: pool } = await import('./src/lib/postgres.js');
      await pool.query('ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS entry_number VARCHAR(50);');
      await pool.query('ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS allowed_roles TEXT;');
      await pool.query('ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS allowed_users TEXT;');
      console.log('Successfully altered journal_entries and dashboards schema');
      await migrateExchangeRateDirections();
    } catch (e) { console.error('Failed to alter/migrate', e); }

  async function migrateExchangeRateDirections() {
    try {
      const pool = (await import("./src/lib/postgres.js")).default;
      const checkRes = await pool.query(`
        SELECT cr.rate, c.code 
        FROM currency_rates cr
        JOIN currencies c ON cr.currency_id = c.id
        WHERE UPPER(c.code) IN ('USD', 'EUR', 'AED', 'GBP', 'SAR')
        LIMIT 1
      `);
      if (checkRes.rows.length > 0) {
        const rate = Number(checkRes.rows[0].rate);
        if (rate > 0 && rate < 1.0) {
          console.log(`⚠️ [Migration] Wrong exchange rate direction detected in DB (${checkRes.rows[0].code} rate = ${rate} < 1.0). Inverting rates...`);
          await pool.query("UPDATE currency_rates SET rate = 1.0 / rate WHERE rate > 0");
          await pool.query("UPDATE exchange_rate_history SET exchange_rate = 1.0 / exchange_rate WHERE exchange_rate > 0");
          console.log("✅ [Migration] Rates inverted successfully.");
        }
      }
    } catch (err: any) {
      console.error("❌ [Migration] Failed to migrate exchange rate directions:", err.message);
    }
  }
    
  async function runScheduledExchangeRateSync() {
    try {
      const pool = (await import("./src/lib/postgres.js")).default;
      const { ExchangeRatePersistenceService } = await import('./src/services/ExchangeRatePersistenceService.js');
      
      const { rows: companies } = await pool.query('SELECT id, name, settings FROM companies');
      const now = new Date();
      
      for (const company of companies) {
        const settings = company.settings || {};
        if (!settings.enable_multi_currency) continue;
        if (settings.exchange_rate_update_method !== 'auto') continue;
        if (!settings.er_auto_update) continue;
        
        const lastUpdateStr = settings.er_last_update;
        const frequency = settings.er_frequency || 'daily';
        
        let shouldSync = false;
        if (!lastUpdateStr) {
          shouldSync = true;
        } else {
          const lastUpdate = new Date(lastUpdateStr);
          if (isNaN(lastUpdate.getTime())) {
            shouldSync = true;
          } else {
            const diffMs = now.getTime() - lastUpdate.getTime();
            const diffDays = diffMs / (1000 * 60 * 60 * 24);
            if (frequency === 'daily' && diffDays >= 1) {
              shouldSync = true;
            } else if (frequency === 'weekly' && diffDays >= 7) {
              shouldSync = true;
            }
          }
        }
        
        if (shouldSync) {
          console.log(`[Scheduler] Exchange rate sync triggered automatically for company: ${company.name} (${company.id})`);
          const baseCurrency = settings.currency || 'EGP';
          const result = await ExchangeRatePersistenceService.persistLatestRates(
            { baseCurrency },
            company.id,
            'Automatic'
          );
          
          if (result.success) {
            const updatedSettings = {
              ...settings,
              er_last_update: now.toISOString(),
              er_conn_status: 'ok',
              er_last_result: `تم بنجاح (تلقائي) — مضاف: ${result.inserted} | محدّث: ${result.updated} | متجاوز: ${result.skipped}`
            };
            await pool.query('UPDATE companies SET settings = $1 WHERE id = $2', [JSON.stringify(updatedSettings), company.id]);
            console.log(`[Scheduler] Exchange rate sync succeeded for company: ${company.name}`);
          } else {
            const updatedSettings = {
              ...settings,
              er_conn_status: 'error',
              er_last_result: `فشل (تلقائي): ${result.message}`
            };
            await pool.query('UPDATE companies SET settings = $1 WHERE id = $2', [JSON.stringify(updatedSettings), company.id]);
            console.error(`[Scheduler] Exchange rate sync failed for company ${company.name}: ${result.message}`);
          }
        }
      }
    } catch (err: any) {
      console.error('[Scheduler] Error running scheduled exchange rate sync:', err.message);
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server ready at http://0.0.0.0:${PORT}`);
    
    // Delayed worker start
    setTimeout(() => {
      runScheduledExchangeRateSync().catch(console.error);
    }, 15000);
    
    // Poll every 30 minutes
    setInterval(() => {
      runScheduledExchangeRateSync().catch(console.error);
    }, 30 * 60 * 1000);
  });
}

startServer();
