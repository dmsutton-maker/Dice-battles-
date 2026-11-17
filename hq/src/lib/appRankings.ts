import type { SupabaseClient } from '@supabase/supabase-js';
import { STUDIO_APPS } from './appSales';

/**
 * Where the studio's apps sit in the App Store, read once a day by /api/cron/app-sales and kept
 * in `app_rankings` for David's sales dashboard.
 *
 * Only Apple's own public feeds and APIs, no keys and nothing paid:
 *  - which apps are on the store: the iTunes Lookup API (an app that is not on the US store yet,
 *    like Dice Battles before launch, is simply not recorded, and starts by itself on launch day);
 *  - the charts: Apple's overall Top Paid and Top Free top 100 (rss.marketingtools.apple.com; it
 *    has no per-category chart, and the old category feed on itunes.apple.com now answers 403);
 *  - searches: the iTunes Search API, an app's place in the results for some search words. That
 *    is Apple's search service, close to but not guaranteed identical to the App Store app.
 *
 * A request that fails or times out skips only its own row and is named in the message. A rank
 * is never guessed: no row is better than a wrong one.
 */

/** The search words recorded for each app, by App Store id. Edit freely; each is one request. */
export const SEARCH_WORDS: Record<string, string[]> = {
  '6832990414': [
    'vector faces',
    'watch faces',
    'watch face',
    'apple watch faces',
    'analog watch face',
    'retro watch face',
  ],
  '6802287913': ['dice battles', 'dice game', 'family dice game'],
};

/** The store whose charts and searches are read. */
export const RANKING_COUNTRY = 'us';

/** Apple's two overall charts, by the name written in `app_rankings.name`. */
const CHARTS: Record<string, string> = {
  'Top Paid': 'top-paid',
  'Top Free': 'top-free',
};

const TIMEOUT_MS = 8000;

export interface RankingRow {
  day: string;
  app_apple_id: string;
  app_name: string;
  kind: 'chart' | 'search';
  name: string;
  country: string;
  /** 1 is the top; null means not in the list. */
  rank: number | null;
  list_length: number;
  fetched_at: string;
}

export interface RankingsResult {
  /** True when every request worked and the rows were saved. */
  ok: boolean;
  /** The UTC day the rows are for. */
  day: string;
  /** The studio apps found on the store today, by name. */
  apps: string[];
  /** The rows saved (empty if saving failed). */
  rows: RankingRow[];
  /** What went wrong, one entry per request or step. */
  problems: string[];
  /** One plain sentence for `app_sales_syncs.message`. */
  message: string;
}

/** Fetches JSON from Apple with a timeout. Throws a short plain reason on any failure. */
async function getJson(url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    throw new Error(name === 'TimeoutError' || name === 'AbortError' ? 'timed out' : 'no answer');
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  try {
    // The search API sends JSON as text/javascript, so read text and parse it ourselves.
    return JSON.parse(await response.text());
  } catch {
    throw new Error('not JSON');
  }
}

