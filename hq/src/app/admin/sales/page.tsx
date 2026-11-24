import { redirect } from 'next/navigation';
import { currentMember, supabaseAdmin } from '@/lib/supabase/server';
import { admobSettings } from '@/lib/admob';
import { STUDIO_APPS } from '@/lib/appSales';
import { ensureRates } from '@/lib/fxRates';

/**
 * What the studio's apps have sold, from Apple's own daily sales reports.
 *
 * Owner only: the money is David's business. The numbers are copied from Apple once a day by
 * /api/cron/app-sales into `app_sales`; nothing here is estimated. Money is shown in the
 * currency Apple pays it in, after Apple's share, so a sale in euros is listed in euros rather
 * than converted at a guessed rate.
 */

export const dynamic = 'force-dynamic';

interface Sale {
  report_date: string;
  app_apple_id: string;
  app_name: string;
  item_title: string;
  kind: string;
  units: number;
  proceeds: number;
  proceeds_currency: string;
  country: string;
}

interface Sync {
  ran_at: string;
  source: string;
  ok: boolean;
  message: string;
  latest_report_date: string | null;
}

interface Tally {
  paid: number;
  free: number;
  redownloads: number;
  purchases: number;
  money: Map<string, number>;
}

function emptyTally(): Tally {
  return { paid: 0, free: 0, redownloads: 0, purchases: 0, money: new Map() };
}

function add(t: Tally, s: Sale) {
  if (s.kind === 'paid_download') t.paid += s.units;
  if (s.kind === 'free_download') t.free += s.units;
  if (s.kind === 'redownload') t.redownloads += s.units;
  if (s.kind === 'in_app_purchase') t.purchases += s.units;
  const amount = Number(s.proceeds) * s.units;
  if (amount !== 0 && s.proceeds_currency) {
    t.money.set(s.proceeds_currency, (t.money.get(s.proceeds_currency) ?? 0) + amount);
  }
}

function moneyText(money: Map<string, number>): string {
  if (money.size === 0) return '—';
  return [...money.entries()]
    .sort((a, b) => (a[0] === 'USD' ? -1 : b[0] === 'USD' ? 1 : a[0].localeCompare(b[0])))
    .map(([currency, amount]) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount),
    )
    .join(' + ');
}

