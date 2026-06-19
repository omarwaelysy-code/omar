import { Router } from 'express';
import pool from './postgres';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticateToken, AuthRequest, authorizeRoles } from './auth-middleware';
import { EXPECTED_SCHEMA } from './schema-registry';
import { runMigrations } from './migration-runner';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import multer from 'multer';
import { syncCOGSForJournalEntry } from './sync-cogs';
import { recordPurchase, recordSale, recordSalesReturn, recordPurchaseReturn, recalculateProductStock, reverseAndRecalculate, recordTransfer, recordAdjustment } from './cost-engine';

export async function syncProductsCostAndJEs(client: any, companyId: string, productIds: string[]) {
  if (!productIds || productIds.length === 0) return;
  const uniqueProducts = Array.from(new Set(productIds));
  console.log(`[ERP] Auto-Syncing COGS and JEs for ${uniqueProducts.length} products...`);
  
  for (const pid of uniqueProducts) {
    await recalculateProductStock(client, companyId, pid);
  }
  
  // 1. Get all movements reference_id for these products specifically
  const movesRes = await client.query(`
    SELECT DISTINCT reference_id
    FROM inventory_movements
    WHERE movement_type IN ('sale', 'sales_return') AND company_id = $1 AND product_id = ANY($2)
  `, [companyId, uniqueProducts]);

  const refIds = movesRes.rows.map((r: any) => r.reference_id).filter(Boolean);
  if (refIds.length === 0) return;

  // 2. Fetch all related Journal Entries
  const jeRes = await client.query(`
    SELECT id, reference_id, reference_type 
    FROM journal_entries 
    WHERE reference_id = ANY($1) AND company_id = $2
  `, [refIds, companyId]);

  for (const je of jeRes.rows) {
     await syncCOGSForJournalEntry(client, companyId, je.id, je.reference_id, je.reference_type);
  }
}

const router = Router();



const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Helper to get remote IP safely
function getIp(req: any): string {
  return req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
}

// Centralized Audit Log Helper (Non-blocking)
async function logAudit(params: {
  company_id?: string;
  user_id?: string;
  username?: string;
  user_email?: string;
  action: string;
  module: string;
  details?: string;
  entity_type?: string;
  entity_id?: string;
  ip_address?: string;
  metadata?: any;
}) {
  const {
    company_id, user_id, username, user_email, action, module, 
    details, entity_type, entity_id, ip_address, metadata
  } = params;
  
  // Non-blocking fire-and-forget query
  pool.query(
    `INSERT INTO audit_logs (company_id, user_id, username, user_email, action, module, details, entity_type, entity_id, ip_address, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [company_id, user_id, username, user_email, action, module, details, entity_type, entity_id, ip_address || 'unknown', JSON.stringify(metadata || {})]
  ).catch(err => {
    // Fail silently in the background but log to console
    console.error('[DATABASE] Audit Log Failed:', err.message);
  });

  // Backward compatibility: Log to old activity_logs table too
  logActivity(
    company_id || '',
    user_id || '',
    username || '',
    `${module}:${action}`,
    details || '',
    entity_type,
    entity_id,
    metadata,
    ip_address
  );
}

// Helper to log activity (Old version, kept for compatibility)
async function logActivity(
  company_id: string,
  user_id: string,
  username: string,
  action: string,
  details: string,
  entity?: string | string[],
  document_id?: string,
  changes?: any,
  ip_address?: string
) {
  try {
    // Asynchronous non-blocking call
    pool.query(
      `INSERT INTO activity_logs (company_id, user_id, username, action, details, entity, document_id, changes, ip_address) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [company_id, user_id, username, action, details, JSON.stringify(entity), document_id, JSON.stringify(changes), ip_address]
    ).catch(err => {
      // Intentionally ignore missing column errors here to stay backward compatible
    });
  } catch (error) {
    console.error('Activity Log Error:', error);
  }
}

// Configure multer for memory storage with 50MB limit
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// List of all tables available for backup/restore
const TABLES_TO_BACKUP = [
  'companies',
  'account_types',
  'accounts',
  'users',
  'customers',
  'suppliers',
  'products',
  'item_groups',
  'warehouses',
  'payment_methods',
  'expense_categories',
  'settings',
  'invoices',
  'invoice_items',
  'returns',
  'return_items',
  'purchase_invoices',
  'purchase_returns',
  'customer_discounts',
  'supplier_discounts',
  'receipt_vouchers',
  'payment_vouchers',
  'cash_transfers',
  'journal_entries',
  'journal_entry_lines',
  'activity_logs',
  'currencies',
  'exchange_rates'
];

