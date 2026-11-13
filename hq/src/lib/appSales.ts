import { createPrivateKey, sign } from 'node:crypto';
import { gunzipSync } from 'node:zlib';

/**
 * App Store sales for the studio's apps, from Apple's Sales and Trends daily summary report
 * (App Store Connect API, /v1/salesReports). Used by /api/cron/app-sales, which stores them in
 * `app_sales` for /admin/sales and David's sales dashboard.
 *
 * Needs, in Vercel's environment variables (never in this public repository):
 *   ASC_KEY_ID, ASC_ISSUER_ID   the App Store Connect API key's ids
 *   ASC_PRIVATE_KEY             the key's .p8 file, pasted in as it is (or ASC_PRIVATE_KEY_B64,
 *                               the same file base64-encoded)
 *   ASC_VENDOR_NUMBER           the account's vendor number (Payments and Financial Reports)
 * A key with only the "Sales" role is enough: this file only ever reads sales reports.
 */

/** The studio's apps, by App Store id. Other apps on the same Apple account are left out. */
export const STUDIO_APPS: Record<string, string> = {
  '6832990414': 'Vector Faces',
  '6802287913': 'Dice Battles: Color Rush',
};

/** Each app's SKU, which is how Apple's report names the app an in-app purchase belongs to. */
const APP_BY_SKU: Record<string, string> = {
  vectorfaces: '6832990414',
  DICEBATTLES001: '6802287913',
};

export type SaleKind =
  | 'paid_download'
  | 'free_download'
  | 'redownload'
  | 'update'
  | 'in_app_purchase'
  | 'other';

export interface SaleRow {
  app_apple_id: string;
  app_name: string;
  item_apple_id: string;
  item_title: string;
  sku: string;
  product_type: string;
  kind: SaleKind;
  units: number;
  customer_price: number;
  customer_currency: string;
  proceeds: number;
  proceeds_currency: string;
  country: string;
  device: string;
  promo_code: string;
}

/** What one day's report said. `unavailable` means Apple has not published that day yet. */
export type DayReport =
  | { status: 'ok'; rows: SaleRow[] }
  | { status: 'unavailable'; message: string }
  | { status: 'error'; message: string };

/** What an Apple Product Type Identifier means here. */
export function saleKind(productType: string, customerPrice: number): SaleKind {
  const t = productType.trim().toUpperCase();
  if (t.startsWith('IA') || t.startsWith('FI')) return 'in_app_purchase';
  if (['1', '1F', '1T', '1E', '1EP', '1EU', 'F1'].includes(t)) {
    return customerPrice > 0 ? 'paid_download' : 'free_download';
  }
  if (['3', '3F', '3T', 'F3'].includes(t)) return 'redownload';
  if (['7', '7F', '7T', 'F7'].includes(t)) return 'update';
  return 'other';
}

export function ascConfigured(): boolean {
  return Boolean(
    process.env.ASC_KEY_ID &&
      process.env.ASC_ISSUER_ID &&
      (process.env.ASC_PRIVATE_KEY || process.env.ASC_PRIVATE_KEY_B64) &&
      process.env.ASC_VENDOR_NUMBER,
  );
}

function base64url(data: Buffer | string): string {
  return Buffer.from(data).toString('base64url');
}

/** A 15-minute App Store Connect token (ES256), as Apple's API asks. */
function ascToken(): string {
  const header = { alg: 'ES256', kid: process.env.ASC_KEY_ID, typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: process.env.ASC_ISSUER_ID, iat: now, exp: now + 900, aud: 'appstoreconnect-v1' };
  const input = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  // Pasted into Vercel, the .p8's line breaks sometimes arrive as the two characters "\\n".
  const pem = process.env.ASC_PRIVATE_KEY
    ? process.env.ASC_PRIVATE_KEY.replace(/\\n/g, '\n')
    : Buffer.from(process.env.ASC_PRIVATE_KEY_B64 ?? '', 'base64').toString('utf8');
  const key = createPrivateKey(pem);
  const signature = sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' });
  return `${input}.${base64url(signature)}`;
}

function number(text: string | undefined): number {
  const value = Number((text ?? '').trim());
  return Number.isFinite(value) ? value : 0;
}

/** Apple's tab-separated report into the studio's rows; other apps' rows are dropped. */
export function parseSalesReport(text: string): SaleRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length < 2) return [];
  const header = lines[0].split('\t').map((h) => h.trim());
  const rows: SaleRow[] = [];
  for (const line of lines.slice(1)) {
    const cells = line.split('\t');
    const cell = (name: string) => (cells[header.indexOf(name)] ?? '').trim();
    const item = cell('Apple Identifier');
    const app = STUDIO_APPS[item] ? item : (APP_BY_SKU[cell('Parent Identifier')] ?? '');
    if (!STUDIO_APPS[app]) continue;
    const price = number(cell('Customer Price'));
    rows.push({
      app_apple_id: app,
      app_name: STUDIO_APPS[app],
      item_apple_id: item,
      item_title: cell('Title'),
      sku: cell('SKU'),
      product_type: cell('Product Type Identifier'),
      kind: saleKind(cell('Product Type Identifier'), price),
      units: Math.trunc(number(cell('Units'))),
      customer_price: price,
      customer_currency: cell('Customer Currency'),
      proceeds: number(cell('Developer Proceeds')),
      proceeds_currency: cell('Currency of Proceeds'),
      country: cell('Country Code'),
      device: cell('Device'),
      promo_code: cell('Promo Code'),
    });
  }
  return rows;
}

/** One day's sales (`day` is YYYY-MM-DD, Pacific time, as Apple's reports are). */
export async function fetchDay(day: string): Promise<DayReport> {
  const params = new URLSearchParams({
    'filter[frequency]': 'DAILY',
    'filter[reportType]': 'SALES',
    'filter[reportSubType]': 'SUMMARY',
    'filter[version]': '1_0',
    'filter[reportDate]': day,
    'filter[vendorNumber]': process.env.ASC_VENDOR_NUMBER ?? '',
  });
  const response = await fetch(`https://api.appstoreconnect.apple.com/v1/salesReports?${params}`, {
    headers: { Authorization: `Bearer ${ascToken()}`, Accept: 'application/a-gzip' },
    cache: 'no-store',
  });
  if (response.ok) {
    const text = gunzipSync(Buffer.from(await response.arrayBuffer())).toString('utf8');
    return { status: 'ok', rows: parseSalesReport(text) };
  }
  let message = `HTTP ${response.status}`;
  try {
    const body = (await response.json()) as { errors?: { detail?: string; title?: string }[] };
    message = body.errors?.map((e) => e.detail || e.title).join('; ') || message;
  } catch {
    // Not JSON; the status says enough.
  }
  // Apple answers 404 both for a day with no sales (a real zero) and for a day not published yet.
  if (response.status === 404 && /no sales/i.test(message)) return { status: 'ok', rows: [] };
  if (response.status === 404 && /not available yet/i.test(message)) {
    return { status: 'unavailable', message };
  }
  return { status: 'error', message };
}

/** Today's date in California, YYYY-MM-DD: Apple's report days are Pacific days. */
export function pacificToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** `count` days ending the day before `today`, newest first. */
export function daysBefore(today: string, count: number): string[] {
  const start = new Date(`${today}T12:00:00Z`);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() - (i + 1));
    return d.toISOString().slice(0, 10);
  });
}
