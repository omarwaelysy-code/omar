/**
 * ExchangeRateService
 *
 * Fetches the latest foreign-exchange rates from the exchangerate.host public API
 * and returns a strongly-typed, discriminated-union result.
 *
 * IMPORTANT – Design constraints honoured:
 *   • Reads only – does NOT write to any database table.
 *   • Does NOT touch any accounting / posting logic.
 *   • Does NOT modify any existing currency screen or service.
 *   • Fully backward-compatible; callers opt in by importing this module.
 */

import type {
  ExchangeRateFetchOptions,
  ExchangeRateFetchResult,
  FetchedCurrencyRate,
} from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const SERVICE_TAG = '[ExchangeRateService]';

/**
 * Base URL for the free, key-less open.er-api.com exchange rate service.
 * (exchangerate.host was deprecated to paid-only — error code 101 missing_access_key)
 * Verified working: HTTP 200 with full rates map, no authentication required.
 */
const API_BASE_URL = 'https://open.er-api.com/v6/latest';

/** Default base currency used when no override is supplied by the caller. */
const DEFAULT_BASE_CURRENCY = 'EGP';

/** Default request timeout in milliseconds. */
const DEFAULT_TIMEOUT_MS = 10_000;

// ─── Raw API response shape (internal – not exported) ─────────────────────────

/**
 * Shape of the JSON object returned by open.er-api.com /v6/latest/{base}.
 * Also accepts the old exchangerate.host shape as a fallback.
 */
interface ExchangeRateHostResponse {
  /** open.er-api.com: "success" | "error"  (old: boolean true/false) */
  result?: string;
  /** Legacy field from exchangerate.host */
  success?: boolean;
  /** open.er-api.com uses base_code; old API used base */
  base_code?: string;
  base?: string;
  /** open.er-api.com: RFC-2822 date string; old: YYYY-MM-DD */
  time_last_update_utc?: string;
  date?: string;
  rates?: Record<string, unknown>;
  /** Error object present when result === 'error' or success === false */
  error?: {
    code?: number;
    type?: string;
    info?: string;
  };
}

// ─── ExchangeRateService class ────────────────────────────────────────────────