// --- System Diagnostics ---
router.get('/system/check', authenticateToken, authorizeRoles('super_admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    // 1. Check Tables and Columns
    const { rows: actualColumns } = await client.query(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public'
    `);

    const schemaStatus: any = {
      missingTables: [],
      missingColumns: [],
      databaseHealth: 'ok',
      dbVersion: '',
      pendingMigrations: []
    };

    // DB Version
    const { rows: versionRow } = await client.query('SELECT version()');
    schemaStatus.dbVersion = versionRow[0].version;

    const actualTableMap: { [key: string]: string[] } = {};
    actualColumns.forEach((col: any) => {
      if (!actualTableMap[col.table_name]) actualTableMap[col.table_name] = [];
      actualTableMap[col.table_name].push(col.column_name);
    });

    Object.keys(EXPECTED_SCHEMA).forEach(tableName => {
      if (!actualTableMap[tableName]) {
        schemaStatus.missingTables.push(tableName);
      } else {
        const expectedCols = EXPECTED_SCHEMA[tableName];
        const actualCols = actualTableMap[tableName];
        const missing = expectedCols.filter(col => !actualCols.includes(col));
        if (missing.length > 0) {
          schemaStatus.missingColumns.push({ table: tableName, columns: missing });
        }
      }
    });

    // 2. Check Migrations
    const dbDir = path.join(process.cwd(), 'src', 'db');
    const masterMigrationPath = path.join(dbDir, 'master-migration.sql');
    const migrationsDir = path.join(dbDir, 'migrations');

    const { rows: appliedMigrationsRows } = await client.query('SELECT name FROM migrations').catch(() => ({ rows: [] }));
    const appliedMigrations = appliedMigrationsRows.map((m: any) => m.name);

    if (fs.existsSync(masterMigrationPath) && !appliedMigrations.includes('master-migration')) {
      schemaStatus.pendingMigrations.push('master-migration');
    }

    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
      files.forEach(file => {
        if (!appliedMigrations.includes(file)) {
          schemaStatus.pendingMigrations.push(file);
        }
      });
    }

    res.json(schemaStatus);
  } catch (error: any) {
    console.error('System check failed:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

router.get('/system/test-recalc', async (req, res) => {
  const client = await pool.connect();
  try {
    const {rows} = await client.query(`SELECT product_id, company_id FROM inventory_movements WHERE reference_number LIKE '%0027%'`);
    if (rows.length === 0) return res.json({ error: 'not found' });
    const pid = rows[0].product_id;
    const cid = rows[0].company_id;
    const curr = await client.query('SELECT stock, weighted_average_cost FROM products WHERE id = $1', [pid]);
    
    // Add recalculate
    await client.query('BEGIN');
    await recalculateProductStock(client, cid, pid);
    await client.query('COMMIT');
    
    // Check results inside inventory_movements for this product
    const moves = await client.query(`
        SELECT reference_number, date::text as date, unit_cost, total_cost, quantity
        FROM inventory_movements 
        WHERE product_id = $1 
        ORDER BY date ASC, created_at ASC
    `, [pid]);
    
    const after = await client.query('SELECT stock, weighted_average_cost FROM products WHERE id = $1', [pid]);
    
    res.json({
      before: curr.rows[0],
      after: after.rows[0],
      moves: moves.rows
    });
  } catch(e: any) {
    if(client) await client.query('ROLLBACK');
    res.status(500).json({error: e.message});
  } finally {
    client.release();
  }
});

router.post('/system/fix', authenticateToken, authorizeRoles('super_admin'), async (req, res) => {
  try {
    const result = await runMigrations();
    res.json(result);
  } catch (error: any) {
    console.error('API Error in /system/fix:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Backup & Restore ---

// Export JSON
router.get('/system/backup', authenticateToken, authorizeRoles('super_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const companyId = req.query.company_id || req.user?.company_id;
    if (!companyId) return res.status(400).json({ error: 'Company ID is required' });

    const backupData: any = {
      company_id: companyId,
      exported_at: new Date().toISOString(),
      version: '1.0',
      data: {}
    };

    for (const table of TABLES_TO_BACKUP) {
      try {
        let query = `SELECT * FROM ${table} WHERE company_id = $1`;
        if (table === 'companies') {
          query = `SELECT * FROM companies WHERE id = $1`;
        }
        
        const { rows } = await pool.query(query, [companyId]).catch(() => ({ rows: [] }));
        backupData.data[table] = rows;
      } catch (e) {
        console.warn(`Skipping table during backup: ${table}`);
      }
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=backup_${companyId}_${new Date().toISOString().split('T')[0]}.json`);
    res.json(backupData);
  } catch (error: any) {
    console.error('JSON Backup failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export Excel
router.get('/system/export-excel', authenticateToken, authorizeRoles('super_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const companyId = req.query.company_id || req.user?.company_id;
    if (!companyId) return res.status(400).json({ error: 'Company ID is required' });

    const wb = XLSX.utils.book_new();

    // Helper to apply number format to numeric cells
    const applyNumberFormat = (ws: XLSX.WorkSheet) => {
      Object.keys(ws).forEach(key => {
        if (key[0] === '!') return;
        const cell = ws[key];
        if (cell.t === 'n' && typeof cell.v === 'number') {
          cell.z = '#,##0.00';
        }
      });
    };

    for (const table of TABLES_TO_BACKUP) {
      try {
        let query = `SELECT * FROM ${table} WHERE company_id = $1`;
        if (table === 'companies') {
          query = `SELECT * FROM companies WHERE id = $1`;
        }
        const { rows } = await pool.query(query, [companyId]).catch(() => ({ rows: [] }));
        if (rows.length > 0) {
          const ws = XLSX.utils.json_to_sheet(rows);
          applyNumberFormat(ws);
          XLSX.utils.book_append_sheet(wb, ws, table.substring(0, 31)); // sheet names limited to 31 chars
        }
      } catch (e) {
        console.warn(`Skipping table during excel export: ${table}`);
      }
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=backup_${companyId}_${new Date().toISOString().split('T')[0]}.xlsx`);
    res.send(buf);
  } catch (error: any) {
    console.error('Excel Export failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Import JSON
router.post('/system/restore', authenticateToken, authorizeRoles('super_admin', 'admin'), upload.single('file') as any, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    const backupData = JSON.parse(req.file.buffer.toString());
    const companyId = req.user?.company_id;
    const mode = req.query.mode || 'merge'; // 'merge' or 'replace'

    if (!backupData.data || !backupData.company_id) {
      return res.status(400).json({ error: 'Invalid backup file format' });
    }

    // Safety check: if not super_admin, can only restore to own company
    if (req.user?.role !== 'super_admin' && backupData.company_id !== companyId) {
      return res.status(403).json({ error: 'Permission denied: backup belongs to another company' });
    }

    const targetCompanyId = backupData.company_id;

    await client.query('BEGIN');

    if (mode === 'replace') {
      // Tables should be deleted in reverse order of dependencies if FKs exist
      // For simplicity, we'll try to delete all company data
      for (const table of [...TABLES_TO_BACKUP].reverse()) {
        try {
          await client.query(`DELETE FROM ${table} WHERE company_id = $1`, [targetCompanyId]);
        } catch (e) {
          console.warn(`Failed to clear table ${table}:`, e);
        }
      }
    }

    for (const table of TABLES_TO_BACKUP) {
      const rows = backupData.data[table];
      if (!rows || !Array.isArray(rows)) continue;

      for (const row of rows) {
        const keys = Object.keys(row);
        const values = Object.values(row);
        
        // Ensure company_id matches target
        const companyIdIndex = keys.indexOf('company_id');
        if (companyIdIndex !== -1) {
          values[companyIdIndex] = targetCompanyId;
        }

        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        const updateClause = keys.map((k, i) => `${k} = EXCLUDED.${k}`).join(', ');

        await client.query(
          `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})
           ON CONFLICT (id) DO UPDATE SET ${updateClause}`,
          values
        );
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Restore successful', mode });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('JSON Restore failed:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Import Excel
router.post('/system/import-excel', authenticateToken, authorizeRoles('super_admin', 'admin'), upload.single('file') as any, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const companyId = req.user?.company_id;
    const mode = req.query.mode || 'merge';

    await client.query('BEGIN');

    if (mode === 'replace' && companyId) {
      for (const table of [...TABLES_TO_BACKUP].reverse()) {
        try {
          await client.query(`DELETE FROM ${table} WHERE company_id = $1`, [companyId]);
        } catch (e) {
          console.warn(`Failed to clear table ${table}:`, e);
        }
      }
    }

    for (const sheetName of workbook.SheetNames) {
      const table = sheetName;
      if (!TABLES_TO_BACKUP.includes(table)) continue;

      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]) as any[];
      for (const row of rows) {
        if (!row.id) continue;
        
        // Match user's company
        row.company_id = companyId;

        const keys = Object.keys(row);
        const values = Object.values(row);
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        const updateClause = keys.map((k, i) => `${k} = EXCLUDED.${k}`).join(', ');

        await client.query(
          `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})
           ON CONFLICT (id) DO UPDATE SET ${updateClause}`,
          values
        );
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Excel import successful', mode });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('Excel Import failed:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Database Health Check
router.get('/db-health', async (req, res) => {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    res.json({ 
      status: 'ok', 
      message: 'Database connected successfully'
    });
  } catch (error: any) {
    console.error('Database health check failed:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Database connection failed', 
      error: error.message,
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || '5432'
    });
  }
});

// Helper for generic list
const getList = async (table: string, filters: any) => {
  let sql;
  const journaledTables = [
    'invoices', 'purchase_invoices', 'receipt_vouchers', 'payment_vouchers',
    'returns', 'purchase_returns', 'cash_transfers', 'customer_discounts',
    'supplier_discounts', 'opening_stock_balances', 'stock_adjustments',
    'warehouse_transfers'
  ];
  if (journaledTables.includes(table)) {
    sql = `SELECT t.*, (SELECT entry_number FROM journal_entries je WHERE je.reference_id = t.id LIMIT 1) AS entry_number FROM "${table}" t`;
  } else {
    sql = `SELECT * FROM "${table}"`;
  }
  const values: any[] = [];
  const conditions: string[] = [];
  
  let paramIndex = 1;
  Object.keys(filters).forEach((key) => {
    // ── Skip meta-params (_limit, _sort, _order, _page, _search, etc.)
    //    They are NOT column names. The paginated branch already guards these;
    //    this guard was missing here, causing HTTP 500 on exchange_rates queries.
    if (key.startsWith('_')) return;

    const value = filters[key];
    
    if (key === 'date_from') {
      conditions.push(`date >= $${paramIndex++}`);
      values.push(value);
    } else if (key === 'date_to') {
      conditions.push(`date <= $${paramIndex++}`);
      values.push(value);
    } else {
      conditions.push(`"${key}" = $${paramIndex++}`);
      values.push(value);
    }
  });
  
  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }
  
  // Default sorting for report tables
  const reportTables = ['journal_entries', 'invoices', 'receipt_vouchers', 'payment_vouchers', 'purchase_invoices', 'purchase_returns', 'returns'];
  if (reportTables.includes(table)) {
    sql += ' ORDER BY date DESC, id DESC';
  } else if (filters._sort) {
    // Honour explicit _sort / _order meta-params when present (e.g. exchange_rates?_sort=rate_date&_order=desc)
    const col   = String(filters._sort).replace(/[^a-zA-Z0-9_]/g, '');   // sanitise
    const order = String(filters._order || 'asc').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    sql += ` ORDER BY "${col}" ${order}`;
  }

  // Honour _limit meta-param
  if (filters._limit) {
    const lim = parseInt(String(filters._limit), 10);
    if (!isNaN(lim) && lim > 0) sql += ` LIMIT ${lim}`;
  }
  
  const { rows } = await pool.query(sql, values);
  return rows;
};

// --- Authentication & Users ---
router.post('/auth/register', async (req, res) => {
  try {
    const { username, name, email, password, company_id, role } = req.body;
    const id = uuidv4();
    const password_hash = await bcrypt.hash(password, 10);
    
    await pool.query(
      'INSERT INTO users (id, username, name, email, password_hash, company_id, role) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [id, username, name || username, email, password_hash, company_id, role || 'user']
    );
    
    // Log registration
    logAudit({
      company_id,
      user_id: id,
      username: username || email,
      user_email: email,
      action: 'REGISTER',
      module: 'AUTH',
      details: `New user registration: ${username}`,
      entity_type: 'users',
      entity_id: id,
      ip_address: getIp(req)
    });

    res.status(201).json({ id, username, name: name || username, email, role: role || 'user' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { rows }: any = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    let isPasswordValid = await bcrypt.compare(password, user.password_hash);
    
    // Support temporary passwords
    if (!isPasswordValid && user.temp_password && password === user.temp_password) {
      isPasswordValid = true;
    }

    if (!isPasswordValid) {
      logAudit({
        action: 'LOGIN_FAILED',
        module: 'AUTH',
        details: `Login failure for: ${email}`,
        ip_address: getIp(req)
      });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Log login activity
    logAudit({
      company_id: user.company_id,
      user_id: user.id,
      username: user.username || user.name || user.email,
      user_email: user.email,
      action: 'LOGIN',
      module: 'AUTH',
      details: `User logged in: ${user.username || user.email}`,
      entity_type: 'auth',
      entity_id: user.id,
      ip_address: getIp(req)
    });

    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        company_id: user.company_id, 
        role: user.role, 
        username: user.username || user.name || user.email 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ 
      token, 
      user: { 
        id: user.id, 
        username: user.username, 
        name: user.name,
        email: user.email, 
        company_id: user.company_id, 
        role: user.role 
      } 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/auth/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { rows }: any = await pool.query('SELECT id, username, name, email, role, company_id FROM users WHERE id = $1', [req.user?.id]);
    const user = rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/auth/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// --- Generic CRUD Factory ---
const modules = [
  'customers', 'suppliers', 'products', 'item_groups', 'warehouses', 'payment_methods', 
  'expense_categories', 'accounts', 'account_types', 'settings', 'users', 'companies',
  'invoices', 'invoice_items', 'journal_entries', 'journal_entry_lines', 'activity_logs',
  'returns', 'return_items', 'purchase_invoices', 'purchase_returns', 
  'customer_discounts', 'supplier_discounts', 'receipt_vouchers', 'payment_vouchers', 'cash_transfers',
  'system_config', 'audit_logs', 'operation_categories', 'operations', 'operation_fields',
  'departments', 'cost_centers', 'operation_field_values', 'field_operation_categories',
  'currencies', 'exchange_rates', 'inventory_movements', 'inventory_layers',
  'sales_orders', 'sales_order_items', 'purchase_orders', 'purchase_order_items', 'employees',
  'warehouse_transfers', 'warehouse_transfer_items', 'opening_stock_balances', 'opening_stock_items',
  'stock_adjustments', 'stock_adjustment_items'
];

// --- Flexible Operations Logic ---
router.get('/operation_fields/by-category/:categoryId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { categoryId } = req.params;
    const companyId = req.user?.company_id;

    console.log(`[DEBUG] Fetching fields for category: ${categoryId}, company: ${companyId}`);

    if (!companyId) return res.status(401).json({ error: 'Unauthorized' });

    // 1. Get the category and its parents (recursive query)
    const categoryQuery = `
      WITH RECURSIVE category_tree AS (
        SELECT id::text, parent_id::text FROM operation_categories WHERE id::text = $1 AND company_id = $2
        UNION ALL
        SELECT c.id::text, c.parent_id::text FROM operation_categories c
        INNER JOIN category_tree ct ON c.id::text = ct.parent_id::text
      )
      SELECT id FROM category_tree;
    `;
    
    // If categoryId is 'null' or empty, we just look for general fields
    let categoryIds: string[] = [];
    if (categoryId && categoryId !== 'null' && categoryId !== 'undefined' && categoryId !== '') {
      const { rows: treeRows } = await pool.query(categoryQuery, [categoryId, companyId]);
      categoryIds = treeRows.map(r => r.id);
      console.log(`[DEBUG] Category IDs found in tree for ${categoryId}:`, categoryIds);
    } else {
      console.log(`[DEBUG] No category selected or categoryId invalid: ${categoryId}`);
    }

    // 2. Fetch fields: 
    // - Linked to selected category or its parents via field_operation_categories
    // - OR Direct category_id match
    // - OR Direct operation_category_id match (fallback)
    // - OR General fields (both category_id is null AND no links found)
    let fieldsQuery = `
      SELECT DISTINCT f.* FROM operation_fields f
      LEFT JOIN field_operation_categories fc ON f.id::text = fc.field_id::text
      WHERE (f.company_id = $1)
      AND (
        (f.category_id IS NULL AND f.operation_category_id IS NULL AND NOT EXISTS (SELECT 1 FROM field_operation_categories WHERE field_id::text = f.id::text))
    `;

    const params: any[] = [companyId];
    if (categoryIds.length > 0) {
      fieldsQuery += ` 
        OR f.category_id::text = ANY($2)
        OR f.operation_category_id::text = ANY($2)
        OR fc.category_id::text = ANY($2)
      `;
      params.push(categoryIds);
    }
    fieldsQuery += `) ORDER BY f.sort_order ASC, f.name ASC`;

    console.log(`[DEBUG] Fields Query:`, fieldsQuery);
    console.log(`[DEBUG] Params:`, JSON.stringify(params));

    const { rows: fields } = await pool.query(fieldsQuery, params);
    console.log(`[DEBUG] Found ${fields.length} dynamic fields.`);
    if (fields.length > 0) {
      console.log(`[DEBUG] First field sample:`, JSON.stringify(fields[0]));
    }
    res.json(fields.map(f => parseRow('operation_fields', f)));
  } catch (error: any) {
    console.error('Error fetching fields by category:', error);
    res.status(500).json({ error: error.message });
  }
});

const transactionalModules = ['invoices', 'returns', 'purchase_invoices', 'purchase_returns', 'journal_entries', 'sales_orders', 'purchase_orders', 'warehouse_transfers', 'opening_stock_balances', 'stock_adjustments'];

// Helper to validate ID format (simplified to check string)
function isUUID(id: any): boolean {
  return typeof id === 'string' && id.length > 0;
}

// Helper for better error responses
function sendError(res: any, status: number, message: string, details?: any) {
  return res.status(status).json({
    error: message,
    status,
    details: details || null,
    timestamp: new Date().toISOString()
  });
}

// Helper to parse JSONB fields if they are returned as strings
function parseRow(table: string, row: any) {
  if (!row) return row;
  const jsonbFields = ['entity', 'category', 'changes', 'items', 'settings', 'permissions', 'metadata', 'features', 'options', 'settlements'];
  
  const parsed = { ...row };
  jsonbFields.forEach(field => {
    if (field in parsed && parsed[field] !== null && typeof parsed[field] === 'string') {
      try {
        const val = parsed[field].trim();
        // If it looks like JSON, try to parse it
        if ((val.startsWith('{') && val.endsWith('}')) || 
            (val.startsWith('[') && val.endsWith(']'))) {
          parsed[field] = JSON.parse(val);
        }
      } catch (e) {
        // Not JSON, keep as string
      }
    }
  });
  return parsed;
}

// Helper to sanitize data for a table by filtering out keys not in EXPECTED_SCHEMA
function sanitizeData(table: string, data: any) {
  const allowedKeys = EXPECTED_SCHEMA[table];
  if (!allowedKeys) return data;
  
  const sanitized: any = {};
  const jsonbFields = ['entity', 'category', 'changes', 'items', 'settings', 'permissions', 'metadata', 'features', 'value', 'options', 'settlements'];

  allowedKeys.forEach(key => {
    if (key in data) {
      let value = data[key];
      
      // Convert empty strings to null for IDs, decimals and dates
      if (value === '' && (key.endsWith('_id') || key.endsWith('_date') || key === 'date' || key === 'amount' || key === 'price' || key === 'unit_price' || key === 'total' || key === 'subtotal')) {
        value = null;
      } 
      
      // Strict VARCHAR validation for ID fields (except those known to be BIGSERIAL)
      const isIdField = key === 'id' || key.endsWith('_id');
      const excludedFromCheck = ['activity_logs', 'migrations'];
      const isVarcharTable = !excludedFromCheck.includes(table);
      
      if (isIdField && isVarcharTable && value !== null && typeof value !== 'string') {
        console.warn(`[WARN] Invalid format for field ${table}.${key}: ${value}. Expected string.`);
        // Note: we don't nullify here if it's already a non-string, 
        // but Postgres will fail if type mismatch.
      }

      // Automatically stringify for JSONB columns
      if (jsonbFields.includes(key) && value !== null && typeof value !== 'string') {
        sanitized[key] = JSON.stringify(value);
      }
      else {
        sanitized[key] = value;
      }
    }
  });
  return sanitized;
}

export async function generateNextSequence(client: any, companyId: string, moduleName: string, dateStr: string): Promise<string> {
  let numField = 'invoice_number';
  let prefix = 'INV';
  
  switch (moduleName) {
    case 'invoices': numField = 'invoice_number'; prefix = 'INV'; break;
    case 'purchase_invoices': numField = 'invoice_number'; prefix = 'PINV'; break;
    case 'returns': numField = 'return_number'; prefix = 'RET'; break;
    case 'purchase_returns': numField = 'return_number'; prefix = 'PRET'; break;
    case 'payment_vouchers': numField = 'voucher_number'; prefix = 'PV'; break;
    case 'receipt_vouchers': numField = 'voucher_number'; prefix = 'RV'; break;
    case 'journal_entries': numField = 'entry_number'; prefix = 'JE'; break;
    case 'sales_orders': numField = 'order_number'; prefix = 'SO'; break;
    case 'purchase_orders': numField = 'order_number'; prefix = 'PO'; break;
    case 'employees': numField = 'employee_code'; prefix = 'EMP'; break;
    case 'warehouse_transfers': numField = 'transfer_number'; prefix = 'TR'; break;
    case 'opening_stock_balances': numField = 'document_number'; prefix = 'OPB'; break;
    case 'stock_adjustments': numField = 'adjustment_number'; prefix = 'ADJ'; break;
    case 'cash_transfers': numField = 'transfer_number'; prefix = 'CT'; break;
  }

  if (moduleName === 'employees') {
    const sql = `SELECT employee_code FROM "employees" WHERE company_id = $1 ORDER BY id DESC LIMIT 500`;
    const rows = await client.query(sql, [companyId]);
    let maxSeq = 0;
    rows.rows.forEach((row: any) => {
      const val = row.employee_code || '';
      const parts = val.split('-');
      if (parts.length === 2 && parts[0] === 'EMP') {
        const seq = parseInt(parts[1], 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    });
    const nextSeq = String(maxSeq + 1).padStart(6, '0');
    return `EMP-${nextSeq}`;
  }

  if (moduleName === 'sales_orders' || moduleName === 'purchase_orders') {
    const parts = dateStr.slice(0, 10).split('-');
    const year = parts[0];
    const month = parts[1].padStart(2, '0');
    const datePrefix = `${prefix}-${year}-${month}`;
    
    const sql = `SELECT ${numField} FROM "${moduleName}" WHERE company_id = $1 AND ${numField} LIKE $2 ORDER BY id DESC LIMIT 500`;
    const rows = await client.query(sql, [companyId, `${datePrefix}-%`]);
    let maxSeq = 0;
    rows.rows.forEach((row: any) => {
       const val = row[numField] || '';
       const valParts = val.split('-');
       if (valParts.length >= 4) {
         const seq = parseInt(valParts[valParts.length - 1], 10);
         if (!isNaN(seq) && seq > maxSeq) {
           maxSeq = seq;
         }
       }
    });
    const nextSeq = String(maxSeq + 1).padStart(6, '0');
    return `${datePrefix}-${nextSeq}`;
  }

  if (moduleName === 'journal_entries') {
    // Requested format: JE-YYYY-MM-DD-00001
    const parts = dateStr.slice(0, 10).split('-');
    const year = parts[0];
    const month = parts[1].padStart(2, '0');
    const day = parts[2].padStart(2, '0');
    const datePrefix = `JE-${year}-${month}-${day}`;
    
    // Using LIKE to match anything starting with this prefix
    const sql = `SELECT ${numField} FROM "${moduleName}" WHERE company_id = $1 AND ${numField} LIKE $2 ORDER BY id DESC LIMIT 500`;
    const rows = await client.query(sql, [companyId, `${datePrefix}-%`]);
    let maxSeq = 0;
    rows.rows.forEach((row: any) => {
       const val = row[numField] || '';
       const valParts = val.split('-');
       if (valParts.length >= 5) {
         const seq = parseInt(valParts[valParts.length - 1], 10);
         if (!isNaN(seq) && seq > maxSeq) {
           maxSeq = seq;
         }
       }
    });
    const nextSeq = String(maxSeq + 1).padStart(5, '0');
    return `${datePrefix}-${nextSeq}`;
  } else {
    // New format: PREFIX-YYYY-MM-NNNNNN
    const parts = dateStr.slice(0, 10).split('-');
    const year = parts[0];
    const month = parts[1].padStart(2, '0');
    const datePrefix = `${prefix}-${year}-${month}`;
    
    const sql = `SELECT ${numField} FROM "${moduleName}" WHERE company_id = $1 AND ${numField} LIKE $2 ORDER BY id DESC LIMIT 500`;
    const rows = await client.query(sql, [companyId, `${datePrefix}-%`]);
    let maxSeq = 0;
    rows.rows.forEach((row: any) => {
      const val = row[numField] || '';
      const valParts = val.split('-');
      if (valParts.length >= 4) {
        const seq = parseInt(valParts[valParts.length - 1], 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    });
    const nextSeq = String(maxSeq + 1).padStart(6, '0');
    return `${datePrefix}-${nextSeq}`;
  }
}

router.get('/utils/next-sequence/:moduleName', authenticateToken, async (req: any, res) => {
  try {
    const { moduleName } = req.params;
    const dateStr = req.query.date as string || new Date().toISOString().slice(0, 10);
    const companyId = req.user?.company_id;
    
    if (!companyId) return res.status(401).json({ error: 'Unauthorized' });

    const nextNumber = await generateNextSequence(pool, companyId, moduleName, dateStr);
    
    res.json({ nextNumber });
  } catch (error: any) {
    console.error(`Error generating sequence:`, error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/detailed-journal-entries', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const isSuperAdmin = req.user?.role === 'super_admin';
    const companyId = isSuperAdmin ? req.query.company_id : (req.query.company_id || req.user?.company_id);
    
    if (!companyId) return res.status(400).json({ error: 'company_id is required' });

    const page = parseInt(req.query._page as string, 10) || 1;
    const limit = parseInt(req.query._limit as string, 10) || 50;
    const offset = (page - 1) * limit;
    const search = (req.query._search as string) || '';
    const dateFrom = req.query.date_from as string;
    const dateTo = req.query.date_to as string;

    let sql = `
      SELECT 
        jel.id as line_id,
        jel.debit,
        jel.credit,
        jel.description as line_description,
        jel.account_id,
        jel.account_name,
        
        -- Get customer/supplier from current line or any line in the same entry (opposite party)
        COALESCE(jel.customer_name, (
          SELECT customer_name 
          FROM journal_entry_lines 
          WHERE journal_entry_id = je.id AND customer_name IS NOT NULL AND customer_name != '' 
          LIMIT 1
        )) as customer_name,
        COALESCE(jel.supplier_name, (
          SELECT supplier_name 
          FROM journal_entry_lines 
          WHERE journal_entry_id = je.id AND supplier_name IS NOT NULL AND supplier_name != '' 
          LIMIT 1
        )) as supplier_name,
        COALESCE(jel.customer_id, (
          SELECT customer_id 
          FROM journal_entry_lines 
          WHERE journal_entry_id = je.id AND customer_id IS NOT NULL 
          LIMIT 1
        )) as customer_id,
        COALESCE(jel.supplier_id, (
          SELECT supplier_id 
          FROM journal_entry_lines 
          WHERE journal_entry_id = je.id AND supplier_id IS NOT NULL 
          LIMIT 1
        )) as supplier_id,
        
        jel.sub_account_id,
        jel.sub_account_type,
        je.id as journal_entry_id,
        je.entry_number,
        je.date,
        je.description as entry_description,
        je.reference_type,
        je.reference_number,
        je.reference_id,
        
        -- Account Type & Parent Account details
        act.name as account_type_name,
        parent_acc.name as parent_account_name,
        
        -- Currency & Foreign Currency details if available
        COALESCE(inv.currency_id, pinv.currency_id) as currency_id,
        cur.code as currency_code,
        cur.symbol as currency_symbol,
        COALESCE(inv.exchange_rate, pinv.exchange_rate) as exchange_rate,
        CASE 
          WHEN COALESCE(inv.exchange_rate, pinv.exchange_rate, 1) > 0 THEN 
            (jel.debit + jel.credit) / COALESCE(inv.exchange_rate, pinv.exchange_rate, 1)
          ELSE NULL
        END as foreign_amount,
        
        -- Operation, Department, Cost Center
        COALESCE(inv.operation_id, pinv.operation_id) as operation_id,
        op.operation_number as operation_number,
        COALESCE(inv.department_id, pinv.department_id) as department_id,
        dept.name as department_name,
        COALESCE(inv.cost_center_id, pinv.cost_center_id) as cost_center_id,
        cc.name as cost_center_name,
        cc.code as cost_center_code,
        
        -- Product/Item names list
        CASE 
          WHEN je.reference_type = 'invoice' THEN 
            (SELECT string_agg(product_name, ', ') FROM invoice_items WHERE invoice_id = je.reference_id)
          WHEN je.reference_type = 'purchase_invoice' THEN 
            (SELECT string_agg(COALESCE(product_name, category_name), ', ') FROM purchase_invoice_items WHERE invoice_id = je.reference_id)
          WHEN je.reference_type = 'return' THEN 
            (SELECT string_agg(product_name, ', ') FROM return_items WHERE return_id = je.reference_id)
          WHEN je.reference_type = 'purchase_return' THEN 
            (SELECT string_agg(product_name, ', ') FROM purchase_return_items WHERE return_id = je.reference_id)
          ELSE NULL
        END as product_names
      FROM journal_entry_lines jel
      JOIN journal_entries je ON jel.journal_entry_id = je.id
      LEFT JOIN accounts acc ON jel.account_id = acc.id
      LEFT JOIN accounts parent_acc ON acc.parent_id = parent_acc.id
      LEFT JOIN account_types act ON acc.type_id = act.id
      LEFT JOIN invoices inv ON je.reference_type = 'invoice' AND je.reference_id = inv.id
      LEFT JOIN purchase_invoices pinv ON je.reference_type = 'purchase_invoice' AND je.reference_id = pinv.id
      LEFT JOIN currencies cur ON cur.id = COALESCE(inv.currency_id, pinv.currency_id)
      LEFT JOIN operations op ON op.id = COALESCE(inv.operation_id, pinv.operation_id)
      LEFT JOIN departments dept ON dept.id = COALESCE(inv.department_id, pinv.department_id)
      LEFT JOIN cost_centers cc ON cc.id = COALESCE(inv.cost_center_id, pinv.cost_center_id)
    `;

    const values: any[] = [];
    const conditions: string[] = [];
    let paramIndex = 1;

    // Filter by company
    conditions.push(`je.company_id = $${paramIndex++}`);
    values.push(companyId);

    // Filter by date
    if (dateFrom) {
      conditions.push(`je.date >= $${paramIndex++}`);
      values.push(dateFrom);
    }
    if (dateTo) {
      conditions.push(`je.date <= $${paramIndex++}`);
      values.push(dateTo);
    }

    // Filter by search term
    if (search) {
      conditions.push(`(
        je.entry_number ILIKE $${paramIndex} OR
        jel.account_name ILIKE $${paramIndex} OR
        jel.description ILIKE $${paramIndex} OR
        je.description ILIKE $${paramIndex} OR
        jel.customer_name ILIKE $${paramIndex} OR
        jel.supplier_name ILIKE $${paramIndex} OR
        je.reference_number ILIKE $${paramIndex} OR
        je.reference_type ILIKE $${paramIndex}
      )`);
      values.push(`%${search}%`);
      paramIndex++;
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Get count
    const countSql = `SELECT count(*) as total FROM (${sql}) t`;
    const countRes = await pool.query(countSql, values);
    const total = parseInt(countRes.rows[0].total, 10);

    // Get summary (Total Debit / Credit)
    const sumSql = `SELECT sum(debit) as total_debit, sum(credit) as total_credit FROM (${sql}) t`;
    const sumRes = await pool.query(sumSql, values);
    const summary = {
      total_debit: Number(sumRes.rows[0].total_debit || 0),
      total_credit: Number(sumRes.rows[0].total_credit || 0)
    };

    // Sort: Date DESC, Entry Number DESC, Line ID ASC (to keep lines within an entry grouped and ordered)
    sql += ` ORDER BY je.date DESC, je.entry_number DESC, jel.id ASC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    values.push(limit, offset);

    const queryResult = await pool.query(sql, values);
    
    res.json({
      data: queryResult.rows,
      total,
      summary,
      page,
      limit
    });
  } catch (error: any) {
    console.error('Error fetching detailed journal entries:', error);
    res.status(500).json({ error: error.message });
  }
});

