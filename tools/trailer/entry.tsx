import React, { useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useThree } from '@react-three/fiber';
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { ARENAS, ArenaId } from '../../src/arena/arenas';
import { LIVE, troughOf, WaterSurface } from '../../src/arena/water';
import { DieMesh } from '../../src/dice/DieMesh';
import { createDieEffect, DieEffect, DieEffectId, DieSample } from '../../src/dice/dieEffect';
import { createDieBody, topFaceAlignment, topFaceColor } from '../../src/dice/die';
import { allStill } from '../../src/dice/settle';
import { PRISONER_COLORS, PrisonerColorId } from '../../src/game/colors';
import { DICE_SKINS, skinById } from '../../src/game/diceSkins';
import { PrisonerUnit } from '../../src/game/modes';
import { MOAT } from '../../src/game/obstacles';
import { Prisoners } from '../../src/game/Prisoners';
import { TUNING } from '../../src/game/tuning';
import { createPhysicsWorld } from '../../src/physics/world';
import logo from '../../assets/logo/logo.png';

/**
 * The website trailer, and the App Store videos.
 *
 * David, 13 Oct 2026: "make a video to showcase the game on the website.
 * But make it with big action sequences. Not just game play."
 *
 * Every shot is the REAL game: the real battlefields, the real dice skins
 * painted by the real painters, the real cannon-es physics and the real
 * Fire and Ice effects. What is not the game is the direction — the
 * camera flies, time slows down on the big moments, and far more dice are
 * thrown than a round ever uses.
 *
 * Rendered one frame at a time (frameloop="never"), so the video is as
 * smooth as the frame rate asked for however slow the machine is. See
 * shoot.js, which drives it, and README.md.
 *
 * `?reel=` picks the shot list (REELS below). With no reel, and no `w`
 * and `h`, it is the website trailer exactly as it always was. The App
 * Store reels (5 Nov 2026, approved by David) are `header` — the 21:9
 * moving header, one seamless loop — and `iphone` / `ipad`, the app
 * previews, which share their shots and differ only in the camera.
 */

export const FPS = 30;
const P = new URLSearchParams(location.search);
/** The page size in CSS pixels; shoot.js multiplies it by SCALE. */
const W = Number(P.get('w') ?? 1280);
const H = Number(P.get('h') ?? 720);
const REEL = P.get('reel') ?? 'trailer';
/** The App Store reels, as opposed to the website trailer. */
const STORE = REEL !== 'trailer';
/** Where Baloo 2 is (see README): the store reels caption in it. */
const FONTS = P.get('fonts') ?? '/tmp/fonts';
/** A tablet, rather than a phone: the iPad reel frames wider. */
const PAD = W / H > 0.6 && W / H < 1;

