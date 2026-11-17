import type { ModeId } from './modes';
import {
  MATCH_JOIN_WAIT_MS,
  isSearchOver,
  whyNoSearch,
  type Pairing,
} from './matchSearch';

/**
 * THE ORDER OF A SEARCH, as a pure state machine with no React and no
 * network, so every path through it can be tested. Marc, 4 Nov 2026:
 * "it should search for a player for 15 seconds ... and if it can't find
 * a real person to verse after 15 seconds then it loads you against one
 * of the bots".
 *
 * - `asking`: the first question is out. The search is SHOWN from here,
 *   the first frame: Marc, 5 Nov 2026, "it still starts off with
 *   finding an opponent against the AI and then goes to finding an
 *   opponent against a real player, it should only be against a real
 *   player until after 15 seconds". This state used to show the
 *   computer rivals' reveal until the server's first answer, so a
 *   player saw bot names cycling and then the real search. If the
 *   server answers `off` the reveal follows, which is rare and honest.
 * - `searching`: the server has said it is looking. The countdown runs.
 * - `withdrawing`: the fifteen seconds are up, and the phone has asked
 *   to leave the queue. The server may have paired us a moment earlier,
 *   so its answer decides: a person is joined, otherwise a rival. That
 *   is what stops a pairing at 14.9 s leaving somebody alone in a room.
 * - `matched`, `bot`, `cancelled`: settled. Nothing moves them again.
 *
 * Each step hands back the state and what the screen must DO about it,
 * so the leaving is written here rather than remembered in a component.
 */

type PlayerPairing = Extract<Pairing, { kind: 'player' }>;
type BotReason = Extract<Pairing, { kind: 'bot' }>['reason'];

export type MatchFlowState =
  | { kind: 'asking' }
  | { kind: 'searching' }
  | { kind: 'withdrawing' }
  | { kind: 'matched'; pairing: PlayerPairing }
  | { kind: 'bot'; reason: BotReason }
  | { kind: 'cancelled' };

export type MatchFlowEvent =
  /** An answer to a search ask: a pairing, or null for "still looking". */
  | { type: 'answer'; pairing: Pairing | null }
  /** Time since the search began. */
  | { type: 'tick'; elapsedMs: number }
  /** The player pressed Cancel. */
  | { type: 'cancel' }
  /** What the server said to the leave sent at the deadline. */
  | { type: 'leaveAnswer'; pairing: Pairing };

export type MatchFlowEffect =
  /** Tell the queue we have gone (`leaveMatch`). */
  | { type: 'leave-queue' }
  /** Walk out of a room the server put us in that nobody will play. */
  | { type: 'leave-battle'; battleId: string };

export interface MatchFlowStep {
  state: MatchFlowState;
  effects: MatchFlowEffect[];
}

/**
 * Where a start begins. Below 100 trophies, in a mode that cannot be
 * played live (Skirmish, Color War), or with the service known to be
 * off, the bot is settled before the first frame — no wait. Color Rush
 * and Ultimate from 100 trophies search.
 */
export function startFlow(trophies: number, mode: ModeId, serviceOn: boolean): MatchFlowState {
  const why = whyNoSearch(trophies, mode);
  if (why) return { kind: 'bot', reason: why };
  if (!serviceOn) return { kind: 'bot', reason: 'no-service' };
  return { kind: 'asking' };
}

/** Is the search still going (so the overlay keeps asking and counting)? */
export function isLooking(state: MatchFlowState): boolean {
  return state.kind === 'asking' || state.kind === 'searching';
}

/**
 * Is the search for a real player on screen? From the first ask until
 * the deadline's answer: never a computer rival's name before then.
 */
export function showsSearch(state: MatchFlowState): boolean {
  return state.kind === 'asking' || state.kind === 'searching' || state.kind === 'withdrawing';
}

const settled = (state: MatchFlowState): MatchFlowStep => ({ state, effects: [] });

export function stepFlow(state: MatchFlowState, event: MatchFlowEvent): MatchFlowStep {
  const open = state.kind === 'asking' || state.kind === 'searching' || state.kind === 'withdrawing';

  if (event.type === 'cancel') {
    if (state.kind === 'matched') {
      return {
        state: { kind: 'cancelled' },
        effects: [{ type: 'leave-queue' }, { type: 'leave-battle', battleId: state.pairing.battle.id }],
      };
    }
    if (open) return { state: { kind: 'cancelled' }, effects: [{ type: 'leave-queue' }] };
    return settled(state);
  }

  if (event.type === 'tick') {
    if (isLooking(state) && isSearchOver(event.elapsedMs)) {
      return { state: { kind: 'withdrawing' }, effects: [{ type: 'leave-queue' }] };
    }
    return settled(state);
  }

  const pairing = event.pairing;
  if (!open) {
    /*
      Already settled, and a late answer says a room was made for us —
      a search ask that was in flight when Cancel was pressed, or when
      the leave answer had already given us a rival. Somebody is in that
      room; walk out of it so they are told straight away.
    */
    if (pairing?.kind === 'player' && !(state.kind === 'matched' && state.pairing.battle.id === pairing.battle.id)) {
      return { state, effects: [{ type: 'leave-battle', battleId: pairing.battle.id }] };
    }
    return settled(state);
  }

  if (event.type === 'leaveAnswer') {
    if (state.kind !== 'withdrawing') return settled(state);
    if (pairing?.kind === 'player') return settled({ kind: 'matched', pairing });
    return settled({ kind: 'bot', reason: 'nobody-found' });
  }

  // A search answer.
  if (pairing === null) {
    // "Still looking": the search is real now, so it is shown.
    return settled(state.kind === 'asking' ? { kind: 'searching' } : state);
  }
  if (pairing.kind === 'player') return settled({ kind: 'matched', pairing });
  // A bot answer to a search is the service saying it is not there.
  return settled({ kind: 'bot', reason: pairing.reason });
}

/** A matched opponent who has not arrived in this long is not coming. */
export function joinWaitOver(waitingSince: number, now: number = Date.now()): boolean {
  if (!Number.isFinite(waitingSince) || waitingSince <= 0) return false;
  return now - waitingSince >= MATCH_JOIN_WAIT_MS;
}
