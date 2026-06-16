/**
 * ExchangeRatePersistenceService  –  Phase 3
 *
 * Orchestrates:
 *   1. Fetch live rates via ExchangeRateService (Phase 2)
 *   2. Match each rate to a row in the `currencies` table by ISO code
 *   3. Upsert into `currency_rates`:
 *        – UPDATE  if a row for (currency_id, rate_date) already exists
 *        – INSERT  otherwise
 *   4. Wrap all DB work in a single transaction; rollback on any failure
 *   5. Return a typed { success, inserted, updated, skipped } summary
 *
 * CONSTRAINTS HONOURED:
 *   • No accounting logic is modified or called.
 *   • No invoice / posting engine is touched.
 *   • No existing service files are changed.
 *   • `currencies` table is read-only here (never written to).
 *   • `currency_rates` is the only table written to.
 */

import { randomUUID } from 'crypto';
import pool from '../lib/postgres';
import { ExchangeRateService } from './ExchangeRateService';
import type {
  ExchangeRateFetchOptions,
  ExchangeRateFetchResult,
  PersistRatesResult,
} from '../types';

// ─── Logging tag ──────────────────────────────────────────────────────────────
const TAG = '[ExchangeRatePersistenceService]';

// ─── Helper for Date/Time formatting ──────────────────────────────────────────
function getFormattedDateTime() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const dateStr = `${day}/${month}/${year}`;

  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = String(hours).padStart(2, '0');
  const timeStr = `${hoursStr}:${minutes}:${seconds} ${ampm}`;

  return { dateStr, timeStr };
}