/*
  The store reels are meant to be re-renderable to the same pixels, so
  the effects' sparks and embers (which call Math.random) are seeded too.
  The website trailer keeps the browser's own, as it always has.
*/
if (STORE) {
  let s = 20261105;
  Math.random = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

type V3 = [number, number, number];
interface Key { t: number; pos: V3; look: V3; fov?: number }
interface Throw {
  skin: string;
  at: number;
  pos: V3;
  vel: V3;
  spin: V3;
}
/**
 * A die that is flown rather than thrown: slow motion on a path that
 * repeats exactly every `period` seconds, so a looping video has no seam.
 * It crosses from `from` to `to` (both out of frame) on an arc, turning
 * `turns` whole times about `axis` on the way.
 */
interface Floater {
  skin: string;
  from: V3;
  to: V3;
  arc: number;
  period: number;
  phase: number;
  turns: number;
  axis: V3;
  /** Bigger than life, for the ones that pass close to the camera. */
  scale?: number;
}
/** A camera that drifts and comes back: pos + amp·(sin θ, sin 2θ, cos θ−1)... */
interface LoopCamera { pos: V3; look: V3; fov: number; amp: V3; lookAmp?: V3 }
interface Caption { text: string; from: number; to: number; big?: boolean }
interface Shot {
  arena?: ArenaId;
  seconds: number;
  /** Paper title cards instead of a battlefield. */
  card?: 'open' | 'end' | 'store-end';
  effect?: 'fire' | 'ice';
  /** Each die wears its own skin's effect (store reels: Fire beside Ice). */
  skinEffects?: true;
  /** A pond in the floor at this spot, for the Ice shot. */
  pond?: [number, number];
  throws: Throw[];
  floaters?: Floater[];
  /**
   * The length of the loop, for a shot that is meant to repeat. Floaters
   * and the loop camera come back to where they started after exactly
   * this many seconds. The shot itself is rendered a little LONGER, and
   * compose.py crossfades that overlap into the head, which hides the
   * few things (water, embers) that are not periodic.
   */
  loop?: number;
  camera: Key[];
  /** The iPad's camera, where the phone's would frame it badly. */
  cameraPad?: Key[];
  loopCamera?: LoopCamera;
  /** Simulation speed over the shot: [time, speed] pairs. */
  speed?: [number, number][];
  /** Moments to shake the camera, in shot seconds. */
  shakes?: number[];
  captions: Caption[];
  /**
   * The prisoners, as in a round: these jail slots (0-5) already free at
   * the retreat, the rest in jail. A shot with prisoners plays the rule:
   * when the dice stop, the SAME colour on both frees that prisoner.
   */
  prisoners?: { free: number[] };
  /**
   * The throw is a roll: before rendering, the throw is re-spun (a seeded
   * nudge to its spin, nothing else) until the real physics lands both
   * dice on the same colour, one whose prisoner is still in jail. Nothing
   * about the landing is faked — the search only picks which throw to film.
   */
  roll?: {
    want?: PrisonerColorId[];
    /** When the roll may be called, in shot seconds, so the captions line up. */
    window?: [number, number];
  };
}

/* A seeded random, so a re-render of the trailer is the same trailer. */
let seed = 7;
const rnd = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const between = (a: number, b: number) => a + rnd() * (b - a);
const spin = (s = 14): V3 => [between(-s, s), between(-s, s), between(-s, s)];

/** Skins worth showing off: bright, patterned, varied. */
const SHOWCASE = [
  'galaxy', 'rainbow', 'ruby', 'gold', 'amethyst', 'fire', 'ice',
].filter((id) => DICE_SKINS.some((s) => s.id === id));
const pickSkins = (n: number): string[] => {
  const pool = [...SHOWCASE, ...DICE_SKINS.map((s) => s.id).filter((id) => !SHOWCASE.includes(id))];
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(pool[(i * 7 + Math.floor(rnd() * 3)) % pool.length]);
  return out;
};

/** Many dice falling from the sky onto the tray. */
function storm(n: number, skins: string[], from: number, over: number, height: [number, number]): Throw[] {
  return Array.from({ length: n }, (_, i) => ({
    skin: skins[i % skins.length],
    at: from + (over * i) / n,
    pos: [between(-1.8, 1.8), between(height[0], height[1]), between(-3.8, 3.8)] as V3,
    vel: [between(-2, 2), between(-6, -2), between(-2, 2)] as V3,
    spin: spin(16),
  }));
}

const DIE_COUNT_TEXT = `${DICE_SKINS.length} dice sets`;
const ARENA_COUNT_TEXT = `${Object.keys(ARENAS).length} battlefields`;

const SHOTS: Record<string, Shot> = {
  open: {
    card: 'open',
    seconds: 3,
    throws: [],
    camera: [],
    captions: [],
  },

  /* 1. Dice rain onto the Castle in slow motion; the camera cranes down. */
  storm: {
    arena: 'castle',
    seconds: 5.5,
    throws: storm(14, pickSkins(14), 0.0, 1.4, [7, 11]),
    camera: [
      { t: 0, pos: [3, 17, 9], look: [0, 0, 0], fov: 42 },
      { t: 2.6, pos: [9, 7.5, 5], look: [0, 0.6, 0], fov: 40 },
      { t: 5.5, pos: [8, 6.2, -3], look: [0, 0.3, 0], fov: 38 },
    ],
    speed: [[0, 0.32], [2.4, 0.32], [3.4, 1], [5.5, 1]],
    shakes: [2.2],
    captions: [{ text: 'Every roll is a battle.', from: 0.6, to: 3.2 }],
  },

  /* 2. Fire dice hurled the length of Volcano Rim. */
  fire: {
    arena: 'volcano',
    effect: 'fire',
    seconds: 5.5,
    throws: [
      { skin: 'fire', at: 0.2, pos: [-0.9, 1.5, 4.0], vel: [0.6, 7, -15], spin: [18, 4, -9] },
      { skin: 'fire', at: 0.3, pos: [0.9, 1.6, 4.2], vel: [-0.8, 8, -14], spin: [-12, 9, 15] },
      { skin: 'fire', at: 0.4, pos: [-0.2, 1.8, 4.1], vel: [0.2, 9, -16], spin: [9, -14, 6] },
      { skin: 'fire', at: 0.5, pos: [0.4, 1.4, 3.9], vel: [-0.3, 6, -13], spin: [-7, 6, -16] },
    ],
    camera: [
      { t: 0, pos: [2.5, 6.5, 8.5], look: [0, 0.6, 1.5], fov: 44 },
      { t: 2.2, pos: [5.5, 6.2, 1.5], look: [0, 0.3, -2.2], fov: 40 },
      { t: 5.5, pos: [5.5, 5.4, -6.5], look: [0, 0.2, -2.6], fov: 38 },
    ],
    speed: [[0, 1], [0.7, 0.3], [2.6, 0.3], [3.3, 0.7], [5.5, 0.7]],
    shakes: [0.9, 1.6],
    captions: [{ text: 'Throw fire.', from: 0.5, to: 3.4, big: true }],
  },

  /* 3. Ice dice dive into a pond, which freezes around them. */
  ice: {
    arena: 'snow',
    effect: 'ice',
    pond: [0, -0.5],
    seconds: 6,
    throws: [
      { skin: 'ice', at: 0.1, pos: [-1.2, 5.5, 3.2], vel: [1.3, 2, -5.6], spin: [10, -6, 8] },
      { skin: 'ice', at: 0.3, pos: [1.3, 6, 3.5], vel: [-1.4, 1, -6.2], spin: [-9, 12, 5] },
    ],
    camera: [
      { t: 0, pos: [6.5, 5.5, 5.5], look: [0, 0.6, 0.5], fov: 42 },
      { t: 3, pos: [3.6, 2.4, 2.6], look: [0, 0, -0.5], fov: 38 },
      { t: 6, pos: [-3.2, 2.2, 2.4], look: [0, 0, -0.5], fov: 34 },
    ],
    speed: [[0, 0.8], [0.9, 0.3], [3.2, 0.5], [6, 1]],
    captions: [{ text: 'Freeze the pond.', from: 1.4, to: 4.6, big: true }],
  },

  /* 4. A montage: four battlefields, a whip of the camera each. */
  space: montage('space', 0),
  jungle: montage('jungle', 1),
  candy: montage('candy', 2),
  reef: montage('reef', 3),

  /* 5. The finale: a downpour of dice at sunset. */
  finale: {
    arena: 'castleSunset',
    seconds: 6.5,
    throws: storm(26, pickSkins(26), 0.0, 2.2, [8, 14]),
    camera: [
      { t: 0, pos: [3, 15, 10], look: [0, 0.5, 0], fov: 44 },
      { t: 3.2, pos: [7.5, 8, 7.5], look: [0, 0.5, 0], fov: 42 },
      { t: 6.5, pos: [10, 4.8, -1], look: [0, 0.6, 0], fov: 40 },
    ],
    speed: [[0, 0.45], [2.8, 0.45], [3.8, 1], [6.5, 1]],
    shakes: [2.6, 3.1],
    captions: [
      { text: DIE_COUNT_TEXT + '.', from: 0.6, to: 3.0 },
      { text: 'Race to free your prisoners.', from: 3.4, to: 6.3 },
    ],
  },

  end: {
    card: 'end',
    seconds: 4.5,
    throws: [],
    camera: [],
    captions: [],
  },
};

function montage(arena: ArenaId, k: number): Shot {
  const a = (k % 2 === 0 ? 1 : -1);
  return {
    arena,
    seconds: 1.6,
    throws: [0, 1, 2].map((i) => ({
      skin: pickSkins(3)[i],
      at: 0,
      pos: [(i - 1) * 1.2, between(2.2, 3.2), between(-0.6, 0.6)] as V3,
      vel: [between(-1, 1), between(4, 7), between(-1, 1)] as V3,
      spin: spin(18),
    })),
    camera: [
      { t: 0, pos: [7 * a, 6.5, 6], look: [0, 0.8, 0], fov: 40 },
      { t: 1.6, pos: [7.5 * a, 5.6, -4.5], look: [0, 0.8, 0], fov: 38 },
    ],
    speed: [[0, 0.55], [1.6, 0.55]],
    // One caption across all four shots: it fades in on the first and out
    // on the last, and simply stays up across the cuts in between.
    captions: [
      {
        text: ARENA_COUNT_TEXT + '.',
        from: k === 0 ? 0.15 : -1,
        to: k === 3 ? 1.35 : 99,
      },
    ],
  };
}

/** The order the trailer plays in. shoot.js reads it from here. */
export const ORDER = ['open', 'storm', 'fire', 'ice', 'space', 'jungle', 'candy', 'reef', 'finale', 'end'];

/* ------------------------- the App Store reels ------------------------- */

/*
  Approved by David, 5 Nov 2026, after a review against Apple's asset
  guidance. Rules that shaped every shot here:

  - Only dice and battlefields a player can get TODAY. No retired dice
    (the ball dice, Marc, 4 Nov 2026), no Dino Valley (hidden), nothing
    from a season that has not started (Sun & Moon is June 2027). Fire &
    Ice is the season running.
  - Slow camera, no whip pans, no quick cuts: compose.py crossfades
    between shots instead of cutting.
  - The header is muted and loops for ever, so it is one idea, one shot,
    and nothing in it may jump at the seam.
*/

/**
 * HEADER: Fire dice crossing one way and Ice dice the other, in slow
 * motion, over the Sunset Castle. Everything here repeats every 10 s.
 */
const HEADER_LOOP = 10;
const fireIce = (
  skin: string, dir: 1 | -1, x: number, y: number, arc: number, phase: number,
  turns: number, axis: V3, scale = 1,
): Floater => ({
  skin,
  // Camera on +x looking down -x: screen-left is +z, screen-right is -z.
  from: [x, y, 10 * dir],
  to: [x, y, -10 * dir],
  arc,
  period: HEADER_LOOP,
  phase,
  turns,
  axis,
  scale,
});

const STORE_SHOTS: Record<string, Shot> = {
  header: {
    arena: 'castleSunset',
    seconds: HEADER_LOOP + 1.5,
    loop: HEADER_LOOP,
    skinEffects: true,
    throws: [],
    floaters: [
      // Fire, left to right.
      // The near pair fly high and flat, clear of the corner towers they
      // pass over on the way in and out.
      fireIce('fire', 1, 2.2, 2.7, 0.45, 0.0, 1, [0.4, 1, 0.3], 1.45),
      fireIce('fire', 1, -0.4, 1.6, 0.9, 0.5, 1, [1, 0.2, -0.5], 1.25),
      // Ice, right to left, a little further back so they pass behind.
      fireIce('ice', -1, -1.4, 1.5, 1.0, 0.25, 1, [-0.3, 1, 0.6], 1.3),
      fireIce('ice', -1, 3.0, 2.5, 0.4, 0.75, 1, [0.8, -0.4, 1], 1.5),
    ],
    camera: [],
    loopCamera: {
      pos: [9.8, 6.0, 0],
      look: [0, 1.3, 0],
      fov: 32,
      amp: [0.4, 0.3, 1.4],
      lookAmp: [0, 0.05, 0.45],
    },
    speed: [[0, 0.3]],
    captions: [],
  },

  /* PREVIEW 1 — the rule, in the first five seconds. */
  'p-roll': {
    arena: 'castle',
    seconds: 6.0,
    prisoners: { free: [] },
    roll: { window: [2.2, 2.6] },
    throws: [
      { skin: 'gold', at: 0, pos: [-0.7, 2.4, 3.6], vel: [0.5, 2.5, -8.5], spin: [14, 5, -8] },
      { skin: 'gold', at: 0, pos: [0.7, 2.6, 3.9], vel: [-0.6, 3, -8], spin: [-9, 11, 12] },
    ],
    // Low behind the throw; over the dice as they stop, so both faces
    // read; then back to the game's own view for the prisoner's leap.
    camera: [
      { t: 0, pos: [0, 4.2, 9.8], look: [0, 1.2, 0.5], fov: 50 },
      { t: 1.7, pos: [0, 8.6, 5.0], look: [0, 0.2, -1.0], fov: 50 },
      { t: 2.4, pos: [0, 9.2, 5.3], look: [0, 0, -1.0], fov: 50 },
      { t: 3.7, pos: [0, 16.75, 8.25], look: [0, 0, -0.75], fov: 50 },
      { t: 6.0, pos: [0, 16.4, 8.1], look: [0, 0, -0.75], fov: 50 },
    ],
    cameraPad: [
      { t: 0, pos: [0, 4.0, 9.6], look: [0, 1.2, 0.5], fov: 46 },
      { t: 1.7, pos: [0, 8.4, 5.4], look: [0, 0.2, -1.0], fov: 46 },
      { t: 2.4, pos: [0, 9.0, 5.7], look: [0, 0, -1.0], fov: 46 },
      { t: 3.7, pos: [0, 17.5, 9.75], look: [0, 0, -0.75], fov: 46 },
      { t: 6.0, pos: [0, 17.1, 9.6], look: [0, 0, -0.75], fov: 46 },
    ],
    speed: [[0, 0.3], [1.1, 0.3], [2.0, 1], [6.0, 1]],
    captions: [
      { text: 'Roll. Match the colors.', from: 0.25, to: 2.6 },
      { text: 'Free your prisoners', from: 2.8, to: 5.5 },
    ],
  },

  /* PREVIEW 2 — Fire on Volcano Rim, then Ice on Snowy Hollow. */
  'p-fire': {
    arena: 'volcano',
    effect: 'fire',
    seconds: 3.8,
    throws: [
      { skin: 'fire', at: 0.0, pos: [-0.7, 1.5, 4.0], vel: [0.5, 6, -12], spin: [18, 4, -9] },
      { skin: 'fire', at: 0.1, pos: [0.7, 1.6, 4.2], vel: [-0.6, 7, -11.5], spin: [-12, 9, 15] },
    ],
    camera: [
      { t: 0, pos: [1.2, 5.2, 9.5], look: [0, 1.4, 1.0], fov: 52 },
      // Back and up as the dice part, so both stay in a narrow frame.
      { t: 3.8, pos: [0, 9.0, 3.6], look: [0, 0.4, -3.4], fov: 52 },
    ],
    cameraPad: [
      { t: 0, pos: [1.2, 5.0, 9.2], look: [0, 1.4, 1.0], fov: 46 },
      { t: 3.8, pos: [0, 8.4, 3.8], look: [0, 0.4, -3.4], fov: 46 },
    ],
    speed: [[0, 0.35], [2.3, 0.35], [3.2, 0.7], [3.8, 0.7]],
    captions: [{ text: 'Fire and Ice dice', from: 0.3, to: 99 }],
  },
  'p-ice': {
    arena: 'snow',
    effect: 'ice',
    pond: [0, -0.5],
    seconds: 4.0,
    throws: [
      { skin: 'ice', at: 0.0, pos: [-1.2, 5.5, 3.2], vel: [1.3, 2, -5.6], spin: [10, -6, 8] },
      { skin: 'ice', at: 0.15, pos: [1.3, 6, 3.5], vel: [-1.4, 1, -6.2], spin: [-9, 12, 5] },
    ],
    camera: [
      { t: 0, pos: [0.8, 7.5, 7.5], look: [0, 0.4, -0.2], fov: 50 },
      { t: 4.0, pos: [-1.6, 4.4, 4.6], look: [0, 0, -0.6], fov: 46 },
    ],
    cameraPad: [
      { t: 0, pos: [0.8, 7.0, 7.4], look: [0, 0.4, -0.2], fov: 44 },
      { t: 4.0, pos: [-1.6, 4.2, 4.8], look: [0, 0, -0.6], fov: 40 },
    ],
    speed: [[0, 0.7], [0.8, 0.3], [3.0, 0.5], [4.0, 0.8]],
    captions: [{ text: 'Fire and Ice dice', from: -1, to: 2.0 }],
  },

  /* PREVIEW 3 — a race: half the jail already empty, and another one out. */
  'p-race': {
    arena: 'candy',
    seconds: 4.2,
    prisoners: { free: [0, 3, 5] },
    roll: { window: [1.4, 2.2] },
    throws: [
      { skin: 'rainbow', at: 0, pos: [-0.7, 2.2, 3.6], vel: [0.8, 3, -9.5], spin: [-12, 8, 10] },
      { skin: 'rainbow', at: 0, pos: [0.7, 2.4, 3.8], vel: [-0.4, 3.5, -9], spin: [10, -13, 6] },
    ],
    // The game's own view, drifting a little: the whole race in one frame.
    camera: [
      { t: 0, pos: [1.2, 16.2, 8.6], look: [0, 0, -0.6], fov: 50 },
      { t: 4.2, pos: [-0.8, 16.75, 8.25], look: [0, 0, -0.75], fov: 50 },
    ],
    cameraPad: [
      { t: 0, pos: [1.2, 17.0, 10.0], look: [0, 0, -0.6], fov: 46 },
      { t: 4.2, pos: [-0.8, 17.5, 9.75], look: [0, 0, -0.75], fov: 46 },
    ],
    speed: [[0, 0.6], [1.0, 1], [4.2, 1]],
    captions: [{ text: 'Battle real players online', from: 0.25, to: 3.7 }],
  },

  /* PREVIEW 4 — two battlefields, slow, a crossfade between them. */
  'p-reef': collect('reef', ['ocean', 'ocean'], 0),
  'p-space': collect('space', ['galaxy', 'galaxy'], 1),

  /* PREVIEW 5 — the weekly cup, over a sunset downpour. */
  'p-cup': {
    arena: 'castleSunset',
    seconds: 3.8,
    throws: storm(12, ['ruby', 'gold', 'galaxy', 'rainbow', 'fire', 'ice', 'marble', 'copper'], 0.0, 1.2, [8, 12]),
    camera: [
      { t: 0, pos: [3, 14, 10], look: [0, 0.5, 0], fov: 50 },
      { t: 3.8, pos: [6.5, 8.5, 8.0], look: [0, 0.5, -0.4], fov: 48 },
    ],
    cameraPad: [
      { t: 0, pos: [3, 13, 10], look: [0, 0.5, 0], fov: 44 },
      { t: 3.8, pos: [6.5, 8.0, 8.4], look: [0, 0.5, -0.4], fov: 42 },
    ],
    speed: [[0, 0.4], [2.0, 0.4], [2.9, 1], [3.8, 1]],
    captions: [{ text: 'A new cup every week', from: 0.4, to: 3.3 }],
  },

  'p-end': {
    card: 'store-end',
    seconds: 3.2,
    throws: [],
    camera: [],
    captions: [],
  },
};

function collect(arena: ArenaId, skins: string[], k: number): Shot {
  const a = k % 2 === 0 ? 1 : -1;
  return {
    arena,
    seconds: 2.8,
    skinEffects: true,
    throws: skins.map((skin, i) => ({
      skin,
      at: 0,
      pos: [(i - 0.5) * 1.4, 2.6 + i * 0.4, 1.2] as V3,
      vel: [0.3 * a, 4.5, -1.6] as V3,
      spin: [9 - i * 15, 7, -6 + i * 10] as V3,
    })),
    camera: [
      { t: 0, pos: [4.2 * a, 7.4, 8.4], look: [0, 0.8, -0.2], fov: 50 },
      { t: 2.8, pos: [5.6 * a, 6.6, 6.0], look: [0, 0.6, -0.8], fov: 48 },
    ],
    cameraPad: [
      { t: 0, pos: [4.2 * a, 7.0, 8.6], look: [0, 0.8, -0.2], fov: 44 },
      { t: 2.8, pos: [5.6 * a, 6.2, 6.4], look: [0, 0.6, -0.8], fov: 42 },
    ],
    speed: [[0, 0.45], [2.8, 0.45]],
    captions: [
      { text: 'Collect dice and battlefields', from: k === 0 ? 0.3 : -1, to: k === 1 ? 2.2 : 99 },
    ],
  };
}

Object.assign(SHOTS, STORE_SHOTS);

/**
 * Every reel: its shots in order, the crossfade between them (seconds,
 * 0 = a cut), and whether its tail crossfades into its head so it loops.
 * shoot.js and compose.py both read this from the page.
 */
export const REELS: Record<string, { order: string[]; fade: number; loopFade: number }> = {
  trailer: { order: ORDER, fade: 0, loopFade: 0 },
  header: { order: ['header'], fade: 0, loopFade: 1.5 },
  iphone: {
    order: ['p-roll', 'p-fire', 'p-ice', 'p-race', 'p-reef', 'p-space', 'p-cup', 'p-end'],
    fade: 0.4,
    loopFade: 0.5,
  },
};
REELS.ipad = REELS.iphone;

/* ------------------------------------------------------------------ */

const ease = (x: number) => x * x * (3 - 2 * x);
function along(keys: Key[], t: number): Key {
  if (t <= keys[0].t) return keys[0];
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1];
    const b = keys[i];
    if (t <= b.t) {
      const u = ease((t - a.t) / (b.t - a.t));
      const mix = (p: V3, q: V3) => p.map((v, j) => v + (q[j] - v) * u) as V3;
      return {
        t,
        pos: mix(a.pos, b.pos),
        look: mix(a.look, b.look),
        fov: (a.fov ?? 40) + ((b.fov ?? 40) - (a.fov ?? 40)) * u,
      };
    }
  }
  return keys[keys.length - 1];
}
function speedAt(curve: [number, number][] | undefined, t: number): number {
  if (!curve) return 1;
  if (t <= curve[0][0]) return curve[0][1];
  for (let i = 1; i < curve.length; i++) {
    if (t <= curve[i][0]) {
      const [t0, s0] = curve[i - 1];
      const [t1, s1] = curve[i];
      return s0 + (s1 - s0) * ease((t - t0) / (t1 - t0));
    }
  }
  return curve[curve.length - 1][1];
}

