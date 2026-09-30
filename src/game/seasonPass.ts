import type { AiDifficultyId } from './ai';
import type { PrizeItem, TournamentPrize } from './tournament';

/**
 * The season pass: experience from every battle, thirty levels, and
 * something at every one of them.
 *
 * David, 30 Sep 2026: "Add a season pass with levels and exp you earn are
 * counted towards the season pass. Make the rewards be small amounts of
 * coins or trophies that slowly increase in amounts the higher level you
 * go. Make this season pass have the fire and ice dice as the way to
 * obtain them and also make the volcano rim and snowy hollow arenas
 * unlocked through the season pass only."
 *
 * FREE. There is a PAID season pass parked in products.ts, and this is
 * not it: buying anything needs StoreKit, which is native code and a new
 * build (AGENTS.md), and nobody asked for this to cost money. Every level
 * is earned by playing.
 *
 * THE RULES ONLY. What a level pays and how much experience a battle is
 * worth are decided here, where the tests can read them without a
 * renderer; handing the reward over is `payPrize` in prizes.ts, the same
 * route a cup prize takes, so the two cannot disagree about what
 * "already own it" means.
 */

export const SEASON = {
  id: 'season-1',
  number: 1,
  name: 'Fire & Ice',
} as const;

/** How many levels there are. */
export const LEVELS = 30;

/**
 * Experience for one finished battle against the computer.
 *
 * Everybody gets some — losing still moves the bar, because a pass that
 * only fills for winners is a pass a five-year-old never sees move. A win
 * is worth a good deal more, and Hard is worth more than Easy, so the
 * same hour of play fills the bar faster for somebody playing well and
 * bravely. A tie sits between the two.
 *
 * Friendly battles against a friend earn nothing, exactly as they earn
 * no coins and no trophies (see finishRound): otherwise two brothers
 * could fill each other's pass by playing to a draw.
 */
export const BATTLE_XP: Record<AiDifficultyId, { won: number; tie: number; lost: number }> = {
  easy: { won: 40, tie: 25, lost: 15 },
  medium: { won: 60, tie: 35, lost: 20 },
  hard: { won: 90, tie: 50, lost: 30 },
};

export function battleXp(outcome: 'won' | 'lost' | 'tie', difficulty: AiDifficultyId): number {
  return BATTLE_XP[difficulty][outcome];
}

/**
 * Experience needed to go from level `n - 1` to level `n`.
 *
 * It rises slowly, so the early levels come quickly and the last ones are
 * a season's worth of play: level 1 is two or three battles, level 30 a
 * dozen. The whole pass is about 10,000 experience — around 170 Medium
 * wins, or a good deal fewer on Hard.
 */
export function xpForLevel(n: number): number {
  return 120 + 15 * (n - 1);
}

/** Total experience needed to have reached level `n` (level 0 is zero). */
export function xpToReach(n: number): number {
  let total = 0;
  for (let k = 1; k <= Math.min(n, LEVELS); k++) total += xpForLevel(k);
  return total;
}

/** The level this much experience has reached. */
export function levelFor(xp: number): number {
  let level = 0;
  while (level < LEVELS && xp >= xpToReach(level + 1)) level++;
  return level;
}

/** Where a player is between two levels, for the bar on screen. */
export function progressIn(xp: number): { level: number; into: number; need: number } {
  const level = levelFor(xp);
  if (level >= LEVELS) return { level, into: 0, need: 0 };
  return { level, into: xp - xpToReach(level), need: xpForLevel(level + 1) };
}

/**
 * The four things the pass is the ONLY way to get.
 *
 * Spaced so each one is a real milestone and the last one is the end of
 * the season: the Ice dice come first because they are what makes a
 * child want the pass, and Volcano Rim is the summit.
 */
export const SEASON_ITEMS: readonly { level: number; item: PrizeItem }[] = [
  { level: 6, item: { kind: 'dice', id: 'ice' } },
  { level: 12, item: { kind: 'arena', id: 'snow' } },
  { level: 20, item: { kind: 'dice', id: 'fire' } },
  { level: 30, item: { kind: 'arena', id: 'volcano' } },
];

/** The level a season item is won at, or null if it is not on the pass. */
export function seasonLevelOf(kind: 'dice' | 'arena', id: string): number | null {
  return SEASON_ITEMS.find((s) => s.item.kind === kind && s.item.id === id)?.level ?? null;
}

/**
 * What a season item is worth in coins, when the pass hands over one the
 * player already has.
 *
 * It can happen: the Fire and Ice dice were on sale for a day before the
 * pass existed, and anybody who climbed past Snowy Hollow or Volcano Rim
 * on the trophy ladder keeps them. Reaching that level must still pay
 * something, or the pass has a hole in it exactly where it should shine.
 */
export const SEASON_ITEM_WORTH = 1000;

export interface SeasonReward {
  coins: number;
  trophies: number;
  item?: PrizeItem;
}

/**
 * What a level pays.
 *
 * Small amounts that grow slowly, as asked: odd levels pay coins (20 at
 * level 1, rising by 5 a level to 160 at level 29), even levels pay
 * trophies (4 at level 2, rising by 1 every two levels to 18 at level
 * 30). A level with an item pays the item and nothing else — the item is
 * the reward.
 */
export function rewardFor(level: number): SeasonReward {
  const special = SEASON_ITEMS.find((s) => s.level === level);
  if (special) return { coins: 0, trophies: 0, item: special.item };
  if (level % 2 === 1) return { coins: 20 + 5 * (level - 1), trophies: 0 };
  return { coins: 0, trophies: 3 + level / 2 };
}

/** A level's reward in the shape `payPrize` takes. */
export function asPrize(reward: SeasonReward): TournamentPrize {
  return {
    coins: { min: reward.coins, max: reward.coins },
    trophies: reward.trophies,
    ...(reward.item ? { item: reward.item } : {}),
  };
}

/** Where one player stands in one season. */
export interface SeasonState {
  season: string;
  xp: number;
  /** The highest level already paid out. */
  paid: number;
}

export function freshSeason(): SeasonState {
  return { season: SEASON.id, xp: 0, paid: 0 };
}

/**
 * Add a battle's experience, and say which levels it reached.
 *
 * Levels are paid ONCE: `paid` remembers the highest one handed over, so
 * a save loaded twice, or a battle counted after a crash, cannot pay a
 * level again. A state from a different season starts fresh — the pass
 * is a season's, not a lifetime's.
 */
export function addXp(
  state: SeasonState | undefined,
  xp: number,
): { state: SeasonState; reached: number[] } {
  const base = state && state.season === SEASON.id ? state : freshSeason();
  const add = Number.isFinite(xp) ? Math.max(0, Math.floor(xp)) : 0;
  const next = { ...base, xp: base.xp + add };
  const level = levelFor(next.xp);
  const reached: number[] = [];
  for (let n = base.paid + 1; n <= level; n++) reached.push(n);
  next.paid = Math.max(base.paid, level);
  return { state: next, reached };
}
