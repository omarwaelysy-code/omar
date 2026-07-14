import { Response, NextFunction } from 'express';
import pool from '../../postgres';
import { AuthRequest } from '../../auth-middleware';

export const LicensingMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  // Only process if user is authenticated and has a company_id
  if (!req.user || !req.user.company_id || req.user.role === 'super_admin') {
    return next();
  }

  const companyId = req.user.company_id;

  try {
    const { rows } = await pool.query(
      `SELECT subscription_status, start_date, end_date, trial_until, grace_period_days 
       FROM company_subscriptions 
       WHERE company_id = $1`,
      [companyId]
    );

    // If no subscription record, allow to proceed (assuming backward compatibility or free tier)
    if (rows.length === 0) {
      return next();
    }

    const sub = rows[0];
    let isExpired = false;
    let isSuspended = sub.subscription_status === 'Suspended';
    let isGracePeriodActive = false;

    const now = new Date();

    if (isSuspended) {
      return res.status(403).json({
        error: 'Subscription Suspended',
        message: 'تم إيقاف اشتراك الشركة. يرجى التواصل مع الدعم الفني.',
        code: 'SUBSCRIPTION_SUSPENDED'
      });
    }

    if (sub.subscription_status === 'Expired') {
      isExpired = true;
    } else if (sub.subscription_status === 'Trial') {
      if (sub.trial_until && new Date(sub.trial_until) < now) {
        isExpired = true;
      }
    } else if (sub.subscription_status === 'Active') {
      if (sub.end_date && new Date(sub.end_date) < now) {
        isExpired = true;
      }
    }

    // Check Grace Period if expired
    if (isExpired) {
      const expirationDate = sub.subscription_status === 'Trial' ? new Date(sub.trial_until) : new Date(sub.end_date);
      const gracePeriodEnd = new Date(expirationDate);
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + (sub.grace_period_days || 7));

      if (now <= gracePeriodEnd) {
        isExpired = false; // Override expired status
        isGracePeriodActive = true;
      }
    }

    if (isGracePeriodActive) {
      // Attach a warning flag to the request so the frontend can potentially read it via headers
      res.setHeader('X-Subscription-Warning', 'GRACE_PERIOD');
    }

    if (isExpired) {
      // Allow Read Operations (GET)
      if (req.method === 'GET') {
        res.setHeader('X-Subscription-Warning', 'EXPIRED_READ_ONLY');
        return next();
      }

      // Allow specific endpoints: Settings/Company updates, Login (handled earlier), Support, Subscription Pay
      const allowedPaths = [
        '/api/erp/companies',
        '/api/erp/settings',
        '/api/erp/auth/login', // Though usually intercepted before this middleware
        '/api/erp/auth/logout',
        '/api/subscriptions' // Subscriptions API is separate but just in case
      ];

      // Check if path starts with any of the allowed paths
      const isAllowed = allowedPaths.some(p => req.originalUrl.startsWith(p) || req.path.startsWith(p.replace('/api/erp', '')));
      
      if (isAllowed) {
        return next();
      }

      return res.status(403).json({
        error: 'Subscription Expired',
        message: 'اشتراك الشركة منتهي. لا يمكنك إضافة أو تعديل البيانات. يمكنك فقط استعراض البيانات أو تجديد الاشتراك.',
        code: 'SUBSCRIPTION_EXPIRED'
      });
    }

    next();
  } catch (err: any) {
    console.error('LicensingMiddleware Error:', err);
    // On DB error, fail open to not break the system, or fail closed?
    // "ممنوع كسر أي جزء من النظام الحالي." -> Fail open is safer for stability.
    next();
  }
};