/** A loop camera at time t: back exactly where it started every `loop` s. */
function looping(c: LoopCamera, t: number, loop: number): Key {
  const th = (2 * Math.PI * t) / loop;
  const wave: V3 = [Math.sin(th), Math.sin(2 * th) * 0.5, Math.sin(th)];
  const la = c.lookAmp ?? [0, 0, 0];
  return {
    t,
    pos: c.pos.map((v, j) => v + c.amp[j] * wave[j]) as V3,
    look: c.look.map((v, j) => v + la[j] * wave[j]) as V3,
    fov: c.fov,
  };
}

/** Where a floater is, and how fast it is going (per second of video). */
function flown(f: Floater, t: number) {
  const u = (((t / f.period + f.phase) % 1) + 1) % 1;
  const at = (v: number): V3 => [
    f.from[0] + (f.to[0] - f.from[0]) * v,
    f.from[1] + (f.to[1] - f.from[1]) * v + f.arc * Math.sin(Math.PI * v),
    f.from[2] + (f.to[2] - f.from[2]) * v,
  ];
  const pos = at(u);
  const du = 1e-3;
  const ahead = at(u + du);
  const vel = ahead.map((v, j) => ((v - pos[j]) / du) / f.period) as V3;
  const axis = new THREE.Vector3(...f.axis).normalize();
  const q = new THREE.Quaternion().setFromAxisAngle(axis, 2 * Math.PI * (f.turns * u + f.phase * 0.37));
  return { pos, vel, q };
}

