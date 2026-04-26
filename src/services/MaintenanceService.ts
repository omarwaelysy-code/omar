import { dbService } from './dbService';
import { SystemConfig } from '../types';

export class MaintenanceService {
  private static CONFIG_ID = 'global_config';

  static async getStatus(): Promise<SystemConfig | null> {
    try {
      return await dbService.get<SystemConfig>('system_config', this.CONFIG_ID);
    } catch {
      return null;
    }
  }

  static async setMaintenance(enabled: boolean, userId: string, message?: string) {
    const current = await this.getStatus();
    const config: Partial<SystemConfig> = {
      maintenance_mode: enabled,
      maintenance_message: message || (enabled ? 'System is undergoing maintenance. Please try again later.' : ''),
      updated_at: new Date().toISOString(),
      updated_by: userId,
      allowed_users: current?.allowed_users || [userId]
    };

    if (current) {
      await dbService.update('system_config', this.CONFIG_ID, config);
    } else {
      await dbService.addWithId('system_config', this.CONFIG_ID, {
        ...config,
        min_client_version: '2.0.0',
        id: this.CONFIG_ID
      } as SystemConfig);
    }
  }

  /**
   * Check if user is allowed to bypass maintenance
   */
  static isAllowed(user: { id: string; role: string }, config: SystemConfig | null): boolean {
    if (!config?.maintenance_mode) return true;
    if (user.role === 'super_admin') return true;
    return config.allowed_users.includes(user.id);
  }
}
