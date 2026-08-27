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
          message: environment === 'production'
            ? 'تم الاتصال والتحقق بنجاح مع خوادم منظومة الفاتورة الإلكترونية الفعلية (Production).'
            : 'تم الاتصال والتحقق بنجاح مع خوادم مصلحة الضرائب التجريبية (PreProd / Sandbox).',
          tested_at: testedAt
        };
      }

      // Handle HTTP Error status
      if (response.status === 400 || response.status === 401) {
        return {
          success: false,
          connected: false,
          environment,
          code: 'INVALID_CREDENTIALS',
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
          message: 'تعذر الوصول إلى خوادم مصلحة الضرائب المصرية (ETA) حالياً. يرجى المحاولة لاحقاً.',
          tested_at: testedAt
        };
      }

      return {
        success: false,
        connected: false,
        environment,
        code: 'UNKNOWN_ERROR',
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
          message: 'انتهت مهلة الاتصال بخوادم منظومة الفاتورة الإلكترونية (ETA). يرجى التحقق من اتصال الإنترنت أو المحاولة لاحقاً.',
          tested_at: testedAt
        };
      }

      return {
        success: false,
        connected: false,
        environment,
        code: 'ETA_UNAVAILABLE',
        message: 'تعذر الاتصال بخوادم منظومة الفاتورة الإلكترونية (ETA).',
        tested_at: testedAt
      };
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
