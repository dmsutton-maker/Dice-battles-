import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import {
  decodeText,
  googleToken,
  jwtClaims,
  listObjects,
  parseInstalls,
  parseSales,
  pickInstallFiles,
  playSettings,
  readObject,
  recentMonths,
  unzip,
  fileMonth,
} from '@/lib/playReports';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * Once a day (vercel.json), copies Google Play's downloads and sales for every app on the Google
 * Play developer account into `play_installs` and `play_sales`, from the reports Google keeps in
 * the account's Cloud Storage bucket. See lib/playReports.ts for how it signs in without a key.
 *
 * Google rewrites a month's files as the month goes on, so each run reads the last few months
 * whole and replaces them. Every run is written to `play_report_syncs`, which the dashboard reads
 * to say how fresh the Google Play numbers are.
 *
 * Called by Vercel's scheduler with `Authorization: Bearer $CRON_SECRET`. `?months=12` (at most
 * 24) reads further back, for filling in. While it is not set up yet, the answer says what this
 * deployment's sign-in token is (issuer, audience, subject; never the token), which is what Google
 * Cloud's Workload Identity provider has to be told.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get('authorization') ?? '';
  if (!secret) return false;
  const want = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(given);
  return want.length === got.length && timingSafeEqual(want, got);
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'Not allowed.' }, { status: 401 });
  }
  const supabase = supabaseAdmin();
  const source = request.headers.get('user-agent')?.includes('vercel-cron') ? 'cron' : 'manual';
  const asked = Number(request.nextUrl.searchParams.get('months') ?? '2');
  const back = Math.min(24, Math.max(0, Number.isFinite(asked) ? Math.trunc(asked) : 2));

  const oidc = request.headers.get('x-vercel-oidc-token') ?? process.env.VERCEL_OIDC_TOKEN ?? '';
  const claims = oidc ? jwtClaims(oidc) : null;
  const identity = claims ? { iss: claims.iss, aud: claims.aud, sub: claims.sub } : null;

  const settings = playSettings();
  const finish = async (ok: boolean, message: string, extra: Record<string, unknown> = {}, status = 200) => {
    // While it does not work, say who Vercel signs in as: that is what Google Cloud is set up with.
    const who = !ok && identity ? ` Vercel signs in as iss=${identity.iss} aud=${identity.aud} sub=${identity.sub}.` : '';
    await supabase.from('play_report_syncs').insert({
      source,
      ok,
      message: `${message}${who}`.slice(0, 2000),
      files_read: Number(extra.files ?? 0),
      rows_written: Number(extra.rows ?? 0),
      latest_install_day: (extra.latestInstall as string | null) ?? null,
      latest_sale_day: (extra.latestSale as string | null) ?? null,
    });
    return NextResponse.json({ ok, message, identity, ...extra }, { status });
  };

  if (!oidc) {
    return finish(false, "This deployment has no Vercel OIDC token, so it cannot sign in to Google. Turn on \"Secure backend access with OIDC federation\" in the Vercel project's Security settings.", {}, 503);
  }
  if (!settings) {
    return finish(false, 'Google Play reports are not set up in Vercel yet (PLAY_REPORTS_BUCKET, PLAY_REPORTS_WIF_PROVIDER, PLAY_REPORTS_ACCOUNT).', {}, 503);
  }

  let token: string;
  try {
    token = await googleToken(oidc, settings);
  } catch (err) {
    return finish(false, err instanceof Error ? err.message : String(err), {}, 502);
  }

  const months = new Set(recentMonths(new Date(), back));
  const problems: string[] = [];
  let files = 0;
  let rows = 0;
  let latestInstall: string | null = null;
  let latestSale: string | null = null;
  const apps = new Set<string>();

  // Downloads: one file per app per month.
  try {
    const names = (await listObjects(token, settings.bucket, 'stats/installs/')).map((o) => o.name);
    const chosen = pickInstallFiles(names, months);
    for (const { pkg, month, name } of chosen.values()) {
      try {
        const installs = parseInstalls(decodeText(await readObject(token, settings.bucket, name)), pkg);
        files += 1;
        apps.add(pkg);
        const { data, error } = await supabase.rpc('replace_play_installs', { pkg, month, rows: installs });
        if (error) throw new Error(error.message);
        rows += typeof data === 'number' ? data : installs.length;
        for (const r of installs) if (!latestInstall || r.day > latestInstall) latestInstall = r.day;
      } catch (err) {
        problems.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } catch (err) {
    problems.push(`downloads: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Sales: one .zip per month for the whole account.
  try {
    const reports = (await listObjects(token, settings.bucket, 'sales/salesreport_'))
      .map((o) => o.name)
      .filter((name) => name.endsWith('.zip') && months.has(fileMonth(name) ?? ''));
    for (const name of reports) {
      const month = fileMonth(name) as string;
      try {
        const inside = unzip(await readObject(token, settings.bucket, name)).filter((f) => f.name.endsWith('.csv'));
        const sales = inside.flatMap((f) => parseSales(decodeText(f.data)));
        files += 1;
        const { data, error } = await supabase.rpc('replace_play_sales', { month, rows: sales });
        if (error) throw new Error(error.message);
        rows += typeof data === 'number' ? data : sales.length;
        for (const r of sales) if (!latestSale || r.day > latestSale) latestSale = r.day;
      } catch (err) {
        problems.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } catch (err) {
    problems.push(`sales: ${err instanceof Error ? err.message : String(err)}`);
  }

  const ok = problems.length === 0;
  const message = [
    `Read ${files} Google Play report files (${[...months].join(', ')}).`,
    apps.size ? `Apps with downloads: ${[...apps].sort().join(', ')}.` : 'No downloads files yet for these months.',
    ...problems,
  ].join(' ');
  return finish(ok, message, { files, rows, latestInstall, latestSale }, ok ? 200 : 502);
}
