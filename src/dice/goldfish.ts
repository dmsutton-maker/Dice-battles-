/**
 * The goldfish on the Fish dice, drawn in one place for both of the ways
 * the die is shown.
 *
 * The still picture (the shop card, and patterns.ts's `fish` painter)
 * paints fish and water together. The die on the board paints them
 * apart, since 18 Oct 2026 — David: "On the fish dice, can you make the
 * fish look like they're swimming around on the dice?" — so the fish can
 * slide across the water (fishSwim.ts). Both read their shapes and
 * colours from here, so the fish on the card are the fish in the water.
 *
 * Coordinates are a 64-pixel tile, the size every die face is painted at.
 */

export type Rgb = [number, number, number];

const rgb = (hex: string): Rgb => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const FISH_WATER = rgb('#7fb8d9'); // must match the skin's body
const RIPPLE = rgb('#9ccce4');
export const FISH_BODY = rgb('#e8622a');
export const FISH_FIN = rgb('#c2481a'); // tail, dorsal fin — darker, so they separate
const BELLY = rgb('#f7c98f');
const EYE = rgb('#ffffff');
const PUPIL = rgb('#26343d');
export const BUBBLE = rgb('#eef7fc');

/** Where one fish swims: centre, direction (+1 nose toward +x), tilt. */
export type FishPlace = readonly [number, number, 1 | -1, number];

// Rows sit against the top and bottom edges: the sticker disc owns the
// centre of the face.
export const SCHOOL: readonly FishPlace[] = [
  [15, 8, 1, -0.1],
  [49, 9, 1, 0.08],
  [17, 56, -1, 0.1],
  [48, 55, -1, -0.07],
];

const BUBBLES: readonly (readonly [number, number, number])[] = [
  [57, 26, 1.8],
  [5, 36, 1.4],
  [59, 44, 1.1],
];

/** The water under the fish, given a 0..1 ripple from the caller's noise. */
export function waterAt(ripple: number): Rgb {
  // Faint ripple on the water, kept far quieter than the fish.
  const t = ripple * 0.45;
  return [
    Math.round(FISH_WATER[0] + (RIPPLE[0] - FISH_WATER[0]) * t),
    Math.round(FISH_WATER[1] + (RIPPLE[1] - FISH_WATER[1]) * t),
    Math.round(FISH_WATER[2] + (RIPPLE[2] - FISH_WATER[2]) * t),
  ];
}

/** A bubble's colour at (x, y), or null for none. */
export function bubbleAt(x: number, y: number): Rgb | null {
  for (const [bx, by, br] of BUBBLES) {
    if (Math.hypot(x - bx, y - by) < br) return BUBBLE;
  }
  return null;
}

/** A goldfish's colour at (x, y), or null for open water. */
export function goldfishAt(x: number, y: number, school: readonly FishPlace[] = SCHOOL): Rgb | null {
  for (const [cx, cy, dir, tilt] of school) {
    // Fish-local coordinates: +u toward the nose, +v toward the belly.
    const dx = (x - cx) * dir;
    const dy = y - cy;
    const u = dx * Math.cos(tilt) - dy * Math.sin(tilt);
    const v = dx * Math.sin(tilt) + dy * Math.cos(tilt);
    const half = 8; // half body length
    const t = u / half;
    if (Math.abs(t) < 1) {
      // Teardrop, not ellipse: the profile is fullest just behind
      // the head and tapers toward the rear, which with the forked
      // tail is the pair of shapes that actually says "fish".
      const h = 5.2 * Math.sqrt(1 - t * t) * (0.6 + 0.2 * (t + 1));
      if (Math.abs(v) <= h) {
        if (Math.hypot(u - 4.6, v + 1) < 1.7) {
          return Math.hypot(u - 5, v + 1) < 0.9 ? PUPIL : EYE;
        }
        return v > 1.1 ? BELLY : FISH_BODY;
      }
      // Dorsal fin: a small bump on the back over mid-body.
      if (v < 0 && -v <= h + Math.max(0, 2.8 - Math.abs(u - 1.2) * 1.1)) {
        return FISH_FIN;
      }
    }
    // Forked tail, separated from the body by a sliver of water.
    const s = -u - half - 1;
    if (s >= 0 && s <= 6) {
      const spread = 1.2 + s * 0.8;
      const notch = s > 2.4 ? (s - 2.4) * 0.95 : 0;
      if (Math.abs(v) <= spread && Math.abs(v) >= notch) return FISH_FIN;
    }
  }
  return null;
}
