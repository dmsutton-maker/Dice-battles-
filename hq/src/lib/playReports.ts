import { inflateRawSync } from 'node:zlib';

/**
 * Google Play downloads and sales, from the reports Google Play keeps in a Cloud Storage bucket for
 * the developer account (Play Console, Download reports). Used by /api/cron/play-reports, which
 * stores them in `play_installs` and `play_sales` for David's sales dashboard.
 *
 * No key file exists anywhere. On Vercel every function request carries a short-lived OIDC token
 * (the `x-vercel-oidc-token` header) saying which team, project and environment it is; Google
 * Cloud's Workload Identity Federation accepts that token in exchange for a Google token, which may
 * act as one service account, `play-reports`. That account can do nothing in Google Cloud; Play
 * Console lets it read the account's reports (View app information and download bulk reports, and
 * View financial data, both read-only). It cannot change an app, a listing or a price.
 *
 * Settings, in Vercel's environment variables. None is a secret, but this repository is public and
 * they describe David's accounts, so they live there rather than here:
 *   PLAY_REPORTS_BUCKET       the bucket, from Play Console's "Copy Cloud Storage URI"
 *                             (pubsite_prod_rev_...; a whole gs:// URI is fine too). Play
 *                             Console only shows that button once Google has made the account's
 *                             first monthly report, so this may also be several names separated
 *                             by commas, tried in turn: the first one that can be read is used,
 *                             and the run says which.
 *   PLAY_REPORTS_WIF_PROVIDER the Workload Identity provider: projects/<number>/locations/global/
 *                             workloadIdentityPools/<pool>/providers/<provider>
 *   PLAY_REPORTS_ACCOUNT      the service account's email
 */

/** The account's apps by Android package. A package not named here is shown by its package name. */
export const PLAY_APPS: Record<string, string> = {
  'com.papershipstudio.vectorfaces': 'Vector Faces',
  'com.dmsutton.dicebattles': 'Dice Battles: Color Rush',
};

export function playAppName(pkg: string): string {
  if (PLAY_APPS[pkg]) return PLAY_APPS[pkg];
  if (/leasedash/i.test(pkg)) return 'LeaseDash CRM';
  return pkg;
}

/** Google Play's service fee on the first US$1M a year: what the sales estimate takes off. */
export const PLAY_FEE = 0.15;

export interface PlaySettings {
  /** The bucket names to try, in order (usually one). */
  buckets: string[];
  provider: string;
  account: string;
}

