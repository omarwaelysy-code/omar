import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EtaDocumentService } from '../services/eta/EtaDocumentService';
import { EtaSupplierMappingService } from '../services/eta/EtaSupplierMappingService';
import { EtaAuthService } from '../services/eta/EtaAuthService';
import pool from '../lib/postgres';

describe('ETA Local-First Electronic Documents Architecture & Terminology Tests', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const mockSettingsRow = {
    environment: 'production',
    client_id: 'test-client-id',
    client_secret: 'test-client-secret',
    is_configured: true
  };

  const mockDocRow = {
    company_id: 'comp-100',
    uuid: 'eta-uuid-001',
    internal_id: 'INV-2026-001',
    type_name: 'I',
    document_type_name: 'فاتورة',
    direction: 'Received',
    issuer_id: '123456789',
    issuer_name: 'شركة النيل للتوريدات',
    issuer_address: 'القاهرة، مصر',
    issuer_type: 'B',
    receiver_id: '987654321',
    receiver_name: 'أوبرين للحلول البرمجية',
    receiver_address: 'الجيزة، مصر',
    receiver_type: 'B',
    date_time_issued: '2026-09-01T10:00:00Z',
    date_time_received: '2026-09-01T11:00:00Z',
    total_sales_amount: '1000',
    total_discount_amount: '50',
    net_amount: '950',
    tax_amount: '133',
    total_amount: '1083',
    currency: 'EGP',
    status: 'Valid',
    raw_data: JSON.stringify({
      invoiceLines: [
        {
          description: 'خادم حوسبة سحابية',
          itemCode: 'EG-1234',
          quantity: 2,
          unitPrice: 475,
          salesTotal: 950,
          discountAmount: 0,
          taxAmount: 133,
          lineTotal: 1083
        }
      ]
    }),
    last_synced_at: '2026-09-05T12:00:00Z'
  };

  // 1. Page Load does NOT call ETA
  it('1. Page load with forceRefresh: false queries PostgreSQL and does NOT call ETA fetch', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    vi.spyOn(pool, 'query').mockImplementation(async (sql: any, params: any) => {
      if (typeof sql === 'string' && sql.includes('eta_settings')) {
        return { rows: [mockSettingsRow] } as any;
      }
      if (typeof sql === 'string' && sql.includes('eta_documents')) {
        return { rows: [mockDocRow] } as any;
      }
      return { rows: [] } as any;
    });

    const res = await EtaDocumentService.fetchAllDocuments('comp-100', { forceRefresh: false });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res.success).toBe(true);
    expect(res.data.length).toBe(1);
    expect(res.data[0].uuid).toBe('eta-uuid-001');
  });

  // 2. Empty Database does NOT call ETA
  it('2. Empty Database with forceRefresh: false returns empty data and NEVER calls ETA', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    vi.spyOn(pool, 'query').mockImplementation(async (sql: any) => {
      if (typeof sql === 'string' && sql.includes('eta_settings')) {
        return { rows: [mockSettingsRow] } as any;
      }
      if (typeof sql === 'string' && sql.includes('eta_documents')) {
        return { rows: [] } as any; // DB is empty!
      }
      return { rows: [] } as any;
    });

    const res = await EtaDocumentService.fetchAllDocuments('comp-100', { forceRefresh: false });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res.success).toBe(true);
    expect(res.data).toEqual([]);
    expect(res.totalCount).toBe(0);
  });

  // 3. Refresh connects to ETA
  it('3. Refresh with forceRefresh: true connects to ETA via getValidAccessToken and search API', async () => {
    vi.spyOn(pool, 'query').mockImplementation(async (sql: any) => {
      if (typeof sql === 'string' && sql.includes('eta_settings')) {
        return { rows: [mockSettingsRow] } as any;
      }
      return { rows: [] } as any;
    });

    const tokenSpy = vi.spyOn(EtaAuthService, 'getValidAccessToken').mockResolvedValue('valid-test-token');
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        result: [
          {
            uuid: 'eta-uuid-fresh-1',
            internalId: 'INV-NEW-01',
            typeName: 'I',
            documentTypeName: 'فاتورة',
            dateTimeIssued: '2026-09-05T15:00:00Z',
            dateTimeReceived: '2026-09-05T15:30:00Z',
            totalSales: 2000,
            totalDiscount: 100,
            netAmount: 1900,
            taxAmount: 266,
            totalAmount: 2166,
            status: 'Valid'
          }
        ],
        metadata: { continuationToken: null }
      })
    });
    globalThis.fetch = fetchSpy;

    const res = await EtaDocumentService.fetchAllDocuments('comp-100', { forceRefresh: true, year: '2026' });

    expect(tokenSpy).toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalled();
    expect(res.success).toBe(true);
  });

  // 4. Details work strictly locally without ETA call
  it('4. getDocumentDetails reads from PostgreSQL eta_documents and does NOT call ETA fetch', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    vi.spyOn(pool, 'query').mockImplementation(async (sql: any, params: any) => {
      if (typeof sql === 'string' && sql.includes('eta_settings')) {
        return { rows: [mockSettingsRow] } as any;
      }
      if (typeof sql === 'string' && sql.includes('eta_documents')) {
        expect(params).toEqual(['comp-100', 'eta-uuid-001']);
        return { rows: [mockDocRow] } as any;
      }
      return { rows: [] } as any;
    });

    const res = await EtaDocumentService.getDocumentDetails('comp-100', 'eta-uuid-001');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res.success).toBe(true);
    expect(res.data.uuid).toBe('eta-uuid-001');
    expect(res.data.invoiceLines.length).toBe(1);
    expect(res.data.invoiceLines[0].description).toBe('خادم حوسبة سحابية');
    expect(res.data.totalAmount).toBe(1083);
  });

  // 5. Local Search & Period Filter works from PostgreSQL
  it('5. searchLocalDocuments applies period and text filters to PostgreSQL without calling ETA', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    let capturedSql = '';
    let capturedValues: any[] = [];

    vi.spyOn(pool, 'query').mockImplementation(async (sql: any, values: any) => {
      if (typeof sql === 'string' && sql.includes('eta_settings')) {
        return { rows: [mockSettingsRow] } as any;
      }
      if (typeof sql === 'string' && sql.includes('COUNT(*)')) {
        return { rows: [{ total: 1, last_synced: '2026-09-05T12:00:00Z' }] } as any;
      }
      if (typeof sql === 'string' && sql.includes('eta_documents')) {
        capturedSql = sql;
        capturedValues = values;
        return { rows: [mockDocRow] } as any;
      }
      return { rows: [] } as any;
    });

    const res = await EtaDocumentService.searchLocalDocuments('comp-100', {
      issueDateFrom: '2026-09-01T00:00:00Z',
      issueDateTo: '2026-09-05T23:59:59Z',
      search: 'النيل',
      status: 'Valid',
      pageSize: 20,
      page: 1
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(capturedSql).toContain('date_time_issued >= $');
    expect(capturedSql).toContain('date_time_issued <= $');
    expect(capturedSql).toContain('LOWER(status) = LOWER($');
    expect(capturedValues).toContain('comp-100');
    expect(res.success).toBe(true);
    expect(res.data.length).toBe(1);
    expect(res.pagination.totalCount).toBe(1);
  });

  // 6. Supplier Mapping does NOT call ETA when forceRefresh is false
  it('6. EtaSupplierMappingService.getSupplierMappings reads from PostgreSQL and does NOT call ETA on mount', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    vi.spyOn(pool, 'query').mockImplementation(async (sql: any) => {
      if (typeof sql === 'string' && sql.includes('eta_documents')) {
        return {
          rows: [
            {
              tax_number: '123456789',
              name: 'شركة النيل للتوريدات',
              address: 'القاهرة، مصر',
              doc_count: 5,
              total_amount: '5415',
              last_doc_date: '2026-09-01T10:00:00Z'
            }
          ]
        } as any;
      }
      if (typeof sql === 'string' && sql.includes('eta_supplier_mappings')) {
        return { rows: [] } as any;
      }
      if (typeof sql === 'string' && sql.includes('suppliers')) {
        return { rows: [] } as any;
      }
      return { rows: [] } as any;
    });

    const res = await EtaSupplierMappingService.getSupplierMappings('comp-100', { forceRefresh: false });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res.success).toBe(true);
    expect(res.suppliers.length).toBe(1);
    expect(res.suppliers[0].taxNumber).toBe('123456789');
    expect(res.suppliers[0].name).toBe('شركة النيل للتوريدات');
  });

  // 7. Background enrichment is disabled
  it('7. enrichDocumentsDetailsInBackground does not make ETA calls', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    await EtaDocumentService.enrichDocumentsDetailsInBackground('comp-100', ['uuid-1', 'uuid-2']);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // 8. Multi-tenancy company isolation is strictly enforced
  it('8. All queries strictly scope to company_id', async () => {
    const querySpy = vi.spyOn(pool, 'query').mockResolvedValue({ rows: [] } as any);

    await EtaDocumentService.searchLocalDocuments('comp-tenant-999', { pageSize: 10 });

    expect(querySpy).toHaveBeenCalledWith(
      expect.stringContaining('company_id = $1'),
      expect.arrayContaining(['comp-tenant-999'])
    );
  });
});
