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
 * service" means the server SAID there is nothing to look at — the
 * migration not applied — and pretending to ask it for fifteen seconds
 * would be theatre in front of children who would believe it. So an
 * `off` answer settles a rival at once, and is remembered for
 * `SERVICE_OFF_REMEMBER_MS` so the next start in that minute does not
 * ask either.
 *
 * NOT FOR THE SESSION, AND NOT FOR A FAILURE. Marc, 5 Nov 2026: "When I
 * have admin on and I try to load into a game it first says it's
 * matching me against a bot, but it shouldn't." The first `off` used to
 * latch the switch off until the app restarted, and every failed request
 * — no connection, a 401 while the profile was being pushed, a server
 * error, a page instead of JSON — was read as `off`. One blip, and no
 * search ran again that session. A failed request is now an unanswered
 * question: the search goes on and the deadline settles it, the same as
 * a queue with nobody in it. An identity that has not loaded yet is the
 * same: the overlay waits for it rather than deciding a bot.
 *
 * Never throws and never blocks: the same rule as `ads.ts` and
 * `friendsApi.ts`. A search that hangs is worse than one that fails,
 * because the player is staring at it.
 */
import type { Identity } from './playerIdentity';
import { SERVICE_OFF_REMEMBER_MS, type Pairing } from './matchSearch';
import { leaveMatch, pulseBattle, searchMatch, type MatchAnswer, type MatchRequest } from './battlesApi';
import { pushProfile } from './friendsApi';

export type { MatchRequest } from './battlesApi';

/** What `pushProfile` publishes, built the way the Friends screen builds it. */
export type ProfileStats = Parameters<typeof pushProfile>[1];

/** Until when the server's last `off` is believed; 0 when it never said so. */
let offUntil = 0;

/** False while the server's last `off` is still remembered. */
export function hasMatchmakingService(now: number = Date.now()): boolean {
  return now >= offUntil;
}

/** Tests only: a fresh session. */
export function resetMatchmakingForTest(): void {
  offUntil = 0;
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
  if (answer.kind === 'off') return { kind: 'bot', reason: 'no-service' };
  // Still searching, a failed ask, a profile still unknown, or a `left`
  // this build did not ask for: keep waiting.
  return null;
}

/**
 * Ask once whether somebody is waiting. Null means "not yet, keep
 * waiting" — the deadline in matchSearch.ts ends the wait, not this.
 *
 * No identity yet (loadIdentity is asynchronous, and the overlay can
 * open first) is a null too: the next ask reads it once it has loaded.
 * A server that does not know this phone (`no-profile`) is sent the
 * profile once and asked again once; the queue needs a profile row.
 */
export async function findWaitingPlayer(
  me: Identity | null,
  request: MatchRequest,
  stats: ProfileStats,
): Promise<Pairing | null> {
  if (!hasMatchmakingService()) return { kind: 'bot', reason: 'no-service' };
  if (!me) return null;
  let answer = await searchMatch(me, request);
  if (answer.kind === 'no-profile') {
    await pushProfile(me, stats);
    answer = await searchMatch(me, request);
  }
  if (answer.kind === 'off') offUntil = Date.now() + SERVICE_OFF_REMEMBER_MS;
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
