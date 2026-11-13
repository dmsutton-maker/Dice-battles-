import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { ascConfigured, daysBefore, fetchDay, pacificToday } from '@/lib/appSales';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * Once a day (vercel.json), copies the studio's App Store sales from Apple into `app_sales`.
 *
 * It re-reads the last week every time, because Apple sometimes corrects a day after first
 * publishing it, and each day is replaced whole (`replace_app_sales_day`), so nothing is ever
 * counted twice. A day Apple has not published yet is left alone. Every run is written to
 * `app_sales_syncs`, which /admin/sales reads to say how fresh the numbers are.
 *
 * Called by Vercel's scheduler with `Authorization: Bearer $CRON_SECRET`. `?days=30` (at most
 * 90) reads further back, for filling in.
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
  const asked = Number(request.nextUrl.searchParams.get('days') ?? '7');
  const count = Math.min(90, Math.max(1, Number.isFinite(asked) ? Math.trunc(asked) : 7));
  const source = request.headers.get('user-agent')?.includes('vercel-cron') ? 'cron' : 'manual';

  if (!ascConfigured()) {
    const message = 'The App Store Connect key is not set up in Vercel yet (ASC_* variables).';
    await supabase.from('app_sales_syncs').insert({ source, ok: false, message });
    return NextResponse.json({ ok: false, message }, { status: 503 });
  }

  const days = daysBefore(pacificToday(), count);
  let written = 0;
  let latest: string | null = null;
  const problems: string[] = [];
  const notYet: string[] = [];

  for (const day of days) {
    const report = await fetchDay(day);
    if (report.status === 'unavailable') {
      notYet.push(day);
      continue;
    }
    if (report.status === 'error') {
      problems.push(`${day}: ${report.message}`);
      continue;
    }
    const { data, error } = await supabase.rpc('replace_app_sales_day', {
      day,
      rows: report.rows,
    });
    if (error) {
      problems.push(`${day}: ${error.message}`);
      continue;
    }
    written += typeof data === 'number' ? data : report.rows.length;
    if (!latest || day > latest) latest = day;
  }

  const ok = problems.length === 0;
  const message = [
    ok ? `Read ${days.length - notYet.length} days from Apple.` : `Trouble with ${problems.length} days.`,
    notYet.length ? `Not published by Apple yet: ${notYet.join(', ')}.` : '',
    ...problems,
  ]
    .filter(Boolean)
    .join(' ')
    .slice(0, 2000);
  await supabase.from('app_sales_syncs').insert({
    source,
    days_checked: days.length,
    rows_written: written,
    latest_report_date: latest,
    ok,
    message,
  });
  return NextResponse.json({ ok, days: days.length, rows: written, latest, message }, { status: ok ? 200 : 502 });
}