modules.forEach(moduleName => {
  const hyphenName = moduleName.replace(/_/g, '-');
  const routeNames = [moduleName];
  if (hyphenName !== moduleName) routeNames.push(hyphenName);

  routeNames.forEach(rn => {
    // List with filters
    router.get(`/${rn}`, authenticateToken, async (req: AuthRequest, res) => {
      try {
        let rows;
        if (moduleName === 'activity_logs') {
        const isSuperAdmin = req.user?.role === 'super_admin';
        const companyId = isSuperAdmin ? req.query.company_id : (req.query.company_id || req.user?.company_id);
        
        // Basic validation for company_id if provided (though it's VARCHAR(36) in activity_logs, usually matches user's company_id)
        if (companyId && typeof companyId !== 'string') return sendError(res, 400, 'Invalid company_id format');

        let query = 'SELECT * FROM activity_logs';
        let params: any[] = [];
        
        if (companyId) {
          query += ' WHERE company_id = $1';
          params.push(companyId);
        }
        
        const colCheck = await pool.query(`
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'activity_logs' AND column_name = 'created_at'
        `);
        const hasCreatedAt = colCheck.rows.length > 0;
        const orderBy = hasCreatedAt ? 'created_at DESC' : 'id DESC';
        
        query += ` ORDER BY ${orderBy} LIMIT 500`;
        
        const queryResult = await pool.query(query, params);
        rows = queryResult.rows;
      } else if (moduleName === 'audit_logs') {
        const companyId = req.query.company_id || req.user?.company_id;
        const isSuperAdmin = req.user?.role === 'super_admin';

        if (!companyId && !isSuperAdmin) {
          return sendError(res, 400, 'company_id is required');
        }

        let query = 'SELECT * FROM audit_logs';
        let params: any[] = [];

        if (companyId) {
          query += ' WHERE company_id = $1';
          params.push(companyId);
        }

        const colCheck = await pool.query(`
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'audit_logs' AND column_name = 'created_at'
        `);
        const hasCreatedAt = colCheck.rows.length > 0;
        const orderBy = hasCreatedAt ? 'created_at DESC' : 'id DESC';

        query += ` ORDER BY ${orderBy} LIMIT 500`;
        const queryResult = await pool.query(query, params);
        rows = queryResult.rows;
      } else {
        // For other tables, we apply company_id filter by default if present in schema
        const queryFilters = { ...req.query } as any;
        const isSuperAdmin = req.user?.role === 'super_admin';
        if (EXPECTED_SCHEMA[moduleName]?.includes('company_id') && !queryFilters.company_id && req.user?.company_id && !isSuperAdmin) {
          queryFilters.company_id = req.user.company_id;
        }

        const isPaginated = queryFilters._page && queryFilters._limit;
        
        if (isPaginated) {
          const limit = parseInt(queryFilters._limit, 10) || 50;
          const page = parseInt(queryFilters._page, 10) || 1;
          const offset = (page - 1) * limit;
          const sortBy = queryFilters._sortBy || 'date';
          const sortOrder = queryFilters._sortOrder || 'DESC';
          const search = queryFilters._search || '';
          
          let sql;
          const journaledTables = [
            'invoices', 'purchase_invoices', 'receipt_vouchers', 'payment_vouchers',
            'returns', 'purchase_returns', 'cash_transfers', 'customer_discounts',
            'supplier_discounts', 'opening_stock_balances', 'stock_adjustments',
            'warehouse_transfers'
          ];
          if (journaledTables.includes(moduleName)) {
            sql = `SELECT t.*, (SELECT entry_number FROM journal_entries je WHERE je.reference_id = t.id LIMIT 1) AS entry_number FROM "${moduleName}" t`;
          } else {
            sql = `SELECT * FROM "${moduleName}"`;
          }
          const values: any[] = [];
          const conditions: string[] = [];
          let paramIndex = 1;

          Object.keys(queryFilters).forEach((key) => {
            if (['company_id', 'date_from', 'date_to'].includes(key) || (!key.startsWith('_') && key !== 'company_id')) {
              const value = queryFilters[key];
              if (key === 'date_from') {
                conditions.push(`date >= $${paramIndex++}`);
                values.push(value);
              } else if (key === 'date_to') {
                conditions.push(`date <= $${paramIndex++}`);
                values.push(value);
              } else if (!key.startsWith('_')) {
                conditions.push(`"${key}" = $${paramIndex++}`);
                values.push(value);
              }
            }
          });

          if (search) {
             const searchCols = EXPECTED_SCHEMA[moduleName] || [];
             const textCols = searchCols.filter(c => ['description', 'notes', 'reference_number', 'invoice_number', 'voucher_number', 'customer_name', 'supplier_name', 'account_name', 'code', 'name'].includes(c));
             if (textCols.length > 0) {
               const searchConditions = textCols.map(c => `"${c}"::text ILIKE $${paramIndex}`).join(' OR ');
               conditions.push(`(${searchConditions})`);
               values.push(`%${search}%`);
               paramIndex++;
             }
          }

          if (conditions.length > 0) {
            sql += ` WHERE ${conditions.join(' AND ')}`;
          }

          const countSql = `SELECT count(*) as total FROM (${sql}) t`;
          const countRes = await pool.query(countSql, values);
          const total = parseInt(countRes.rows[0].total);

          let summary = {};
          if (moduleName === 'invoices' || moduleName === 'purchase_invoices') {
             const sumRes = await pool.query(`SELECT sum("total_amount" * COALESCE("exchange_rate", 1)) as sum1, sum("discount_amount" * COALESCE("exchange_rate", 1)) as sum2 FROM (${sql}) t`, values);
             summary = { total_amount: Number(sumRes.rows[0].sum1 || 0), total_discount: Number(sumRes.rows[0].sum2 || 0) };
          } else if (moduleName === 'returns' || moduleName === 'purchase_returns') {
             const sumRes = await pool.query(`SELECT sum(total_amount) as sum1 FROM (${sql}) t`, values);
             summary = { total_amount: Number(sumRes.rows[0].sum1 || 0) };
          } else if (moduleName === 'receipt_vouchers' || moduleName === 'payment_vouchers' || moduleName === 'customer_discounts' || moduleName === 'supplier_discounts') {
             const sumRes = await pool.query(`SELECT sum(amount) as sum1 FROM (${sql}) t`, values);
             summary = { total_amount: Number(sumRes.rows[0].sum1 || 0) };
          } else if (moduleName === 'journal_entries') {
             const sumRes = await pool.query(`SELECT sum(total_debit) as sum1, sum(total_credit) as sum2 FROM (${sql}) t`, values);
             summary = { total_debit: Number(sumRes.rows[0].sum1 || 0), total_credit: Number(sumRes.rows[0].sum2 || 0) };
          }

          let sortField = `"${sortBy}"`;
          if (moduleName === 'invoices' || moduleName === 'purchase_invoices') {
            if (sortBy === 'currency') {
              sortField = `"currency_id"`;
            } else if (sortBy === 'foreign_amount') {
              sortField = `"total_amount"`;
            } else if (sortBy === 'base_amount') {
              sortField = `("total_amount" * COALESCE("exchange_rate", 1))`;
            } else if (sortBy === 'subtotal') {
              sortField = `("subtotal" * COALESCE("exchange_rate", 1))`;
            } else if (sortBy === 'tax_amount') {
              sortField = `("tax_amount" * COALESCE("exchange_rate", 1))`;
            } else if (sortBy === 'remaining' || sortBy === 'remaining_foreign') {
              sortField = `"total_amount"`;
            }
          }

          let finalSort = `${sortField} ${sortOrder.toUpperCase()}`;
          if (moduleName === 'invoices' || moduleName === 'purchase_invoices') {
            if (sortBy === 'date' || sortBy === 'operation_date') {
              finalSort += `, "invoice_number" ${sortOrder.toUpperCase()}`;
            } else if (sortBy === 'invoice_number') {
              finalSort += `, "date" DESC`;
            } else {
              finalSort += `, "date" DESC, "invoice_number" DESC`;
            }
          } else {
            if (sortBy === 'date' || sortBy === 'operation_date') {
              finalSort += `, id DESC`;
            }
          }
          
          sql += ` ORDER BY ${finalSort} LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
          values.push(limit, offset);

          const paginatedRes = await pool.query(sql, values);
          rows = paginatedRes.rows;

          if (transactionalModules.includes(moduleName)) {
            const rowIds = rows.map((r: any) => r.id);
            const itemsMap = await fetchItemsForMultiple(moduleName, rowIds);
            for (let row of rows) {
              row.items = itemsMap[row.id] || [];
            }
          }
          
          return res.json({
            data: rows.map((row: any) => parseRow(moduleName, row)),
            total,
            summary,
            page,
            limit
          });
        }

        rows = await getList(moduleName, queryFilters);

        // Fetch sub-items for relevant modules
        if (transactionalModules.includes(moduleName)) {
          const rowIds = rows.map((r: any) => r.id);
          const itemsMap = await fetchItemsForMultiple(moduleName, rowIds);
          for (let row of rows) {
            row.items = itemsMap[row.id] || [];
          }
        }
      }
      res.json(rows.map((row: any) => parseRow(moduleName, row)));
    } catch (error: any) {
      console.error(`[CRASH PREVENTED] Error in GET /${moduleName}:`, error);
      sendError(res, 500, `Failed to list ${moduleName}`, error.message);
    }
  });
});

// Get Single
  routeNames.forEach(rn => {
    router.get(`/${rn}/:id`, authenticateToken, async (req, res) => {
      try {
        const { id } = req.params;
        
        // ID validation for single item GET
        if (!id || typeof id !== 'string') {
          return sendError(res, 400, `Invalid ID format for ${moduleName}`);
        }

        let queryStr;
        const journaledTables = [
          'invoices', 'purchase_invoices', 'receipt_vouchers', 'payment_vouchers',
          'returns', 'purchase_returns', 'cash_transfers', 'customer_discounts',
          'supplier_discounts', 'opening_stock_balances', 'stock_adjustments',
          'warehouse_transfers'
        ];
        if (journaledTables.includes(moduleName)) {
          queryStr = `SELECT t.*, (SELECT entry_number FROM journal_entries je WHERE je.reference_id = t.id LIMIT 1) AS entry_number FROM "${moduleName}" t WHERE t.id = $1`;
        } else {
          queryStr = `SELECT * FROM "${moduleName}" WHERE id = $1`;
        }
        const { rows }: any = await pool.query(queryStr, [id]);
        const row = rows[0] || null;
        
        if (!row) {
          return sendError(res, 404, `${moduleName} not found`);
        }

        if (transactionalModules.includes(moduleName)) {
          row.items = await fetchItems(moduleName, row.id);
        }
        res.json(parseRow(moduleName, row));
      } catch (error: any) {
        console.error(`[CRASH PREVENTED] Error in GET /${moduleName}/:id:`, error);
        sendError(res, 500, `Failed to get ${moduleName}`, error.message);
      }
    });
  });

  // Helper to fetch items for multiple parent IDs in a single query
  async function fetchItemsForMultiple(module: string, ids: string[]) {
    if (!ids || ids.length === 0) return {};
    let itemsTable = '';
    let foreignKey = '';
    
    if (module === 'journal_entries') {
      itemsTable = 'journal_entry_lines';
      foreignKey = 'journal_entry_id';
    } else if (module === 'invoices') {
      itemsTable = 'invoice_items';
      foreignKey = 'invoice_id';
    } else if (module === 'returns') {
      itemsTable = 'return_items';
      foreignKey = 'return_id';
    } else if (module === 'purchase_invoices') {
      itemsTable = 'purchase_invoice_items';
      foreignKey = 'invoice_id';
    } else if (module === 'purchase_returns') {
      itemsTable = 'purchase_return_items';
      foreignKey = 'return_id';
    } else if (module === 'sales_orders') {
      itemsTable = 'sales_order_items';
      foreignKey = 'order_id';
    } else if (module === 'purchase_orders') {
      itemsTable = 'purchase_order_items';
      foreignKey = 'order_id';
    } else if (module === 'warehouse_transfers') {
      itemsTable = 'warehouse_transfer_items';
      foreignKey = 'transfer_id';
    } else if (module === 'opening_stock_balances') {
      itemsTable = 'opening_stock_items';
      foreignKey = 'opening_stock_id';
    } else if (module === 'stock_adjustments') {
      itemsTable = 'stock_adjustment_items';
      foreignKey = 'adjustment_id';
    }

    if (itemsTable) {
      if (module === 'journal_entries') {
        const { rows } = await pool.query(`
          SELECT jel.*, COALESCE(jel.account_name, acc.name) AS account_name, acc.code AS account_code
          FROM "journal_entry_lines" jel
          LEFT JOIN "accounts" acc ON acc.id = jel.account_id
          WHERE jel."journal_entry_id" = ANY($1)
        `, [ids]);
        
        const mapping: Record<string, any[]> = {};
        for (const id of ids) mapping[id] = [];
        for (const r of rows) {
          const parentId = r.journal_entry_id;
          if (mapping[parentId]) {
            mapping[parentId].push(r);
          }
        }
        return mapping;
      }
      
      const { rows } = await pool.query(`SELECT * FROM "${itemsTable}" WHERE "${foreignKey}" = ANY($1)`, [ids]);
      const mapping: Record<string, any[]> = {};
      for (const id of ids) mapping[id] = [];
      for (const r of rows) {
        const parentId = r[foreignKey];
        if (mapping[parentId]) {
          mapping[parentId].push(r);
        }
      }
      return mapping;
    }
    return {};
  }

  // Helper to fetch items
  async function fetchItems(module: string, id: string) {
    let itemsTable = '';
    let foreignKey = '';
    
    if (module === 'journal_entries') {
      itemsTable = 'journal_entry_lines';
      foreignKey = 'journal_entry_id';
    } else if (module === 'invoices') {
      itemsTable = 'invoice_items';
      foreignKey = 'invoice_id';
    } else if (module === 'returns') {
      itemsTable = 'return_items';
      foreignKey = 'return_id';
    } else if (module === 'purchase_invoices') {
      itemsTable = 'purchase_invoice_items';
      foreignKey = 'invoice_id';
    } else if (module === 'purchase_returns') {
      itemsTable = 'purchase_return_items';
      foreignKey = 'return_id';
    } else if (module === 'sales_orders') {
      itemsTable = 'sales_order_items';
      foreignKey = 'order_id';
    } else if (module === 'purchase_orders') {
      itemsTable = 'purchase_order_items';
      foreignKey = 'order_id';
    } else if (module === 'warehouse_transfers') {
      itemsTable = 'warehouse_transfer_items';
      foreignKey = 'transfer_id';
    } else if (module === 'opening_stock_balances') {
      itemsTable = 'opening_stock_items';
      foreignKey = 'opening_stock_id';
    } else if (module === 'stock_adjustments') {
      itemsTable = 'stock_adjustment_items';
      foreignKey = 'adjustment_id';
    }

    if (itemsTable) {
      if (module === 'journal_entries') {
        const { rows } = await pool.query(`
          SELECT jel.*, COALESCE(jel.account_name, acc.name) AS account_name, acc.code AS account_code
          FROM "journal_entry_lines" jel
          LEFT JOIN "accounts" acc ON acc.id = jel.account_id
          WHERE jel."journal_entry_id" = $1
        `, [id]);
        return rows;
      }
      const { rows } = await pool.query(`SELECT * FROM "${itemsTable}" WHERE "${foreignKey}" = $1`, [id]);
      return rows;
    }
    return [];
  }

  // Create
  if (!transactionalModules.includes(moduleName)) {
    routeNames.forEach(rn => {
      router.post(`/${rn}`, authenticateToken, async (req: AuthRequest, res) => {
        try {
          const companyId = req.user?.company_id;
          if (!companyId && moduleName !== 'companies') return sendError(res, 401, 'Unauthorized');

          // Special case for users: handle password/temp_password hashing
          if (moduleName === 'users') {
            if (req.body.password) {
              req.body.password_hash = await bcrypt.hash(req.body.password, 10);
              delete req.body.password;
            }
            if (req.body.temp_password) {
              req.body.password_hash = await bcrypt.hash(req.body.temp_password, 10);
            }
          }

          // Special case for employees: handle automatic code generation
          if (moduleName === 'employees') {
            if (!req.body.employee_code) {
              req.body.employee_code = await generateNextSequence(pool, companyId, 'employees', '');
            }
          }

          // Special case for cash_transfers: handle automatic transfer_number generation
          if (moduleName === 'cash_transfers') {
            if (!req.body.transfer_number) {
              req.body.transfer_number = await generateNextSequence(pool, companyId, 'cash_transfers', req.body.date || new Date().toISOString().slice(0, 10));
            }
          }

          const sanitizedData = sanitizeData(moduleName, req.body);
          const data = { ...sanitizedData };
          if (EXPECTED_SCHEMA[moduleName]?.includes('company_id') && !data.company_id) {
            data.company_id = companyId;
          }

          if (!data.id && moduleName !== 'activity_logs' && moduleName !== 'audit_logs') {
            data.id = uuidv4();
          }
          
          const keys = Object.keys(data);
          const values = Object.values(data);
          const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
          
          const result = await pool.query(
            `INSERT INTO "${moduleName}" ("${keys.join('", "')}") VALUES (${placeholders}) RETURNING *`,
            values
          );

          // Audit Log
          logAudit({
            company_id: req.user?.company_id,
            user_id: req.user?.id,
            username: (req.user as any)?.username || req.user?.email,
            user_email: req.user?.email,
            action: 'CREATE',
            module: moduleName.toUpperCase(),
            details: `Created ${moduleName}: ${data.name || data.id}`,
            entity_type: moduleName,
            entity_id: data.id,
            ip_address: getIp(req),
            metadata: data
          });

          res.status(201).json(parseRow(moduleName, result.rows[0] || data));
        } catch (error: any) {
          console.error(`[CRITICAL] Error in POST /${moduleName}:`, {
            message: error.message,
            stack: error.stack,
            body: req.body,
            user: req.user?.email
          });
          sendError(res, 500, `Failed to create ${moduleName}. ${error.message}`, error.message);
        }
      });
    });

    // Update
    routeNames.forEach(rn => {
      router.put(`/${rn}/:id`, authenticateToken, async (req: AuthRequest, res) => {
        try {
          const { id } = req.params;
          const companyId = req.user?.company_id;

          if (moduleName === 'companies') {
            const currentRes = await pool.query('SELECT settings FROM companies WHERE id = $1', [id]);
            const currentSettings = currentRes.rows[0]?.settings || {};
            const newSettings = req.body.settings || {};
            
            const currentMethod = currentSettings.inventory_cost_method || 'wac';
            const newMethod = newSettings.inventory_cost_method || 'wac';
            
            if (currentMethod !== newMethod) {
              const movementsCheck = await pool.query('SELECT COUNT(*) FROM inventory_movements WHERE company_id = $1', [companyId || id]);
              const movementsCount = parseInt(movementsCheck.rows[0]?.count || '0', 10);
              if (movementsCount > 0) {
                return sendError(res, 400, 'لا يمكن تغيير طريقة تقييم المخزون بعد تسجيل حركات مخزنية بالفعل.');
              }
            }
          }

          const sanitizedData = sanitizeData(moduleName, req.body);
          delete (sanitizedData as any).id;
          if (moduleName !== 'companies') delete (sanitizedData as any).company_id;

          const keys = Object.keys(sanitizedData);
          const values = Object.values(sanitizedData);
          if (keys.length === 0) return sendError(res, 400, 'No valid fields for update');

          // REAL RUNTIME CHECK: See if updated_at column exists in the database for this table
          const colCheck = await pool.query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'updated_at'
          `, [moduleName]);
          const hasUpdatedAt = colCheck.rows.length > 0;

          const setClause = keys.map((key, index) => {
            return `"${key}" = $${index + 1}`;
          }).join(', ');
          
          let query = `UPDATE "${moduleName}" SET ${setClause}${hasUpdatedAt ? ', updated_at = CURRENT_TIMESTAMP' : ''} WHERE id = $${keys.length + 1}`;
          let params = [...values, id];

          if (EXPECTED_SCHEMA[moduleName]?.includes('company_id') && companyId && moduleName !== 'companies') {
            query += ` AND company_id = $${keys.length + 2}`;
            params.push(companyId);
          }

          const result = await pool.query(query, params);
          if (result.rowCount === 0) return sendError(res, 404, 'Not found or permission denied');

          // Audit Log
          logAudit({
            company_id: req.user?.company_id,
            user_id: req.user?.id,
            username: (req.user as any)?.username || req.user?.email,
            user_email: req.user?.email,
            action: 'UPDATE',
            module: moduleName.toUpperCase(),
            details: `Updated ${moduleName}: ${id}`,
            entity_type: moduleName,
            entity_id: id,
            ip_address: getIp(req),
            metadata: sanitizedData
          });

          res.json({ success: true });
        } catch (error: any) {
          console.error(`[CRITICAL] Error in PUT /${moduleName}:`, {
            message: error.message,
            stack: error.stack,
            id: req.params.id,
            body: req.body,
            user: req.user?.email
          });
          sendError(res, 500, `Failed to update ${moduleName}. ${error.message}`, error.message);
        }
      });
    });
  }

  routeNames.forEach(rn => {
    router.delete(`/${rn}/:id`, authenticateToken, async (req: AuthRequest, res) => {
      const client = await pool.connect();
      try {
        const { id } = req.params;
        const companyId = req.user?.company_id;

        const excludedFromCheck = ['activity_logs', 'migrations'];
        if (!id || typeof id !== 'string') {
          client.release();
          return sendError(res, 400, 'Invalid ID format');
        }

        await client.query('BEGIN');

        if (moduleName === 'sales_orders' || moduleName === 'purchase_orders') {
          const statusRes = await client.query(`SELECT status, invoice_number FROM "${moduleName}" WHERE id = $1`, [id]);
          if (statusRes.rows.length > 0 && statusRes.rows[0].status === 'converted') {
            await client.query('ROLLBACK');
            client.release();
            return sendError(res, 400, `لا يمكن حذف هذا الأمر لأنه تم تحويله بالفعل إلى فاتورة رقم ${statusRes.rows[0].invoice_number || ''}`);
          }
        }

        if (moduleName === 'invoices') {
          await client.query(
            `UPDATE sales_orders 
             SET status = 'pending', invoice_id = NULL, invoice_number = NULL 
             WHERE invoice_id = $1 AND company_id = $2`,
            [id, companyId]
          );
        }

        if (moduleName === 'purchase_invoices') {
          await client.query(
            `UPDATE purchase_orders 
             SET status = 'pending', invoice_id = NULL, invoice_number = NULL 
             WHERE invoice_id = $1 AND company_id = $2`,
            [id, companyId]
          );
        }

        if (transactionalModules.includes(moduleName)) {
          await reverseAndRecalculate(client, companyId || '', id);
        }

        let query = `DELETE FROM "${moduleName}" WHERE id = $1`;
        let params = [id];

        if (EXPECTED_SCHEMA[moduleName]?.includes('company_id') && companyId && moduleName !== 'companies') {
          query += ` AND company_id = $2`;
          params.push(companyId);
        }

        const result = await client.query(query, params);
        if (result.rowCount === 0) {
          await client.query('ROLLBACK');
          client.release();
          return sendError(res, 404, 'Not found or permission denied');
        }

        await client.query('COMMIT');

        // Audit Log
        logAudit({
          company_id: req.user?.company_id,
          user_id: req.user?.id,
          username: (req.user as any)?.username || req.user?.email,
          user_email: req.user?.email,
          action: 'DELETE',
          module: moduleName.toUpperCase(),
          details: `Deleted ${moduleName}: ${id}`,
          entity_type: moduleName,
          entity_id: id,
          ip_address: getIp(req)
        });

        res.json({ success: true });
      } catch (error: any) {
        await client.query('ROLLBACK');
        console.error(`Error in DELETE /${moduleName}:`, error);
        sendError(res, 500, `Failed to delete ${moduleName}`, error.message);
      } finally {
        client.release();
      }
    });
  });
});