/**
 * The tray, without the game's invisible ceiling: the trailer drops dice
 * from far higher than a throw ever reaches, and the ceiling would catch
 * them in mid-air.
 */
function buildWorld(pond: [number, number] | undefined) {
  const physics = createPhysicsWorld();
  const { world, trayMaterial } = physics;
  const { innerWidth, innerDepth, wallThickness } = TUNING.tray;
  const halfW = innerWidth / 2;
  const halfD = innerDepth / 2;
  const box = (he: V3, p: V3) =>
    world.addBody(
      new CANNON.Body({
        type: CANNON.Body.STATIC,
        material: trayMaterial,
        shape: new CANNON.Box(new CANNON.Vec3(...he)),
        position: new CANNON.Vec3(...p),
      }),
    );
  const fw = halfW + wallThickness;
  const fd = halfD + wallThickness;
  if (!pond) {
    box([fw, 0.5, fd], [0, -0.5, 0]);
  } else {
    const h = MOAT.size / 2;
    const [mx, mz] = pond;
    const strip = (x0: number, x1: number, z0: number, z1: number) =>
      box([(x1 - x0) / 2, 0.5, (z1 - z0) / 2], [(x0 + x1) / 2, -0.5, (z0 + z1) / 2]);
    strip(-fw, mx - h, -fd, fd);
    strip(mx + h, fw, -fd, fd);
    strip(mx - h, mx + h, -fd, mz - h);
    strip(mx - h, mx + h, mz + h, fd);
  }
  const tall = 20;
  const t = wallThickness / 2;
  box([t, tall, fd], [-(halfW + t), tall, 0]);
  box([t, tall, fd], [halfW + t, tall, 0]);
  box([fw, tall, t], [0, tall, -(halfD + t)]);
  box([fw, tall, t], [0, tall, halfD + t]);
  return physics;
}

