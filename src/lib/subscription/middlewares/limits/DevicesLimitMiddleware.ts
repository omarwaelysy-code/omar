import { Response, NextFunction } from 'express';
import pool from '../../../postgres';
import { AuthRequest } from '../../../auth-middleware';

export const DevicesLimitMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || !req.user.company_id || req.user.role === 'super_admin') {
    return next();
  }

  const companyId = req.user.company_id;

  try {
    const { rows: subRows } = await pool.query(
      `SELECT max_devices FROM company_subscriptions WHERE company_id = $1`,
      [companyId]
    );

    if (subRows.length === 0 || !subRows[0].max_devices || subRows[0].max_devices === -1) {
      return next(); 
    }

    const maxDevices = subRows[0].max_devices;

    // We assume a pos_devices table exists or will be created.
    // Using a try-catch for the specific query to not break if the table doesn't exist yet.
    let currentDevices = 0;
    try {
      const { rows: countRows } = await pool.query(
        `SELECT COUNT(*) as count FROM pos_devices WHERE company_id = $1`,
        [companyId]
      );
      currentDevices = parseInt(countRows[0].count, 10);
    } catch (e: any) {
      // Table doesn't exist yet, ignore
      return next();
    }

    if (currentDevices >= maxDevices) {
      return res.status(403).json({
        error: 'Limit Exceeded',
        message: `لقد وصلت للحد الأقصى لعدد أجهزة الـ POS (${maxDevices}). يرجى ترقية باقتك لإضافة المزيد.`,
        code: 'DEVICES_LIMIT_EXCEEDED'
      });
    }

    next();
  } catch (err: any) {
    console.error('DevicesLimitMiddleware Error:', err);
    next();
  }
};
