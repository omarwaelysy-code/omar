import { Router } from 'express';
import pool from './postgres';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken, AuthRequest, getAuthenticatedCompanyId } from './auth-middleware';
import { checkPermission, ensureUniqueSequenceNumber } from './erp-api';
import { balanceAndValidateJournalEntry } from './sync-cogs';

function sendError(res: any, code: number, msg: string) {
  return res.status(code).json({ error: msg });
}

function getIp(req: any): string {
  return req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
}

async function logAudit(poolClient: any, data: {
  company_id: string;
  user_id?: string;
  username?: string;
  action: string;
  module: string;
  details: string;
  entity_type: string;
  entity_id: string;
  ip_address?: string;
  metadata?: any;
}) {
  try {
    await poolClient.query(`
      INSERT INTO activity_logs (
        company_id, user_id, username, action, details, entity, document_id, ip_address, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, CURRENT_TIMESTAMP)
    `, [
      data.company_id,
      data.user_id || null,
      data.username || 'system',
      data.action,
      data.details,
      JSON.stringify([data.entity_type]),
      data.entity_id,
      data.ip_address || null
    ]);
  } catch (e) {
    console.error('Audit log failed:', e);
  }
}

// Dedicated helper to create balanced fixed asset journal entries
async function createAssetJournalEntry(
  client: any,
  companyId: string,
  entryData: {
    date: string;
    description: string;
    reference_id: string;
    reference_type: string;
    reference_number: string;
    total_debit: number;
    total_credit: number;
    created_by?: string;
    items: Array<{
      account_id: string;
      account_name: string;
      debit: number;
      credit: number;
      description?: string;
      department_id?: string | null;
      cost_center_id?: string | null;
      supplier_id?: string | null;
      supplier_name?: string | null;
      customer_id?: string | null;
      customer_name?: string | null;
      sub_account_id?: string | null;
      sub_account_type?: string;
    }>;
  }
): Promise<string> {
  const jeId = uuidv4();
  const rawDate: any = entryData.date;
  const dateStr = (rawDate as any) instanceof Date
    ? (rawDate as any).toISOString().slice(0, 10)
    : String(rawDate || new Date().toISOString().slice(0, 10)).slice(0, 10);

  const entryNumber = await ensureUniqueSequenceNumber(pool, companyId, 'journal_entries', dateStr);

  await client.query(
    `INSERT INTO journal_entries (
      id, company_id, entry_number, date, description, 
      reference_id, reference_type, reference_number, 
      total_debit, total_credit, status, created_by, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'posted', $11, CURRENT_TIMESTAMP)`,
    [
      jeId, companyId, entryNumber, dateStr, entryData.description,
      entryData.reference_id, entryData.reference_type, entryData.reference_number,
      entryData.total_debit, entryData.total_credit, entryData.created_by || 'system'
    ]
  );

  for (const item of entryData.items) {
    const lineId = uuidv4();
    await client.query(
      `INSERT INTO journal_entry_lines (
        id, journal_entry_id, account_id, account_name, description,
        debit, credit, company_id, supplier_id, supplier_name,
        customer_id, customer_name, department_id, cost_center_id,
        sub_account_id, sub_account_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        lineId, jeId, item.account_id, item.account_name, item.description || '',
        item.debit || 0, item.credit || 0, companyId, item.supplier_id || null, item.supplier_name || null,
        item.customer_id || null, item.customer_name || null, item.department_id || null, item.cost_center_id || null,
        item.sub_account_id || null, item.sub_account_type || null
      ]
    );
  }

  await balanceAndValidateJournalEntry(client, jeId);
  return jeId;
}

export const fixedAssetsRouter = Router();

// ==========================================
// 1. Dashboard Stats
// ==========================================
fixedAssetsRouter.get(['/fixed-assets/dashboard', '/fixed_assets/dashboard'], authenticateToken, async (req: AuthRequest, res: any) => {
  try {
    const companyId = getAuthenticatedCompanyId(req);
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    // Totals & Statuses
    const { rows: totalRows } = await pool.query(`
      SELECT 
        COUNT(*)::int AS total_assets,
        COALESCE(SUM(capitalized_cost), 0)::float AS total_acquisition_cost,
        COALESCE(SUM(accumulated_depreciation), 0)::float AS total_accumulated_depreciation,
        COALESCE(SUM(net_book_value), 0)::float AS total_net_book_value,
        COUNT(CASE WHEN status = 'FULLY_DEPRECIATED' THEN 1 END)::int AS fully_depreciated_count,
        COUNT(CASE WHEN status = 'UNDER_MAINTENANCE' THEN 1 END)::int AS under_maintenance_count,
        COUNT(CASE WHEN status IN ('DISPOSED', 'SOLD', 'SCRAPPED') THEN 1 END)::int AS disposed_count,
        COUNT(CASE WHEN acquisition_date >= date_trunc('month', CURRENT_DATE) THEN 1 END)::int AS added_this_month_count
      FROM fixed_assets
      WHERE company_id = $1
    `, [companyId]);

    const stats = totalRows[0] || {};

    // Depreciation this month
    const { rows: monthlyDeprRows } = await pool.query(`
      SELECT COALESCE(SUM(total_depreciation), 0)::float AS depr_this_month
      FROM asset_depreciation_runs
      WHERE company_id = $1 AND status = 'POSTED'
        AND to_date >= date_trunc('month', CURRENT_DATE)
    `, [companyId]);
    stats.depreciation_this_month = monthlyDeprRows[0]?.depr_this_month || 0;

    // Distribution by Category
    const { rows: catRows } = await pool.query(`
      SELECT 
        COALESCE(ac.name, 'غير مصنف') AS category_name,
        COUNT(fa.id)::int AS count,
        COALESCE(SUM(fa.capitalized_cost), 0)::float AS total_cost,
        COALESCE(SUM(fa.net_book_value), 0)::float AS total_nbv
      FROM fixed_assets fa
      LEFT JOIN asset_categories ac ON ac.id = fa.category_id
      WHERE fa.company_id = $1
      GROUP BY ac.name
      ORDER BY total_cost DESC
    `, [companyId]);
    stats.category_distribution = catRows;

    // Distribution by Warehouse / Branch
    const { rows: whRows } = await pool.query(`
      SELECT 
        COALESCE(w.name, 'المركز الرئيسي') AS warehouse_name,
        COUNT(fa.id)::int AS count,
        COALESCE(SUM(fa.capitalized_cost), 0)::float AS total_cost
      FROM fixed_assets fa
      LEFT JOIN warehouses w ON w.id = fa.warehouse_id
      WHERE fa.company_id = $1
      GROUP BY w.name
      ORDER BY total_cost DESC
    `, [companyId]);
    stats.warehouse_distribution = whRows;

    // Distribution by Department
    const { rows: deptRows } = await pool.query(`
      SELECT 
        COALESCE(d.name, 'عام') AS department_name,
        COUNT(fa.id)::int AS count,
        COALESCE(SUM(fa.capitalized_cost), 0)::float AS total_cost
      FROM fixed_assets fa
      LEFT JOIN departments d ON d.id = fa.department_id
      WHERE fa.company_id = $1
      GROUP BY d.name
      ORDER BY total_cost DESC
    `, [companyId]);
    stats.department_distribution = deptRows;

    // Monthly Depreciation Trend (last 6 months)
    const { rows: trendRows } = await pool.query(`
      SELECT 
        TO_CHAR(to_date, 'YYYY-MM') AS month,
        COALESCE(SUM(total_depreciation), 0)::float AS amount
      FROM asset_depreciation_runs
      WHERE company_id = $1 AND status = 'POSTED'
        AND to_date >= (CURRENT_DATE - INTERVAL '6 months')
      GROUP BY TO_CHAR(to_date, 'YYYY-MM')
      ORDER BY month ASC
    `, [companyId]);
    stats.monthly_depreciation_trend = trendRows;

    res.json(stats);
  } catch (error: any) {
    console.error('Error in GET /fixed-assets/dashboard:', error);
    sendError(res, 500, error.message);
  }
});

// ==========================================
// 2. Categories
// ==========================================
fixedAssetsRouter.get(['/fixed-assets/categories', '/fixed_assets/categories'], authenticateToken, async (req: AuthRequest, res: any) => {
  try {
    const companyId = getAuthenticatedCompanyId(req);
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    const { rows } = await pool.query(`
      SELECT 
        ac.*,
        p.name AS parent_name,
        a_asset.name AS asset_account_name,
        a_acc.name AS accumulated_depreciation_account_name,
        a_exp.name AS depreciation_expense_account_name,
        a_gain.name AS gain_account_name,
        a_loss.name AS loss_account_name
      FROM asset_categories ac
      LEFT JOIN asset_categories p ON p.id = ac.parent_id
      LEFT JOIN accounts a_asset ON a_asset.id = ac.asset_account_id
      LEFT JOIN accounts a_acc ON a_acc.id = ac.accumulated_depreciation_account_id
      LEFT JOIN accounts a_exp ON a_exp.id = ac.depreciation_expense_account_id
      LEFT JOIN accounts a_gain ON a_gain.id = ac.gain_account_id
      LEFT JOIN accounts a_loss ON a_loss.id = ac.loss_account_id
      WHERE ac.company_id = $1
      ORDER BY ac.code ASC, ac.name ASC
    `, [companyId]);

    res.json(rows);
  } catch (error: any) {
    console.error('Error in GET /fixed-assets/categories:', error);
    sendError(res, 500, error.message);
  }
});

fixedAssetsRouter.post(['/fixed-assets/categories', '/fixed_assets/categories'], authenticateToken, async (req: AuthRequest, res: any) => {
  try {
    const companyId = getAuthenticatedCompanyId(req);
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    const id = uuidv4();
    const {
      parent_id, code, name, name_en, description,
      asset_account_id, accumulated_depreciation_account_id,
      depreciation_expense_account_id, gain_account_id, loss_account_id,
      default_depreciation_method, default_useful_life, default_salvage_value, is_active
    } = req.body;

    if (!name || !code) return sendError(res, 400, 'الاسم وكود التصنيف مطلوبان');

    const { rows } = await pool.query(`
      INSERT INTO asset_categories (
        id, company_id, parent_id, code, name, name_en, description,
        asset_account_id, accumulated_depreciation_account_id, depreciation_expense_account_id,
        gain_account_id, loss_account_id, default_depreciation_method,
        default_useful_life, default_salvage_value, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `, [
      id, companyId, parent_id || null, code, name, name_en || null, description || null,
      asset_account_id || null, accumulated_depreciation_account_id || null, depreciation_expense_account_id || null,
      gain_account_id || null, loss_account_id || null, default_depreciation_method || 'STRAIGHT_LINE',
      Number(default_useful_life) || 5.0, Number(default_salvage_value) || 0.0, is_active !== false
    ]);

    res.json(rows[0]);
  } catch (error: any) {
    console.error('Error in POST /fixed-assets/categories:', error);
    sendError(res, 500, error.message);
  }
});

fixedAssetsRouter.put(['/fixed-assets/categories/:id', '/fixed_assets/categories/:id'], authenticateToken, async (req: AuthRequest, res: any) => {
  try {
    const companyId = getAuthenticatedCompanyId(req);
    if (!companyId) return sendError(res, 401, 'Unauthorized');
    const { id } = req.params;

    const {
      parent_id, code, name, name_en, description,
      asset_account_id, accumulated_depreciation_account_id,
      depreciation_expense_account_id, gain_account_id, loss_account_id,
      default_depreciation_method, default_useful_life, default_salvage_value, is_active
    } = req.body;

    const { rows } = await pool.query(`
      UPDATE asset_categories SET
        parent_id = $1, code = $2, name = $3, name_en = $4, description = $5,
        asset_account_id = $6, accumulated_depreciation_account_id = $7,
        depreciation_expense_account_id = $8, gain_account_id = $9, loss_account_id = $10,
        default_depreciation_method = $11, default_useful_life = $12,
        default_salvage_value = $13, is_active = $14, updated_at = CURRENT_TIMESTAMP
      WHERE id = $15 AND company_id = $16
      RETURNING *
    `, [
      parent_id || null, code, name, name_en || null, description || null,
      asset_account_id || null, accumulated_depreciation_account_id || null,
      depreciation_expense_account_id || null, gain_account_id || null, loss_account_id || null,
      default_depreciation_method || 'STRAIGHT_LINE', Number(default_useful_life) || 5.0,
      Number(default_salvage_value) || 0.0, is_active !== false, id, companyId
    ]);

    if (rows.length === 0) return sendError(res, 404, 'التصنيف غير موجود');
    res.json(rows[0]);
  } catch (error: any) {
    console.error('Error in PUT /fixed-assets/categories/:id:', error);
    sendError(res, 500, error.message);
  }
});

fixedAssetsRouter.delete(['/fixed-assets/categories/:id', '/fixed_assets/categories/:id'], authenticateToken, async (req: AuthRequest, res: any) => {
  try {
    const companyId = getAuthenticatedCompanyId(req);
    if (!companyId) return sendError(res, 401, 'Unauthorized');
    const { id } = req.params;

    const { rows: assetCheck } = await pool.query(
      `SELECT id FROM fixed_assets WHERE category_id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId]
    );
    if (assetCheck.length > 0) {
      return sendError(res, 400, 'لا يمكن حذف هذا التصنيف لوجود أصول ثابتة مرتبطة به');
    }

    await pool.query(`DELETE FROM asset_categories WHERE id = $1 AND company_id = $2`, [id, companyId]);
    res.json({ success: true, message: 'تم حذف التصنيف بنجاح' });
  } catch (error: any) {
    console.error('Error in DELETE /fixed-assets/categories/:id:', error);
    sendError(res, 500, error.message);
  }
});