/**
 * The physics of one shot, frame by frame. The same code runs the dry
 * runs that choose a roll and the run that is filmed, so what was chosen
 * is exactly what is filmed.
 */
class Sim {
  physics: ReturnType<typeof buildWorld>;
  bodies: (CANNON.Body | null)[];
  sunk: boolean[];
  simTime = 0;
  stillFor = 0;
  /** The roll, once called: the frame, and the colour each die shows. */
  called: { frame: number; colors: PrisonerColorId[]; flat: number } | null = null;
  constructor(private shot: Shot, private throws: Throw[], private onSink?: (k: number, x: number, z: number) => void) {
    this.physics = buildWorld(shot.pond);
    this.bodies = throws.map(() => null);
    this.sunk = throws.map(() => false);
  }
  step(i: number) {
    const { shot, throws, physics, bodies } = this;
    const t = i / FPS;
    const dt = (1 / FPS) * speedAt(shot.speed, t);
    throws.forEach((th, k) => {
      if (!bodies[k] && t >= th.at) {
        const body = createDieBody(physics.dieMaterial, th.pos);
        body.velocity.set(...th.vel);
        body.angularVelocity.set(...th.spin);
        body.allowSleep = false;
        physics.world.addBody(body);
        bodies[k] = body;
      }
    });
    physics.world.step(1 / 240, dt, 40);
    this.simTime += dt;
    bodies.forEach((body, k) => {
      // Into the pond: the Ice effect holds the picture half-frozen in.
      if (body && shot.pond && !this.sunk[k] && body.position.y < -0.25) {
        this.sunk[k] = true;
        this.onSink?.(k, body.position.x, body.position.z);
        body.type = CANNON.Body.STATIC;
        body.velocity.set(0, 0, 0);
        body.angularVelocity.set(0, 0, 0);
        body.updateMassProperties();
      }
    });
    // The game's own settle rule: still for stillFrames, then the roll is
    // called and the dice are frozen where they lie.
    if (shot.roll && !this.called && bodies.every(Boolean)) {
      const live = bodies as CANNON.Body[];
      this.stillFor = allStill(live) ? this.stillFor + 1 : 0;
      if (this.stillFor >= TUNING.settle.stillFrames) {
        const qs = live.map((b) => new THREE.Quaternion(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w));
        this.called = {
          frame: i,
          colors: qs.map((q) => topFaceColor(q).id),
          flat: Math.min(...qs.map((q) => topFaceAlignment(q))),
        };
        for (const b of live) {
          b.type = CANNON.Body.STATIC;
          b.velocity.set(0, 0, 0);
          b.angularVelocity.set(0, 0, 0);
          b.updateMassProperties();
        }
      }
    }
  }
}

