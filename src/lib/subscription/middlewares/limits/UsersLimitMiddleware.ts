import { Response, NextFunction } from 'express';
import pool from '../../../postgres';
import { AuthRequest } from '../../../auth-middleware';

export const UsersLimitMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  let companyId = req.user?.company_id;
  
  if (!companyId && req.body && req.body.company_id) {
    companyId = req.body.company_id;
  }

  if (!companyId) {
    return next();
  }

  try {
    const { rows: subRows } = await pool.query(
      `SELECT max_users FROM company_subscriptions WHERE company_id = $1`,
      [companyId]
    );

    if (subRows.length === 0 || !subRows[0].max_users || subRows[0].max_users === -1) {
      return next(); // Unlimited or no limit enforced
    }

    const maxUsers = subRows[0].max_users;

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) as count FROM users WHERE company_id = $1`,
      [companyId]
    );

    const currentUsers = parseInt(countRows[0].count, 10);

    if (currentUsers >= maxUsers) {
      return res.status(403).json({
        error: 'Limit Exceeded',
        message: `لقد وصلت للحد الأقصى لعدد المستخدمين (${maxUsers}). يرجى ترقية باقتك لإضافة المزيد.`,
        code: 'USERS_LIMIT_EXCEEDED'
      });
    }

    next();
  } catch (err: any) {
    console.error('UsersLimitMiddleware Error:', err);
    next();
  }
};
