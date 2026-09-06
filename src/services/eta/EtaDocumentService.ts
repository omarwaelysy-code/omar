/**
 * ETA (Egyptian Tax Authority / مصلحة الضرائب المصرية) Document Service
 * 
 * Official ETA e-Invoicing Document API integration:
 * - Search Documents: GET /api/v1.0/documents/search
 * - Document Details: GET /api/v1.0/documents/{uuid}/details
 * 
 * Architecture & Safety:
 * - Strictly READ-ONLY. No local invoices, journals, products, or suppliers are created or updated.
 * - Direction is locked to 'Received' and DocumentType defaults to 'i' (Invoices).
 * - Multi-Tenant: resolves credentials per company from database.
 * - Credentials & tokens are kept server-side and never exposed.
 * - Defensive mapping handles variations across ETA API environments.
 */

import pool from '../../lib/postgres';
import { EtaAuthService } from './EtaAuthService';
import { cleanDuplicatedPartnerName } from '../../utils/formatUtils';

export interface EtaSearchDocumentsParams {
  pageSize?: number;
  continuationToken?: string;
  issueDateFrom?: string;
  issueDateTo?: string;
  submissionDateFrom?: string;
  submissionDateTo?: string;
  status?: string;
  documentType?: string;
  direction?: string;
  uuid?: string;
  internalId?: string;
  issuerId?: string;
  receiverId?: string;
}

export interface EtaReceivedInvoiceDTO {
  uuid: string;
  submissionUuid?: string;
  longId?: string;
  internalId: string;
  typeName: string;
  documentTypeName: string;
  typeVersionName?: string;
  direction?: 'Sent' | 'Received';
  issuerId: string;
  issuerName: string;
  receiverId: string;
  receiverName: string;
  dateTimeIssued: string;
  dateTimeReceived: string;
  totalSales: number;
  totalDiscount: number;
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  status: string;
  cancelRequestDate?: string | null;
  rejectRequestDate?: string | null;
  address?: string;
  issuerAddress?: string;
  receiverAddress?: string;
}

export interface EtaSearchDocumentsResponse {
  success: boolean;
  isConfigured: boolean;
  environment: 'preprod' | 'production';
  data: EtaReceivedInvoiceDTO[];
  pagination: {
    pageSize: number;
    continuationToken?: string | null;
    totalPages?: number;
    totalCount?: number;
  };
  filterSummary?: {
    direction: 'Received';
    documentType: string;
    issueDateFrom: string;
    issueDateTo: string;
  };
}

export interface EtaDetailedInvoiceLineDTO {
  rowKey: string;
  uuid: string;
  internalId: string;
  direction: 'Sent' | 'Received';
  typeName: string;
  documentTypeName: string;
  partnerName: string;
  taxId: string;
  address: string;
  dateTimeIssued: string;
  dateTimeReceived: string;
  currency: string;
  status: string;
  longId?: string;

  // Item details
  itemCodeName: string;
  itemCode: string;
  itemType: string;
  description: string;
  quantity: number;
  unitType: string;
  unitPrice: number;
  salesTotal: number;
  discountAmount: number;
  taxAmount: number;
  lineTotal: number;
}

export class EtaDocumentService {
  // Official ETA API Base URLs
  public static readonly PREPROD_API_URL = 'https://api.preprod.invoicing.eta.gov.eg';
  public static readonly PRODUCTION_API_URL = 'https://api.invoicing.eta.gov.eg';

  public static getApiBaseUrl(environment: 'preprod' | 'production' = 'preprod'): string {
    return environment === 'production'
      ? this.PRODUCTION_API_URL
      : this.PREPROD_API_URL;
  }

  /**
   * Fetch ETA settings for the given company from DB
   */
  public static async getCompanySettings(companyId: string): Promise<{
    environment: 'preprod' | 'production';
    clientId: string;
    clientSecret: string;
    isConfigured: boolean;
  } | null> {
    const res = await pool.query(
      `SELECT environment, client_id, client_secret, is_configured 
       FROM eta_settings 
       WHERE company_id = $1`,
      [companyId]
    );

    if (res.rows.length === 0) {
      return null;
    }

    const row = res.rows[0];
    const environment = row.environment === 'production' ? 'production' : 'preprod';
    const clientId = String(row.client_id || '').trim();
    const clientSecret = String(row.client_secret || '').trim();
    // Company is configured for ETA operations if both Client ID and Client Secret are present
    const isConfigured = Boolean(clientId && clientSecret);

    return {
      environment,
      clientId,
      clientSecret,
      isConfigured
    };
  }

