import pool from '../postgres';

export interface CompanyFeature {
  company_id: string;
  feature_name: string;
  is_enabled: boolean;
}

export class FeatureService {
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

    // Default features if none explicitly exist
    const defaultFeatures = [
      'inventory', 'sales', 'purchases', 'manufacturing', 
      'crm', 'hr', 'accounting', 'pos', 'reports', 'ai', 'api'
    ];

    const currentFeatures = new Map(rows.map(r => [r.feature_name, r.is_enabled]));

    return defaultFeatures.map(f => ({
      company_id: companyId,
      feature_name: f,
      is_enabled: currentFeatures.has(f) ? currentFeatures.get(f) : true // Default to true if missing for backward compatibility
    }));
  }

  /**
   * Set or toggle a feature for a company
   */
  async toggleFeature(companyId: string, featureName: string, isEnabled: boolean): Promise<void> {
    // Basic validation
    if (!featureName) throw new Error('Feature name is required');

    await pool.query(
      `INSERT INTO subscription_features (id, company_id, feature_name, is_enabled)
       VALUES (gen_random_uuid(), $1, $2, $3)
       ON CONFLICT (company_id, feature_name) 
       DO UPDATE SET is_enabled = EXCLUDED.is_enabled, updated_at = CURRENT_TIMESTAMP`,
      [companyId, featureName, isEnabled]
    );
  }
}

export const featureService = new FeatureService();