// ==========================================
// 3. Next Auto Number Preview
// ==========================================
fixedAssetsRouter.get(['/fixed-assets/next-number', '/fixed_assets/next-number'], authenticateToken, async (req: AuthRequest, res: any) => {
  try {
    const companyId = getAuthenticatedCompanyId(req);
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    const dateStr = new Date().toISOString().slice(0, 10);
    const num = await ensureUniqueSequenceNumber(pool, companyId, 'fixed_assets', dateStr);
    res.json({ asset_number: num });
  } catch (error: any) {
    res.json({ asset_number: 'AST-000001' });
  }
});

// ==========================================
// 4. Fixed Assets List & Details
// ==========================================
fixedAssetsRouter.get(['/fixed-assets', '/fixed_assets'], authenticateToken, async (req: AuthRequest, res: any) => {
  try {
    const companyId = getAuthenticatedCompanyId(req);
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    const {
      category_id, warehouse_id, department_id, cost_center_id,
      custodian_id, status, search
    } = req.query as Record<string, string>;

    let query = `
      SELECT 
        fa.*,
        ac.name AS category_name,
        ac.code AS category_code,
        w.name AS warehouse_name,
        d.name AS department_name,
        cc.name AS cost_center_name,
        e.name AS custodian_name,
        s.name AS supplier_name,
        pi.invoice_number AS purchase_invoice_number,
        a_asset.name AS asset_account_name,
        a_acc.name AS accumulated_depreciation_account_name,
        a_exp.name AS depreciation_expense_account_name,
        a_gain.name AS gain_account_name,
        a_loss.name AS loss_account_name,
        je_cap.entry_number AS capitalization_journal_entry_number,
        je_disp.entry_number AS disposal_journal_entry_number
      FROM fixed_assets fa
      LEFT JOIN asset_categories ac ON ac.id = fa.category_id
      LEFT JOIN warehouses w ON w.id = fa.warehouse_id
      LEFT JOIN departments d ON d.id = fa.department_id
      LEFT JOIN cost_centers cc ON cc.id = fa.cost_center_id
      LEFT JOIN employees e ON e.id = fa.custodian_id
      LEFT JOIN suppliers s ON s.id = fa.supplier_id
      LEFT JOIN purchase_invoices pi ON pi.id = fa.purchase_invoice_id
      LEFT JOIN accounts a_asset ON a_asset.id = fa.asset_account_id
      LEFT JOIN accounts a_acc ON a_acc.id = fa.accumulated_depreciation_account_id
      LEFT JOIN accounts a_exp ON a_exp.id = fa.depreciation_expense_account_id
      LEFT JOIN accounts a_gain ON a_gain.id = fa.gain_account_id
      LEFT JOIN accounts a_loss ON a_loss.id = fa.loss_account_id
      LEFT JOIN journal_entries je_cap ON je_cap.id = fa.capitalization_journal_entry_id
      LEFT JOIN journal_entries je_disp ON je_disp.id = fa.disposal_journal_entry_id
      WHERE fa.company_id = $1
    `;

    const params: any[] = [companyId];

    if (category_id) {
      params.push(category_id);
      query += ` AND fa.category_id = $${params.length}`;
    }
    if (warehouse_id) {
      params.push(warehouse_id);
      query += ` AND fa.warehouse_id = $${params.length}`;
    }
    if (department_id) {
      params.push(department_id);
      query += ` AND fa.department_id = $${params.length}`;
    }
    if (cost_center_id) {
      params.push(cost_center_id);
      query += ` AND fa.cost_center_id = $${params.length}`;
    }
    if (custodian_id) {
      params.push(custodian_id);
      query += ` AND fa.custodian_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND fa.status = $${params.length}`;
    }
    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      query += ` AND (fa.name ILIKE $${params.length} OR fa.asset_number ILIKE $${params.length} OR fa.serial_number ILIKE $${params.length} OR fa.barcode ILIKE $${params.length})`;
    }

    query += ` ORDER BY fa.created_at DESC`;

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (error: any) {
    console.error('Error in GET /fixed-assets:', error);
    sendError(res, 500, error.message);
  }
});

fixedAssetsRouter.get(['/fixed-assets/:id', '/fixed_assets/:id'], authenticateToken, async (req: AuthRequest, res: any, next: any) => {
  try {
    const { id } = req.params;
    if (['depreciation', 'reports', 'categories', 'dashboard', 'next-number'].includes(id)) {
      return next();
    }
    const companyId = getAuthenticatedCompanyId(req);
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    const { rows } = await pool.query(`
      SELECT 
        fa.*,
        ac.name AS category_name,
        ac.code AS category_code,
        w.name AS warehouse_name,
        d.name AS department_name,
        cc.name AS cost_center_name,
        e.name AS custodian_name,
        s.name AS supplier_name,
        pi.invoice_number AS purchase_invoice_number,
        a_asset.name AS asset_account_name,
        a_acc.name AS accumulated_depreciation_account_name,
        a_exp.name AS depreciation_expense_account_name,
        a_gain.name AS gain_account_name,
        a_loss.name AS loss_account_name,
        je_cap.entry_number AS capitalization_journal_entry_number,
        je_disp.entry_number AS disposal_journal_entry_number
      FROM fixed_assets fa
      LEFT JOIN asset_categories ac ON ac.id = fa.category_id
      LEFT JOIN warehouses w ON w.id = fa.warehouse_id
      LEFT JOIN departments d ON d.id = fa.department_id
      LEFT JOIN cost_centers cc ON cc.id = fa.cost_center_id
      LEFT JOIN employees e ON e.id = fa.custodian_id
      LEFT JOIN suppliers s ON s.id = fa.supplier_id
      LEFT JOIN purchase_invoices pi ON pi.id = fa.purchase_invoice_id
      LEFT JOIN accounts a_asset ON a_asset.id = fa.asset_account_id
      LEFT JOIN accounts a_acc ON a_acc.id = fa.accumulated_depreciation_account_id
      LEFT JOIN accounts a_exp ON a_exp.id = fa.depreciation_expense_account_id
      LEFT JOIN accounts a_gain ON a_gain.id = fa.gain_account_id
      LEFT JOIN accounts a_loss ON a_loss.id = fa.loss_account_id
      LEFT JOIN journal_entries je_cap ON je_cap.id = fa.capitalization_journal_entry_id
      LEFT JOIN journal_entries je_disp ON je_disp.id = fa.disposal_journal_entry_id
      WHERE fa.id = $1 AND fa.company_id = $2
    `, [id, companyId]);

    if (rows.length === 0) return sendError(res, 404, 'الأصل غير موجود');
    const asset = rows[0];

    // Load components
    const { rows: compRows } = await pool.query(
      `SELECT * FROM asset_components WHERE asset_id = $1 ORDER BY created_at ASC`,
      [id]
    );
    asset.components = compRows;

    res.json(asset);
  } catch (error: any) {
    console.error('Error in GET /fixed-assets/:id:', error);
    sendError(res, 500, error.message);
  }
});

