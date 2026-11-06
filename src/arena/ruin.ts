import { TUNING } from '../game/tuning';
import { CORNER_TOWERS, WALL_SLOTS } from '../game/stations';
import { hash } from './paint';

/**
 * The Sunset Castle as a RUIN: the wall it is built from, stone by stone.
 *
 * A family bug report, 20 Aug 2026: "The sunset castle doesn't really look
 * any different from the regular. Castle needs to be more different." And
 * the board-redesign rule (docs/board-redesign.md): with the colour turned
 * off you can still tell which board it is. Lighting and paint had already
 * been tried — they are colour, and greyscale strips them off. What is left
 * is SHAPE, so the dusk castle is a different building: the day castle's
 * walls are smooth and topped with a perfectly regular row of merlons; this
 * one is laid from loose blocks, and the tops have fallen in. Gaps, stubs,
 * a course standing taller here and there, blocks lying where they fell.
 *
 * It lives out here, as data, for the same reason the jungle palisade does:
 * nothing in this project can look at a render during a test, so a shape
 * that cannot be measured is one that can quietly go wrong. The floor
 * painter also reads it — the long shadows on the cobbles are cast by the
 * wall that is actually standing there.
 *
 * Deterministic: hashed, never random.
 */

const { innerWidth, innerDepth, wallHeight, wallThickness } = TUNING.tray;
const halfW = innerWidth / 2;
const halfD = innerDepth / 2;

/** One course of stone. Five courses make the tray wall exactly. */
export const COURSE = wallHeight / 5;

/**
 * The lowest any stretch of wall falls to, in courses.
 *
 * Four courses is 1.12, comfortably above a resting die (0.9). Lower than
 * that and a die leaning on the invisible physics wall would visibly lean
 * on nothing.
 */
export const MIN_COURSES = 4;
/** The tallest stub left standing, in courses. */
export const MAX_COURSES = 7;

export type RuinSide = 'left' | 'right' | 'far' | 'near';

/** One block of the ruined wall. */
export interface RuinBlock {
  position: [number, number, number];
  size: [number, number, number];
  /** Small twist about Y — a block that settled, not one that was laid. */
  yaw: number;
  /** 0..1, how pale this stone is. */
  tone: number;
}

/** Where each run of wall is, and which way it runs. */
function runOf(side: RuinSide): { alongX: boolean; at: number; from: number; to: number } {
  switch (side) {
    case 'left':
      return { alongX: false, at: -(halfW + wallThickness / 2), from: -(halfD + wallThickness), to: halfD + wallThickness };
    case 'right':
      return { alongX: false, at: halfW + wallThickness / 2, from: -(halfD + wallThickness), to: halfD + wallThickness };
    case 'far':
      return { alongX: true, at: -(halfD + wallThickness / 2), from: -halfW, to: halfW };
    case 'near':
      return { alongX: true, at: halfD + wallThickness / 2, from: -halfW, to: halfW };
  }
}

const SIDE_SEED: Record<RuinSide, number> = { left: 3.1, right: 7.7, far: 11.3, near: 17.9 };

/** Breaches: narrow, and never in the same place on opposite walls. */
const BREACHES: Record<RuinSide, number[]> = {
  left: [-2.7, 1.9],
  right: [-0.9, 3.5],
  far: [],
  near: [-1.2, 1.5],
};

/** How far either side of centre the wall parade stands. */
const SLOT_SPAN = Math.max(...WALL_SLOTS.map((w) => Math.abs(w.x))) + 0.3;

/**
 * How many courses stand at `along` (world units along the run).
 *
 * A slow undulation, plus a few deliberate breaches where the wall has
 * come right down to MIN_COURSES. The far wall is the exception: captured
 * prisoners are paraded along its top (WALL_SLOTS), so the stretch under
 * them stays whole — a figure standing on a gap would be standing on air.
 */
