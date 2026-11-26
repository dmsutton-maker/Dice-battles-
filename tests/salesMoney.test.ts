import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, assertEqual, suite, test } from './harness';
import * as fx from '../hq/src/lib/fxRates';
import * as admob from '../hq/src/lib/admob';

/**
 * David, 24 Nov 2026: "the total dollars should be global money ... if money came in from other
 * country just convert to usd. also can the dice battles also check revenue that comes from ads
 * as well?" The jobs need the network and Supabase, so they are read as source; what they read
 * answers with is pure and is run here on answers shaped like the services' documented ones.
 */

const root = join(__dirname, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

suite('sales money: exchange rates', () => {
  test('Frankfurter units-per-dollar become dollars per unit', () => {
    const rows = fx.parseFrankfurter({
      amount: 1, base: 'USD', start_date: '2026-11-16', end_date: '2026-11-17',
      rates: { '2026-11-16': { ILS: 3.75, EUR: 0.8 }, '2026-11-17': { ILS: 3.7 } },
    });
    assertEqual(rows.length, 3, 'three rates');
    const ils = rows.find((r) => r.currency === 'ILS' && r.day === '2026-11-16')!;
    assert(Math.abs(ils.usd_per_unit - 1 / 3.75) < 1e-12, 'one shekel is 1/3.75 dollars');
    assertEqual(fx.parseFrankfurter({ message: 'not found' }).length, 0, 'an error answer gives nothing');
  });
  test('currency-api keeps only the currencies asked for', () => {
    const rows = fx.parseCurrencyApi({ date: '2026-11-16', usd: { ils: 3.75, vnd: 25000, eur: 0.8 } }, '2026-11-16', ['VND']);
    assertEqual(rows.length, 1, 'one');
    assertEqual(rows[0].currency, 'VND', 'upper case');
  });
  test('dollars and blanks are never looked up', () => {
    assert(!fx.convertible('USD') && !fx.convertible('') && !fx.convertible(null), 'not convertible');
    assert(fx.convertible('ILS') && fx.convertible('eur'), 'convertible');
  });
  test('both daily jobs fetch the rates, and the migration converts with the nearest earlier day', () => {
    assert(read('hq/src/app/api/cron/app-sales/route.ts').includes('ensureRates(supabase)'), 'app-sales');
    assert(read('hq/src/app/api/cron/play-reports/route.ts').includes('ensureRates(supabase)'), 'play-reports');
    const sql = read('hq/supabase/migrations/20261124_fx_and_admob.sql');
    assert(/r\.day <= on_day\s+order by r\.day desc/.test(sql), 'earlier rate first');
  });
});

suite('sales money: AdMob', () => {
  test('a network report becomes one row per app and day, in dollars', () => {
    const rows = admob.parseNetworkReport([
      { header: { localizationSettings: { currencyCode: 'USD' } } },
      { row: {
        dimensionValues: { DATE: { value: '20261125' }, APP: { value: 'ca-app-pub-1~2', displayLabel: 'Dice Battles: Color Rush' }, PLATFORM: { value: 'iOS' } },
        metricValues: { ESTIMATED_EARNINGS: { microsValue: '1234567' }, IMPRESSIONS: { integerValue: '40' }, AD_REQUESTS: { integerValue: '50' }, MATCHED_REQUESTS: { integerValue: '45' } },
      } },
      { footer: { matchingRowCount: '1' } },
    ]);
    assertEqual(rows.length, 1, 'one row');
    assertEqual(rows[0].day, '2026-11-25', 'day');
    assertEqual(rows[0].app_name, 'Dice Battles: Color Rush', 'name');
    assert(Math.abs(rows[0].earnings_usd - 1.234567) < 1e-9, 'micros to dollars');
    assertEqual(rows[0].impressions, 40, 'impressions');
  });
  test('the sign-in is read-only and asks for a refresh token', () => {
    const url = admob.consentUrl({ clientId: 'id', clientSecret: 's', redirectUri: admob.DEFAULT_REDIRECT }, 'st');
    assert(url.includes(encodeURIComponent('https://www.googleapis.com/auth/admob.readonly')), 'readonly scope');
    assert(url.includes('access_type=offline') && url.includes('prompt=consent'), 'offline');
  });
  test('the report asks AdMob for US dollars', () => {
    const body = admob.reportBody(new Date('2026-11-24T12:00:00Z'), 35);
    assertEqual(body.reportSpec.localizationSettings.currencyCode, 'USD', 'USD');
    assertEqual(body.reportSpec.dateRange.startDate.day, 21, 'five weeks back');
  });
  test('the refresh token is kept where only the server reads it', () => {
    const sql = read('hq/supabase/migrations/20261124_fx_and_admob.sql');
    assert(sql.includes('alter table public.studio_secrets enable row level security'), 'rls');
    assert(!/create policy[^;]*studio_secrets/i.test(sql), 'no policies');
  });
});
