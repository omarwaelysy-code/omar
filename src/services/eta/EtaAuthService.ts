/**
 * ETA (Egyptian Tax Authority / مصلحة الضرائب المصرية) Authentication Service
 * 
 * Implements OAuth 2.0 Client Credentials Grant to authenticate against official ETA Identity Server:
 * - PreProd: https://id.preprod.eta.gov.eg/connect/token
 * - Production: https://id.eta.gov.eg/connect/token
 * 
 * Safety & Security:
 * - Access tokens are cached strictly in-memory on the backend.
 * - Client Secret and Access Tokens are NEVER logged, printed, or exposed to the frontend.
 */

export interface EtaConnectionTestParams {
  companyId: string;
  environment?: 'preprod' | 'production';
  clientId?: string;
  clientSecret?: string;
}

export interface EtaConnectionTestResult {
  success: boolean;
  connected: boolean;
  environment: 'preprod' | 'production';
  code?: 'MISSING_CREDENTIALS' | 'INVALID_CREDENTIALS' | 'TIMEOUT' | 'ETA_UNAVAILABLE' | 'UNKNOWN_ERROR';
  message: string;
  http_status?: number;
  diagnostic?: string;
  tested_at: string;
}

interface CachedToken {
  token: string;
  expiresAt: number; // Unix timestamp ms
}

export class EtaAuthService {
  // Official ETA Identity URLs
  public static readonly PREPROD_ID_URL = 'https://id.preprod.eta.gov.eg/connect/token';
  public static readonly PRODUCTION_ID_URL = 'https://id.eta.gov.eg/connect/token';

  // In-memory token cache: companyId_env -> CachedToken
  private static tokenCache: Map<string, CachedToken> = new Map();

  /**
   * Get the official Identity Server endpoint for the given environment
   */
  public static getIdentityUrl(environment: 'preprod' | 'production' = 'preprod'): string {
    return environment === 'production'
      ? this.PRODUCTION_ID_URL
      : this.PREPROD_ID_URL;
  }

  /**
   * Test ETA OAuth 2.0 authentication credentials
   */
  public static async testConnection(params: EtaConnectionTestParams): Promise<EtaConnectionTestResult> {
    const environment = params.environment === 'production' ? 'production' : 'preprod';
    const clientId = params.clientId?.trim();
    const clientSecret = params.clientSecret?.trim();
    const testedAt = new Date().toISOString();

    // 1. Validate credential presence
    if (!clientId || !clientSecret) {
      return {
        success: false,
        connected: false,
        environment,
        code: 'MISSING_CREDENTIALS',
        message: 'بيانات الربط غير مكتملة. يرجى إدخال معرّف العميل (Client ID) والمفتاح السري (Client Secret).',
        tested_at: testedAt
      };
    }

    const tokenUrl = this.getIdentityUrl(environment);

    // 2. Prepare OAuth request payload
    const bodyParams = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 second timeout

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: bodyParams.toString(),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // 3. Handle response
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        
        // Cache token server-side if present
        if (data && typeof data.access_token === 'string' && data.expires_in) {
          const ttlMs = (Number(data.expires_in) - 60) * 1000; // Subtract 60s buffer
          const cacheKey = `${params.companyId}_${environment}`;
          this.tokenCache.set(cacheKey, {
            token: data.access_token,
            expiresAt: Date.now() + Math.max(ttlMs, 60000)
          });
        }

        return {
          success: true,
          connected: true,
          environment,
          http_status: response.status,
          message: environment === 'production'
            ? 'تم الاتصال والتحقق بنجاح مع خوادم منظومة الفاتورة الإلكترونية الفعلية (Production).'
            : 'تم الاتصال والتحقق بنجاح مع خوادم مصلحة الضرائب التجريبية (PreProd / Sandbox).',
          tested_at: testedAt
        };
      }

      // Read safe error payload if present
      const errData = await response.json().catch(() => ({}));
      const errorKey = typeof errData?.error === 'string' ? errData.error : '';
      const errorDesc = typeof errData?.error_description === 'string' ? errData.error_description : '';
      const safeDiag = [errorKey, errorDesc].filter(Boolean).join(': ') || undefined;

      // Handle HTTP Error status
      if (response.status === 400 || response.status === 401) {
        return {
          success: false,
          connected: false,
          environment,
          code: 'INVALID_CREDENTIALS',
          http_status: response.status,
          diagnostic: safeDiag || (response.status === 401 ? 'Unauthorized (invalid_client)' : 'Bad Request (invalid_credentials)'),
          message: 'بيانات الدخول إلى منظومة الفاتورة الإلكترونية غير صحيحة. يرجى التحقق من صحة Client ID و Client Secret.',
          tested_at: testedAt
        };
      }

