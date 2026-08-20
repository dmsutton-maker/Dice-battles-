import AsyncStorage from '@react-native-async-storage/async-storage';
import { AiDifficultyId } from './ai';
import { ModeId } from './modes';
import { RewardRange, rollReward } from './rewards';

/**
 * Trophy progression, Clash Royale style: win trophies on victory, lose
 * some on defeat (never below zero), and crossing thresholds unlocks new
 * content. Persisted on device — no accounts.
 */
export interface Progress {
  trophies: number;
  /** Lifetime wins per difficulty — the per-difficulty medal counters. */
  wins: Record<AiDifficultyId, number>;
  /** Lifetime wins per game mode, shown in Your Records. */
  modeWins: Record<ModeId, number>;
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
export const TROPHY_STAKES: Record<
  AiDifficultyId,
  { win: RewardRange; loss: RewardRange }
> = {
  // The smallest possible win must beat the biggest possible loss at every
  // difficulty, or an unlucky win followed by a lucky loss costs you rank
  // for playing well. Easy is gentlest on purpose — it is where a five-
  // year-old learns the game.
  easy: { win: { min: 10, max: 20 }, loss: { min: 3, max: 8 } },
  medium: { win: { min: 25, max: 45 }, loss: { min: 9, max: 18 } },
  hard: { win: { min: 55, max: 85 }, loss: { min: 20, max: 40 } },
};

export type UnlockId =
  | 'castle'
  | 'ivory-dice'
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
}

/** The unlock ladder. */
/**
 * The unlock ladder, alternating battlefields and dice so there is always
 * something close to earn. Everything cosmetic lands in the Inventory.
 */
export const TIERS: Tier[] = [
  // The two you start with, so the ladder shows where you began.
  { at: 0, name: 'Castle Courtyard', emoji: '🏰', id: 'castle' },
  { at: 0, name: 'Ivory Dice', emoji: '🎲', id: 'ivory-dice' },
  // Gaps widen the whole way up — 40, 60, 80, 110, 140, 180, 240, 300.
  // The first reward used to cost 100 trophies, several sessions before
  // anything at all happened.
  { at: 40, name: 'Gold Dice', emoji: '✨', id: 'golden-dice' },
  { at: 100, name: 'Sunset Castle', emoji: '🌅', id: 'sunset-castle' },
  { at: 180, name: 'Mint Dice', emoji: '🍃', id: 'mint-dice' },
  { at: 290, name: 'Jungle Clearing', emoji: '🌴', id: 'jungle' },
  { at: 430, name: 'Bubblegum Dice', emoji: '🍬', id: 'bubblegum-dice' },
  { at: 610, name: 'Courtyard Treasure', emoji: '💰', id: 'treasure' },
  { at: 850, name: 'Space Station', emoji: '🚀', id: 'space' },
  { at: 1150, name: 'Midnight Dice', emoji: '🌑', id: 'midnight-dice' },
];

/**
 * Picker/teaser label. Every tier shows its real name from the start —
 * seeing what Space Station IS is what makes 700 trophies worth chasing;
 * a "❓ Mystery Arena" card gave the player nothing to want.
 */
export function tierLabel(tier: Tier, _trophies: number): { name: string; emoji: string } {
  return { name: tier.name, emoji: tier.emoji };
}

/**
 * The secret family code, entered in Settings. Unlocks everything for
 * playtesting ("LOCK" turns tester mode back off to test real progression).
 */
export const TESTER_CODE = 'FAMILY';

/** Tops the wallet up, for testing the Store without grinding for coins. */
export const MONEY_CODE = 'MONEY';
export const MONEY_CODE_COINS = 10000;
export const TESTER_LOCK_CODE = 'LOCK';

/**
 * Empties the Store cupboard so the shelf can be walked through from
 * scratch. Coins are left alone — the point is to buy the things again,
 * not to be handed them.
 */
export const RESET_CODE = 'RESET';