/** Seconds a freed prisoner needs, after the call, to land and be seen. */
const AFTER_CALL = 1.6;

/**
 * Choose the throw to film: the first seeded re-spin whose real landing
 * shows the same colour on both dice, flat, for a prisoner still in jail,
 * early enough for the leap to finish on screen.
 */
function chooseRoll(shot: Shot): Throw[] {
  if (!shot.roll) return shot.throws;
  const frames = Math.round(shot.seconds * FPS);
  const jailed = PRISONER_COLORS.filter((_, i) => !shot.prisoners?.free.includes(i)).map((c) => c.id);
  const want = shot.roll.want ?? jailed;
  let s = 99;
  const r = () => {
    s = (s * 48271) % 2147483647;
    return s / 2147483647;
  };
  for (let attempt = 0; attempt < 400; attempt++) {
    const throws = shot.throws.map((th) =>
      attempt === 0
        ? th
        : {
            ...th,
            spin: th.spin.map((v) => v * (0.7 + 0.6 * r()) + (r() - 0.5) * 6) as V3,
          },
    );
    const sim = new Sim(shot, throws);
    for (let i = 0; i < frames && !sim.called; i++) sim.step(i);
    const c = sim.called;
    if (!c) continue;
    if (c.colors[0] !== c.colors[1] || !want.includes(c.colors[0]) || !jailed.includes(c.colors[0])) continue;
    if (c.flat < 0.96) continue;
    const [from, by] = shot.roll.window ?? [0, shot.seconds - AFTER_CALL];
    if (c.frame / FPS < from || c.frame / FPS > Math.min(by, shot.seconds - AFTER_CALL)) continue;
    console.log(`roll: attempt ${attempt}, ${c.colors[0]} at ${(c.frame / FPS).toFixed(2)}s`);
    return throws;
  }
  throw new Error('no matching roll found');
}

