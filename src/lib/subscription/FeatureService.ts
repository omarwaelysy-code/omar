import pool from '../postgres';

export interface CompanyFeature {
  company_id: string;
  feature_name: string;
  is_enabled: boolean;
}

/**
 * Single Source of Truth for checking if POS feature is enabled for a company.
 * 
 * Strict Decision Rules:
 * 1. If explicit deny in subscription_features (feature_name = 'pos' AND is_enabled = false) => FALSE
 * 2. If companies.pos_enabled = true OR companies.settings->>'pos_enabled' = 'true' => TRUE (unless denied in step 1)
 * 3. Absence of record in subscription_features does NOT enable POS if companies.pos_enabled is false => FALSE
 * 4. If subscription_features.pos = true but companies.pos_enabled = false => FALSE (requires operational enablement in companies)
 */
export async function isCompanyPosEnabled(companyId: string, dbClient?: any): Promise<boolean> {
  if (!companyId) return false;
  const client = dbClient || pool;

  try {
    // 1. Check subscription_features for explicit deny
    const subRes = await client.query(
      `SELECT is_enabled FROM subscription_features WHERE company_id = $1 AND feature_name = 'pos'`,
      [companyId]
    );

    if (subRes.rows.length > 0 && subRes.rows[0].is_enabled === false) {
      return false; // Explicit deny at platform / subscription tier
    }

    // 2. Check companies table for operational enablement
    const compRes = await client.query(
      `SELECT pos_enabled, settings FROM companies WHERE id = $1`,
      [companyId]
    );

    if (compRes.rows.length === 0) {
      return false;
    }

    const companyRow = compRes.rows[0];
    const isOperationalEnabled = 
      companyRow.pos_enabled === true || 
      companyRow.pos_enabled === 'true' || 
      companyRow.settings?.pos_enabled === true || 
      companyRow.settings?.pos_enabled === 'true';

    return isOperationalEnabled === true;
  } catch (error) {
    console.error('Error in isCompanyPosEnabled:', error);
    return false;
  }
}

export class FeatureService {
  /**
   * Check if POS feature is enabled for a company using central SSOT helper
   */
  async isPosEnabled(companyId: string, dbClient?: any): Promise<boolean> {
    return isCompanyPosEnabled(companyId, dbClient);
  }

  /**
   * Get all features for a specific company
   */
  async getFeatures(companyId: string): Promise<CompanyFeature[]> {
    const { rows } = await pool.query(
      `SELECT company_id, feature_name, is_enabled 
       FROM subscription_features 
       WHERE company_id = $1`,
      [companyId]
    );

    // Default system features arranged sequentially from Dashboard to Admin
    const defaultFeatures = [
      // 1. Dashboard
      'dashboard', 'ai',
      // 2. Master Data
      'customers', 'suppliers', 'employees', 'expenses', 'crm', 'payment_methods',
      // 3. Warehouses & Inventory
      'inventory', 'products', 'item_groups', 'warehouses', 'goods_receipts', 'warehouse_transfers', 'opening_stock_balances', 'stock_adjustments', 'manufacturing',
      'stock_card_report', 'stock_balances_report', 'general_stock_movements_report',
      // 4. Sales
      'sales', 'invoices', 'sales_orders', 'returns', 'sales_import', 'customer_discounts',
      'customer_statement', 'customer_balances', 'customer_aging_report', 'sales_report',
      // 5. Purchases
      'purchases', 'purchase_invoices', 'purchase_orders', 'purchase_returns', 'purchases_import', 'supplier_discounts',
      'supplier_statement', 'supplier_balances', 'supplier_aging_report',
      // 6. ETA E-Invoicing
      'eta_integration', 'eta_received_invoices', 'eta_detailed_invoices', 'eta_mapping',
      // 7. Cash & Banks
      'cash', 'receipts', 'payment_vouchers', 'cash_transfers', 'egyptian_banks',
      'cash_balances', 'expenses_report',
      // 8. Cheques
      'cheques', 'issued_cheques', 'received_cheques',
      // 9. Operations
      'flexible_operations', 'departments', 'cost_centers', 'operation_categories',
      // 10. General Ledger
      'accounting', 'chart_of_accounts', 'journal_entries', 'detailed_journal_entries', 'multi_currency', 'ifrs_guide',
      'general_ledger_report', 'trial_balance', 'income_statement', 'balance_sheet', 'cash_flow_statement',
      // 11. Fixed Assets
      'fixed_assets', 'asset_categories', 'asset_depreciation', 'fixed_assets_reports',
      // 12. Templates
      'templates', 'create_template',
      // 13. Reports
      'reports', 'financial_reports', 'inventory_reports', 'partner_reports',
      // 14. POS
      'pos', 'pos_branches',
      // 15. Admin & System
      'admin', 'user_management', 'period_closing', 'data_integrity', 'backup_restore', 'activity_logs', 'api', 'hr'
    ];

    const currentFeatures = new Map(rows.map(r => [r.feature_name, r.is_enabled]));
    const combinedFeatures = Array.from(new Set([...defaultFeatures, ...rows.map(r => r.feature_name)]));

    return combinedFeatures.map(f => ({
      company_id: companyId,
      feature_name: f,
      is_enabled: currentFeatures.has(f) ? currentFeatures.get(f) : true // Default to true if missing
    }));
  }

  /**
   * Set or toggle a feature for a company.
   * When toggling POS, synchronizes subscription_features and companies.pos_enabled in ONE atomic transaction.
   */
  async toggleFeature(companyId: string, featureName: string, isEnabled: boolean): Promise<void> {
    // Basic validation
    if (!featureName) throw new Error('Feature name is required');
    if (!companyId) throw new Error('Company ID is required');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO subscription_features (id, company_id, feature_name, is_enabled)
         VALUES (gen_random_uuid(), $1, $2, $3)
         ON CONFLICT (company_id, feature_name) 
         DO UPDATE SET is_enabled = EXCLUDED.is_enabled, updated_at = CURRENT_TIMESTAMP`,
        [companyId, featureName, isEnabled]
      );

      if (featureName === 'pos') {
        // Synchronize companies.pos_enabled and settings.pos_enabled atomically
        await client.query(
          `UPDATE companies 
           SET pos_enabled = $1,
               settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{pos_enabled}', to_jsonb($1::boolean)),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [isEnabled, companyId]
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Batch update multiple features for a company in an atomic transaction
   */
  async batchUpdateFeatures(companyId: string, features: { featureName: string; isEnabled: boolean }[]): Promise<void> {
    if (!companyId) throw new Error('Company ID is required');
    if (!features || !Array.isArray(features)) throw new Error('Features array is required');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const f of features) {
        await client.query(
          `INSERT INTO subscription_features (id, company_id, feature_name, is_enabled)
           VALUES (gen_random_uuid(), $1, $2, $3)
           ON CONFLICT (company_id, feature_name) 
           DO UPDATE SET is_enabled = EXCLUDED.is_enabled, updated_at = CURRENT_TIMESTAMP`,
          [companyId, f.featureName, f.isEnabled]
        );

        if (f.featureName === 'pos') {
          await client.query(
            `UPDATE companies 
             SET pos_enabled = $1,
                 settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{pos_enabled}', to_jsonb($1::boolean)),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [f.isEnabled, companyId]
          );
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

export const featureService = new FeatureService();

