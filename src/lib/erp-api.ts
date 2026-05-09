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
  'activity_logs'
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
router.post('/system/restore', authenticateToken, authorizeRoles('super_admin', 'admin'), upload.single('file'), async (req: AuthRequest, res) => {
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
router.post('/system/import-excel', authenticateToken, authorizeRoles('super_admin', 'admin'), upload.single('file'), async (req: AuthRequest, res) => {
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
  let sql = `SELECT * FROM ${table}`;
  const values: any[] = [];
  const conditions: string[] = [];
  
  let paramIndex = 1;
  Object.keys(filters).forEach((key) => {
    const value = filters[key];
    
    if (key === 'date_from') {
      conditions.push(`date >= $${paramIndex++}`);
      values.push(value);
    } else if (key === 'date_to') {
      conditions.push(`date <= $${paramIndex++}`);
      values.push(value);
    } else {
      conditions.push(`${key} = $${paramIndex++}`);
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
  'customers', 'suppliers', 'products', 'payment_methods', 
  'expense_categories', 'accounts', 'account_types', 'settings', 'users', 'companies',
  'invoices', 'invoice_items', 'journal_entries', 'journal_entry_lines', 'activity_logs',
  'returns', 'return_items', 'purchase_invoices', 'purchase_returns', 
  'customer_discounts', 'supplier_discounts', 'receipt_vouchers', 'payment_vouchers', 'cash_transfers',
  'system_config', 'audit_logs', 'operation_categories', 'operations', 'operation_fields',
  'departments', 'cost_centers', 'operation_field_values', 'field_operation_categories'
];

// --- Flexible Operations Logic ---
router.get('/operation_fields/by-category/:categoryId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { categoryId } = req.params;
    const companyId = req.user?.company_id;

    if (!companyId) return res.status(401).json({ error: 'Unauthorized' });

    // 1. Get the category and its parents (recursive query)
    const categoryQuery = `
      WITH RECURSIVE category_tree AS (
        SELECT id, parent_id FROM operation_categories WHERE id = $1 AND company_id = $2
        UNION ALL
        SELECT c.id, c.parent_id FROM operation_categories c
        INNER JOIN category_tree ct ON c.id = ct.parent_id
      )
      SELECT id FROM category_tree;
    `;
    
    // If categoryId is 'null' or empty, we just look for general fields
    let categoryIds: string[] = [];
    if (categoryId && categoryId !== 'null' && categoryId !== 'undefined') {
      const { rows: treeRows } = await pool.query(categoryQuery, [categoryId, companyId]);
      categoryIds = treeRows.map(r => r.id);
    }

    // 2. Fetch fields: 
    // - Linked to selected category or its parents via field_operation_categories
    // - OR Direct operation_category_id match
    // - OR General fields (both operation_category_id is null AND no links found)
    let fieldsQuery = `
      SELECT DISTINCT f.* FROM operation_fields f
      LEFT JOIN field_operation_categories fc ON f.id = fc.field_id
      WHERE (f.company_id = $1)
      AND (
        (f.operation_category_id IS NULL AND NOT EXISTS (SELECT 1 FROM field_operation_categories WHERE field_id = f.id))
    `;

    const params: any[] = [companyId];
    if (categoryIds.length > 0) {
      fieldsQuery += ` 
        OR f.operation_category_id = ANY($2)
        OR f.category_id = ANY($2)
        OR fc.category_id = ANY($2)
      `;
      params.push(categoryIds);
    }
    fieldsQuery += `) ORDER BY f.sort_order ASC, f.name ASC`;

    const { rows: fields } = await pool.query(fieldsQuery, params);
    res.json(fields.map(f => parseRow('operation_fields', f)));
  } catch (error: any) {
    console.error('Error fetching fields by category:', error);
    res.status(500).json({ error: error.message });
  }
});

const transactionalModules = ['invoices', 'returns', 'purchase_invoices', 'purchase_returns', 'journal_entries'];

// Helper to validate UUID/string format (simplified to check string)
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
  const jsonbFields = ['entity', 'category', 'changes', 'items', 'settings', 'permissions', 'metadata', 'features', 'options'];
  
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
  const jsonbFields = ['entity', 'category', 'changes', 'items', 'settings', 'permissions', 'metadata', 'features', 'value', 'options'];

  allowedKeys.forEach(key => {
    if (key in data) {
      let value = data[key];
      
      // Convert empty strings to null for IDs and decimals
      if (value === '' && (key.endsWith('_id') || key === 'amount' || key === 'price' || key === 'unit_price' || key === 'total' || key === 'subtotal')) {
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
        if (EXPECTED_SCHEMA[moduleName]?.includes('company_id') && !queryFilters.company_id && req.user?.company_id) {
          queryFilters.company_id = req.user.company_id;
        }

        rows = await getList(moduleName, queryFilters);

        // Fetch sub-items for relevant modules
        if (transactionalModules.includes(moduleName)) {
          for (let row of rows) {
            const items = await fetchItems(moduleName, row.id);
            row.items = items;
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

        const { rows }: any = await pool.query(`SELECT * FROM ${moduleName} WHERE id = $1`, [id]);
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
    }

    if (itemsTable) {
      const { rows } = await pool.query(`SELECT * FROM ${itemsTable} WHERE ${foreignKey} = $1`, [id]);
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
            `INSERT INTO ${moduleName} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`,
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

          const sanitizedData = sanitizeData(moduleName, req.body);
          delete (sanitizedData as any).id;
          if (moduleName !== 'companies') delete (sanitizedData as any).company_id;

          const keys = Object.keys(sanitizedData);
          const values = Object.values(sanitizedData);
          if (keys.length === 0) return sendError(res, 400, 'No valid fields for update');

          const setClause = keys.map((key, index) => {
            return `${key} = $${index + 1}`;
          }).join(', ');
          
          let query = `UPDATE ${moduleName} SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $${keys.length + 1}`;
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
      try {
        const { id } = req.params;
        const companyId = req.user?.company_id;

        const excludedFromCheck = ['activity_logs', 'migrations'];
        if (!id || typeof id !== 'string') {
          return sendError(res, 400, 'Invalid ID format');
        }

        let query = `DELETE FROM ${moduleName} WHERE id = $1`;
        let params = [id];

        if (EXPECTED_SCHEMA[moduleName]?.includes('company_id') && companyId && moduleName !== 'companies') {
          query += ` AND company_id = $2`;
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
          action: 'DELETE',
          module: moduleName.toUpperCase(),
          details: `Deleted ${moduleName}: ${id}`,
          entity_type: moduleName,
          entity_id: id,
          ip_address: getIp(req)
        });

        res.json({ success: true });
      } catch (error: any) {
        console.error(`Error in DELETE /${moduleName}:`, error);
        sendError(res, 500, `Failed to delete ${moduleName}`, error.message);
      }
    });
  });
});

// --- Invoices with Items (Transaction) ---
router.post('/invoices', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    await client.query('BEGIN');
    const { items, ...rawInvoiceData } = req.body;
    const invoiceData = sanitizeData('invoices', rawInvoiceData);
    
    // Ensure company_id
    if (!invoiceData.company_id) invoiceData.company_id = companyId;
    const invoiceId = invoiceData.id || uuidv4();
    if (!isUUID(invoiceId)) return sendError(res, 400, 'Invalid Invoice ID format');

    // Insert Invoice
    const invData = { ...invoiceData, id: invoiceId };
    const invKeys = Object.keys(invData);
    const invValues = Object.values(invData);
    const invPlaceholders = invKeys.map((_, i) => `$${i + 1}`).join(', ');
    
    await client.query(
      `INSERT INTO invoices (${invKeys.join(', ')}) VALUES (${invPlaceholders})`,
      invValues
    );

    // Insert Items
    for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('invoice_items', item);
      const itemId = uuidv4();
      const itemData = { ...sanitizedItem, id: itemId, invoice_id: invoiceId };
      if (invData.company_id) itemData.company_id = invData.company_id;

      const itemKeys = Object.keys(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
      
      await client.query(
        `INSERT INTO invoice_items (${itemKeys.join(', ')}) VALUES (${itemPlaceholders})`,
        Object.values(itemData)
      );
    }

    await client.query('COMMIT');

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
    await client.query('ROLLBACK');
    console.error('[CRASH PREVENTED] Invoice creation error:', error);
    sendError(res, 500, 'Failed to create invoice', error.message);
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
    const { items, id: bodyId, ...rawInvoiceData } = req.body;
    const invoiceData = sanitizeData('invoices', rawInvoiceData);
    
    const invKeys = Object.keys(invoiceData);
    const invValues = Object.values(invoiceData);
    const invSetClause = invKeys.map((key, i) => `${key} = $${i + 1}`).join(', ');
    
    let query = `UPDATE invoices SET ${invSetClause} WHERE id = $${invKeys.length + 1}`;
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
    for (const item of (items || [])) {
      const { id: itemIdTrash, ...itemDataRaw } = item;
      const itemData = sanitizeData('invoice_items', itemDataRaw);
      const itemId = uuidv4();
      const finalItemData = { ...itemData, id: itemId, invoice_id: invoiceId };
      if (companyId) finalItemData.company_id = companyId;

      const itemKeys = Object.keys(finalItemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(
        `INSERT INTO invoice_items (${itemKeys.join(', ')}) VALUES (${itemPlaceholders})`,
        Object.values(finalItemData)
      );
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
      `INSERT INTO returns (${rKeys.join(', ')}) VALUES (${rPlaceholders})`,
      Object.values(rData)
    );

    // Insert Items
    for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('return_items', item);
      const itemId = uuidv4();
      const itemData = { ...sanitizedItem, id: itemId, return_id: returnId };
      if (rData.company_id) itemData.company_id = rData.company_id;

      const itemKeys = Object.keys(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
      
      await client.query(
        `INSERT INTO return_items (${itemKeys.join(', ')}) VALUES (${itemPlaceholders})`,
        Object.values(itemData)
      );
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
    const { items, id: bodyId, ...rawReturnData } = req.body;
    const returnData = sanitizeData('returns', rawReturnData);
    
    const rKeys = Object.keys(returnData);
    const rValues = Object.values(returnData);
    const rSetClause = rKeys.map((key, i) => `${key} = $${i + 1}`).join(', ');
    
    let query = `UPDATE returns SET ${rSetClause} WHERE id = $${rKeys.length + 1}`;
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
    for (const item of (items || [])) {
      const { id: itemIdTrash, ...itemRawData } = item;
      const sanitizedItem = sanitizeData('return_items', itemRawData);
      const itemId = uuidv4();
      const finalItemData = { ...sanitizedItem, id: itemId, return_id: returnId };
      if (companyId) finalItemData.company_id = companyId;

      const itemKeys = Object.keys(finalItemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(
        `INSERT INTO return_items (${itemKeys.join(', ')}) VALUES (${itemPlaceholders})`,
        Object.values(finalItemData)
      );
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
    
    // Insert Purchase Invoice
    const invData = { ...invoiceData, id: invoiceId };
    const invKeys = Object.keys(invData);
    const invValues = Object.values(invData);
    const invPlaceholders = invKeys.map((_, i) => `$${i + 1}`).join(', ');
    
    await client.query(
      `INSERT INTO purchase_invoices (${invKeys.join(', ')}) VALUES (${invPlaceholders})`,
      invValues
    );

    // Insert Items
    for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('purchase_invoice_items', item);
      const itemId = uuidv4();
      const itemData = { ...sanitizedItem, id: itemId, invoice_id: invoiceId };
      if (invData.company_id) itemData.company_id = invData.company_id;

      const itemKeys = Object.keys(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
      
      await client.query(
        `INSERT INTO purchase_invoice_items (${itemKeys.join(', ')}) VALUES (${itemPlaceholders})`,
        Object.values(itemData)
      );
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
    const { items, id: bodyId, ...rawInvoiceData } = req.body;
    const invoiceData = sanitizeData('purchase_invoices', rawInvoiceData);
    
    const invKeys = Object.keys(invoiceData);
    const invValues = Object.values(invoiceData);
    const invSetClause = invKeys.map((key, i) => `${key} = $${i + 1}`).join(', ');
    
    let query = `UPDATE purchase_invoices SET ${invSetClause} WHERE id = $${invKeys.length + 1}`;
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
    for (const item of (items || [])) {
      const { id: itemIdTrash, ...itemRawData } = item;
      const sanitizedItem = sanitizeData('purchase_invoice_items', itemRawData);
      const itemId = uuidv4();
      const finalItemData = { ...sanitizedItem, id: itemId, invoice_id: invoiceId };
      if (companyId) finalItemData.company_id = companyId;

      const itemKeys = Object.keys(finalItemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(
        `INSERT INTO purchase_invoice_items (${itemKeys.join(', ')}) VALUES (${itemPlaceholders})`,
        Object.values(finalItemData)
      );
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
      `INSERT INTO purchase_returns (${rKeys.join(', ')}) VALUES (${rPlaceholders})`,
      Object.values(rData)
    );

    // Insert Items
    for (const item of (items || [])) {
      const sanitizedItem = sanitizeData('purchase_return_items', item);
      const itemId = uuidv4();
      const itemData = { ...sanitizedItem, id: itemId, return_id: returnId };
      if (rData.company_id) itemData.company_id = rData.company_id;

      const itemKeys = Object.keys(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
      
      await client.query(
        `INSERT INTO purchase_return_items (${itemKeys.join(', ')}) VALUES (${itemPlaceholders})`,
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
    const { items, id: bodyId, ...rawReturnData } = req.body;
    const returnData = sanitizeData('purchase_returns', rawReturnData);
    
    const rKeys = Object.keys(returnData);
    const rValues = Object.values(returnData);
    const rSetClause = rKeys.map((key, i) => `${key} = $${i + 1}`).join(', ');
    
    let query = `UPDATE purchase_returns SET ${rSetClause} WHERE id = $${rKeys.length + 1}`;
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
    for (const item of (items || [])) {
      const { id: itemIdTrash, ...itemRawData } = item;
      const sanitizedItem = sanitizeData('purchase_return_items', itemRawData);
      const itemId = uuidv4();
      const finalItemData = { ...sanitizedItem, id: itemId, return_id: returnId };
      if (companyId) finalItemData.company_id = companyId;

      const itemKeys = Object.keys(finalItemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(
        `INSERT INTO purchase_return_items (${itemKeys.join(', ')}) VALUES (${itemPlaceholders})`,
        Object.values(finalItemData)
      );
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
    const entryData = sanitizeData('journal_entries', rawEntryData);
    if (!entryData.company_id) entryData.company_id = companyId;

    const entryId = entryData.id || uuidv4();
    if (!isUUID(entryId)) return sendError(res, 400, 'Invalid Entry ID format');

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
    sendError(res, 500, 'Failed to create journal entry', error.message);
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
    const entryData = sanitizeData('journal_entries', rawEntryData);
    
    const keys = Object.keys(entryData);
    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
    
    let query = `UPDATE journal_entries SET ${setClause} WHERE id = $${keys.length + 1}`;
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
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, req.user?.id]);

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
        `UPDATE operations SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $${keys.length + 1} AND company_id = $${keys.length + 2}`,
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

export default router;
