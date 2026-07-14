import pool from '../postgres';

export class SubscriptionRepository {
  /**
   * Create a new subscription for a company.
   */
  async createSubscription(data: any, client: any = pool): Promise<any> {
    const {
      id, company_id, plan_type, subscription_status, start_date, end_date,
      trial_until, max_users, max_branches, max_warehouses, max_devices, max_monthly_transactions
    } = data;

    const query = `
      INSERT INTO company_subscriptions (
        id, company_id, plan_type, subscription_status, start_date, end_date,
        trial_until, max_users, max_branches, max_warehouses, max_devices, max_monthly_transactions
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *;
    `;
    const values = [
      id, company_id, plan_type, subscription_status, start_date, end_date,
      trial_until, max_users, max_branches, max_warehouses, max_devices, max_monthly_transactions
    ];

    const result = await client.query(query, values);
    return result.rows[0];
  }

  /**
   * Get subscription by company ID.
   */
  async getSubscriptionByCompanyId(companyId: string, client: any = pool): Promise<any> {
    const query = `SELECT * FROM company_subscriptions WHERE company_id = $1`;
    const result = await client.query(query, [companyId]);
    return result.rows[0] || null;
  }

  /**
   * Update an existing subscription.
   */
  async updateSubscription(companyId: string, data: any, client: any = pool): Promise<any> {
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    const allowedKeys = [
      'plan_type', 'subscription_status', 'start_date', 'end_date', 'trial_until',
      'max_users', 'max_branches', 'max_warehouses', 'max_devices', 'max_monthly_transactions',
      'current_users', 'current_branches', 'current_warehouses', 'current_devices', 'current_monthly_transactions'
    ];

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && allowedKeys.includes(key)) {
        updates.push(`${key} = $${idx}`);
        values.push(value);
        idx++;
      }
    }

    if (updates.length === 0) return null;

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    const query = `
      UPDATE company_subscriptions
      SET ${updates.join(', ')}
      WHERE company_id = $${idx}
      RETURNING *;
    `;
    values.push(companyId);

    const result = await client.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Update current usage metrics.
   */
  async updateUsage(companyId: string, usageData: any, client: any = pool): Promise<any> {
    return this.updateSubscription(companyId, usageData, client);
  }

  /**
   * Delete a subscription.
   */
  async deleteSubscription(companyId: string, client: any = pool): Promise<boolean> {
    const query = `DELETE FROM company_subscriptions WHERE company_id = $1`;
    const result = await client.query(query, [companyId]);
    return (result.rowCount || 0) > 0;
  }

  /**
   * Get all subscriptions.
   */
  async getAllSubscriptions(client: any = pool): Promise<any[]> {
    const query = `SELECT * FROM company_subscriptions ORDER BY created_at DESC`;
    const result = await client.query(query);
    return result.rows;
  }

  /**
   * Record subscription history changes.
   */
  async addHistoryRecord(record: any, client: any = pool): Promise<void> {
    const { company_id, old_plan, new_plan, old_status, new_status, changed_by, change_reason } = record;
    
    const query = `
      INSERT INTO subscription_history (
        company_id, old_plan, new_plan, old_status, new_status, changed_by, change_reason
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    const values = [company_id, old_plan, new_plan, old_status, new_status, changed_by, change_reason];
    
    await client.query(query, values);
  }
}

export const subscriptionRepository = new SubscriptionRepository();
