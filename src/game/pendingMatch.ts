import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ModeId } from './modes';
import type { AiDifficultyId } from './ai';
import type { Identity } from './playerIdentity';
import { pulseBattle, type BattlePulse } from './battlesApi';
import { friendlyVerdict } from './battleTimer';
import { applyMatchResult, type MatchResult } from './progress';

/**
 * AN ONLINE BATTLE LEFT BY CLOSING THE APP STILL COUNTS AS A LOSS.
 *
 * Marc, 4 Nov 2026: "if i forfeit an online match, do I lose trophies?
 * If i don't then make sure I do". Leaving from the battle menu is the
 * ordinary loss (finishRound). Killing the app mid-battle used to skip
 * that, so the battle is written down here the moment it starts, and
 * crossed off when it settles normally. A record still here at the next
 * launch is a battle walked out of.
 *
 * Stored in AsyncStorage beside the loadout, under its own key. Written
 * at the countdown, never in the waiting room, so a phone that closed
 * before the battle began is not charged for a battle nobody played.
 */

const STORAGE_KEY = 'dice-battles:pending-match';

export interface PendingMatch {
  battleId: string;
  mode: ModeId;
  difficulty: AiDifficultyId;
}

/** The battle has started: write it down. Never throws. */
export function rememberMatch(match: PendingMatch): void {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(match)).catch(() => {});
}

/** The battle settled normally: cross it off. Never throws. */
export function forgetMatch(): void {
  AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
}

async function loadPendingMatch(): Promise<PendingMatch | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingMatch>;
    if (typeof parsed.battleId !== 'string' || !parsed.mode || !parsed.difficulty) return null;
    return { battleId: parsed.battleId, mode: parsed.mode, difficulty: parsed.difficulty };
  } catch {
    return null;
  }
}

/**
 * Was the battle left behind a loss? Only the server saying this player
 * WON it, or that it was a TIE, says otherwise (the other side left
 * first, or the clock ran out with this player ahead). No answer at all
 * — the row swept away, or no connection — is a loss, because this
 * phone knows it walked out mid-battle.
 */
export function forfeitIsLoss(pulse: BattlePulse | null, myId: string): boolean {
  if (!pulse || !pulse.over || !pulse.winner) return true;
  return friendlyVerdict(pulse.winner, myId) === 'lost';
}

/**
 * At launch: settle a battle walked out of, once. Tells the server this
 * phone has left (so the other player is given the win if the battle is
 * somehow still on), reads the verdict, and applies the ordinary loss —
 * trophies only, no coins. Null when there was nothing to settle or it
 * was not a loss.
 */
export async function settleUnfinishedMatch(me: Identity): Promise<MatchResult | null> {
  const pending = await loadPendingMatch();
  if (!pending) return null;
  // Crossed off first, so a crash below can never charge it twice.
  await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  const pulse = await pulseBattle(me, pending.battleId, [], { leave: true });
  if (!forfeitIsLoss(pulse, me.playerId)) return null;
  return applyMatchResult(false, pending.difficulty, pending.mode);
}

/** The callout at launch when it was. */
export const FORFEIT_LINE = 'Your last online battle counted as a loss';
