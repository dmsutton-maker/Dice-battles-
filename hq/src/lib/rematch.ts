/**
 * The rematch, as the server decides it.
 *
 * Marc, 5 Nov 2026: "After a game against your friend, if one of you
 * chooses to play again, it should have to wait for the other player too
 * in order to be able to play again, because right now it plays again
 * against your friend but they're not playing really."
 *
 * "Play again" after a live battle used to start an ordinary battle
 * against a bot wearing the friend's name. Now it is an INVITE, the
 * same battle_invites row a challenge is, from whoever asked to the
 * other player, marked `rematch_of` the battle just finished
 * (../../supabase/migrations/20261105_rematch.sql). Nothing starts until
 * the other player accepts it — or asks for a rematch themselves, which
 * is the same thing said the other way round.
 *
 * Pure, with no Next.js or Supabase import, so the game's headless tests
 * can check it (tests/friendlyServer.test.ts), as battleClock.ts and
 * matchQueue.ts are. The game cannot be imported from here, so the one
 * number the game also has is copied and the test fails if they drift.
 */

/**
 * How long after a battle ends either player may ask for a rematch.
 * Must equal REMATCH_WINDOW_MS in src/game/rematch.ts.
 *
 * Ten minutes, as asked. Long enough to answer the door and come back;
 * short enough that "play again" still means the game just played,
 * rather than a message waiting in an inbox, which a challenge is
 * deliberately not (see the note at the top of ../app/api/battles).
 */
export const REMATCH_WINDOW_MS = 10 * 60_000;

/** May a battle that ended at `endedAtMs` still be played again now? */
export function rematchWindowOpen(endedAtMs: number, nowMs: number): boolean {
  if (!Number.isFinite(endedAtMs) || !Number.isFinite(nowMs)) return false;
  return nowMs - endedAtMs < REMATCH_WINDOW_MS;
}

/**
 * When a rematch invite expires: the end of the window, not a
 * challenge's 45 seconds. The asker is sitting in a waiting room that
 * says "Waiting for Marc…" until the invite is answered or runs out,
 * and both phones were told ten minutes.
 */
export function rematchExpiresAt(endedAtMs: number): number {
  return endedAtMs + REMATCH_WINDOW_MS;
}

/** The two columns of an open invite the merge looks at. */
export type RematchInvite = { id: string; from_id: string; to_id: string };

/**
 * WHAT ONE ASK DOES, given the rematch invites already open for the
 * battle — which is how two people asking at once end up in one battle.
 *
 * - `accept`: the OTHER player asked first and their invite is waiting
 *   for me. My ask is their answer: accept it, and the battle takes that
 *   invite's id exactly as a tapped Accept would. Each phone then finds
 *   the room on its own poll, whichever of them sent the second ask.
 * - `mine`: I already asked. Nothing new; the open invite is the answer,
 *   so a second tap, or a phone that lost the first answer, cannot send
 *   a second invite.
 * - `ask`: nobody has asked yet. Make the invite.
 *
 * Theirs is looked for before mine, so if both somehow exist (two
 * requests racing past the lookup) the next ask from either side still
 * settles on one battle rather than leaving two invites waiting.
 */
export function mergeRematchAsks<T extends RematchInvite>(
  me: string,
  open: readonly T[],
): { kind: 'accept'; invite: T } | { kind: 'mine'; invite: T } | { kind: 'ask' } {
  const theirs = open.find((i) => i.to_id === me && i.from_id !== me);
  if (theirs) return { kind: 'accept', invite: theirs };
  const mine = open.find((i) => i.from_id === me);
  if (mine) return { kind: 'mine', invite: mine };
  return { kind: 'ask' };
}

/**
 * What kind of battle a rematch is: the kind the original was. A rematch
 * against the stranger matchmaking paired us with counts like the match
 * did (src/game/stakes.ts); one against a friend is as free as the
 * first. A row from before the `kind` column existed has none, and was
 * a friend battle.
 */
export function rematchKind(originalKind: unknown): 'friend' | 'match' {
  return originalKind === 'match' ? 'match' : 'friend';
}
