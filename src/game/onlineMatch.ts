/**
 * Is there a real person waiting for a game right now?
 *
 * THE SWITCH, in the same shape as `adSdk.ts` and `storeKit.ts`.
 *
 * CURRENT STATE: OFF, because there is nothing to switch on. This game
 * has no matchmaking server and no way for two phones to play a shared
 * round: the dice are simulated locally, the opponent's rolls come from
 * a timer, and nothing about that is synchronised with anybody. Until
 * that exists, the only truthful answer to "is anybody there?" is that
 * there is nowhere to ask.
 *
 * WHY IT RETURNS NO-SERVICE RATHER THAN NOBODY-FOUND. Those two are not
 * the same thing and the difference reaches the player. "Nobody found"
 * means the game looked and the lobby was empty, and it is fair to spend
 * fifteen seconds establishing that. "No service" means the question
 * cannot be asked at all, and spending fifteen seconds pretending to ask
 * it would be theatre — a made-up wait, ending in a made-up
 * disappointment, in front of children who would believe both.
 *
 * WHAT TURNING IT ON NEEDS, honestly, because it is not a one-line
 * change like the adverts were:
 *
 *   1. A queue somewhere that two players can both join and be paired
 *      out of — the Supabase project already holds profiles, so this is
 *      a table and an endpoint, not new infrastructure.
 *   2. A shared round: both phones agreeing on the arena, the roll
 *      order, and every die result, with an answer for what happens
 *      when one of them walks into a lift. This is the large part.
 *   3. A rethink of what the opponent's rolls ARE. Today they come from
 *      `ai.ts` on a timer; against a person they come over a network and
 *      can be late, or never arrive.
 *
 * Only the first is small. The rule that uses this — trophy floor,
 * fifteen-second deadline, bot fallback — is written and tested in
 * `matchSearch.ts` and does not change when this is switched on.
 */
import type { Pairing } from './matchSearch';

export function hasMatchmakingService(): boolean {
  // ONLINE PLAY OFF. See the note above: turning this on is a feature,
  // not a flag, and this line is the last thing that changes, not the
  // first.
  return false;
}

/**
 * Ask once whether somebody is waiting.
 *
 * Never throws and never blocks: the same rule as `ads.ts` and
 * `friendsApi.ts`. A search that hangs is worse than one that fails,
 * because the player is staring at it.
 */
export async function findWaitingPlayer(): Promise<Pairing | null> {
  if (!hasMatchmakingService()) return { kind: 'bot', reason: 'no-service' };
  // When a service exists, this is where it is asked. Returning null
  // means "not yet, keep waiting" — the deadline in matchSearch.ts is
  // what ends the wait, not this.
  return null;
}
