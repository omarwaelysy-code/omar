import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransactionsLimitMiddleware } from './limits/TransactionsLimitMiddleware';
import pool from '../../postgres';

vi.mock('../../postgres', () => ({
  default: {
    query: vi.fn(),
  },
}));

describe('TransactionsLimitMiddleware', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    req = {
      user: { company_id: 'test-company-id', role: 'user' }
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  it('should skip if user is super_admin', async () => {
    req.user.role = 'super_admin';
    await TransactionsLimitMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should allow if limit is not set or -1', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ 
      rows: [{ max_monthly_transactions: -1 }] 
    } as any);

    await TransactionsLimitMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should allow if current transactions are below limit', async () => {
    // Mock the subscription query
    vi.mocked(pool.query).mockResolvedValueOnce({ 
      rows: [{ max_monthly_transactions: 100 }] 
    } as any);

    // Mock the 3 parallel count queries
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ count: '10' }] } as any) // invoices
      .mockResolvedValueOnce({ rows: [{ count: '20' }] } as any) // purchases
      .mockResolvedValueOnce({ rows: [{ count: '5' }] } as any); // journals

    await TransactionsLimitMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should block if current transactions exceed limit', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ 
      rows: [{ max_monthly_transactions: 100 }] 
    } as any);

    // 50 + 40 + 20 = 110 > 100
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ count: '50' }] } as any)
      .mockResolvedValueOnce({ rows: [{ count: '40' }] } as any)
      .mockResolvedValueOnce({ rows: [{ count: '20' }] } as any);

    await TransactionsLimitMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'TRANSACTIONS_LIMIT_EXCEEDED'
    }));
  });
});
