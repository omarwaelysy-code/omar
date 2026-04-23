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

// Helper to log activity
async function logActivity(
  company_id: string,
  user_id: string,
  username: string,
  action: string,
  details: string,
  category?: string | string[],
  document_id?: string,
  changes?: any,
  ip_address?: string
) {
  try {
    await pool.query(
      `INSERT INTO activity_logs (company_id, user_id, username, action, details, category, document_id, changes, ip_address) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [company_id, user_id, username, action, details, JSON.stringify(category), document_id, JSON.stringify(changes), ip_address]
    );
  } catch (error) {
    console.error('Failed to log server activity:', error);
  }
}

// Configure multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

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

    for (const table of TABLES_TO_BACKUP) {
      try {
        let query = `SELECT * FROM ${table} WHERE company_id = $1`;
        if (table === 'companies') {
          query = `SELECT * FROM companies WHERE id = $1`;
        }
        const { rows } = await pool.query(query, [companyId]).catch(() => ({ rows: [] }));
        if (rows.length > 0) {
          const ws = XLSX.utils.json_to_sheet(rows);
          XLSX.utils.book_append_sheet(wb, ws, table.substring(0, 31)); // sheet names limited to 31 chars
        }
      } catch (e) {
        console.warn(`Skipping table during excel export: ${table}`);
      }
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=export_${companyId}.xlsx`);
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

      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
      for (const row: any of rows) {
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
  
  Object.keys(filters).forEach((key, index) => {
    conditions.push(`${key} = $${index + 1}`);
    values.push(filters[key]);
  });
  
  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
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
    await logActivity(
      company_id,
      id,
      username,
      'إنشاء مستخدم',
      `تم إنشاء مستخدم جديد: ${username} ببريد: ${email}`,
      'users',
      id
    );

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

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Log login activity
    await logActivity(
      user.company_id,
      user.id,
      user.username,
      'تسجيل الدخول',
      `تم تسجيل دخول المستخدم: ${user.username}`,
      'auth',
      user.id,
      null,
      req.ip
    );

    const token = jwt.sign(
      { id: user.id, email: user.email, company_id: user.company_id, role: user.role },
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
  'customer_discounts', 'supplier_discounts', 'receipt_vouchers', 'payment_vouchers', 'cash_transfers'
];

modules.forEach(moduleName => {
  // List with filters
  router.get(`/${moduleName}`, authenticateToken, async (req, res) => {
    try {
      const rows = await getList(moduleName, req.query);
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get Single
  router.get(`/${moduleName}/:id`, authenticateToken, async (req, res) => {
    try {
      const { rows }: any = await pool.query(`SELECT * FROM ${moduleName} WHERE id = $1`, [req.params.id]);
      res.json(rows[0] || null);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create
  router.post(`/${moduleName}`, authenticateToken, async (req, res) => {
    try {
      const data = { ...req.body };
      // Most tables use UUIDs, but activity_logs uses BIGSERIAL
      if (!data.id && moduleName !== 'activity_logs') {
        data.id = uuidv4();
      }
      
      const keys = Object.keys(data);
      const values = Object.values(data);
      const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
      
      const result = await pool.query(
        `INSERT INTO ${moduleName} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`,
        values
      );
      res.status(201).json(result.rows[0] || data);
    } catch (error: any) {
      console.error(`Error in POST /${moduleName}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update
  router.put(`/${moduleName}/:id`, authenticateToken, async (req, res) => {
    try {
      const keys = Object.keys(req.body);
      const values = Object.values(req.body);
      const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
      
      await pool.query(
        `UPDATE ${moduleName} SET ${setClause} WHERE id = $${keys.length + 1}`,
        [...values, req.params.id]
      );
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete
  router.delete(`/${moduleName}/:id`, authenticateToken, async (req, res) => {
    try {
      await pool.query(`DELETE FROM ${moduleName} WHERE id = $1`, [req.params.id]);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
});

// --- Invoices with Items (Transaction) ---
router.post('/invoices', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { items, ...invoiceData } = req.body;
    const invoiceId = invoiceData.id || uuidv4();
    
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
    for (const item of items) {
      const itemId = uuidv4();
      const itemData = { ...item, id: itemId, invoice_id: invoiceId };
      const itemKeys = Object.keys(itemData);
      const itemPlaceholders = itemKeys.map((_, i) => `$${i + 1}`).join(', ');
      
      await client.query(
        `INSERT INTO invoice_items (${itemKeys.join(', ')}) VALUES (${itemPlaceholders})`,
        Object.values(itemData)
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ id: invoiceId });
  } catch (error: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// --- Journal Entries (Accounting Transaction) ---
router.post('/journal_entries', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { items, ...entryData } = req.body;
    const entryId = entryData.id || uuidv4();

    await client.query(
      `INSERT INTO journal_entries (id, company_id, date, description, reference_id, reference_type, reference_number, total_debit, total_credit) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [entryId, entryData.company_id, entryData.date, entryData.description, entryData.reference_id, entryData.reference_type, entryData.reference_number, entryData.total_debit, entryData.total_credit]
    );

    for (const item of items) {
      await client.query(
        `INSERT INTO journal_entry_lines (id, journal_entry_id, account_id, description, debit, credit) VALUES ($1, $2, $3, $4, $5, $6)`,
        [uuidv4(), entryId, item.account_id, item.description, item.debit, item.credit]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ id: entryId });
  } catch (error: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
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

export default router;
