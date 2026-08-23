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
}

/** Deterministic wobble. No Math.random — the arena must be identical every build. */
function jitter(n: number): number {
  return (((Math.sin(n * 12.9898) * 43758.5453) % 1) + 1) % 1;
}

/**
 * Where every log stands.
 *
 * Heights run from a little under the wall to a good way over it. An even
 * row would be a fence; the point is a ragged top edge that could not be
 * mistaken for masonry.
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
    const height = wallHeight * (0.86 + j * 0.5);
    const lean = (j2 - 0.5) * 0.16;
    list.push({
      position: [x, height / 2, z],
      height,
      radius: 0.15 + j2 * 0.06,
      rotation: alongX ? [0, j * 0.6, lean] : [lean, j * 0.6, 0],
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