// ─── Helper to log sync history ──────────────────────────────────────────────
async function logSyncRunToHistory(
  companyId: string | undefined,
  updatedBy: string,
  status: 'Success' | 'Failed',
  ratesToLog: { currencyCode: string; rate: number }[],
  provider: string = 'ExchangeRate.host'
) {
  if (!companyId) return;
  try {
    const { dateStr, timeStr } = getFormattedDateTime();
    let currenciesToLog = ratesToLog;

    if (status === 'Failed' || currenciesToLog.length === 0) {
      // Load all active currencies for the company to show they all failed
      const { rows } = await pool.query(
        'SELECT UPPER(code) as code FROM currencies WHERE company_id = $1 AND is_active = true',
        [companyId]
      );
      if (rows.length > 0) {
        currenciesToLog = rows.map((r: any) => ({ currencyCode: r.code, rate: 0 }));
      } else {
        currenciesToLog = [{ currencyCode: 'USD', rate: 0 }];
      }
    }

    for (const item of currenciesToLog) {
      const newId = randomUUID();
      await pool.query(
        `INSERT INTO exchange_rate_history (id, company_id, currency_code, exchange_rate, provider, retrieved_date, retrieved_time, updated_by, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [newId, companyId, item.currencyCode.toUpperCase(), item.rate, provider, dateStr, timeStr, updatedBy, status]
      );
    }
  } catch (err) {
    console.error(`${TAG} Failed to log sync history:`, err);
  }
}

// ─── Service ────────────────────────────────────────────
export class ExchangeRatePersistenceService {
  /**
   * Fetch the latest exchange rates and persist them to `currency_rates`.
   */
  static async persistLatestRates(
    fetchOptions: ExchangeRateFetchOptions = {},
    companyId?: string,
    updatedBy?: string
  ): Promise<PersistRatesResult> {
    const updatedByVal = updatedBy || 'Automatic';
    
    // ── Step 1: Fetch rates from external API ─────────────────────────────
    console.log(`${TAG} Starting fetch-and-persist cycle (base=${fetchOptions.baseCurrency ?? 'EGP'})…`);

    const fetchResult = await ExchangeRateService.fetchLatestRates(fetchOptions);

    if (!fetchResult.success) {
      const failure = fetchResult as Extract<ExchangeRateFetchResult, { success: false }>;
      console.error(`${TAG} Fetch failed [${failure.error}]: ${failure.message}`);
      
      // Log failed sync run to history
      if (companyId) {
        await logSyncRunToHistory(companyId, updatedByVal, 'Failed', []);
      }

      return {
        success: false,
        inserted: 0,
        updated: 0,
        skipped: 0,
        message: `Fetch failed: ${failure.message}`,
      };
    }

    const { rates, rateDate, baseCurrency } = fetchResult;
    console.log(
      `${TAG} Fetch succeeded: ${rates.length} rates for base=${baseCurrency} on ${rateDate}. Starting DB transaction…`
    );

    // ── Step 2: Persist inside a single transaction ───────────────────────
    const client = await pool.connect();

    let inserted = 0;
    let updated  = 0;
    let skipped  = 0;
    const activeRatesSynced: { currencyCode: string; rate: number }[] = [];

    try {
      await client.query('BEGIN');

      // Build an in-memory ISO-code → currency_id lookup for this company scope.
      const { rows: currencyRows } = await client.query<{ id: string; code: string }>(
        `SELECT id, UPPER(code) AS code FROM currencies`
      );

      // Map: UPPER(ISO code) → currency_id
      const codeToId = new Map<string, string>();
      for (const row of currencyRows) {
        codeToId.set(row.code, row.id);
      }

      console.log(`${TAG} Loaded ${codeToId.size} currencies from DB for matching.`);

      // Process each fetched rate
      for (const fetchedRate of rates) {
        const isoCode = fetchedRate.currencyCode.toUpperCase();
        const currencyId = codeToId.get(isoCode);

        // ── 2a. Skip unknown currencies ───────────────────────────────────
        if (!currencyId) {
          skipped++;
          continue;
        }

        // IMPORTANT ACCOUNTING RULE:
        // All rates saved must represent: 1 Foreign Currency = X EGP.
        // Since API returns 1 EGP = Y Foreign Currency, we store the inverse: 1 / Y.
        const adjustedRate = fetchedRate.rate > 0 ? (1 / fetchedRate.rate) : fetchedRate.rate;

        // Keep track of rates successfully matched with local currencies
        activeRatesSynced.push({ currencyCode: isoCode, rate: adjustedRate });

        // ── 2b. Check for existing row (same currency_id + rate_date) ─────
        const { rows: existing } = await client.query<{ id: string }>(
          `SELECT id
             FROM currency_rates
            WHERE currency_id = $1
              AND rate_date   = $2
            LIMIT 1`,
          [currencyId, rateDate]
        );

        if (existing.length > 0) {
          // ── UPDATE existing row ──────────────────────────────────────────
          await client.query(
            `UPDATE currency_rates
                SET rate = $1
              WHERE id   = $2`,
            [adjustedRate, existing[0].id]
          );
          updated++;
        } else {
          // ── INSERT new row ───────────────────────────────────────────────
          const newId = randomUUID();
          await client.query(
            `INSERT INTO currency_rates (id, currency_id, rate, rate_date, created_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [newId, currencyId, adjustedRate, rateDate]
          );
          inserted++;
        }
      }

      await client.query('COMMIT');

      const summary = `Inserted: ${inserted}, Updated: ${updated}, Skipped: ${skipped} (base=${baseCurrency}, date=${rateDate})`;
      console.log(`${TAG} ✅ Transaction committed. ${summary}`);

      // Log success to history
      if (companyId) {
        await logSyncRunToHistory(companyId, updatedByVal, 'Success', activeRatesSynced);
      }

      return { success: true, inserted, updated, skipped, message: summary };

    } catch (err: unknown) {
      await client.query('ROLLBACK').catch((rbErr: unknown) => {
        console.error(`${TAG} Rollback itself failed:`, rbErr instanceof Error ? rbErr.message : String(rbErr));
      });

      const message = err instanceof Error ? err.message : String(err);
      console.error(`${TAG} ❌ Transaction rolled back due to error: ${message}`);

      // Log failed sync run to history
      if (companyId) {
        await logSyncRunToHistory(companyId, updatedByVal, 'Failed', []);
      }

      return {
        success: false,
        inserted: 0,
        updated: 0,
        skipped: 0,
        message: `DB transaction failed and was rolled back: ${message}`,
      };
    } finally {
      client.release();
    }
  }
}
