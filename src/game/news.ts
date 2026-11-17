import AsyncStorage from '@react-native-async-storage/async-storage';
import { stripEmojiDeep } from './noEmoji';

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
 *
 * FOR PLAYERS ONLY. David, 8 Nov 2026, on seeing "the seasons have
 * swapped round" pop up: "Why would you put in the game the seasons were
 * swapped. We didn't even launch yet. Don't put back end updates that
 * are just for us in the news." So a post is written for somebody who
 * installed the game today and knows nothing of its history: it says
 * what is in the game and what is new to play. Never the calendar
 * behind the pass, never "built" or "coming soon", never a fix to
 * something only the family ever saw, never how the game is made. The
 * list was cut from 103 posts to the ones that pass that test on the
 * same day. And every new or changed post, with whether it pops up, is
 * shown to David or Marc in chat BEFORE the update that carries it is
 * published (AGENTS.md, Releasing).
 *
 * NO NAMES. David asked on 25 Aug 2026, and it applies to everyone in the
 * family, not only the post it came from. The News tab is read by every
 * stranger who installs the game, so "AJ spotted that..." publishes a
 * child's name to the App Store. Credit a reporter as "somebody" or
 * "a player" and thank them without naming them; the person who found it
 * knows which one they are. `tests/news.test.ts` fails on a first name.
 */

/**
 * The pictures a post can carry.
 *
 * Every post used to name its own emoji, and fifty-five posts had
 * forty-eight different ones — which is not a set, it is forty-eight
 * borrowed pictures that each render differently on every phone. David
 * asked on 10 Sep 2026 for these to be drawn like the rest of the game.
 *
 * Drawing forty-eight would have been the wrong answer: what the list
 * actually needs is to say what KIND of change a post is about, and a
 * dozen kinds covers every post there has ever been. So a post picks a
 * kind and `src/ui/newsIcons.tsx` decides what that looks like.
 *
 * Kept here, in the rules, rather than beside the drawings, because the
 * headless tests read this file and have no renderer at all.
 */
export const NEWS_ICON_IDS = [
  'news',
  'dice',
  'arena',
  'look',
  'speed',
  'sound',
  'people',
  'cups',
  'shop',
  'fix',
  'phone',
  'help',
] as const;

export type NewsIconId = (typeof NEWS_ICON_IDS)[number];

/**
 * Read a kind off a post, whatever the post actually contains.
 *
 * Posts can arrive from the board over the network, written by a person
 * in a browser, so this must never throw and never render nothing: an
 * unknown kind, a missing one, or an old post still carrying an emoji
 * all come back as the plain news picture. A post with a slightly wrong
 * icon is a small thing; a post that fails to draw is a hole in the
 * list.
 */
export function newsIconId(value: unknown): NewsIconId {
  return NEWS_ICON_IDS.includes(value as NewsIconId) ? (value as NewsIconId) : 'news';
}

export interface NewsItem {
  id: string;
  date: string;
  title: string;
  /**
   * Optional because a post fetched from the board may not have one, and
   * losing the post would be worse than losing its picture. Every post
   * bundled with the game does have one — `npm test` checks that.
   */
  icon?: NewsIconId;
  body: string;
  /** Set when the post is about a released version. */
  version?: string;
  /**
   * A BIG update: the post opens by itself, once, the first time the game
   * starts after that version arrives (src/game/whatsNew.ts). Everything
   * else waits in the News tab for whoever looks.
   *
   * Mark a post major when it is a new way to play, or a change every
   * player will notice the moment they open the game: online battles, a
   * new mode, the Shop no longer opening on blank squares. Not for one
   * redrawn die, one new item or a quiet fix, however welcome; a popup
   * on every update is a popup nobody reads. At most one major post per version, and it is
   * the first post for that version (`npm test` checks both).
   *
   * Read it through newsIsMajor, never directly: a post from the board
   * can carry anything in this field.
   */
  major?: true;
}

/**
 * Whether a post is a big update, whatever the post actually contains.
 *
 * The same tolerance as newsIconId: a post from the board is written in a
 * browser, so a missing field, "yes", 1 or anything else odd is simply
 * not major rather than a reason to drop the post.
 */
export function newsIsMajor(item: unknown): boolean {
  return typeof item === 'object' && item !== null && (item as Record<string, unknown>).major === true;
}

/**
 * Cleared on 8 Nov 2026 at David's request ("Clear the news tab and then
 * automatically clear any future news items older than one month").
 * What goes here from now on is for players only, and David or Marc reads
 * it before it ships (AGENTS.md, Releasing). A post disappears by itself
 * a month after its date (`recentNews`), so nothing needs taking out by
 * hand.
 */
export const NEWS: NewsItem[] = [];

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

/**
 * The day a post is dated, as UTC midnight, or null if it cannot be read.
 *
 * Bundled posts are written "8 November 2026"; a post typed on the board
 * may be that or "2026-11-08". Anything else is unreadable.
 */
export function newsDate(text: string): number | null {
  const t = text.trim();
  let y: number, m: number, d: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  const words = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(t);
  if (iso) {
    [y, m, d] = [Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])];
  } else if (words) {
    m = MONTHS.indexOf(words[2].toLowerCase());
    [y, d] = [Number(words[3]), Number(words[1])];
  } else return null;
  if (m < 0 || m > 11 || d < 1 || d > 31) return null;
  const at = Date.UTC(y, m, d);
  // "31 February" rolls into March in Date.UTC: not a real date.
  return new Date(at).getUTCDate() === d ? at : null;
}

/**
 * The posts still worth showing: those dated within the last month.
 *
 * A post dated 8 November shows until the end of 8 December, then is
 * gone, from the bundled list and the board alike. A post whose date
 * cannot be read is not shown either: it cannot be told apart from one a
 * year old, and stale news staying up for ever is exactly what this is
 * here to stop.
 */
export function recentNews(items: NewsItem[], now: number = Date.now()): NewsItem[] {
  return items.filter((item) => {
    const at = newsDate(item.date);
    if (at === null) return false;
    const day = new Date(at);
    // The same day next month, through to its end.
    const until = Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate() + 1);
    return now < until;
  });
}

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
    // No check on `icon`: newsIconId turns anything at all into a real
    // picture, so a post is never dropped over one.
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
    // Saved before the emoji rule, possibly: cleaned on the way out too.
    const parsed = stripEmojiDeep(JSON.parse(raw));
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
  const fallback = recentNews(mergeNews(NEWS, cached));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(FEED_URL, { signal: controller.signal });
    if (!response.ok) return fallback;
    // Typed into the HQ board from a browser: no emoji reaches the News tab.
    const body = stripEmojiDeep(await response.json());
    const posts: unknown = (body as Record<string, unknown>)?.posts;
    if (!Array.isArray(posts)) return fallback;

    // Each post is checked on its own, so one malformed row costs that
    // row and not the whole feed.
    const clean = posts.filter(isNewsItem);
    if (clean.length === 0) return fallback;

    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(clean)).catch(() => {});
    return recentNews(mergeNews(NEWS, clean));
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}
