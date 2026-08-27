import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EtaAuthService } from '../services/eta/EtaAuthService';

describe('ETA Connection Test & OAuth Authentication (Phase 2.5)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('1. should return MISSING_CREDENTIALS if client_id or client_secret is missing', async () => {
    const res1 = await EtaAuthService.testConnection({
      companyId: 'comp-1',
      clientId: '',
      clientSecret: 'secret123'
    });
    expect(res1.success).toBe(false);
    expect(res1.connected).toBe(false);
    expect(res1.code).toBe('MISSING_CREDENTIALS');

    const res2 = await EtaAuthService.testConnection({
      companyId: 'comp-1',
      clientId: 'client123',
      clientSecret: ''
    });
    expect(res2.success).toBe(false);
    expect(res2.connected).toBe(false);
    expect(res2.code).toBe('MISSING_CREDENTIALS');
  });

  it('2. should succeed when ETA OAuth returns HTTP 200 with access_token', async () => {
    let requestedUrl = '';
    let requestedBody = '';

    globalThis.fetch = vi.fn().mockImplementation(async (url: string, opts: any) => {
      requestedUrl = url;
      requestedBody = opts.body;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'mock-jwt-access-token-xyz',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'InvoicingAPI'
        })
      };
    }) as any;

    const result = await EtaAuthService.testConnection({
      companyId: 'comp-1',
      environment: 'preprod',
      clientId: 'my-client-id',
      clientSecret: 'my-client-secret'
    });

    expect(result.success).toBe(true);
    expect(result.connected).toBe(true);
    expect(result.environment).toBe('preprod');
    expect(requestedUrl).toBe('https://id.preprod.eta.gov.eg/connect/token');
    expect(requestedBody).toContain('grant_type=client_credentials');
    expect(requestedBody).toContain('client_id=my-client-id');
    expect(requestedBody).toContain('client_secret=my-client-secret');

    // Verify access_token and client_secret NEVER leaked in response object
    expect((result as any).access_token).toBeUndefined();
    expect((result as any).client_secret).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('mock-jwt-access-token-xyz');
    expect(JSON.stringify(result)).not.toContain('my-client-secret');
  });

  it('3. should handle invalid credentials (HTTP 400 / 401) cleanly', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return {
        ok: false,
        status: 400,
        json: async () => ({
          error: 'invalid_client',
          error_description: 'Client authentication failed'
        })
      };
    }) as any;

    const result = await EtaAuthService.testConnection({
      companyId: 'comp-1',
      clientId: 'wrong-id',
      clientSecret: 'wrong-secret'
    });

    expect(result.success).toBe(false);
    expect(result.connected).toBe(false);
    expect(result.code).toBe('INVALID_CREDENTIALS');
  });

  it('4. should handle timeout (AbortError) cleanly', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      throw err;
    }) as any;

    const result = await EtaAuthService.testConnection({
      companyId: 'comp-1',
      clientId: 'test-id',
      clientSecret: 'test-secret'
    });

    expect(result.success).toBe(false);
    expect(result.connected).toBe(false);
    expect(result.code).toBe('TIMEOUT');
  });

  it('5. should handle ETA server unavailability (HTTP 500 / 503) cleanly', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return {
        ok: false,
        status: 503,
        json: async () => ({})
      };
    }) as any;

    const result = await EtaAuthService.testConnection({
      companyId: 'comp-1',
      clientId: 'test-id',
      clientSecret: 'test-secret'
    });

    expect(result.success).toBe(false);
    expect(result.connected).toBe(false);
    expect(result.code).toBe('ETA_UNAVAILABLE');
  });

  it('6. should use PreProd as default environment', () => {
    expect(EtaAuthService.getIdentityUrl(undefined as any)).toBe('https://id.preprod.eta.gov.eg/connect/token');
    expect(EtaAuthService.getIdentityUrl('preprod')).toBe('https://id.preprod.eta.gov.eg/connect/token');
  });

  it('7. should use official Production identity URL when production is selected', async () => {
    let requestedUrl = '';
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      requestedUrl = url;
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'prod-token', expires_in: 3600 })
      };
    }) as any;

    const result = await EtaAuthService.testConnection({
      companyId: 'comp-1',
      environment: 'production',
      clientId: 'prod-client-id',
      clientSecret: 'prod-secret'
    });

    expect(result.success).toBe(true);
    expect(result.environment).toBe('production');
    expect(requestedUrl).toBe('https://id.eta.gov.eg/connect/token');
  });

  it('8. should never call invoice submission or document APIs during connection test', async () => {
    const calledUrls: string[] = [];
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      calledUrls.push(url);
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'valid-token', expires_in: 3600 })
      };
    }) as any;

    await EtaAuthService.testConnection({
      companyId: 'comp-1',
      clientId: 'test-id',
      clientSecret: 'test-secret'
    });

    expect(calledUrls.length).toBe(1);
    expect(calledUrls[0]).toBe('https://id.preprod.eta.gov.eg/connect/token');
    expect(calledUrls[0]).not.toContain('/api/v1/documentsubmissions');
    expect(calledUrls[0]).not.toContain('/api/v1/documents');
  });
});
