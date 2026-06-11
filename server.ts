import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import fs from "fs";
import { initDatabase } from "./src/lib/init-db";
import { runMigrations } from "./src/lib/migration-runner";
import erpRouter from "./src/lib/erp-api";

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
      'ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "barcode" VARCHAR(255)',
      'ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "image_url" TEXT',
      'ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "product_code" VARCHAR(100)',
      'ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "product_image_url" TEXT',
      'ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "operation_id" VARCHAR(36)',
      'ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "department_id" VARCHAR(36)',
      'ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "cost_center_id" VARCHAR(36)',
      'ALTER TABLE "purchase_invoice_items" ADD COLUMN IF NOT EXISTS "operation_id" VARCHAR(36)',
      'ALTER TABLE "purchase_invoice_items" ADD COLUMN IF NOT EXISTS "department_id" VARCHAR(36)',
      'ALTER TABLE "purchase_invoice_items" ADD COLUMN IF NOT EXISTS "cost_center_id" VARCHAR(36)',
      
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
      'ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "required_sub_account" BOOLEAN DEFAULT FALSE',
      
      // Products specific columns from arabic request
      'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "inventory_account_id" VARCHAR(36)',
      'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "inventory_account_name" VARCHAR(255)',
      'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "inventory_cost_method" VARCHAR(20) DEFAULT \'wac\'',
      'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "vat_account_id" VARCHAR(36)',
      'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "vat_account_name" VARCHAR(255)',
      'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "vat_rate" DECIMAL(10,4) DEFAULT 0',
      'ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "unit_cost" DECIMAL(18, 4) DEFAULT 0',
      'ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "total_cost" DECIMAL(18, 4) DEFAULT 0',
      'ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "costing_method_used" VARCHAR(50)',
      
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
      'ALTER TABLE "purchase_invoices" ADD COLUMN IF NOT EXISTS "advance_percentage" DECIMAL(5, 2) DEFAULT 0'
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

    await runMigrations();

    // Auto-backfill any missing journal entries for documents on server start
    try {
      const { backfillMissingJournalEntries } = await import("./src/lib/backfill.js");
      await backfillMissingJournalEntries(pool);
    } catch (e: any) {
      console.error("⚠️ Failed to backfill missing journal entries:", e.message);
    }
    
    // Auto-fix orphaned movements on startup
    console.log("🧹 Cleaning up orphaned inventory movements...");
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
    
  } catch (err) {
    console.error("❌ CRITICAL: Failed to initialize PostgreSQL database or run migrations. Server will start but may be degraded.");
  }
  
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // ERP API Routes
  app.use("/api/erp", erpRouter);

  // Catch-all for API routes to prevent HTML response on missing endpoints
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.send("<h1>Server is Alive</h1><script>document.body.style.backgroundColor = 'lime';</script>");
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
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting in PRODUCTION mode");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  try {
      const { default: pool } = await import('./src/lib/postgres.js');
      await pool.query('ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS entry_number VARCHAR(50);');
      console.log('Successfully altered journal_entries');
    } catch (e) { console.error('Failed to alter', e); }
    
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server ready at http://0.0.0.0:${PORT}`);
    
    // Removed auto trigger
  });
}

startServer();