// --- Invoices with Items (Transaction) ---
// Helper to ensure default accounts exist for a company
async function ensureDefaultAccounts(client: any, companyId: string) {
  console.log(`[ERP] Ensuring default accounts for company: ${companyId}`);
  
  // 1. Get or create a basic account type if needed (Assets, Liabilities, etc.)
  const { rows: accountTypes } = await client.query(
    'SELECT id, name, classification FROM account_types WHERE company_id = $1',
    [companyId]
  );
  
  if (accountTypes.length === 0) {
    console.log('[ERP] No account types found. Creating defaults...');
    const types = [
      { id: uuidv4(), name: 'الأصول', code: '1', classification: 'asset', statement_type: 'balance_sheet' },
      { id: uuidv4(), name: 'الالتزامات', code: '2', classification: 'liability', statement_type: 'balance_sheet' },
      { id: uuidv4(), name: 'حقوق الملكية', code: '3', classification: 'equity', statement_type: 'balance_sheet' },
      { id: uuidv4(), name: 'الإيرادات', code: '4', classification: 'revenue', statement_type: 'income_statement' },
      { id: uuidv4(), name: 'المصروفات', code: '5', classification: 'expense', statement_type: 'income_statement' },
    ];
    
    for (const type of types) {
      await client.query(
        'INSERT INTO account_types (id, company_id, name, code, classification, statement_type) VALUES ($1, $2, $3, $4, $5, $6)',
        [type.id, companyId, type.name, type.code, type.classification, type.statement_type]
      );
    }
  }

  // Reload types
  const { rows: currentTypes } = await client.query(
    'SELECT id, name, classification FROM account_types WHERE company_id = $1',
    [companyId]
  );

  const getType = (cls: string) => currentTypes.find(t => t.classification === cls)?.id;

  // 2. Define standard accounts
  const defaultAccounts = [
    { name: 'الخزينة العامة', code: '1101', classification: 'asset' },
    { name: 'حساب العملاء', code: '1201', classification: 'asset' },
    { name: 'المبيعات', code: '4101', classification: 'revenue' },
    { name: 'الخصم المسموح به', code: '5401', classification: 'expense' },
  ];

  for (const acc of defaultAccounts) {
    const { rows: existing } = await client.query(
      'SELECT id FROM accounts WHERE company_id = $1 AND (name = $2 OR code = $3)',
      [companyId, acc.name, acc.code]
    );
    
    if (existing.length === 0) {
      console.log(`[ERP] Creating account: ${acc.name}`);
      const typeId = getType(acc.classification);
      if (typeId) {
        await client.query(
          'INSERT INTO accounts (id, company_id, name, code, type_id, is_active) VALUES ($1, $2, $3, $4, $5, $6)',
          [uuidv4(), companyId, acc.name, acc.code, typeId, true]
        );
      }
    }
  }
}

router.post('/invoices', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    console.log(`[ERP] Starting Invoice Creation for company: ${companyId}`);
    console.log('[ERP] Request Body:', JSON.stringify(req.body, null, 2));

    const { items, ...rawInvoiceData } = req.body;
    
    // Validate required fields
    if (!rawInvoiceData.customer_id) return sendError(res, 400, 'customer_id is required');
    if (!rawInvoiceData.date) return sendError(res, 400, 'date is required');
    if (rawInvoiceData.total_amount === undefined || rawInvoiceData.total_amount === null) {
       return sendError(res, 400, 'total_amount is required');
    }

    await client.query('BEGIN');
    
    // Ensure default accounts exist
    await ensureDefaultAccounts(client, companyId);

    const invoiceData = sanitizeData('invoices', rawInvoiceData);
    
    // Ensure company_id
    if (!invoiceData.company_id) invoiceData.company_id = companyId;
    const invoiceId = invoiceData.id || uuidv4();
    if (!isUUID(invoiceId)) {
       await client.query('ROLLBACK');
       return sendError(res, 400, 'Invalid Invoice ID format');
    }

    // Double check specific fields that might be null from frontend
    invoiceData.status = invoiceData.status || 'paid';
    invoiceData.payment_type = invoiceData.payment_type || 'cash';
    invoiceData.invoice_number = invoiceData.invoice_number || `INV-${Date.now()}`;

    let sourceOrdersStr = '';
    if (req.body.order_ids && req.body.order_ids.length > 0) {
      const ordersRes = await client.query(
        'SELECT order_number FROM sales_orders WHERE id = ANY($1) AND company_id = $2',
        [req.body.order_ids, companyId]
      );
      const orderNums = ordersRes.rows.map((r: any) => r.order_number);
      sourceOrdersStr = orderNums.join(', ');
      
      // Update sales_orders status and link invoice
      await client.query(
        `UPDATE sales_orders 
         SET status = 'converted', invoice_id = $1, invoice_number = $2 
         WHERE id = ANY($3) AND company_id = $4`,
         [invoiceId, invoiceData.invoice_number || `INV-${invoiceId}`, req.body.order_ids, companyId]
      );
    }
    
    invoiceData.source_orders = sourceOrdersStr || null;

    console.log('[ERP] Saving Invoice Header...');
    // Insert Invoice
    const invData = { ...invoiceData, id: invoiceId };
    const invKeys = Object.keys(invData);
    const invValues = Object.values(invData);
    const invPlaceholders = invKeys.map((_, i) => `$${i + 1}`).join(', ');
    
    await client.query(
      `INSERT INTO "invoices" ("${invKeys.join('", "')}") VALUES (${invPlaceholders})`,
      invValues
    );

    console.log(`[ERP] Saving ${items?.length || 0} Invoice Items...`);
    const cogsLines: { account_id: string; account_name: string; debit: number; credit: number; description: string }[] = [];

    // Insert Items
    for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('invoice_items', item);
      const itemId = uuidv4();
      const itemData = { ...sanitizedItem, id: itemId, invoice_id: invoiceId };
      if (invData.company_id) itemData.company_id = invData.company_id;

      // Cost Calculation and Layer satisfying
      // Fetch product details
      const prodRes = await client.query('SELECT * FROM products WHERE id = $1', [item.product_id]);
      if (prodRes.rows.length > 0) {
        const prod = prodRes.rows[0];
        if (prod.type !== 'service' && !prod.is_service) {
          // Perform recordSale
          const quantity = parseFloat(item.quantity || '0');
          if (quantity > 0) {
            const costInfo = await recordSale(
              client,
              companyId,
              invData.warehouse_id || null,
              item.product_id,
              quantity,
              invoiceId,
              invoiceData.invoice_number,
              invoiceData.date
            );
            
            itemData.unit_cost = costInfo.unitCost;
            itemData.total_cost = costInfo.totalCost;
            itemData.costing_method_used = costInfo.methodUsed;

            // Prepare perpetual queue / continuous inventory posting
            if (costInfo.totalCost > 0) {
              // Find accounts
              // 1. Cost of Goods Sold (COGS) Account
              let costAccId = prod.cost_account_id;
              let costAccName = prod.cost_account_name || 'تكلفة المبيعات';
              
              // 2. Inventory Account
              let invAccId = prod.inventory_account_id;
              let invAccName = prod.inventory_account_name || 'المخزون';

              // Fallbacks if not configured on the product specifically
              if (!costAccId || !invAccId) {
                const accountsRes = await client.query('SELECT * FROM accounts WHERE company_id = $1', [companyId]);
                const accounts = accountsRes.rows;
                
                if (!costAccId) {
                  const fallbackCostAcc = accounts.find((a: any) => a.name.includes('تكلفة المبيعات') || a.name.includes('تكلفة مبيعات') || a.name.includes('تكلفة البضاعة المباعة'));
                  if (fallbackCostAcc) {
                    costAccId = fallbackCostAcc.id;
                    costAccName = fallbackCostAcc.name;
                  }
                }
                if (!invAccId) {
                  const fallbackInvAcc = accounts.find((a: any) => a.name.includes('مخزون') || a.name.includes('مخازن'));
                  if (fallbackInvAcc) {
                    invAccId = fallbackInvAcc.id;
                    invAccName = fallbackInvAcc.name;
                  }
                }
              }

              if (costAccId) {
                cogsLines.push({
                  account_id: costAccId,
                  account_name: costAccName,
                  debit: costInfo.totalCost,
                  credit: 0,
                  description: `تكلفة البضاعة المباعة صنف: ${prod.name} - فاتورة ${invoiceData.invoice_number}`
                });
              }
              if (invAccId) {
                cogsLines.push({
                  account_id: invAccId,
                  account_name: invAccName,
                  debit: 0,
                  credit: costInfo.totalCost,
                  description: `تخفيض المخزون صنف: ${prod.name} - فاتورة ${invoiceData.invoice_number}`
                });
              }
            }
          }
        }
      }

      const itemKeys = Object.keys(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
      
      await client.query(
        `INSERT INTO "invoice_items" ("${itemKeys.join('", "')}") VALUES (${itemPlaceholders})`,
        Object.values(itemData)
      );
    }

    const productIdsToSync = (items || []).filter((i: any) => i.product_id).map((i: any) => i.product_id);
    if (productIdsToSync.length > 0) {
      await syncProductsCostAndJEs(client, companyId, productIdsToSync);
    }

    await client.query('COMMIT');
    console.log(`[ERP] Invoice ${invoiceId} created successfully.`);

    // Audit Log
    logAudit({
      company_id: req.user?.company_id,
      user_id: req.user?.id,
      username: (req.user as any)?.username || req.user?.email,
      user_email: req.user?.email,
      action: 'CREATE',
      module: 'INVOICES',
      details: `Created invoice: ${invoiceData.invoice_number || invoiceId}`,
      entity_type: 'invoices',
      entity_id: invoiceId,
      ip_address: getIp(req),
      metadata: { invoiceData, itemCount: (items || []).length }
    });

    res.status(201).json({ id: invoiceId });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('[DATABASE] Invoice creation full failure:', error);
    console.error('[DATABASE] Error Stack:', error.stack);
    sendError(res, 500, `Failed to create invoice: ${error.message}`, error.detail || error.hint || error.message);
  } finally {
    client.release();
  }
});

router.put('/invoices/:id', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const invoiceId = req.params.id;
    const companyId = req.user?.company_id;
    if (!isUUID(invoiceId)) return sendError(res, 400, 'Invalid Invoice ID format');

    await client.query('BEGIN');

    // Reset currently linked sales orders
    await client.query(
      `UPDATE sales_orders 
       SET status = 'pending', invoice_id = NULL, invoice_number = NULL 
       WHERE invoice_id = $1 AND company_id = $2`,
      [invoiceId, companyId]
    );

    const { items, id: bodyId, ...rawInvoiceData } = req.body;

    // Fetch and link new sales orders
    let sourceOrdersStr = '';
    if (req.body.order_ids && req.body.order_ids.length > 0) {
      const ordersRes = await client.query(
        'SELECT order_number FROM sales_orders WHERE id = ANY($1) AND company_id = $2',
        [req.body.order_ids, companyId]
      );
      const orderNums = ordersRes.rows.map((r: any) => r.order_number);
      sourceOrdersStr = orderNums.join(', ');
      
      await client.query(
        `UPDATE sales_orders 
         SET status = 'converted', invoice_id = $1, invoice_number = $2 
         WHERE id = ANY($3) AND company_id = $4`,
         [invoiceId, rawInvoiceData.invoice_number || `INV-${invoiceId}`, req.body.order_ids, companyId]
      );
    }
    rawInvoiceData.source_orders = sourceOrdersStr || null;

    const invoiceData = sanitizeData('invoices', rawInvoiceData);
    
    const invKeys = Object.keys(invoiceData);
    const invValues = Object.values(invoiceData);
    const invSetClause = invKeys.map((key, i) => `"${key}" = $${i + 1}`).join(', ');
    
    let query = `UPDATE "invoices" SET ${invSetClause} WHERE id = $${invKeys.length + 1}`;
    let params = [...invValues, invoiceId];
    if (companyId) {
      query += ` AND company_id = $${invKeys.length + 2}`;
      params.push(companyId);
    }

    const result = await client.query(query, params);
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return sendError(res, 404, 'Invoice not found or permission denied');
    }

    // Sync Items
    await client.query('DELETE FROM invoice_items WHERE invoice_id = $1', [invoiceId]);
    await reverseAndRecalculate(client, companyId || '', invoiceId);

    const invData = invoiceData;
    const cogsLines: { account_id: string; account_name: string; debit: number; credit: number; description: string }[] = [];
for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('invoice_items', item);
      const itemId = uuidv4();
      const itemData = { ...sanitizedItem, id: itemId, invoice_id: invoiceId };
      if (invData.company_id) itemData.company_id = invData.company_id;

      // Cost Calculation and Layer satisfying
      // Fetch product details
      const prodRes = await client.query('SELECT * FROM products WHERE id = $1', [item.product_id]);
      if (prodRes.rows.length > 0) {
        const prod = prodRes.rows[0];
        if (prod.type !== 'service' && !prod.is_service) {
          // Perform recordSale
          const quantity = parseFloat(item.quantity || '0');
          if (quantity > 0) {
            const costInfo = await recordSale(
              client,
              companyId,
              invData.warehouse_id || null,
              item.product_id,
              quantity,
              invoiceId,
              invoiceData.invoice_number,
              invoiceData.date
            );
            
            itemData.unit_cost = costInfo.unitCost;
            itemData.total_cost = costInfo.totalCost;
            itemData.costing_method_used = costInfo.methodUsed;

            // Prepare perpetual queue / continuous inventory posting
            if (costInfo.totalCost > 0) {
              // Find accounts
              // 1. Cost of Goods Sold (COGS) Account
              let costAccId = prod.cost_account_id;
              let costAccName = prod.cost_account_name || 'تكلفة المبيعات';
              
              // 2. Inventory Account
              let invAccId = prod.inventory_account_id;
              let invAccName = prod.inventory_account_name || 'المخزون';

              // Fallbacks if not configured on the product specifically
              if (!costAccId || !invAccId) {
                const accountsRes = await client.query('SELECT * FROM accounts WHERE company_id = $1', [companyId]);
                const accounts = accountsRes.rows;
                
                if (!costAccId) {
                  const fallbackCostAcc = accounts.find((a: any) => a.name.includes('تكلفة المبيعات') || a.name.includes('تكلفة مبيعات') || a.name.includes('تكلفة البضاعة المباعة'));
                  if (fallbackCostAcc) {
                    costAccId = fallbackCostAcc.id;
                    costAccName = fallbackCostAcc.name;
                  }
                }
                if (!invAccId) {
                  const fallbackInvAcc = accounts.find((a: any) => a.name.includes('مخزون') || a.name.includes('مخازن'));
                  if (fallbackInvAcc) {
                    invAccId = fallbackInvAcc.id;
                    invAccName = fallbackInvAcc.name;
                  }
                }
              }

              if (costAccId) {
                cogsLines.push({
                  account_id: costAccId,
                  account_name: costAccName,
                  debit: costInfo.totalCost,
                  credit: 0,
                  description: `تكلفة البضاعة المباعة صنف: ${prod.name} - فاتورة ${invoiceData.invoice_number}`
                });
              }
              if (invAccId) {
                cogsLines.push({
                  account_id: invAccId,
                  account_name: invAccName,
                  debit: 0,
                  credit: costInfo.totalCost,
                  description: `تخفيض المخزون صنف: ${prod.name} - فاتورة ${invoiceData.invoice_number}`
                });
              }
            }
          }
        }
      }

      const itemKeys = Object.keys(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
      
      await client.query(
        `INSERT INTO "invoice_items" ("${itemKeys.join('", "')}") VALUES (${itemPlaceholders})`,
        Object.values(itemData)
      );
    }

    const productIdsToSync = (items || []).filter((i: any) => i.product_id).map((i: any) => i.product_id);
    if (productIdsToSync.length > 0) {
      await syncProductsCostAndJEs(client, companyId, productIdsToSync);
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('[CRASH PREVENTED] Invoice update error:', error);
    sendError(res, 500, 'Failed to update invoice', error.message);
  } finally {
    client.release();
  }
});

// --- Sales Returns with Items (Transaction) ---
router.post('/returns', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    await client.query('BEGIN');
    const { items, ...rawReturnData } = req.body;
    const returnData = sanitizeData('returns', rawReturnData);
    if (!returnData.company_id) returnData.company_id = companyId;

    const returnId = returnData.id || uuidv4();
    if (!isUUID(returnId)) return sendError(res, 400, 'Invalid Return ID format');
    
    // Insert Return
    const rData = { ...returnData, id: returnId };
    const rKeys = Object.keys(rData);
    const rPlaceholders = rKeys.map((_, i) => `$${i + 1}`).join(', ');
    
    await client.query(
      `INSERT INTO "returns" ("${rKeys.join('", "')}") VALUES (${rPlaceholders})`,
      Object.values(rData)
    );

    // Insert Items
    for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('return_items', item);
      const itemId = uuidv4();
      const itemData = { ...sanitizedItem, id: itemId, return_id: returnId };
      if (rData.company_id) itemData.company_id = rData.company_id;

      // Cost and Layer integration for sales return
      const prodRes = await client.query('SELECT * FROM products WHERE id = $1', [item.product_id]);
      if (prodRes.rows.length > 0) {
        const prod = prodRes.rows[0];
        if (prod.type !== 'service' && !prod.is_service) {
          const quantity = parseFloat(item.quantity || '0');
          if (quantity > 0) {
            // Retrieve last unit cost sold of this product
            const lastSaleRes = await client.query(
              `SELECT unit_cost FROM invoice_items 
               WHERE product_id = $1 AND company_id = $2 AND unit_cost > 0 
               ORDER BY created_at DESC LIMIT 1`,
              [item.product_id, companyId]
            );
            const returnUnitCost = lastSaleRes.rows[0] ? parseFloat(lastSaleRes.rows[0].unit_cost) : (parseFloat(prod.weighted_average_cost || '0') || parseFloat(prod.cost_price || '0'));
            
            await recordSalesReturn(
              client,
              companyId,
              returnData.warehouse_id || null,
              item.product_id,
              quantity,
              returnUnitCost,
              returnId,
              returnData.return_number || `RET-${returnId}`,
              returnData.date
            );
          }
        }
      }

      const itemKeys = Object.keys(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
      
      await client.query(
        `INSERT INTO "return_items" ("${itemKeys.join('", "')}") VALUES (${itemPlaceholders})`,
        Object.values(itemData)
      );
    }

        const productIdsToSync = (items || []).filter((i: any) => i.product_id).map((i: any) => i.product_id);
    if (productIdsToSync.length > 0) {
      await syncProductsCostAndJEs(client, companyId, productIdsToSync);
    }

    await client.query('COMMIT');
    res.status(201).json({ id: returnId });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('[CRASH PREVENTED] Return creation error:', error);
    sendError(res, 500, 'Failed to create return', error.message);
  } finally {
    client.release();
  }
});

