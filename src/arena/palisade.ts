import { TUNING } from '../game/tuning';

/**
 * The jungle's boundary, as data.
 *
 * Every battlefield used to be four full-height box walls with a different
 * ornament on top, so all three read as the castle in another colour. The
 * jungle's edge is now a run of logs driven into a low earth bank —
 * different heights, different leans, cut to points — because a skyline is
 * what you recognise a place by.
 *
 * It lives out here rather than inside the component so the shape can be
 * MEASURED. Nothing in this project can render a 3D scene to look at it,
 * which is exactly how a palisade could quietly become an even picket
 * fence, or collapse back to a wall, with every test still green.
 */

export interface PalisadeLog {
  position: [number, number, number];
  height: number;
  radius: number;
  /** Euler rotation: a slight lean, and a spin so the facets differ. */
  rotation: [number, number, number];
  /** 0..1, how light this log's timber is. Smooth between neighbours. */
  tone: number;
}

/** Deterministic wobble. No Math.random — the arena must be identical every build. */
function jitter(n: number): number {
  return (((Math.sin(n * 12.9898) * 43758.5453) % 1) + 1) % 1;
}

/**
 * Where every log stands.
 *
 * The first version was too wild in every direction at once, and it looked
 * it: heights from 0.86 to 1.36 of the wall, leans of five degrees each
 * way chosen independently so neighbours fell against each other, and gaps
 * between the posts because the spacing was wider than the logs. Painted
 * grey-green stone rather than timber on top of that, it read as a heap of
 * sticks — David's word for the arena was garbage dump.
 *
 * A stockade is a SOLID wall of timber with a ragged top. So: the logs
 * overlap rather than leaving daylight between them, every one stands at
 * least as tall as the invisible wall the dice bounce off (a post shorter
 * than the wall makes a die look like it hit thin air), the top edge still
 * varies but by a quarter rather than by half, and the lean is a slow wave
 * along the run so the whole rank leans together the way driven posts do.
 */
export function palisadeLogs(): PalisadeLog[] {
  const { innerWidth, innerDepth, wallHeight, wallThickness } = TUNING.tray;
  const halfW = innerWidth / 2;
  const halfD = innerDepth / 2;
  const list: PalisadeLog[] = [];
  let k = 0;

  const place = (x: number, z: number, alongX: boolean) => {
    const j = jitter(k * 3.7 + 1);
    const j2 = jitter(k * 7.1 + 5);
    // Never below the wall the dice actually stop against.
    const height = wallHeight * (1.02 + j * 0.26);
    // A slow wave along the run, with only a whisper of per-log jitter, so
    // the rank leans together instead of every post picking its own angle.
    const lean = Math.sin(k * 0.5) * 0.03 + (j2 - 0.5) * 0.02;
    list.push({
      position: [x, height / 2, z],
      height,
      // Wider than half the spacing, so neighbouring logs overlap and the
      // palisade is a wall rather than a picket fence with gaps in it.
      radius: 0.2 + j2 * 0.045,
      rotation: alongX ? [0, j * 0.6, lean] : [lean, j * 0.6, 0],
      // Smoothly varying timber, not a hard switch every third log — that
      // switch put a repeating stripe of dark posts around the arena.
      tone: 0.5 + Math.sin(k * 0.9) * 0.32 + (j - 0.5) * 0.2,
    });
    k++;
  };

  for (let x = -halfW - wallThickness + 0.18; x <= halfW + wallThickness - 0.1; x += 0.34) {
    place(x, -(halfD + wallThickness / 2), true);
    place(x, halfD + wallThickness / 2, true);
  }
  for (let z = -halfD - wallThickness + 0.2; z <= halfD + wallThickness - 0.1; z += 0.36) {
    place(-(halfW + wallThickness / 2), z, false);
    place(halfW + wallThickness / 2, z, false);
  }
  return list;
}
