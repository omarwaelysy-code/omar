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
      direction: 'Received',
      documentType: params.documentType?.trim() || 'i',
      pageSize: pageSize.toString(),
      issueDateFrom,
      issueDateTo
    });

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
        direction: 'Received',
        documentType: params.documentType?.trim() || 'i',
        issueDateFrom,
        issueDateTo
      }
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
   * Private helper to fetch Search Documents
   */
  private static async executeSearchFetch(url: string, token: string): Promise<Response> {
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

    return {
      uuid,
      submissionUuid: submissionUuid || undefined,
      longId: item?.longId || undefined,
      internalId: internalId || 'بدون رقم',
      typeName,
      documentTypeName,
      typeVersionName,
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
      rejectRequestDate: item?.rejectRequestDate || null
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