router.put('/returns/:id', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const returnId = req.params.id;
    const companyId = req.user?.company_id;
    if (!isUUID(returnId)) return sendError(res, 400, 'Invalid Return ID format');

    await client.query('BEGIN');
    // Removed legacy preservedEntryNumber code

    const { items, id: bodyId, ...rawReturnData } = req.body;
    const returnData = sanitizeData('returns', rawReturnData);
    
    const rKeys = Object.keys(returnData);
    const rValues = Object.values(returnData);
    const rSetClause = rKeys.map((key, i) => `"${key}" = $${i + 1}`).join(', ');
    
    let query = `UPDATE "returns" SET ${rSetClause} WHERE id = $${rKeys.length + 1}`;
    let params = [...rValues, returnId];
    if (companyId) {
      query += ` AND company_id = $${rKeys.length + 2}`;
      params.push(companyId);
    }

    const result = await client.query(query, params);
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return sendError(res, 404, 'Return not found or permission denied');
    }

    await client.query('DELETE FROM return_items WHERE return_id = $1', [returnId]);
    await reverseAndRecalculate(client, companyId || '', returnId);

    const returnDataFinal = returnData;
    const rData = returnDataFinal;
    const cogsLines: { account_id: string; account_name: string; debit: number; credit: number; description: string }[] = [];
for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('return_items', item);
      const itemId = uuidv4();
      const itemData = { ...sanitizedItem, id: itemId, return_id: returnId };
      if (rData.company_id) itemData.company_id = rData.company_id;

      // Cost and Layer integration for sales return
      const prodRes = await client.query('SELECT * FROM products WHERE id = $1', [item.product_id]);
      if (prodRes.rows.length > 0) {
        const prod = prodRes.rows[0];
        if (prod.type !== 'service' && !prod.is_service) {
          const quantity = parseFloat(item.quantity || '0');
          if (quantity > 0) {
            // Retrieve last unit cost sold of this product
            const lastSaleRes = await client.query(
              `SELECT unit_cost FROM invoice_items 
               WHERE product_id = $1 AND company_id = $2 AND unit_cost > 0 
               ORDER BY created_at DESC LIMIT 1`,
              [item.product_id, companyId]
            );
            const returnUnitCost = lastSaleRes.rows[0] ? parseFloat(lastSaleRes.rows[0].unit_cost) : (parseFloat(prod.weighted_average_cost || '0') || parseFloat(prod.cost_price || '0'));
            
            await recordSalesReturn(
              client,
              companyId,
              returnDataFinal.warehouse_id || null,
              item.product_id,
              quantity,
              returnUnitCost,
              returnId,
              returnDataFinal.return_number || `RET-${returnId}`,
              returnDataFinal.date
            );
          }
        }
      }

      const itemKeys = Object.keys(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
      
      await client.query(
        `INSERT INTO "return_items" ("${itemKeys.join('", "')}") VALUES (${itemPlaceholders})`,
        Object.values(itemData)
      );
    }

    
    const productIdsToSync = (items || []).filter((i: any) => i.product_id).map((i: any) => i.product_id);
    if (productIdsToSync.length > 0) {
      await syncProductsCostAndJEs(client, companyId, productIdsToSync);
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('[CRASH PREVENTED] Return update error:', error);
    sendError(res, 500, 'Failed to update return', error.message);
  } finally {
    client.release();
  }
});

// --- Purchase Invoices with Items (Transaction) ---
router.post('/purchase_invoices', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    await client.query('BEGIN');
    const { items, ...rawInvoiceData } = req.body;
    const invoiceData = sanitizeData('purchase_invoices', rawInvoiceData);
    if (!invoiceData.company_id) invoiceData.company_id = companyId;

    const invoiceId = invoiceData.id || uuidv4();
    if (!isUUID(invoiceId)) return sendError(res, 400, 'Invalid Invoice ID format');
    
    let sourceOrdersStr = '';
    if (req.body.order_ids && req.body.order_ids.length > 0) {
      const ordersRes = await client.query(
        'SELECT order_number FROM purchase_orders WHERE id = ANY($1) AND company_id = $2',
        [req.body.order_ids, companyId]
      );
      const orderNums = ordersRes.rows.map((r: any) => r.order_number);
      sourceOrdersStr = orderNums.join(', ');
      
      // Update purchase_orders status and link invoice
      await client.query(
        `UPDATE purchase_orders 
         SET status = 'converted', invoice_id = $1, invoice_number = $2 
         WHERE id = ANY($3) AND company_id = $4`,
         [invoiceId, invoiceData.invoice_number || `PINV-${invoiceId}`, req.body.order_ids, companyId]
      );
    }
    invoiceData.source_orders = sourceOrdersStr || null;

    // Insert Purchase Invoice
    const invData = { ...invoiceData, id: invoiceId };
    const invKeys = Object.keys(invData);
    const invValues = Object.values(invData);
    const invPlaceholders = invKeys.map((_, i) => `$${i + 1}`).join(', ');
    
    await client.query(
      `INSERT INTO "purchase_invoices" ("${invKeys.join('", "')}") VALUES (${invPlaceholders})`,
      invValues
    );

    // Insert Items
    for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('purchase_invoice_items', item);
      const itemId = uuidv4();
      const itemData = { ...sanitizedItem, id: itemId, invoice_id: invoiceId };
      if (invData.company_id) itemData.company_id = invData.company_id;

      // Costing and stock update integration for purchases
      const prodRes = await client.query('SELECT * FROM products WHERE id = $1', [item.product_id]);
      if (prodRes.rows.length > 0) {
        const prod = prodRes.rows[0];
        if (prod.type !== 'service' && !prod.is_service) {
          const qty = parseFloat(item.quantity || '0');
          const unitPrice = parseFloat(item.unit_price || '0');
          if (qty > 0) {
            await recordPurchase(
              client,
              companyId,
              invData.warehouse_id || null,
              item.product_id,
              qty,
              unitPrice,
              invoiceId,
              invoiceData.invoice_number || `PINV-${invoiceId}`,
              invoiceData.date
            );
          }
        }
      }

      const itemKeys = Object.keys(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
      
      await client.query(
        `INSERT INTO "purchase_invoice_items" ("${itemKeys.join('", "')}") VALUES (${itemPlaceholders})`,
        Object.values(itemData)
      );
    }

    const productIdsToSync = (items || []).filter((i: any) => i.product_id).map((i: any) => i.product_id);
    if (productIdsToSync.length > 0) {
      await syncProductsCostAndJEs(client, companyId, productIdsToSync);
    }

    await client.query('COMMIT');
    res.status(201).json({ id: invoiceId });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('[CRASH PREVENTED] Purchase invoice creation error:', error);
    sendError(res, 500, 'Failed to create purchase invoice', error.message);
  } finally {
    client.release();
  }
});

router.put('/purchase_invoices/:id', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const invoiceId = req.params.id;
    const companyId = req.user?.company_id;
    if (!isUUID(invoiceId)) return sendError(res, 400, 'Invalid Invoice ID format');

    await client.query('BEGIN');

    // Reset currently linked purchase orders
    await client.query(
      `UPDATE purchase_orders 
       SET status = 'pending', invoice_id = NULL, invoice_number = NULL 
       WHERE invoice_id = $1 AND company_id = $2`,
      [invoiceId, companyId]
    );

    const { items, id: bodyId, ...rawInvoiceData } = req.body;

    // Fetch and link new purchase orders
    let sourceOrdersStr = '';
    if (req.body.order_ids && req.body.order_ids.length > 0) {
      const ordersRes = await client.query(
        'SELECT order_number FROM purchase_orders WHERE id = ANY($1) AND company_id = $2',
        [req.body.order_ids, companyId]
      );
      const orderNums = ordersRes.rows.map((r: any) => r.order_number);
      sourceOrdersStr = orderNums.join(', ');
      
      await client.query(
        `UPDATE purchase_orders 
         SET status = 'converted', invoice_id = $1, invoice_number = $2 
         WHERE id = ANY($3) AND company_id = $4`,
         [invoiceId, rawInvoiceData.invoice_number || `PINV-${invoiceId}`, req.body.order_ids, companyId]
      );
    }
    rawInvoiceData.source_orders = sourceOrdersStr || null;

    const invoiceData = sanitizeData('purchase_invoices', rawInvoiceData);
    
    const invKeys = Object.keys(invoiceData);
    const invValues = Object.values(invoiceData);
    const invSetClause = invKeys.map((key, i) => `"${key}" = $${i + 1}`).join(', ');
    
    let query = `UPDATE "purchase_invoices" SET ${invSetClause} WHERE id = $${invKeys.length + 1}`;
    let params = [...invValues, invoiceId];
    if (companyId) {
      query += ` AND company_id = $${invKeys.length + 2}`;
      params.push(companyId);
    }

    const result = await client.query(query, params);
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return sendError(res, 404, 'Purchase Invoice not found or permission denied');
    }

    await client.query('DELETE FROM purchase_invoice_items WHERE invoice_id = $1', [invoiceId]);
    await reverseAndRecalculate(client, companyId || '', invoiceId);

    const invData = invoiceData;
    const cogsLines: { account_id: string; account_name: string; debit: number; credit: number; description: string }[] = [];
for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('purchase_invoice_items', item);
      const itemId = uuidv4();
      const itemData = { ...sanitizedItem, id: itemId, invoice_id: invoiceId };
      if (invData.company_id) itemData.company_id = invData.company_id;

      // Costing and stock update integration for purchases
      const prodRes = await client.query('SELECT * FROM products WHERE id = $1', [item.product_id]);
      if (prodRes.rows.length > 0) {
        const prod = prodRes.rows[0];
        if (prod.type !== 'service' && !prod.is_service) {
          const qty = parseFloat(item.quantity || '0');
          const unitPrice = parseFloat(item.unit_price || '0');
          if (qty > 0) {
            await recordPurchase(
              client,
              companyId,
              invData.warehouse_id || null,
              item.product_id,
              qty,
              unitPrice,
              invoiceId,
              invoiceData.invoice_number || `PINV-${invoiceId}`,
              invoiceData.date
            );
          }
        }
      }

      const itemKeys = Object.keys(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
      
      await client.query(
        `INSERT INTO "purchase_invoice_items" ("${itemKeys.join('", "')}") VALUES (${itemPlaceholders})`,
        Object.values(itemData)
      );
    }

    
    const productIdsToSync = (items || []).filter((i: any) => i.product_id).map((i: any) => i.product_id);
    if (productIdsToSync.length > 0) {
      await syncProductsCostAndJEs(client, companyId, productIdsToSync);
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('[CRASH PREVENTED] Purchase invoice update error:', error);
    sendError(res, 500, 'Failed to update purchase invoice', error.message);
  } finally {
    client.release();
  }
});

// --- Purchase Returns with Items (Transaction) ---
router.post('/purchase_returns', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    await client.query('BEGIN');
    const { items, ...rawReturnData } = req.body;
    const returnData = sanitizeData('purchase_returns', rawReturnData);
    if (!returnData.company_id) returnData.company_id = companyId;

    const returnId = returnData.id || uuidv4();
    if (!isUUID(returnId)) return sendError(res, 400, 'Invalid Return ID format');
    
    // Insert Purchase Return
    const rData = { ...returnData, id: returnId };
    const rKeys = Object.keys(rData);
    const rPlaceholders = rKeys.map((_, i) => `$${i + 1}`).join(', ');
    
    await client.query(
      `INSERT INTO "purchase_returns" ("${rKeys.join('", "')}") VALUES (${rPlaceholders})`,
      Object.values(rData)
    );

    // Insert Items
    for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('purchase_return_items', item);
      const itemId = uuidv4();
      const itemData = { ...sanitizedItem, id: itemId, return_id: returnId };
      if (rData.company_id) itemData.company_id = rData.company_id;

      // Cost and stock integration for purchase return
      const prodRes = await client.query('SELECT * FROM products WHERE id = $1', [item.product_id]);
      if (prodRes.rows.length > 0) {
        const prod = prodRes.rows[0];
        if (prod.type !== 'service' && !prod.is_service) {
          const qty = parseFloat(item.quantity || '0');
          if (qty > 0) {
            const returnUnitCost = parseFloat(item.unit_price || '0') || parseFloat(prod.weighted_average_cost || '0') || parseFloat(prod.cost_price || '0');
            await recordPurchaseReturn(
              client,
              companyId,
              returnData.warehouse_id || null,
              item.product_id,
              qty,
              returnUnitCost,
              returnId,
              returnData.return_number || `PRET-${returnId}`,
              returnData.date
            );
          }
        }
      }

      const itemKeys = Object.keys(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
      
      await client.query(
        `INSERT INTO "purchase_return_items" ("${itemKeys.join('", "')}") VALUES (${itemPlaceholders})`,
        Object.values(itemData)
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ id: returnId });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('[CRASH PREVENTED] Purchase return creation error:', error);
    sendError(res, 500, 'Failed to create purchase return', error.message);
  } finally {
    client.release();
  }
});

router.put('/purchase_returns/:id', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const returnId = req.params.id;
    const companyId = req.user?.company_id;
    if (!isUUID(returnId)) return sendError(res, 400, 'Invalid Return ID format');

    await client.query('BEGIN');
    // Removed legacy preservedEntryNumber code

    const { items, id: bodyId, ...rawReturnData } = req.body;
    const returnData = sanitizeData('purchase_returns', rawReturnData);
    
    const rKeys = Object.keys(returnData);
    const rValues = Object.values(returnData);
    const rSetClause = rKeys.map((key, i) => `"${key}" = $${i + 1}`).join(', ');
    
    let query = `UPDATE "purchase_returns" SET ${rSetClause} WHERE id = $${rKeys.length + 1}`;
    let params = [...rValues, returnId];
    if (companyId) {
      query += ` AND company_id = $${rKeys.length + 2}`;
      params.push(companyId);
    }

    const result = await client.query(query, params);
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return sendError(res, 404, 'Purchase Return not found or permission denied');
    }

    await client.query('DELETE FROM purchase_return_items WHERE return_id = $1', [returnId]);
    await reverseAndRecalculate(client, companyId || '', returnId);

    const returnDataFinal = returnData;
    const rData = returnDataFinal;
    const cogsLines: { account_id: string; account_name: string; debit: number; credit: number; description: string }[] = [];
for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('purchase_return_items', item);
      const itemId = uuidv4();
      const itemData = { ...sanitizedItem, id: itemId, return_id: returnId };
      if (rData.company_id) itemData.company_id = rData.company_id;

      // Cost and stock integration for purchase return
      const prodRes = await client.query('SELECT * FROM products WHERE id = $1', [item.product_id]);
      if (prodRes.rows.length > 0) {
        const prod = prodRes.rows[0];
        if (prod.type !== 'service' && !prod.is_service) {
          const qty = parseFloat(item.quantity || '0');
          if (qty > 0) {
            const returnUnitCost = parseFloat(item.unit_price || '0') || parseFloat(prod.weighted_average_cost || '0') || parseFloat(prod.cost_price || '0');
            await recordPurchaseReturn(
              client,
              companyId,
              returnDataFinal.warehouse_id || null,
              item.product_id,
              qty,
              returnUnitCost,
              returnId,
              returnDataFinal.return_number || `PRET-${returnId}`,
              returnDataFinal.date
            );
          }
        }
      }

      const itemKeys = Object.keys(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
      
      await client.query(
        `INSERT INTO "purchase_return_items" ("${itemKeys.join('", "')}") VALUES (${itemPlaceholders})`,
        Object.values(itemData)
      );
    }

    
    const productIdsToSync = (items || []).filter((i: any) => i.product_id).map((i: any) => i.product_id);
    if (productIdsToSync.length > 0) {
      await syncProductsCostAndJEs(client, companyId, productIdsToSync);
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('[CRASH PREVENTED] Purchase return update error:', error);
    sendError(res, 500, 'Failed to update purchase return', error.message);
  } finally {
    client.release();
  }
});

// --- Journal Entries (Accounting Transaction) ---
router.post('/journal_entries', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    await client.query('BEGIN');
    const { items, ...rawEntryData } = req.body;

    let totalDebit = 0;
    let totalCredit = 0;
    for (const item of (items || [])) {
      totalDebit += parseFloat(item.debit || 0);
      totalCredit += parseFloat(item.credit || 0);
    }
    const roundedDebit = Math.round(totalDebit * 100) / 100;
    const roundedCredit = Math.round(totalCredit * 100) / 100;
    if (Math.abs(roundedDebit - roundedCredit) >= 0.01) {
      await client.query('ROLLBACK');
      return sendError(res, 400, `القيد غير متزن (مجموع المدين لا يساوي مجموع الدائن). مجموع المدين: ${roundedDebit.toFixed(2)}، مجموع الدائن: ${roundedCredit.toFixed(2)}`);
    }

    const entryData = sanitizeData('journal_entries', rawEntryData);
    if (!entryData.company_id) entryData.company_id = companyId;
    entryData.total_debit = roundedDebit;
    entryData.total_credit = roundedCredit;

    // Duplicate skip removed

    const entryId = entryData.id || uuidv4();
    if (!isUUID(entryId)) return sendError(res, 400, 'Invalid Entry ID format');

    if (!entryData.entry_number && entryData.date) {
      entryData.entry_number = await generateNextSequence(client, companyId, 'journal_entries', entryData.date as string);
    }
    const finalEntryData = { ...entryData, id: entryId };
    const keys = Object.keys(finalEntryData);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    await client.query(
      `INSERT INTO journal_entries (${keys.join(', ')}) VALUES (${placeholders})`,
      Object.values(finalEntryData)
    );

    for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('journal_entry_lines', item);
      const itemId = uuidv4();
      const itemData = { ...sanitizedItem, id: itemId, journal_entry_id: entryId };
      if (finalEntryData.company_id) itemData.company_id = finalEntryData.company_id;

      const itemKeys = Object.keys(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(
        `INSERT INTO journal_entry_lines (${itemKeys.join(', ')}) VALUES (${itemPlaceholders})`,
        Object.values(itemData)
      );
    }

    
    if (['invoice', 'return', 'sales_return'].includes(finalEntryData.reference_type)) {
       console.log('[ERP] Auto-Syncing COGS for Journal Entry', entryId);
       await syncCOGSForJournalEntry(client, companyId, entryId, finalEntryData.reference_id, finalEntryData.reference_type);
    }

    await client.query('COMMIT');

    // Audit Log
    logAudit({
      company_id: req.user?.company_id,
      user_id: req.user?.id,
      username: (req.user as any)?.username || req.user?.email,
      user_email: req.user?.email,
      action: 'CREATE',
      module: 'JOURNAL_ENTRIES',
      details: `Created journal entry: ${finalEntryData.reference_number || entryId}`,
      entity_type: 'journal_entries',
      entity_id: entryId,
      ip_address: getIp(req),
      metadata: { entryData: finalEntryData, itemCount: (items || []).length }
    });

    res.status(201).json({ id: entryId });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('[CRASH PREVENTED] Journal entry creation error:', error);
    sendError(res, 500, 'Failed to create journal entry: ' + error.message, error.stack);
  } finally {
    client.release();
  }
});

