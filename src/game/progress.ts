import AsyncStorage from '@react-native-async-storage/async-storage';
import { AiDifficultyId } from './ai';

/**
 * Trophy progression, Clash Royale style: win trophies on victory, lose
 * some on defeat (never below zero), and crossing thresholds unlocks new
 * content. Persisted on device — no accounts.
 */
export interface Progress {
  trophies: number;
}

/** Higher difficulties risk and reward more. */
export const TROPHY_STAKES: Record<AiDifficultyId, { win: number; loss: number }> = {
  easy: { win: 20, loss: 10 },
  medium: { win: 30, loss: 15 },
  hard: { win: 45, loss: 20 },
};

export type UnlockId =
  | 'castle'
  | 'golden-dice'
  | 'sunset-castle'
  | 'treasure'
  | 'mystery';

export interface Tier {
  at: number;
  name: string;
  emoji: string;
  id: UnlockId;
}

/**
 * The unlock ladder. 'mystery' is a teaser for future content (new arenas,
 * obstacles, treasures) — it announces but unlocks nothing yet.
 */
export const TIERS: Tier[] = [
  { at: 0, name: 'Castle Courtyard', emoji: '🏰', id: 'castle' },
  { at: 100, name: 'Golden Dice', emoji: '✨', id: 'golden-dice' },
  { at: 250, name: 'Sunset Castle', emoji: '🌅', id: 'sunset-castle' },
  { at: 450, name: 'Courtyard Treasure', emoji: '💰', id: 'treasure' },
  { at: 700, name: 'Mystery Arena', emoji: '❓', id: 'mystery' },
];

const STORAGE_KEY = 'dice-battles:progress';

let current: Progress = { trophies: 0 };

export function getProgress(): Progress {
  return current;
}

export async function loadProgress(): Promise<Progress> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) current = { ...current, ...JSON.parse(raw) };
  } catch {
    // Defaults are fine if storage is unavailable.
  }
  return current;
}

export function isUnlocked(id: UnlockId, trophies: number): boolean {
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
  current = { ...current, trophies: after };
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current)).catch(() => {});
  const newUnlocks = won
    ? TIERS.filter((t) => t.at > before && t.at <= after)
    : [];
  return { trophies: after, delta: after - before, newUnlocks };
}