export function coursesAt(side: RuinSide, along: number): number {
  const s = SIDE_SEED[side];
  const wave = Math.sin(along * 1.3 + s) * 0.9 + Math.sin(along * 2.9 + s * 2.1) * 0.6;
  let n = 5 + wave;
  for (const b of BREACHES[side]) {
    const d = Math.abs(along - b);
    if (d < 0.55) n = Math.min(n, MIN_COURSES + d * 1.2);
  }
  if (side === 'far') {
    if (Math.abs(along) <= SLOT_SPAN) n = Math.max(5, Math.min(n, 6));
  }
  // The long walls stand taller where they meet the corner towers — a
  // ruin keeps its corners longest, because that is where it is thickest.
  if (side === 'left' || side === 'right') {
    const toEnd = Math.min(Math.abs(along - (halfD + wallThickness)), Math.abs(along + halfD + wallThickness));
    if (toEnd < 1.2) n += (1.2 - toEnd) * 1.2;
  }
  return Math.max(MIN_COURSES, Math.min(MAX_COURSES, Math.round(n)));
}

/** Height of the standing wall at `along`, in world units. */
export function ruinHeightAt(side: RuinSide, along: number): number {
  return coursesAt(side, along) * COURSE;
}

/**
 * Every block of the four ruined walls.
 *
 * Laid in running bond, like the real thing: each course's joints fall
 * between the joints of the course below. A block is laid only if the
 * wall stands that high where it sits, and the top course of each stub is
 * missing a stone here and there.
 */
export function ruinBlocks(): RuinBlock[] {
  const out: RuinBlock[] = [];
  for (const side of ['left', 'far', 'right', 'near'] as RuinSide[]) {
    const run = runOf(side);
    const s = SIDE_SEED[side];
    for (let course = 0; course < MAX_COURSES; course++) {
      let along = run.from - (course % 2 ? 0.27 : 0);
      let k = 0;
      while (along < run.to - 0.02) {
        const h = hash(course * 13.1 + k * 3.7, s);
        const len = 0.42 + h * 0.3;
        const a0 = Math.max(along, run.from);
        const a1 = Math.min(along + len, run.to);
        along += len;
        k++;
        if (a1 - a0 < 0.12) continue;
        const mid = (a0 + a1) / 2;
        const standing = coursesAt(side, mid);
        if (course >= standing) continue;
        const top = course === standing - 1;
        // A gap in the topmost course: one stone in four has fallen.
        if (top && course >= MIN_COURSES && hash(k * 5.3, course + s) < 0.25) continue;
        const gap = 0.035;
        const length = a1 - a0 - gap;
        // Each block a touch proud of or behind its neighbours, so the
        // face catches the low sun stone by stone instead of as one sheet.
        const proud = (hash(k + 0.5, course * 7.1 + s) - 0.5) * 0.05;
        const thick = wallThickness - 0.02 + proud;
        const y = course * COURSE + COURSE / 2;
        const across = run.at + (side === 'left' || side === 'far' ? -proud / 2 : proud / 2);
        out.push({
          position: run.alongX ? [mid, y, across] : [across, y, mid],
          size: run.alongX ? [length, COURSE - 0.02, thick] : [thick, COURSE - 0.02, length],
          yaw: top ? (hash(k * 2.3, s + course) - 0.5) * 0.16 : (hash(k, course) - 0.5) * 0.03,
          tone: hash(k * 1.7 + course * 0.31, s * 0.7),
        });
      }
    }
  }
  return out;
}

/** One course of a ruined corner tower, as a ring of blocks. */
export interface StumpBlock {
  position: [number, number, number];
  /** Rotation about Y so the block faces outward. */
  yaw: number;
  tone: number;
}

/** Ring radius and block count of a tower stump. */
export const STUMP_RADIUS = 0.5;
const STUMP_RING = 11;

/**
 * The four corner towers, roofless and broken off.
 *
 * The day castle's towers end in red cones; these end in a jagged ring of
 * stone around a dark, empty inside — the most legible thing a ruin can
 * show a camera that looks DOWN on it. The far pair stand taller than the
 * near pair, which also keeps the near ones from looming over the bottom
 * of the screen.
 */
