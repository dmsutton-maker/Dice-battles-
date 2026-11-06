import { TUNING } from '../game/tuning';

const { innerWidth, innerDepth, wallHeight, wallThickness } = TUNING.tray;

/** One spot along the top of the tray wall. */
export interface RimSpot {
  pos: [number, number, number];
  /** True when the wall this sits on runs left-to-right. */
  alongX: boolean;
}

/** How far apart the crest pieces sit, along the wall. */
export const RIM_PITCH = 0.62;

/**
 * The ring of crest spots that every themed arena decorates, IN THE ORDER
 * YOU WOULD WALK THEM.
 *
 * The order is the whole point, and it lives out here so it can be
 * measured — nothing in this project can render a 3D scene.
 *
 * Marc, 27 Aug 2026: "on frozen lights the nobs at the top of the wall
 * still don't go around the entire wall." They did not, and neither did
 * half the other crests. The list used to be built a WALL AT A TIME,
 * pushing a left-hand spot and a right-hand spot together, then a near
 * one and a far one — so every even index was a left-or-near spot and
 * every odd index a right-or-far one. Nearly every crest picks its
 * pieces with `i % 2` or `i % 4`: the polar station drew a rib on the
 * even ones, which meant one long wall carried nine ribs and the
 * opposite wall carried none. The positions were right. The order was
 * not, and the order is what the patterns are read through.
 *
 * So walk the ring instead: down the left wall, across the far one, back
 * up the right, home along the near. Consecutive entries are now
 * neighbours on the wall, `i % n` is a pattern that travels round the
 * arena, and the count comes to 48 — divisible by 2, 3 and 4, so a
 * repeating pattern closes up at the corner it started from instead of
 * showing a seam.
 *
 * The long walls own all four corners; the short walls fill in between
 * them, which is why they skip their first and last slot.
 */
export function buildRim(): RimSpot[] {
  const list: RimSpot[] = [];
  const y = wallHeight + 0.12;
  const endX = innerWidth / 2 + wallThickness / 2;
  const endZ = innerDepth / 2 + wallThickness / 2;

  const down = Math.max(2, Math.round((endZ * 2) / RIM_PITCH));
  const across = Math.max(2, Math.round((endX * 2) / RIM_PITCH));

  const atZ = (i: number) => -endZ + (i * endZ * 2) / down;
  const atX = (i: number) => -endX + (i * endX * 2) / across;

  // Left wall, near corner to far corner.
  for (let i = 0; i <= down; i++) list.push({ pos: [-endX, y, atZ(i)], alongX: false });
  // Far wall, left to right, between the corners the left wall just laid.
  for (let i = 1; i < across; i++) list.push({ pos: [atX(i), y, endZ], alongX: true });
  // Right wall, far corner back to near.
  for (let i = down; i >= 0; i--) list.push({ pos: [endX, y, atZ(i)], alongX: false });
  // Near wall, right back to left.
  for (let i = across - 1; i >= 1; i--) list.push({ pos: [atX(i), y, -endZ], alongX: true });

  return list;
}
