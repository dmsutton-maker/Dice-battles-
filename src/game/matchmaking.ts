/**
 * The beat between pressing Start and the countdown, where the game shows
 * you who you are about to play.
 *
 * The names flashing past are the real roster (src/game/ai.ts), and the one
 * it lands on is the rival you actually face — the screen is a reveal, not
 * a decoration over a fixed outcome.
 *
 * It does NOT contact a network or look for other people. The reveal is
 * only ever of a computer rival, so the copy says "finding your opponent"
 * and never that a person was found. The search for a real person (Marc,
 * 4 Nov 2026) comes before it and is separate: matchSearch.ts and
 * matchFlow.ts, with its own "Searching for an opponent…" wording, and
 * this reveal only plays when that search ends in a rival.
 *
 * Timing lives here rather than in the component so the sequence can be
 * tested without a renderer.
 */

export type MatchStage = 'scanning' | 'found';

/** How long names flash past before the rival is revealed. */
export const SCAN_MS = 1400;

/** How long the revealed rival is held before the countdown starts. */
export const REVEAL_MS = 800;

/** The whole beat, Start to countdown — David asked for "a couple seconds". */
export const MATCH_TOTAL_MS = SCAN_MS + REVEAL_MS;

/** How fast the flashing names change while scanning. */
export const SCAN_TICK_MS = 110;

/** How fast the trailing "..." animates. */
export const DOT_TICK_MS = 320;

export function stageAt(elapsedMs: number): MatchStage {
  return elapsedMs < SCAN_MS ? 'scanning' : 'found';
}

/**
 * Which roster entry is showing at this moment of the scan. Cycles, so a
 * short roster still reads as a rapid shuffle rather than a fixed list.
 */
export function scanIndexAt(elapsedMs: number, count: number): number {
  if (count <= 0) return 0;
  const tick = Math.floor(Math.max(0, elapsedMs) / SCAN_TICK_MS);
  return tick % count;
}

/** One, two or three dots — the only motion while the scan runs. */
export function dotsAt(elapsedMs: number): string {
  const step = Math.floor(Math.max(0, elapsedMs) / DOT_TICK_MS) % 3;
  return '.'.repeat(step + 1);
}

export function isComplete(elapsedMs: number): boolean {
  return elapsedMs >= MATCH_TOTAL_MS;
}
