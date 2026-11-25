import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Ad money from AdMob, for David's sales dashboard.
 *
 * David, 24 Nov 2026: "can the dice battles also check revenue that comes from ads as well?"
 * Dice Battles shows an interstitial every third finished game (iOS and Android), and AdMob keeps
 * what those earn. The daily sales job (/api/cron/app-sales) calls `syncAdmob`, which reads
 * AdMob's network report (estimated earnings, impressions and requests per app, platform and day,
 * converted to US dollars by AdMob itself) for the last five weeks and stores it in
 * `admob_earnings`. AdMob revises recent days, so they are re-read and replaced every run.
 *
 * AdMob's API accepts only a person's Google sign-in, not a service account, so it is connected
 * once from /admin/sales ("Connect AdMob", owner only): Google asks David to allow read-only
 * AdMob access, and the refresh token Google returns is kept in `studio_secrets`, which only the
 * server can read. It can read reports; it cannot change an ad unit, a payment or a setting.
 *
 * Settings, in Vercel's environment variables (not here: this repository is public):
 *   ADMOB_CLIENT_ID      a Google Cloud OAuth client of type "Web application"
 *   ADMOB_CLIENT_SECRET  its secret
 *   ADMOB_REDIRECT_URI   optional; https://papershipstudio.com/api/admob/callback by default,
 *                        and that exact address must be listed on the OAuth client
 */

export const ADMOB_SCOPE = 'https://www.googleapis.com/auth/admob.readonly';
export const ADMOB_TOKEN_KEY = 'admob_refresh_token';
export const DEFAULT_REDIRECT = 'https://papershipstudio.com/api/admob/callback';

export interface AdmobSettings {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function admobSettings(): AdmobSettings | null {
  const clientId = process.env.ADMOB_CLIENT_ID?.trim();
  const clientSecret = process.env.ADMOB_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri: process.env.ADMOB_REDIRECT_URI?.trim() || DEFAULT_REDIRECT };
}