/**
 * "500 TROPHY" — set the trophy count to exactly that number.
 *
 * Unlike the other codes this one carries a value, so it is parsed rather
 * than compared. It SETS rather than adds: the point is to stand at a
 * chosen rung of the ladder and look at what is unlocked there, which
 * means being able to go down as readily as up.
 *
 * The word may come either side of the number. A child typing a cheat code
 * should not have to remember which way round it goes, and "TROPHY 500"
 * cannot mean anything else.
 */
export const TROPHY_CODE_WORD = 'TROPHY';

/**
 * The ceiling. The top of the ladder is a few hundred, so anything past
 * this is a typo or somebody leaning on a key — and a count that wide
 * breaks the HUD layout it has to fit inside.
 */
export const TROPHY_CODE_MAX = 99_999;

export interface TrophyCode {
  /** What the trophy count will actually be set to, after clamping. */
  trophies: number;
  /** True when the typed number was above the ceiling and was reduced. */
  clamped: boolean;
}

/**
 * Read "500 TROPHY" (or "TROPHY 500"). Returns null when this is not a
 * trophy code at all, so the caller can fall through to the other codes.
 *
 * The input arrives already trimmed and upper-cased from Settings; doing
 * it again here keeps the function honest on its own.
 */
export function parseTrophyCode(raw: string): TrophyCode | null {
  const text = raw.trim().toUpperCase();
  const match =
    text.match(new RegExp(`^(\\d+)\\s*${TROPHY_CODE_WORD}$`)) ??
    text.match(new RegExp(`^${TROPHY_CODE_WORD}\\s*(\\d+)$`));
  if (!match) return null;

  const asked = Number(match[1]);
  // A number long enough to overflow is not a number anyone meant.
  if (!Number.isFinite(asked)) return null;
  return {
    trophies: Math.min(asked, TROPHY_CODE_MAX),
    clamped: asked > TROPHY_CODE_MAX,
  };
}

/**
 * Set the trophy count outright, and report which tiers that crosses.
 *
 * Wins are deliberately left alone: they are a record of what was actually
 * played, and a cheat code that rewrote history would make Your Records
 * lie. Going DOWN relocks things — that is the point, not a side effect —
 * and both activeArena and activeDieBody already fall back when the
 * equipped item is no longer unlocked.
 */
export function setTrophies(trophies: number): MatchResult {
  const before = current.trophies;
  const after = Math.max(0, Math.min(Math.floor(trophies), TROPHY_CODE_MAX));
  current = { ...current, trophies: after };
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current)).catch(() => {});
  return {
    trophies: after,
    delta: after - before,
    newUnlocks: TIERS.filter((t) => t.at > before && t.at <= after),
  };
}

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

const EMPTY_MODE_WINS: Record<ModeId, number> = {
  classic: 0,
  ultimate: 0,
  skirmish: 0,
  colorwar: 0,
};

let current: Progress = {
  trophies: 0,
  wins: { ...EMPTY_WINS },
  modeWins: { ...EMPTY_MODE_WINS },
};

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
        // Saves written before per-mode counting existed have no modeWins;
        // they start at zero rather than breaking the read.
        modeWins: { ...EMPTY_MODE_WINS, ...(parsed.modeWins ?? {}) },
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
  mode: ModeId,
  rng: () => number = Math.random,
): MatchResult {
  const stakes = TROPHY_STAKES[difficulty];
  const before = current.trophies;
  // Varies inside the band, like coins — two easy wins should not be worth
  // an identical number every time.
  const delta = won
    ? rollReward(stakes.win, rng)
    : -rollReward(stakes.loss, rng);
  const after = Math.max(0, before + delta);
  const wins = won
    ? { ...current.wins, [difficulty]: current.wins[difficulty] + 1 }
    : current.wins;
  const modeWins = won
    ? { ...current.modeWins, [mode]: current.modeWins[mode] + 1 }
    : current.modeWins;
  current = { ...current, trophies: after, wins, modeWins };
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current)).catch(() => {});
  const newUnlocks = won
    ? TIERS.filter((t) => t.at > before && t.at <= after)
    : [];
  return { trophies: after, delta: after - before, newUnlocks };
}