      if (response.status >= 500) {
        return {
          success: false,
          connected: false,
          environment,
          code: 'ETA_UNAVAILABLE',
          http_status: response.status,
          diagnostic: safeDiag || `Server Error (HTTP ${response.status})`,
          message: 'تعذر الوصول إلى خوادم مصلحة الضرائب المصرية (ETA) حالياً. يرجى المحاولة لاحقاً.',
          tested_at: testedAt
        };
      }

      return {
        success: false,
        connected: false,
        environment,
        code: 'UNKNOWN_ERROR',
        http_status: response.status,
        diagnostic: safeDiag || `HTTP ${response.status}`,
        message: `تعذر التحقق من الاتصال بمنظومة ETA (رمز الاستجابة: ${response.status}).`,
        tested_at: testedAt
      };
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err.name === 'AbortError') {
        return {
          success: false,
          connected: false,
          environment,
          code: 'TIMEOUT',
          diagnostic: 'Request aborted due to 12s timeout',
          message: 'انتهت مهلة الاتصال بخوادم منظومة الفاتورة الإلكترونية (ETA). يرجى التحقق من اتصال الإنترنت أو المحاولة لاحقاً.',
          tested_at: testedAt
        };
      }

      return {
        success: false,
        connected: false,
        environment,
        code: 'ETA_UNAVAILABLE',
        diagnostic: err instanceof Error ? err.message : 'Network failure',
        message: 'تعذر الاتصال بخوادم منظومة الفاتورة الإلكترونية (ETA).',
        tested_at: testedAt
      };
    }
  }

  /**
   * Get a valid ETA access token for API calls (using in-memory cache or requesting a new token)
   */
  public static async getValidAccessToken(params: {
    companyId: string;
    environment?: 'preprod' | 'production';
    clientId: string;
    clientSecret: string;
    forceRefresh?: boolean;
  }): Promise<string> {
    const environment = params.environment === 'production' ? 'production' : 'preprod';
    const clientId = params.clientId?.trim();
    const clientSecret = params.clientSecret?.trim();
    const cacheKey = `${params.companyId}_${environment}`;

    if (!clientId || !clientSecret) {
      const err = new Error('بيانات الربط مع منظومة الفاتورة الإلكترونية غير مكتملة (Client ID / Client Secret).');
      (err as any).statusCode = 400;
      (err as any).code = 'MISSING_CREDENTIALS';
      throw err;
    }

    // 1. Check in-memory cache if not forced refresh
    if (!params.forceRefresh) {
      const cached = this.tokenCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.token;
      }
    }

    // 2. Request new token from official ETA Identity Server
    const tokenUrl = this.getIdentityUrl(environment);
    const bodyParams = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: bodyParams.toString(),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errorKey = typeof errData?.error === 'string' ? errData.error : '';
        const errorDesc = typeof errData?.error_description === 'string' ? errData.error_description : '';
        const safeDiag = [errorKey, errorDesc].filter(Boolean).join(': ');

        const error = new Error(
          response.status === 401 || response.status === 400
            ? 'فشلت المصادقة مع منظومة الضرائب ETA. يرجى التحقق من صحة بيانات الربط (Client ID و Client Secret).'
            : response.status >= 500
              ? 'تعذر الوصول إلى خوادم مصلحة الضرائب المصرية (ETA) حالياً.'
              : `فشل الحصول على تصريح الوصول من ETA (رمز الاستجابة: ${response.status}).`
        );
        (error as any).statusCode = response.status;
        (error as any).code = response.status === 401 || response.status === 400 ? 'INVALID_CREDENTIALS' : 'ETA_ERROR';
        (error as any).diagnostic = safeDiag || undefined;
        throw error;
      }

      const data = await response.json();
      if (!data || typeof data.access_token !== 'string') {
        const err = new Error('استجابة غير متوقعة من خوادم هوية مصلحة الضرائب المصرية.');
        (err as any).statusCode = 502;
        throw err;
      }

      const ttlMs = (Number(data.expires_in || 3600) - 60) * 1000;
      this.tokenCache.set(cacheKey, {
        token: data.access_token,
        expiresAt: Date.now() + Math.max(ttlMs, 60000)
      });

      return data.access_token;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        const timeoutErr = new Error('انتهت مهلة الاتصال بخوادم هوية منظومة الفاتورة الإلكترونية ETA (15 ثانية).');
        (timeoutErr as any).statusCode = 504;
        (timeoutErr as any).code = 'TIMEOUT';
        throw timeoutErr;
      }
      throw err;
    }
  }

  /**
   * Clear cached token for a company/environment
   */
  public static clearCache(companyId: string, environment?: 'preprod' | 'production'): void {
    if (environment) {
      this.tokenCache.delete(`${companyId}_${environment}`);
    } else {
      this.tokenCache.delete(`${companyId}_preprod`);
      this.tokenCache.delete(`${companyId}_production`);
    }
  }
}
