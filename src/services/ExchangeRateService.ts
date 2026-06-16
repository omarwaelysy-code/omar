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
 * Base URL of the exchangerate.host REST endpoint.
 * Using the /latest path which returns all available currencies in one call.
 */
const API_BASE_URL = 'https://api.exchangerate.host/latest';

/** Default base currency used when no override is supplied by the caller. */
const DEFAULT_BASE_CURRENCY = 'EGP';

/** Default request timeout in milliseconds. */
const DEFAULT_TIMEOUT_MS = 10_000;

// ─── Raw API response shape (internal – not exported) ─────────────────────────

/**
 * Shape of the JSON object returned by exchangerate.host /latest.
 * Typed conservatively so the parser can validate before trusting any field.
 */
interface ExchangeRateHostResponse {
  success?: boolean;
  base?: string;
  date?: string;
  rates?: Record<string, unknown>;
  /** Error object present when success === false */
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

    const url = `${API_BASE_URL}?base=${encodeURIComponent(baseCurrency)}`;

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
    if (parsed.success === false) {
      const apiError = parsed.error;
      const info     = apiError?.info ?? 'No additional information';
      console.error(
        `${SERVICE_TAG} API reported failure (code=${apiError?.code}, type=${apiError?.type}): ${info}`
      );
      return {
        success: false,
        error: 'API_UNAVAILABLE',
        message: `exchangerate.host API error: ${info}`,
      };
    }

    // ── Parse rates map ────────────────────────────────────────────────────
    try {
      const ratesMap = parsed.rates;

      if (!ratesMap || typeof ratesMap !== 'object') {
        throw new Error('Rates field is missing or not an object');
      }

      const rateDate = typeof parsed.date === 'string' ? parsed.date : new Date().toISOString().slice(0, 10);
      const reportedBase = typeof parsed.base === 'string' ? parsed.base : baseCurrency;

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