function Battle({ shot }: { shot: Shot }) {
  // ?arena= tries a shot on another battlefield (a probe, not a reel).
  const arena = ARENAS[(P.get('arena') as ArenaId | null) ?? shot.arena!];
  const Arena = arena.Component;
  const l = arena.lighting;
  const meshes = useRef<(THREE.Group | null)[]>([]);
  const { camera, advance, size, viewport } = useThree();
  const throws = useMemo(() => chooseRoll(shot), [shot]);
  const floaters = shot.floaters ?? [];
  const skins = useMemo(() => [...throws.map((t) => t.skin), ...floaters.map((f) => f.skin)], [throws]);

  /** The prisoners, if the shot has them. Mutated in place: Prisoners reads them every frame. */
  const units = useMemo<PrisonerUnit[] | null>(
    () =>
      shot.prisoners
        ? PRISONER_COLORS.map((c, i) => ({
            key: `p${i}`,
            colorId: c.id,
            hex: c.hex,
            jailIndex: i,
            station: shot.prisoners!.free.includes(i)
              ? { kind: 'retreat' as const, index: i }
              : { kind: 'jail' as const, index: i },
          }))
        : null,
    [shot],
  );

  /** The effects, and which dice each one draws on. */
  const effects = useMemo<{ fx: DieEffect; dice: number[] }[]>(() => {
    if (shot.effect) {
      return [{
        fx: createDieEffect(shot.effect, skins.length, shot.pond ? { x: shot.pond[0], z: shot.pond[1] } : null),
        dice: skins.map((_, i) => i),
      }];
    }
    if (!shot.skinEffects) return [];
    const by = new Map<DieEffectId, number[]>();
    skins.forEach((id, i) => {
      const e = skinById(id).effect;
      if (e) by.set(e, [...(by.get(e) ?? []), i]);
    });
    return [...by].map(([id, dice]) => ({ fx: createDieEffect(id, dice.length, null), dice }));
  }, [shot, skins]);

  useEffect(() => {
    const bodyOf = (k: number) => effects.find((e) => e.dice.includes(k));
    const sim = new Sim(shot, throws, (k, x, z) => {
      const e = bodyOf(k);
      e?.fx.sank(e.dice.indexOf(k), x, z);
    });
    const samples: DieSample[] = skins.map(() => ({
      x: 0, y: -50, z: 0, vx: 0, vy: 0, vz: 0, quaternion: new THREE.Quaternion(), moving: false,
    }));
    let threw = false;
    let freedAt = -1;
    const cam = camera as THREE.PerspectiveCamera;
    const keys = PAD && shot.cameraPad ? shot.cameraPad : shot.camera;

    (window as any).__frames = () => Math.round(shot.seconds * FPS);
    (window as any).__frame = (i: number) => {
      const t = i / FPS;
      const dt = (1 / FPS) * speedAt(shot.speed, t);
      sim.step(i);

      sim.bodies.forEach((body, k) => {
        const s = samples[k];
        const g = meshes.current[k];
        if (!body) {
          if (g) g.visible = false;
          return;
        }
        s.x = body.position.x; s.y = body.position.y; s.z = body.position.z;
        s.vx = body.velocity.x; s.vy = body.velocity.y; s.vz = body.velocity.z;
        s.quaternion.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);
        s.moving = body.velocity.length() > TUNING.settle.speedThreshold;
        if (g) {
          g.visible = true;
          const e = bodyOf(k);
          const held = sim.sunk[k] && e ? e.fx.heldAt(e.dice.indexOf(k)) : null;
          g.position.set(s.x, held ?? s.y, s.z);
          g.quaternion.copy(s.quaternion);
        }
      });
      floaters.forEach((f, j) => {
        const k = throws.length + j;
        const s = samples[k];
        const g = meshes.current[k];
        const { pos, vel, q } = flown(f, t);
        const sp = speedAt(shot.speed, t);
        s.x = pos[0]; s.y = pos[1]; s.z = pos[2];
        // The effects run on simulation time, so a slow-motion die is a
        // fast one seen slowly: its speed is the path's speed over `sp`.
        s.vx = vel[0] / sp; s.vy = vel[1] / sp; s.vz = vel[2] / sp;
        s.quaternion.copy(q);
        s.moving = true;
        if (g) {
          g.visible = true;
          g.position.set(...pos);
          g.quaternion.copy(q);
          g.scale.setScalar(f.scale ?? 1);
        }
      });

      // The rule: the same colour on both dice sets that prisoner free.
      if (units && sim.called && freedAt < 0 && i >= sim.called.frame + 6) {
        freedAt = i;
        const [a, b] = sim.called.colors;
        const unit = units.find((u) => u.colorId === a);
        if (a === b && unit && unit.station.kind === 'jail') {
          unit.station = { kind: 'retreat', index: unit.jailIndex };
        }
      }

      for (const { fx, dice } of effects) {
        const mine = dice.map((k) => samples[k]);
        if (!threw && (sim.bodies.some(Boolean) || floaters.length)) fx.thrown(mine);
        const pointScale = (size.height * viewport.dpr) / (2 * Math.tan((cam.fov * Math.PI) / 360));
        fx.update(dt, sim.simTime, mine, pointScale);
      }
      if (sim.bodies.some(Boolean) || floaters.length) threw = true;
      for (const m of LIVE) m.uniforms.uTime.value = sim.simTime;

      // The camera, with a jolt on the big impacts.
      const k = shot.loopCamera ? looping(shot.loopCamera, t, shot.loop!) : along(keys, t);
      let jolt = 0;
      for (const at of shot.shakes ?? []) {
        const d = t - at;
        if (d >= 0 && d < 0.5) jolt += 0.12 * (1 - d / 0.5) * Math.sin(d * 70);
      }
      cam.fov = k.fov ?? 40;
      cam.aspect = W / H;
      cam.updateProjectionMatrix();
      cam.position.set(k.pos[0] + jolt, k.pos[1] + jolt * 0.6, k.pos[2]);
      cam.lookAt(k.look[0], k.look[1], k.look[2]);

      drawCaptions(shot, t);
      // The store reels run the scene's clock on simulation time, so the
      // prisoners' leaps and the scenery are the same on every render. The
      // website trailer keeps the wall clock it was made with.
      advance(STORE ? 1 + sim.simTime : performance.now());
    };
    (window as any).__ready = true;
    return () => effects.forEach((e) => e.fx.dispose());
  }, [shot, throws, effects, camera, advance, size, viewport]);

  return (
    <>
      <color attach="background" args={[arena.skyColor]} />
      <hemisphereLight args={[l.hemisphere.sky, l.hemisphere.ground, l.hemisphere.intensity]} />
      <directionalLight position={l.key.position} intensity={l.key.intensity} color={l.key.color} />
      <directionalLight position={l.fill.position} intensity={l.fill.intensity} color={l.fill.color} />
      <Arena padColors={units ? PRISONER_COLORS.map((c) => c.hex) : undefined} />
      {units && <Prisoners units={units} />}
      {shot.pond && (
        <WaterSurface
          look={{ shallow: '#5fb3d8', deep: troughOf('#5fb3d8'), foam: '#ffffff', opacity: 0.94 }}
          shape="square"
          size={[MOAT.size + 0.1, MOAT.size + 0.1]}
          flow={[0.14, 0.08]}
          position={[shot.pond[0], 0.03, shot.pond[1]]}
        />
      )}
      {skins.map((id, i) => {
        const skin = skinById(id);
        return (
          <DieMesh
            key={i}
            bodyColor={skin.body}
            pattern={skin.pattern}
            patternInk={skin.ink}
            ref={(g: THREE.Group | null) => {
              meshes.current[i] = g;
              if (g) g.visible = false;
            }}
          />
        );
      })}
      {effects.map((e, i) => <primitive key={i} object={e.fx.group} />)}
    </>
  );
}

/* ---------------------------- the words ---------------------------- */

const INK = '#1d1a2e';
const PAPER = '#fdf6ec';
const ACCENT = '#e04e1f';
/** The store reels caption in Baloo 2, like the App Store screenshots. */
const STORE_FONT = '"Baloo 2", "Arial Black", Arial, sans-serif';
/** The store captions scale with the frame: a phone and an iPad differ. */
const U = Math.min(W, H) / 443;

const captionBox = document.createElement('div');
Object.assign(captionBox.style, STORE
  ? {
      position: 'absolute', left: '0', right: '0', top: `${Math.round(H * 0.075)}px`,
      display: 'flex', justifyContent: 'center', pointerEvents: 'none',
    }
  : {
      position: 'absolute', left: '0', right: '0', bottom: '64px',
      display: 'flex', justifyContent: 'center', pointerEvents: 'none',
    });
const captionTag = document.createElement('div');
Object.assign(captionTag.style, STORE
  ? {
      background: PAPER, color: INK, border: `${3 * U}px solid ${INK}`, borderRadius: `${14 * U}px`,
      boxShadow: `${5 * U}px ${5 * U}px 0 ${INK}`, padding: `${4 * U}px ${16 * U}px ${2 * U}px`,
      font: `800 ${30 * U}px/1.08 ${STORE_FONT}`, textAlign: 'center',
      maxWidth: `${W * 0.8}px`, opacity: '0',
    }
  : {
      background: PAPER, color: INK, border: `4px solid ${INK}`, borderRadius: '18px',
      boxShadow: `8px 8px 0 ${INK}`, padding: '14px 30px',
      font: `900 46px/1.1 "Arial Black", "Helvetica Neue", Arial, sans-serif`,
      letterSpacing: '-0.5px', opacity: '0',
    });
