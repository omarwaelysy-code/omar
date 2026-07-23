import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LicensingMiddleware } from './LicensingMiddleware';
import { FeatureFlagMiddleware } from './FeatureFlagMiddleware';
import pool from '../../postgres';

// Mock DB
vi.mock('../../postgres', () => ({
  default: {
    query: vi.fn(),
  },
}));

describe('LicensingMiddleware', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    req = {
      user: { company_id: 'test-company-id', role: 'user' },
      method: 'POST',
      path: '/api/erp/invoices',
      originalUrl: '/api/erp/invoices'
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn(),
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  it('should skip if user is super_admin', async () => {
    req.user.role = 'super_admin';
    await LicensingMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('should allow if no subscription record exists (backward compatibility)', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as any);
    await LicensingMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should block if subscription is Suspended', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ 
      rows: [{ subscription_status: 'Suspended' }] 
    } as any);

    await LicensingMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'COMPANY_SUSPENDED'
    }));
  });

  it('should allow POST if subscription is Active and not expired', async () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);

    vi.mocked(pool.query).mockResolvedValueOnce({ 
      rows: [{ 
        subscription_status: 'Active',
        subscription_end: futureDate.toISOString()
      }] 
    } as any);

    await LicensingMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should block POST if subscription is Expired by end date', async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 10);

    vi.mocked(pool.query).mockResolvedValueOnce({ 
      rows: [{ 
        subscription_status: 'Active',
        subscription_end: pastDate.toISOString()
      }] 
    } as any);

    await LicensingMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'SUBSCRIPTION_EXPIRED'
    }));
  });

  it('should block request if subscription status is Expired', async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 3);

    vi.mocked(pool.query).mockResolvedValueOnce({ 
      rows: [{ 
        subscription_status: 'Expired',
        subscription_end: pastDate.toISOString()
      }] 
    } as any);

    await LicensingMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'SUBSCRIPTION_EXPIRED'
    }));
  });

  it('should block GET if subscription is Expired', async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 10);

    req.method = 'GET';

    vi.mocked(pool.query).mockResolvedValueOnce({ 
      rows: [{ 
        subscription_status: 'Active',
        subscription_end: pastDate.toISOString()
      }] 
    } as any);

    await LicensingMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'SUBSCRIPTION_EXPIRED'
    }));
  });
});

describe('FeatureFlagMiddleware', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    req = {
      user: { company_id: 'test-company-id', role: 'user' },
      path: '/invoices' // Maps to 'sales'
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  it('should skip if feature not mapped', async () => {
    req.path = '/something_unmapped';
    await FeatureFlagMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should allow if feature is enabled', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ 
      rows: [{ is_enabled: true }] 
    } as any);

    await FeatureFlagMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should block if feature is disabled', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ 
      rows: [{ is_enabled: false }] 
    } as any);

    await FeatureFlagMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'FEATURE_DISABLED'
    }));
  });
});
