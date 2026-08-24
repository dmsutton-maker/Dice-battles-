import { store } from './storageMock';
import { assert, assertEqual, note, suite, test } from './harness';
import { fetchNews, mergeNews, NEWS, NewsItem } from '../src/game/news';
import { GAME_VERSION } from '../src/game/version';

/**
 * The News tab has one rule above all others: it must never be empty and
 * must never show an error. It is a page of announcements, not a feature,
 * so every failure has to end at the news the game already shipped with.
 */

function post(id: string, over: Partial<NewsItem> = {}): NewsItem {
  return {
    id,
    date: '24 August 2026',
    title: `Post ${id}`,
    emoji: '📣',
    body: 'Something happened, and here is a sentence about it.',
    ...over,
  };
}

/** Stands in for the network. Restores itself. */
async function withFetch<T>(fake: unknown, body: () => Promise<T>): Promise<T> {
  const g = globalThis as unknown as Record<string, unknown>;
  const real = g.fetch;
  g.fetch = fake;
  try {
    return await body();
  } finally {
    g.fetch = real;
  }
}

const ok = (posts: unknown) => async () => ({ ok: true, json: async () => ({ posts }) });

suite('news · the bundled posts', () => {
  test('every post is complete and has its own id', () => {
    const ids = new Set<string>();
    for (const item of NEWS) {
      assert(item.id.length > 0, 'a post has no id');
      assert(!ids.has(item.id), `two posts share the id ${item.id}`);
      ids.add(item.id);
      assert(item.title.length > 0, `${item.id} has no title`);
      assert(item.body.length > 20, `${item.id} says almost nothing`);
      assert(item.emoji.length > 0, `${item.id} has no picture`);
      assert(item.date.length > 0, `${item.id} has no date`);
    }
    note(`${NEWS.length} bundled posts`);
  });

  test('the news keeps up with what has shipped', () => {
    // The failure that prompted all of this: the newest post was v1.11.0
    // while the game was on v1.29.0, so the News tab was telling players
    // nothing had changed across eighteen releases.
    const versioned = NEWS.filter((n) => n.version);
    assert(versioned.length > 0, 'no post mentions a version at all');
    const num = (v: string) => v.replace(/^v/, '').split('.').map(Number);
    const newest = versioned
      .map((n) => num(n.version!))
      .sort((a, b) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2])[0];
    const current = num(GAME_VERSION);
    const behind = (current[0] - newest[0]) * 1000 + (current[1] - newest[1]);
    note(`newest post is v${newest.join('.')}, game is ${GAME_VERSION}`);
    assert(behind <= 3, `the News tab is ${behind} minor versions behind the game`);
  });
});

suite('news · merging the board with the bundle', () => {
  test('fetched posts come first, bundled ones follow', () => {
    const merged = mergeNews([post('a'), post('b')], [post('z')]);
    assertEqual(merged.map((m) => m.id).join(','), 'z,a,b', 'wrong order');
  });

  test('a fetched post replaces the bundled one with the same id', () => {
    // What makes a correction possible without shipping anything.
    const merged = mergeNews(
      [post('a', { title: 'Typo verison' })],
      [post('a', { title: 'Fixed version' })],
    );
    assertEqual(merged.length, 1, 'the correction appeared as a second post');
    assertEqual(merged[0].title, 'Fixed version', 'the correction did not win');
  });

  test('nothing fetched leaves the bundle untouched', () => {
    const merged = mergeNews(NEWS, []);
    assertEqual(merged.length, NEWS.length, 'the bundle changed size');
    assertEqual(merged[0].id, NEWS[0].id, 'the bundle was reordered');
  });
});

suite('news · every way the network can fail', () => {
  const bundledIds = NEWS.map((n) => n.id).join(',');
  /**
   * Forget the last feed that was read.
   *
   * The cache is shared process-wide, exactly as it is on a phone, so
   * without this a post fetched by one case leaks into the next one's
   * fallback — which is how the first draft of these tests failed. That
   * is the cache working, and it gets its own case below.
   */
  const forgetCache = () => store.delete('dice-battles:news-cache');

  test('a post arrives and is shown', async () => {
    forgetCache();
    const news = await withFetch(ok([post('board-1')]), fetchNews);
    assertEqual(news[0].id, 'board-1', 'the fetched post is not first');
    assert(news.length > NEWS.length, 'the bundled posts were lost');
  });

  test('no network at all', async () => {
    forgetCache();
    const news = await withFetch(async () => {
      throw new Error('offline');
    }, fetchNews);
    assert(news.length >= NEWS.length, 'a dropped connection emptied the News tab');
  });

  test('the server answers with an error', async () => {
    forgetCache();
    const news = await withFetch(
      async () => ({ ok: false, json: async () => ({}) }),
      fetchNews,
    );
    assertEqual(news.map((n) => n.id).join(','), bundledIds, 'a 500 changed the news');
  });

  test('the answer is not JSON at all', async () => {
    forgetCache();
    const news = await withFetch(
      async () => ({
        ok: true,
        json: async () => {
          throw new Error('not json');
        },
      }),
      fetchNews,
    );
    assertEqual(news.map((n) => n.id).join(','), bundledIds, 'garbage broke the News tab');
  });

  test('the answer is JSON but the wrong shape', async () => {
    forgetCache();
    const news = await withFetch(ok('not an array'), fetchNews);
    assertEqual(news.map((n) => n.id).join(','), bundledIds, 'a wrong shape broke the tab');
  });

  test('one malformed post costs that post and nothing else', async () => {
    forgetCache();
    const news = await withFetch(ok([{ id: 'broken' }, post('good')]), fetchNews);
    assertEqual(news[0].id, 'good', 'the good post was lost with the bad one');
    assert(!news.some((n) => n.id === 'broken'), 'a post with no body was shown');
  });

  test('an empty feed is not treated as "delete all the news"', async () => {
    forgetCache();
    const news = await withFetch(ok([]), fetchNews);
    assertEqual(news.map((n) => n.id).join(','), bundledIds, 'an empty feed emptied the tab');
  });

  test('a post read once survives being offline afterwards', async () => {
    // The reason the News tab is worth anything on a plane. The last feed
    // that was successfully read is kept, so a cold start with no network
    // still shows what the board said yesterday.
    forgetCache();
    await withFetch(ok([post('remembered')]), fetchNews);
    const offline = await withFetch(async () => {
      throw new Error('offline');
    }, fetchNews);
    assert(
      offline.some((n) => n.id === 'remembered'),
      'the last feed read was forgotten the moment the network went',
    );
  });

  test('fetchNews never rejects, whatever happens', async () => {
    forgetCache();
    // The screen calls this with .then and no .catch on purpose — an
    // unhandled rejection inside a popup is a red screen on a device.
    for (const breaker of [
      async () => {
        throw new Error('boom');
      },
      async () => null,
      async () => ({ ok: true, json: async () => null }),
    ]) {
      const news = await withFetch(breaker, fetchNews);
      assert(Array.isArray(news) && news.length > 0, 'fetchNews returned nothing');
    }
  });
});