function dayText(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

const cell: React.CSSProperties = { padding: '6px 10px 6px 0', borderTop: '1px solid var(--line)' };
const num: React.CSSProperties = { ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

const ADMOB_NOTES: Record<string, string> = {
  connected: 'AdMob is connected. Its earnings were read just now and are copied every morning.',
  'connected-but-failed': 'AdMob is connected, but the first read failed. The reason is below; the morning job tries again.',
  declined: 'Google was not given permission, so AdMob is not connected.',
  expired: 'That sign-in took too long or came from another tab. Press Connect AdMob again.',
  failed: 'Google did not finish the sign-in. Press Connect AdMob again.',
  'not-set-up': 'AdMob needs its Google sign-in client in Vercel first (ADMOB_CLIENT_ID, ADMOB_CLIENT_SECRET).',
  'owner-only': 'Only the owner can connect AdMob.',
};

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ admob?: string }> }) {
  const { admob: admobNote } = await searchParams;
  const member = await currentMember();
  if (!member) redirect('/login?next=/admin/sales');
  if (member.role !== 'owner') {
    return (
      <div className="card">
        <h3>Sales</h3>
        <p className="faint">Sales are for the owner of the studio to see.</p>
      </div>
    );
  }

  const supabase = supabaseAdmin();
  // Any sale in a new currency gets its dollar rate now rather than at the next morning's job
  // (quick when there is nothing to fetch). The sales dashboard converts with these.
  await ensureRates(supabase);
  const [{ data: saleData, error }, { data: syncData }] = await Promise.all([
    supabase
      .from('app_sales')
      .select('report_date, app_apple_id, app_name, item_title, kind, units, proceeds, proceeds_currency, country')
      .order('report_date', { ascending: false })
      .limit(20000),
    supabase
      .from('app_sales_syncs')
      .select('ran_at, source, ok, message, latest_report_date')
      .order('ran_at', { ascending: false })
      .limit(5),
  ]);
  const [{ data: admobSecret }, { data: admobRuns }] = await Promise.all([
    supabase.from('studio_secrets').select('updated_at').eq('key', 'admob_refresh_token').maybeSingle(),
    supabase.from('admob_syncs').select('ran_at, ok, message, latest_day').order('ran_at', { ascending: false }).limit(1),
  ]);
  const admobRun = (admobRuns ?? [])[0] as { ran_at: string; ok: boolean; message: string; latest_day: string | null } | undefined;
  const admobReady = !!admobSettings();
  const sales = (saleData ?? []) as Sale[];
  const syncs = (syncData ?? []) as Sync[];

  const byApp = new Map<string, Tally>(Object.keys(STUDIO_APPS).map((id) => [id, emptyTally()]));
  const byDay = new Map<string, Map<string, Tally>>();
  const byCountry = new Map<string, Tally>();
  for (const s of sales) {
    add(byApp.get(s.app_apple_id) ?? byApp.set(s.app_apple_id, emptyTally()).get(s.app_apple_id)!, s);
    const day = byDay.get(s.report_date) ?? byDay.set(s.report_date, new Map()).get(s.report_date)!;
    add(day.get(s.app_apple_id) ?? day.set(s.app_apple_id, emptyTally()).get(s.app_apple_id)!, s);
    if (s.kind === 'paid_download' || s.kind === 'in_app_purchase') {
      const key = `${s.app_name} · ${s.country || '—'}`;
      add(byCountry.get(key) ?? byCountry.set(key, emptyTally()).get(key)!, s);
    }
  }
  const days = [...byDay.keys()].sort().reverse().slice(0, 30);
  const lastSync = syncs[0];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="card">
        <h3>Sales</h3>
        <p className="faint" style={{ marginTop: 0 }}>
          From Apple&apos;s daily sales reports, after Apple&apos;s share. Apple publishes each day
          (Pacific time) the next morning, and this page copies it once a day.
        </p>
        {lastSync ? (
          <p style={{ margin: 0 }}>
            <span className={lastSync.ok ? 'muted' : ''} style={lastSync.ok ? undefined : { color: 'var(--red)' }}>
              {lastSync.ok ? 'Last copied' : 'Last try failed'}{' '}
              {new Date(lastSync.ran_at).toLocaleString('en-US', { timeZone: 'America/New_York' })} (New York time)
            </span>
            {lastSync.latest_report_date && (
              <span className="faint"> · newest day: {dayText(lastSync.latest_report_date)}</span>
            )}
            {!lastSync.ok && <span className="faint"> · {lastSync.message}</span>}
          </p>
        ) : (
          <p className="faint" style={{ margin: 0 }}>Nothing copied from Apple yet.</p>
        )}
        {error && <p className="faint">Could not read the sales: {error.message}</p>}
      </div>

      <div className="card">
        <h3>Ad money (AdMob)</h3>
        {admobNote && ADMOB_NOTES[admobNote] && <p>{ADMOB_NOTES[admobNote]}</p>}
        <p className="faint" style={{ marginTop: 0 }}>
          {admobSecret
            ? `Connected ${new Date(admobSecret.updated_at).toLocaleDateString('en-US', { timeZone: 'America/New_York' })}. Earnings are copied every morning with the sales and shown on the sales dashboard.`
            : 'Not connected. Connecting lets this site read AdMob\'s earnings reports (read-only) for the sales dashboard.'}
        </p>
        {admobRun && (
          <p className="faint" style={admobRun.ok ? undefined : { color: 'var(--red)' }}>
            Last read {new Date(admobRun.ran_at).toLocaleString('en-US', { timeZone: 'America/New_York' })}: {admobRun.message}
          </p>
        )}
        {admobReady ? (
          <a className="button button-small" href="/api/admob/connect">{admobSecret ? 'Connect AdMob again' : 'Connect AdMob'}</a>
        ) : (
          <p className="faint" style={{ marginBottom: 0 }}>
            Waiting for the Google sign-in client in Vercel (ADMOB_CLIENT_ID, ADMOB_CLIENT_SECRET).
          </p>
        )}
      </div>

      <div className="card">
        <h3>Since launch</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr className="faint" style={{ textAlign: 'left' }}>
                <th style={cell}>App</th>
                <th style={num}>Paid downloads</th>
                <th style={num}>Free (promo codes)</th>
                <th style={num}>In-app purchases</th>
                <th style={num}>Re-downloads</th>
                <th style={num}>Earned</th>
              </tr>
            </thead>
            <tbody>
              {[...byApp.entries()].map(([id, t]) => (
                <tr key={id}>
                  <td style={cell}>{STUDIO_APPS[id] ?? id}</td>
                  <td style={num}>{t.paid}</td>
                  <td style={num}>{t.free}</td>
                  <td style={num}>{t.purchases}</td>
                  <td style={num}>{t.redownloads}</td>
                  <td style={num}>{moneyText(t.money)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="faint" style={{ marginBottom: 0 }}>
          Re-downloads include putting an app on an Apple Watch after buying it on the iPhone; they
          are not new sales.
        </p>
      </div>

      <div className="card">
        <h3>Day by day</h3>
        {days.length === 0 && <p className="faint">No sales yet.</p>}
        {days.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr className="faint" style={{ textAlign: 'left' }}>
                  <th style={cell}>Day</th>
                  <th style={cell}>App</th>
                  <th style={num}>Paid</th>
                  <th style={num}>Free</th>
                  <th style={num}>In-app</th>
                  <th style={num}>Earned</th>
                </tr>
              </thead>
              <tbody>
                {days.flatMap((day) =>
                  [...byDay.get(day)!.entries()].map(([id, t]) => (
                    <tr key={`${day}-${id}`}>
                      <td style={cell}>{dayText(day)}</td>
                      <td style={cell}>{STUDIO_APPS[id] ?? id}</td>
                      <td style={num}>{t.paid}</td>
                      <td style={num}>{t.free}</td>
                      <td style={num}>{t.purchases}</td>
                      <td style={num}>{moneyText(t.money)}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Where the buyers are</h3>
        {byCountry.size === 0 && <p className="faint">No paid sales yet.</p>}
        {[...byCountry.entries()]
          .sort((a, b) => b[1].paid + b[1].purchases - (a[1].paid + a[1].purchases))
          .map(([key, t]) => (
            <div key={key} className="spread" style={{ borderTop: '1px solid var(--line)', padding: '6px 0' }}>
              <span>{key}</span>
              <span className="muted">
                {t.paid + t.purchases} sold · {moneyText(t.money)}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
