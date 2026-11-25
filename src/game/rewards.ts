/**
 * How much a battle pays out.
 *
 * Rewards are RANGES, not fixed numbers: two easy wins in a row should not
 * pay exactly the same, or the number stops being worth reading. The range
 * widens with difficulty, so a hard win is both bigger and more variable.
 *
 * Pure and injectable — pass an `rng` to make a payout deterministic in a
 * test. Nothing here touches storage or the dice.
 */

export interface RewardRange {
  min: number;
  max: number;
}

/**
 * A whole number somewhere in the range, both ends included.
 *
 * The clamp on `rng()` matters: a generator that can return exactly 1.0
 * would otherwise pay one coin over `max`.
 */
export function rollReward(
  range: RewardRange,
  rng: () => number = Math.random,
): number {
  const lo = Math.min(range.min, range.max);
  const hi = Math.max(range.min, range.max);
  const r = Math.min(0.999999999, Math.max(0, rng()));
  return lo + Math.floor(r * (hi - lo + 1));
}

/** The midpoint, for comparing two ranges without rolling either. */
export function averageOf(range: RewardRange): number {
  return (range.min + range.max) / 2;
}

/** "10–20", for showing a band in the UI. */
export function rangeLabel(range: RewardRange): string {
  const lo = Math.min(range.min, range.max);
  const hi = Math.max(range.min, range.max);
  return lo === hi ? `${lo}` : `${lo}\u2013${hi}`;
}
