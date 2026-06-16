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

// ─── Service ──────────────────────────────────────────────────────────────────

export class ExchangeRatePersistenceService {
  /**
   * Fetch the latest exchange rates and persist them to `currency_rates`.
   *
   * Algorithm per fetched currency code:
   *   1. Look up `currencies` table by ISO code (case-insensitive).
   *   2. If no match → skip + warn (never create a dangling FK row).
   *   3. If match exists, check `currency_rates` for (currency_id, rate_date).
   *      a. Row exists  → UPDATE rate  (updated++)
   *      b. No row      → INSERT       (inserted++)
   *
   * The entire set of DB mutations runs inside a single transaction.
   * Any DB error causes a full ROLLBACK and the function returns success=false.
   *
   * @param fetchOptions  Passed verbatim to ExchangeRateService (base currency, timeout).
   * @returns             Strongly-typed { success, inserted, updated, skipped, message }
   *
   * @example
   * ```ts
   * const result = await ExchangeRatePersistenceService.persistLatestRates({ baseCurrency: 'EGP' });
   * if (result.success) {
   *   console.log(`Inserted: ${result.inserted}, Updated: ${result.updated}, Skipped: ${result.skipped}`);
   * }
   * ```
   */
  static async persistLatestRates(
    fetchOptions: ExchangeRateFetchOptions = {}
  ): Promise<PersistRatesResult> {

    // ── Step 1: Fetch rates from external API ─────────────────────────────
    console.log(`${TAG} Starting fetch-and-persist cycle (base=${fetchOptions.baseCurrency ?? 'EGP'})…`);

    const fetchResult = await ExchangeRateService.fetchLatestRates(fetchOptions);

    if (!fetchResult.success) {
      // Explicitly narrow to the failure branch – control-flow narrowing of a
      // structurally-inferred discriminated union is not guaranteed in this
      // tsconfig (no "strict", bundler moduleResolution).
      const failure = fetchResult as Extract<ExchangeRateFetchResult, { success: false }>;
      console.error(`${TAG} Fetch failed [${failure.error}]: ${failure.message}`);
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

    try {
      await client.query('BEGIN');

      // Build an in-memory ISO-code → currency_id lookup for this company scope.
      // We read ALL rows from `currencies` once to minimise round-trips.
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
          console.warn(
            `${TAG} ⚠️  Skipping unknown currency: ${isoCode} (not found in currencies table)`
          );
          skipped++;
          continue;
        }

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
            [fetchedRate.rate, existing[0].id]
          );
          updated++;
          console.log(
            `${TAG}   ↻ Updated  ${isoCode} → rate=${fetchedRate.rate} (id=${existing[0].id})`
          );
        } else {
          // ── INSERT new row ───────────────────────────────────────────────
          const newId = randomUUID();
          await client.query(
            `INSERT INTO currency_rates (id, currency_id, rate, rate_date, created_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [newId, currencyId, fetchedRate.rate, rateDate]
          );
          inserted++;
          console.log(
            `${TAG}   + Inserted ${isoCode} → rate=${fetchedRate.rate} (id=${newId})`
          );
        }
      }

      await client.query('COMMIT');

      const summary = `Inserted: ${inserted}, Updated: ${updated}, Skipped: ${skipped} (base=${baseCurrency}, date=${rateDate})`;
      console.log(`${TAG} ✅ Transaction committed. ${summary}`);

      return { success: true, inserted, updated, skipped, message: summary };

    } catch (err: unknown) {
      // ── Rollback on any DB failure ────────────────────────────────────────
      await client.query('ROLLBACK').catch((rbErr: unknown) => {
        // Swallow secondary errors during rollback to preserve the original
        console.error(`${TAG} Rollback itself failed:`, rbErr instanceof Error ? rbErr.message : String(rbErr));
      });

      const message = err instanceof Error ? err.message : String(err);
      console.error(`${TAG} ❌ Transaction rolled back due to error: ${message}`);

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