export class ExchangeRateService {
  /**
   * Fetch the latest exchange rates for all available currencies.
   *
   * @param options - Optional fetch configuration (base currency, timeout).
   * @returns A discriminated-union result:
   *   - `{ success: true,  baseCurrency, rateDate, rates, fetchedAt }` on success
   *   - `{ success: false, error, message }` on any failure
   *
   * @example
   * ```ts
   * const result = await ExchangeRateService.fetchLatestRates({ baseCurrency: 'USD' });
   * if (result.success) {
   *   console.log(`Fetched ${result.rates.length} rates on ${result.rateDate}`);
   * } else {
   *   console.error(result.error, result.message);
   * }
   * ```
   */
  static async fetchLatestRates(
    options: ExchangeRateFetchOptions = {}
  ): Promise<ExchangeRateFetchResult> {
    const baseCurrency = (options.baseCurrency ?? DEFAULT_BASE_CURRENCY).toUpperCase();
    const timeoutMs    = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    // open.er-api.com path: /v6/latest/{BASE_CODE}
    const url = `${API_BASE_URL}/${encodeURIComponent(baseCurrency)}`;

    console.log(`${SERVICE_TAG} Fetching latest rates | base=${baseCurrency} timeout=${timeoutMs}ms url=${url}`);

    // ── Build AbortController for network timeout ──────────────────────────
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    let rawText: string;
    let httpStatus: number | undefined;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'ObrainERP/2.0 ExchangeRateService',
        },
        signal: controller.signal,
      });

      httpStatus = response.status;

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        console.error(
          `${SERVICE_TAG} API returned HTTP ${httpStatus}. Body: ${body.substring(0, 200)}`
        );
        return {
          success: false,
          error: 'API_UNAVAILABLE',
          message: `exchangerate.host responded with HTTP ${httpStatus}`,
        };
      }

      rawText = await response.text();
    } catch (err: unknown) {
      clearTimeout(timeoutHandle);

      // AbortError means our timer fired – treat as timeout
      if (err instanceof Error && err.name === 'AbortError') {
        console.error(
          `${SERVICE_TAG} Request timed out after ${timeoutMs}ms (base=${baseCurrency})`
        );
        return {
          success: false,
          error: 'NETWORK_TIMEOUT',
          message: `Request to exchangerate.host timed out after ${timeoutMs} ms`,
        };
      }

      const message = err instanceof Error ? err.message : String(err);
      console.error(`${SERVICE_TAG} Network error: ${message}`);
      return {
        success: false,
        error: 'API_UNAVAILABLE',
        message: `Network error while contacting exchangerate.host: ${message}`,
      };
    } finally {
      clearTimeout(timeoutHandle);
    }

    // ── Parse JSON ─────────────────────────────────────────────────────────
    let parsed: ExchangeRateHostResponse;
    try {
      parsed = JSON.parse(rawText) as ExchangeRateHostResponse;
    } catch {
      console.error(
        `${SERVICE_TAG} Response is not valid JSON (HTTP ${httpStatus ?? '?'}). ` +
          `First 200 chars: ${rawText.substring(0, 200)}`
      );
      return {
        success: false,
        error: 'INVALID_JSON',
        message: 'exchangerate.host returned non-JSON content',
      };
    }

    // ── Validate API-level success flag ────────────────────────────────────
    // open.er-api.com uses result:'success'/'error'; legacy exchangerate.host used success:boolean
    const apiSucceeded =
      parsed.result === 'success' || parsed.success === true;

    if (!apiSucceeded) {
      const apiError = parsed.error;
      const info     = apiError?.info ?? parsed.result ?? 'No additional information';
      console.error(
        `${SERVICE_TAG} API reported failure (result=${parsed.result}, code=${apiError?.code}): ${info}`
      );
      return {
        success: false,
        error: 'API_UNAVAILABLE',
        message: `Exchange rate API error: ${info}`,
      };
    }

    // ── Parse rates map ────────────────────────────────────────────────────
    try {
      const ratesMap = parsed.rates;

      if (!ratesMap || typeof ratesMap !== 'object') {
        throw new Error('Rates field is missing or not an object');
      }

      // open.er-api.com: time_last_update_utc is RFC-2822; extract YYYY-MM-DD
      let rateDate = new Date().toISOString().slice(0, 10);
      if (typeof parsed.date === 'string' && parsed.date.length >= 10) {
        rateDate = parsed.date.slice(0, 10);
      } else if (typeof parsed.time_last_update_utc === 'string') {
        // e.g. "Tue, 16 Jun 2026 00:02:31 +0000" → parse to Date → YYYY-MM-DD
        const d = new Date(parsed.time_last_update_utc);
        if (!isNaN(d.getTime())) rateDate = d.toISOString().slice(0, 10);
      }

      const reportedBase =
        (typeof parsed.base_code === 'string' ? parsed.base_code : null) ||
        (typeof parsed.base     === 'string' ? parsed.base     : null) ||
        baseCurrency;

      const rates: FetchedCurrencyRate[] = [];

      for (const [code, rawValue] of Object.entries(ratesMap)) {
        const numericRate = typeof rawValue === 'number' ? rawValue : Number(rawValue);

        if (!isFinite(numericRate) || numericRate <= 0) {
          // Skip malformed / non-positive entries rather than failing the whole batch
          console.warn(
            `${SERVICE_TAG} Skipping invalid rate for ${code}: ${rawValue}`
          );
          continue;
        }

        rates.push({
          currencyCode: code.toUpperCase(),
          rate: numericRate,
          rateDate,
        });
      }

      console.log(
        `${SERVICE_TAG} ✅ Success | base=${reportedBase} date=${rateDate} currencies=${rates.length}`
      );

      return {
        success: true,
        baseCurrency: reportedBase,
        rateDate,
        rates,
        fetchedAt: Date.now(),
      };
    } catch (parseErr: unknown) {
      const message = parseErr instanceof Error ? parseErr.message : String(parseErr);
      console.error(`${SERVICE_TAG} Failed to parse rates payload: ${message}`);
      return {
        success: false,
        error: 'PARSE_ERROR',
        message: `Failed to parse exchangerate.host payload: ${message}`,
      };
    }
  }
}
