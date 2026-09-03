import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EtaDocumentService } from '../services/eta/EtaDocumentService';
import { EtaAuthService } from '../services/eta/EtaAuthService';
import pool from '../lib/postgres';

describe('ETA Document Service — Search Received Documents (Read-Only Phase 1)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('1. should return isConfigured: false if company settings are missing or unconfigured', async () => {
    vi.spyOn(pool, 'query').mockResolvedValue({ rows: [] } as any);

    const result = await EtaDocumentService.searchReceivedInvoices('comp-unconfigured');

    expect(result.success).toBe(false);
    expect(result.isConfigured).toBe(false);
    expect(result.data).toEqual([]);
    expect(result.pagination.continuationToken).toBeNull();
  });

  it('2. should enforce company isolation and read settings only for the given companyId', async () => {
    const querySpy = vi.spyOn(pool, 'query').mockResolvedValue({
      rows: [
        {
          environment: 'preprod',
          client_id: 'client-123',
          client_secret: 'secret-xyz',
          is_configured: true
        }
      ]
    } as any);

    vi.spyOn(EtaAuthService, 'getValidAccessToken').mockResolvedValue('mock-token-abc');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        result: [],
        metadata: { continuationToken: null }
      })
    } as any);

    await EtaDocumentService.searchReceivedInvoices('comp-isolated-99');

    expect(querySpy).toHaveBeenCalledWith(
      expect.stringContaining('WHERE company_id = $1'),
      ['comp-isolated-99']
    );
  });

  it('3. should enforce direction=Received and documentType=i in request to ETA API', async () => {
    vi.spyOn(pool, 'query').mockResolvedValue({
      rows: [
        {
          environment: 'preprod',
          client_id: 'client-1',
          client_secret: 'secret-1',
          is_configured: true
        }
      ]
    } as any);

    vi.spyOn(EtaAuthService, 'getValidAccessToken').mockResolvedValue('mock-token');

    let requestedUrl = '';
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      requestedUrl = url;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          result: [],
          metadata: { continuationToken: null }
        })
      };
    }) as any;

    await EtaDocumentService.searchReceivedInvoices('comp-1', {
      documentType: 'i'
    });

    const parsedUrl = new URL(requestedUrl);
    expect(parsedUrl.searchParams.get('direction')).toBe('Received');
    expect(parsedUrl.searchParams.get('documentType')).toBe('i');
    expect(requestedUrl).toContain('https://api.preprod.eta.gov.eg/api/v1.0/documents/search');
  });

  it('4. should apply date filters, status filters, and pagination parameters correctly', async () => {
    vi.spyOn(pool, 'query').mockResolvedValue({
      rows: [
        {
          environment: 'production',
          client_id: 'client-prod',
          client_secret: 'secret-prod',
          is_configured: true
        }
      ]
    } as any);

    vi.spyOn(EtaAuthService, 'getValidAccessToken').mockResolvedValue('prod-token');

    let requestedUrl = '';
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      requestedUrl = url;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          result: [],
          metadata: { continuationToken: 'next-page-tok-xyz' }
        })
      };
    }) as any;

    const result = await EtaDocumentService.searchReceivedInvoices('comp-prod', {
      issueDateFrom: '2026-08-01T00:00:00Z',
      issueDateTo: '2026-08-31T23:59:59Z',
      status: 'Valid',
      pageSize: 50,
      continuationToken: 'current-page-tok',
      internalId: 'INV-550',
      issuerId: '100200300'
    });

    const parsedUrl = new URL(requestedUrl);
    expect(parsedUrl.hostname).toBe('api.eta.gov.eg'); // Production URL
    expect(parsedUrl.searchParams.get('issueDateFrom')).toBe('2026-08-01T00:00:00Z');
    expect(parsedUrl.searchParams.get('issueDateTo')).toBe('2026-08-31T23:59:59Z');
    expect(parsedUrl.searchParams.get('status')).toBe('Valid');
    expect(parsedUrl.searchParams.get('pageSize')).toBe('50');
    expect(parsedUrl.searchParams.get('continuationToken')).toBe('current-page-tok');
    expect(parsedUrl.searchParams.get('internalId')).toBe('INV-550');
    expect(parsedUrl.searchParams.get('issuerId')).toBe('100200300');
    expect(result.pagination.continuationToken).toBe('next-page-tok-xyz');
  });

  it('5. should defensively map ETA response and correctly compute tax totals', async () => {
    vi.spyOn(pool, 'query').mockResolvedValue({
      rows: [
        {
          environment: 'preprod',
          client_id: 'client-1',
          client_secret: 'secret-1',
          is_configured: true
        }
      ]
    } as any);

    vi.spyOn(EtaAuthService, 'getValidAccessToken').mockResolvedValue('token');

    const sampleEtaDocument = {
      uuid: 'ETA-UUID-999-ABC',
      submissionUUID: 'SUB-UUID-001',
      internalId: 'BILL-2026-001',
      typeName: 'i',
      documentTypeNamePrimaryLang: 'فاتورة ضريبية',
      typeVersionName: '1.0',
      issuerId: '772681716',
      issuerName: 'شركة النيل للتوريدات',
      receiverId: '987654321',
      receiverName: 'شركة العميل',
      dateTimeIssued: '2026-08-20T10:00:00Z',
      dateTimeReceived: '2026-08-20T10:05:00Z',
      totalSales: 1000,
      totalDiscount: 100,
      netAmount: 900,
      total: 1026,
      taxTotals: [{ taxType: 'T1', amount: 126 }],
      status: 'Valid'
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        result: [sampleEtaDocument],
        metadata: { continuationToken: null, totalCount: 1 }
      })
    } as any);

    const result = await EtaDocumentService.searchReceivedInvoices('comp-1');

    expect(result.success).toBe(true);
    expect(result.data.length).toBe(1);

    const doc = result.data[0];
    expect(doc.uuid).toBe('ETA-UUID-999-ABC');
    expect(doc.internalId).toBe('BILL-2026-001');
    expect(doc.issuerName).toBe('شركة النيل للتوريدات');
    expect(doc.issuerId).toBe('772681716');
    expect(doc.netAmount).toBe(900);
    expect(doc.taxAmount).toBe(126);
    expect(doc.totalAmount).toBe(1026);
    expect(doc.currency).toBe('EGP');
    expect(doc.status).toBe('Valid');
  });

  it('6. should retry once when ETA API returns HTTP 401 and refresh access token', async () => {
    vi.spyOn(pool, 'query').mockResolvedValue({
      rows: [
        {
          environment: 'preprod',
          client_id: 'client-1',
          client_secret: 'secret-1',
          is_configured: true
        }
      ]
    } as any);

    const clearCacheSpy = vi.spyOn(EtaAuthService, 'clearCache');
    const getTokenSpy = vi.spyOn(EtaAuthService, 'getValidAccessToken')
      .mockResolvedValueOnce('old-expired-token')
      .mockResolvedValueOnce('new-refreshed-token');

    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return { ok: false, status: 401, json: async () => ({}) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          result: [],
          metadata: { continuationToken: null }
        })
      };
    }) as any;

    const result = await EtaDocumentService.searchReceivedInvoices('comp-1');

    expect(clearCacheSpy).toHaveBeenCalledWith('comp-1', 'preprod');
    expect(getTokenSpy).toHaveBeenCalledTimes(2);
    expect(callCount).toBe(2);
    expect(result.success).toBe(true);
  });

  it('7. should handle ETA HTTP 403 Forbidden with clean message', async () => {
    vi.spyOn(pool, 'query').mockResolvedValue({
      rows: [
        {
          environment: 'preprod',
          client_id: 'client-1',
          client_secret: 'secret-1',
          is_configured: true
        }
      ]
    } as any);

    vi.spyOn(EtaAuthService, 'getValidAccessToken').mockResolvedValue('token');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({})
    } as any);

    await expect(EtaDocumentService.searchReceivedInvoices('comp-1')).rejects.toThrow(
      'الحساب غير مصرح له بالوصول إلى المستندات في منظومة مصلحة الضرائب.'
    );
  });

  it('8. should handle ETA HTTP 429 Rate Limit cleanly', async () => {
    vi.spyOn(pool, 'query').mockResolvedValue({
      rows: [
        {
          environment: 'preprod',
          client_id: 'client-1',
          client_secret: 'secret-1',
          is_configured: true
        }
      ]
    } as any);

    vi.spyOn(EtaAuthService, 'getValidAccessToken').mockResolvedValue('token');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({})
    } as any);

    await expect(EtaDocumentService.searchReceivedInvoices('comp-1')).rejects.toThrow(
      'تم تجاوز معدل الطلبات المسموح به من مصلحة الضرائب المصرية'
    );
  });

  it('9. should handle ETA HTTP 500 / 503 Server Error cleanly', async () => {
    vi.spyOn(pool, 'query').mockResolvedValue({
      rows: [
        {
          environment: 'preprod',
          client_id: 'client-1',
          client_secret: 'secret-1',
          is_configured: true
        }
      ]
    } as any);

    vi.spyOn(EtaAuthService, 'getValidAccessToken').mockResolvedValue('token');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({})
    } as any);

    await expect(EtaDocumentService.searchReceivedInvoices('comp-1')).rejects.toThrow(
      'خدمة مصلحة الضرائب المصرية (ETA) غير متاحة حالياً'
    );
  });

  it('10. should handle network timeout cleanly', async () => {
    vi.spyOn(pool, 'query').mockResolvedValue({
      rows: [
        {
          environment: 'preprod',
          client_id: 'client-1',
          client_secret: 'secret-1',
          is_configured: true
        }
      ]
    } as any);

    vi.spyOn(EtaAuthService, 'getValidAccessToken').mockResolvedValue('token');

    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';

    globalThis.fetch = vi.fn().mockRejectedValue(abortError);

    await expect(EtaDocumentService.searchReceivedInvoices('comp-1')).rejects.toThrow(
      'انتهت مهلة البحث عن المستندات'
    );
  });

  it('11. should NEVER expose client_secret or access_token in returned DTO or object', async () => {
    vi.spyOn(pool, 'query').mockResolvedValue({
      rows: [
        {
          environment: 'preprod',
          client_id: 'my-confidential-client-id',
          client_secret: 'super-confidential-secret-key-12345',
          is_configured: true
        }
      ]
    } as any);

    vi.spyOn(EtaAuthService, 'getValidAccessToken').mockResolvedValue('super-secret-jwt-token-999');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        result: [
          {
            uuid: 'doc-1',
            internalId: 'INV-1',
            issuerName: 'Supplier A',
            netAmount: 100,
            total: 114
          }
        ],
        metadata: { continuationToken: null }
      })
    } as any);

    const result = await EtaDocumentService.searchReceivedInvoices('comp-1');
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain('super-confidential-secret-key-12345');
    expect(serialized).not.toContain('super-secret-jwt-token-999');
    expect((result as any).client_secret).toBeUndefined();
    expect((result as any).access_token).toBeUndefined();
  });
});