router.put('/journal_entries/:id', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const entryId = req.params.id;
    const companyId = req.user?.company_id;
    if (!isUUID(entryId)) return sendError(res, 400, 'Invalid Entry ID format');

    await client.query('BEGIN');
    const { items, id: bodyId, ...rawEntryData } = req.body;

    let totalDebit = 0;
    let totalCredit = 0;
    for (const item of (items || [])) {
      totalDebit += parseFloat(item.debit || 0);
      totalCredit += parseFloat(item.credit || 0);
    }
    const roundedDebit = Math.round(totalDebit * 100) / 100;
    const roundedCredit = Math.round(totalCredit * 100) / 100;
    if (Math.abs(roundedDebit - roundedCredit) >= 0.01) {
      await client.query('ROLLBACK');
      return sendError(res, 400, `القيد غير متزن (مجموع المدين لا يساوي مجموع الدائن). مجموع المدين: ${roundedDebit.toFixed(2)}، مجموع الدائن: ${roundedCredit.toFixed(2)}`);
    }

    const entryData = sanitizeData('journal_entries', rawEntryData);
    entryData.total_debit = roundedDebit;
    entryData.total_credit = roundedCredit;
    
    const keys = Object.keys(entryData);
    const setClause = keys.map((key, i) => `"${key}" = $${i + 1}`).join(', ');
    
    let query = `UPDATE "journal_entries" SET ${setClause} WHERE id = $${keys.length + 1}`;
    let params = [...Object.values(entryData), entryId];
    if (companyId) {
      query += ` AND company_id = $${keys.length + 2}`;
      params.push(companyId);
    }

    const result = await client.query(query, params);
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return sendError(res, 404, 'Journal Entry not found or permission denied');
    }

    await client.query('DELETE FROM journal_entry_lines WHERE journal_entry_id = $1', [entryId]);
    for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('journal_entry_lines', item);
      const itemId = uuidv4();
      const itemData = { ...sanitizedItem, id: itemId, journal_entry_id: entryId };
      if (companyId) itemData.company_id = companyId;

      const itemKeys = Object.keys(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(
        `INSERT INTO journal_entry_lines (${itemKeys.join(', ')}) VALUES (${itemPlaceholders})`,
        Object.values(itemData)
      );
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('[CRASH PREVENTED] Journal entry update error:', error);
    sendError(res, 500, 'Failed to update journal entry', error.message);
  } finally {
    client.release();
  }
});

// Update password
router.post('/auth/update-password', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE "users" SET "password_hash" = $1 WHERE id = $2', [hashedPassword, req.user?.id]);

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// --- Complex Operations Logic ---
router.post('/operations/complex', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    const { field_values, id: bodyId, ...rawOpData } = req.body;
    const opData = sanitizeData('operations', rawOpData);
    
    await client.query('BEGIN');

    // 1. Generate Operation Number if not provided
    if (!opData.operation_number) {
      const colCheck = await client.query(`
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'operations' AND column_name = 'created_at'
      `);
      const hasCreatedAt = colCheck.rows.length > 0;
      const orderBy = hasCreatedAt ? 'created_at DESC' : 'id DESC';

      const { rows } = await client.query(
        `SELECT operation_number FROM operations WHERE company_id = $1 ORDER BY ${orderBy} LIMIT 1`,
        [companyId]
      );
      let nextNum = 1;
      if (rows.length > 0 && rows[0].operation_number) {
        const parts = rows[0].operation_number.split('-');
        const lastNum = parts.length > 1 ? parseInt(parts[1]) : NaN;
        if (!isNaN(lastNum)) nextNum = lastNum + 1;
      }
      opData.operation_number = `OP-${nextNum.toString().padStart(5, '0')}`;
    }

    // 2. Create Operation
    const opId = uuidv4();
    const finalOpData = { ...opData, id: opId, company_id: companyId };
    
    // Log final data for debugging
    console.log('[DEBUG] Creating operation with data:', JSON.stringify(finalOpData));
    
    const opKeys = Object.keys(finalOpData);
    const opValues = Object.values(finalOpData);
    const opPlaceholders = opKeys.map((_, i) => `$${i + 1}`).join(', ');
    
    await client.query(
      `INSERT INTO operations (${opKeys.join(', ')}) VALUES (${opPlaceholders})`,
      opValues
    );

    // 3. Create Field Values
    if (field_values && Array.isArray(field_values)) {
      console.log(`[DEBUG] Inserting ${field_values.length} field values for operation ${opId}`);
      for (const fv of field_values) {
        if (!fv.field_id) {
          console.warn('[WARN] Skipping invalid field_id:', fv.field_id);
          continue;
        }
        const fvId = uuidv4();
        await client.query(
          'INSERT INTO operation_field_values (id, operation_id, field_id, value, company_id) VALUES ($1, $2, $3, $4, $5)',
          [fvId, opId, fv.field_id, fv.value, companyId]
        );
      }
    }

    await client.query('COMMIT');

    // Audit Log
    logAudit({
      company_id: req.user?.company_id,
      user_id: req.user?.id,
      username: (req.user as any)?.username || req.user?.email,
      user_email: req.user?.email,
      action: 'CREATE',
      module: 'OPERATIONS',
      details: `Created complex operation: ${opData.operation_number || opId}`,
      entity_type: 'operations',
      entity_id: opId,
      ip_address: getIp(req),
      metadata: { opData, fieldValuesCount: (field_values || []).length }
    });

    res.status(201).json({ id: opId, operation_number: opData.operation_number });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('[CRASH PREVENTED] Complex Operation creation failed:', error);
    sendError(res, 500, 'Failed to create complex operation', error.message);
  } finally {
    client.release();
  }
});

router.put('/operations/complex/:id', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;
    if (!companyId) return sendError(res, 401, 'Unauthorized');
    if (!isUUID(id)) return sendError(res, 400, 'Invalid ID format');

    const { field_values, id: bodyId, company_id: bodyCompanyId, ...rawOpData } = req.body;
    const opData = sanitizeData('operations', rawOpData);
    
    await client.query('BEGIN');

    // 1. Update Operation
    const keys = Object.keys(opData);
    const values = Object.values(opData);
    if (keys.length > 0) {
      const setClause = keys.map((key, index) => {
        return `${key} = $${index + 1}`;
      }).join(', ');
      await client.query(
        `UPDATE "operations" SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $${keys.length + 1} AND company_id = $${keys.length + 2}`,
        [...values, id, companyId]
      );
    }

    // 2. Update Field Values (Delete and Re-insert for atomicity)
    if (field_values && Array.isArray(field_values)) {
      // First delete old ones for this operation (strictly filtered by company_id via Join or indirect if needed)
      // Since we know the operation ID and verified company ownership above, we can delete them.
      await client.query('DELETE FROM operation_field_values WHERE operation_id = $1', [id]);

      for (const fv of field_values) {
        if (!fv.field_id) continue;
        const fvId = uuidv4();
        await client.query(
          'INSERT INTO operation_field_values (id, operation_id, field_id, value, company_id) VALUES ($1, $2, $3, $4, $5)',
          [fvId, id, fv.field_id, fv.value, companyId]
        );
      }
    }

    await client.query('COMMIT');

    // Audit Log
    logAudit({
      company_id: companyId,
      user_id: req.user?.id,
      username: (req.user as any)?.username || req.user?.email,
      user_email: req.user?.email,
      action: 'UPDATE',
      module: 'OPERATIONS',
      details: `Updated complex operation: ${id}`,
      entity_type: 'operations',
      entity_id: id,
      ip_address: getIp(req),
      metadata: { opData, fieldValuesCount: (field_values || []).length }
    });

    res.json({ success: true });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('[CRASH PREVENTED] Complex Operation update failed:', error);
    sendError(res, 500, 'Failed to update complex operation', error.message);
  } finally {
    client.release();
  }
});

router.get('/operations/:id/values', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;
    if (!isUUID(id)) return sendError(res, 400, 'Invalid Operation ID format');

    const { rows } = await pool.query(`
      SELECT fv.*, f.name, f.label, f.type, f.unit 
      FROM operation_field_values fv
      JOIN operation_fields f ON fv.field_id = f.id
      JOIN operations o ON fv.operation_id = o.id
      WHERE fv.operation_id = $1 AND o.company_id = $2
    `, [id, companyId]);
    res.json(rows);
  } catch (error: any) {
    console.error(`[CRASH PREVENTED] Error in GET /operations/:id/values:`, error);
    sendError(res, 500, 'Failed to fetch operation values', error.message);
  }
});

// ==========================================
// Specialized Inventory Maintenance Routes
// ==========================================
router.post('/inventory/recalculate_all', async (req: any, res) => {
  const client = await pool.connect();
  try {
    let companyId = req.user?.company_id;
    // if (!companyId) return sendError(res, 401, 'Unauthorized');
    
    await client.query('BEGIN');
    const compRes = await client.query('SELECT id FROM companies LIMIT 1');
    companyId = compRes.rows.length > 0 ? compRes.rows[0].id : companyId;
    
    // 1. Delete fully orphaned movements (where parent transaction doesn't exist at all)
    const tables = [
      { type: 'invoice', table: 'invoices' },
      { type: 'purchase_invoice', table: 'purchase_invoices' },
      { type: 'returns', table: 'returns' },
      { type: 'purchase_returns', table: 'purchase_returns' }
    ];
    for (const { type, table } of tables) {
      await client.query(`DELETE FROM inventory_movements WHERE reference_type = $1 AND reference_id NOT IN (SELECT id FROM "${table}")`, [type]);
      await client.query(`DELETE FROM journal_entries WHERE reference_id NOT IN (SELECT id FROM "${table}") AND description LIKE $1`, [`%${type}%`]);
    }

    // 2. Find references that have duplicates or quantity mismatches
    const itemTypes = [
       { type: 'invoice', itemTable: 'invoice_items', fkey: 'invoice_id', isNegative: true },
       { type: 'purchase_invoice', itemTable: 'purchase_invoice_items', fkey: 'invoice_id', isNegative: false },
       { type: 'returns', itemTable: 'return_items', fkey: 'return_id', isNegative: false }, 
       { type: 'purchase_returns', itemTable: 'purchase_return_items', fkey: 'return_id', isNegative: true }
    ];

    let badReferenceIds = new Set<string>();

    for (const { type, itemTable, fkey, isNegative } of itemTypes) {
      // Find movements where product is totally missing from items
      const missingProd = await client.query(`
         SELECT m.reference_id FROM inventory_movements m
         WHERE m.reference_type = $1 AND m.company_id = $2
         AND NOT EXISTS (
            SELECT 1 FROM "${itemTable}" i 
            WHERE i."${fkey}" = m.reference_id 
            AND i.product_id = m.product_id
         )
      `, [type, companyId]);
      missingProd.rows.forEach(r => badReferenceIds.add(r.reference_id));

      // Find movements where quantity mismatches
      const mismatches = await client.query(`
         SELECT m.reference_id 
         FROM inventory_movements m
         JOIN "${itemTable}" i ON i."${fkey}" = m.reference_id AND i.product_id = m.product_id
         WHERE m.reference_type = $1 AND m.company_id = $2 AND ABS(m.quantity) != i.quantity
      `, [type, companyId]);
      mismatches.rows.forEach(r => badReferenceIds.add(r.reference_id));

      // Find duplicates
      const duplicates = await client.query(`
         SELECT reference_id FROM inventory_movements
         WHERE reference_type = $1 AND company_id = $2
         GROUP BY reference_id, product_id
         HAVING COUNT(*) > 1
      `, [type, companyId]);
      duplicates.rows.forEach(r => badReferenceIds.add(r.reference_id));
    }

    console.log(`[ERP] Recalculate: Found ${badReferenceIds.size} bad references. Fixing...`);

    const productsToRecalc = new Set<string>();
    
    // Fetch all products that need recalculation
    const allProdsRes = await client.query('SELECT id FROM products WHERE COALESCE(is_service, false) = false AND type != \'service\'');
    allProdsRes.rows.forEach(r => productsToRecalc.add(r.id));

    // For each bad reference, delete its movements and re-insert by calling the appropriate record function
    for (const refId of badReferenceIds) {
      const typeRes = await client.query(`SELECT reference_type FROM inventory_movements WHERE reference_id = $1 LIMIT 1`, [refId]);
      if (typeRes.rows.length === 0) continue;
      const refType = typeRes.rows[0].reference_type;

      let parentTable = '';
      let itemTable = '';
      let fkey = '';

      if (refType === 'invoice') { parentTable = 'invoices'; itemTable = 'invoice_items'; fkey = 'invoice_id'; }
      if (refType === 'purchase_invoice') { parentTable = 'purchase_invoices'; itemTable = 'purchase_invoice_items'; fkey = 'invoice_id'; }
      if (refType === 'returns') { parentTable = 'returns'; itemTable = 'return_items'; fkey = 'return_id'; }
      if (refType === 'purchase_returns') { parentTable = 'purchase_returns'; itemTable = 'purchase_return_items'; fkey = 'return_id'; }

      // Get parent data
      const parentRes = await client.query(`SELECT * FROM "${parentTable}" WHERE id = $1 AND company_id = $2`, [refId, companyId]);
      if (parentRes.rows.length === 0) {
         await client.query('DELETE FROM inventory_movements WHERE reference_id = $1', [refId]);
         continue;
      }
      const parentDoc = parentRes.rows[0];

      // Delete all old impacts
      await client.query('DELETE FROM inventory_movements WHERE reference_id = $1', [refId]);
      await client.query('DELETE FROM inventory_layers WHERE reference_id = $1', [refId]);
      
      // Get items
      const itemsRes = await client.query(`SELECT * FROM "${itemTable}" WHERE "${fkey}" = $1`, [refId]);

      for (const item of itemsRes.rows) {
          const qty = parseFloat(item.quantity || '0');
          if (qty <= 0 || !item.product_id) continue;
          productsToRecalc.add(item.product_id); // Track modified product

          if (refType === 'invoice') {
             await recordSale(client, companyId, parentDoc.warehouse_id || null, item.product_id, qty, refId, parentDoc.invoice_number, parentDoc.date);
          } else if (refType === 'purchase_invoice') {
             await recordPurchase(client, companyId, parentDoc.warehouse_id || null, item.product_id, qty, parseFloat(item.unit_price || item.cost_price || '0'), refId, parentDoc.invoice_number, parentDoc.date);
          } else if (refType === 'returns') {
             await recordSalesReturn(client, companyId, parentDoc.warehouse_id || null, item.product_id, qty, parseFloat(item.unit_price || item.unit_cost || item.cost_price || '0'), refId, parentDoc.return_number, parentDoc.date);
          } else if (refType === 'purchase_returns') {
             await recordPurchaseReturn(client, companyId, parentDoc.warehouse_id || null, item.product_id, qty, parseFloat(item.unit_price || item.unit_cost || item.cost_price || '0'), refId, parentDoc.return_number, parentDoc.date);
          }
      }
    }

    // Now recalculate stock for only the modified products
    console.log(`[ERP] Recalculate: Recalculating WAC for ${productsToRecalc.size} products in company ${companyId}...`);
    for (const pid of productsToRecalc) {
        await recalculateProductStock(client, companyId, pid);
    }
    
    // Sync COGS journal entries with latest inventory movement costs
    console.log('[ERP] Recalculate: Syncing COGS into Journal Entries (JS fallback logic)...');
    
    // 1. Fetch all related Journal Entries
    const jeRes = await client.query(`
      SELECT id, reference_id, reference_type 
      FROM journal_entries 
      WHERE reference_type IN ('invoice', 'return', 'sales_return') AND company_id = $1
    `, [companyId]);

    for (const je of jeRes.rows) {
       await syncCOGSForJournalEntry(client, companyId, je.id, je.reference_id, je.reference_type);
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'All products recalculated and journal entries synchronized successfully' });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('Recalculate error:', error);
    sendError(res, 500, 'Recalculation failed', error.message);
  } finally {
    client.release();
  }
});

// --- Sales Orders & Purchase Orders Routes ---
router.post('/sales_orders', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    const { items, ...rawOrderData } = req.body;
    if (!rawOrderData.customer_id) return sendError(res, 400, 'customer_id is required');
    if (!rawOrderData.date) return sendError(res, 400, 'date is required');

    await client.query('BEGIN');

    const orderData = sanitizeData('sales_orders', rawOrderData);
    if (!orderData.company_id) orderData.company_id = companyId;
    const orderId = orderData.id || uuidv4();
    orderData.status = 'pending';

    orderData.order_number = await generateNextSequence(client, companyId, 'sales_orders', orderData.date as string);

    const ordData = { ...orderData, id: orderId };
    const ordKeys = Object.keys(ordData);
    const ordValues = Object.values(ordData);
    const ordPlaceholders = ordKeys.map((_, i) => `$${i + 1}`).join(', ');

    await client.query(
      `INSERT INTO "sales_orders" ("${ordKeys.join('", "')}") VALUES (${ordPlaceholders})`,
      ordValues
    );

    for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('sales_order_items', item);
      const itemId = uuidv4();
      const itemData = { ...sanitizedItem, id: itemId, order_id: orderId };
      if (ordData.company_id) itemData.company_id = ordData.company_id;

      const itemKeys = Object.keys(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');

      await client.query(
        `INSERT INTO "sales_order_items" ("${itemKeys.join('", "')}") VALUES (${itemPlaceholders})`,
        Object.values(itemData)
      );
    }

    await client.query('COMMIT');

    logAudit({
      company_id: companyId,
      user_id: req.user?.id,
      username: (req.user as any)?.username || req.user?.email,
      user_email: req.user?.email,
      action: 'CREATE',
      module: 'SALES_ORDERS',
      details: `Created sales order: ${orderData.order_number}`,
      entity_type: 'sales_orders',
      entity_id: orderId,
      ip_address: getIp(req),
      metadata: { orderData, itemCount: (items || []).length }
    });

    res.status(201).json({ id: orderId, order_number: orderData.order_number });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('Sales Order creation failed:', error);
    sendError(res, 500, `Failed to create sales order: ${error.message}`, error.message);
  } finally {
    client.release();
  }
});

router.put('/sales_orders/:id', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const orderId = req.params.id;
    const companyId = req.user?.company_id;
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    await client.query('BEGIN');

    const statusRes = await client.query('SELECT status, invoice_number FROM sales_orders WHERE id = $1 AND company_id = $2', [orderId, companyId]);
    if (statusRes.rows.length > 0 && statusRes.rows[0].status === 'converted') {
      await client.query('ROLLBACK');
      return sendError(res, 400, `لا يمكن تعديل هذا الأمر لأنه تم تحويله بالفعل إلى فاتورة رقم ${statusRes.rows[0].invoice_number || ''}`);
    }

    const { items, id: bodyId, ...rawOrderData } = req.body;
    const orderData = sanitizeData('sales_orders', rawOrderData);
    delete (orderData as any).id;
    delete (orderData as any).company_id;
    delete (orderData as any).order_number;
    delete (orderData as any).status;

    const ordKeys = Object.keys(orderData);
    const ordValues = Object.values(orderData);
    const ordSetClause = ordKeys.map((key, i) => `"${key}" = $${i + 1}`).join(', ');

    let query = `UPDATE "sales_orders" SET ${ordSetClause} WHERE id = $${ordKeys.length + 1} AND company_id = $${ordKeys.length + 2}`;
    let params = [...ordValues, orderId, companyId];

    const result = await client.query(query, params);
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return sendError(res, 404, 'Sales Order not found or permission denied');
    }

    await client.query('DELETE FROM sales_order_items WHERE order_id = $1', [orderId]);

    for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('sales_order_items', item);
      const itemId = uuidv4();
      const itemData = { ...sanitizedItem, id: itemId, order_id: orderId, company_id: companyId };

      const itemKeys = Object.keys(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');

      await client.query(
        `INSERT INTO "sales_order_items" ("${itemKeys.join('", "')}") VALUES (${itemPlaceholders})`,
        Object.values(itemData)
      );
    }

    await client.query('COMMIT');

    logAudit({
      company_id: companyId,
      user_id: req.user?.id,
      username: (req.user as any)?.username || req.user?.email,
      user_email: req.user?.email,
      action: 'UPDATE',
      module: 'SALES_ORDERS',
      details: `Updated sales order: ${orderId}`,
      entity_type: 'sales_orders',
      entity_id: orderId,
      ip_address: getIp(req),
      metadata: { orderData, itemCount: (items || []).length }
    });

    res.json({ success: true });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('Sales Order update failed:', error);
    sendError(res, 500, `Failed to update sales order: ${error.message}`, error.message);
  } finally {
    client.release();
  }
});

