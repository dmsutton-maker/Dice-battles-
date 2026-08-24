import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * What's new in the game, shown in the News tab.
 *
 * These posts are BUNDLED with the app: they are what a player sees on a
 * fresh install, on a plane, and the first moment the tab opens before
 * anything has been fetched. Posts written on the HQ board are layered on
 * top of them at runtime (see fetchNews below) — the bundled list is the
 * floor, never the ceiling.
 *
 * That split is the whole design. A purely live feed would show an empty
 * News tab to anyone offline, and a purely bundled one goes stale the
 * moment something is worth announcing between releases. This list is
 * always right about what shipped; the board can add to it.
 *
 * Newest first. Dates are plain strings so they read the same on every
 * device regardless of locale settings.
 */

export interface NewsItem {
  id: string;
  date: string;
  title: string;
  emoji: string;
  body: string;
  /** Set when the post is about a released version. */
  version?: string;
}

export const NEWS: NewsItem[] = [
  {
    id: 'v1-29-0-hazards',
    date: '24 August 2026',
    version: 'v1.29.0',
    title: 'Every battlefield has its own traps',
    emoji: '🕳️',
    body:
      'On Medium and Hard the hill and the water used to be drawn the same ' +
      'everywhere — a grassy bump and a stone-edged pond, even on a space ' +
      'station. Now the jungle has a proper lake with an earth bank, and the ' +
      'station has a metal dome and an open hatch that a die falls straight ' +
      'through. They behave exactly the same as each other, so Hard is still ' +
      'Hard wherever you play it.',
  },
  {
    id: 'v1-28-0-arenas',
    date: '24 August 2026',
    version: 'v1.28.0',
    title: 'Battlefields open straight away',
    emoji: '⚡',
    body:
      'Looking through the battlefields used to show you the last one for a ' +
      'moment before the new one appeared. The ground and walls are drawn dot ' +
      'by dot when an arena opens, and the game was redoing that every single ' +
      'time — even for one you had already looked at. Now each is drawn once ' +
      'and kept.',
  },
  {
    id: 'v1-27-0-jungle',
    date: '24 August 2026',
    version: 'v1.27.0',
    title: 'The Jungle Clearing, rebuilt',
    emoji: '🌴',
    body:
      'The jungle was quietly using the castle\'s stone floor with green paint ' +
      'on it — you could see the slabs and the lines between them. It has ' +
      'proper ground now, and the fence around it is a real wall of logs ' +
      'instead of a row of posts you were looking down on the tops of.',
  },
  {
    id: 'v1-26-0-roll',
    date: '24 August 2026',
    version: 'v1.26.0',
    title: 'Never wait for the dice again',
    emoji: '🎲',
    body:
      'Swipe whenever you like. You no longer wait for the dice to stop ' +
      'rolling — the moment you swipe, the roll counts and the next one is on ' +
      'its way. The dice settle onto whichever colour was already facing up, ' +
      'so what gets counted is what you see.',
  },
  {
    id: 'v1-25-0-frost',
    date: '24 August 2026',
    version: 'v1.25.0',
    title: 'Snowflakes on the Frost dice',
    emoji: '❄️',
    body:
      'The Frost dice have proper snowflakes now, six arms with branches off ' +
      'each one and a little bar across every tip. Every flake is a different ' +
      'size and turned a different way, so no two on a die are the same.',
  },
  {
    id: 'v1-24-0-materials',
    date: '24 August 2026',
    version: 'v1.24.0',
    title: 'Wood, marble, granite, gold and silver',
    emoji: '✨',
    body:
      'Dice that look like what they are made of. The wooden ones have growth ' +
      'rings, the marble has veins running through it, the granite is flecked ' +
      'stone — and the gold and silver both catch a sweep of light across the ' +
      'face as they turn.',
  },
  {
    id: 'v1-23-0-gamecenter',
    date: '23 August 2026',
    version: 'v1.23.0',
    title: 'World rankings are coming',
    emoji: '🌍',
    body:
      'Your trophies and battles won will go up against everyone else\'s ' +
      'through Game Center, with ten things to earn along the way — your first ' +
      'win, winning on Hard, winning in all four modes, one for each ' +
      'battlefield you unlock, and one for collecting ten sets of dice. It ' +
      'needs a new version from the App Store rather than the usual instant ' +
      'update, so it will arrive with the next one.',
  },
  {
    id: 'v1-22-0-battlefields',
    date: '23 August 2026',
    version: 'v1.22.0',
    title: 'The battlefields stopped looking the same',
    emoji: '🏰',
    body:
      'Every arena used to be four tall walls with a different ornament on ' +
      'top, so they all read as the castle in another colour. The jungle and ' +
      'the space station have been rebuilt from the ground up — different ' +
      'shapes, not just different paint.',
  },
  {
    id: 'v1-21-0-tutorial',
    date: '23 August 2026',
    version: 'v1.21.0',
    title: 'How to play',
    emoji: '❓',
    body:
      'Six short pages explaining the whole game: the six prisoners, how to ' +
      'throw, the one rule everything is built on, the four modes, and what ' +
      'trophies and coins are for. It opens by itself the first time and is ' +
      'always one tap away from the home screen after that.',
  },
  {
    id: 'v1-17-0-previews',
    date: '22 August 2026',
    version: 'v1.18.0',
    title: 'See an item before you buy it',
    emoji: '👀',
    body:
      'Tap anything in the Store or the Inventory and you see it on the real ' +
      'board — the actual dice, the actual battlefield — rather than a small ' +
      'picture of it. Buying happens right there, and the Inventory now points ' +
      'you at the Store instead of letting you buy from the wrong place.',
  },
  {
    id: 'v1-11-0',
    date: '19 August 2026',
    version: 'v1.11.0',
    title: 'Tournaments, News and a bottom menu',
    emoji: '🏆',
    body:
      'Three cups to enter, each a knockout bracket against the opponents ' +
      'you already know. Win every round to be champion — lose one and the ' +
      'run is over. All the menus moved to the bar along the bottom, so ' +
      'everything is one tap away instead of buried.',
  },
  {
    id: 'v1-10-2-feel',
    date: '19 August 2026',
    version: 'v1.10.2',
    title: 'The dice follow your finger properly now',
    emoji: '🎲',
    body:
      'If you flicked the dice and paused for a moment before lifting your ' +
      'finger, the game read it as a gentle tap and rolled them slowly ' +
      'forward instead of throwing them where you aimed. Fixed — it now ' +
      'measures the last moment of the flick.',
  },
  {
    id: 'v1-10-2-modes',
    date: '19 August 2026',
    version: 'v1.10.2',
    title: 'Every mode plays in split screen',
    emoji: '👥',
    body:
      'Two-player split screen used to be Color Rush only. Ultimate, ' +
      'Skirmish and Color War all play head-to-head now. In Skirmish you ' +
      'share one jail, so grabbing a colour takes it out from under the ' +
      'other player.',
  },
  {
    id: 'v1-10-2-shapes',
    date: '19 August 2026',
    version: 'v1.10.2',
    title: 'Colorblind mode',
    emoji: '🔷',
    body:
      'A new setting gives every colour its own shape as well — a circle ' +
      'for red, a square for blue, and so on. Helpful if colours are hard ' +
      'to tell apart, and in bright sunlight it helps everyone. Find it in ' +
      'Settings.',
  },
];

