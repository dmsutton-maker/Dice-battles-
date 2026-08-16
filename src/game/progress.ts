import AsyncStorage from '@react-native-async-storage/async-storage';
import { AiDifficultyId } from './ai';

/**
 * Trophy progression, Clash Royale style: win trophies on victory, lose
 * some on defeat (never below zero), and crossing thresholds unlocks new
 * content. Persisted on device — no accounts.
 */
export interface Progress {
  trophies: number;
  /** Lifetime wins per difficulty — the per-difficulty medal counters. */
  wins: Record<AiDifficultyId, number>;
  /**
   * Family tester mode: every unlock available regardless of trophies, so
   * playtesters can try all arenas/modes immediately. Toggled by the secret
   * code in Settings; trophies still count normally underneath.
   */
  unlockAll?: boolean;
}

/**
 * Higher difficulties risk and reward MUCH more — Hard pays nearly 5x Easy,
 * so climbing the ladder fast means daring the moat.
 */
export const TROPHY_STAKES: Record<AiDifficultyId, { win: number; loss: number }> = {
  easy: { win: 15, loss: 10 },
  medium: { win: 35, loss: 15 },
  hard: { win: 70, loss: 25 },
};

export type UnlockId =
  | 'castle'
  | 'golden-dice'
  | 'sunset-castle'
  | 'mint-dice'
  | 'jungle'
  | 'bubblegum-dice'
  | 'treasure'
  | 'space'
  | 'midnight-dice';

export interface Tier {
  at: number;
  name: string;
  emoji: string;
  id: UnlockId;
  /**
   * Shown as "❓ Mystery Arena" everywhere until unlocked — the surprise is
   * the reward. Only trophies persist, so renaming ids is safe.
   */
  mystery?: boolean;
}

/** The unlock ladder. */
/**
 * The unlock ladder, alternating battlefields and dice so there is always
 * something close to earn. Everything cosmetic lands in the Inventory.
 */
export const TIERS: Tier[] = [
  { at: 0, name: 'Castle Courtyard', emoji: '🏰', id: 'castle' },
  { at: 100, name: 'Gold Dice', emoji: '✨', id: 'golden-dice' },
  { at: 250, name: 'Sunset Castle', emoji: '🌅', id: 'sunset-castle' },
  { at: 325, name: 'Mint Dice', emoji: '🍃', id: 'mint-dice' },
  { at: 400, name: 'Jungle Clearing', emoji: '🌴', id: 'jungle' },
  { at: 475, name: 'Bubblegum Dice', emoji: '🍬', id: 'bubblegum-dice' },
  { at: 550, name: 'Courtyard Treasure', emoji: '💰', id: 'treasure' },
  { at: 700, name: 'Space Station', emoji: '🚀', id: 'space', mystery: true },
  { at: 850, name: 'Midnight Dice', emoji: '🌑', id: 'midnight-dice' },
];

/** Picker/teaser label — mystery tiers stay hidden until earned. */
export function tierLabel(tier: Tier, trophies: number): { name: string; emoji: string } {
  if (tier.mystery && trophies < tier.at && !current.unlockAll) {
    return { name: 'Mystery Arena', emoji: '❓' };
  }
  return { name: tier.name, emoji: tier.emoji };
}

/**
 * The secret family code, entered in Settings. Unlocks everything for
 * playtesting ("LOCK" turns tester mode back off to test real progression).
 */
export const TESTER_CODE = 'FAMILY';
export const TESTER_LOCK_CODE = 'LOCK';

export function setUnlockAll(on: boolean): Progress {
  current = { ...current, unlockAll: on };
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current)).catch(() => {});
  return current;
}

export function hasUnlockAll(): boolean {
  return !!current.unlockAll;
}

const STORAGE_KEY = 'dice-battles:progress';

const EMPTY_WINS: Record<AiDifficultyId, number> = { easy: 0, medium: 0, hard: 0 };

let current: Progress = { trophies: 0, wins: { ...EMPTY_WINS } };

export function getProgress(): Progress {
  return current;
}

export async function loadProgress(): Promise<Progress> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      current = {
        ...current,
        ...parsed,
        wins: { ...EMPTY_WINS, ...(parsed.wins ?? {}) },
      };
    }
  } catch {
    // Defaults are fine if storage is unavailable.
  }
  return current;
}

export function isUnlocked(id: UnlockId, trophies: number): boolean {
  if (current.unlockAll) return true;
  const tier = TIERS.find((t) => t.id === id);
  return tier !== undefined && trophies >= tier.at;
}

/** The next tier still above this trophy count, if any. */
export function nextTier(trophies: number): Tier | null {
  return TIERS.find((t) => t.at > trophies) ?? null;
}

export interface MatchResult {
  trophies: number;
  delta: number;
  newUnlocks: Tier[];
}

/** Apply a win/loss, persist, and report any freshly crossed unlocks. */
export function applyMatchResult(
  won: boolean,
  difficulty: AiDifficultyId,
): MatchResult {
  const stakes = TROPHY_STAKES[difficulty];
  const before = current.trophies;
  const delta = won ? stakes.win : -stakes.loss;
  const after = Math.max(0, before + delta);
  const wins = won
    ? { ...current.wins, [difficulty]: current.wins[difficulty] + 1 }
    : current.wins;
  current = { ...current, trophies: after, wins };
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current)).catch(() => {});
  const newUnlocks = won
    ? TIERS.filter((t) => t.at > before && t.at <= after)
    : [];
  return { trophies: after, delta: after - before, newUnlocks };
}