/** Bucket names from PLAY_REPORTS_BUCKET: one, or several separated by commas or spaces. */
export function bucketNames(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map((v) => v.trim().replace(/^gs:\/\//, '').split('/')[0])
    .filter(Boolean);
}

/** The sign-in settings; null until both are set. The bucket list may still be empty. */
export function playSettings(): PlaySettings | null {
  const buckets = bucketNames(process.env.PLAY_REPORTS_BUCKET ?? '');
  const provider = (process.env.PLAY_REPORTS_WIF_PROVIDER ?? '').trim().replace(/^\/\/iam\.googleapis\.com\//, '');
  const account = (process.env.PLAY_REPORTS_ACCOUNT ?? '').trim();
  if (!provider || !account) return null;
  return { buckets, provider, account };
}

/** The claims in a JWT, without checking it (only to say what the token is, never to trust it). */
export function jwtClaims(token: string): Record<string, unknown> | null {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

async function googleError(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const body = JSON.parse(text) as { error?: string | { message?: string }; error_description?: string };
    if (typeof body.error === 'string') return `${body.error}${body.error_description ? `: ${body.error_description}` : ''}`;
    if (body.error?.message) return body.error.message;
  } catch {
    // Not JSON.
  }
  return `HTTP ${response.status} ${text.slice(0, 300)}`;
}

/** A Google access token that reads Cloud Storage as the play-reports service account. */
export async function googleToken(oidcToken: string, settings: PlaySettings): Promise<string> {
  const exchange = await fetch('https://sts.googleapis.com/v1/token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grantType: 'urn:ietf:params:oauth:grant-type:token-exchange',
      audience: `//iam.googleapis.com/${settings.provider}`,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token',
      subjectTokenType: 'urn:ietf:params:oauth:token-type:jwt',
      subjectToken: oidcToken,
    }),
    cache: 'no-store',
  });
  if (!exchange.ok) throw new Error(`Google refused Vercel's token (${await googleError(exchange)}).`);
  const federated = ((await exchange.json()) as { access_token?: string }).access_token;
  if (!federated) throw new Error("Google's token exchange gave no token.");

  const impersonate = await fetch(
    `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(settings.account)}:generateAccessToken`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${federated}`, 'content-type': 'application/json' },
      body: JSON.stringify({ scope: ['https://www.googleapis.com/auth/devstorage.read_only'], lifetime: '600s' }),
      cache: 'no-store',
    },
  );
  if (!impersonate.ok) {
    throw new Error(`Google would not let this site act as ${settings.account} (${await googleError(impersonate)}).`);
  }
  const token = ((await impersonate.json()) as { accessToken?: string }).accessToken;
  if (!token) throw new Error('Google gave no service account token.');
  return token;
}

export interface BucketObject {
  name: string;
  updated: string;
}

/** Every object in the bucket under `prefix`. */
export async function listObjects(token: string, bucket: string, prefix: string): Promise<BucketObject[]> {
  const found: BucketObject[] = [];
  let page = '';
  for (let i = 0; i < 20; i += 1) {
    const params = new URLSearchParams({ prefix, fields: 'items(name,updated),nextPageToken' });
    if (page) params.set('pageToken', page);
    const response = await fetch(`https://storage.googleapis.com/storage/v1/b/${bucket}/o?${params}`, {
      headers: { authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Could not list ${prefix} (${await googleError(response)}).`);
    const body = (await response.json()) as { items?: BucketObject[]; nextPageToken?: string };
    found.push(...(body.items ?? []));
    if (!body.nextPageToken) break;
    page = body.nextPageToken;
  }
  return found;
}

export async function readObject(token: string, bucket: string, name: string): Promise<Buffer> {
  const response = await fetch(
    `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(name)}?alt=media`,
    { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' },
  );
  if (!response.ok) throw new Error(`Could not read ${name} (${await googleError(response)}).`);
  return Buffer.from(await response.arrayBuffer());
}

/** Google's report text: the installs files are UTF-16 with a byte-order mark, the rest UTF-8. */
export function decodeText(data: Buffer): string {
  if (data[0] === 0xff && data[1] === 0xfe) return data.subarray(2).toString('utf16le');
  if (data[0] === 0xfe && data[1] === 0xff) {
    const swapped = Buffer.from(data.subarray(2));
    swapped.swap16();
    return swapped.toString('utf16le');
  }
  if (data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf) return data.subarray(3).toString('utf8');
  // UTF-16 without a mark: every other byte of plain text is zero.
  const sample = data.subarray(0, 200);
  let zeros = 0;
  for (let i = 1; i < sample.length; i += 2) if (sample[i] === 0) zeros += 1;
  if (sample.length > 10 && zeros > sample.length / 4) return data.toString('utf16le');
  return data.toString('utf8');
}

/** A comma-separated file into rows of cells, with quoted cells as RFC 4180 has them. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell);
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

/** Rows as objects keyed by the header's names, lower-cased and trimmed. */
export function csvObjects(text: string): Record<string, string>[] {
  const [header, ...rows] = parseCsv(text);
  if (!header) return [];
  const names = header.map((h) => h.trim().toLowerCase());
  return rows.map((cells) => Object.fromEntries(names.map((n, i) => [n, (cells[i] ?? '').trim()])));
}

/** The files in a .zip (stored or deflated, which is all Google's reports use). */
export function unzip(data: Buffer): { name: string; data: Buffer }[] {
  let end = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 65557); i -= 1) {
    if (data.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error('not a zip file');
  const count = data.readUInt16LE(end + 10);
  let at = data.readUInt32LE(end + 16);
  const files: { name: string; data: Buffer }[] = [];
  for (let n = 0; n < count; n += 1) {
    if (data.readUInt32LE(at) !== 0x02014b50) throw new Error('damaged zip directory');
    const method = data.readUInt16LE(at + 10);
    const size = data.readUInt32LE(at + 20);
    const nameLength = data.readUInt16LE(at + 28);
    const extraLength = data.readUInt16LE(at + 30);
    const commentLength = data.readUInt16LE(at + 32);
    const local = data.readUInt32LE(at + 42);
    const name = data.subarray(at + 46, at + 46 + nameLength).toString('utf8');
    at += 46 + nameLength + extraLength + commentLength;
    if (data.readUInt32LE(local) !== 0x04034b50) throw new Error('damaged zip entry');
    const start = local + 30 + data.readUInt16LE(local + 26) + data.readUInt16LE(local + 28);
    const packed = data.subarray(start, start + size);
    if (method === 0) files.push({ name, data: Buffer.from(packed) });
    else if (method === 8) files.push({ name, data: inflateRawSync(packed) });
    else throw new Error(`zip method ${method} is not supported`);
  }
  return files;
}

function count(value: string | undefined): number | null {
  if (value == null || value.trim() === '') return null;
  const n = Number(value.replace(/,/g, ''));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function money(value: string | undefined): number {
  const n = Number((value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

/** A report date as YYYY-MM-DD ("2026-11-15", or "Nov 15, 2026" as some reports write it). */
export function isoDay(value: string): string | null {
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const parsed = Date.parse(`${v} 12:00 UTC`);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : null;
}

export interface InstallRow {
  app_name: string;
  day: string;
  daily_user_installs: number | null;
  daily_device_installs: number | null;
  install_events: number | null;
  daily_user_uninstalls: number | null;
  active_device_installs: number | null;
}

const INSTALL_FIELDS: [keyof InstallRow, string[]][] = [
  ['daily_user_installs', ['daily user installs']],
  ['daily_device_installs', ['daily device installs']],
  ['install_events', ['install events']],
  ['daily_user_uninstalls', ['daily user uninstalls']],
  ['active_device_installs', ['installs on active devices', 'active device installs']],
];

/**
 * One app's month of installs. The overview file has a row a day; a dimension file (by country,
 * say) has a row a day for each country, so its rows are added up into one a day. Either way, a
 * number Google leaves out stays null rather than becoming a zero.
 */
export function parseInstalls(text: string, pkg: string): InstallRow[] {
  const byDay = new Map<string, InstallRow>();
  for (const r of csvObjects(text)) {
    const day = isoDay(r['date'] ?? '');
    if (!day) continue;
    const row =
      byDay.get(day) ??
      ({
        app_name: playAppName(pkg),
        day,
        daily_user_installs: null,
        daily_device_installs: null,
        install_events: null,
        daily_user_uninstalls: null,
        active_device_installs: null,
      } as InstallRow);
    for (const [field, names] of INSTALL_FIELDS) {
      const name = names.find((n) => n in r);
      const value = name ? count(r[name]) : null;
      if (value != null) (row[field] as number | null) = ((row[field] as number | null) ?? 0) + value;
    }
    byDay.set(day, row);
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

export interface SaleRow {
  order_number: string;
  financial_status: string;
  sku_id: string;
  day: string;
  package: string;
  app_name: string;
  product_title: string;
  product_type: string;
  currency: string;
  item_price: number;
  taxes: number;
  charged_amount: number;
  country: string;
  est_proceeds: number;
}

/** A month's estimated sales report: every order line, in the buyer's currency. */
export function parseSales(text: string): SaleRow[] {
  const rows: SaleRow[] = [];
  const seen = new Set<string>();
  for (const r of csvObjects(text)) {
    const order = r['order number'] ?? '';
    const day = isoDay(r['order charged date'] ?? '');
    const pkg = r['package id'] ?? r['product id'] ?? '';
    if (!order || !day || !pkg) continue;
    const status = (r['financial status'] ?? '').trim();
    const sku = r['sku id'] ?? '';
    const key = `${order}\u0000${status}\u0000${sku}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const price = money(r['item price']);
    rows.push({
      order_number: order,
      financial_status: status,
      sku_id: sku,
      day,
      package: pkg,
      app_name: playAppName(pkg),
      product_title: r['product title'] ?? '',
      product_type: r['product type'] ?? '',
      currency: r['currency of sale'] ?? '',
      item_price: price,
      taxes: money(r['taxes collected']),
      charged_amount: money(r['charged amount']),
      country: r['country of buyer'] ?? '',
      est_proceeds: Math.round(price * (1 - PLAY_FEE) * 100) / 100,
    });
  }
  return rows;
}

