import { Response, NextFunction } from 'express';
import pool from '../../postgres';
import { AuthRequest } from '../../auth-middleware';

// Map specific modules to broad features
const featureMap: Record<string, string> = {
  // Sales
  'quotations': 'sales',
  'sales_orders': 'sales',
  'invoices': 'sales',
  'returns': 'sales',
  'customer_discounts': 'sales',
  'customer_settlements': 'sales',
  'customer_statement': 'sales',
  'customer_balances': 'sales',
  'sales_report': 'sales',

  // Purchases
  'purchase_orders': 'purchases',
  'purchase_invoices': 'purchases',
  'purchase_returns': 'purchases',
  'supplier_discounts': 'purchases',
  'supplier_settlements': 'purchases',
  'supplier_statement': 'purchases',
  'supplier_balances': 'purchases',

  // Inventory
  'warehouses': 'inventory',
  'goods_receipts': 'inventory',
  'warehouse_transfers': 'inventory',
  'opening_stock_balances': 'inventory',
  'stock_adjustments': 'inventory',

  // Accounting
  'receipts': 'accounting',
  'payment_vouchers': 'accounting',
  'cash_transfers': 'accounting',
  'cash_balances': 'accounting',
  'account_types': 'accounting',
  'accounts': 'accounting',
  'chart_of_accounts': 'accounting',
  'create_journal_entry': 'accounting',
  'journal_entries': 'accounting',
  'detailed_journal_entries': 'accounting',
  'expenses': 'accounting',
  'expenses_report': 'accounting',

  // HR
  'employees': 'hr',
  'salaries': 'hr',
  'attendance': 'hr',
  'departments': 'hr',

  // Manufacturing (Future-proof)
  'manufacturing_orders': 'manufacturing',
  'bom': 'manufacturing',

  // CRM (Future-proof)
  'leads': 'crm',
  'opportunities': 'crm',

  // POS
  'pos_sessions': 'pos',
  'pos_orders': 'pos'
};

export const FeatureFlagMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || !req.user.company_id || req.user.role === 'super_admin') {
    return next();
  }

  const companyId = req.user.company_id;
  
  // Extract module from path: e.g. /api/erp/invoices -> invoices
  // Path typically starts with /invoices if it's within erpRouter where we mount it
  const match = req.path.match(/^\/([^\/?]+)/);
  if (!match) {
    return next();
  }

  const moduleName = match[1];
  const requiredFeature = featureMap[moduleName];

  if (!requiredFeature) {
    // No specific feature flag required for this module (e.g. system settings, users, etc)
    return next();
  }

  try {
    const { rows } = await pool.query(
      `SELECT is_enabled FROM subscription_features 
       WHERE company_id = $1 AND feature_name = $2`,
      [companyId, requiredFeature]
    );

    // If there's no record, we assume it's enabled by default for backward compatibility
    // unless strictly enforcing. Rule: "ممنوع كسر أي جزء من النظام الحالي" (Additive)
    if (rows.length === 0) {
      return next();
    }

    if (rows[0].is_enabled === false) {
      return res.status(403).json({
        error: 'Feature Disabled',
        message: `هذه الخاصية (${requiredFeature}) غير مفعلة في باقتك الحالية.`,
        code: 'FEATURE_DISABLED'
      });
    }

    next();
  } catch (err: any) {
    console.error('FeatureFlagMiddleware Error:', err);
    next();
  }
};
