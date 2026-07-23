import { Response, NextFunction } from 'express';
import pool from '../../postgres';
import { AuthRequest } from '../../auth-middleware';

const SUPER_ADMIN_EMAILS = ['omarwaelysy@gmail.com', 'omarwaelsys@gmail.com', 'acc.wael2005@gmail.com'];

export const LicensingMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const isSuperAdmin = req.user?.role === 'super_admin' || (req.user?.email && SUPER_ADMIN_EMAILS.includes(req.user.email.trim().toLowerCase()));

  // Super admins and system-level requests bypass licensing checks to allow administration
  if (!req.user || !req.user.company_id || req.user.company_id === 'system' || req.user.company_id === 'SYSTEM' || isSuperAdmin) {
    return next();
  }

  const companyId = req.user.company_id;

  try {
    const { rows } = await pool.query(
      `SELECT subscription_status, subscription_end, subscription_expiry, company_status 
       FROM companies 
       WHERE id = $1`,
      [companyId]
    );

    if (rows.length > 0) {
      const comp = rows[0];
      const nowStr = new Date().toISOString().slice(0, 10);
      const endDateStr = comp.subscription_end || comp.subscription_expiry ? new Date(comp.subscription_end || comp.subscription_expiry).toISOString().slice(0, 10) : '';
      
      const isSuspended = comp.company_status === 'suspended' || comp.subscription_status === 'suspended' || comp.subscription_status === 'Suspended';
      const isExpiredStatus = comp.subscription_status === 'expired' || comp.subscription_status === 'Expired';
      const isExpiredDate = Boolean(endDateStr && endDateStr < nowStr);

      if (isSuspended) {
        return res.status(403).json({
          error: 'تم إيقاف هذه الشركة بواسطة إدارة النظام.',
          message: 'تم إيقاف هذه الشركة بواسطة إدارة النظام. لا يمكن الوصول للبيانات.',
          code: 'COMPANY_SUSPENDED'
        });
      }

      if (isExpiredStatus || isExpiredDate) {
        return res.status(403).json({
          error: `عفواً، لقد انتهى اشتراك الشركة بتاريخ ${endDateStr || 'السابق'}. لا يمكن فتح الشركة أو استخدام بياناتها حتى يتم تجديد الاشتراك.`,
          message: `عفواً، لقد انتهى اشتراك الشركة بتاريخ ${endDateStr || 'السابق'}. لا يمكن فتح الشركة أو استخدام بياناتها حتى يتم تجديد الاشتراك.`,
          code: 'SUBSCRIPTION_EXPIRED'
        });
      }
    }

    next();
  } catch (error: any) {
    console.error('Error in LicensingMiddleware:', error);
    next();
  }
};