export function stumpBlocks(): StumpBlock[] {
  const out: StumpBlock[] = [];
  CORNER_TOWERS.forEach((t, ti) => {
    const far = t.z < 0;
    const base = far ? 8 : 6;
    for (let course = 0; course < base + 1; course++) {
      for (let i = 0; i < STUMP_RING; i++) {
        // The broken top: a ragged line falling away round the ring.
        const angle = (i / STUMP_RING) * Math.PI * 2 + (course % 2 ? Math.PI / STUMP_RING : 0);
        const ragged = base - 2 + Math.round((Math.sin(angle * 2 + ti * 1.9) * 0.5 + 0.5) * 2.6 + hash(i, ti + course) * 0.8);
        if (course >= ragged) continue;
        out.push({
          position: [t.x + Math.sin(angle) * STUMP_RADIUS, course * COURSE + COURSE / 2, t.z + Math.cos(angle) * STUMP_RADIUS],
          yaw: angle,
          tone: hash(i * 2.9 + ti, course * 1.3),
        });
      }
    }
  });
  return out;
}

/** Height of the tallest stone of a stump, for the fit and the tests. */
export function stumpTop(): number {
  let top = 0;
  for (const b of stumpBlocks()) top = Math.max(top, b.position[1] + COURSE / 2);
  return top;
}

/**
 * Stones that have fallen off the walls, lying in the grass OUTSIDE the
 * tray. Never inside: anything inside is somewhere a die can roll, and a
 * die rolling straight through a drawn stone is worse than no stone.
 */
export function fallenStones(): { position: [number, number, number]; size: number; yaw: number; tilt: number }[] {
  const out: { position: [number, number, number]; size: number; yaw: number; tilt: number }[] = [];
  const outerX = halfW + wallThickness;
  const outerZ = halfD + wallThickness;
  for (let i = 0; i < 14; i++) {
    const side = i % 2 ? 1 : -1;
    const z = -outerZ + 0.4 + hash(i, 4.1) * (outerZ * 2 - 0.8);
    // Kept to the side strips the camera can see, x 2.9 .. 3.6, and
    // half sunk in the turf so they lie rather than hover.
    const x = side * (outerX + 0.15 + hash(i, 9.3) * 0.55);
    const size = 0.18 + hash(i, 2.2) * 0.12;
    out.push({ position: [x, size * 0.3, z], size, yaw: hash(i, 7.7) * Math.PI, tilt: (hash(i, 1.3) - 0.5) * 0.3 });
  }
  return out;
}

/**
 * The black shapes of the rest of the castle, fallen towers standing
 * against the last of the light at the far corners of the frame — on the
 * two back prop spots (EXTRA_SPOTS 2 and 3), which the day castle gives to
 * a campfire and a crate. Shared with the ground painter, which lays a
 * dark footing under each.
 */
export const DUSK_SILHOUETTES: { x: number; z: number; r: number; h: number }[] = [
  { x: -3.95, z: -9.15, r: 0.6, h: 2.5 },
  { x: 3.95, z: -9.15, r: 0.68, h: 3.2 },
];

/**
 * Where the braziers stand: on the wall tops of the two long walls,
 * never on the far wall (the parade) and never in a breach.
 */
export function brazierSpots(): { side: 'left' | 'right'; along: number; position: [number, number, number] }[] {
  const spots: { side: 'left' | 'right'; along: number }[] = [
    { side: 'left', along: -0.6 },
    { side: 'left', along: 3.3 },
    { side: 'right', along: -2.6 },
    { side: 'right', along: 1.6 },
  ];
  return spots.map(({ side, along }) => {
    const x = (side === 'left' ? -1 : 1) * (halfW + wallThickness / 2);
    return { side, along, position: [x, ruinHeightAt(side, along), along] as [number, number, number] };
  });
}
