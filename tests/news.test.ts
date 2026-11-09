import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { store } from './storageMock';
import { assert, assertEqual, note, suite, test } from './harness';
import {
  fetchNews,
  mergeNews,
  NEWS,
  NEWS_ICON_IDS,
  newsIconId,
  newsIsMajor,
  NewsItem,
  newsDate,
  recentNews,
} from '../src/game/news';
import { GAME_VERSION } from '../src/game/version';

/**
 * The News tab must never show an error. It is a page of announcements,
 * not a feature, so every failure has to end at the news the game already
 * shipped with. Since 8 Nov 2026 it may be EMPTY (David: "Clear the news
 * tab and then automatically clear any future news items older than one
 * month"), and says "Nothing new right now" when it is.
 */

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** A date the way posts write them, `days` before today. */
function written(daysAgo = 0): string {
  const d = new Date(Date.now() - daysAgo * 86_400_000);
  return `${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function post(id: string, over: Partial<NewsItem> = {}): NewsItem {
  return {
    id,
    date: written(),
    title: `Post ${id}`,
    icon: 'news',
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
      assert(
        NEWS_ICON_IDS.includes(item.icon!),
        `${item.id} has no picture, or one the icon set does not have`,
      );
      assert(item.date.length > 0, `${item.id} has no date`);
    }
    note(`${NEWS.length} bundled posts`);
  });

  test('no post names anybody in the family', () => {
    /*
      David asked on 25 Aug 2026, about a post that read "AJ spotted
      that..." and thanked him by name at the end.

      The News tab is not a family changelog — it ships inside the app to
      every stranger who installs it, so a credit like that publishes a
      child's first name on the App Store. Reporters get thanked as
      "somebody" or "a player" instead; the person who found the bug knows
      which one they are.

      Word boundaries matter here: "AJ" must not match "major" and "Marc"
      must not match "March", or this fails on innocent prose and the next
      person deletes the test rather than the name.
    */
    const NAMES = ['AJ', 'Marc', 'David', 'Sutton'];
    for (const item of NEWS) {
      const text = `${item.title} ${item.body}`;
      for (const name of NAMES) {
        const found = new RegExp(`\\b${name}\\b`).test(text);
        assert(
          !found,
          `${item.id} names ${name} — the News tab ships to everyone who installs the game`,
        );
      }
    }
    note(`${NEWS.length} posts checked for ${NAMES.join(', ')}`);
  });

  test('a post is shown for a month after its date, then is gone', () => {
    const NOV_8 = Date.UTC(2026, 10, 8, 15);
    const p = post('p', { date: '8 November 2026' });
    assertEqual(recentNews([p], NOV_8).length, 1, 'gone on its own day');
    assertEqual(recentNews([p], Date.UTC(2026, 11, 8, 23, 59)).length, 1, 'gone before the month was up');
    assertEqual(recentNews([p], Date.UTC(2026, 11, 9, 0, 1)).length, 0, 'still there after a month');
    assertEqual(recentNews([p], Date.UTC(2027, 5, 1)).length, 0, 'still there months later');
    // The board may write its dates the other way round.
    assertEqual(recentNews([post('q', { date: '2026-11-08' })], NOV_8).length, 1, 'an ISO date was not read');
    // Mixed: only the fresh one survives, in its place.
    const mixed = [post('new', { date: '1 November 2026' }), post('old', { date: '1 September 2026' })];
    assertEqual(recentNews(mixed, NOV_8).map((m) => m.id).join(','), 'new', 'the wrong posts survived');
  });

  test('a date that cannot be read is not shown', () => {
    for (const bad of ['', 'soon', 'November 2026', '31 February 2027', '8 Smarch 2026', '2026-13-01']) {
      assertEqual(newsDate(bad), null, `"${bad}" was read as a date`);
      assertEqual(recentNews([post('x', { date: bad })]).length, 0, `"${bad}" was shown`);
    }
    assertEqual(newsDate('8 November 2026'), Date.UTC(2026, 10, 8), 'the usual form');
    assertEqual(newsDate('8 november 2026'), Date.UTC(2026, 10, 8), 'lower-case month');
  });

  test('the tab and the feed both go through the month rule', () => {
    const screen = readFileSync(join(__dirname, '..', 'src/demo/NewsScreen.tsx'), 'utf8');
    assert(/useState<NewsItem\[\]>\(\(\) => recentNews\(NEWS\)\)/.test(screen), 'the tab opens on news of any age');
    assert(/items\.length === 0/.test(screen) && /Nothing new right now/.test(screen), 'an empty tab says nothing');
    const source = readFileSync(join(__dirname, '..', 'src/game/news.ts'), 'utf8');
    assertEqual((source.match(/return recentNews\(mergeNews\(/g) ?? []).length, 1, 'the fresh feed skips the month rule');
    assert(/const fallback = recentNews\(mergeNews\(/.test(source), 'the offline fallback skips the month rule');
  });

  test('a fetched post older than a month never reaches the tab', async () => {
    store.delete('dice-battles:news-cache');
    const news = await withFetch(ok([post('fresh'), post('stale', { date: written(40) })]), fetchNews);
    assertEqual(news.map((n) => n.id).join(','), 'fresh', 'a stale board post was shown');
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
    const bundle = [post('a'), post('b')];
    const merged = mergeNews(bundle, []);
    assertEqual(merged.length, bundle.length, 'the bundle changed size');
    assertEqual(merged[0].id, bundle[0].id, 'the bundle was reordered');
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
      // The bundle, as recentNews leaves it: empty is allowed since 8 Nov 2026.
      assert(Array.isArray(news), 'fetchNews returned something that is not a list');
      assertEqual(news.length, recentNews(NEWS).length, 'a failure did not fall back to the bundle');
    }
  });
});

/**
 * The pictures beside the posts.
 *
 * They were emoji until 10 Sep 2026 — forty-eight different ones across
 * fifty-five posts, each rendering differently on every phone. A post
 * now names a KIND and the drawn set decides what that looks like.
 *
 * The posts a player sees are not only the bundled ones: the board can
 * publish over the top of them. So the thing that must hold is that
 * ANYTHING a post carries in that field still produces a picture.
 */
suite('news · every post has a drawn picture', () => {
  test('no post carries an emoji any more', () => {
    for (const item of NEWS) {
      assert(
        typeof item.icon === 'string' && /^[a-z]+$/.test(item.icon),
        `${item.id} has ${JSON.stringify(item.icon)} where a kind should be`,
      );
    }
    note(`${NEWS.length} posts, ${new Set(NEWS.map((i) => i.icon)).size} kinds in use`);
  });

  test('every kind in the set is one the game can draw', () => {
    // The map in src/ui/newsIcons.tsx is a Record over this list, so a
    // kind added here without a drawing fails to compile. This is the
    // other direction: no duplicates, nothing empty.
    assertEqual(new Set(NEWS_ICON_IDS).size, NEWS_ICON_IDS.length, 'a kind is listed twice');
    for (const id of NEWS_ICON_IDS) assert(id.length > 0, 'a kind has no name');
  });

  test('a post from the board always gets a picture, whatever it says', () => {
    /*
      The feed is written by a person in a browser and read over the
      network. Losing a post over its picture would be much worse than
      showing the wrong picture, so anything unrecognised becomes the
      plain news drawing rather than nothing.
    */
    for (const junk of [undefined, null, '', 'sparkles', 42, {}, [], '📣', 'NEWS']) {
      assertEqual(newsIconId(junk), 'news', `${JSON.stringify(junk)} should fall back`);
    }
    for (const id of NEWS_ICON_IDS) {
      assertEqual(newsIconId(id), id, `${id} should be kept as it is`);
    }
  });

  test('a post with no picture at all still survives the feed', () => {
    // isNewsItem stopped requiring the field on 10 Sep 2026. If it ever
    // starts again, every post the board writes without one vanishes.
    const merged = mergeNews([], [{ ...post('from-the-board'), icon: undefined }]);
    assertEqual(merged.length, 1, 'a post with no picture was dropped');
    assertEqual(newsIconId(merged[0].icon), 'news', 'it should fall back to plain news');
  });
});

/**
 * Big updates (`major`), and the News tab reading as headlines.
 *
 * Marc, 5 Nov 2026: "put it on the news tab and make it to where you can
 * click on it to see the whole thing, but major updates should be a pop
 * up when you open the app for the first time since the update came out."
 */
suite('news · big updates and collapsed posts', () => {
  test('a major post is always about a released version', () => {
    // A popup is keyed to a version (whatsNew.ts), so a major post with
    // none could never pop up.
    for (const item of NEWS) if (newsIsMajor(item)) assert(item.version !== undefined, `${item.id} is major with no version`);
    note(`${NEWS.filter((n) => newsIsMajor(n)).length} major posts bundled`);
  });

  test('at most one major post per version, and it leads that version', () => {
    // whatsNewToShow reads the NEWEST post for a version, so a major post
    // sitting second would never pop up.
    const seen = new Set<string>();
    for (const item of NEWS) {
      if (!item.version) continue;
      const first = !seen.has(item.version);
      seen.add(item.version);
      if (!newsIsMajor(item)) continue;
      assert(first, `${item.id} is major but is not the first post for ${item.version}`);
    }
    for (const version of seen) {
      const majors = NEWS.filter((n) => n.version === version && newsIsMajor(n));
      assert(majors.length <= 1, `${version} has ${majors.length} major posts`);
    }
  });

  test('a post from the board with an odd major survives and is not major', () => {
    for (const junk of [undefined, null, 'yes', 1, 'true', {}]) {
      const merged = mergeNews([], [{ ...post('odd'), major: junk } as unknown as NewsItem]);
      assertEqual(merged.length, 1, `major: ${JSON.stringify(junk)} dropped the post`);
      assert(!newsIsMajor(merged[0]), `major: ${JSON.stringify(junk)} counted as major`);
    }
    assert(newsIsMajor({ ...post('real'), major: true }), 'major: true was not major');
    assert(!newsIsMajor(null) && !newsIsMajor('post'), 'a non-post counted as major');
  });

  test('the News tab shows each post collapsed, and a tap opens it', () => {
    const screen = readFileSync(join(__dirname, '..', 'src/demo/NewsScreen.tsx'), 'utf8');
    assert(
      /numberOfLines=\{expanded \? undefined : COLLAPSED_LINES\}/.test(screen),
      'the body is not cut to a few lines until opened',
    );
    assert(/LayoutAnimation\.configureNext/.test(screen), 'opening a post does not animate');
    assert(
      /<Pressable[\s\S]{0,200}onPress=\{\(\) => toggle\(item\.id\)\}[\s\S]{0,100}accessibilityRole="button"/.test(screen),
      'a post card is not a button that toggles it',
    );
  });

  test('the big-update popup waits for the saved game and never joins the tutorial', () => {
    const game = readFileSync(join(__dirname, '..', 'src/demo/DiceDemoScreen.tsx'), 'utf8');
    assert(
      /const big = tutorialSeen \? whatsNewToShow\(lastSeenVersion, GAME_VERSION, NEWS, tutorialSeen\) : null;/.test(game),
      'the popup can be chosen on the same launch as the tutorial',
    );
    assert(
      /if \(big\) setWhatsNewPost\(big\);\s*else markNewsSeen\(GAME_VERSION\);/.test(game),
      'a launch that shows nothing does not record the version',
    );
    assert(
      /if \(!hydrated \|\| !launched \|\| !whatsNewPost\) return;\s*setPopup\(\(open\) => open \?\? 'whatsnew'\);/.test(game),
      'the popup can open before the saved game is in and the loading screen has lifted',
    );
    assert(
      /onNews=\{\(\) => \{\s*newsSeen\(\);/.test(game),
      'opening the News tab does not count as seeing the update',
    );
  });
});