/** The YYYYMM in a report's file name, or null. */
export function fileMonth(name: string): string | null {
  const m = name.match(/_(\d{6})(?:_[a-z_]+)?\.(?:csv|zip)$/i);
  return m ? m[1] : null;
}

/** The package and dimension in an installs file name: installs_<package>_<YYYYMM>_<dimension>.csv */
export function installsFile(name: string): { pkg: string; month: string; dimension: string } | null {
  const m = name.match(/(?:^|\/)installs_(.+)_(\d{6})_([a-z_]+)\.csv$/i);
  return m ? { pkg: m[1], month: m[2], dimension: m[3].toLowerCase() } : null;
}

/** The months from `back` months before `now` to now, as YYYYMM. */
export function recentMonths(now: Date, back: number): string[] {
  const out: string[] = [];
  for (let i = back; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(`${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

/**
 * Of an app-month's installs files, the one to read: the overview if Google made one, otherwise
 * the country file (every install has exactly one country, so its sum is the whole).
 */
export function pickInstallFiles(names: string[], months: Set<string>): Map<string, { pkg: string; month: string; name: string }> {
  const chosen = new Map<string, { pkg: string; month: string; name: string; rank: number }>();
  const rankOf = (dimension: string) => (dimension === 'overview' ? 0 : dimension === 'country' ? 1 : -1);
  for (const name of names) {
    const f = installsFile(name);
    if (!f || !months.has(f.month)) continue;
    const rank = rankOf(f.dimension);
    if (rank < 0) continue;
    const key = `${f.pkg}|${f.month}`;
    const had = chosen.get(key);
    if (!had || rank < had.rank) chosen.set(key, { pkg: f.pkg, month: f.month, name, rank });
  }
  return new Map([...chosen].map(([k, { pkg, month, name }]) => [k, { pkg, month, name }]));
}
