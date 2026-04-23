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

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

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
      const id = req.body.id || uuidv4();
      const data = { ...req.body, id };
      const keys = Object.keys(data);
      const values = Object.values(data);
      const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
      
      await pool.query(
        `INSERT INTO ${moduleName} (${keys.join(', ')}) VALUES (${placeholders})`,
        values
      );
      res.status(201).json(data);
    } catch (error: any) {
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
