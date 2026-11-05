import AsyncStorage from '@react-native-async-storage/async-storage';
import { NewsItem, newsIsMajor } from './news';

/**
 * The "What's new" popup: a big update announces itself, once.
 *
 * Marc, 5 Nov 2026: "major updates should be a pop up when you open the
 * app for the first time since the update came out." Which posts count as
 * major is decided where they are written (`major` in news.ts); this file
 * decides WHEN one is shown, and remembers the last version the player
 * has been told about.
 */

/** "v1.161.0" as numbers. Anything unreadable counts as older than every version. */
function versionParts(version: string): number[] {
  const parts = version.replace(/^v/, '').split('.').map(Number);
  return parts.length === 3 && parts.every(Number.isFinite) ? parts : [-1, -1, -1];
}

function compareVersions(a: string, b: string): number {
  const x = versionParts(a);
  const y = versionParts(b);
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}

/**
 * The post to pop up at this launch, or null for none.
 *
 * - Nothing seen before (a fresh install): null. There is nothing to
 *   announce to somebody who has never played; the tutorial opens instead.
 * - The player has already seen this version, or a later one: null. Once
 *   means once.
 * - The newest post for the running version is not major, or there is no
 *   post for it at all: null. An ordinary update waits in the News tab.
 *
 * `posts` is newest first, as NEWS is, so the first post for `current` is
 * the newest one.
 */
export function whatsNewToShow(
  lastSeenVersion: string | null,
  current: string,
  posts: NewsItem[],
): NewsItem | null {
  if (lastSeenVersion === null) return null;
  if (compareVersions(lastSeenVersion, current) >= 0) return null;
  const newest = posts.find((post) => post.version === current);
  return newest && newsIsMajor(newest) ? newest : null;
}

const STORAGE_KEY = 'dice-battles:news-seen-version';

/** The last version the player was told about, or null if never. Never rejects. */
export async function loadLastSeenVersion(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    // Unreadable reads as a fresh install: no popup, which is the quiet
    // way to be wrong.
    return null;
  }
}

/**
 * Remember that the player has been told about `version`.
 *
 * Written when the popup is dismissed, when the News tab is opened, and
 * on every launch that shows nothing, so the NEXT big update still shows
 * once. Fire and forget, like markTutorialSeen.
 */
export function markNewsSeen(version: string): void {
  AsyncStorage.setItem(STORAGE_KEY, version).catch(() => {});
}
