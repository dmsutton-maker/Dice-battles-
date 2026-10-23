import { TUNING } from '../game/tuning';

/**
 * The jungle's boundary: a fence of BAMBOO poles lashed together, laid
 * HORIZONTALLY in a stack, with a stout upright pole at each corner.
 *
 * Horizontal, because of the camera. This was once eighty-eight logs
 * standing upright, and from a screenshot the reason that never looked
 * right is obvious: the camera looks DOWN at the arena, so an upright
 * post shows you its top and almost nothing else, and the boundary read
 * as a ring of sawn tree stumps. A pole on its side presents its LENGTH —
 * and on bamboo the length is where everything recognisable is: the
 * nodes ringing it every hand-span, the lashings binding the stack.
 *
 * Bamboo rather than the round logs it replaced (October 2026, the board
 * redesign — docs/board-redesign.md): thinner poles, more of them, so the
 * wall reads as a lashed fence of canes and not as a log cabin, which the
 * Autumn Woods' split-rail fence and the themed log cabins already are.
 *
 * It lives out here rather than inside the component so the shape can be
 * MEASURED. Nothing in this project can render a 3D scene in a test,
 * which is exactly how a boundary can quietly become a heap of sticks
 * with every test still green — as it did.
 */

/** One log lying along a run, or one upright corner post. */
export interface PalisadeLog {
  position: [number, number, number];
  /** How long the log is, along its own axis. */
  length: number;
  radius: number;
  /** Euler rotation. A rail is turned to lie along its run. */
  rotation: [number, number, number];
  /** 0..1, how light this log's timber is. */
  tone: number;
  /** Corner posts still stand upright, to tie the runs together. */
  upright: boolean;
}

/** Deterministic wobble. No Math.random — the arena must be identical every build. */
function jitter(n: number): number {
  return (((Math.sin(n * 12.9898) * 43758.5453) % 1) + 1) % 1;
}

/**
 * How many poles are stacked, and how thick each one is.
 *
 * Seven courses of 0.12 radius cover 1.52 of wall, against a tray wall of
 * 1.4 — so the cane always stands a little proud of the invisible surface
 * the dice actually bounce off. A boundary drawn shorter than that makes a
 * die look like it stopped against nothing.
 */
const COURSES = 7;
export const POLE_RADIUS = 0.12;
const LOG_RADIUS = POLE_RADIUS;

export function palisadeLogs(): PalisadeLog[] {
  const { innerWidth, innerDepth, wallHeight, wallThickness } = TUNING.tray;
  const halfW = innerWidth / 2;
  const halfD = innerDepth / 2;
  const list: PalisadeLog[] = [];

  const outerW = innerWidth + wallThickness * 2;
  const outerD = innerDepth + wallThickness * 2;
  // The rails run corner to corner, overlapping the corner posts so no
  // daylight shows where a run ends.
  const alongXLength = outerW + LOG_RADIUS * 2;
  const alongZLength = outerD + LOG_RADIUS * 2;

  let k = 0;
  for (let course = 0; course < COURSES; course++) {
    // Courses stack with a little squash, the way logs settle onto each
    // other rather than balancing exactly.
    const y = LOG_RADIUS + course * LOG_RADIUS * 1.78;
    for (const [side, alongX] of [
      [-(halfD + wallThickness / 2), true],
      [halfD + wallThickness / 2, true],
      [-(halfW + wallThickness / 2), false],
      [halfW + wallThickness / 2, false],
    ] as [number, boolean][]) {
      const j = jitter(k * 3.7 + 1);
      list.push({
        position: alongX ? [0, y, side] : [side, y, 0],
        length: alongX ? alongXLength : alongZLength,
        // Each log a slightly different thickness, so the stack is timber
        // rather than moulding.
        radius: LOG_RADIUS * (0.94 + j * 0.12),
        // A cylinder stands up the Y axis by default, so a rail is tipped
        // a quarter turn onto its side and then swung to face its run.
        rotation: alongX ? [0, 0, Math.PI / 2] : [Math.PI / 2, Math.PI / 2, 0],
        tone: 0.5 + Math.sin(course * 1.7 + (alongX ? 0 : 1.1)) * 0.34 + (j - 0.5) * 0.16,
        upright: false,
      });
      k++;
    }
  }

  // Corner posts. Stouter than the rails and standing a little above them,
  // which is what stops the four runs looking like they merely meet. Giant
  // bamboo: twice the rails' girth.
  const postHeight = wallHeight * 1.32;
  for (const x of [-(halfW + wallThickness / 2), halfW + wallThickness / 2]) {
    for (const z of [-(halfD + wallThickness / 2), halfD + wallThickness / 2]) {
      const j = jitter(k * 3.7 + 1);
      list.push({
        position: [x, postHeight / 2, z],
        length: postHeight,
        radius: LOG_RADIUS * 2.1,
        rotation: [0, j * 0.5, 0],
        tone: 0.35 + j * 0.2,
        upright: true,
      });
      k++;
    }
  }

  return list;
}

/** How high the timber stands, for the tests and for anything stacked on it. */
export function palisadeTopHeight(): number {
  return LOG_RADIUS + (COURSES - 1) * LOG_RADIUS * 1.78 + LOG_RADIUS;
}
