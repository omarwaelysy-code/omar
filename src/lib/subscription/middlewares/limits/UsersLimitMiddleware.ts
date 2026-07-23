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

    let maxUsers = subRows.length > 0 && subRows[0].max_users ? parseInt(subRows[0].max_users, 10) : null;

    if (!maxUsers || maxUsers <= 0) {
      const { rows: compRows } = await pool.query(
        `SELECT users_limit FROM companies WHERE id = $1`,
        [companyId]
      );
      if (compRows.length > 0 && compRows[0].users_limit) {
        maxUsers = parseInt(compRows[0].users_limit, 10);
      }
    }

    if (!maxUsers || maxUsers === -1) {
      return next(); // Unlimited
    }

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) as count FROM users WHERE company_id = $1`,
      [companyId]
    );

    const currentUsers = parseInt(countRows[0].count, 10);

    if (currentUsers >= maxUsers) {
      const msg = `عفواً، تم التوصل إلى الحد الأقصى لعدد المستخدمين المسموح به لهذه الشركة (${maxUsers} مستخدمين). لا يمكن إضافة مستخدم جديد بدون ترقية عدد المستخدمين.`;
      return res.status(403).json({
        error: msg,
        message: msg,
        code: 'USERS_LIMIT_EXCEEDED'
      });
    }

    next();
  } catch (err: any) {
    console.error('UsersLimitMiddleware Error:', err);
    next();
  }
};
