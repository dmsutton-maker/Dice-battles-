import type { Challenge } from './friendlyBattle';

/**
 * Playing the same person again — the rules, with no React and no
 * network.
 *
 * Marc, 5 Nov 2026: "After a game against your friend, if one of you
 * chooses to play again, it should have to wait for the other player
 * too in order to be able to play again, because right now it plays
 * again against your friend but they're not playing really."
 *
 * Until then "Play again" on the result screen of a friend battle
 * started an ORDINARY battle against a bot wearing the friend's name and
 * short — it looked like a rematch and was not one. Now it is an ASK,
 * sent to the server (battlesApi.ts, askRematch) as an invite the other
 * player has to accept, and the asker waits in the same room a
 * challenge waits in (FriendlyWaitOverlay) until they do. Both asking
 * at once is one battle: the server turns the second ask into an accept
 * of the first (hq/src/lib/rematch.ts).
 */

/**
 * How long after a battle ends either player may ask for a rematch.
 * Must equal REMATCH_WINDOW_MS in hq/src/lib/rematch.ts; the server
 * refuses an ask outside it and lets the invite run out at its end.
 */
export const REMATCH_WINDOW_MS = 10 * 60_000;

/** May a battle that ended at `endedAt` still be played again now? */
export function rematchWindowOpen(endedAt: number, now: number = Date.now()): boolean {
  if (!Number.isFinite(endedAt) || !Number.isFinite(now)) return false;
  return now - endedAt < REMATCH_WINDOW_MS;
}

/** The result screen's button, by the opponent's name: never a plain "Play again". */
export function rematchButtonLabel(name: string): string {
  return `Play again with ${name}`;
}

/** The other player's screen, in the challenge banner's place. */
export function rematchAskLine(name: string): string {
  return `${name} wants a rematch!`;
}

/** The waiting room, once they have left or the ten minutes are up. */
export function goneLine(name: string): string {
  return `${name} has gone`;
}

export const REMATCH_ACCEPT = 'Accept';
export const REMATCH_NOT_NOW = 'Not now';
export const BACK_TO_MENU = 'Back to menu';

/** Is this invite the rematch of the battle this phone just finished? */
export function isRematchOf(invite: Pick<Challenge, 'rematchOf'>, battleId: string): boolean {
  return typeof invite.rematchOf === 'string' && invite.rematchOf === battleId;
}

/**
 * WHY THE WAIT IS OVER, read from the poll while my rematch ask is out.
 *
 * - `window`: ten minutes since the battle ended. This phone's own
 *   reckoning, so a poll that cannot get through still ends the wait.
 * - `missing`: the server no longer lists my invite as waiting — they
 *   declined it, it ran out, or it was answered and the battle will be
 *   on the next poll. One poll that failed looks exactly the same, so
 *   the screen waits for REMATCH_MISSES of these in a row.
 * - `offline`: they have not spoken to the server for a while. Their
 *   app was closed; a person thinking it over is still polling.
 * Null while there is still somebody to wait for. Only ever asked once
 * the server has answered the ask with an invite id.
 */
export type RematchGone = 'window' | 'missing' | 'offline' | null;

export function whyRematchGone(
  outgoing: Pick<Challenge, 'id' | 'who'> | null,
  inviteId: string,
  endedAt: number,
  now: number = Date.now(),
): RematchGone {
  if (!rematchWindowOpen(endedAt, now)) return 'window';
  if (!outgoing || outgoing.id !== inviteId) return 'missing';
  if (outgoing.who?.online === false) return 'offline';
  return null;
}

/** Polls in a row without my invite before it is read as answered. */
export const REMATCH_MISSES = 2;

/**
 * The countdown on an invite. A challenge's 45 seconds read as a plain
 * number; a rematch invite can have nine minutes left, and "540" on a
 * banner is not a time anybody reads.
 */
export function inviteClockLabel(seconds: number): string {
  const s = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  if (s < 60) return String(s);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