// ==========================================
// 5. Create Asset
// ==========================================
fixedAssetsRouter.post(['/fixed-assets', '/fixed_assets'], authenticateToken, async (req: AuthRequest, res: any) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const companyId = getAuthenticatedCompanyId(req);
    if (!companyId) {
      await client.query('ROLLBACK');
      return sendError(res, 401, 'Unauthorized');
    }

    const {
      name, name_ar, name_en, category_id, description,
      serial_number, barcode, manufacturer, model,
      acquisition_date, capitalization_date, depreciation_start_date,
      acquisition_cost, additional_cost, salvage_value,
      useful_life, useful_life_unit, depreciation_method,
      warehouse_id, department_id, cost_center_id, location_name,
      custodian_id, custodian_name, custody_date,
      supplier_id, purchase_invoice_id, purchase_order_number, invoice_date,
      asset_account_id, accumulated_depreciation_account_id,
      depreciation_expense_account_id, gain_account_id, loss_account_id,
      attachments, components, asset_number: proposedNum
    } = req.body;

    if (!name) {
      await client.query('ROLLBACK');
      return sendError(res, 400, 'اسم الأصل مطلوب');
    }

    const acqCost = Number(acquisition_cost) || 0;
    const addCost = Number(additional_cost) || 0;
    const capCost = acqCost + addCost;
    const salvageVal = Number(salvage_value) || 0;
    const lifeVal = Number(useful_life) || 5.0;

    if (acqCost < 0 || addCost < 0) {
      await client.query('ROLLBACK');
      return sendError(res, 400, 'تكلفة الأصل لا يمكن أن تكون سالبة');
    }
    if (lifeVal <= 0) {
      await client.query('ROLLBACK');
      return sendError(res, 400, 'العمر الإنتاجي للأصل يجب أن يكون أكبر من الصفر');
    }

    const acqDateStr = acquisition_date || new Date().toISOString().slice(0, 10);
    const assetNumber = await ensureUniqueSequenceNumber(
      client, companyId, 'fixed_assets', acqDateStr, proposedNum
    );

    // If accounts not explicitly provided, fallback to category defaults
    let finAssetAcc = asset_account_id || null;
    let finAccDeprAcc = accumulated_depreciation_account_id || null;
    let finDeprExpAcc = depreciation_expense_account_id || null;
    let finGainAcc = gain_account_id || null;
    let finLossAcc = loss_account_id || null;
    let finalDeprMethod = depreciation_method || 'STRAIGHT_LINE';

    if (category_id) {
      const { rows: catRows } = await client.query(
        `SELECT * FROM asset_categories WHERE id = $1 AND company_id = $2`,
        [category_id, companyId]
      );
      if (catRows.length > 0) {
        const cat = catRows[0];
        if (!finAssetAcc) finAssetAcc = cat.asset_account_id;
        if (!finAccDeprAcc) finAccDeprAcc = cat.accumulated_depreciation_account_id;
        if (!finDeprExpAcc) finDeprExpAcc = cat.depreciation_expense_account_id;
        if (!finGainAcc) finGainAcc = cat.gain_account_id;
        if (!finLossAcc) finLossAcc = cat.loss_account_id;
        if (!depreciation_method && cat.default_depreciation_method) finalDeprMethod = cat.default_depreciation_method;
      }
    }

    const assetId = uuidv4();
    const nbv = capCost; // Initial NBV = Capitalized Cost (accumulated_depreciation = 0)

    await client.query(`
      INSERT INTO fixed_assets (
        id, company_id, asset_number, name, name_ar, name_en, category_id, description,
        serial_number, barcode, manufacturer, model,
        acquisition_date, capitalization_date, depreciation_start_date,
        acquisition_cost, additional_cost, capitalized_cost, salvage_value,
        useful_life, useful_life_unit, depreciation_method,
        accumulated_depreciation, net_book_value,
        warehouse_id, department_id, cost_center_id, location_name,
        custodian_id, custodian_name, custody_date,
        supplier_id, purchase_invoice_id, purchase_order_number, invoice_date,
        asset_account_id, accumulated_depreciation_account_id,
        depreciation_expense_account_id, gain_account_id, loss_account_id,
        status, attachments, created_by, updated_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, 0.0, $23,
        $24, $25, $26, $27, $28, $29, $30,
        $31, $32, $33, $34,
        $35, $36, $37, $38, $39,
        'DRAFT', $40, $41, $41
      )
    `, [
      assetId, companyId, assetNumber, name, name_ar || name, name_en || null, category_id || null, description || null,
      serial_number || null, barcode || null, manufacturer || null, model || null,
      acqDateStr, capitalization_date || null, depreciation_start_date || null,
      acqCost, addCost, capCost, salvageVal,
      lifeVal, useful_life_unit || 'YEARS', finalDeprMethod,
      nbv,
      warehouse_id || null, department_id || null, cost_center_id || null, location_name || null,
      custodian_id || null, custodian_name || null, custody_date || null,
      supplier_id || null, purchase_invoice_id || null, purchase_order_number || null, invoice_date || null,
      finAssetAcc, finAccDeprAcc, finDeprExpAcc, finGainAcc, finLossAcc,
      JSON.stringify(attachments || []), req.user?.username || 'system'
    ]);

    // Insert Components if any
    if (components && Array.isArray(components) && components.length > 0) {
      for (const comp of components) {
        if (!comp.name) continue;
        const compId = uuidv4();
        await client.query(`
          INSERT INTO asset_components (
            id, asset_id, name, serial_number, cost, useful_life, depreciation_method, depreciation_start_date
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          compId, assetId, comp.name, comp.serial_number || null, Number(comp.cost) || 0,
          comp.useful_life ? Number(comp.useful_life) : null,
          comp.depreciation_method || null, comp.depreciation_start_date || null
        ]);
      }
    }

    await client.query('COMMIT');

    await logAudit(pool, {
      company_id: companyId,
      user_id: req.user?.id,
      username: req.user?.username || req.user?.email,
      action: 'CREATE_ASSET',
      module: 'fixed_assets',
      details: `إنشاء أصل ثابت جديد رقم ${assetNumber}: ${name}`,
      entity_type: 'fixed_assets',
      entity_id: assetId,
      ip_address: getIp(req)
    });

    res.json({ success: true, id: assetId, asset_number: assetNumber, message: 'تم إنشاء الأصل بنجاح' });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error in POST /fixed-assets:', error);
    sendError(res, 500, error.message);
  } finally {
    client.release();
  }
});

// ==========================================
// 6. Update Asset
// ==========================================
fixedAssetsRouter.put(['/fixed-assets/:id', '/fixed_assets/:id'], authenticateToken, async (req: AuthRequest, res: any) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const companyId = getAuthenticatedCompanyId(req);
    if (!companyId) {
      await client.query('ROLLBACK');
      return sendError(res, 401, 'Unauthorized');
    }
    const { id } = req.params;

    const { rows: curRows } = await client.query(
      `SELECT * FROM fixed_assets WHERE id = $1 AND company_id = $2 FOR UPDATE`,
      [id, companyId]
    );
    if (curRows.length === 0) {
      await client.query('ROLLBACK');
      return sendError(res, 404, 'الأصل غير موجود');
    }

    const current = curRows[0];
    if (['DISPOSED', 'SOLD', 'SCRAPPED'].includes(current.status)) {
      await client.query('ROLLBACK');
      return sendError(res, 400, 'لا يمكن تعديل أصل مستبعد أو مباع');
    }

    const {
      name, name_ar, name_en, category_id, description,
      serial_number, barcode, manufacturer, model,
      acquisition_date, capitalization_date, depreciation_start_date,
      acquisition_cost, additional_cost, salvage_value,
      useful_life, useful_life_unit, depreciation_method,
      warehouse_id, department_id, cost_center_id, location_name,
      custodian_id, custodian_name, custody_date,
      supplier_id, purchase_invoice_id, purchase_order_number, invoice_date,
      asset_account_id, accumulated_depreciation_account_id,
      depreciation_expense_account_id, gain_account_id, loss_account_id,
      attachments, components
    } = req.body;

    const acqCost = acquisition_cost !== undefined ? Number(acquisition_cost) : Number(current.acquisition_cost);
    const addCost = additional_cost !== undefined ? Number(additional_cost) : Number(current.additional_cost);
    const capCost = acqCost + addCost;
    const accDepr = Number(current.accumulated_depreciation) || 0;
    const nbv = Math.max(0, capCost - accDepr);

    await client.query(`
      UPDATE fixed_assets SET
        name = COALESCE($1, name),
        name_ar = COALESCE($2, name_ar),
        name_en = $3,
        category_id = $4,
        description = $5,
        serial_number = $6,
        barcode = $7,
        manufacturer = $8,
        model = $9,
        acquisition_date = COALESCE($10, acquisition_date),
        capitalization_date = $11,
        depreciation_start_date = $12,
        acquisition_cost = $13,
        additional_cost = $14,
        capitalized_cost = $15,
        salvage_value = $16,
        useful_life = $17,
        useful_life_unit = $18,
        depreciation_method = $19,
        net_book_value = $20,
        warehouse_id = $21,
        department_id = $22,
        cost_center_id = $23,
        location_name = $24,
        custodian_id = $25,
        custodian_name = $26,
        custody_date = $27,
        supplier_id = $28,
        purchase_invoice_id = $29,
        purchase_order_number = $30,
        invoice_date = $31,
        asset_account_id = $32,
        accumulated_depreciation_account_id = $33,
        depreciation_expense_account_id = $34,
        gain_account_id = $35,
        loss_account_id = $36,
        attachments = COALESCE($37, attachments),
        updated_by = $38,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $39 AND company_id = $40
    `, [
      name, name_ar || name, name_en || null, category_id || null, description || null,
      serial_number || null, barcode || null, manufacturer || null, model || null,
      acquisition_date || null, capitalization_date || null, depreciation_start_date || null,
      acqCost, addCost, capCost, Number(salvage_value) || 0,
      Number(useful_life) || current.useful_life, useful_life_unit || current.useful_life_unit,
      depreciation_method || current.depreciation_method, nbv,
      warehouse_id || null, department_id || null, cost_center_id || null, location_name || null,
      custodian_id || null, custodian_name || null, custody_date || null,
      supplier_id || null, purchase_invoice_id || null, purchase_order_number || null, invoice_date || null,
      asset_account_id || null, accumulated_depreciation_account_id || null,
      depreciation_expense_account_id || null, gain_account_id || null, loss_account_id || null,
      attachments ? JSON.stringify(attachments) : null,
      req.user?.username || 'system', id, companyId
    ]);

    // Update components if supplied
    if (components && Array.isArray(components)) {
      await client.query(`DELETE FROM asset_components WHERE asset_id = $1`, [id]);
      for (const comp of components) {
        if (!comp.name) continue;
        const compId = uuidv4();
        await client.query(`
          INSERT INTO asset_components (
            id, asset_id, name, serial_number, cost, useful_life, depreciation_method, depreciation_start_date
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          compId, id, comp.name, comp.serial_number || null, Number(comp.cost) || 0,
          comp.useful_life ? Number(comp.useful_life) : null,
          comp.depreciation_method || null, comp.depreciation_start_date || null
        ]);
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'تم تحديث بيانات الأصل بنجاح' });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error in PUT /fixed-assets/:id:', error);
    sendError(res, 500, error.message);
  } finally {
    client.release();
  }
});