function reason(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** The studio apps Apple's Lookup API finds on this country's store. */
async function appsOnStore(): Promise<string[]> {
  const ids = Object.keys(STUDIO_APPS);
  const params = new URLSearchParams({ id: ids.join(','), country: RANKING_COUNTRY });
  const body = (await getJson(`https://itunes.apple.com/lookup?${params}`)) as {
    results?: { trackId?: number | string }[];
  };
  if (!Array.isArray(body?.results)) throw new Error('unexpected answer');
  const found = new Set(body.results.map((r) => String(r.trackId ?? '')));
  return ids.filter((id) => found.has(id));
}

/** One of Apple's overall charts, as App Store ids in order. */
async function chart(slug: string): Promise<string[]> {
  const body = (await getJson(
    `https://rss.marketingtools.apple.com/api/v2/${RANKING_COUNTRY}/apps/${slug}/100/apps.json`,
  )) as { feed?: { results?: { id?: string | number }[] } };
  const results = body?.feed?.results;
  if (!Array.isArray(results)) throw new Error('unexpected answer');
  return results.map((r) => String(r.id ?? ''));
}

/** Apple's search results for some words, as App Store ids in order. */
async function search(words: string): Promise<string[]> {
  const params = new URLSearchParams({
    term: words,
    entity: 'software',
    country: RANKING_COUNTRY,
    limit: '200',
  });
  const body = (await getJson(`https://itunes.apple.com/search?${params}`)) as {
    results?: { trackId?: number | string }[];
  };
  if (!Array.isArray(body?.results)) throw new Error('unexpected answer');
  return body.results.map((r) => String(r.trackId ?? ''));
}

/** Settles a promise into either its value or a plain reason, never throwing. */
async function settle<T>(p: Promise<T>): Promise<{ ok: true; value: T } | { ok: false; why: string }> {
  try {
    return { ok: true, value: await p };
  } catch (err) {
    return { ok: false, why: reason(err) };
  }
}

/**
 * Reads today's rankings from Apple and upserts them into `app_rankings`. Never throws: anything
 * that goes wrong ends up in `problems` and the message.
 */
export async function recordRankings(supabase: SupabaseClient, now = new Date()): Promise<RankingsResult> {
  const day = now.toISOString().slice(0, 10);
  const fetchedAt = now.toISOString();
  const problems: string[] = [];
  const done = (rows: RankingRow[], apps: string[], message: string): RankingsResult => ({
    ok: problems.length === 0,
    day,
    apps,
    rows,
    problems,
    message,
  });

  try {
    // The charts do not depend on the lookup, so ask for all three at once.
    const chartNames = Object.keys(CHARTS);
    const [lookup, ...charts] = await Promise.all([
      settle(appsOnStore()),
      ...chartNames.map((name) => settle(chart(CHARTS[name]))),
    ]);
    if (!lookup.ok) {
      problems.push(`the store lookup: ${lookup.why}`);
      return done([], [], `Rankings: could not ask Apple which apps are on the store (${lookup.why}).`);
    }
    const appIds = lookup.value;
    const appNames = appIds.map((id) => STUDIO_APPS[id]);
    const missing = Object.keys(STUDIO_APPS)
      .filter((id) => !appIds.includes(id))
      .map((id) => STUDIO_APPS[id]);
    if (appIds.length === 0) {
      return done([], [], "Rankings: none of the studio's apps is on the US App Store.");
    }

    // Each distinct search once, all at once (well inside the Search API's ~20 a minute).
    const allWords = [...new Set(appIds.flatMap((id) => SEARCH_WORDS[id] ?? []))];
    const searches = new Map(
      await Promise.all(allWords.map(async (w) => [w, await settle(search(w))] as const)),
    );

    const rows: RankingRow[] = [];
    const row = (id: string, kind: RankingRow['kind'], name: string, list: string[]): RankingRow => {
      const at = list.indexOf(id);
      return {
        day,
        app_apple_id: id,
        app_name: STUDIO_APPS[id],
        kind,
        name,
        country: RANKING_COUNTRY,
        rank: at >= 0 ? at + 1 : null,
        list_length: list.length,
        fetched_at: fetchedAt,
      };
    };
    chartNames.forEach((name, i) => {
      const got = charts[i];
      if (got.ok) appIds.forEach((id) => rows.push(row(id, 'chart', name, got.value)));
      else problems.push(`${name}: ${got.why}`);
    });
    for (const [words, got] of searches) {
      if (!got.ok) problems.push(`"${words}": ${got.why}`);
    }
    for (const id of appIds) {
      for (const words of SEARCH_WORDS[id] ?? []) {
        const got = searches.get(words);
        if (got?.ok) rows.push(row(id, 'search', words, got.value));
      }
    }

    if (rows.length > 0) {
      const { error } = await supabase
        .from('app_rankings')
        .upsert(rows, { onConflict: 'day,app_apple_id,kind,name,country' });
      if (error) {
        problems.push(`saving: ${error.message}`);
        return done([], appNames, `Rankings: read ${rows.length} but could not save them (${error.message}).`);
      }
    }

    const notYet = missing.length ? ` (${missing.join(', ')} not on the US store yet)` : '';
    const failed = problems.length ? `; could not read ${problems.join(', ')}` : '';
    return done(rows, appNames, `Rankings: ${rows.length} read${notYet}${failed}.`);
  } catch (err) {
    problems.push(reason(err));
    return done([], [], `Rankings: something went wrong (${reason(err)}).`);
  }
}
