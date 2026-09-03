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
    } else if (!params.direction) {
      // Default to Received if direction not specified
      query.set('direction', 'Received');
    }

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
   * Fetch all documents across multi-month periods (Auto-Chunked Full Sync)
   */
  private static portalCache: Map<string, { timestamp: number; data: EtaReceivedInvoiceDTO[] }> = new Map();
  private static CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

  /**
   * Fetch all documents across multi-month periods (Auto-Chunked Full Sync with In-Memory Caching)
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
  }> {
    const settings = await this.getCompanySettings(companyId);
    if (!settings || !settings.isConfigured) {
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

    // Check in-memory cache
    const cacheKey = `${companyId}_${targetYear}_${options.direction || 'all'}_${options.documentType || 'all'}_${options.status || 'all'}`;
    if (!options.forceRefresh && this.portalCache.has(cacheKey)) {
      const cached = this.portalCache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
        return {
          success: true,
          isConfigured: true,
          environment: settings.environment,
          data: cached.data,
          totalCount: cached.data.length
        };
      }
    }

    // Build 1-month windows (ETA allows up to 31 days per query)
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
      // Dynamically scan from currentYear down to 2020 (when official ETA e-invoicing launched in Egypt)
      for (let yr = currentYear; yr >= 2020; yr--) {
        const startMonth = (yr === currentYear) ? new Date().getMonth() + 1 : 12;
        const endMonth = (yr === 2020) ? 11 : 1;
        addYearWindows(yr, startMonth, endMonth);
      }
    } else {
      // Single specific year (e.g. 2027, 2026, 2025, 2024, 2023, 2022, 2021, 2020)
      const yr = Number(targetYear) || currentYear;
      const startMonth = (yr === currentYear) ? new Date().getMonth() + 1 : 12;
      const endMonth = (yr === 2020) ? 11 : 1; // ETA started in Nov 2020
      addYearWindows(yr, startMonth, endMonth);
    }

    const docMap = new Map<string, EtaReceivedInvoiceDTO>();

    // Determine directions to query: if 'all' or not specified, fetch both Received and Sent
    const fetchDirections: ('Received' | 'Sent')[] =
      !options.direction || options.direction.toLowerCase() === 'all'
        ? ['Received', 'Sent']
        : options.direction === 'Sent'
        ? ['Sent']
        : ['Received'];

    for (const win of windows) {
      for (const dir of fetchDirections) {
        let continuationToken: string | undefined = undefined;
        let hasMore = true;

        while (hasMore) {
          try {
            const res = await this.searchReceivedInvoices(companyId, {
              issueDateFrom: win.from,
              issueDateTo: win.to,
              direction: dir,
              documentType: options.documentType,
              status: options.status,
              continuationToken,
              pageSize: 100
            });

            if (res.data && res.data.length > 0) {
              for (const doc of res.data) {
                if (!doc.direction) {
                  doc.direction = dir;
                }
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
            console.warn(`[ETA Multi-Period Fetch] Window ${win.from} - ${win.to} (${dir}) skipped:`, err?.message || err);
            hasMore = false;
          }

          // Safe pause between calls to respect ETA's 2 req/sec rate limit
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    }

    const allDocs = Array.from(docMap.values());
    allDocs.sort((a, b) => new Date(b.dateTimeIssued).getTime() - new Date(a.dateTimeIssued).getTime());

    // Enrich with cached or local database partner addresses
    await this.enrichWithPartnerAddresses(companyId, allDocs);

    // Save to cache
    this.portalCache.set(cacheKey, {
      timestamp: Date.now(),
      data: allDocs
    });

    // Background address resolution for unique unknown partners (non-blocking)
    this.resolveMissingAddressesInBackground(companyId, allDocs).catch(() => {});

    return {
      success: true,
      isConfigured: true,
      environment: settings.environment,
      data: allDocs,
      totalCount: allDocs.length
    };
  }

  /**
   * Get Document Details from ETA (Read-Only)
   */
  public static async getDocumentDetails(
    companyId: string,
    documentUuid: string
  ): Promise<{ success: boolean; data: any }> {
    const settings = await this.getCompanySettings(companyId);
    if (!settings || !settings.isConfigured) {
      const err = new Error('لم يتم إعداد الربط مع منظومة ETA لهذه الشركة.');
      (err as any).statusCode = 400;
      (err as any).code = 'ETA_NOT_CONFIGURED';
      throw err;
    }

    const { environment, clientId, clientSecret } = settings;
    const token = await EtaAuthService.getValidAccessToken({
      companyId,
      environment,
      clientId,
      clientSecret
    });

    const apiUrl = `${this.getApiBaseUrl(environment)}/api/v1.0/documents/${encodeURIComponent(documentUuid)}/details`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Accept-Language': 'ar'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        this.handleEtaHttpError(response.status);
      }

      const data = await response.json();

      // Automatically cache partner addresses learned from full document details
      if (data?.issuer) {
        await this.savePartnerAddress({
          taxNumber: data.issuer.id,
          name: data.issuer.name,
          addressObj: data.issuer.address
        });
      }
      if (data?.receiver) {
        await this.savePartnerAddress({
          taxNumber: data.receiver.id,
          name: data.receiver.name,
          addressObj: data.receiver.address
        });
      }

      return { success: true, data };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        const timeoutErr = new Error('انتهت مهلة جلب تفاصيل المستند من منظومة ETA.');
        (timeoutErr as any).statusCode = 504;
        throw timeoutErr;
      }
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
          partner.name || null,
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
    const issuerName = String(item?.issuerName || item?.issuer?.name || 'مورد غير محدد').trim();

    const receiverId = String(item?.receiverId || item?.receiver?.id || '').trim();
    const receiverName = String(item?.receiverName || item?.receiver?.name || '').trim();

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
      (typeName === 'i' ? 'فاتورة' : typeName === 'c' ? 'إشعار دائن' : typeName === 'd' ? 'إشعار مدين' : typeName);

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