// ==========================================
// 7. Delete Asset (DRAFT ONLY)
// ==========================================
fixedAssetsRouter.delete(['/fixed-assets/:id', '/fixed_assets/:id'], authenticateToken, async (req: AuthRequest, res: any) => {
  try {
    const companyId = getAuthenticatedCompanyId(req);
    if (!companyId) return sendError(res, 401, 'Unauthorized');
    const { id } = req.params;

    const { rows } = await pool.query(`SELECT status, asset_number FROM fixed_assets WHERE id = $1 AND company_id = $2`, [id, companyId]);
    if (rows.length === 0) return sendError(res, 404, 'الأصل غير موجود');
    if (rows[0].status !== 'DRAFT') {
      return sendError(res, 400, 'لا يمكن حذف أصل تم اعتماده أو رسملته. يمكنك استبعاده أو إلغاء تفعيله.');
    }

    await pool.query(`DELETE FROM asset_components WHERE asset_id = $1`, [id]);
    await pool.query(`DELETE FROM fixed_assets WHERE id = $1 AND company_id = $2`, [id, companyId]);

    res.json({ success: true, message: 'تم حذف مسودة الأصل بنجاح' });
  } catch (error: any) {
    console.error('Error in DELETE /fixed-assets/:id:', error);
    sendError(res, 500, error.message);
  }
});

// ==========================================
// 8. Capitalize Asset (DRAFT -> ACTIVE) & Journal Entry
// ==========================================
fixedAssetsRouter.post(['/fixed-assets/:id/capitalize', '/fixed_assets/:id/capitalize'], authenticateToken, async (req: AuthRequest, res: any) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const companyId = getAuthenticatedCompanyId(req);
    if (!companyId) {
      await client.query('ROLLBACK');
      return sendError(res, 401, 'Unauthorized');
    }
    const { id } = req.params;
    const { capitalization_date, depreciation_start_date, credit_account_id, notes } = req.body;

    const { rows: assetRows } = await client.query(
      `SELECT fa.*, ac.asset_account_id AS cat_asset_account, ac.accumulated_depreciation_account_id AS cat_acc_account
       FROM fixed_assets fa
       LEFT JOIN asset_categories ac ON ac.id = fa.category_id
       WHERE fa.id = $1 AND fa.company_id = $2 FOR UPDATE OF fa`,
      [id, companyId]
    );

    if (assetRows.length === 0) {
      await client.query('ROLLBACK');
      return sendError(res, 404, 'الأصل غير موجود');
    }

    const asset = assetRows[0];
    if (['ACTIVE', 'FULLY_DEPRECIATED'].includes(asset.status)) {
      await client.query('ROLLBACK');
      return sendError(res, 400, 'الأصل معتمد ومرسمل بالفعل');
    }

    const capDate = capitalization_date || new Date().toISOString().slice(0, 10);
    const deprStart = depreciation_start_date || capDate;
    const capCost = Number(asset.capitalized_cost) || (Number(asset.acquisition_cost) + Number(asset.additional_cost));

    let jeId: string | null = null;

    // Check if linked purchase invoice already generated a posted journal entry to avoid duplicate accounting
    let alreadyPostedInPurchase = false;
    if (asset.purchase_invoice_id) {
      const { rows: piJeRows } = await client.query(`
        SELECT id FROM journal_entries 
        WHERE company_id = $1 AND reference_id = $2 AND status = 'posted'
        LIMIT 1
      `, [companyId, asset.purchase_invoice_id]);
      if (piJeRows.length > 0) {
        alreadyPostedInPurchase = true;
        jeId = piJeRows[0].id;
      }
    }

    // If not posted via purchase invoice, and we have accounts, generate capitalization journal entry
    const assetAccId = asset.asset_account_id || asset.cat_asset_account;
    if (!alreadyPostedInPurchase && capCost > 0 && assetAccId && credit_account_id) {
      const { rows: accRows } = await client.query(
        `SELECT id, name FROM accounts WHERE id IN ($1, $2) AND company_id = $3`,
        [assetAccId, credit_account_id, companyId]
      );
      const assetAcc = accRows.find((a: any) => a.id === assetAccId);
      const credAcc = accRows.find((a: any) => a.id === credit_account_id);

      if (assetAcc && credAcc) {
        jeId = await createAssetJournalEntry(client, companyId, {
          date: capDate,
          description: `قيد رسملة أصل ثابت رقم ${asset.asset_number} - ${asset.name} (تكلفة: ${capCost})`,
          reference_id: asset.id,
          reference_type: 'fixed_asset_capitalization',
          reference_number: asset.asset_number,
          total_debit: capCost,
          total_credit: capCost,
          created_by: req.user?.username || 'system',
          items: [
            {
              account_id: assetAcc.id,
              account_name: assetAcc.name,
              debit: capCost,
              credit: 0,
              description: `رسملة أصل ثابت ${asset.asset_number} - ${asset.name}`,
              department_id: asset.department_id || null,
              cost_center_id: asset.cost_center_id || null
            },
            {
              account_id: credAcc.id,
              account_name: credAcc.name,
              debit: 0,
              credit: capCost,
              description: `مقابل شراء/رسملة أصل ${asset.asset_number} - ${asset.name}`,
              supplier_id: asset.supplier_id || null
            }
          ]
        });
      }
    }

    await client.query(`
      UPDATE fixed_assets SET
        status = 'ACTIVE',
        capitalization_date = $1,
        depreciation_start_date = $2,
        capitalization_journal_entry_id = COALESCE($3, capitalization_journal_entry_id),
        updated_by = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5 AND company_id = $6
    `, [capDate, deprStart, jeId, req.user?.username || 'system', id, companyId]);

    await client.query('COMMIT');

    await logAudit(pool, {
      company_id: companyId,
      user_id: req.user?.id,
      username: req.user?.username || req.user?.email,
      action: 'CAPITALIZE_ASSET',
      module: 'fixed_assets',
      details: `رسملة واعتماد الأصل ${asset.asset_number} بنجاح بتكلفة ${capCost}`,
      entity_type: 'fixed_assets',
      entity_id: asset.id,
      ip_address: getIp(req)
    });

    res.json({
      success: true,
      journal_entry_id: jeId,
      message: `تم اعتماد ورسملة الأصل (${asset.name}) بنجاح وبدء دورة الإهلاك.`
    });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error in POST /fixed-assets/:id/capitalize:', error);
    sendError(res, 500, error.message);
  } finally {
    client.release();
  }
});

// ==========================================
// 9. Centralized Depreciation Run Engine
// ==========================================
function calculatePeriodDepreciation(asset: any, toDate: string): number {
  const capCost = Number(asset.capitalized_cost) || 0;
  const salvage = Number(asset.salvage_value) || 0;
  const accDepr = Number(asset.accumulated_depreciation) || 0;
  const currentNbv = Number(asset.net_book_value) || (capCost - accDepr);

  if (currentNbv <= salvage) return 0;

  const usefulLife = Number(asset.useful_life) || 5;
  const isMonths = asset.useful_life_unit === 'MONTHS';
  const totalMonths = isMonths ? usefulLife : usefulLife * 12;

  if (totalMonths <= 0) return 0;

  let periodDepr = 0;
  const method = asset.depreciation_method || 'STRAIGHT_LINE';

  if (method === 'STRAIGHT_LINE') {
    const depreciableBase = Math.max(0, capCost - salvage);
    periodDepr = Number((depreciableBase / totalMonths).toFixed(2));
  } else if (method === 'DECLINING_BALANCE') {
    const rate = 1 / usefulLife * 1.5;
    periodDepr = Number((currentNbv * (rate / 12)).toFixed(2));
  } else if (method === 'DOUBLE_DECLINING') {
    const rate = 1 / usefulLife * 2.0;
    periodDepr = Number((currentNbv * (rate / 12)).toFixed(2));
  } else {
    // Default fallback to straight line
    const depreciableBase = Math.max(0, capCost - salvage);
    periodDepr = Number((depreciableBase / totalMonths).toFixed(2));
  }

  // Cap at salvage value cutoff
  if (currentNbv - periodDepr < salvage) {
    periodDepr = Number((currentNbv - salvage).toFixed(2));
  }

  return Math.max(0, periodDepr);
}

fixedAssetsRouter.post(['/fixed-assets/depreciation/preview', '/fixed_assets/depreciation/preview'], authenticateToken, async (req: AuthRequest, res: any) => {
  try {
    const companyId = getAuthenticatedCompanyId(req);
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    const { from_date, to_date, period_name } = req.body;
    if (!to_date) return sendError(res, 400, 'تاريخ نهاية الفترة مطلوب');

    const { rows: eligibleAssets } = await pool.query(`
      SELECT 
        fa.*,
        ac.name AS category_name,
        COALESCE(fa.depreciation_expense_account_id, ac.depreciation_expense_account_id) AS exp_account_id,
        COALESCE(fa.accumulated_depreciation_account_id, ac.accumulated_depreciation_account_id) AS acc_account_id
      FROM fixed_assets fa
      LEFT JOIN asset_categories ac ON ac.id = fa.category_id
      WHERE fa.company_id = $1 
        AND fa.status = 'ACTIVE'
        AND fa.depreciation_start_date <= $2
        AND fa.net_book_value > fa.salvage_value
        AND (fa.last_depreciation_date IS NULL OR fa.last_depreciation_date < $2)
      ORDER BY fa.asset_number ASC
    `, [companyId, to_date]);

    let totalDepr = 0;
    const items = eligibleAssets.map((asset: any) => {
      const deprAmount = calculatePeriodDepreciation(asset, to_date);
      const openNbv = Number(asset.net_book_value);
      const accDepr = Number(asset.accumulated_depreciation) + deprAmount;
      const closeNbv = Math.max(Number(asset.salvage_value), openNbv - deprAmount);

      totalDepr += deprAmount;

      return {
        asset_id: asset.id,
        asset_number: asset.asset_number,
        asset_name: asset.name,
        category_name: asset.category_name || 'غير مصنف',
        opening_nbv: openNbv,
        depreciation_amount: deprAmount,
        accumulated_depreciation: accDepr,
        closing_nbv: closeNbv
      };
    }).filter((i: any) => i.depreciation_amount > 0);

    totalDepr = Number(totalDepr.toFixed(2));

    res.json({
      count: items.length,
      total_depreciation: totalDepr,
      items
    });
  } catch (error: any) {
    console.error('Error in POST /fixed-assets/depreciation/preview:', error);
    sendError(res, 500, error.message);
  }
});

