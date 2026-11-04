/**
 * Is there a real person waiting for a game right now?
 *
 * Marc, 4 Nov 2026: "add the online matchmaking where you now verse real
 * players instead of bots. it should search for a player for 15 seconds
 * and it should say 'searching for opponent' or something, and if it
 * can't find a real person to verse after 15 seconds then it loads you
 * against one of the bots".
 *
 * THE SERVICE NOW EXISTS. The queue is a table on the HQ site
 * (`match_queue`, asked through /api/match): two phones searching for
 * the same mode and difficulty, close enough in trophies, are paired out
 * of it into a `battles` row. The shared round is the friend battle's
 * live route (/api/battles/live) unchanged — Color Rush and Ultimate are
 * independent races, so "these are the colours I have freed" is the
 * whole game, and the server keeps the clock. Without a person, the
 * opponent is the computer, rolling from `ai.ts` on a timer, as always.
 *
 * THE HONEST RULE. A player only waits when the server is really
 * looking. "Nobody found" means the game looked and the queue was empty,
 * and it is fair to spend fifteen seconds establishing that. "No
 * service" means the question cannot be asked — a site from before
 * /api/match, the migration not applied, no connection — and pretending
 * to ask it for fifteen seconds would be theatre in front of children
 * who would believe it. So the first `off` answer turns the switch below
 * off for the rest of the session and every later start goes straight
 * to a rival, exactly as before matchmaking existed.
 *
 * Never throws and never blocks: the same rule as `ads.ts` and
 * `friendsApi.ts`. A search that hangs is worse than one that fails,
 * because the player is staring at it.
 */
import type { Identity } from './playerIdentity';
import type { Pairing } from './matchSearch';
import { leaveMatch, pulseBattle, searchMatch, type MatchAnswer, type MatchRequest } from './battlesApi';
import { pushProfile } from './friendsApi';

export type { MatchRequest } from './battlesApi';

/** What `pushProfile` publishes, built the way the Friends screen builds it. */
export type ProfileStats = Parameters<typeof pushProfile>[1];

let serviceOn = true;

/** False once the server has said `off` (or could not be reached) this session. */
export function hasMatchmakingService(): boolean {
  return serviceOn;
}

/** Tests only: a fresh session. */
export function resetMatchmakingForTest(): void {
  serviceOn = true;
}

/**
 * The name shown for a stranger: what they chose, or "Player". Never
 * their id or friend code. The same rule as the server's
 * `opponentDisplayName` (hq/src/lib/matchQueue.ts), applied again here
 * so an older or odd answer still cannot put an id on screen.
 */
export function opponentDisplayName(name: unknown): string {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  return trimmed.length > 0 ? trimmed : 'Player';
}

function asPairing(answer: MatchAnswer): Pairing | null {
  if (answer.kind === 'matched') {
    return {
      kind: 'player',
      playerId: answer.battle.opponentId ?? '',
      name: opponentDisplayName(answer.opponentName),
      battle: answer.battle,
    };
  }
  if (answer.kind === 'off' || answer.kind === 'no-profile') {
    return { kind: 'bot', reason: 'no-service' };
  }
  // Still searching (or a `left` this build did not ask for): keep waiting.
  return null;
}

/**
 * Ask once whether somebody is waiting. Null means "not yet, keep
 * waiting" — the deadline in matchSearch.ts ends the wait, not this.
 *
 * A server that does not know this phone (`no-profile`) is sent the
 * profile once and asked again once; the queue needs a profile row.
 */
export async function findWaitingPlayer(
  me: Identity | null,
  request: MatchRequest,
  stats: ProfileStats,
): Promise<Pairing | null> {
  if (!serviceOn || !me) return { kind: 'bot', reason: 'no-service' };
  let answer = await searchMatch(me, request);
  if (answer.kind === 'no-profile') {
    await pushProfile(me, stats);
    answer = await searchMatch(me, request);
  }
  if (answer.kind === 'off') serviceOn = false;
  return asPairing(answer);
}

/**
 * The deadline has passed: leave the queue, and take whatever the server
 * says happened. A pairing made in the last moment is a person in a room
 * waiting for us, so that is joined; anything else is a rival.
 */
export async function withdrawFromSearch(me: Identity | null): Promise<Pairing> {
  if (!me) return { kind: 'bot', reason: 'nobody-found' };
  const pairing = asPairing(await leaveMatch(me));
  return pairing?.kind === 'player' ? pairing : { kind: 'bot', reason: 'nobody-found' };
}

/**
 * The player cancelled. Leave the queue, and if the server had already
 * paired us, leave that room too, so the other phone is told at once
 * and gets its rival instead of waiting for somebody who has gone.
 */
export async function cancelSearch(me: Identity | null): Promise<void> {
  if (!me) return;
  const answer = await leaveMatch(me);
  if (answer.kind === 'matched') await leaveMatchBattle(me, answer.battle.id);
}

/** Walk out of a matched room nobody is going to play in. */
export async function leaveMatchBattle(me: Identity | null, battleId: string): Promise<void> {
  if (!me) return;
  await pulseBattle(me, battleId, [], { leave: true });
}
