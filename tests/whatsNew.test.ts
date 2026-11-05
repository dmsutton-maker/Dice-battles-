import { store } from './storageMock';
import { assertEqual, note, suite, test } from './harness';
import { NEWS, NewsItem } from '../src/game/news';
import { GAME_VERSION } from '../src/game/version';
import { loadLastSeenVersion, markNewsSeen, whatsNewToShow } from '../src/game/whatsNew';

/**
 * The "What's new" popup. Marc, 5 Nov 2026: "major updates should be a
 * pop up when you open the app for the first time since the update came
 * out."
 *
 * "For the first time" is the whole difficulty: shown never is a missed
 * announcement, shown twice is nagging. Every branch of the rule gets a
 * case of its own.
 */

function post(id: string, version: string | undefined, major = false): NewsItem {
  return {
    id,
    date: '5 November 2026',
    title: `Post ${id}`,
    icon: 'news',
    body: 'Something happened, and here is a sentence about it.',
    ...(version ? { version } : {}),
    ...(major ? { major: true as const } : {}),
  };
}

// Newest first, as NEWS is.
const POSTS: NewsItem[] = [
  post('big', 'v1.162.0', true),
  post('small-same-version', 'v1.162.0'),
  post('ordinary', 'v1.161.0'),
  post('older-big', 'v1.160.0', true),
];

suite('whatsNew · when a big update pops up', () => {
  test('a fresh install shows nothing: the tutorial opens instead', () => {
    assertEqual(whatsNewToShow(null, 'v1.162.0', POSTS), null, 'a first launch announced an update');
  });

  test('the first launch after a big update shows its post', () => {
    assertEqual(whatsNewToShow('v1.161.0', 'v1.162.0', POSTS)?.id, 'big', 'the big post did not show');
  });

  test('skipping versions still shows the newest big post once', () => {
    assertEqual(whatsNewToShow('v1.150.0', 'v1.162.0', POSTS)?.id, 'big', 'a player two releases behind missed it');
  });

  test('once seen, never again', () => {
    assertEqual(whatsNewToShow('v1.162.0', 'v1.162.0', POSTS), null, 'shown a second time');
  });

  test('a version newer than the running one counts as seen (a rolled-back update)', () => {
    assertEqual(whatsNewToShow('v1.163.0', 'v1.162.0', POSTS), null, 'shown after a rollback');
  });

  test('an ordinary update shows nothing', () => {
    assertEqual(whatsNewToShow('v1.160.0', 'v1.161.0', POSTS), null, 'a small update popped up');
  });

  test('an ordinary update does not reach back for an older big post', () => {
    // v1.160.0 was big, but the running version's own newest post is not.
    assertEqual(whatsNewToShow('v1.159.0', 'v1.161.0', POSTS), null, 'an old big post was replayed');
  });

  test('a version with no post at all shows nothing', () => {
    assertEqual(whatsNewToShow('v1.161.0', 'v1.170.0', POSTS), null, 'an unannounced version popped up');
  });

  test('only the NEWEST post for the version decides', () => {
    const smallFirst = [post('small', 'v1.162.0'), post('big-second', 'v1.162.0', true)];
    assertEqual(whatsNewToShow('v1.161.0', 'v1.162.0', smallFirst), null, 'a later post for the version decided');
  });

  test('an odd value in major is not major', () => {
    const odd = [{ ...post('odd', 'v1.162.0'), major: 'yes' } as unknown as NewsItem];
    assertEqual(whatsNewToShow('v1.161.0', 'v1.162.0', odd), null, '"yes" counted as major');
  });

  test('an unreadable remembered version counts as old', () => {
    assertEqual(whatsNewToShow('garbage', 'v1.162.0', POSTS)?.id, 'big', 'garbage hid the post');
  });

  test("today's bundled news against today's version", () => {
    const shown = whatsNewToShow('v0.0.0', GAME_VERSION, NEWS);
    note(`${GAME_VERSION}: ${shown ? `"${shown.title}" pops up` : 'nothing pops up'}`);
    assertEqual(whatsNewToShow(GAME_VERSION, GAME_VERSION, NEWS), null, 'the running version was not treated as seen');
  });
});

suite('whatsNew · remembering what was seen', () => {
  const KEY = 'dice-battles:news-seen-version';

  test('nothing stored reads as null', async () => {
    store.delete(KEY);
    assertEqual(await loadLastSeenVersion(), null, 'an empty store invented a version');
  });

  test('a version marked seen reads back', async () => {
    store.delete(KEY);
    markNewsSeen('v1.162.0');
    await Promise.resolve();
    assertEqual(await loadLastSeenVersion(), 'v1.162.0', 'the version was not kept');
    // Under the game's own dice-battles: family of keys.
    assertEqual(store.get(KEY), 'v1.162.0', 'kept under some other key');
  });
});
