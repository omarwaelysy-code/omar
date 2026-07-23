import { subscriptionRepository } from './SubscriptionRepository';
import { limitsValidationService } from './LimitsValidationService';
import { randomUUID } from 'crypto';
import pool from '../postgres';

export class SubscriptionService {
  /**
   * Create a new subscription.
   */
  async create(data: any, createdBy: string = 'system', existingClient?: any): Promise<any> {
    const subscriptionId = randomUUID();
    
    const subscriptionData = {
      id: subscriptionId,
      ...data
    };
    
    const client = existingClient || await pool.connect();
    const shouldManageTransaction = !existingClient;

    try {
      if (shouldManageTransaction) {
        await client.query('BEGIN');
      }
      
      const newSubscription = await subscriptionRepository.createSubscription(subscriptionData, client);
      
      // Log history
      await subscriptionRepository.addHistoryRecord({
        company_id: data.company_id,
        old_plan: null,
        new_plan: data.plan_type,
        old_status: null,
        new_status: data.subscription_status,
        changed_by: createdBy,
        change_reason: 'Initial Subscription Creation'
      }, client);

      if (shouldManageTransaction) {
        await client.query('COMMIT');
      }
      return newSubscription;
    } catch (error) {
      if (shouldManageTransaction) {
        await client.query('ROLLBACK');
      }
      throw error;
    } finally {
      if (shouldManageTransaction) {
        client.release();
      }
    }
  }

  /**
   * Update a subscription.
   */
  async update(companyId: string, data: any, updatedBy: string = 'system'): Promise<any> {
    const existing = await subscriptionRepository.getSubscriptionByCompanyId(companyId);
    if (!existing) throw new Error('Subscription not found');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const updated = await subscriptionRepository.updateSubscription(companyId, data, client);
      
      // Log history if plan or status changed
      if (data.plan_type || data.subscription_status) {
        await subscriptionRepository.addHistoryRecord({
          company_id: companyId,
          old_plan: existing.plan_type,
          new_plan: updated.plan_type,
          old_status: existing.subscription_status,
          new_status: updated.subscription_status,
          changed_by: updatedBy,
          change_reason: 'Subscription Update'
        }, client);
      }

      await client.query('COMMIT');
      return updated;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Change subscription status helper.
   */
  private async changeStatus(companyId: string, newStatus: string, changedBy: string): Promise<any> {
    return this.update(companyId, { subscription_status: newStatus }, changedBy);
  }

  /**
   * Activate subscription.
   */
  async activate(companyId: string, changedBy: string = 'system'): Promise<any> {
    return this.changeStatus(companyId, 'Active', changedBy);
  }

  /**
   * Suspend subscription.
   */
  async suspend(companyId: string, changedBy: string = 'system'): Promise<any> {
    return this.changeStatus(companyId, 'Suspended', changedBy);
  }

  /**
   * Expire subscription.
   */
  async expire(companyId: string, changedBy: string = 'system'): Promise<any> {
    return this.changeStatus(companyId, 'Expired', changedBy);
  }

  /**
   * Set subscription to trial.
   */
  async trial(companyId: string, changedBy: string = 'system'): Promise<any> {
    return this.changeStatus(companyId, 'Trial', changedBy);
  }

  /**
   * Delete subscription.
   */
  async delete(companyId: string, deletedBy: string = 'system'): Promise<boolean> {
    const existing = await subscriptionRepository.getSubscriptionByCompanyId(companyId);
    if (!existing) return false;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      await subscriptionRepository.addHistoryRecord({
        company_id: companyId,
        old_plan: existing.plan_type,
        new_plan: null,
        old_status: existing.subscription_status,
        new_status: 'Deleted',
        changed_by: deletedBy,
        change_reason: 'Subscription Deletion'
      }, client);

      const deleted = await subscriptionRepository.deleteSubscription(companyId, client);
      
      await client.query('COMMIT');
      return deleted;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get subscription by company ID.
   */
  async getByCompany(companyId: string): Promise<any> {
    return await subscriptionRepository.getSubscriptionByCompanyId(companyId);
  }

  /**
   * Get all subscriptions.
   */
  async getAllSubscriptions(): Promise<any[]> {
    return await subscriptionRepository.getAllSubscriptions();
  }

  /**
   * Validate current limits against usage.
   */
  async validateLimits(companyId: string, currentUsage: any): Promise<void> {
    const subscription = await this.getByCompany(companyId);
    if (!subscription) throw new Error('Subscription not found');

    limitsValidationService.validateLimits(subscription, currentUsage);
  }

  /**
   * Update usage metrics.
   */
  async updateUsage(companyId: string, usageData: any): Promise<any> {
    const subscription = await this.getByCompany(companyId);
    if (!subscription) throw new Error('Subscription not found');

    // Merge existing usage with new usage to validate total before saving
    const prospectiveUsage = {
      current_users: usageData.current_users ?? subscription.current_users,
      current_branches: usageData.current_branches ?? subscription.current_branches,
      current_warehouses: usageData.current_warehouses ?? subscription.current_warehouses,
      current_devices: usageData.current_devices ?? subscription.current_devices,
      current_monthly_transactions: usageData.current_monthly_transactions ?? subscription.current_monthly_transactions,
    };

    limitsValidationService.validateLimits(subscription, prospectiveUsage);

    return await subscriptionRepository.updateUsage(companyId, usageData);
  }
}

export const subscriptionService = new SubscriptionService();