router.post('/purchase_orders', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    const { items, ...rawOrderData } = req.body;
    if (!rawOrderData.supplier_id) return sendError(res, 400, 'supplier_id is required');
    if (!rawOrderData.date) return sendError(res, 400, 'date is required');

    await client.query('BEGIN');

    const orderData = sanitizeData('purchase_orders', rawOrderData);
    if (!orderData.company_id) orderData.company_id = companyId;
    const orderId = orderData.id || uuidv4();
    orderData.status = 'pending';

    orderData.order_number = await generateNextSequence(client, companyId, 'purchase_orders', orderData.date as string);

    const ordData = { ...orderData, id: orderId };
    const ordKeys = Object.keys(ordData);
    const ordValues = Object.values(ordData);
    const ordPlaceholders = ordKeys.map((_, i) => `$${i + 1}`).join(', ');

    await client.query(
      `INSERT INTO "purchase_orders" ("${ordKeys.join('", "')}") VALUES (${ordPlaceholders})`,
      ordValues
    );

    for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('purchase_order_items', item);
      const itemId = uuidv4();
      const itemData = { ...sanitizedItem, id: itemId, order_id: orderId };
      if (ordData.company_id) itemData.company_id = ordData.company_id;

      const itemKeys = Object.keys(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');

      await client.query(
        `INSERT INTO "purchase_order_items" ("${itemKeys.join('", "')}") VALUES (${itemPlaceholders})`,
        Object.values(itemData)
      );
    }

    await client.query('COMMIT');

    logAudit({
      company_id: companyId,
      user_id: req.user?.id,
      username: (req.user as any)?.username || req.user?.email,
      user_email: req.user?.email,
      action: 'CREATE',
      module: 'PURCHASE_ORDERS',
      details: `Created purchase order: ${orderData.order_number}`,
      entity_type: 'purchase_orders',
      entity_id: orderId,
      ip_address: getIp(req),
      metadata: { orderData, itemCount: (items || []).length }
    });

    res.status(201).json({ id: orderId, order_number: orderData.order_number });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('Purchase Order creation failed:', error);
    sendError(res, 500, `Failed to create purchase order: ${error.message}`, error.message);
  } finally {
    client.release();
  }
});

router.put('/purchase_orders/:id', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const orderId = req.params.id;
    const companyId = req.user?.company_id;
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    await client.query('BEGIN');

    const statusRes = await client.query('SELECT status, invoice_number FROM purchase_orders WHERE id = $1 AND company_id = $2', [orderId, companyId]);
    if (statusRes.rows.length > 0 && statusRes.rows[0].status === 'converted') {
      await client.query('ROLLBACK');
      return sendError(res, 400, `لا يمكن تعديل هذا الأمر لأنه تم تحويله بالفعل إلى فاتورة رقم ${statusRes.rows[0].invoice_number || ''}`);
    }

    const { items, id: bodyId, ...rawOrderData } = req.body;
    const orderData = sanitizeData('purchase_orders', rawOrderData);
    delete (orderData as any).id;
    delete (orderData as any).company_id;
    delete (orderData as any).order_number;
    delete (orderData as any).status;

    const ordKeys = Object.keys(orderData);
    const ordValues = Object.values(orderData);
    const ordSetClause = ordKeys.map((key, i) => `"${key}" = $${i + 1}`).join(', ');

    let query = `UPDATE "purchase_orders" SET ${ordSetClause} WHERE id = $${ordKeys.length + 1} AND company_id = $${ordKeys.length + 2}`;
    let params = [...ordValues, orderId, companyId];

    const result = await client.query(query, params);
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return sendError(res, 404, 'Purchase Order not found or permission denied');
    }

    await client.query('DELETE FROM purchase_order_items WHERE order_id = $1', [orderId]);

    for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('purchase_order_items', item);
      const itemId = uuidv4();
      const itemData = { ...sanitizedItem, id: itemId, order_id: orderId, company_id: companyId };

      const itemKeys = Object.keys(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');

      await client.query(
        `INSERT INTO "purchase_order_items" ("${itemKeys.join('", "')}") VALUES (${itemPlaceholders})`,
        Object.values(itemData)
      );
    }

    await client.query('COMMIT');

    logAudit({
      company_id: companyId,
      user_id: req.user?.id,
      username: (req.user as any)?.username || req.user?.email,
      user_email: req.user?.email,
      action: 'UPDATE',
      module: 'PURCHASE_ORDERS',
      details: `Updated purchase order: ${orderId}`,
      entity_type: 'purchase_orders',
      entity_id: orderId,
      ip_address: getIp(req),
      metadata: { orderData, itemCount: (items || []).length }
    });

    res.json({ success: true });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('Purchase Order update failed:', error);
    sendError(res, 500, `Failed to update purchase order: ${error.message}`, error.message);
  } finally {
    client.release();
  }
});

router.post('/warehouse_transfers', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    const { items, ...rawTransferData } = req.body;
    
    if (!rawTransferData.from_warehouse_id) return sendError(res, 400, 'from_warehouse_id is required');
    if (!rawTransferData.to_warehouse_id) return sendError(res, 400, 'to_warehouse_id is required');
    if (!rawTransferData.date) return sendError(res, 400, 'date is required');

    await client.query('BEGIN');

    const transferData = sanitizeData('warehouse_transfers', rawTransferData);
    if (!transferData.company_id) transferData.company_id = companyId;
    const transferId = transferData.id || uuidv4();
    transferData.id = transferId;
    
    if (!transferData.transfer_number) {
      transferData.transfer_number = await generateNextSequence(client, companyId, 'warehouse_transfers', transferData.date);
    }

    const whRes = await client.query('SELECT id, name FROM warehouses WHERE id IN ($1, $2)', [transferData.from_warehouse_id, transferData.to_warehouse_id]);
    const warehouses = whRes.rows;
    const fromWh = warehouses.find(w => w.id === transferData.from_warehouse_id);
    const toWh = warehouses.find(w => w.id === transferData.to_warehouse_id);
    transferData.from_warehouse_name = fromWh?.name || '';
    transferData.to_warehouse_name = toWh?.name || '';

    const keys = Object.keys(transferData);
    const values = Object.values(transferData);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    await client.query(
      `INSERT INTO "warehouse_transfers" ("${keys.join('", "')}") VALUES (${placeholders})`,
      values
    );

    for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('warehouse_transfer_items', item);
      const itemId = uuidv4();
      const itemData = {
        ...sanitizedItem,
        id: itemId,
        transfer_id: transferId,
        company_id: companyId
      };

      const prodRes = await client.query('SELECT name, code, cost_price, weighted_average_cost FROM products WHERE id = $1', [item.product_id]);
      if (prodRes.rows.length === 0) {
        throw new Error(`Product not found: ${item.product_id}`);
      }
      const prod = prodRes.rows[0];
      itemData.product_name = prod.name;
      itemData.product_code = prod.code;

      const currentCost = parseFloat(prod.weighted_average_cost || '0') || parseFloat(prod.cost_price || '0') || 0;
      itemData.unit_cost = currentCost;
      itemData.total_cost = parseFloat(item.quantity || '0') * currentCost;

      const itemKeys = Object.keys(itemData);
      const itemValues = Object.values(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(
        `INSERT INTO "warehouse_transfer_items" ("${itemKeys.join('", "')}") VALUES (${itemPlaceholders})`,
        itemValues
      );

      const quantity = parseFloat(item.quantity || '0');
      if (quantity > 0) {
        await recordTransfer(
          client,
          companyId,
          transferData.from_warehouse_id,
          transferData.to_warehouse_id,
          item.product_id,
          quantity,
          transferId,
          transferData.transfer_number,
          transferData.date
        );
      }
    }

    logAudit({
      company_id: companyId,
      user_id: req.user?.id,
      username: (req.user as any)?.username || req.user?.email,
      user_email: req.user?.email,
      action: 'CREATE',
      module: 'WAREHOUSE_TRANSFERS',
      details: `Created warehouse transfer: ${transferData.transfer_number} from ${transferData.from_warehouse_name} to ${transferData.to_warehouse_name}`,
      entity_type: 'warehouse_transfers',
      entity_id: transferId,
      ip_address: getIp(req),
      metadata: transferData
    });

    await client.query('COMMIT');
    res.status(201).json({ id: transferId, transfer_number: transferData.transfer_number });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error creating warehouse transfer:', error);
    sendError(res, 500, `Failed to create warehouse transfer. ${error.message}`, error.message);
  } finally {
    client.release();
  }
});

router.put('/warehouse_transfers/:id', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    const { items, ...rawTransferData } = req.body;

    await client.query('BEGIN');

    await reverseAndRecalculate(client, companyId, id);
    await client.query('DELETE FROM warehouse_transfer_items WHERE transfer_id = $1', [id]);

    const transferData = sanitizeData('warehouse_transfers', rawTransferData);
    delete (transferData as any).id;
    delete (transferData as any).company_id;

    const whRes = await client.query('SELECT id, name FROM warehouses WHERE id IN ($1, $2)', [transferData.from_warehouse_id, transferData.to_warehouse_id]);
    const warehouses = whRes.rows;
    const fromWh = warehouses.find(w => w.id === transferData.from_warehouse_id);
    const toWh = warehouses.find(w => w.id === transferData.to_warehouse_id);
    transferData.from_warehouse_name = fromWh?.name || '';
    transferData.to_warehouse_name = toWh?.name || '';

    const keys = Object.keys(transferData);
    const values = Object.values(transferData);
    const setClause = keys.map((key, i) => `"${key}" = $${i + 1}`).join(', ');
    await client.query(
      `UPDATE "warehouse_transfers" SET ${setClause} WHERE id = $${keys.length + 1} AND company_id = $${keys.length + 2}`,
      [...values, id, companyId]
    );

    for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('warehouse_transfer_items', item);
      const itemId = uuidv4();
      const itemData = {
        ...sanitizedItem,
        id: itemId,
        transfer_id: id,
        company_id: companyId
      };

      const prodRes = await client.query('SELECT name, code, cost_price, weighted_average_cost FROM products WHERE id = $1', [item.product_id]);
      if (prodRes.rows.length === 0) throw new Error(`Product not found: ${item.product_id}`);
      const prod = prodRes.rows[0];
      itemData.product_name = prod.name;
      itemData.product_code = prod.code;

      const currentCost = parseFloat(prod.weighted_average_cost || '0') || parseFloat(prod.cost_price || '0') || 0;
      itemData.unit_cost = currentCost;
      itemData.total_cost = parseFloat(item.quantity || '0') * currentCost;

      const itemKeys = Object.keys(itemData);
      const itemValues = Object.values(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(
        `INSERT INTO "warehouse_transfer_items" ("${itemKeys.join('", "')}") VALUES (${itemPlaceholders})`,
        itemValues
      );

      const quantity = parseFloat(item.quantity || '0');
      if (quantity > 0) {
        await recordTransfer(
          client,
          companyId,
          transferData.from_warehouse_id,
          transferData.to_warehouse_id,
          item.product_id,
          quantity,
          id,
          rawTransferData.transfer_number,
          transferData.date
        );
      }
    }

    logAudit({
      company_id: companyId,
      user_id: req.user?.id,
      username: (req.user as any)?.username || req.user?.email,
      user_email: req.user?.email,
      action: 'UPDATE',
      module: 'WAREHOUSE_TRANSFERS',
      details: `Updated warehouse transfer: ${rawTransferData.transfer_number}`,
      entity_type: 'warehouse_transfers',
      entity_id: id,
      ip_address: getIp(req),
      metadata: transferData
    });

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error updating warehouse transfer:', error);
    sendError(res, 500, `Failed to update warehouse transfer. ${error.message}`, error.message);
  } finally {
    client.release();
  }
});

