import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Exchange rates, so every sale can be counted in US dollars.
 *
 * David, 24 Nov 2026: "if money came in from other country just convert to usd". Apple's and
 * Google's reports give each sale in the currency the store pays it in (a sale in Israel arrives
 * in shekels), so the daily sales jobs call `ensureRates` after copying the reports. It finds
 * every currency and day the reports mention that has no rate yet, and stores what one unit was
 * worth in dollars on that day in `fx_rates`. The SQL function `to_usd()` does the converting.
 *
 * Where the rates come from, in order:
 *   1. Frankfurter (api.frankfurter.dev), the European Central Bank's daily reference rates, about
 *      30 currencies, one request for a whole range of days. No key.
 *   2. For a currency the ECB does not publish, the open currency-api dataset (jsDelivr, with
 *      Cloudflare Pages as its mirror), one request per day. No key.
 * The ECB publishes nothing on weekends and holidays; `to_usd()` then uses the day before.
 * These are market rates, not the stores' own payout rates, so a converted total is close to,
 * not exactly, what the bank account receives.
 */

export interface RateRow {
  day: string;
  currency: string;
  usd_per_unit: number;
  source: string;
}

export interface Needed {
  currency: string;
  day: string;
}

/** Frankfurter's answer for base=USD (units of each currency per dollar) as dollars per unit. */
export function parseFrankfurter(json: unknown): RateRow[] {
  const rates = (json as { rates?: Record<string, Record<string, number>> })?.rates;
  if (!rates || typeof rates !== 'object') return [];
  const rows: RateRow[] = [];
  for (const [day, byCurrency] of Object.entries(rates)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !byCurrency) continue;
    for (const [currency, perUsd] of Object.entries(byCurrency)) {
      if (typeof perUsd === 'number' && perUsd > 0) {
        rows.push({ day, currency: currency.toUpperCase(), usd_per_unit: 1 / perUsd, source: 'ECB (Frankfurter)' });
      }
    }
  }
  return rows;
}

/** currency-api's answer for one day (`{date, usd: {ils: 3.7, ...}}`), for the currencies asked. */
export function parseCurrencyApi(json: unknown, day: string, wanted: string[]): RateRow[] {
  const usd = (json as { usd?: Record<string, number> })?.usd;
  if (!usd) return [];
  const rows: RateRow[] = [];
  for (const currency of wanted) {
    const perUsd = usd[currency.toLowerCase()];
    if (typeof perUsd === 'number' && perUsd > 0) {
      rows.push({ day, currency: currency.toUpperCase(), usd_per_unit: 1 / perUsd, source: 'currency-api' });
    }
  }
  return rows;
}

/** A three-letter ISO 4217 code that is not the dollar. */
export function convertible(currency: string | null | undefined): currency is string {
  return !!currency && /^[A-Z]{3}$/.test(currency.toUpperCase()) && currency.toUpperCase() !== 'USD';
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/** The (currency, day) pairs the sales tables use that have no rate stored on or before that day. */
async function neededPairs(supabase: SupabaseClient): Promise<Needed[]> {
  const [apple, play, have] = await Promise.all([
    supabase.from('app_sales').select('report_date, proceeds_currency, customer_currency').limit(50000),
    supabase.from('play_sales').select('day, currency').limit(50000),
    supabase.from('fx_rates').select('currency, day').limit(50000),
  ]);
  const stored = new Set((have.data ?? []).map((r) => `${r.currency}|${r.day}`));
  const pairs = new Map<string, Needed>();
  const want = (currency: string | null, day: string | null) => {
    if (!convertible(currency) || !day) return;
    const c = currency.toUpperCase();
    const key = `${c}|${day}`;
    if (!stored.has(key)) pairs.set(key, { currency: c, day });
  };
  for (const r of apple.data ?? []) {
    want(r.proceeds_currency, r.report_date);
    want(r.customer_currency, r.report_date);
  }
  for (const r of play.data ?? []) want(r.currency, r.day);
  return [...pairs.values()];
}

/** The day before `day`, as YYYY-MM-DD. */
function dayBefore(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * Stores a rate for every currency and day the sales tables mention and lack. Never throws: what
 * went wrong comes back as one sentence for the job's message.
 */
export async function ensureRates(supabase: SupabaseClient): Promise<{ written: number; message: string }> {
  try {
    const needed = await neededPairs(supabase);
    if (needed.length === 0) return { written: 0, message: 'Exchange rates: up to date.' };

    const currencies = [...new Set(needed.map((n) => n.currency))].sort();
    const days = needed.map((n) => n.day).sort();
    // A week before the first day, so a weekend or holiday still has an earlier ECB rate.
    const from = dayBefore(days[0], 7);
    const to = days[days.length - 1];

    const rows = new Map<string, RateRow>();
    const problems: string[] = [];
    try {
      const json = await getJson(
        `https://api.frankfurter.dev/v1/${from}..${to}?base=USD&symbols=${currencies.join(',')}`,
      );
      for (const r of parseFrankfurter(json)) rows.set(`${r.currency}|${r.day}`, r);
    } catch (err) {
      problems.push(`ECB rates: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Anything the ECB had no rate for at all, day by day from the second source.
    const covered = new Set([...rows.values()].map((r) => r.currency));
    const missing = needed.filter((n) => !covered.has(n.currency));
    const missingDays = [...new Set(missing.map((n) => n.day))].slice(0, 40);
    for (const day of missingDays) {
      const wanted = [...new Set(missing.filter((n) => n.day === day).map((n) => n.currency))];
      let got = false;
      for (const url of [
        `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${day}/v1/currencies/usd.min.json`,
        `https://${day}.currency-api.pages.dev/v1/currencies/usd.min.json`,
      ]) {
        try {
          for (const r of parseCurrencyApi(await getJson(url), day, wanted)) rows.set(`${r.currency}|${r.day}`, r);
          got = true;
          break;
        } catch {
          // try the mirror
        }
      }
      if (!got) problems.push(`no rate for ${wanted.join(', ')} on ${day}`);
    }

    const list = [...rows.values()];
    if (list.length) {
      const { error } = await supabase.from('fx_rates').upsert(list, { onConflict: 'currency,day' });
      if (error) problems.push(`saving rates: ${error.message}`);
    }
    return {
      written: list.length,
      message: `Exchange rates: ${list.length} stored for ${currencies.join(', ')}.${problems.length ? ` ${problems.join('; ')}.` : ''}`,
    };
  } catch (err) {
    return { written: 0, message: `Exchange rates: ${err instanceof Error ? err.message : String(err)}.` };
  }
}
