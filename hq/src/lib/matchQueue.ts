/**
 * Online matchmaking, the rules the server pairs people by.
 *
 * Marc, 4 Nov 2026: "add the online matchmaking where you now verse real
 * players instead of bots. it should search for a player for 15 seconds
 * and it should say 'searching for opponent' or something, and if it
 * can't find a real person to verse after 15 seconds then it loads you
 * against one of the bots".
 *
 * There is no socket and no lobby process. A phone that is searching
 * asks ../app/api/match about once a second; each ask stamps its row in
 * `match_queue` and looks for somebody else whose row is fresh. When two
 * fit, one battle row is written for both of them (claim_match in
 * ../../supabase/migrations/20261104_matchmaking.sql) and from then on it
 * is an ordinary live battle (../app/api/battles/live), the same protocol
 * friends already use, marked `kind = 'match'`.
 *
 * Pure, with no Next.js or Supabase import, so the game's headless tests
 * can check it (tests/matchServer.test.ts), as battleClock.ts is.
 */

/**
 * The modes that can be played live: Color Rush and Ultimate. Must equal
 * FRIENDLY_MODES in src/game/friendlyBattle.ts.
 */
export const MATCH_MODES = ['classic', 'ultimate'];

/** The difficulties the game has, as the battles route lists them. */
export const MATCH_DIFFICULTIES = ['easy', 'medium', 'hard'];

/**
 * A row not stamped for this long is not paired with. A searching phone
 * asks about once a second (SEARCH_POLL_MS in src/game/matchSearch.ts),
 * so four seconds of silence means it has stopped looking: the app was
 * closed or the phone lost signal, and pairing it would put somebody in
 * a room with nobody.
 */
export const QUEUE_FRESH_MS = 4_000;

/** A row this old is deleted the next time anybody searches. */
export const QUEUE_FORGET_MS = 10 * 60_000;

/** The trophy ceiling a search is clamped to. */
export const MAX_TROPHIES = 99_999;

/**
 * How far apart in trophies two people may be and still be paired, after
 * waiting this long. Close at first, then wider every second, so somebody
 * at a quiet hour still finds a game inside the fifteen seconds rather
 * than waiting for a perfect match who never comes.
 */
export function trophyBand(waitedMs: number): number {
  const seconds = Number.isFinite(waitedMs) ? Math.max(0, Math.floor(waitedMs / 1000)) : 0;
  return 300 + 100 * seconds;
}

/** One row of the queue, as the route reads it. */
export type QueueEntry = {
  playerId: string;
  mode: string;
  difficulty: string;
  trophies: number;
  state: string;
  joinedAtMs: number;
  seenAtMs: number;
};

/**
 * Who `me` should be paired with, or null for nobody yet.
 *
 * Same mode and difficulty, a row stamped in the last QUEUE_FRESH_MS,
 * never themselves, never anybody blocked in either direction, and
 * within the trophy band of BOTH people's waits: a newcomer's narrow
 * band protects them as much as a long wait widens the other's. Of
 * those, the nearest in trophies, then whoever has waited longest.
 */
export function pickPartner(
  me: QueueEntry,
  candidates: QueueEntry[],
  nowMs: number,
  blockedIds: ReadonlySet<string>,
): QueueEntry | null {
  const myBand = trophyBand(nowMs - me.joinedAtMs);
  const fits = candidates.filter((c) => {
    if (c.playerId === me.playerId || blockedIds.has(c.playerId)) return false;
    if (c.state !== 'searching') return false;
    if (c.mode !== me.mode || c.difficulty !== me.difficulty) return false;
    if (!(Number.isFinite(c.seenAtMs) && nowMs - c.seenAtMs < QUEUE_FRESH_MS)) return false;
    const gap = Math.abs(c.trophies - me.trophies);
    return gap <= myBand && gap <= trophyBand(nowMs - c.joinedAtMs);
  });
  fits.sort(
    (x, y) =>
      Math.abs(x.trophies - me.trophies) - Math.abs(y.trophies - me.trophies) ||
      x.joinedAtMs - y.joinedAtMs,
  );
  return fits[0] ?? null;
}

/**
 * The name a stranger is shown: the one the player chose (their Game
 * Center alias), or just "Player". Never the player_id and never the
 * friend code, which are how somebody is found, not what they are called.
 */
export function opponentDisplayName(name: unknown): string {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  return trimmed || 'Player';
}

/**
 * How many colours a whole rescue is. Must equal PRISONER_COLORS.length
 * in src/game/colors.ts.
 */
export const MATCH_FULL_RESCUE = 6;

/**
 * No real game against a person is won faster than this, counted from
 * the moment both phones were in the room. Six colours freed takes
 * several rolls of a second and a half each, after the four-second
 * reveal and countdown.
 */
export const MATCH_MIN_MS = 20_000;

/**
 * Does a claim to have won a MATCH hold up? Only with every colour freed
 * and only after MATCH_MIN_MS. A friend battle trusts the claim, because
 * it pays nothing; a match against a stranger is not a family game, so
 * the server checks the two things it can see. A claim that fails is
 * ignored, not punished: the battle carries on and the clock still ends
 * it.
 */
export function matchClaimHolds(freed: unknown, startedAtMs: number, nowMs: number): boolean {
  const distinct = Array.isArray(freed)
    ? new Set(freed.filter((x) => typeof x === 'string')).size
    : 0;
  return (
    distinct >= MATCH_FULL_RESCUE &&
    Number.isFinite(startedAtMs) &&
    nowMs - startedAtMs >= MATCH_MIN_MS
  );
}

/**
 * Is this database error the matchmaking tables or function not being
 * there yet — the migration not applied? Postgres says 42P01 (no such
 * relation) or 42883 (no such function); PostgREST, which sits in front
 * of it, answers PGRST205 / PGRST202 from its schema cache first. The
 * route answers `off` to that, and the game plays a bot at once.
 */
export function isServiceMissing(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (code === '42P01' || code === '42883' || code === '42703') return true;
  if (code === 'PGRST202' || code === 'PGRST205' || code === 'PGRST204') return true;
  const text = typeof message === 'string' ? message : '';
  return /does not exist|could not find the (table|function)/i.test(text);
}
