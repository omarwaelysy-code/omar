import { dbService } from './dbService';
import { AuditLog } from '../types';

export class AuditService {
  static async log(params: {
    userId: string;
    email: string;
    action: string;
    resource: string;
    resourceId?: string;
    changes?: { before: any; after: any };
    severity?: AuditLog['severity'];
    companyId: string;
  }) {
    const logEntry: Omit<AuditLog, 'id'> = {
      user_id: params.userId,
      user_email: params.email,
      action: params.action,
      resource: params.resource,
      resource_id: params.resourceId,
      changes: params.changes,
      severity: params.severity || 'info',
      timestamp: new Date().toISOString(),
      company_id: params.companyId
    };

    try {
      await dbService.add('audit_logs', logEntry);
    } catch (error) {
      console.error('[AuditService] Failed to persist audit log:', error);
      // In critical scenarios, we could push to an external failover logging service
    }
  }

  /**
   * System-level critical event logging
   */
  static async logCritical(params: any) {
    return this.log({ ...params, severity: 'critical' });
  }
}
