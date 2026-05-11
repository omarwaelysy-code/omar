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
      
      // Journal Entries
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
      'ALTER TABLE "receipt_vouchers" ADD COLUMN IF NOT EXISTS "description" TEXT',
      'ALTER TABLE "receipt_vouchers" ADD COLUMN IF NOT EXISTS "voucher_number" VARCHAR(50)',
      
      // Returns
      'ALTER TABLE "returns" ADD COLUMN IF NOT EXISTS "description" TEXT',
      'ALTER TABLE "purchase_invoices" ADD COLUMN IF NOT EXISTS "description" TEXT',
      'ALTER TABLE "purchase_returns" ADD COLUMN IF NOT EXISTS "description" TEXT',
      
      // Other
      'ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "required_sub_account" BOOLEAN DEFAULT FALSE'
    ];
    
    for (const q of syncQueries) {
      await pool.query(q).catch(e => console.warn(`⚠️ Forced sync warning on [${q.substring(0, 30)}...]:`, e.message));
    }

    await runMigrations();
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server ready at http://0.0.0.0:${PORT}`);
  });
}

startServer();