captionBox.appendChild(captionTag);

function drawCaptions(shot: Shot, t: number) {
  const now = shot.captions.find((c) => t >= c.from && t <= c.to);
  if (!now) {
    captionTag.style.opacity = '0';
    return;
  }
  const inT = Math.min(1, (t - now.from) / 0.22);
  const outT = Math.min(1, (now.to - t) / 0.22);
  const k = Math.min(inT, outT);
  captionTag.textContent = now.text;
  captionTag.style.opacity = String(k);
  if (STORE) {
    captionTag.style.transform = `translateY(${(1 - ease(inT)) * -24 * U}px) scale(${0.92 + 0.08 * ease(k)}) rotate(-1.5deg)`;
    return;
  }
  captionTag.style.fontSize = now.big ? '72px' : '46px';
  captionTag.style.transform = `translateY(${(1 - ease(inT)) * 40}px) scale(${0.9 + 0.1 * ease(k)}) rotate(-1.5deg)`;
}

function Card({ shot, kind }: { shot: Shot; kind: 'open' | 'end' | 'store-end' }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    (window as any).__frames = () => Math.round(shot.seconds * FPS);
    (window as any).__frame = (i: number) => {
      const t = i / FPS;
      const el = root.current!;
      const pop = (from: number, dur = 0.45) => {
        const u = Math.max(0, Math.min(1, (t - from) / dur));
        // A little overshoot, like a card slapped down on the table.
        const s = u < 1 ? 0.6 + 0.5 * ease(u) - 0.1 * Math.sin(u * Math.PI) : 1;
        return { opacity: String(Math.min(1, u * 2)), transform: `scale(${s})` };
      };
      el.querySelectorAll<HTMLElement>('[data-at]').forEach((n) => {
        Object.assign(n.style, pop(Number(n.dataset.at)));
      });
      // Fade to and from black at the edges of the trailer. The store
      // reels loop instead, so compose.py crossfades their edges.
      const fadeIn = kind === 'open' ? Math.min(1, t / 0.4) : 1;
      const fadeOut = kind === 'end' ? Math.min(1, (shot.seconds - t) / 0.6) : 1;
      el.style.opacity = String(Math.min(fadeIn, fadeOut));
    };
    (window as any).__ready = true;
  }, [shot, kind]);

  const line = (at: number, text: string, style: React.CSSProperties) => (
    <div data-at={at} style={{ opacity: 0, ...style }}>{text}</div>
  );
  if (kind === 'store-end') {
    return (
      <div ref={root} style={{
        position: 'absolute', inset: 0, background: PAPER, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 14 * U, padding: `0 ${24 * U}px`,
        font: `800 ${40 * U}px/1.0 ${STORE_FONT}`, color: INK, textAlign: 'center',
      }}>
        <img data-at="0.15" src={logo} style={{ opacity: 0, width: 210 * U }} />
        {line(0.45, 'Dice Battles:', { fontSize: 44 * U, marginTop: 10 * U })}
        {line(0.6, 'Color Rush', { fontSize: 56 * U, color: ACCENT, marginTop: -8 * U })}
        {line(1.05, 'A dice game for the whole family', {
          font: `800 ${22 * U}px/1.15 ${STORE_FONT}`, color: '#5b5670', marginTop: 8 * U, maxWidth: 330 * U,
        })}
      </div>
    );
  }
  return (
    <div ref={root} style={{
      position: 'absolute', inset: 0, background: PAPER, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 18,
      font: `900 40px/1.15 "Arial Black", "Helvetica Neue", Arial, sans-serif`, color: INK,
    }}>
      {kind === 'open' ? (
        <>
          {line(0.2, 'PAPER SHIP STUDIO PRESENTS', { font: '800 30px/1 Arial, sans-serif', letterSpacing: '6px', color: ACCENT })}
          <img data-at="0.7" src={logo} style={{ opacity: 0, width: 300 }} />
        </>
      ) : (
        <>
          <img data-at="0.1" src={logo} style={{ opacity: 0, width: 240 }} />
          {line(0.5, 'Dice Battles: Color Rush', { fontSize: 64 })}
          {line(1.1, 'A dice game for the whole family', { font: '700 30px/1.2 Arial, sans-serif', color: '#5b5670' })}
          {line(1.8, 'Coming soon to iPhone and iPad', {
            font: '900 30px/1 Arial, sans-serif', color: PAPER, background: ACCENT,
            border: `4px solid ${INK}`, borderRadius: 16, boxShadow: `6px 6px 0 ${INK}`, padding: '14px 26px', marginTop: 12,
          })}
        </>
      )}
    </div>
  );
}

/* ----------------------------- mounting ----------------------------- */

(window as any).__reel = REELS[REEL];
const which = P.get('shot') ?? REELS[REEL].order[0];
const shot = SHOTS[which];

document.body.style.margin = '0';
document.body.style.background = '#000';
if (STORE) {
  const face = document.createElement('style');
  face.textContent = `@font-face { font-family: "Baloo 2"; font-weight: 800; src: url("file://${FONTS}/baloo-800.ttf"); }`;
  document.head.appendChild(face);
}
const host = document.createElement('div');
Object.assign(host.style, { position: 'relative', width: `${W}px`, height: `${H}px`, overflow: 'hidden' });
document.body.appendChild(host);
const mount = document.createElement('div');
Object.assign(mount.style, { position: 'absolute', inset: '0' });
host.appendChild(mount);
host.appendChild(captionBox);

const start = () =>
  createRoot(mount).render(
    shot.card ? (
      <Card shot={shot} kind={shot.card} />
    ) : (
      <Canvas
        frameloop="never"
        style={{ width: W, height: H }}
        camera={{ fov: 40, near: 0.1, far: 400, position: [8, 8, 8] }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
        }}
      >
        <Battle shot={shot} />
      </Canvas>
    ),
  );
// The caption font has to be in before the first frame is filmed.
if (STORE) document.fonts.load(`800 40px "Baloo 2"`).then(start, start);
else start();