  /**
   * Search Received Invoices from ETA
   */
  public static async searchReceivedInvoices(
    companyId: string,
    params: EtaSearchDocumentsParams = {}
  ): Promise<EtaSearchDocumentsResponse> {
    // 1. Resolve company settings
    const settings = await this.getCompanySettings(companyId);
    if (!settings || !settings.isConfigured) {
      return {
        success: false,
        isConfigured: false,
        environment: settings?.environment || 'preprod',
        data: [],
        pagination: {
          pageSize: params.pageSize || 20,
          continuationToken: null
        }
      };
    }

    const { environment, clientId, clientSecret } = settings;

    // 2. Prepare default date range if not specified (default: last 30 days)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const issueDateFrom = params.issueDateFrom?.trim() || thirtyDaysAgo.toISOString();
    const issueDateTo = params.issueDateTo?.trim() || now.toISOString();

    // 3. Acquire valid access token
    let token = await EtaAuthService.getValidAccessToken({
      companyId,
      environment,
      clientId,
      clientSecret
    });

    // 4. Build query parameters according to official ETA Search Documents API
    const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 20));
    const query = new URLSearchParams({
      pageSize: pageSize.toString(),
      issueDateFrom,
      issueDateTo
    });

    const dirParam = params.direction?.trim();
    if (dirParam && dirParam.toLowerCase() !== 'all') {
      query.set('direction', dirParam);
    }
    // Note: When direction is 'all' or omitted, we do NOT pass 'direction' to ETA.
    // Official ETA Search API returns BOTH Received and Sent documents in a single request.

    if (params.documentType?.trim() && params.documentType.trim().toLowerCase() !== 'all') {
      query.set('documentType', params.documentType.trim());
    }

    if (params.continuationToken?.trim()) {
      query.set('continuationToken', params.continuationToken.trim());
    }

    if (params.status?.trim() && params.status !== 'all' && params.status !== 'ALL') {
      query.set('status', params.status.trim());
    }

    if (params.submissionDateFrom?.trim()) {
      query.set('submissionDateFrom', params.submissionDateFrom.trim());
    }

    if (params.submissionDateTo?.trim()) {
      query.set('submissionDateTo', params.submissionDateTo.trim());
    }

    if (params.issuerId?.trim()) {
      query.set('issuerId', params.issuerId.trim());
    }

    if (params.receiverId?.trim()) {
      query.set('receiverId', params.receiverId.trim());
    }

    if (params.internalId?.trim()) {
      query.set('internalId', params.internalId.trim());
    }

    if (params.uuid?.trim()) {
      query.set('uuid', params.uuid.trim());
    }

    const apiUrl = `${this.getApiBaseUrl(environment)}/api/v1.0/documents/search?${query.toString()}`;

    // 5. Execute request with retry on 401
    let response = await this.executeSearchFetch(apiUrl, token);

    if (response.status === 401) {
      // Clear token and retry once with a fresh token
      EtaAuthService.clearCache(companyId, environment);
      token = await EtaAuthService.getValidAccessToken({
        companyId,
        environment,
        clientId,
        clientSecret,
        forceRefresh: true
      });
      response = await this.executeSearchFetch(apiUrl, token);
    }

    // 6. Handle HTTP response errors
    if (!response.ok) {
      this.handleEtaHttpError(response.status);
    }

    const rawData = await response.json().catch(() => ({}));

    // 7. Defensive data extraction & mapping
    const rawList: any[] = Array.isArray(rawData?.result)
      ? rawData.result
      : Array.isArray(rawData?.documents)
        ? rawData.documents
        : Array.isArray(rawData)
          ? rawData
          : [];

    const mappedDocuments: EtaReceivedInvoiceDTO[] = rawList.map(item => this.mapDocumentSummary(item));
    await this.enrichWithPartnerAddresses(companyId, mappedDocuments);

    // 8. Extract continuation token and pagination info
    const continuationToken =
      rawData?.metadata?.continuationToken ||
      rawData?.continuationToken ||
      null;

    const totalCount = typeof rawData?.metadata?.totalCount === 'number'
      ? rawData.metadata.totalCount
      : (typeof rawData?.totalCount === 'number' ? rawData.totalCount : undefined);

    const totalPages = typeof rawData?.metadata?.totalPages === 'number'
      ? rawData.metadata.totalPages
      : undefined;

    return {
      success: true,
      isConfigured: true,
      environment,
      data: mappedDocuments,
      pagination: {
        pageSize,
        continuationToken,
        totalCount,
        totalPages
      },
      filterSummary: {
        direction: (params.direction || 'Received') as any,
        documentType: params.documentType?.trim() || 'all',
        issueDateFrom,
        issueDateTo
      }
    };
  }


  /**
   * Load saved ETA documents from PostgreSQL eta_documents table
   */
  public static async getDocumentsFromDatabase(companyId: string): Promise<{ data: EtaReceivedInvoiceDTO[]; lastSyncedAt: string | null }> {
    if (!companyId) return { data: [], lastSyncedAt: null };
    try {
      const res = await pool.query(
        `SELECT * FROM eta_documents WHERE company_id = $1 ORDER BY date_time_issued DESC`,
        [companyId]
      );
      if (!res.rows || res.rows.length === 0) {
        return { data: [], lastSyncedAt: null };
      }
      let lastSyncedAt: string | null = null;
      const data: EtaReceivedInvoiceDTO[] = res.rows.map(row => {
        if (!lastSyncedAt && row.last_synced_at) {
          lastSyncedAt = new Date(row.last_synced_at).toISOString();
        }
        return {
          uuid: row.uuid,
          submissionUuid: row.submission_uuid || undefined,
          longId: row.long_id || undefined,
          internalId: row.internal_id,
          typeName: row.type_name || 'I',
          documentTypeName: row.document_type_name || 'فاتورة',
          typeVersionName: row.document_type_version || '1.0',
          direction: row.direction as any,
          status: row.status || 'Valid',
          dateTimeIssued: row.date_time_issued ? new Date(row.date_time_issued).toISOString() : '',
          dateTimeReceived: row.date_time_received ? new Date(row.date_time_received).toISOString() : '',
          totalSales: Number(row.total_sales_amount || 0),
          totalDiscount: Number(row.total_discount_amount || 0),
          netAmount: Number(row.net_amount || 0),
          taxAmount: Number(row.tax_amount || 0),
          totalAmount: Number(row.total_amount || 0),
          currency: row.currency || 'EGP',
          issuerId: row.issuer_id || '',
          issuerName: row.issuer_name || '',
          issuerAddress: row.issuer_address || '',
          receiverId: row.receiver_id || '',
          receiverName: row.receiver_name || '',
          receiverAddress: row.receiver_address || '',
          address: (row.direction === 'Sent' ? row.receiver_address : row.issuer_address) || row.issuer_address || row.receiver_address || ''
        };
      });
      return { data, lastSyncedAt };
    } catch (e: any) {
      console.warn('[ETA DB] Error loading documents from database:', e.message || e);
      return { data: [], lastSyncedAt: null };
    }
  }

  /**
   * Batch upsert documents to PostgreSQL eta_documents table
   */
  public static async saveDocumentsToDatabase(companyId: string, docs: EtaReceivedInvoiceDTO[]): Promise<number> {
    if (!companyId || !docs || docs.length === 0) return 0;
    let savedCount = 0;
    for (const doc of docs) {
      if (!doc.uuid) continue;
      try {
        const docId = `eta_${companyId}_${doc.uuid}`.slice(0, 250);
        await pool.query(
          `INSERT INTO eta_documents (
            id, company_id, uuid, submission_uuid, long_id, internal_id,
            type_name, document_type_name, document_type_version, direction,
            status, date_time_issued, date_time_received,
            issuer_id, issuer_name, issuer_type, issuer_address,
            receiver_id, receiver_name, receiver_type, receiver_address,
            total_sales_amount, total_discount_amount, net_amount, tax_amount, total_amount,
            extra_discount_amount, total_items_discount_amount, currency, raw_data,
            last_synced_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10,
            $11, $12, $13,
            $14, $15, $16, $17,
            $18, $19, $20, $21,
            $22, $23, $24, $25, $26,
            $27, $28, $29, $30,
            NOW(), NOW()
          )
          ON CONFLICT (company_id, uuid) DO UPDATE SET
            id = EXCLUDED.id,
            long_id = COALESCE(EXCLUDED.long_id, eta_documents.long_id),
            internal_id = COALESCE(NULLIF(EXCLUDED.internal_id, ''), eta_documents.internal_id),
            status = EXCLUDED.status,
            type_name = EXCLUDED.type_name,
            document_type_name = EXCLUDED.document_type_name,
            issuer_name = COALESCE(EXCLUDED.issuer_name, eta_documents.issuer_name),
            receiver_name = COALESCE(EXCLUDED.receiver_name, eta_documents.receiver_name),
            issuer_address = COALESCE(NULLIF(EXCLUDED.issuer_address, ''), eta_documents.issuer_address),
            receiver_address = COALESCE(NULLIF(EXCLUDED.receiver_address, ''), eta_documents.receiver_address),
            total_sales_amount = EXCLUDED.total_sales_amount,
            total_discount_amount = EXCLUDED.total_discount_amount,
            net_amount = EXCLUDED.net_amount,
            tax_amount = EXCLUDED.tax_amount,
            total_amount = EXCLUDED.total_amount,
            raw_data = CASE 
              WHEN eta_documents.raw_data IS NOT NULL AND (eta_documents.raw_data::text LIKE '%invoiceLines%') AND NOT (EXCLUDED.raw_data::text LIKE '%invoiceLines%')
              THEN eta_documents.raw_data
              ELSE COALESCE(EXCLUDED.raw_data, eta_documents.raw_data)
            END,
            last_synced_at = NOW(),
            updated_at = NOW()`,
          [
            docId,
            companyId,
            String(doc.uuid).slice(0, 250),
            doc.submissionUuid ? String(doc.submissionUuid).slice(0, 250) : null,
            doc.longId ? String(doc.longId) : null,
            doc.internalId ? String(doc.internalId).slice(0, 250) : '',
            doc.typeName || 'I',
            doc.documentTypeName || 'فاتورة',
            doc.typeVersionName || '1.0',
            doc.direction || 'Received',
            doc.status || 'Valid',
            doc.dateTimeIssued ? new Date(doc.dateTimeIssued) : null,
            doc.dateTimeReceived ? new Date(doc.dateTimeReceived) : null,
            doc.issuerId ? String(doc.issuerId).slice(0, 50) : null,
            doc.issuerName || null,
            null,
            doc.issuerAddress || doc.address || null,
            doc.receiverId ? String(doc.receiverId).slice(0, 50) : null,
            doc.receiverName || null,
            null,
            doc.receiverAddress || null,
            Number(doc.totalSales) || 0,
            Number(doc.totalDiscount) || 0,
            Number(doc.netAmount) || 0,
            Number(doc.taxAmount) || 0,
            Number(doc.totalAmount) || 0,
            0,
            0,
            doc.currency || 'EGP',
            JSON.stringify(doc)
          ]
        );
        savedCount++;
      } catch (docErr: any) {
        console.warn(`[ETA Save] Error saving document ${doc.uuid}:`, docErr.message || docErr);
      }
    }
    return savedCount;
  }

  private static portalCache: Map<string, { timestamp: number; data: EtaReceivedInvoiceDTO[]; lastSyncedAt?: string }> = new Map();
  private static CACHE_TTL_MS = 10 * 60 * 1000;

  /**
   * Fetch all documents across multi-month periods (Full Sync with Persistent DB Storage & Fast Fallback)
   */
  public static async fetchAllDocuments(
    companyId: string,
    options: {
      year?: string | number;
      direction?: string;
      documentType?: string;
      status?: string;
      forceRefresh?: boolean;
    } = {}
  ): Promise<{
    success: boolean;
    isConfigured: boolean;
    environment: 'preprod' | 'production';
    data: EtaReceivedInvoiceDTO[];
    totalCount: number;
    lastSyncedAt?: string | null;
    syncedCount?: number;
  }> {
    const settings = await this.getCompanySettings(companyId);
    if (!settings || !settings.isConfigured) {
      // If unconfigured or unlinked, check if there are previously registered documents in PostgreSQL
      const dbResult = await this.getDocumentsFromDatabase(companyId);
      if (dbResult.data && dbResult.data.length > 0) {
        let filtered = dbResult.data || [];
        if (options.year && options.year !== 'all') {
          filtered = filtered.filter(d => (d.dateTimeIssued || '').slice(0, 4) === String(options.year));
        }
        if (options.direction && options.direction !== 'all') {
          filtered = filtered.filter(d => d.direction === options.direction);
        }
        if (options.documentType && options.documentType !== 'all') {
          filtered = filtered.filter(d => String(d.typeName || '').toLowerCase() === options.documentType.toLowerCase());
        }
        if (options.status && options.status !== 'all') {
          filtered = filtered.filter(d => d.status === options.status);
        }
        return {
          success: true,
          isConfigured: false,
          environment: settings?.environment || 'preprod',
          data: filtered,
          totalCount: filtered.length,
          lastSyncedAt: dbResult.lastSyncedAt
        };
      }

      return {
        success: false,
        isConfigured: false,
        environment: settings?.environment || 'preprod',
        data: [],
        totalCount: 0
      };
    }

    const targetYear = options.year ? String(options.year) : 'all';
    const currentYear = new Date().getFullYear();

    // 1. LOCAL-FIRST: If not forcing refresh, always return PostgreSQL persistent storage records
    // (Never contact ETA on page load or empty database; empty DB returns empty state)
    if (!options.forceRefresh) {
      const dbResult = await this.getDocumentsFromDatabase(companyId);
      let filtered = dbResult.data || [];
      if (filtered.length > 0) {
        if (options.year && options.year !== 'all') {
          filtered = filtered.filter(d => (d.dateTimeIssued || '').slice(0, 4) === String(options.year));
        }
        if (options.direction && options.direction !== 'all') {
          filtered = filtered.filter(d => d.direction === options.direction);
        }
        if (options.documentType && options.documentType !== 'all') {
          filtered = filtered.filter(d => String(d.typeName || '').toLowerCase() === options.documentType.toLowerCase());
        }
        if (options.status && options.status !== 'all') {
          filtered = filtered.filter(d => d.status === options.status);
        }
      }
      return {
        success: true,
        isConfigured: true,
        environment: settings.environment,
        data: filtered,
        totalCount: filtered.length,
        lastSyncedAt: dbResult.lastSyncedAt
      };
    }

    // 2. Refresh-Only: Perform fresh multi-period sync directly from ETA Tax Authority servers
    const windows: { from: string; to: string }[] = [];
    const pad = (n: number) => (n < 10 ? '0' + n : String(n));

    const addYearWindows = (yr: number, startMonth = 12, endMonth = 1) => {
      for (let m = startMonth; m >= endMonth; m--) {
        const daysInMonth = new Date(yr, m, 0).getDate();
        windows.push({
          from: `${yr}-${pad(m)}-01T00:00:00Z`,
          to: `${yr}-${pad(m)}-${pad(daysInMonth)}T23:59:59Z`
        });
      }
    };

    if (targetYear === 'all') {
      for (let yr = currentYear; yr >= 2022; yr--) {
        const startMonth = (yr === currentYear) ? new Date().getMonth() + 1 : 12;
        const endMonth = 1;
        addYearWindows(yr, startMonth, endMonth);
      }
    } else {
      const yr = Number(targetYear) || currentYear;
      const startMonth = (yr === currentYear) ? new Date().getMonth() + 1 : 12;
      const endMonth = 1;
      addYearWindows(yr, startMonth, endMonth);
    }

    const docMap = new Map<string, EtaReceivedInvoiceDTO>();
    const queryDirection =
      options.direction && options.direction.toLowerCase() !== 'all'
        ? options.direction
        : undefined;

    for (const win of windows) {
      let continuationToken: string | undefined = undefined;
      let hasMore = true;

      while (hasMore) {
        try {
          const res = await this.searchReceivedInvoices(companyId, {
            issueDateFrom: win.from,
            issueDateTo: win.to,
            direction: queryDirection,
            documentType: options.documentType,
            status: options.status,
            continuationToken,
            pageSize: 100
          });

          if (res.data && res.data.length > 0) {
            for (const doc of res.data) {
              docMap.set(doc.uuid, doc);
            }
          }

          const nextTok = res.pagination?.continuationToken;
          if (nextTok && nextTok !== 'EndofResultSet' && nextTok !== continuationToken) {
            continuationToken = nextTok;
          } else {
            hasMore = false;
          }
        } catch (err: any) {
          console.warn(`[ETA Multi-Period Fetch] Window ${win.from} - ${win.to} skipped:`, err?.message || err);
          hasMore = false;
        }

        await new Promise(resolve => setTimeout(resolve, 180));
      }
    }

    const allDocs = Array.from(docMap.values());
    allDocs.sort((a, b) => new Date(b.dateTimeIssued).getTime() - new Date(a.dateTimeIssued).getTime());

    // Enrich with cached or local database partner addresses
    await this.enrichWithPartnerAddresses(companyId, allDocs);

    // 3. Save all synced documents into PostgreSQL eta_documents table permanently
    const savedCount = await this.saveDocumentsToDatabase(companyId, allDocs);

    const nowIso = new Date().toISOString();
    const cacheKey = `${companyId}_${targetYear}_${options.direction || 'all'}_${options.documentType || 'all'}_${options.status || 'all'}`;
    this.portalCache.set(cacheKey, {
      timestamp: Date.now(),
      data: allDocs,
      lastSyncedAt: nowIso
    });

    // Note: Automatic background ETA sync/enrichment is strictly disabled per local-first policy.
    // Address enrichment is performed locally from cached partner data without live ETA requests.

    return {
      success: true,
      isConfigured: true,
      environment: settings.environment,
      data: allDocs,
      totalCount: allDocs.length,
      lastSyncedAt: nowIso,
      syncedCount: savedCount
    };
  }

  private static isEnrichingDetails = false;

  /**
   * Background enricher is disabled per local-first policy to prevent automatic ETA calls
   */
  public static async enrichDocumentsDetailsInBackground(_companyId: string, _uuids: string[]): Promise<void> {
    // Disabled: No automatic background calls to ETA
    return;
  }

  /**
   * Fetch flattened detailed invoice lines across all documents
   */
  public static async getDetailedDocumentLines(
    companyId: string,
    options: {
      year?: string;
      direction?: string;
      documentType?: string;
      status?: string;
      forceRefresh?: boolean;
    } = {}
  ): Promise<{
    success: boolean;
    isConfigured: boolean;
    environment: 'preprod' | 'production';
    data: EtaDetailedInvoiceLineDTO[];
    totalCount: number;
    lastSyncedAt?: string | null;
  }> {
    const settings = await this.getCompanySettings(companyId);
    const isConfigured = Boolean(settings && settings.isConfigured);

    // If forceRefresh requested and integration is configured, sync all documents from ETA portal
    if (options.forceRefresh && isConfigured) {
      await this.fetchAllDocuments(companyId, { forceRefresh: true });
    }

    const res = await pool.query(
      `SELECT * FROM eta_documents WHERE company_id = $1 ORDER BY date_time_issued DESC`,
      [companyId]
    );

    let lastSyncedAt: string | null = null;
    const lines: EtaDetailedInvoiceLineDTO[] = [];

    for (const row of res.rows) {
      if (!lastSyncedAt && row.last_synced_at) {
        lastSyncedAt = new Date(row.last_synced_at).toISOString();
      }

      let rawDataObj: any = null;
      if (row.raw_data) {
        try {
          rawDataObj = typeof row.raw_data === 'string' ? JSON.parse(row.raw_data) : row.raw_data;
        } catch {}
      }

      const partnerName = row.direction === 'Sent'
        ? (row.receiver_name || row.issuer_name || 'عميل غير محدد')
        : (row.issuer_name || row.receiver_name || 'مورد غير محدد');

      const taxId = row.direction === 'Sent'
        ? (row.receiver_id || row.issuer_id || '-')
        : (row.issuer_id || row.receiver_id || '-');

      const address = (row.direction === 'Sent' ? row.receiver_address : row.issuer_address) ||
        row.issuer_address ||
        row.receiver_address ||
        '-';

      const baseDocInfo = {
        uuid: row.uuid,
        internalId: row.internal_id,
        direction: (row.direction || 'Received') as 'Sent' | 'Received',
        typeName: row.type_name || 'I',
        documentTypeName: row.document_type_name || 'فاتورة',
        partnerName,
        taxId,
        address,
        dateTimeIssued: row.date_time_issued ? new Date(row.date_time_issued).toISOString() : '',
        dateTimeReceived: row.date_time_received ? new Date(row.date_time_received).toISOString() : '',
        currency: row.currency || 'EGP',
        status: row.status || 'Valid',
        longId: row.long_id || undefined
      };

      const rawLines: any[] = Array.isArray(rawDataObj?.invoiceLines)
        ? rawDataObj.invoiceLines
        : (Array.isArray(rawDataObj?.details?.invoiceLines)
            ? rawDataObj.details.invoiceLines
            : (Array.isArray(rawDataObj?.rawDocument?.invoiceLines) ? rawDataObj.rawDocument.invoiceLines : []));

      if (rawLines.length > 0) {
        rawLines.forEach((l, idx) => {
          const itemCodeName = l.itemCodeName || l.itemPrimaryName || l.itemSecondaryName || '---';
          const itemCode = l.itemCode || '---';
          const itemType = l.itemType || 'EGS';
          const description = l.description || l.itemPrimaryName || '---';
          const quantity = Number(l.quantity ?? 1);
          const unitType = l.unitType || '';
          const unitPrice = Number(l.unitPrice ?? (l.unitValue?.amountEGP || l.unitValue?.amountSold || 0));
          const salesTotal = Number(l.salesTotal ?? (quantity * unitPrice));
          const discountAmount = Number(l.discountAmount ?? (l.itemsDiscount || l.discount?.amount || 0));
          const taxAmount = Number(l.taxAmount ?? (Array.isArray(l.taxesList) ? l.taxesList.reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0) : 0));
          const lineTotal = Number(l.lineTotal ?? l.total ?? (salesTotal - discountAmount + taxAmount));

          lines.push({
            ...baseDocInfo,
            rowKey: `${row.uuid}_${idx}`,
            itemCodeName,
            itemCode,
            itemType,
            description,
            quantity,
            unitType,
            unitPrice,
            salesTotal,
            discountAmount,
            taxAmount,
            lineTotal
          });
        });
      } else {
        // Fallback: 1 line with document totals
        lines.push({
          ...baseDocInfo,
          rowKey: `${row.uuid}_0`,
          itemCodeName: '---',
          itemCode: '---',
          itemType: 'EGS',
          description: row.document_type_name || 'وثيقة إلكترونية',
          quantity: 1,
          unitType: '',
          unitPrice: Number(row.net_amount || 0),
          salesTotal: Number(row.total_sales_amount || row.net_amount || 0),
          discountAmount: Number(row.total_discount_amount || 0),
          taxAmount: Number(row.tax_amount || 0),
          lineTotal: Number(row.total_amount || 0)
        });
      }
    }

    if (lines.length === 0 && !isConfigured) {
      return {
        success: false,
        isConfigured: false,
        environment: settings?.environment || 'preprod',
        data: [],
        totalCount: 0
      };
    }

    return {
      success: true,
      isConfigured,
      environment: settings?.environment || 'preprod',
      data: lines,
      totalCount: lines.length,
      lastSyncedAt
    };
  }

  /**
   * Get Document Details strictly from PostgreSQL eta_documents (Local-First).
   * Zero external calls to ETA API.
   */
  public static async getDocumentDetails(
    companyId: string,
    documentUuid: string
  ): Promise<{ success: boolean; data: any }> {
    const settings = await this.getCompanySettings(companyId);
    const environment = settings?.environment || 'production';

    // 1. Fetch document record from PostgreSQL
    const res = await pool.query(
      `SELECT * FROM eta_documents WHERE company_id = $1 AND uuid = $2`,
      [companyId, documentUuid]
    );

    if (res.rows.length === 0) {
      const err = new Error('الوثيقة الإلكترونية غير موجودة في قاعدة البيانات المحلية.');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    const row = res.rows[0];

    // 2. Parse stored raw_data if available
    let rawDataObj: any = null;
    if (row.raw_data) {
      try {
        rawDataObj = typeof row.raw_data === 'string' ? JSON.parse(row.raw_data) : row.raw_data;
      } catch {}
    }

    // 3. Format address and type helpers
    const formatAddr = (addr: any) => {
      if (!addr) return '';
      if (typeof addr === 'string') return addr.trim();
      const parts = [
        addr.buildingNumber,
        addr.street,
        addr.regionCity,
        addr.city,
        addr.governate,
        addr.governorate,
        addr.country
      ].map((p: any) => (p ? String(p).trim() : '')).filter(Boolean);
      const uniqueParts: string[] = [];
      for (const p of parts) {
        if (!uniqueParts.includes(p)) uniqueParts.push(p);
      }
      return uniqueParts.join('، ');
    };

    const formatPartnerType = (type: any) => {
      const t = String(type ?? '').toUpperCase().trim();
      if (t === 'B' || t === '0' || t === 'BUSINESS' || t === 'COMPANY') return 'شركة';
      if (t === 'P' || t === '1' || t === 'PERSON' || t === 'INDIVIDUAL') return 'فرد';
      if (t === 'F' || t === '2' || t === 'FOREIGNER') return 'أجنبي';
      return 'شركة';
    };

    const issuerObj = rawDataObj?.issuer || {
      id: row.issuer_id,
      name: row.issuer_name,
      address: row.issuer_address,
      type: row.issuer_type
    };

    const receiverObj = rawDataObj?.receiver || {
      id: row.receiver_id,
      name: row.receiver_name,
      address: row.receiver_address,
      type: row.receiver_type
    };

    const issuerAddress = formatAddr(issuerObj.address) || row.issuer_address || '';
    const receiverAddress = formatAddr(receiverObj.address) || row.receiver_address || '';
    const issuerType = formatPartnerType(issuerObj.type || row.issuer_type);
    const receiverType = formatPartnerType(receiverObj.type || row.receiver_type);

    // 4. Extract or synthesize invoice lines
    const parsedRawDoc = rawDataObj?.rawDocument || rawDataObj?.document || rawDataObj;
    const rawLines = Array.isArray(parsedRawDoc?.invoiceLines)
      ? parsedRawDoc.invoiceLines
      : (Array.isArray(rawDataObj?.invoiceLines) ? rawDataObj.invoiceLines : []);
    const detailsLines = Array.isArray(rawDataObj?.details?.invoiceLines) ? rawDataObj.details.invoiceLines : [];
    const baseLines = detailsLines.length > 0 ? detailsLines : rawLines;

    let normalizedLines: any[] = [];
    if (baseLines.length > 0) {
      normalizedLines = baseLines.map((line: any, idx: number) => {
        const matchingRaw = rawLines[idx] || {};
        const description = line.description || matchingRaw.description || line.itemPrimaryName || '---';
        const itemCodeName = line.itemPrimaryName || line.itemSecondaryName || matchingRaw.itemPrimaryName || '---';
        const itemCode = line.itemCode || matchingRaw.itemCode || '---';
        const itemType = line.itemType || matchingRaw.itemType || 'EGS';
        const unitType = line.unitType || matchingRaw.unitType || '';
        const quantity = Number(line.quantity ?? matchingRaw.quantity ?? 1);
        const unitPrice = Number(
          line.unitValue?.amountEGP ||
          matchingRaw.unitValue?.amountEGP ||
          line.unitValue?.amountSold ||
          matchingRaw.unitValue?.amountSold ||
          line.unitPrice ||
          matchingRaw.unitPrice ||
          0
        );
        const salesTotal = Number(line.salesTotal ?? matchingRaw.salesTotal ?? (quantity * unitPrice));
        const discountAmount = Number(
          line.itemsDiscount ??
          matchingRaw.itemsDiscount ??
          line.discount?.amount ??
          matchingRaw.discount?.amount ??
          0
        );

        let taxesList = Array.isArray(line.lineTaxableItems) && line.lineTaxableItems.length > 0
          ? line.lineTaxableItems
          : (Array.isArray(matchingRaw.taxableItems) && matchingRaw.taxableItems.length > 0 ? matchingRaw.taxableItems : []);

        const taxAmount = taxesList.reduce((acc: number, t: any) => acc + (Number(t.amount) || 0), 0);
        const lineTotal = Number(
          line.total ??
          matchingRaw.total ??
          line.netTotal ??
          matchingRaw.netTotal ??
          (salesTotal - discountAmount + taxAmount)
        );

        return {
          ...matchingRaw,
          ...line,
          description,
          itemCodeName,
          itemCode,
          itemType,
          unitType,
          quantity,
          unitPrice,
          salesTotal,
          discountAmount,
          taxAmount,
          taxesList,
          lineTotal
        };
      });
    } else {
      // Fallback from document headers if detailed lines are not in raw_data
      normalizedLines = [{
        description: row.document_type_name || 'وثيقة إلكترونية',
        itemCode: '---',
        itemCodeName: row.document_type_name || '---',
        itemType: 'EGS',
        unitType: '',
        quantity: 1,
        unitPrice: Number(row.net_amount || 0),
        salesTotal: Number(row.total_sales_amount || row.net_amount || 0),
        discountAmount: Number(row.total_discount_amount || 0),
        taxAmount: Number(row.tax_amount || 0),
        lineTotal: Number(row.total_amount || 0),
        taxesList: []
      }];
    }

    const portalHost = environment === 'production' ? 'invoicing.eta.gov.eg' : 'preprod.invoicing.eta.gov.eg';
    const longId = row.long_id || rawDataObj?.longId || rawDataObj?.document?.longId;
    const shareUrl =
      rawDataObj?.publicUrl ||
      rawDataObj?.shareUrl ||
      (longId
        ? `https://${portalHost}/documents/${encodeURIComponent(documentUuid)}/share/${longId}`
        : `https://${portalHost}/documents/${encodeURIComponent(documentUuid)}`);

    const mergedData = {
      ...rawDataObj,
      rawDocument: parsedRawDoc || rawDataObj,
      details: rawDataObj?.details || rawDataObj,
      uuid: documentUuid,
      internalId: row.internal_id,
      typeName: row.type_name,
      documentTypeName: row.document_type_name,
      typeVersionName: row.type_version_name,
      direction: row.direction,
      dateTimeIssued: row.date_time_issued ? new Date(row.date_time_issued).toISOString() : '',
      dateTimeReceived: row.date_time_received ? new Date(row.date_time_received).toISOString() : '',
      currency: row.currency || 'EGP',
      status: row.status || 'Valid',
      longId: longId || undefined,
      shareUrl,
      publicUrl: shareUrl,
      environment,
      portalHost,
      issuer: {
        ...issuerObj,
        name: cleanDuplicatedPartnerName(issuerObj.name || row.issuer_name),
        id: issuerObj.id || row.issuer_id,
        type: issuerType,
        typeName: issuerType,
        address: issuerObj.address || issuerAddress
      },
      receiver: {
        ...receiverObj,
        name: cleanDuplicatedPartnerName(receiverObj.name || row.receiver_name),
        id: receiverObj.id || row.receiver_id,
        type: receiverType,
        typeName: receiverType,
        address: receiverObj.address || receiverAddress
      },
      issuerAddress,
      receiverAddress,
      issuerType,
      receiverType,
      invoiceLines: normalizedLines,
      taxTotals: rawDataObj?.taxTotals || parsedRawDoc?.taxTotals || [],
      signatures: rawDataObj?.signatures || parsedRawDoc?.signatures || [],
      taxpayerActivityCode:
        rawDataObj?.taxpayerActivityCode ||
        parsedRawDoc?.taxpayerActivityCode ||
        issuerObj?.activityCode ||
        '---',
      totalSalesAmount: Number(row.total_sales_amount || rawDataObj?.totalSalesAmount || rawDataObj?.totalSales || 0),
      totalDiscountAmount: Number(row.total_discount_amount || rawDataObj?.totalDiscountAmount || rawDataObj?.totalDiscount || 0),
      netAmount: Number(row.net_amount || rawDataObj?.netAmount || 0),
      taxAmount: Number(row.tax_amount || 0),
      totalAmount: Number(row.total_amount || rawDataObj?.totalAmount || rawDataObj?.total || 0),
      extraDiscountAmount: Number(row.extra_discount_amount || rawDataObj?.extraDiscountAmount || 0)
    };

    return { success: true, data: mergedData };
  }

  /**
   * Search saved electronic documents strictly from PostgreSQL eta_documents (Local-First).
   * Zero external ETA API calls.
   */
  public static async searchLocalDocuments(
    companyId: string,
    params: {
      pageSize?: number;
      page?: number;
      direction?: string;
      documentType?: string;
      status?: string;
      issueDateFrom?: string;
      issueDateTo?: string;
      submissionDateFrom?: string;
      submissionDateTo?: string;
      internalId?: string;
      issuerId?: string;
      uuid?: string;
      search?: string;
    } = {}
  ): Promise<{
    success: boolean;
    isConfigured: boolean;
    environment: 'preprod' | 'production';
    data: EtaReceivedInvoiceDTO[];
    pagination: {
      pageSize: number;
      currentPage: number;
      totalPages: number;
      totalCount: number;
      continuationToken: null;
    };
    lastSyncedAt?: string | null;
  }> {
    const settings = await this.getCompanySettings(companyId);

    const conditions: string[] = ['company_id = $1'];
    const values: any[] = [companyId];
    let idx = 2;

    if (params.direction && params.direction !== 'all') {
      conditions.push(`direction = $${idx++}`);
      values.push(params.direction);
    }

    if (params.documentType && params.documentType !== 'all') {
      conditions.push(`LOWER(type_name) = LOWER($${idx++})`);
      values.push(params.documentType);
    }

    if (params.status && params.status !== 'all') {
      conditions.push(`LOWER(status) = LOWER($${idx++})`);
      values.push(params.status);
    }

    if (params.issueDateFrom) {
      conditions.push(`date_time_issued >= $${idx++}`);
      values.push(params.issueDateFrom);
    }

    if (params.issueDateTo) {
      conditions.push(`date_time_issued <= $${idx++}`);
      values.push(params.issueDateTo);
    }

    if (params.submissionDateFrom) {
      conditions.push(`date_time_received >= $${idx++}`);
      values.push(params.submissionDateFrom);
    }

    if (params.submissionDateTo) {
      conditions.push(`date_time_received <= $${idx++}`);
      values.push(params.submissionDateTo);
    }

    if (params.uuid) {
      conditions.push(`uuid ILIKE $${idx++}`);
      values.push(`%${params.uuid.trim()}%`);
    }

    if (params.internalId) {
      conditions.push(`internal_id ILIKE $${idx++}`);
      values.push(`%${params.internalId.trim()}%`);
    }

    if (params.issuerId) {
      conditions.push(`(issuer_id ILIKE $${idx} OR receiver_id ILIKE $${idx})`);
      values.push(`%${params.issuerId.trim()}%`);
      idx++;
    }

    if (params.search && params.search.trim()) {
      const q = `%${params.search.trim()}%`;
      conditions.push(`(uuid ILIKE $${idx} OR internal_id ILIKE $${idx} OR issuer_name ILIKE $${idx} OR receiver_name ILIKE $${idx} OR issuer_id ILIKE $${idx} OR receiver_id ILIKE $${idx})`);
      values.push(q);
      idx++;
    }

    const whereClause = conditions.join(' AND ');

    // 1. Get total count
    const countRes = await pool.query(
      `SELECT COUNT(*)::int as total, MAX(last_synced_at) as last_synced FROM eta_documents WHERE ${whereClause}`,
      values
    );
    const totalCount = Number(countRes.rows[0]?.total || 0);
    const lastSyncedAt = countRes.rows[0]?.last_synced ? new Date(countRes.rows[0].last_synced).toISOString() : null;

    // 2. Pagination
    const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 20));
    const currentPage = Math.max(1, Number(params.page) || 1);
    const offset = (currentPage - 1) * pageSize;
    const totalPages = Math.ceil(totalCount / pageSize) || 1;

    const dataQuery = `
      SELECT * FROM eta_documents 
      WHERE ${whereClause} 
      ORDER BY date_time_issued DESC 
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    const dataValues = [...values, pageSize, offset];
    const dataRes = await pool.query(dataQuery, dataValues);

    const mappedDocs: EtaReceivedInvoiceDTO[] = dataRes.rows.map(row => ({
      uuid: row.uuid,
      submissionUuid: row.submission_uuid || undefined,
      longId: row.long_id || undefined,
      internalId: row.internal_id,
      typeName: row.type_name,
      documentTypeName: row.document_type_name || 'فاتورة',
      typeVersionName: row.type_version_name || undefined,
      direction: (row.direction || 'Received') as 'Sent' | 'Received',
      issuerId: row.issuer_id,
      issuerName: cleanDuplicatedPartnerName(row.issuer_name || 'مورد غير محدد'),
      receiverId: row.receiver_id,
      receiverName: cleanDuplicatedPartnerName(row.receiver_name || 'عميل غير محدد'),
      dateTimeIssued: row.date_time_issued ? new Date(row.date_time_issued).toISOString() : '',
      dateTimeReceived: row.date_time_received ? new Date(row.date_time_received).toISOString() : '',
      totalSales: Number(row.total_sales_amount || 0),
      totalDiscount: Number(row.total_discount_amount || 0),
      netAmount: Number(row.net_amount || 0),
      taxAmount: Number(row.tax_amount || 0),
      totalAmount: Number(row.total_amount || 0),
      currency: row.currency || 'EGP',
      status: row.status || 'Valid',
      cancelRequestDate: row.cancel_request_date ? new Date(row.cancel_request_date).toISOString() : null,
      rejectRequestDate: row.reject_request_date ? new Date(row.reject_request_date).toISOString() : null,
      address: (row.direction === 'Sent' ? row.receiver_address : row.issuer_address) || row.issuer_address || row.receiver_address || '',
      issuerAddress: row.issuer_address || '',
      receiverAddress: row.receiver_address || ''
    }));

    return {
      success: true,
      isConfigured: settings?.isConfigured !== false,
      environment: settings?.environment || 'production',
      data: mappedDocs,
      pagination: {
        pageSize,
        currentPage,
        totalPages,
        totalCount,
        continuationToken: null
      },
      lastSyncedAt
    };
  }

  /**
   * Get Document PDF stream from ETA
   */
  public static async getDocumentPdf(
    companyId: string,
    documentUuid: string
  ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const settings = await this.getCompanySettings(companyId);
    if (!settings || !settings.isConfigured) {
      const err = new Error('لم يتم إعداد الربط مع منظومة ETA لهذه الشركة.');
      (err as any).statusCode = 400;
      throw err;
    }

    const { environment, clientId, clientSecret } = settings;
    const token = await EtaAuthService.getValidAccessToken({
      companyId,
      environment,
      clientId,
      clientSecret
    });

    const pdfUrl = `${this.getApiBaseUrl(environment)}/api/v1.0/documents/${encodeURIComponent(documentUuid)}/pdf`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch(pdfUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/pdf, application/json'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        this.handleEtaHttpError(response.status);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return {
        buffer,
        contentType: response.headers.get('content-type') || 'application/pdf',
        filename: `ETA_Invoice_${documentUuid}.pdf`
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  /**
   * Static cache for partner addresses
   */
  public static partnerAddressCache: Map<string, string> = new Map();

  /**
   * Format ETA address object into human-readable Arabic string
   */
  public static formatAddress(addr: any): string {
    if (!addr) return '';
    if (typeof addr === 'string') return addr.trim();
    const parts = [
      addr.buildingNumber,
      addr.street,
      addr.regionCity,
      addr.governate,
      addr.country
    ].filter(Boolean);
    return parts.join('، ');
  }

  /**
   * Save or upsert partner address into in-memory cache and eta_partner_cache table
   */
  public static async savePartnerAddress(partner: {
    taxNumber?: string;
    name?: string;
    addressObj?: any;
    formattedAddress?: string;
  }): Promise<void> {
    const taxNumber = String(partner.taxNumber || '').trim();
    if (!taxNumber) return;

    const formatted = partner.formattedAddress || this.formatAddress(partner.addressObj);
    if (!formatted) return;

    this.partnerAddressCache.set(taxNumber, formatted);

    try {
      await pool.query(
        `INSERT INTO eta_partner_cache (tax_number, name, address, governate, city, street, building_number, postal_code, country, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         ON CONFLICT (tax_number) DO UPDATE
         SET name = COALESCE(EXCLUDED.name, eta_partner_cache.name),
             address = EXCLUDED.address,
             governate = COALESCE(EXCLUDED.governate, eta_partner_cache.governate),
             city = COALESCE(EXCLUDED.city, eta_partner_cache.city),
             street = COALESCE(EXCLUDED.street, eta_partner_cache.street),
             building_number = COALESCE(EXCLUDED.building_number, eta_partner_cache.building_number),
             postal_code = COALESCE(EXCLUDED.postal_code, eta_partner_cache.postal_code),
             country = COALESCE(EXCLUDED.country, eta_partner_cache.country),
             updated_at = NOW()`,
        [
          taxNumber,
          cleanDuplicatedPartnerName(partner.name) || null,
          formatted,
          partner.addressObj?.governate || null,
          partner.addressObj?.regionCity || null,
          partner.addressObj?.street || null,
          partner.addressObj?.buildingNumber || null,
          partner.addressObj?.postalCode || null,
          partner.addressObj?.country || 'EG'
        ]
      );
    } catch {
      // Non-fatal if table not created yet or db unavailable
    }
  }

  /**
   * Enrich documents with cached or database partner addresses
   */
  public static async enrichWithPartnerAddresses(
    companyId: string,
    docs: EtaReceivedInvoiceDTO[]
  ): Promise<EtaReceivedInvoiceDTO[]> {
    if (!docs || docs.length === 0) return docs;

    const missingTaxIds = new Set<string>();
    for (const doc of docs) {
      const partnerTaxId = (doc.direction === 'Sent' ? doc.receiverId : doc.issuerId) || doc.issuerId || doc.receiverId;
      if (!doc.address && partnerTaxId) {
        if (this.partnerAddressCache.has(partnerTaxId)) {
          doc.address = this.partnerAddressCache.get(partnerTaxId)!;
        } else {
          missingTaxIds.add(partnerTaxId);
        }
      }
    }

    if (missingTaxIds.size > 0) {
      const taxIdArray = Array.from(missingTaxIds);
      try {
        // 1. Check eta_partner_cache table
        const cachedRes = await pool.query(
          `SELECT tax_number, address FROM eta_partner_cache WHERE tax_number = ANY($1) AND address IS NOT NULL AND address <> ''`,
          [taxIdArray]
        );
        for (const row of cachedRes.rows) {
          if (row.tax_number && row.address) {
            this.partnerAddressCache.set(row.tax_number, row.address);
          }
        }

        // 2. Check local suppliers and customers
        const stillMissing = taxIdArray.filter(t => !this.partnerAddressCache.has(t));
        if (stillMissing.length > 0) {
          const dbPartners = await pool.query(
            `SELECT tax_number, address FROM suppliers WHERE company_id = $1 AND tax_number = ANY($2) AND address IS NOT NULL AND address <> ''
             UNION ALL
             SELECT tax_number, address FROM customers WHERE company_id = $1 AND tax_number = ANY($2) AND address IS NOT NULL AND address <> ''`,
            [companyId, stillMissing]
          );
          for (const row of dbPartners.rows) {
            if (row.tax_number && row.address) {
              this.partnerAddressCache.set(row.tax_number, row.address);
            }
          }
        }

        // Assign resolved addresses
        for (const doc of docs) {
          const partnerTaxId = (doc.direction === 'Sent' ? doc.receiverId : doc.issuerId) || doc.issuerId || doc.receiverId;
          if (!doc.address && partnerTaxId && this.partnerAddressCache.has(partnerTaxId)) {
            doc.address = this.partnerAddressCache.get(partnerTaxId)!;
          }
        }
      } catch (err) {
        console.warn('[ETA Address Enrichment] Non-fatal query error:', err);
      }
    }

    return docs;
  }

  /**
   * Background resolver: fetches details for a few unique partners without addresses
   */
  private static async resolveMissingAddressesInBackground(companyId: string, docs: EtaReceivedInvoiceDTO[]): Promise<void> {
    if (!docs || docs.length === 0) return;
    const uniqueUnknownPartners = new Map<string, string>();
    for (const doc of docs) {
      const partnerTaxId = (doc.direction === 'Sent' ? doc.receiverId : doc.issuerId) || doc.issuerId || doc.receiverId;
      if (!doc.address && partnerTaxId && !this.partnerAddressCache.has(partnerTaxId) && doc.uuid) {
        if (!uniqueUnknownPartners.has(partnerTaxId)) {
          uniqueUnknownPartners.set(partnerTaxId, doc.uuid);
        }
      }
    }

    if (uniqueUnknownPartners.size === 0) return;

    const partnersToFetch = Array.from(uniqueUnknownPartners.entries()).slice(0, 5);
    for (const [, uuid] of partnersToFetch) {
      try {
        await this.getDocumentDetails(companyId, uuid);
      } catch {
        // Non-fatal background fetch
      }
      await new Promise(r => setTimeout(r, 550));
    }
  }

  /**
   * Private helper to fetch Search Documents with auto-retry on 429 rate limit
   */
  private static async executeSearchFetch(url: string, token: string, retryCount = 0): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Accept-Language': 'ar'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      // Auto-retry on HTTP 429 Rate Limit (ETA allows 2 req/sec)
      if (response.status === 429 && retryCount < 3) {
        console.warn(`[ETA 429 Rate Limit] Backing off 1.5s then retrying attempt ${retryCount + 1}/3...`);
        await new Promise(r => setTimeout(r, 1500));
        return this.executeSearchFetch(url, token, retryCount + 1);
      }

      return response;
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('[ETA Document Search Network Error]:', err?.message || err);
      if (err.name === 'AbortError') {
        const timeoutErr = new Error('انتهت مهلة البحث عن المستندات في منظومة مصلحة الضرائب المصرية (15 ثانية).');
        (timeoutErr as any).statusCode = 504;
        (timeoutErr as any).code = 'TIMEOUT';
        throw timeoutErr;
      }
      const netErr = new Error('تعذر الاتصال بخوادم منظومة الفاتورة الإلكترونية ETA.');
      (netErr as any).statusCode = 503;
      (netErr as any).code = 'ETA_UNAVAILABLE';
      throw netErr;
    }
  }

  /**
   * Private helper for defensive summary mapping
   */
  private static mapDocumentSummary(item: any): EtaReceivedInvoiceDTO {
    const uuid = String(item?.uuid || item?.documentUUID || '').trim();
    const submissionUuid = String(item?.submissionUUID || item?.submissionUuid || '').trim();
    const internalId = String(item?.internalId || item?.internalID || '').trim();
    const typeName = String(item?.typeName || 'i').trim();
    const typeVersionName = String(item?.typeVersionName || '1.0').trim();

    const issuerId = String(item?.issuerId || item?.issuer?.id || '').trim();
    const issuerName = cleanDuplicatedPartnerName(String(item?.issuerName || item?.issuer?.name || 'مورد غير محدد').trim());

    const receiverId = String(item?.receiverId || item?.receiver?.id || '').trim();
    const receiverName = cleanDuplicatedPartnerName(String(item?.receiverName || item?.receiver?.name || '').trim());

    const dateTimeIssued = String(item?.dateTimeIssued || item?.issueDate || '').trim();
    const dateTimeReceived = String(item?.dateTimeReceived || '').trim();

    const totalSales = Number(item?.totalSales || 0);
    const totalDiscount = Number(item?.totalDiscount || 0);
    const netAmount = Number(item?.netAmount || 0);
    const totalAmount = Number(item?.total || item?.totalAmount || 0);

    // Calculate tax totals safely
    let taxAmount = 0;
    if (Array.isArray(item?.taxTotals) && item.taxTotals.length > 0) {
      taxAmount = item.taxTotals.reduce((acc: number, t: any) => acc + (Number(t?.amount) || 0), 0);
    } else if (totalAmount > 0 && netAmount > 0) {
      taxAmount = Math.max(0, Math.round((totalAmount - netAmount) * 10000) / 10000);
    }

    const currency = String(item?.documentCurrency || item?.currency || 'EGP').trim();
    const status = String(item?.status || 'Valid').trim();

    const documentTypeName =
      item?.documentTypeNamePrimaryLang ||
      (() => {
        const t = typeName.toLowerCase();
        if (t === 'i') return 'فاتورة';
        if (t === 'c') return 'إشعار دائن';
        if (t === 'd') return 'إشعار مدين';
        if (t === 'ii') return 'فاتورة استيراد';
        if (t === 'ei') return 'فاتورة تصدير';
        if (t === 'ec') return 'إشعار دائن تصدير';
        if (t === 'ed') return 'إشعار مدين تصدير';
        return typeName;
      })();

    // Infer direction (Sent vs Received)
    let direction: 'Sent' | 'Received' = 'Received';
    if (item?.direction) {
      direction = String(item.direction).toLowerCase() === 'sent' ? 'Sent' : 'Received';
    } else if (issuerId === '672574845') {
      direction = 'Sent';
    }

    const partnerTaxId = (direction === 'Sent' ? receiverId : issuerId) || issuerId || receiverId;
    const issuerAddress = EtaDocumentService.formatAddress(item?.issuer?.address || item?.issuerAddress);
    const receiverAddress = EtaDocumentService.formatAddress(item?.receiver?.address || item?.receiverAddress);
    let address = (direction === 'Sent' ? receiverAddress : issuerAddress) || issuerAddress || receiverAddress || '';
    if (!address && partnerTaxId && EtaDocumentService.partnerAddressCache.has(partnerTaxId)) {
      address = EtaDocumentService.partnerAddressCache.get(partnerTaxId)!;
    }

    return {
      uuid,
      submissionUuid: submissionUuid || undefined,
      longId: item?.longId || undefined,
      internalId: internalId || 'بدون رقم',
      typeName,
      documentTypeName,
      typeVersionName,
      direction,
      issuerId,
      issuerName,
      receiverId,
      receiverName,
      dateTimeIssued,
      dateTimeReceived,
      totalSales,
      totalDiscount,
      netAmount,
      taxAmount,
      totalAmount,
      currency,
      status,
      cancelRequestDate: item?.cancelRequestDate || null,
      rejectRequestDate: item?.rejectRequestDate || null,
      address,
      issuerAddress,
      receiverAddress
    };
  }

  /**
   * Map HTTP error codes to safe user-friendly Arabic messages
   */
  private static handleEtaHttpError(status: number): never {
    let message = `خطأ في الاتصال بمنظومة ETA (HTTP ${status})`;
    let code = 'ETA_ERROR';

    if (status === 400) {
      message = 'طلب البحث غير صالح حسب قواعد منظومة ETA. يرجى التحقق من صحة التواريخ والفلاتر.';
      code = 'BAD_REQUEST';
    } else if (status === 401) {
      message = 'انتهت صلاحية المصادقة أو بيانات اعتماد ETA غير صحيحة.';
      code = 'UNAUTHORIZED';
    } else if (status === 403) {
      message = 'الحساب غير مصرح له بالوصول إلى المستندات في منظومة مصلحة الضرائب.';
      code = 'FORBIDDEN';
    } else if (status === 404) {
      message = 'لم يتم العثور على مستندات مطابقة في منظومة مصلحة الضرائب.';
      code = 'NOT_FOUND';
    } else if (status === 429) {
      message = 'تم تجاوز معدل الطلبات المسموح به من مصلحة الضرائب المصرية. يرجى الانتظار دقيقة والمحاولة مجدداً.';
      code = 'RATE_LIMITED';
    } else if (status >= 500) {
      message = 'خدمة مصلحة الضرائب المصرية (ETA) غير متاحة حالياً أو تواجه عطلاً مؤقتاً.';
      code = 'ETA_UNAVAILABLE';
    }

    const err = new Error(message);
    (err as any).statusCode = status;
    (err as any).code = code;
    throw err;
  }
}
