import { Response, NextFunction } from 'express';
import pool from '../../../postgres';
import { AuthRequest } from '../../../auth-middleware';

export const BranchesLimitMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || !req.user.company_id || req.user.role === 'super_admin') {
    return next();
  }

  const companyId = req.user.company_id;

  try {
    const { rows: subRows } = await pool.query(
      `SELECT max_branches FROM company_subscriptions WHERE company_id = $1`,
      [companyId]
    );

    if (subRows.length === 0 || !subRows[0].max_branches || subRows[0].max_branches === -1) {
      return next(); 
    }

    const maxBranches = subRows[0].max_branches;

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) as count FROM departments WHERE company_id = $1`,
      [companyId]
    );

    const currentBranches = parseInt(countRows[0].count, 10);

    if (currentBranches >= maxBranches) {
      return res.status(403).json({
        error: 'Limit Exceeded',
        message: `لقد وصلت للحد الأقصى لعدد الفروع (${maxBranches}). يرجى ترقية باقتك لإضافة المزيد.`,
        code: 'BRANCHES_LIMIT_EXCEEDED'
      });
    }

    next();
  } catch (err: any) {
    console.error('BranchesLimitMiddleware Error:', err);
    next();
  }
};