router.get('/inventory/debug_moves', async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT reference_number, date::text as date, created_at, movement_type, quantity, unit_cost, total_cost 
      FROM inventory_movements 
      WHERE movement_type IN ('sale', 'purchase', 'sales_return', 'purchase_return', 'adjustment', 'transfer_out', 'transfer_in')
      ORDER BY date ASC, CASE WHEN quantity > 0 THEN 0 ELSE 1 END ASC, created_at ASC
      LIMIT 100
    `);
    res.json(rows);
  } catch (error: any) {
    console.error('Error fetching debug moves:', error);
    sendError(res, 500, error.message);
  } finally {
    client.release();
  }
});

// ==========================================
// OPENING STOCK BALANCES
// ==========================================
router.post('/opening_stock_balances', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    const { items, ...rawDocData } = req.body;
    
    if (!rawDocData.debit_account_id) return sendError(res, 400, 'debit_account_id is required');
    if (!rawDocData.credit_account_id) return sendError(res, 400, 'credit_account_id is required');
    if (!rawDocData.date) return sendError(res, 400, 'date is required');

    await client.query('BEGIN');

    const docData = sanitizeData('opening_stock_balances', rawDocData);
    if (!docData.company_id) docData.company_id = companyId;
    const docId = docData.id || uuidv4();
    docData.id = docId;
    
    if (!docData.document_number) {
      docData.document_number = await generateNextSequence(client, companyId, 'opening_stock_balances', docData.date);
    }

    const keys = Object.keys(docData);
    const values = Object.values(docData);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    await client.query(
      `INSERT INTO "opening_stock_balances" ("${keys.join('", "')}") VALUES (${placeholders})`,
      values
    );

    let totalValue = 0;
    const productsToSync: string[] = [];

    for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('opening_stock_items', item);
      const itemId = uuidv4();
      const itemData = {
        ...sanitizedItem,
        id: itemId,
        opening_stock_id: docId,
        company_id: companyId
      };

      const prodRes = await client.query('SELECT name, code FROM products WHERE id = $1', [item.product_id]);
      if (prodRes.rows.length === 0) {
        throw new Error(`Product not found: ${item.product_id}`);
      }
      const prod = prodRes.rows[0];
      itemData.product_name = prod.name;
      itemData.product_code = prod.code;

      const qty = parseFloat(item.quantity || '0');
      const cost = parseFloat(item.unit_cost || '0') || 0;
      const itemTotal = qty * cost;
      itemData.unit_cost = cost;
      itemData.total_cost = itemTotal;
      totalValue += itemTotal;

      const itemKeys = Object.keys(itemData);
      const itemValues = Object.values(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(
        `INSERT INTO "opening_stock_items" ("${itemKeys.join('", "')}") VALUES (${itemPlaceholders})`,
        itemValues
      );

      if (qty > 0) {
        await recordAdjustment(
          client,
          companyId,
          item.warehouse_id || null,
          item.product_id,
          qty,
          cost,
          docId,
          docData.document_number,
          docData.date
        );
        productsToSync.push(item.product_id);
      }
    }

    // Insert journal entry
    const entryId = uuidv4();
    const entryNumber = await generateNextSequence(client, companyId, 'journal_entries', docData.date);
    await client.query(
      `INSERT INTO "journal_entries" (id, company_id, entry_number, date, description, reference_id, reference_type, total_debit, total_credit, created_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)`,
      [
        entryId,
        companyId,
        entryNumber,
        docData.date,
        docData.description || `قيد افتتاح مخزون - سند رقم ${docData.document_number}`,
        docId,
        'opening_stock_balance',
        totalValue,
        totalValue,
        req.user?.id || null
      ]
    );

    // Fetch account names
    const debitAccRes = await client.query('SELECT name FROM accounts WHERE id = $1', [docData.debit_account_id]);
    const debitAccName = debitAccRes.rows[0]?.name || '';
    const creditAccRes = await client.query('SELECT name FROM accounts WHERE id = $1', [docData.credit_account_id]);
    const creditAccName = creditAccRes.rows[0]?.name || '';

    // Insert itemized lines per product
    let lineInserted = false;
    for (const item of (items || [])) {
      const qty = parseFloat(item.quantity || '0');
      const cost = parseFloat(item.unit_cost || '0') || 0;
      const itemTotal = qty * cost;

      if (itemTotal > 0) {
        // Find product name
        const prodRes = await client.query('SELECT name FROM products WHERE id = $1', [item.product_id]);
        const prodName = prodRes.rows[0]?.name || 'صنف غير معروف';

        // Debit line (Inventory)
        await client.query(
          `INSERT INTO "journal_entry_lines" (id, company_id, journal_entry_id, account_id, account_name, debit, credit, description, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [
            uuidv4(),
            companyId,
            entryId,
            docData.debit_account_id,
            debitAccName,
            itemTotal,
            0,
            `افتتاح مخزون - صنف: ${prodName} - سند رقم ${docData.document_number}`,
          ]
        );

        // Credit line (Capital / Counter Account)
        await client.query(
          `INSERT INTO "journal_entry_lines" (id, company_id, journal_entry_id, account_id, account_name, debit, credit, description, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [
            uuidv4(),
            companyId,
            entryId,
            docData.credit_account_id,
            creditAccName,
            0,
            itemTotal,
            `افتتاح مخزون - مقابل - صنف: ${prodName} - سند رقم ${docData.document_number}`,
          ]
        );
        lineInserted = true;
      }
    }

    // Fallback if no itemized lines were inserted (e.g. totalValue is 0)
    if (!lineInserted) {
      // Debit line
      await client.query(
        `INSERT INTO "journal_entry_lines" (id, company_id, journal_entry_id, account_id, account_name, debit, credit, description, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          uuidv4(),
          companyId,
          entryId,
          docData.debit_account_id,
          debitAccName,
          0,
          0,
          `افتتاح مخزون - سند رقم ${docData.document_number}`,
        ]
      );

      // Credit line
      await client.query(
        `INSERT INTO "journal_entry_lines" (id, company_id, journal_entry_id, account_id, account_name, debit, credit, description, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          uuidv4(),
          companyId,
          entryId,
          docData.credit_account_id,
          creditAccName,
          0,
          0,
          `افتتاح مخزون - مقابل - سند رقم ${docData.document_number}`,
        ]
      );
    }

    if (productsToSync.length > 0) {
      await syncProductsCostAndJEs(client, companyId, productsToSync);
    }

    logAudit({
      company_id: companyId,
      user_id: req.user?.id,
      username: (req.user as any)?.username || req.user?.email,
      user_email: req.user?.email,
      action: 'CREATE',
      module: 'OPENING_STOCK_BALANCES',
      details: `Created opening stock balance: ${docData.document_number} with value ${totalValue}`,
      entity_type: 'opening_stock_balances',
      entity_id: docId,
      ip_address: getIp(req),
      metadata: docData
    });

    await client.query('COMMIT');
    res.status(201).json({ id: docId, document_number: docData.document_number });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error creating opening stock balance:', error);
    sendError(res, 500, `Failed to create opening stock balance. ${error.message}`, error.message);
  } finally {
    client.release();
  }
});

router.put('/opening_stock_balances/:id', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    const { items, ...rawDocData } = req.body;

    await client.query('BEGIN');

    await reverseAndRecalculate(client, companyId, id);
    await client.query('DELETE FROM opening_stock_items WHERE opening_stock_id = $1', [id]);

    const docData = sanitizeData('opening_stock_balances', rawDocData);
    delete (docData as any).id;
    delete (docData as any).company_id;

    const keys = Object.keys(docData);
    const values = Object.values(docData);
    const setClause = keys.map((key, i) => `"${key}" = $${i + 1}`).join(', ');
    await client.query(
      `UPDATE "opening_stock_balances" SET ${setClause} WHERE id = $${keys.length + 1} AND company_id = $${keys.length + 2}`,
      [...values, id, companyId]
    );

    let totalValue = 0;
    const productsToSync: string[] = [];

    for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('opening_stock_items', item);
      const itemId = uuidv4();
      const itemData = {
        ...sanitizedItem,
        id: itemId,
        opening_stock_id: id,
        company_id: companyId
      };

      const prodRes = await client.query('SELECT name, code FROM products WHERE id = $1', [item.product_id]);
      if (prodRes.rows.length === 0) {
        throw new Error(`Product not found: ${item.product_id}`);
      }
      const prod = prodRes.rows[0];
      itemData.product_name = prod.name;
      itemData.product_code = prod.code;

      const qty = parseFloat(item.quantity || '0');
      const cost = parseFloat(item.unit_cost || '0') || 0;
      const itemTotal = qty * cost;
      itemData.unit_cost = cost;
      itemData.total_cost = itemTotal;
      totalValue += itemTotal;

      const itemKeys = Object.keys(itemData);
      const itemValues = Object.values(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(
        `INSERT INTO "opening_stock_items" ("${itemKeys.join('", "')}") VALUES (${itemPlaceholders})`,
        itemValues
      );

      if (qty > 0) {
        await recordAdjustment(
          client,
          companyId,
          item.warehouse_id || null,
          item.product_id,
          qty,
          cost,
          id,
          rawDocData.document_number,
          docData.date
        );
        productsToSync.push(item.product_id);
      }
    }

    // Insert journal entry
    const entryId = uuidv4();
    const entryNumber = await generateNextSequence(client, companyId, 'journal_entries', docData.date);
    await client.query(
      `INSERT INTO "journal_entries" (id, company_id, entry_number, date, description, reference_id, reference_type, total_debit, total_credit, created_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)`,
      [
        entryId,
        companyId,
        entryNumber,
        docData.date,
        docData.description || `قيد افتتاح مخزون - سند رقم ${rawDocData.document_number}`,
        id,
        'opening_stock_balance',
        totalValue,
        totalValue,
        req.user?.id || null
      ]
    );

    // Fetch account names
    const debitAccRes = await client.query('SELECT name FROM accounts WHERE id = $1', [docData.debit_account_id]);
    const debitAccName = debitAccRes.rows[0]?.name || '';
    const creditAccRes = await client.query('SELECT name FROM accounts WHERE id = $1', [docData.credit_account_id]);
    const creditAccName = creditAccRes.rows[0]?.name || '';

    // Insert itemized lines per product
    let lineInserted = false;
    for (const item of (items || [])) {
      const qty = parseFloat(item.quantity || '0');
      const cost = parseFloat(item.unit_cost || '0') || 0;
      const itemTotal = qty * cost;

      if (itemTotal > 0) {
        // Find product name
        const prodRes = await client.query('SELECT name FROM products WHERE id = $1', [item.product_id]);
        const prodName = prodRes.rows[0]?.name || 'صنف غير معروف';

        // Debit line (Inventory)
        await client.query(
          `INSERT INTO "journal_entry_lines" (id, company_id, journal_entry_id, account_id, account_name, debit, credit, description, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [
            uuidv4(),
            companyId,
            entryId,
            docData.debit_account_id,
            debitAccName,
            itemTotal,
            0,
            `افتتاح مخزون - صنف: ${prodName} - سند رقم ${rawDocData.document_number}`,
          ]
        );

        // Credit line (Capital / Counter Account)
        await client.query(
          `INSERT INTO "journal_entry_lines" (id, company_id, journal_entry_id, account_id, account_name, debit, credit, description, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [
            uuidv4(),
            companyId,
            entryId,
            docData.credit_account_id,
            creditAccName,
            0,
            itemTotal,
            `افتتاح مخزون - مقابل - صنف: ${prodName} - سند رقم ${rawDocData.document_number}`,
          ]
        );
        lineInserted = true;
      }
    }

    // Fallback if no itemized lines were inserted (e.g. totalValue is 0)
    if (!lineInserted) {
      // Debit line
      await client.query(
        `INSERT INTO "journal_entry_lines" (id, company_id, journal_entry_id, account_id, account_name, debit, credit, description, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          uuidv4(),
          companyId,
          entryId,
          docData.debit_account_id,
          debitAccName,
          0,
          0,
          `افتتاح مخزون - سند رقم ${rawDocData.document_number}`,
        ]
      );

      // Credit line
      await client.query(
        `INSERT INTO "journal_entry_lines" (id, company_id, journal_entry_id, account_id, account_name, debit, credit, description, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          uuidv4(),
          companyId,
          entryId,
          docData.credit_account_id,
          creditAccName,
          0,
          0,
          `افتتاح مخزون - مقابل - سند رقم ${rawDocData.document_number}`,
        ]
      );
    }

    if (productsToSync.length > 0) {
      await syncProductsCostAndJEs(client, companyId, productsToSync);
    }

    logAudit({
      company_id: companyId,
      user_id: req.user?.id,
      username: (req.user as any)?.username || req.user?.email,
      user_email: req.user?.email,
      action: 'UPDATE',
      module: 'OPENING_STOCK_BALANCES',
      details: `Updated opening stock balance: ${rawDocData.document_number} with value ${totalValue}`,
      entity_type: 'opening_stock_balances',
      entity_id: id,
      ip_address: getIp(req),
      metadata: docData
    });

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error updating opening stock balance:', error);
    sendError(res, 500, `Failed to update opening stock balance. ${error.message}`, error.message);
  } finally {
    client.release();
  }
});

// ==========================================
// STOCK ADJUSTMENTS
// ==========================================
router.post('/stock_adjustments', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    const { items, ...rawDocData } = req.body;
    
    if (!rawDocData.account_id) return sendError(res, 400, 'account_id (adjustment counter account) is required');
    if (!rawDocData.date) return sendError(res, 400, 'date is required');

    await client.query('BEGIN');

    const docData = sanitizeData('stock_adjustments', rawDocData);
    if (!docData.company_id) docData.company_id = companyId;
    const docId = docData.id || uuidv4();
    docData.id = docId;
    
    if (!docData.adjustment_number) {
      docData.adjustment_number = await generateNextSequence(client, companyId, 'stock_adjustments', docData.date);
    }

    const keys = Object.keys(docData);
    const values = Object.values(docData);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    await client.query(
      `INSERT INTO "stock_adjustments" ("${keys.join('", "')}") VALUES (${placeholders})`,
      values
    );

    const productsToSync: string[] = [];
    const journalLines: { account_id: string; debit: number; credit: number; description: string }[] = [];

    for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('stock_adjustment_items', item);
      const itemId = uuidv4();
      const itemData = {
        ...sanitizedItem,
        id: itemId,
        adjustment_id: docId,
        company_id: companyId
      };

      const prodRes = await client.query('SELECT name, code, inventory_account_id FROM products WHERE id = $1', [item.product_id]);
      if (prodRes.rows.length === 0) {
        throw new Error(`Product not found: ${item.product_id}`);
      }
      const prod = prodRes.rows[0];
      itemData.product_name = prod.name;
      itemData.product_code = prod.code;

      const qty = parseFloat(item.quantity || '0');
      const cost = parseFloat(item.unit_cost || '0') || 0;
      
      itemData.unit_cost = cost;

      const costInfo = await recordAdjustment(
        client,
        companyId,
        item.warehouse_id || null,
        item.product_id,
        qty,
        cost,
        docId,
        docData.adjustment_number,
        docData.date
      );

      // Use the costing engine's computed cost
      const totalCostValue = Math.abs(costInfo.totalCost || (qty * cost));
      itemData.total_cost = qty < 0 ? -totalCostValue : totalCostValue;

      const itemKeys = Object.keys(itemData);
      const itemValues = Object.values(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(
        `INSERT INTO "stock_adjustment_items" ("${itemKeys.join('", "')}") VALUES (${itemPlaceholders})`,
        itemValues
      );

      productsToSync.push(item.product_id);

      // Find product inventory account
      let invAccountId = prod.inventory_account_id;
      if (!invAccountId) {
        const fallbackRes = await client.query("SELECT id FROM accounts WHERE company_id = $1 AND (name LIKE '%مخزون%' OR name LIKE '%مخازن%') LIMIT 1", [companyId]);
        invAccountId = fallbackRes.rows[0]?.id || null;
      }

      if (invAccountId && totalCostValue > 0) {
        if (qty > 0) {
          journalLines.push({
            account_id: invAccountId,
            debit: totalCostValue,
            credit: 0,
            description: `تسوية إضافة مخزون صنف: ${prod.name}`
          });
          journalLines.push({
            account_id: docData.account_id,
            debit: 0,
            credit: totalCostValue,
            description: `تسوية إضافة مخزون صنف: ${prod.name}`
          });
        } else if (qty < 0) {
          journalLines.push({
            account_id: docData.account_id,
            debit: totalCostValue,
            credit: 0,
            description: `تسوية صرف مخزون صنف: ${prod.name}`
          });
          journalLines.push({
            account_id: invAccountId,
            debit: 0,
            credit: totalCostValue,
            description: `تسوية صرف مخزون صنف: ${prod.name}`
          });
        }
      }
    }

    if (journalLines.length > 0) {
      const entryId = uuidv4();
      const entryNumber = await generateNextSequence(client, companyId, 'journal_entries', docData.date);

      const totalDebit = journalLines.reduce((sum: number, line: any) => sum + (line.debit || 0), 0);
      const totalCredit = journalLines.reduce((sum: number, line: any) => sum + (line.credit || 0), 0);

      await client.query(
        `INSERT INTO "journal_entries" (id, company_id, entry_number, date, description, reference_id, reference_type, total_debit, total_credit, created_at, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)`,
        [
          entryId,
          companyId,
          entryNumber,
          docData.date,
          docData.description || `قيد تسوية مخزنية - سند رقم ${docData.adjustment_number}`,
          docId,
          'stock_adjustment',
          totalDebit,
          totalCredit,
          req.user?.id || null
        ]
      );

      for (const line of journalLines) {
        const accRes = await client.query('SELECT name FROM accounts WHERE id = $1', [line.account_id]);
        const accName = accRes.rows[0]?.name || '';
        await client.query(
          `INSERT INTO "journal_entry_lines" (id, company_id, journal_entry_id, account_id, account_name, debit, credit, description, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [
            uuidv4(),
            companyId,
            entryId,
            line.account_id,
            accName,
            line.debit,
            line.credit,
            line.description,
          ]
        );
      }
    }

    if (productsToSync.length > 0) {
      await syncProductsCostAndJEs(client, companyId, productsToSync);
    }

    logAudit({
      company_id: companyId,
      user_id: req.user?.id,
      username: (req.user as any)?.username || req.user?.email,
      user_email: req.user?.email,
      action: 'CREATE',
      module: 'STOCK_ADJUSTMENTS',
      details: `Created stock adjustment: ${docData.adjustment_number}`,
      entity_type: 'stock_adjustments',
      entity_id: docId,
      ip_address: getIp(req),
      metadata: docData
    });

    await client.query('COMMIT');
    res.status(201).json({ id: docId, adjustment_number: docData.adjustment_number });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error creating stock adjustment:', error);
    sendError(res, 500, `Failed to create stock adjustment. ${error.message}`, error.message);
  } finally {
    client.release();
  }
});

router.put('/stock_adjustments/:id', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    const { items, ...rawDocData } = req.body;

    await client.query('BEGIN');

    await reverseAndRecalculate(client, companyId, id);
    await client.query('DELETE FROM stock_adjustment_items WHERE adjustment_id = $1', [id]);

    const docData = sanitizeData('stock_adjustments', rawDocData);
    delete (docData as any).id;
    delete (docData as any).company_id;

    const keys = Object.keys(docData);
    const values = Object.values(docData);
    const setClause = keys.map((key, i) => `"${key}" = $${i + 1}`).join(', ');
    await client.query(
      `UPDATE "stock_adjustments" SET ${setClause} WHERE id = $${keys.length + 1} AND company_id = $${keys.length + 2}`,
      [...values, id, companyId]
    );

    const productsToSync: string[] = [];
    const journalLines: { account_id: string; debit: number; credit: number; description: string }[] = [];

    for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('stock_adjustment_items', item);
      const itemId = uuidv4();
      const itemData = {
        ...sanitizedItem,
        id: itemId,
        adjustment_id: id,
        company_id: companyId
      };

      const prodRes = await client.query('SELECT name, code, inventory_account_id FROM products WHERE id = $1', [item.product_id]);
      if (prodRes.rows.length === 0) {
        throw new Error(`Product not found: ${item.product_id}`);
      }
      const prod = prodRes.rows[0];
      itemData.product_name = prod.name;
      itemData.product_code = prod.code;

      const qty = parseFloat(item.quantity || '0');
      const cost = parseFloat(item.unit_cost || '0') || 0;
      
      itemData.unit_cost = cost;

      const costInfo = await recordAdjustment(
        client,
        companyId,
        item.warehouse_id || null,
        item.product_id,
        qty,
        cost,
        id,
        rawDocData.adjustment_number,
        docData.date
      );

      const totalCostValue = Math.abs(costInfo.totalCost || (qty * cost));
      itemData.total_cost = qty < 0 ? -totalCostValue : totalCostValue;

      const itemKeys = Object.keys(itemData);
      const itemValues = Object.values(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(
        `INSERT INTO "stock_adjustment_items" ("${itemKeys.join('", "')}") VALUES (${itemPlaceholders})`,
        itemValues
      );

      productsToSync.push(item.product_id);

      // Find product inventory account
      let invAccountId = prod.inventory_account_id;
      if (!invAccountId) {
        const fallbackRes = await client.query("SELECT id FROM accounts WHERE company_id = $1 AND (name LIKE '%مخزون%' OR name LIKE '%مخازن%') LIMIT 1", [companyId]);
        invAccountId = fallbackRes.rows[0]?.id || null;
      }

      if (invAccountId && totalCostValue > 0) {
        if (qty > 0) {
          journalLines.push({
            account_id: invAccountId,
            debit: totalCostValue,
            credit: 0,
            description: `تسوية إضافة مخزون صنف: ${prod.name}`
          });
          journalLines.push({
            account_id: docData.account_id,
            debit: 0,
            credit: totalCostValue,
            description: `تسوية إضافة مخزون صنف: ${prod.name}`
          });
        } else if (qty < 0) {
          journalLines.push({
            account_id: docData.account_id,
            debit: totalCostValue,
            credit: 0,
            description: `تسوية صرف مخزون صنف: ${prod.name}`
          });
          journalLines.push({
            account_id: invAccountId,
            debit: 0,
            credit: totalCostValue,
            description: `تسوية صرف مخزون صنف: ${prod.name}`
          });
        }
      }
    }

    if (journalLines.length > 0) {
      const entryId = uuidv4();
      const entryNumber = await generateNextSequence(client, companyId, 'journal_entries', docData.date);
      
      const totalDebit = journalLines.reduce((sum: number, line: any) => sum + (line.debit || 0), 0);
      const totalCredit = journalLines.reduce((sum: number, line: any) => sum + (line.credit || 0), 0);

      await client.query(
        `INSERT INTO "journal_entries" (id, company_id, entry_number, date, description, reference_id, reference_type, total_debit, total_credit, created_at, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)`,
        [
          entryId,
          companyId,
          entryNumber,
          docData.date,
          docData.description || `قيد تسوية مخزنية - سند رقم ${rawDocData.adjustment_number}`,
          id,
          'stock_adjustment',
          totalDebit,
          totalCredit,
          req.user?.id || null
        ]
      );

      for (const line of journalLines) {
        const accRes = await client.query('SELECT name FROM accounts WHERE id = $1', [line.account_id]);
        const accName = accRes.rows[0]?.name || '';
        await client.query(
          `INSERT INTO "journal_entry_lines" (id, company_id, journal_entry_id, account_id, account_name, debit, credit, description, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [
            uuidv4(),
            companyId,
            entryId,
            line.account_id,
            accName,
            line.debit,
            line.credit,
            line.description,
          ]
        );
      }
    }

    if (productsToSync.length > 0) {
      await syncProductsCostAndJEs(client, companyId, productsToSync);
    }

    logAudit({
      company_id: companyId,
      user_id: req.user?.id,
      username: (req.user as any)?.username || req.user?.email,
      user_email: req.user?.email,
      action: 'UPDATE',
      module: 'STOCK_ADJUSTMENTS',
      details: `Updated stock adjustment: ${rawDocData.adjustment_number}`,
      entity_type: 'stock_adjustments',
      entity_id: id,
      ip_address: getIp(req),
      metadata: docData
    });

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error updating stock adjustment:', error);
    sendError(res, 500, `Failed to update stock adjustment. ${error.message}`, error.message);
  } finally {
    client.release();
  }
});

// ─── Exchange Rate Auto-Update ────────────────────────────────────────────────

/**
 * POST /api/erp/currencies/update-rates
 *
 * Fetches live rates from exchangerate.host and persists them to currency_rates.
 * Runs entirely on the server — no Node.js modules leak into the browser bundle.
 *
 * Body (optional): { baseCurrency?: string }
 * Returns: PersistRatesResult { success, inserted, updated, skipped, message }
 */
router.post('/currencies/update-rates', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { ExchangeRatePersistenceService } = await import('../services/ExchangeRatePersistenceService.js');
    const baseCurrency: string = req.body?.baseCurrency || 'EGP';

    const userId = req.user?.id;
    let updatedBy = 'Automatic';
    if (userId) {
      const { rows } = await pool.query('SELECT name, username FROM users WHERE id = $1', [userId]);
      if (rows.length > 0) {
        updatedBy = rows[0].name || rows[0].username || 'User';
      }
    }
    const companyId = req.user?.company_id || 'SYSTEM';

    console.log(`[ERP] /currencies/update-rates called by user=${req.user?.id} base=${baseCurrency} company=${companyId} by=${updatedBy}`);

    const result = await ExchangeRatePersistenceService.persistLatestRates(
      { baseCurrency },
      companyId,
      updatedBy
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(502).json(result);
    }
  } catch (error: any) {
    console.error('[ERP] /currencies/update-rates error:', error);
    res.status(500).json({
      success: false,
      inserted: 0,
      updated: 0,
      skipped: 0,
      message: error.message || 'Internal server error',
    });
  }
});

/**
 * GET /api/erp/currency-rates/history?currency_code=<CODE>&company_id=<ID>
 *
 * Returns sorted sync history records filtered by company_id and currency_code.
 */
router.get('/currency-rates/history', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = (req.query.company_id as string) || req.user?.company_id;
    const currencyCode = req.query.currency_code as string;

    if (!companyId || !currencyCode) {
      return res.status(400).json({ error: 'company_id and currency_code are required' });
    }

    const { rows } = await pool.query(
      `SELECT id, company_id, currency_code, exchange_rate, provider, retrieved_date, retrieved_time, updated_by, status, created_at
       FROM exchange_rate_history
       WHERE company_id = $1 AND UPPER(currency_code) = UPPER($2)
       ORDER BY created_at DESC, retrieved_date DESC, retrieved_time DESC
       LIMIT 100`,
      [companyId, currencyCode]
    );

    res.json(rows);
  } catch (error: any) {
    console.error('[ERP] /currency-rates/history error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ─── Phase 5: Latest Exchange Rates from currency_rates ───────────────────────

/**
 * GET /api/erp/currency-rates/latest?company_id=<id>
 *
 * Returns one row per currency in the company with its latest rate from the
 * `currency_rates` table (Phase 1 schema). Uses LEFT JOIN so currencies that
 * have no persisted rate still appear with null rate / rate_date.
 *
 * Response: Array<{ currency_id, rate: number|null, rate_date: string|null }>
 */
router.get('/currency-rates/latest', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = (req.query.company_id as string) || req.user?.company_id;
    if (!companyId) return res.status(400).json({ error: 'company_id is required' });

    // DISTINCT ON gives the most-recent rate_date row per currency_id.
    // LEFT JOIN ensures currencies with no currency_rates row are included (rate = NULL).
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (c.id)
          c.id             AS currency_id,
          cr.rate          AS rate,
          cr.rate_date::text AS rate_date
       FROM currencies c
       LEFT JOIN currency_rates cr ON cr.currency_id = c.id
       WHERE c.company_id = $1
       ORDER BY c.id, cr.rate_date DESC NULLS LAST`,
      [companyId]
    );

    res.json(rows);
  } catch (error: any) {
    console.error('[ERP] GET /currency-rates/latest error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
