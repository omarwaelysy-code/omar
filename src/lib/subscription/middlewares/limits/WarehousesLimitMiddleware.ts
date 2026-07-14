import { Response, NextFunction } from 'express';
import pool from '../../../postgres';
import { AuthRequest } from '../../../auth-middleware';

export const WarehousesLimitMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || !req.user.company_id || req.user.role === 'super_admin') {
    return next();
  }

  const companyId = req.user.company_id;

  try {
    const { rows: subRows } = await pool.query(
      `SELECT max_warehouses FROM company_subscriptions WHERE company_id = $1`,
      [companyId]
    );

    if (subRows.length === 0 || !subRows[0].max_warehouses || subRows[0].max_warehouses === -1) {
      return next(); 
    }

    const maxWarehouses = subRows[0].max_warehouses;

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) as count FROM warehouses WHERE company_id = $1`,
      [companyId]
    );

    const currentWarehouses = parseInt(countRows[0].count, 10);

    if (currentWarehouses >= maxWarehouses) {
      return res.status(403).json({
        error: 'Limit Exceeded',
        message: `لقد وصلت للحد الأقصى لعدد المخازن (${maxWarehouses}). يرجى ترقية باقتك لإضافة المزيد.`,
        code: 'WAREHOUSES_LIMIT_EXCEEDED'
      });
    }

    next();
  } catch (err: any) {
    console.error('WarehousesLimitMiddleware Error:', err);
    next();
  }
};