/**
 * Posts written on the HQ board, layered over the bundled ones.
 *
 * THE RULES, in order of importance:
 *
 * 1. The News tab must never be empty and must never show an error. It is
 *    a page of announcements, not a feature — if the network is gone, the
 *    right outcome is the news we shipped with, silently.
 * 2. Nothing here may block. The fetch happens after the tab is already
 *    drawn from the bundled list, and swaps in more if any arrive.
 * 3. No key of any kind lives in the app. The game reads a plain public
 *    URL on the website, and the website holds the database credentials.
 *    A token inside an app is not a token — it is a string anybody can
 *    pull out of the binary.
 */

const FEED_URL = 'https://dice-battles-hq.vercel.app/api/news';
const CACHE_KEY = 'dice-battles:news-cache';
/** Long enough that a plane journey still shows the last news seen. */
const FETCH_TIMEOUT_MS = 6000;

function isNewsItem(value: unknown): value is NewsItem {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    item.id.length > 0 &&
    typeof item.date === 'string' &&
    typeof item.title === 'string' &&
    typeof item.emoji === 'string' &&
    typeof item.body === 'string' &&
    (item.version === undefined || typeof item.version === 'string')
  );
}

/**
 * Bundled posts plus fetched ones, newest first, no duplicates.
 *
 * A fetched post WINS over a bundled one with the same id, which is what
 * makes a correction possible: fix the wording on the board and the fixed
 * version is what players see, without shipping anything.
 */
export function mergeNews(bundled: NewsItem[], fetched: NewsItem[]): NewsItem[] {
  const byId = new Map<string, NewsItem>();
  for (const item of bundled) byId.set(item.id, item);
  for (const item of fetched) byId.set(item.id, item);
  // The board's own order first, then everything bundled that it did not
  // mention. Deliberately not sorted by date: the dates are free text so
  // they read properly on every phone, and parsing them back into real
  // dates to sort by would be inventing a contract the writer never
  // agreed to.
  const fetchedIds = new Set(fetched.map((f) => f.id));
  return [
    ...fetched.map((f) => byId.get(f.id)!),
    ...bundled.filter((b) => !fetchedIds.has(b.id)),
  ];
}

/** The last feed we managed to read, so a cold start offline still has it. */
async function readCache(): Promise<NewsItem[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isNewsItem) : [];
  } catch {
    return [];
  }
}

/**
 * Fetch the board's posts. Resolves to the merged list, always.
 *
 * Never rejects and never throws. Every failure path — no network, a
 * timeout, a 500, malformed JSON, a post missing a field — ends at the
 * same place: the news this version of the game already had.
 */
export async function fetchNews(): Promise<NewsItem[]> {
  const cached = await readCache();
  // Something to show immediately if the request below never answers.
  const fallback = mergeNews(NEWS, cached);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(FEED_URL, { signal: controller.signal });
    if (!response.ok) return fallback;
    const body = await response.json();
    const posts: unknown = (body as Record<string, unknown>)?.posts;
    if (!Array.isArray(posts)) return fallback;

    // Each post is checked on its own, so one malformed row costs that
    // row and not the whole feed.
    const clean = posts.filter(isNewsItem);
    if (clean.length === 0) return fallback;

    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(clean)).catch(() => {});
    return mergeNews(NEWS, clean);
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}