fixedAssetsRouter.post(['/fixed-assets/depreciation/run', '/fixed_assets/depreciation/run'], authenticateToken, async (req: AuthRequest, res: any) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const companyId = getAuthenticatedCompanyId(req);
    if (!companyId) {
      await client.query('ROLLBACK');
      return sendError(res, 401, 'Unauthorized');
    }

    const { from_date, to_date, period_name, notes } = req.body;
    if (!to_date || !from_date || !period_name) {
      await client.query('ROLLBACK');
      return sendError(res, 400, 'فترة الإهلاك والتواريخ مطلوبة');
    }

    // Check duplicate run for same period
    const { rows: dupRun } = await client.query(`
      SELECT id FROM asset_depreciation_runs 
      WHERE company_id = $1 AND period_name = $2 AND status = 'POSTED'
    `, [companyId, period_name]);
    if (dupRun.length > 0) {
      await client.query('ROLLBACK');
      return sendError(res, 400, `تم تشغيل وترحيل إهلاك الفترة (${period_name}) مسبقاً.`);
    }

    const { rows: eligibleAssets } = await client.query(`
      SELECT 
        fa.*,
        ac.name AS category_name,
        COALESCE(fa.depreciation_expense_account_id, ac.depreciation_expense_account_id) AS exp_account_id,
        COALESCE(fa.accumulated_depreciation_account_id, ac.accumulated_depreciation_account_id) AS acc_account_id
      FROM fixed_assets fa
      LEFT JOIN asset_categories ac ON ac.id = fa.category_id
      WHERE fa.company_id = $1 
        AND fa.status = 'ACTIVE'
        AND fa.depreciation_start_date <= $2
        AND fa.net_book_value > fa.salvage_value
        AND (fa.last_depreciation_date IS NULL OR fa.last_depreciation_date < $2)
      FOR UPDATE OF fa
    `, [companyId, to_date]);

    if (eligibleAssets.length === 0) {
      await client.query('ROLLBACK');
      return sendError(res, 400, 'لا توجد أصول مستحقة للإهلاك في هذه الفترة.');
    }

    const runId = uuidv4();
    const runNumber = `DEP-${to_date.replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    let totalRunDepr = 0;
    const computedItems: any[] = [];

    // Fallback accounts if not mapped on asset
    const { rows: defAccounts } = await client.query(`
      SELECT id, code, name, account_usage FROM accounts WHERE company_id = $1
    `, [companyId]);

    const defaultExpAcc = defAccounts.find((a: any) => a.account_usage === 'depreciation_expense' || a.code === '6301');
    const defaultAccAcc = defAccounts.find((a: any) => a.account_usage === 'accumulated_depreciation' || a.code?.startsWith('1202'));

    // Process each asset
    for (const asset of eligibleAssets) {
      const deprAmount = calculatePeriodDepreciation(asset, to_date);
      if (deprAmount <= 0) continue;

      const openNbv = Number(asset.net_book_value);
      const newAccDepr = Number((Number(asset.accumulated_depreciation) + deprAmount).toFixed(2));
      const capCost = Number(asset.capitalized_cost);
      const salvage = Number(asset.salvage_value);
      const closeNbv = Math.max(salvage, Number((capCost - newAccDepr).toFixed(2)));

      const isFullyDepr = (closeNbv <= salvage) || (newAccDepr >= (capCost - salvage));
      const newStatus = isFullyDepr ? 'FULLY_DEPRECIATED' : 'ACTIVE';

      totalRunDepr += deprAmount;

      // Update asset record
      await client.query(`
        UPDATE fixed_assets SET
          accumulated_depreciation = $1,
          net_book_value = $2,
          last_depreciation_date = $3,
          status = $4,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
      `, [newAccDepr, closeNbv, to_date, newStatus, asset.id]);

      const itemId = uuidv4();
      await client.query(`
        INSERT INTO asset_depreciation_items (
          id, run_id, asset_id, opening_nbv, depreciation_amount,
          accumulated_depreciation, closing_nbv
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [itemId, runId, asset.id, openNbv, deprAmount, newAccDepr, closeNbv]);

      computedItems.push({
        asset,
        deprAmount,
        expAccId: asset.exp_account_id || defaultExpAcc?.id,
        accAccId: asset.acc_account_id || defaultAccAcc?.id
      });
    }

    totalRunDepr = Number(totalRunDepr.toFixed(2));

    if (computedItems.length === 0 || totalRunDepr <= 0) {
      await client.query('ROLLBACK');
      return sendError(res, 400, 'إجمالي الإهلاك المحسوب يساوي صفر.');
    }

    // Build GL Journal Entry Lines
    // Group Debits by Expense Account & Department/CostCenter
    // Group Credits by Accumulated Depreciation Account
    const debitMap: Record<string, { account_id: string; amount: number; dept_id?: string | null; cc_id?: string | null }> = {};
    const creditMap: Record<string, { account_id: string; amount: number }> = {};

    for (const item of computedItems) {
      const expAccId = item.expAccId || defaultExpAcc?.id;
      const accAccId = item.accAccId || defaultAccAcc?.id;

      if (!expAccId || !accAccId) continue;

      const dKey = `${expAccId}_${item.asset.department_id || ''}_${item.asset.cost_center_id || ''}`;
      if (!debitMap[dKey]) {
        debitMap[dKey] = {
          account_id: expAccId,
          amount: 0,
          dept_id: item.asset.department_id,
          cc_id: item.asset.cost_center_id
        };
      }
      debitMap[dKey].amount = Number((debitMap[dKey].amount + item.deprAmount).toFixed(2));

      if (!creditMap[accAccId]) {
        creditMap[accAccId] = { account_id: accAccId, amount: 0 };
      }
      creditMap[accAccId].amount = Number((creditMap[accAccId].amount + item.deprAmount).toFixed(2));
    }

    const jeLines: any[] = [];
    let sumDebit = 0;
    let sumCredit = 0;

    for (const d of Object.values(debitMap)) {
      const acc = defAccounts.find((a: any) => a.id === d.account_id);
      jeLines.push({
        account_id: d.account_id,
        account_name: acc?.name || 'مصروف إهلاك الأصول الثابتة',
        debit: d.amount,
        credit: 0,
        description: `إهلاك أصول فترة ${period_name}`,
        department_id: d.dept_id || null,
        cost_center_id: d.cc_id || null
      });
      sumDebit += d.amount;
    }

    for (const c of Object.values(creditMap)) {
      const acc = defAccounts.find((a: any) => a.id === c.account_id);
      jeLines.push({
        account_id: c.account_id,
        account_name: acc?.name || 'مجمع إهلاك الأصول الثابتة',
        debit: 0,
        credit: c.amount,
        description: `مجمع إهلاك فترة ${period_name}`
      });
      sumCredit += c.amount;
    }

    sumDebit = Number(sumDebit.toFixed(2));
    sumCredit = Number(sumCredit.toFixed(2));

    // In case of any rounding penny diff, balance perfectly
    if (sumDebit !== sumCredit && jeLines.length > 0) {
      const diff = Number((sumDebit - sumCredit).toFixed(2));
      const lastCredit = jeLines.find(l => l.credit > 0);
      if (lastCredit) {
        lastCredit.credit = Number((lastCredit.credit + diff).toFixed(2));
        sumCredit = sumDebit;
      }
    }

    let jeId: string | null = null;
    if (jeLines.length > 0 && sumDebit > 0) {
      jeId = await createAssetJournalEntry(client, companyId, {
        date: to_date,
        description: `قيد إهلاك الأصول الثابتة الدوري - فترة: ${period_name} (عدد ${computedItems.length} أصل)`,
        reference_id: runId,
        reference_type: 'asset_depreciation_run',
        reference_number: runNumber,
        total_debit: sumDebit,
        total_credit: sumDebit,
        created_by: req.user?.username || 'system',
        items: jeLines
      });
    }

    // Insert Run Header
    await client.query(`
      INSERT INTO asset_depreciation_runs (
        id, company_id, run_number, period_name, from_date, to_date,
        total_assets, total_depreciation, status, journal_entry_id, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'POSTED', $9, $10, $11)
    `, [
      runId, companyId, runNumber, period_name, from_date, to_date,
      computedItems.length, totalRunDepr, jeId, notes || null, req.user?.username || 'system'
    ]);

    await client.query('COMMIT');

    await logAudit(pool, {
      company_id: companyId,
      user_id: req.user?.id,
      username: req.user?.username || req.user?.email,
      action: 'DEPRECIATION_RUN',
      module: 'fixed_assets',
      details: `ترحيل دورة إهلاك (${period_name}) بإجمالي ${totalRunDepr} لعدد ${computedItems.length} أصل`,
      entity_type: 'asset_depreciation_runs',
      entity_id: runId,
      ip_address: getIp(req)
    });

    res.json({
      success: true,
      run_id: runId,
      journal_entry_id: jeId,
      total_depreciation: totalRunDepr,
      count: computedItems.length,
      message: `تم تشغيل وترحيل إهلاك فترة (${period_name}) بنجاح وتوليد القيود المحاسبية.`
    });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error in POST /fixed-assets/depreciation/run:', error);
    sendError(res, 500, error.message);
  } finally {
    client.release();
  }
});

fixedAssetsRouter.get(['/fixed-assets/depreciation/runs', '/fixed_assets/depreciation/runs'], authenticateToken, async (req: AuthRequest, res: any) => {
  try {
    const companyId = getAuthenticatedCompanyId(req);
    if (!companyId) return sendError(res, 401, 'Unauthorized');

    const { rows } = await pool.query(`
      SELECT 
        r.*,
        je.entry_number AS journal_entry_number
      FROM asset_depreciation_runs r
      LEFT JOIN journal_entries je ON je.id = r.journal_entry_id
      WHERE r.company_id = $1
      ORDER BY r.created_at DESC
    `, [companyId]);

    res.json(rows);
  } catch (error: any) {
    console.error('Error in GET /fixed-assets/depreciation/runs:', error);
    sendError(res, 500, error.message);
  }
});

