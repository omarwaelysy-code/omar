import { Response, NextFunction } from 'express';
import pool from '../../../postgres';
import { AuthRequest } from '../../../auth-middleware';

export const TransactionsLimitMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || !req.user.company_id || req.user.role === 'super_admin') {
    return next();
  }

  const companyId = req.user.company_id;

  try {
    const { rows: subRows } = await pool.query(
      `SELECT max_monthly_transactions FROM company_subscriptions WHERE company_id = $1`,
      [companyId]
    );

    if (subRows.length === 0 || !subRows[0].max_monthly_transactions || subRows[0].max_monthly_transactions === -1) {
      return next(); 
    }

    const maxTransactions = subRows[0].max_monthly_transactions;

    // Get first day of current month
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [invoicesCount, purchaseCount, journalCount] = await Promise.all([
      pool.query(`SELECT COUNT(*) as count FROM invoices WHERE company_id = $1 AND created_at >= $2`, [companyId, firstDay]),
      pool.query(`SELECT COUNT(*) as count FROM purchase_invoices WHERE company_id = $1 AND created_at >= $2`, [companyId, firstDay]),
      pool.query(`SELECT COUNT(*) as count FROM journal_entries WHERE company_id = $1 AND created_at >= $2`, [companyId, firstDay])
    ]);

    const currentTransactions = 
      parseInt(invoicesCount.rows[0].count, 10) + 
      parseInt(purchaseCount.rows[0].count, 10) + 
      parseInt(journalCount.rows[0].count, 10);

    if (currentTransactions >= maxTransactions) {
      return res.status(403).json({
        error: 'Limit Exceeded',
        message: `لقد وصلت للحد الأقصى للمعاملات الشهرية (${maxTransactions}). يرجى ترقية باقتك للاستمرار أو الانتظار للشهر القادم.`,
        code: 'TRANSACTIONS_LIMIT_EXCEEDED'
      });
    }

    next();
  } catch (err: any) {
    console.error('TransactionsLimitMiddleware Error:', err);
    next();
  }
};