/** Google's consent page for read-only AdMob access, asking for a refresh token. */
export function consentUrl(settings: AdmobSettings, state: string): string {
  const params = new URLSearchParams({
    client_id: settings.clientId,
    redirect_uri: settings.redirectUri,
    response_type: 'code',
    scope: ADMOB_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'false',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function tokenRequest(body: Record<string, string>): Promise<Record<string, string>> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
    cache: 'no-store',
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, string>;
  if (!response.ok) {
    throw new Error(`Google refused the sign-in (${json.error ?? response.status}${json.error_description ? `: ${json.error_description}` : ''}).`);
  }
  return json;
}

/** Trades the code from Google's consent page for a refresh token. */
export async function exchangeCode(settings: AdmobSettings, code: string): Promise<string> {
  const json = await tokenRequest({
    code,
    client_id: settings.clientId,
    client_secret: settings.clientSecret,
    redirect_uri: settings.redirectUri,
    grant_type: 'authorization_code',
  });
  if (!json.refresh_token) throw new Error('Google gave no refresh token. Remove the site under myaccount.google.com > Security > Third-party access, then connect again.');
  return json.refresh_token;
}

async function accessToken(settings: AdmobSettings, refreshToken: string): Promise<string> {
  const json = await tokenRequest({
    refresh_token: refreshToken,
    client_id: settings.clientId,
    client_secret: settings.clientSecret,
    grant_type: 'refresh_token',
  });
  if (!json.access_token) throw new Error('Google gave no access token.');
  return json.access_token;
}

/** The studio's names for AdMob's app labels. */
export function admobAppName(label: string): string {
  if (/dice\s*battles/i.test(label)) return 'Dice Battles: Color Rush';
  if (/vector\s*faces/i.test(label)) return 'Vector Faces';
  if (/lease\s*dash/i.test(label)) return 'LeaseDash CRM';
  return label || 'Unknown app';
}

export interface AdmobRow {
  day: string;
  app_id: string;
  app_name: string;
  platform: string;
  earnings_usd: number;
  impressions: number;
  ad_requests: number;
  matched_requests: number;
}

type MetricValue = { microsValue?: string; integerValue?: string; doubleValue?: number };

/** AdMob's networkReport:generate answer (a list of header, rows and footer) as rows. */
export function parseNetworkReport(json: unknown): AdmobRow[] {
  const parts = Array.isArray(json) ? json : [];
  const rows: AdmobRow[] = [];
  for (const part of parts) {
    const row = (part as { row?: { dimensionValues?: Record<string, { value?: string; displayLabel?: string }>; metricValues?: Record<string, MetricValue> } })?.row;
    if (!row) continue;
    const dims = row.dimensionValues ?? {};
    const metrics = row.metricValues ?? {};
    const date = dims.DATE?.value ?? '';
    if (!/^\d{8}$/.test(date)) continue;
    const appId = dims.APP?.value ?? '';
    if (!appId) continue;
    const int = (m?: MetricValue) => Number(m?.integerValue ?? 0) || 0;
    rows.push({
      day: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
      app_id: appId,
      app_name: admobAppName(dims.APP?.displayLabel ?? ''),
      platform: dims.PLATFORM?.value ?? '',
      earnings_usd: Math.round((Number(metrics.ESTIMATED_EARNINGS?.microsValue ?? 0) / 1e6) * 1e6) / 1e6,
      impressions: int(metrics.IMPRESSIONS),
      ad_requests: int(metrics.AD_REQUESTS),
      matched_requests: int(metrics.MATCHED_REQUESTS),
    });
  }
  return rows;
}

function ymd(d: Date) {
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** The report request: the last `days` days (Pacific time, as AdMob counts them), in US dollars. */
export function reportBody(now: Date, days: number) {
  const end = new Date(now.getTime());
  const start = new Date(now.getTime() - (days - 1) * 86_400_000);
  return {
    reportSpec: {
      dateRange: { startDate: ymd(start), endDate: ymd(end) },
      dimensions: ['DATE', 'APP', 'PLATFORM'],
      metrics: ['ESTIMATED_EARNINGS', 'IMPRESSIONS', 'AD_REQUESTS', 'MATCHED_REQUESTS'],
      localizationSettings: { currencyCode: 'USD', languageCode: 'en-US' },
      timeZone: 'America/Los_Angeles',
    },
  };
}

export interface AdmobResult {
  ok: boolean;
  connected: boolean;
  rows: number;
  latest: string | null;
  message: string;
}

/**
 * Copies AdMob's earnings for the last `days` days into `admob_earnings` and notes the run in
 * `admob_syncs`. Never throws.
 */
export async function syncAdmob(supabase: SupabaseClient, source: string, days = 35): Promise<AdmobResult> {
  const finish = async (result: AdmobResult) => {
    await supabase.from('admob_syncs').insert({
      source,
      ok: result.ok,
      rows_written: result.rows,
      latest_day: result.latest,
      message: result.message.slice(0, 2000),
    });
    return result;
  };

  const settings = admobSettings();
  if (!settings) {
    return finish({ ok: false, connected: false, rows: 0, latest: null, message: 'AdMob: not set up yet (ADMOB_CLIENT_ID and ADMOB_CLIENT_SECRET in Vercel).' });
  }
  const { data: secret } = await supabase.from('studio_secrets').select('value').eq('key', ADMOB_TOKEN_KEY).maybeSingle();
  if (!secret?.value) {
    return finish({ ok: false, connected: false, rows: 0, latest: null, message: 'AdMob: not connected yet. Press "Connect AdMob" on /admin/sales.' });
  }

  try {
    const token = await accessToken(settings, secret.value);
    const accounts = await fetch('https://admob.googleapis.com/v1/accounts', {
      headers: { authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const accountJson = (await accounts.json().catch(() => ({}))) as { account?: { name?: string }[]; error?: { message?: string } };
    if (!accounts.ok) throw new Error(`AdMob refused to list accounts (${accountJson.error?.message ?? accounts.status}).`);
    const account = accountJson.account?.[0]?.name;
    if (!account) throw new Error('This Google sign-in has no AdMob account.');

    const report = await fetch(`https://admob.googleapis.com/v1/${account}/networkReport:generate`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(reportBody(new Date(), days)),
      cache: 'no-store',
    });
    const reportJson = await report.json().catch(() => null);
    if (!report.ok) {
      const why = (reportJson as { error?: { message?: string } } | null)?.error?.message ?? report.status;
      throw new Error(`AdMob refused the report (${why}).`);
    }
    const rows = parseNetworkReport(reportJson);
    if (rows.length) {
      const { error } = await supabase.from('admob_earnings').upsert(
        rows.map((r) => ({ ...r, fetched_at: new Date().toISOString() })),
        { onConflict: 'day,app_id' },
      );
      if (error) throw new Error(`saving: ${error.message}`);
    }
    const latest = rows.reduce<string | null>((m, r) => (!m || r.day > m ? r.day : m), null);
    const total = rows.reduce((s, r) => s + r.earnings_usd, 0);
    return finish({
      ok: true,
      connected: true,
      rows: rows.length,
      latest,
      message: `AdMob: ${rows.length} app-days read, $${total.toFixed(2)} estimated in the last ${days} days.`,
    });
  } catch (err) {
    return finish({ ok: false, connected: true, rows: 0, latest: null, message: `AdMob: ${err instanceof Error ? err.message : String(err)}` });
  }
}