// ==========================================
// 10. Operations: Transfer & Custody
// ==========================================
fixedAssetsRouter.post(['/fixed-assets/:id/transfer', '/fixed_assets/:id/transfer'], authenticateToken, async (req: AuthRequest, res: any) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const companyId = getAuthenticatedCompanyId(req);
    if (!companyId) {
      await client.query('ROLLBACK');
      return sendError(res, 401, 'Unauthorized');
    }
    const { id } = req.params;
    const {
      transfer_date, to_warehouse_id, to_department_id, to_cost_center_id,
      to_custodian_id, to_location, reason, notes
    } = req.body;

    const { rows: assetRows } = await client.query(
      `SELECT * FROM fixed_assets WHERE id = $1 AND company_id = $2 FOR UPDATE`,
      [id, companyId]
    );
    if (assetRows.length === 0) {
      await client.query('ROLLBACK');
      return sendError(res, 404, 'الأصل غير موجود');
    }
    const asset = assetRows[0];

    // Fetch custodian name if ID provided
    let newCustName = null;
    if (to_custodian_id) {
      const { rows: empRows } = await client.query(`SELECT name FROM employees WHERE id = $1`, [to_custodian_id]);
      newCustName = empRows[0]?.name || null;
    }

    const transferId = uuidv4();
    const tDate = transfer_date || new Date().toISOString().slice(0, 10);

    await client.query(`
      INSERT INTO asset_transfers (
        id, company_id, asset_id, transfer_date,
        from_warehouse_id, to_warehouse_id,
        from_department_id, to_department_id,
        from_cost_center_id, to_cost_center_id,
        from_custodian_id, to_custodian_id,
        from_location, to_location, reason, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    `, [
      transferId, companyId, id, tDate,
      asset.warehouse_id, to_warehouse_id || asset.warehouse_id,
      asset.department_id, to_department_id || asset.department_id,
      asset.cost_center_id, to_cost_center_id || asset.cost_center_id,
      asset.custodian_id, to_custodian_id || asset.custodian_id,
      asset.location_name, to_location || asset.location_name,
      reason || null, notes || null, req.user?.username || 'system'
    ]);

    await client.query(`
      UPDATE fixed_assets SET
        warehouse_id = COALESCE($1, warehouse_id),
        department_id = COALESCE($2, department_id),
        cost_center_id = COALESCE($3, cost_center_id),
        custodian_id = COALESCE($4, custodian_id),
        custodian_name = COALESCE($5, custodian_name),
        location_name = COALESCE($6, location_name),
        custody_date = $7,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
    `, [
      to_warehouse_id || null, to_department_id || null, to_cost_center_id || null,
      to_custodian_id || null, newCustName, to_location || null, tDate, id
    ]);

    await client.query('COMMIT');

    await logAudit(pool, {
      company_id: companyId,
      user_id: req.user?.id,
      username: req.user?.username || req.user?.email,
      action: 'TRANSFER_ASSET',
      module: 'fixed_assets',
      details: `نقل الأصل ${asset.asset_number}: من ${asset.location_name || 'موقع سابق'} إلى ${to_location || 'موقع جديد'}`,
      entity_type: 'asset_transfers',
      entity_id: transferId,
      ip_address: getIp(req)
    });

    res.json({ success: true, transfer_id: transferId, message: 'تم تسجيل حركة النقل وتحديث العهدة بنجاح' });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error in POST /fixed-assets/:id/transfer:', error);
    sendError(res, 500, error.message);
  } finally {
    client.release();
  }
});

// ==========================================
// 11. Operations: Maintenance
// ==========================================
fixedAssetsRouter.post(['/fixed-assets/:id/maintenance', '/fixed_assets/:id/maintenance'], authenticateToken, async (req: AuthRequest, res: any) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const companyId = getAuthenticatedCompanyId(req);
    if (!companyId) {
      await client.query('ROLLBACK');
      return sendError(res, 401, 'Unauthorized');
    }
    const { id } = req.params;
    const {
      maintenance_date, maintenance_type, supplier_id, cost,
      description, invoice_number, next_maintenance_date, is_capitalized, credit_account_id
    } = req.body;

    const { rows: assetRows } = await client.query(
      `SELECT fa.*, ac.asset_account_id AS cat_asset_acc
       FROM fixed_assets fa
       LEFT JOIN asset_categories ac ON ac.id = fa.category_id
       WHERE fa.id = $1 AND fa.company_id = $2 FOR UPDATE OF fa`,
      [id, companyId]
    );
    if (assetRows.length === 0) {
      await client.query('ROLLBACK');
      return sendError(res, 404, 'الأصل غير موجود');
    }
    const asset = assetRows[0];
    const maintCost = Number(cost) || 0;
    const mDate = maintenance_date || new Date().toISOString().slice(0, 10);
    const maintId = uuidv4();
    let jeId: string | null = null;

    if (is_capitalized && maintCost > 0) {
      // Capitalized maintenance increases asset capitalized cost and net book value
      const newCapCost = Number((Number(asset.capitalized_cost) + maintCost).toFixed(2));
      const newNbv = Number((Number(asset.net_book_value) + maintCost).toFixed(2));

      await client.query(`
        UPDATE fixed_assets SET
          capitalized_cost = $1,
          net_book_value = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [newCapCost, newNbv, id]);

      // Optional JE
      const assetAccId = asset.asset_account_id || asset.cat_asset_acc;
      if (assetAccId && credit_account_id) {
        const { rows: accRows } = await client.query(
          `SELECT id, name FROM accounts WHERE id IN ($1, $2)`, [assetAccId, credit_account_id]
        );
        const aAcc = accRows.find((a: any) => a.id === assetAccId);
        const cAcc = accRows.find((a: any) => a.id === credit_account_id);

        if (aAcc && cAcc) {
          jeId = await createAssetJournalEntry(client, companyId, {
            date: mDate,
            description: `صيانة مرسملة لأصل ${asset.asset_number} - ${asset.name} (تكلفة: ${maintCost})`,
            reference_id: maintId,
            reference_type: 'asset_maintenance',
            reference_number: invoice_number || asset.asset_number,
            total_debit: maintCost,
            total_credit: maintCost,
            created_by: req.user?.username || 'system',
            items: [
              { account_id: aAcc.id, account_name: aAcc.name, debit: maintCost, credit: 0, description: `رسملة صيانة ${asset.name}` },
              { account_id: cAcc.id, account_name: cAcc.name, debit: 0, credit: maintCost, description: `سداد صيانة ${asset.name}`, supplier_id: supplier_id || null }
            ]
          });
        }
      }
    }

    await client.query(`
      INSERT INTO asset_maintenance (
        id, company_id, asset_id, maintenance_date, maintenance_type,
        supplier_id, cost, description, invoice_number, next_maintenance_date,
        is_capitalized, journal_entry_id, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      maintId, companyId, id, mDate, maintenance_type || 'دورية',
      supplier_id || null, maintCost, description || null, invoice_number || null,
      next_maintenance_date || null, !!is_capitalized, jeId, req.user?.username || 'system'
    ]);

    await client.query('COMMIT');

    await logAudit(pool, {
      company_id: companyId,
      user_id: req.user?.id,
      username: req.user?.username || req.user?.email,
      action: 'MAINTAIN_ASSET',
      module: 'fixed_assets',
      details: `تسجيل صيانة للأصل ${asset.asset_number}: ${maintenance_type} بتكلفة ${maintCost} (${is_capitalized ? 'مرسملة' : 'تشغيلية'})`,
      entity_type: 'asset_maintenance',
      entity_id: maintId,
      ip_address: getIp(req)
    });

    res.json({
      success: true,
      maintenance_id: maintId,
      journal_entry_id: jeId,
      message: 'تم تسجيل عملية الصيانة وتحديث الأصل بنجاح'
    });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error in POST /fixed-assets/:id/maintenance:', error);
    sendError(res, 500, error.message);
  } finally {
    client.release();
  }
});

