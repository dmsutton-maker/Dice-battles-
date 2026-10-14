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
 * TWO ROWS. Everybody climbs the free row by playing. The Gold Pass
 * (13 Oct 2026, GOLD_PASS below) is bought in the Store for real money
 * and adds a second row on the same levels; its holder is paid both.
 * Nothing on either row changes how the dice land.
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

/** Which side of the pass a reward sits on. */
export type Track = 'free' | 'gold';

/**
 * The paid half of the pass: the Gold Pass.
 *
 * David, 13 Oct 2026: "Make a paid season pass bought with real money in
 * the shop. Make most of the good rewards only in the paid version and
 * the people who have the paid version have the paid and unpaid
 * rewards." So there are two rows of rewards on the same thirty levels:
 * everybody climbs the free row, and a Gold Pass holder is paid BOTH
 * rows at every level.
 *
 * One product per season, because a pass is bought for a season and a
 * product id is forever (see products.ts): season 2 will be
 * `season_pass_2`, and buying season 1's never unlocks season 2's.
 */
export const GOLD_PASS = {
  productId: `season_pass_${SEASON.number}`,
  /*
    Owning the pass IS the entitlement: purchases.ts remembers every
    one-off product by its own id. The product grants nothing else, so
    the fairness test in tests/purchases.test.ts has nothing new to
    trust — the Gold row only ever pays coins and cosmetics.
  */
  entitlement: `season_pass_${SEASON.number}`,
} as const;

/**
 * The four things the pass is the ONLY way to get.
 *
 * Three of the four are on the Gold row, as David asked: "most of the
 * good rewards only in the paid version". The Ice Dice stay on the free
 * row so that somebody who never pays still has something special to
 * climb towards, and it sits two-thirds of the way up so it is earned.
 */
export const SEASON_ITEMS: readonly { level: number; item: PrizeItem; track: Track }[] = [
  { level: 6, item: { kind: 'arena', id: 'snow' }, track: 'gold' },
  { level: 12, item: { kind: 'dice', id: 'fire' }, track: 'gold' },
  { level: 20, item: { kind: 'dice', id: 'ice' }, track: 'free' },
  { level: 30, item: { kind: 'arena', id: 'volcano' }, track: 'gold' },
];

/** Which row a season item is on, or null if it is not on the pass. */
export function seasonTrackOf(kind: 'dice' | 'arena', id: string): Track | null {
  return SEASON_ITEMS.find((s) => s.item.kind === kind && s.item.id === id)?.track ?? null;
}

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
 * What a level pays on the FREE row.
 *
 * Small amounts that grow slowly, as asked: odd levels pay coins (20 at
 * level 1, rising by 5 a level to 160 at level 29), even levels pay
 * trophies (4 at level 2, rising by 1 every two levels to 18 at level
 * 30). A level with an item pays the item and nothing else — the item is
 * the reward.
 */
export function rewardFor(level: number): SeasonReward {
  const special = SEASON_ITEMS.find((s) => s.level === level && s.track === 'free');
  if (special) return { coins: 0, trophies: 0, item: special.item };
  if (level % 2 === 1) return { coins: 20 + 5 * (level - 1), trophies: 0 };
  return { coins: 0, trophies: 3 + level / 2 };
}

/**
 * What a level pays on the GOLD row, on top of the free row.
 *
 * Coins at every level that has no item (20 at level 1, rising by 5 a
 * level), and the three Gold items. NEVER trophies: trophies are rank,
 * and rank on the ladder is something you win, not something money
 * buys. Coins only buy cosmetics, which is the line products.ts draws
 * for everything sold.
 *
 * About 2,500 coins over the whole season plus three things nobody else
 * can get — a tunable first guess, to be settled with the family.
 */
export function goldRewardFor(level: number): SeasonReward {
  const special = SEASON_ITEMS.find((s) => s.level === level && s.track === 'gold');
  if (special) return { coins: 0, trophies: 0, item: special.item };
  return { coins: 20 + 5 * (level - 1), trophies: 0 };
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
  /** The highest level already paid out on the free row. */
  paid: number;
  /**
   * The highest level already paid out on the Gold row. Absent on saves
   * from before the Gold Pass existed, which is the same as 0.
   */
  goldPaid?: number;
}

export function freshSeason(): SeasonState {
  return { season: SEASON.id, xp: 0, paid: 0, goldPaid: 0 };
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

/**
 * Pay the Gold row up to wherever the player has climbed.
 *
 * Called only for a Gold Pass holder: after every battle, the moment the
 * pass is bought, and at launch. Buying it at level 15 pays levels 1 to
 * 15 of the Gold row at once — the pass is for the season, not for the
 * levels still to come — and `goldPaid` makes sure no Gold level is ever
 * paid twice, the same promise `paid` makes for the free row.
 */
export function claimGold(state: SeasonState | undefined): { state: SeasonState; reached: number[] } {
  const base = state && state.season === SEASON.id ? state : freshSeason();
  const level = levelFor(base.xp);
  const already = base.goldPaid ?? 0;
  const reached: number[] = [];
  for (let n = already + 1; n <= level; n++) reached.push(n);
  return { state: { ...base, goldPaid: Math.max(already, level) }, reached };
}
