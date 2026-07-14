export class LimitsValidationService {
  /**
   * Validate limits against current usage.
   * Throws an error if any limit is exceeded.
   */
  validateLimits(subscription: any, currentUsage: any): void {
    if (subscription.max_users > 0 && currentUsage.current_users > subscription.max_users) {
      throw new Error(`Exceeded maximum users limit: ${subscription.max_users}`);
    }

    if (subscription.max_branches > 0 && currentUsage.current_branches > subscription.max_branches) {
      throw new Error(`Exceeded maximum branches limit: ${subscription.max_branches}`);
    }

    if (subscription.max_warehouses > 0 && currentUsage.current_warehouses > subscription.max_warehouses) {
      throw new Error(`Exceeded maximum warehouses limit: ${subscription.max_warehouses}`);
    }

    if (subscription.max_devices > 0 && currentUsage.current_devices > subscription.max_devices) {
      throw new Error(`Exceeded maximum devices limit: ${subscription.max_devices}`);
    }

    if (subscription.max_monthly_transactions > 0 && currentUsage.current_monthly_transactions > subscription.max_monthly_transactions) {
      throw new Error(`Exceeded maximum monthly transactions limit: ${subscription.max_monthly_transactions}`);
    }
  }

  /**
   * Check if a specific action is allowed under the current subscription limits.
   */
  canAddResource(subscription: any, resourceType: 'users' | 'branches' | 'warehouses' | 'devices' | 'transactions'): boolean {
    const maxLimit = subscription[`max_${resourceType}`];
    const currentUsage = subscription[`current_${resourceType}`];

    if (maxLimit > 0 && currentUsage >= maxLimit) {
      return false;
    }

    return true;
  }
}

export const limitsValidationService = new LimitsValidationService();