// ==========================================
// 12. Operations: Revaluation
// ==========================================
fixedAssetsRouter.post(['/fixed-assets/:id/revalue', '/fixed_assets/:id/revalue'], authenticateToken, async (req: AuthRequest, res: any) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const companyId = getAuthenticatedCompanyId(req);
    if (!companyId) {
      await client.query('ROLLBACK');
      return sendError(res, 401, 'Unauthorized');
    }
    const { id } = req.params;
    const { revaluation_date, new_value, reason } = req.body;

    const { rows: assetRows } = await client.query(
      `SELECT * FROM fixed_assets WHERE id = $1 AND company_id = $2 FOR UPDATE`,
      [id, companyId]
    );
    if (assetRows.length === 0) {
      await client.query('ROLLBACK');
      return sendError(res, 404, 'الأصل غير موجود');
    }
    const asset = assetRows[0];
    const oldVal = Number(asset.net_book_value);
    const newVal = Number(new_value);
    if (isNaN(newVal) || newVal < 0) {
      await client.query('ROLLBACK');
      return sendError(res, 400, 'يرجى إدخال قيمة تقييم جديدة صحيحة');
    }

    const diff = Number((newVal - oldVal).toFixed(2));
    const revalDate = revaluation_date || new Date().toISOString().slice(0, 10);
    const revalId = uuidv4();

    // Update asset NBV
    const newCapCost = Number((newVal + Number(asset.accumulated_depreciation)).toFixed(2));
    await client.query(`
      UPDATE fixed_assets SET
        capitalized_cost = $1,
        net_book_value = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [newCapCost, newVal, id]);

    await client.query(`
      INSERT INTO asset_revaluations (
        id, company_id, asset_id, revaluation_date, old_value, new_value,
        difference, reason, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'APPROVED', $9)
    `, [
      revalId, companyId, id, revalDate, oldVal, newVal, diff, reason || null, req.user?.username || 'system'
    ]);

    await client.query('COMMIT');

    await logAudit(pool, {
      company_id: companyId,
      user_id: req.user?.id,
      username: req.user?.username || req.user?.email,
      action: 'REVALUE_ASSET',
      module: 'fixed_assets',
      details: `إعادة تقييم الأصل ${asset.asset_number}: من ${oldVal} إلى ${newVal} (فارق: ${diff})`,
      entity_type: 'asset_revaluations',
      entity_id: revalId,
      ip_address: getIp(req)
    });

    res.json({ success: true, revaluation_id: revalId, difference: diff, message: 'تمت إعادة تقييم الأصل بنجاح' });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error in POST /fixed-assets/:id/revalue:', error);
    sendError(res, 500, error.message);
  } finally {
    client.release();
  }
});

// ==========================================
// 13. Operations: Disposal & Sale
// ==========================================
fixedAssetsRouter.post(['/fixed-assets/:id/dispose', '/fixed_assets/:id/dispose'], authenticateToken, async (req: AuthRequest, res: any) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const companyId = getAuthenticatedCompanyId(req);
    if (!companyId) {
      await client.query('ROLLBACK');
      return sendError(res, 401, 'Unauthorized');
    }
    const { id } = req.params;
    const {
      disposal_date, disposal_type, disposal_proceeds,
      buyer_name, customer_id, payment_account_id, invoice_number, notes
    } = req.body;

    const { rows: assetRows } = await client.query(`
      SELECT 
        fa.*,
        ac.asset_account_id AS cat_asset_acc,
        ac.accumulated_depreciation_account_id AS cat_acc_acc,
        ac.gain_account_id AS cat_gain_acc,
        ac.loss_account_id AS cat_loss_acc
      FROM fixed_assets fa
      LEFT JOIN asset_categories ac ON ac.id = fa.category_id
      WHERE fa.id = $1 AND fa.company_id = $2 FOR UPDATE OF fa
    `, [id, companyId]);

    if (assetRows.length === 0) {
      await client.query('ROLLBACK');
      return sendError(res, 404, 'الأصل غير موجود');
    }
    const asset = assetRows[0];
    if (['DISPOSED', 'SOLD', 'SCRAPPED'].includes(asset.status)) {
      await client.query('ROLLBACK');
      return sendError(res, 400, 'هذا الأصل تم استبعاده مسبقاً.');
    }

    const dDate = disposal_date || new Date().toISOString().slice(0, 10);
    const origCost = Number(asset.capitalized_cost) || 0;
    const accDepr = Number(asset.accumulated_depreciation) || 0;
    const nbv = Number(asset.net_book_value) || Math.max(0, origCost - accDepr);
    const proceeds = Number(disposal_proceeds) || 0;
    const gainLoss = Number((proceeds - nbv).toFixed(2));

    const dispType = (disposal_type || 'SALE').toUpperCase();
    const newStatus = dispType === 'SALE' ? 'SOLD' : dispType === 'SCRAP' ? 'SCRAPPED' : 'DISPOSED';

    const dispId = uuidv4();

    // Accounts resolution for General Ledger entry
    const { rows: allAccs } = await client.query(`SELECT id, code, name, account_usage FROM accounts WHERE company_id = $1`, [companyId]);

    const assetAccId = asset.asset_account_id || asset.cat_asset_acc || allAccs.find((a: any) => a.code?.startsWith('1201'))?.id;
    const accDeprAccId = asset.accumulated_depreciation_account_id || asset.cat_acc_acc || allAccs.find((a: any) => a.code?.startsWith('1202'))?.id;
    const gainAccId = asset.gain_account_id || asset.cat_gain_acc || allAccs.find((a: any) => a.name?.includes('أرباح بيع أصول') || a.name?.includes('أرباح رأسمالية') || a.code?.startsWith('4'))?.id;
    const lossAccId = asset.loss_account_id || asset.cat_loss_acc || allAccs.find((a: any) => a.name?.includes('خسائر بيع أصول') || a.name?.includes('خسائر رأسمالية') || a.code?.startsWith('6'))?.id;

    let jeId: string | null = null;

    if (origCost > 0 && assetAccId && accDeprAccId) {
      const jeItems: any[] = [];
      const assetAcc = allAccs.find((a: any) => a.id === assetAccId);
      const accDeprAcc = allAccs.find((a: any) => a.id === accDeprAccId);

      // 1. Dr Accumulated Depreciation
      if (accDepr > 0) {
        jeItems.push({
          account_id: accDeprAccId,
          account_name: accDeprAcc?.name || 'مجمع إهلاك الأصول',
          debit: accDepr,
          credit: 0,
          description: `إقفال مجمع إهلاك أصل ${asset.asset_number} - ${asset.name}`
        });
      }

      // 2. Dr Cash / Bank / Customer (if sold with proceeds)
      if (proceeds > 0) {
        let cashAccId = payment_account_id;
        if (!cashAccId) {
          cashAccId = allAccs.find((a: any) => a.account_usage === 'cash' || a.account_usage === 'bank' || a.code?.startsWith('11'))?.id;
        }
        const cashAcc = allAccs.find((a: any) => a.id === cashAccId);
        jeItems.push({
          account_id: cashAccId || assetAccId,
          account_name: cashAcc?.name || 'النقدية / البنك',
          debit: proceeds,
          credit: 0,
          description: `متحصلات بيع أصل ${asset.asset_number} - ${asset.name}`,
          customer_id: customer_id || null
        });
      }

      // 3. Dr Loss on disposal (if negative)
      if (gainLoss < 0) {
        const lossAmount = Math.abs(gainLoss);
        const lAcc = allAccs.find((a: any) => a.id === lossAccId);
        jeItems.push({
          account_id: lossAccId || assetAccId,
          account_name: lAcc?.name || 'خسائر استبعاد/بيع أصول ثابتة',
          debit: lossAmount,
          credit: 0,
          description: `خسارة بيع أصل ${asset.asset_number}`
        });
      }

      // 4. Cr Fixed Asset historical cost
      jeItems.push({
        account_id: assetAccId,
        account_name: assetAcc?.name || 'الأصول الثابتة',
        debit: 0,
        credit: origCost,
        description: `إلغاء تكلفة الأصل المستبعد ${asset.asset_number} - ${asset.name}`
      });

      // 5. Cr Gain on disposal (if positive)
      if (gainLoss > 0) {
        const gAcc = allAccs.find((a: any) => a.id === gainAccId);
        jeItems.push({
          account_id: gainAccId || assetAccId,
          account_name: gAcc?.name || 'أرباح بيع أصول ثابتة',
          debit: 0,
          credit: gainLoss,
          description: `أرباح بيع أصل ${asset.asset_number}`
        });
      }

      // Calculate total debit and total credit
      const totalDeb = Number(jeItems.reduce((acc, i) => acc + (i.debit || 0), 0).toFixed(2));
      const totalCred = Number(jeItems.reduce((acc, i) => acc + (i.credit || 0), 0).toFixed(2));

      // Balance validation check
      if (Math.abs(totalDeb - totalCred) <= 0.05 && totalDeb > 0) {
        jeId = await createAssetJournalEntry(client, companyId, {
          date: dDate,
          description: `قيد استبعاد/بيع أصل ثابت رقم ${asset.asset_number} - ${asset.name} (${dispType}) - أرباح/خسائر: ${gainLoss}`,
          reference_id: dispId,
          reference_type: 'asset_disposal',
          reference_number: invoice_number || asset.asset_number,
          total_debit: totalDeb,
          total_credit: totalCred,
          created_by: req.user?.username || 'system',
          items: jeItems
        });
      }
    }

    // Insert disposal record
    await client.query(`
      INSERT INTO asset_disposals (
        id, company_id, asset_id, disposal_date, disposal_type,
        original_cost, accumulated_depreciation, net_book_value,
        disposal_proceeds, gain_loss_amount, buyer_name, customer_id,
        payment_account_id, invoice_number, journal_entry_id, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    `, [
      dispId, companyId, id, dDate, dispType,
      origCost, accDepr, nbv, proceeds, gainLoss,
      buyer_name || null, customer_id || null, payment_account_id || null,
      invoice_number || null, jeId, notes || null, req.user?.username || 'system'
    ]);

    // Update asset status and zero NBV
    await client.query(`
      UPDATE fixed_assets SET
        status = $1,
        net_book_value = 0.0,
        disposal_journal_entry_id = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [newStatus, jeId, id]);

    await client.query('COMMIT');

    await logAudit(pool, {
      company_id: companyId,
      user_id: req.user?.id,
      username: req.user?.username || req.user?.email,
      action: 'DISPOSE_ASSET',
      module: 'fixed_assets',
      details: `استبعاد/بيع الأصل ${asset.asset_number}: سعر البيع ${proceeds}، أرباح/خسائر: ${gainLoss}`,
      entity_type: 'asset_disposals',
      entity_id: dispId,
      ip_address: getIp(req)
    });

    res.json({
      success: true,
      disposal_id: dispId,
      gain_loss_amount: gainLoss,
      journal_entry_id: jeId,
      message: `تم استبعاد/بيع الأصل بنجاح (${gainLoss >= 0 ? `أرباح: +${gainLoss}` : `خسائر: ${gainLoss}`}) وتوليد القيد المحاسبي.`
    });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error in POST /fixed-assets/:id/dispose:', error);
    sendError(res, 500, error.message);
  } finally {
    client.release();
  }
});

// ==========================================
// 14. Depreciation Schedule (Amortization Table)
// ==========================================
fixedAssetsRouter.get(['/fixed-assets/:id/schedule', '/fixed_assets/:id/schedule'], authenticateToken, async (req: AuthRequest, res: any) => {
  try {
    const companyId = getAuthenticatedCompanyId(req);
    if (!companyId) return sendError(res, 401, 'Unauthorized');
    const { id } = req.params;

    const { rows: assetRows } = await pool.query(
      `SELECT * FROM fixed_assets WHERE id = $1 AND company_id = $2`,
      [id, companyId]
    );
    if (assetRows.length === 0) return sendError(res, 404, 'الأصل غير موجود');
    const asset = assetRows[0];

    const capCost = Number(asset.capitalized_cost) || (Number(asset.acquisition_cost) + Number(asset.additional_cost)) || 0;
    const salvage = Number(asset.salvage_value) || 0;
    const usefulLife = Number(asset.useful_life) || 5;
    const isMonths = asset.useful_life_unit === 'MONTHS';
    const totalMonths = isMonths ? usefulLife : usefulLife * 12;

    const startDateStr = asset.depreciation_start_date || asset.capitalization_date || asset.acquisition_date;
    const startDate = new Date(startDateStr);

    const schedule: any[] = [];
    let curNbv = capCost;
    let accumulated = 0;

    const depreciableBase = Math.max(0, capCost - salvage);
    const monthlyDepr = totalMonths > 0 ? Number((depreciableBase / totalMonths).toFixed(2)) : 0;

    const monthNamesAr = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];

    const currentDate = new Date();

    for (let m = 0; m < totalMonths && curNbv > salvage; m++) {
      const periodDate = new Date(startDate.getFullYear(), startDate.getMonth() + m, 1);
      const periodKey = periodDate.toISOString().slice(0, 7);
      const periodName = `${monthNamesAr[periodDate.getMonth()]} ${periodDate.getFullYear()}`;

      let depr = monthlyDepr;
      if (curNbv - depr < salvage) {
        depr = Number((curNbv - salvage).toFixed(2));
      }

      const openVal = curNbv;
      accumulated = Number((accumulated + depr).toFixed(2));
      curNbv = Math.max(salvage, Number((openVal - depr).toFixed(2)));

      const isPosted = periodDate <= currentDate && asset.last_depreciation_date && periodKey <= asset.last_depreciation_date.slice(0, 7);

      schedule.push({
        period: periodKey,
        period_name: periodName,
        opening_nbv: openVal,
        depreciation: depr,
        accumulated_depreciation: accumulated,
        closing_nbv: curNbv,
        is_posted: !!isPosted
      });
    }

    res.json(schedule);
  } catch (error: any) {
    console.error('Error in GET /fixed-assets/:id/schedule:', error);
    sendError(res, 500, error.message);
  }
});

// ==========================================
// 15. Asset 360 History & Audit Trail
// ==========================================
fixedAssetsRouter.get(['/fixed-assets/:id/history', '/fixed_assets/:id/history'], authenticateToken, async (req: AuthRequest, res: any) => {
  try {
    const companyId = getAuthenticatedCompanyId(req);
    if (!companyId) return sendError(res, 401, 'Unauthorized');
    const { id } = req.params;

    const { rows: assetRows } = await pool.query(
      `SELECT fa.*, ac.name AS category_name FROM fixed_assets fa LEFT JOIN asset_categories ac ON ac.id = fa.category_id WHERE fa.id = $1 AND fa.company_id = $2`,
      [id, companyId]
    );
    if (assetRows.length === 0) return sendError(res, 404, 'الأصل غير موجود');

    // 1. Transfers
    const { rows: transfers } = await pool.query(`
      SELECT t.*, w_from.name AS from_warehouse_name, w_to.name AS to_warehouse_name,
             d_from.name AS from_department_name, d_to.name AS to_department_name,
             e_from.name AS from_custodian_name, e_to.name AS to_custodian_name
      FROM asset_transfers t
      LEFT JOIN warehouses w_from ON w_from.id = t.from_warehouse_id
      LEFT JOIN warehouses w_to ON w_to.id = t.to_warehouse_id
      LEFT JOIN departments d_from ON d_from.id = t.from_department_id
      LEFT JOIN departments d_to ON d_to.id = t.to_department_id
      LEFT JOIN employees e_from ON e_from.id = t.from_custodian_id
      LEFT JOIN employees e_to ON e_to.id = t.to_custodian_id
      WHERE t.asset_id = $1
      ORDER BY t.transfer_date DESC
    `, [id]);

    // 2. Maintenance
    const { rows: maintenance } = await pool.query(`
      SELECT m.*, s.name AS supplier_name, je.entry_number AS journal_entry_number
      FROM asset_maintenance m
      LEFT JOIN suppliers s ON s.id = m.supplier_id
      LEFT JOIN journal_entries je ON je.id = m.journal_entry_id
      WHERE m.asset_id = $1
      ORDER BY m.maintenance_date DESC
    `, [id]);

    // 3. Revaluations
    const { rows: revaluations } = await pool.query(`
      SELECT r.*, je.entry_number AS journal_entry_number
      FROM asset_revaluations r
      LEFT JOIN journal_entries je ON je.id = r.journal_entry_id
      WHERE r.asset_id = $1
      ORDER BY r.revaluation_date DESC
    `, [id]);

    // 4. Depreciations
    const { rows: depreciations } = await pool.query(`
      SELECT di.*, r.period_name, r.run_number
      FROM asset_depreciation_items di
      JOIN asset_depreciation_runs r ON r.id = di.run_id
      WHERE di.asset_id = $1
      ORDER BY di.created_at DESC
    `, [id]);

    // 5. Disposal
    const { rows: disposalRows } = await pool.query(`
      SELECT d.*, c.name AS customer_name, je.entry_number AS journal_entry_number
      FROM asset_disposals d
      LEFT JOIN customers c ON c.id = d.customer_id
      LEFT JOIN journal_entries je ON je.id = d.journal_entry_id
      WHERE d.asset_id = $1
      LIMIT 1
    `, [id]);

    res.json({
      asset: assetRows[0],
      transfers,
      maintenance,
      revaluations,
      depreciations,
      disposal: disposalRows[0] || null
    });
  } catch (error: any) {
    console.error('Error in GET /fixed-assets/:id/history:', error);
    sendError(res, 500, error.message);
  }
});

// ==========================================
// 16. Comprehensive Reports
// ==========================================
fixedAssetsRouter.get(['/fixed-assets/reports/:reportType', '/fixed_assets/reports/:reportType'], authenticateToken, async (req: AuthRequest, res: any) => {
  try {
    const companyId = getAuthenticatedCompanyId(req);
    if (!companyId) return sendError(res, 401, 'Unauthorized');
    const { reportType } = req.params;

    if (reportType === 'register') {
      const { rows } = await pool.query(`
        SELECT 
          fa.asset_number, fa.name, ac.name AS category_name,
          w.name AS warehouse_name, d.name AS department_name, cc.name AS cost_center_name,
          e.name AS custodian_name, fa.acquisition_date, fa.capitalization_date,
          fa.capitalized_cost, fa.accumulated_depreciation, fa.net_book_value, fa.salvage_value,
          fa.useful_life, fa.depreciation_method, fa.status
        FROM fixed_assets fa
        LEFT JOIN asset_categories ac ON ac.id = fa.category_id
        LEFT JOIN warehouses w ON w.id = fa.warehouse_id
        LEFT JOIN departments d ON d.id = fa.department_id
        LEFT JOIN cost_centers cc ON cc.id = fa.cost_center_id
        LEFT JOIN employees e ON e.id = fa.custodian_id
        WHERE fa.company_id = $1
        ORDER BY fa.asset_number ASC
      `, [companyId]);
      return res.json(rows);
    }

    if (reportType === 'depreciation') {
      const { rows } = await pool.query(`
        SELECT 
          r.run_number, r.period_name, r.from_date, r.to_date,
          fa.asset_number, fa.name AS asset_name, ac.name AS category_name,
          di.opening_nbv, di.depreciation_amount, di.accumulated_depreciation, di.closing_nbv
        FROM asset_depreciation_items di
        JOIN asset_depreciation_runs r ON r.id = di.run_id
        JOIN fixed_assets fa ON fa.id = di.asset_id
        LEFT JOIN asset_categories ac ON ac.id = fa.category_id
        WHERE r.company_id = $1 AND r.status = 'POSTED'
        ORDER BY r.to_date DESC, fa.asset_number ASC
      `, [companyId]);
      return res.json(rows);
    }

    if (reportType === 'movement') {
      const { rows } = await pool.query(`
        SELECT 
          t.transfer_date, fa.asset_number, fa.name AS asset_name,
          w_from.name AS from_warehouse, w_to.name AS to_warehouse,
          d_from.name AS from_department, d_to.name AS to_department,
          e_from.name AS from_custodian, e_to.name AS to_custodian,
          t.reason, t.notes
        FROM asset_transfers t
        JOIN fixed_assets fa ON fa.id = t.asset_id
        LEFT JOIN warehouses w_from ON w_from.id = t.from_warehouse_id
        LEFT JOIN warehouses w_to ON w_to.id = t.to_warehouse_id
        LEFT JOIN departments d_from ON d_from.id = t.from_department_id
        LEFT JOIN departments d_to ON d_to.id = t.to_department_id
        LEFT JOIN employees e_from ON e_from.id = t.from_custodian_id
        LEFT JOIN employees e_to ON e_to.id = t.to_custodian_id
        WHERE t.company_id = $1
        ORDER BY t.transfer_date DESC
      `, [companyId]);
      return res.json(rows);
    }

    if (reportType === 'valuation') {
      const { rows } = await pool.query(`
        SELECT 
          ac.name AS category_name,
          COUNT(fa.id)::int AS asset_count,
          SUM(fa.capitalized_cost)::float AS total_cost,
          SUM(fa.accumulated_depreciation)::float AS total_accumulated_depreciation,
          SUM(fa.net_book_value)::float AS total_net_book_value,
          SUM(fa.salvage_value)::float AS total_salvage_value
        FROM fixed_assets fa
        LEFT JOIN asset_categories ac ON ac.id = fa.category_id
        WHERE fa.company_id = $1 AND fa.status NOT IN ('DISPOSED', 'SOLD', 'SCRAPPED')
        GROUP BY ac.name
        ORDER BY total_cost DESC
      `, [companyId]);
      return res.json(rows);
    }

    if (reportType === 'fully_depreciated') {
      const { rows } = await pool.query(`
        SELECT 
          fa.asset_number, fa.name, ac.name AS category_name,
          fa.acquisition_date, fa.capitalized_cost, fa.accumulated_depreciation,
          fa.salvage_value, fa.net_book_value, fa.last_depreciation_date
        FROM fixed_assets fa
        LEFT JOIN asset_categories ac ON ac.id = fa.category_id
        WHERE fa.company_id = $1 AND fa.status = 'FULLY_DEPRECIATED'
        ORDER BY fa.asset_number ASC
      `, [companyId]);
      return res.json(rows);
    }

    if (reportType === 'disposal') {
      const { rows } = await pool.query(`
        SELECT 
          d.disposal_date, d.disposal_type, fa.asset_number, fa.name AS asset_name,
          d.original_cost, d.accumulated_depreciation, d.net_book_value,
          d.disposal_proceeds, d.gain_loss_amount, d.buyer_name, je.entry_number AS journal_entry_number
        FROM asset_disposals d
        JOIN fixed_assets fa ON fa.id = d.asset_id
        LEFT JOIN journal_entries je ON je.id = d.journal_entry_id
        WHERE d.company_id = $1
        ORDER BY d.disposal_date DESC
      `, [companyId]);
      return res.json(rows);
    }

    if (reportType === 'gain_loss') {
      const { rows } = await pool.query(`
        SELECT 
          d.disposal_date, fa.asset_number, fa.name AS asset_name,
          d.net_book_value, d.disposal_proceeds, d.gain_loss_amount,
          CASE WHEN d.gain_loss_amount >= 0 THEN 'أرباح رأسمالية' ELSE 'خسائر رأسمالية' END AS type
        FROM asset_disposals d
        JOIN fixed_assets fa ON fa.id = d.asset_id
        WHERE d.company_id = $1
        ORDER BY d.disposal_date DESC
      `, [companyId]);
      return res.json(rows);
    }

    if (reportType === 'by_custodian') {
      const { rows } = await pool.query(`
        SELECT 
          COALESCE(e.name, 'بدون عهدة محددة') AS custodian_name,
          e.employee_code,
          COUNT(fa.id)::int AS asset_count,
          SUM(fa.capitalized_cost)::float AS total_cost,
          SUM(fa.net_book_value)::float AS total_nbv
        FROM fixed_assets fa
        LEFT JOIN employees e ON e.id = fa.custodian_id
        WHERE fa.company_id = $1 AND fa.status NOT IN ('DISPOSED', 'SOLD', 'SCRAPPED')
        GROUP BY e.name, e.employee_code
        ORDER BY asset_count DESC
      `, [companyId]);
      return res.json(rows);
    }

    if (reportType === 'by_location') {
      const { rows } = await pool.query(`
        SELECT 
          COALESCE(w.name, 'المركز الرئيسي') AS warehouse_name,
          COALESCE(fa.location_name, 'غير محدد') AS location_name,
          COUNT(fa.id)::int AS asset_count,
          SUM(fa.capitalized_cost)::float AS total_cost,
          SUM(fa.net_book_value)::float AS total_nbv
        FROM fixed_assets fa
        LEFT JOIN warehouses w ON w.id = fa.warehouse_id
        WHERE fa.company_id = $1 AND fa.status NOT IN ('DISPOSED', 'SOLD', 'SCRAPPED')
        GROUP BY w.name, fa.location_name
        ORDER BY asset_count DESC
      `, [companyId]);
      return res.json(rows);
    }

    if (reportType === 'maintenance') {
      const { rows } = await pool.query(`
        SELECT 
          m.maintenance_date, fa.asset_number, fa.name AS asset_name,
          m.maintenance_type, s.name AS supplier_name, m.cost,
          m.is_capitalized, m.invoice_number, m.description
        FROM asset_maintenance m
        JOIN fixed_assets fa ON fa.id = m.asset_id
        LEFT JOIN suppliers s ON s.id = m.supplier_id
        WHERE m.company_id = $1
        ORDER BY m.maintenance_date DESC
      `, [companyId]);
      return res.json(rows);
    }

    return sendError(res, 404, `نوع التقرير غير معروف: ${reportType}`);
  } catch (error: any) {
    console.error('Error in GET /fixed-assets/reports/:reportType:', error);
    sendError(res, 500, error.message);
  }
});
