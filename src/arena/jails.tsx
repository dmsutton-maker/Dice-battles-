import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { JAIL_SLOTS } from '../game/stations';
import { TUNING } from '../game/tuning';
import { JailKind } from './jailKinds';

/**
 * The jail on every board — twenty of them, one per battlefield.
 *
 * Until the October 2026 redesign every board drew "essentially the same
 * thin dark railing" here (docs/board-redesign.md). The jail is where the
 * prisoners wait, which makes it the score, which makes it one of the
 * things on screen people look at most; it has to say which board you
 * are on as loudly as the walls do.
 *
 * WHERE THINGS MAY GO. Everything is built in pen-local coordinates: the
 * origin is the pen floor directly under the middle of the prisoner row
 * (JAIL_SLOTS), so y 0 is where the figures' feet are and z +0.8 is the
 * back of the tray's far wall. Three rules, all from the camera
 * (cameraFit.ts — nearly straight down, 17 degrees of tilt):
 *
 * - The figures stand at |x| <= 1.8, z 0, and need |x| <= 2.1, |z| <= 0.3
 *   and about 0.9 of height to themselves. A rescue launches them
 *   STRAIGHT UP before it carries them forward (flight.ts eases z and not
 *   y), so nothing may hang over that strip at any height.
 * - Nothing in front of a figure may rise into its line of sight, so the
 *   tall pieces — walls, roofs, lids, shells — stand BEHIND the row
 *   (z < -0.4). Seen from this camera the back of the pen sits above the
 *   figures on screen, not behind them, so a back wall is a backdrop and
 *   never a screen.
 * - Height at the back is capped by the HUD, not by taste: the old bar
 *   tops (1.15 above the floor at z -0.8) are exactly where the camera
 *   fit stops the board below the title. About 1.4 there is the most
 *   the picture has room for, and the further back a piece stands the
 *   less height it gets.
 *
 * tests/arenaShape.test.ts measures the first and the last of these on
 * every design, vertex by vertex, so a new piece cannot quietly break
 * either.
 *
 * Nothing here is collidable. The pen sits outside the tray, behind the
 * far wall, where no die can reach.
 *
 * IDLE LIFE runs from `onBeforeRender` on the platform mesh rather than
 * from useFrame. Every arena module is loaded by the node test suite
 * through arenas.tsx, and '@react-three/fiber/native' cannot load there —
 * the same reason the water is driven by WaterClock from outside the
 * arenas. A render hook also means the animation costs nothing while the
 * board is asleep: no frame, no tick.
 *
 * PERFORMANCE. Each jail is a few dozen simple solids, and drawing them as
 * a few dozen meshes would be a few dozen draw calls on a phone for one
 * piece of scenery. So they are built once, transformed in place and
 * MERGED: one geometry per material per moving part. A jail costs three
 * to eleven draw calls, its geometry is made once per board rather than
 * once per frame, and all of it is disposed when the board changes.
 */

type V3 = readonly [number, number, number];
const ZERO: V3 = [0, 0, 0];
const ONE: V3 = [1, 1, 1];

const PEN = TUNING.prison;
const FLOOR = PEN.platformHeight;
/** The platform is the old one's footprint, so nothing around it moves. */
const PLATFORM_W = PEN.innerWidth + 0.5;
const PLATFORM_D = PEN.depth + 0.4;
const PEN_Z = JAIL_SLOTS[0].z;
/** Seconds, for the idle life. Reading it allocates nothing. */
function seconds(): number {
  return (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
}

/* ── building ─────────────────────────────────────────────────────── */

/** How a material looks. `unlit` is for flame and light, never for solids. */
interface Look {
  color: string;
  rough?: number;
  metal?: number;
  glow?: string;
  glowAmount?: number;
  opacity?: number;
  unlit?: boolean;
  twoSided?: boolean;
  /** Only the inside faces: a hollow seen through its open front. */
  inside?: boolean;
}

interface Layer {
  name: string;
  pivot: [number, number, number];
  rotation: [number, number, number];
  parts: Map<string, THREE.BufferGeometry[]>;
}

const scratch = {
  m: new THREE.Matrix4(),
  q: new THREE.Quaternion(),
  e: new THREE.Euler(),
  p: new THREE.Vector3(),
  s: new THREE.Vector3(),
};

/**
 * Collects solids, transformed into place, sorted by material and by the
 * moving part they belong to. Build-time only: nothing here runs per frame.
 */
class Kit {
  readonly layers: Layer[] = [];
  private current: Layer;

  constructor() {
    this.current = this.in('base');
  }

  /** Everything added after this belongs to the named part, which can move. */
  in(name: string, pivot: V3 = ZERO, rotation: V3 = ZERO): Layer {
    let layer = this.layers.find((l) => l.name === name);
    if (!layer) {
      layer = { name, pivot: [...pivot], rotation: [...rotation], parts: new Map() };
      this.layers.push(layer);
    }
    this.current = layer;
    return layer;
  }

  put(mat: string, g: THREE.BufferGeometry, pos: V3 = ZERO, rot: V3 = ZERO, scale: V3 = ONE): this {
    const { m, q, e, p, s } = scratch;
    m.compose(p.set(pos[0], pos[1], pos[2]), q.setFromEuler(e.set(rot[0], rot[1], rot[2])), s.set(scale[0], scale[1], scale[2]));
    g.applyMatrix4(m);
    const list = this.current.parts.get(mat);
    if (list) list.push(g);
    else this.current.parts.set(mat, [g]);
    return this;
  }

  box(mat: string, size: V3, pos: V3, rot?: V3): this {
    return this.put(mat, new THREE.BoxGeometry(size[0], size[1], size[2]), pos, rot);
  }

  cyl(mat: string, rTop: number, rBottom: number, h: number, seg: number, pos: V3, rot?: V3): this {
    return this.put(mat, new THREE.CylinderGeometry(rTop, rBottom, h, seg), pos, rot);
  }

  cone(mat: string, r: number, h: number, seg: number, pos: V3, rot?: V3, scale?: V3): this {
    return this.put(mat, new THREE.ConeGeometry(r, h, seg), pos, rot, scale);
  }

  ball(mat: string, r: number, pos: V3, scale?: V3, seg = 8, rot?: V3): this {
    return this.put(mat, new THREE.SphereGeometry(r, seg, Math.max(4, Math.round(seg * 0.75))), pos, rot, scale);
  }

  ring(mat: string, r: number, tube: number, pos: V3, rot?: V3, arc = Math.PI * 2, seg = 12): this {
    return this.put(mat, new THREE.TorusGeometry(r, tube, 5, seg, arc), pos, rot);
  }

  /** A bent rod through the given points: roots, vines, wire. */
  tube(mat: string, points: V3[], r: number, seg = 12): this {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
    return this.put(mat, new THREE.TubeGeometry(curve, seg, r, 4, false));
  }
}

export interface BakedLayer {
  name: string;
  pivot: [number, number, number];
  rotation: [number, number, number];
  meshes: { mat: string; geometry: THREE.BufferGeometry }[];
}

/** One geometry per material per part; the pieces are disposed once merged. */
function bake(kit: Kit): BakedLayer[] {
  return kit.layers.map((layer) => {
    const meshes: BakedLayer['meshes'] = [];
    for (const [mat, list] of layer.parts) {
      if (list.length === 1) {
        meshes.push({ mat, geometry: list[0] });
        continue;
      }
      // Tubes and boxes are indexed, polyhedra are not; mixing the two
      // is the one thing mergeGeometries refuses.
      const indexed = list.every((g) => g.index !== null);
      const source = indexed ? list : list.map((g) => (g.index ? g.toNonIndexed() : g));
      const merged = mergeGeometries(source, false);
      if (merged) {
        meshes.push({ mat, geometry: merged });
        for (const g of new Set([...list, ...source])) g.dispose();
      } else {
        // Never expected — every part here has the same three attributes —
        // but unmerged is still a correct picture, just a dearer one.
        for (const g of list) meshes.push({ mat, geometry: g });
        if (!indexed) for (const g of source) if (!list.includes(g)) g.dispose();
      }
    }
    return { name: layer.name, pivot: layer.pivot, rotation: layer.rotation, meshes };
  });
}

function makeMaterial(l: Look): THREE.Material {
  const opacity = l.opacity ?? 1;
  const transparent = opacity < 1;
  const side = l.twoSided ? THREE.DoubleSide : l.inside ? THREE.BackSide : THREE.FrontSide;
  // A faint field must not hide what is behind it from the depth test;
  // a nearly solid piece of ice should.
  const depthWrite = opacity > 0.5;
  if (l.unlit) {
    return new THREE.MeshBasicMaterial({ color: l.color, toneMapped: false, transparent, opacity, side, depthWrite });
  }
  return new THREE.MeshStandardMaterial({
    color: l.color,
    roughness: l.rough ?? 0.85,
    metalness: l.metal ?? 0,
    emissive: l.glow ?? '#000000',
    emissiveIntensity: l.glowAmount ?? 0,
    transparent,
    opacity,
    side,
    depthWrite,
  });
}

/* ── the twenty designs ───────────────────────────────────────────── */

interface Paint {
  /** The board's own platform colour (themeData `jail.platform`). */
  platform: string;
  /** The board's own dark trim colour (themeData `jail.bars`). */
  bars: string;
}

interface Live {
  mats: Record<string, THREE.Material>;
  layers: Record<string, THREE.Object3D | undefined>;
}

interface Design {
  looks(p: Paint): Record<string, Look>;
  build(k: Kit): void;
  /** Idle life, if any. Mutates what exists; allocates nothing. */
  tick?(t: number, live: Live): void;
}

const PI = Math.PI;

/** n evenly spaced values from a to b inclusive. */
function span(a: number, b: number, n: number): number[] {
  return Array.from({ length: n }, (_v, i) => (n === 1 ? (a + b) / 2 : a + ((b - a) * i) / (n - 1)));
}

/** A fixed scatter in 0..1, so the same board is drawn the same every time. */
function jit(i: number): number {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** The platform the figures stand on; `top` lowers it for the chests. */
function platform(k: Kit, mat = 'platform', top = 0): void {
  k.box(mat, [PLATFORM_W, FLOOR + top, PLATFORM_D], [0, (top - FLOOR) / 2, 0]);
}

function std(mat: THREE.Material): THREE.MeshStandardMaterial {
  return mat as THREE.MeshStandardMaterial;
}

/** A flame's flicker: taller and thinner, shorter and wider, never in step. */
function flicker(o: THREE.Object3D | undefined, t: number, phase: number): void {
  if (!o) return;
  const s = 1 + 0.16 * Math.sin(t * 13 + phase) + 0.07 * Math.sin(t * 31 + phase * 2.3);
  const w = 1 - (s - 1) * 0.45;
  o.scale.set(w, s, w);
}

const DESIGNS: Record<JailKind, Design> = {
  /*
    Castle Courtyard: a gatehouse. Two square towers, a crenellated
    lintel between them, and under it the portcullis — the one shape
    everyone draws for "castle prison", spikes and all.
  */
  portcullis: {
    looks: (p) => ({
      platform: { color: p.platform, rough: 0.95 },
      stone: { color: '#a39783', rough: 0.95 },
      coping: { color: '#7f7363', rough: 0.95 },
      iron: { color: p.bars, metal: 0.5, rough: 0.45 },
      gloom: { color: '#2e2a26', rough: 1 },
      passage: { color: '#6e6457', rough: 1 },
    }),
    build(k) {
      platform(k);
      k.box('coping', [PLATFORM_W + 0.04, 0.1, PLATFORM_D + 0.04], [0, -0.05, 0]);
      // The gate passage behind the portcullis: a mid stone, not black,
      // because the bars are dark and have to show against it.
      k.box('passage', [3.7, 0.95, 0.08], [0, 0.475, -0.98]);
      // The lintel sits BEHIND the portcullis; in front, its top face
      // covered the top half of the bars from this camera.
      k.box('stone', [3.9, 0.26, 0.26], [0, 1.08, -0.86]);
      for (const x of span(-1.5, 1.5, 7)) k.box('stone', [0.26, 0.16, 0.26], [x, 1.29, -0.86]);
      for (const s of [-1, 1]) {
        k.box('stone', [0.64, 1.24, 0.56], [s * 2.2, 0.62, -0.68]);
        for (const dx of [-1, 1])
          for (const dz of [-1, 1]) k.box('stone', [0.18, 0.14, 0.17], [s * 2.2 + dx * 0.22, 1.31, -0.68 + dz * 0.19]);
        k.box('gloom', [0.08, 0.34, 0.02], [s * 2.2, 0.78, -0.395]);
        for (const z of [-0.3, 0.05, 0.4]) k.box('iron', [0.05, 1.0, 0.05], [s * 2.2, 0.5, z]);
        k.box('iron', [0.06, 0.06, 0.9], [s * 2.2, 1.0, 0]);
      }
      // Raised a hand's width, so the spikes show.
      for (const x of span(-1.65, 1.65, 12)) {
        k.box('iron', [0.07, 0.86, 0.07], [x, 0.57, -0.68]);
        k.cone('iron', 0.055, 0.14, 4, [x, 0.07, -0.68], [PI, 0, 0]);
      }
      for (const y of [0.3, 0.62, 0.92]) k.box('iron', [3.45, 0.06, 0.07], [0, y, -0.66]);
    },
  },

  /*
    Sunset Castle: the ruin's makeshift jail — a palisade of sharpened
    logs and a plank gate, with a torch either side of it. The torches
    are the board's evening light and they flicker.
  */
  stockade: {
    looks: (p) => ({
      platform: { color: p.platform, rough: 0.95 },
      log: { color: '#94673f', rough: 0.9 },
      logDark: { color: p.bars, rough: 0.9 },
      iron: { color: '#3a3436', metal: 0.5, rough: 0.5 },
      flame: { color: '#ff9a3c', unlit: true },
      core: { color: '#ffe3a0', unlit: true },
    }),
    build(k) {
      platform(k);
      span(-2.35, 2.35, 21).forEach((x, i) => {
        if (Math.abs(x) < 0.72) return; // the gate
        const h = 1.02 + 0.14 * jit(i);
        k.cyl('log', 0.1, 0.11, h, 7, [x, h / 2, -0.86]);
        k.cone('log', 0.1, 0.18, 7, [x, h + 0.09, -0.86]);
      });
      for (const s of [-1, 1]) {
        span(-0.62, 0.3, 5).forEach((z, i) => {
          const h = 0.92 + 0.12 * jit(i + s * 10);
          k.cyl('log', 0.1, 0.11, h, 7, [s * 2.35, h / 2, z]);
          k.cone('log', 0.1, 0.18, 7, [s * 2.35, h + 0.09, z]);
        });
        // Rails on the inside, binding the stakes.
        for (const y of [0.3, 0.82]) k.box('logDark', [1.66, 0.08, 0.08], [s * 1.55, y, -0.74]);
        k.box('logDark', [0.08, 0.08, 1.0], [s * 2.25, 0.62, -0.16]);
        // The gate: a post, a leaf of three planks, battens and a brace.
        k.cyl('logDark', 0.13, 0.14, 1.38, 8, [s * 0.82, 0.69, -0.86]);
        for (const n of [0, 1, 2]) k.box('log', [0.2, 1.0, 0.07], [s * (0.12 + 0.22 * n), 0.55, -0.8]);
        for (const y of [0.25, 0.85]) k.box('logDark', [0.64, 0.08, 0.04], [s * 0.33, y, -0.755]);
        k.box('logDark', [0.07, 0.74, 0.04], [s * 0.33, 0.55, -0.755], [0, 0, s * 0.72]);
        k.ring('iron', 0.05, 0.012, [s * 0.07, 0.55, -0.73]);
        // A torch either side of the gate.
        k.cyl('logDark', 0.035, 0.045, 1.0, 6, [s * 1.08, 0.5, -0.64]);
        k.cyl('iron', 0.085, 0.05, 0.12, 8, [s * 1.08, 1.04, -0.64]);
      }
      k.box('logDark', [1.9, 0.16, 0.2], [0, 1.3, -0.86]);
      for (const [name, x] of [['flameL', -1.08], ['flameR', 1.08]] as const) {
        k.in(name, [x, 1.1, -0.64]);
        k.cone('flame', 0.1, 0.32, 7, [0, 0.16, 0]);
        k.cone('core', 0.055, 0.17, 6, [0, 0.1, 0.03]);
      }
      k.in('base');
    },
    tick(t, live) {
      flicker(live.layers.flameL, t, 0);
      flicker(live.layers.flameR, t, 2.1);
    },
  },

  /*
    Jungle Clearing: bamboo poles with their joints showing, lashed to
    two rails with vine, a vine sagging along the top and leaves at the
    corners.
  */
  bambooCage: {
    looks: (p) => ({
      platform: { color: p.platform, rough: 0.95 },
      bamboo: { color: p.bars, rough: 0.6 },
      node: { color: '#7f7030', rough: 0.7 },
      vine: { color: '#4a8a3a', rough: 0.9 },
      leaf: { color: '#3c7a34', rough: 0.85 },
    }),
    build(k) {
      platform(k);
      const pole = (x: number, z: number, h: number) => {
        k.cyl('bamboo', 0.055, 0.06, h, 7, [x, h / 2, z]);
        for (const y of [0.45, 0.92]) k.cyl('node', 0.068, 0.068, 0.04, 7, [x, y, z]);
      };
      span(-2.25, 2.25, 16).forEach((x, i) => {
        pole(x, -0.86, 1.28 + 0.08 * jit(i));
        k.ring('vine', 0.075, 0.022, [x, 1.18, -0.84], [PI / 2, 0, 0], PI * 2, 10);
        if (i % 2 === 0) k.ring('vine', 0.075, 0.022, [x, 0.3, -0.84], [PI / 2, 0, 0], PI * 2, 10);
      });
      for (const s of [-1, 1]) {
        for (const z of [-0.5, -0.15, 0.2]) {
          pole(s * 2.28, z, 1.25);
          k.ring('vine', 0.075, 0.022, [s * 2.28, 1.18, z], [PI / 2, 0, 0], PI * 2, 10);
        }
        for (const y of [0.3, 1.18]) k.cyl('bamboo', 0.045, 0.045, 1.2, 6, [s * 2.22, y, -0.33], [PI / 2, 0, 0]);
        for (const [x, y, z] of [[2.3, 1.28, -0.78], [2.36, 1.2, -0.6], [2.18, 1.3, -0.88]] as const)
          k.ball('leaf', 0.14, [s * x, y, z], [1, 0.32, 0.6], 8, [0, s * 0.6, s * 0.3]);
      }
      for (const y of [0.3, 1.18]) k.cyl('bamboo', 0.045, 0.045, 4.7, 6, [0, y, -0.8], [0, 0, PI / 2]);
      // A vine slung between the knots, sagging between them.
      const sag: V3[] = [];
      for (const x of span(-2.25, 2.25, 11)) sag.push([x, 1.2 - (Math.round((x + 2.25) / 0.45) % 2) * 0.2, -0.76]);
      k.tube('vine', sag, 0.022, 40);
      for (const x of [-1.35, -0.45, 0.9, 1.8]) k.ball('leaf', 0.1, [x, 0.98, -0.74], [1, 0.3, 0.6], 8, [0.6, 0, 0.4]);
    },
  },

  /*
    Space Station: a containment cell. An emitter frame with a pylon at
    each corner, a faint field between them, and the glowing bars of
    the field itself. The field shimmers; the bars pulse.

    There is no field across the front. A tinted pane between the camera
    and the figures would change their colours, and their colours are
    the game.
  */
  forceField: {
    looks: (p) => ({
      platform: { color: p.platform, rough: 0.5, metal: 0.5 },
      frame: { color: '#3a4052', rough: 0.4, metal: 0.6 },
      field: { color: p.bars, unlit: true, opacity: 0.16, twoSided: true },
      beam: { color: p.bars, unlit: true, opacity: 0.85 },
      lamp: { color: '#ff5fd0', unlit: true },
    }),
    build(k) {
      platform(k);
      k.box('frame', [4.7, 0.12, 0.14], [0, 0.06, -0.86]);
      k.box('frame', [4.7, 0.1, 0.12], [0, 1.24, -0.86]);
      k.put('field', new THREE.PlaneGeometry(4.46, 1.1), [0, 0.65, -0.86]);
      for (const x of span(-1.8, 1.8, 9)) k.box('beam', [0.024, 1.1, 0.024], [x, 0.65, -0.86]);
      for (const y of [0.32, 0.65, 0.98]) k.box('beam', [4.46, 0.022, 0.022], [0, y, -0.86]);
      for (const s of [-1, 1]) {
        k.box('frame', [0.14, 0.12, 1.25], [s * 2.3, 0.06, -0.3]);
        k.box('frame', [0.12, 0.1, 1.25], [s * 2.3, 1.24, -0.3]);
        k.box('frame', [0.2, 1.36, 0.2], [s * 2.3, 0.68, -0.86]);
        k.ball('lamp', 0.07, [s * 2.3, 1.43, -0.86]);
        // The front posts are slim: they stand beside the end figures.
        k.box('frame', [0.11, 1.3, 0.11], [s * 2.3, 0.65, 0.32]);
        k.ball('lamp', 0.06, [s * 2.3, 1.36, 0.32]);
        k.put('field', new THREE.PlaneGeometry(1.0, 1.1), [s * 2.3, 0.65, -0.27], [0, PI / 2, 0]);
        for (const z of [-0.52, -0.27, -0.02]) k.box('beam', [0.024, 1.1, 0.024], [s * 2.3, 0.65, z]);
        for (const y of [0.32, 0.98]) k.box('beam', [0.022, 0.022, 1.0], [s * 2.3, y, -0.27]);
      }
      // A low emitter strip along the open front: the edge of the field.
      k.box('beam', [4.6, 0.03, 0.05], [0, 0.015, 0.95]);
      k.put('field', new THREE.PlaneGeometry(4.6, 0.22), [0, 0.11, 0.95]);
    },
    tick(t, live) {
      const field = live.mats.field;
      if (field) field.opacity = 0.13 + 0.05 * Math.sin(t * 2.7) + 0.025 * Math.sin(t * 9.1);
      const beam = live.mats.beam;
      if (beam) beam.opacity = 0.72 + 0.18 * Math.sin(t * 5.3);
    },
  },

  /*
    Desert Dunes: a pueblo house. A mud wall under a flat roof, the
    roof's timber vigas poking out of the wall, three small windows
    barred with timber, and low mud walls down the sides.
  */
  adobeHut: {
    looks: (p) => ({
      platform: { color: p.platform, rough: 1 },
      adobe: { color: '#c99363', rough: 1 },
      shade: { color: '#a8744a', rough: 1 },
      timber: { color: p.bars, rough: 0.9 },
      gloom: { color: '#3a281b', rough: 1 },
    }),
    build(k) {
      platform(k);
      k.box('adobe', [4.9, 1.15, 0.34], [0, 0.575, -0.86]);
      k.box('adobe', [5.0, 0.14, 0.54], [0, 1.22, -0.77]);
      k.cyl('shade', 0.08, 0.08, 5.0, 6, [0, 1.3, -0.52], [0, 0, PI / 2]);
      for (const x of span(-2.0, 2.0, 9)) k.cyl('timber', 0.05, 0.05, 0.4, 6, [x, 1.05, -0.62], [PI / 2, 0, 0]);
      for (const x of [-1.45, 0, 1.45]) {
        k.box('gloom', [0.62, 0.46, 0.04], [x, 0.62, -0.68]);
        for (const b of span(-0.2, 0.2, 4)) k.cyl('timber', 0.03, 0.03, 0.52, 5, [x + b, 0.62, -0.66]);
        k.box('timber', [0.8, 0.08, 0.09], [x, 0.9, -0.655]);
        k.box('shade', [0.72, 0.05, 0.08], [x, 0.37, -0.66]);
      }
      for (const s of [-1, 1]) {
        k.box('adobe', [0.3, 0.82, 1.15], [s * 2.32, 0.41, -0.35]);
        k.cyl('adobe', 0.15, 0.15, 1.15, 8, [s * 2.32, 0.82, -0.35], [PI / 2, 0, 0]);
      }
    },
  },

  /*
    Autumn Woods: a log cabin, cut away at the front. Logs stacked with
    their pale cut ends showing at the corners, a shingled roof sloping
    off the back, a plank door, and leaves that have fallen on it.
  */
  logCabin: {
    looks: (p) => ({
      platform: { color: p.platform, rough: 0.95 },
      log: { color: '#8a5a33', rough: 0.9 },
      cut: { color: '#d0a774', rough: 0.9 },
      roof: { color: '#6a3a26', rough: 0.9 },
      line: { color: p.bars, rough: 0.9 },
      door: { color: '#a8743f', rough: 0.9 },
      leafA: { color: '#d9772b', rough: 0.9 },
      leafB: { color: '#b8442e', rough: 0.9 },
    }),
    build(k) {
      platform(k);
      for (const y of span(0.12, 1.06, 5)) {
        k.cyl('log', 0.12, 0.12, 5.0, 8, [0, y, -0.86], [0, 0, PI / 2]);
        for (const s of [-1, 1]) k.cyl('cut', 0.112, 0.112, 0.02, 8, [s * 2.51, y, -0.86], [0, 0, PI / 2]);
      }
      for (const s of [-1, 1]) {
        for (const y of span(0.235, 0.94, 4)) {
          k.cyl('log', 0.11, 0.11, 1.25, 8, [s * 2.36, y, -0.36], [PI / 2, 0, 0]);
          k.cyl('cut', 0.102, 0.102, 0.02, 8, [s * 2.36, y, 0.28], [PI / 2, 0, 0]);
        }
      }
      // A plank door with a dark frame, not a dark hole.
      k.box('line', [0.66, 0.9, 0.03], [0, 0.45, -0.735]);
      for (const x of span(-0.2, 0.2, 3)) k.box('door', [0.18, 0.82, 0.04], [x, 0.43, -0.72]);
      k.box('line', [0.6, 0.06, 0.05], [0, 0.6, -0.7]);
      // The roof slopes DOWN to the back, ridge forward: from this camera
      // the whole slope shows, and none of it is in front of a figure.
      const slope = Math.atan2(0.36, 0.62);
      k.box('roof', [5.1, 0.08, 0.76], [0, 1.3, -0.81], [-slope, 0, 0]);
      for (const f of [0.3, 0.6]) k.box('line', [5.1, 0.02, 0.03], [0, 1.47 - f * 0.36 + 0.05, -0.5 - f * 0.62], [-slope, 0, 0]);
      k.cyl('log', 0.09, 0.09, 5.15, 8, [0, 1.48, -0.5], [0, 0, PI / 2]);
      [[-1.9, -0.7], [-0.6, -0.85], [0.7, -0.62], [1.6, -0.9], [2.1, -0.7], [-1.2, -0.95]].forEach(([x, z], i) =>
        k.ball(i % 2 ? 'leafA' : 'leafB', 0.09, [x, 1.56 + (z + 0.5) * 0.58, z], [1, 0.25, 0.8], 8, [0, i, 0]),
      );
    },
  },

  /*
    Frozen Lights: an ice frame hung with icicles, snow lying on top of
    it. The ice carries a little of the aurora's glow, rising and
    falling slowly.
  */
  icicleCage: {
    looks: (p) => ({
      platform: { color: p.platform, rough: 0.9 },
      snow: { color: '#eef6fa', rough: 0.85 },
      ice: { color: '#a6e2f2', rough: 0.15, metal: 0.05, glow: '#40c8c0', glowAmount: 0.45, opacity: 0.9 },
      deep: { color: '#6cb6d8', rough: 0.2, glow: '#2f9fc0', glowAmount: 0.35, opacity: 0.92 },
    }),
    build(k) {
      platform(k);
      // Snow only along the rim: a white floor made pale icicles vanish.
      for (const z of [-1, 1]) k.box('snow', [PLATFORM_W + 0.06, 0.08, 0.16], [0, -0.03, z * (PLATFORM_D / 2 - 0.05)]);
      // The beams are ice too, with only a thin crust of snow: a thick
      // white top read as a garden bench, not a cage.
      k.box('ice', [4.75, 0.16, 0.18], [0, 1.25, -0.86]);
      k.box('snow', [4.8, 0.03, 0.1], [0, 1.345, -0.88]);
      span(-2.15, 2.15, 21).forEach((x, i) => {
        const len = 0.4 + 0.55 * (0.5 + 0.5 * Math.sin(i * 1.7)) + 0.12 * jit(i);
        k.cone('ice', 0.075 + 0.03 * jit(i + 40), len, 5, [x, 1.17 - len / 2, -0.86], [PI, 0, 0]);
      });
      for (const s of [-1, 1]) {
        k.box('ice', [0.18, 0.16, 1.2], [s * 2.32, 1.25, -0.3]);
        k.box('snow', [0.1, 0.03, 1.2], [s * 2.34, 1.345, -0.3]);
        for (const z of [-0.86, 0.28]) k.cyl('deep', 0.09, 0.13, 1.25, 6, [s * 2.32, 0.62, z]);
        span(-0.66, 0.1, 4).forEach((z, i) => {
          const len = 0.25 + 0.3 * jit(i + s * 7);
          k.cone('ice', 0.05, len, 5, [s * 2.32, 1.17 - len / 2, z], [PI, 0, 0]);
        });
        // Ice pushing up from the floor in the back corner.
        for (const [dx, h, tilt] of [[0, 0.7, 0.1], [0.18, 0.5, -0.25], [-0.16, 0.42, 0.3]] as const)
          k.cone('deep', 0.08, h, 5, [s * (2.05 + dx), h / 2, -0.66], [0, 0, s * tilt]);
      }
    },
    tick(t, live) {
      const ice = live.mats.ice;
      if (ice) std(ice).emissiveIntensity = 0.28 + 0.1 * Math.sin(t * 1.1);
      const deep = live.mats.deep;
      if (deep) std(deep).emissiveIntensity = 0.24 + 0.08 * Math.sin(t * 1.1 + 1.6);
    },
  },

  /*
    Crystal Cavern: a cage the cave grew. Shards of violet and teal
    crystal stand round the pen leaning outwards, in clusters at the
    corners, glowing and slowly pulsing out of step with each other.
  */
  crystalCage: {
    looks: (p) => ({
      platform: { color: p.platform, rough: 0.95 },
      rock: { color: '#3e3350', rough: 0.95 },
      amethyst: { color: '#b48cff', rough: 0.2, metal: 0.1, glow: '#7a4cff', glowAmount: 0.55, opacity: 0.92 },
      aqua: { color: '#8ae4ea', rough: 0.2, metal: 0.1, glow: '#2fbac6', glowAmount: 0.5, opacity: 0.92 },
    }),
    build(k) {
      platform(k);
      const shard = (mat: string, x: number, z: number, h: number, w: number, tx: number, tz: number, i: number) =>
        k.put(mat, new THREE.OctahedronGeometry(1, 0), [x, h * 0.42, z], [tx, jit(i) * 1.2, tz], [w, h / 2, w]);
      for (const x of span(-2.0, 2.0, 7)) k.put('rock', new THREE.DodecahedronGeometry(0.22, 0), [x, 0.04, -0.9], ZERO, [1.2, 0.6, 0.9]);
      span(-2.2, 2.2, 15).forEach((x, i) => {
        const h = 0.75 + 0.55 * (0.5 + 0.5 * Math.sin(i * 2.3));
        shard(i % 2 ? 'aqua' : 'amethyst', x, -0.84, h, 0.1 + 0.04 * jit(i), -0.15, 0.08 * Math.sin(i), i);
      });
      for (const s of [-1, 1]) {
        [-0.55, -0.2, 0.15].forEach((z, i) =>
          shard(i % 2 ? 'amethyst' : 'aqua', s * 2.3, z, 0.65 + 0.3 * jit(i + s * 5), 0.1, 0, -s * 0.2, i + 20),
        );
        for (const [dx, h, tz] of [[0, 1.35, 0.05], [0.16, 0.95, 0.35], [-0.12, 0.8, -0.3]] as const)
          shard('amethyst', s * (2.22 + dx), -0.86, h, 0.15, -0.1, -s * tz, 30 + dx * 10);
        shard('aqua', s * 2.12, 0.72, 0.45, 0.09, 0.2, -s * 0.25, 44);
      }
    },
    tick(t, live) {
      const a = live.mats.amethyst;
      if (a) std(a).emissiveIntensity = 0.5 + 0.18 * Math.sin(t * 1.6);
      const b = live.mats.aqua;
      if (b) std(b).emissiveIntensity = 0.45 + 0.15 * Math.sin(t * 1.6 + 2);
    },
  },

  /*
    Sky Kingdom: a golden birdcage. Half a dome of gold wire stands
    behind the row, its ribs meeting under a ring at the top — which is
    how a birdcage looks from above, and above is where this camera is.
    The front half is left off so the figures are not seen through wire.
  */
  birdcage: {
    looks: (p) => ({
      platform: { color: p.platform, rough: 0.9 },
      gold: { color: '#e2b44c', metal: 0.7, rough: 0.3 },
      cloud: { color: '#fbfdff', rough: 1 },
    }),
    build(k) {
      platform(k);
      const cz = -0.36;
      const rx = 2.45;
      const ry = 1.38;
      const rz = 0.62;
      for (const th of span(0, PI, 13)) {
        const pts: V3[] = span(0, PI / 2, 7).map((ph) => [rx * Math.cos(th) * Math.cos(ph), ry * Math.sin(ph), cz - rz * Math.sin(th) * Math.cos(ph)]);
        k.tube('gold', pts, 0.022, 10);
      }
      for (const y of [0.04, 0.42, 0.85, 1.15]) {
        const c = Math.cos(Math.asin(y / ry));
        const pts: V3[] = span(0, PI, 15).map((th) => [rx * c * Math.cos(th), y, cz - rz * c * Math.sin(th)]);
        k.tube('gold', pts, y < 0.1 ? 0.04 : 0.018, 24);
      }
      k.ring('gold', 0.17, 0.035, [0, 1.6, cz], ZERO, PI * 2, 16);
      k.ball('gold', 0.1, [0, 1.4, cz]);
      // A low run of bars along the open front. Anything up to about 1.0
      // here draws BELOW the figures on screen, so it cages them without
      // crossing them — and a birdcage needs its bars.
      for (const x of span(-2.4, 2.4, 25)) k.cyl('gold', 0.016, 0.016, 0.5, 4, [x, 0.25, 0.88]);
      k.box('gold', [4.85, 0.04, 0.04], [0, 0.5, 0.88]);
      // And a swing, hung behind the row.
      for (const x of [-0.28, 0.28]) k.cyl('gold', 0.008, 0.008, 0.62, 4, [x, 1.02, -0.72]);
      k.cyl('gold', 0.02, 0.02, 0.6, 6, [0, 0.71, -0.72], [0, 0, PI / 2]);
      for (const s of [-1, 1]) {
        k.box('gold', [0.06, 0.06, PLATFORM_D + 0.04], [s * (PLATFORM_W / 2 + 0.01), 0.0, 0]);
        for (const [x, y, z, r] of [[2.55, -0.3, -0.6, 0.4], [2.6, -0.42, 0.25, 0.34], [2.3, -0.45, -1.05, 0.36]] as const)
          k.ball('cloud', r, [s * x, y, z], [1, 0.62, 0.8], 10);
      }
      k.box('gold', [PLATFORM_W + 0.04, 0.06, 0.06], [0, 0.0, PLATFORM_D / 2 + 0.01]);
    },
  },

  /*
    Moon Base: an airlock pod. A ribbed white hull curving over the back
    of the pen, a round hatch with a wheel in the middle of it, a
    porthole each side, hazard stripes on the lip and a pair of status
    lights — the red one blinks.
  */
  airlockPod: {
    looks: (p) => ({
      platform: { color: p.platform, rough: 0.6, metal: 0.3 },
      hull: { color: '#cfd3db', rough: 0.45, metal: 0.35, twoSided: true },
      rib: { color: p.bars, rough: 0.4, metal: 0.5 },
      hazard: { color: '#e0b03c', rough: 0.6 },
      stripe: { color: '#2a2c33', rough: 0.6 },
      glass: { color: '#9fdcff', rough: 0.1, metal: 0.2 },
      go: { color: '#7dffb0', unlit: true },
      stop: { color: '#ff7a6b', unlit: true },
    }),
    build(k) {
      platform(k);
      const cz = -0.35;
      const sy = 1.25;
      const sz = 0.62;
      k.put('hull', new THREE.CylinderGeometry(1, 1, 3.7, 14, 1, true, PI / 2, PI / 2).rotateZ(PI / 2).scale(1, sy, sz), [0, 0, cz]);
      for (const s of [-1, 1]) {
        const phi = s > 0 ? PI : PI * 1.5;
        k.put('hull', new THREE.SphereGeometry(1, 8, 6, phi, PI / 2, 0, PI / 2).scale(0.6, sy, sz), [s * 1.85, 0, cz]);
        k.cyl('glass', 0.13, 0.13, 0.03, 12, [s * 1.2, 0.72, -0.8], [PI / 2, 0, 0]);
        k.ring('rib', 0.15, 0.03, [s * 1.2, 0.72, -0.78], ZERO, PI * 2, 14);
      }
      for (const x of [-1.85, -0.9, 0.9, 1.85])
        k.put('rib', new THREE.TorusGeometry(1, 0.03, 5, 12, PI / 2).rotateY(PI / 2).scale(1, sy, sz), [x, 0, cz]);
      // The hatch, and its wheel.
      k.cyl('rib', 0.36, 0.36, 0.06, 18, [0, 0.55, -0.8], [PI / 2, 0, 0]);
      k.ring('hazard', 0.4, 0.05, [0, 0.55, -0.77], ZERO, PI * 2, 20);
      k.ring('stripe', 0.17, 0.025, [0, 0.55, -0.75], ZERO, PI * 2, 14);
      for (const r of [PI / 4, -PI / 4]) k.box('stripe', [0.36, 0.035, 0.02], [0, 0.55, -0.75], [0, 0, r]);
      span(-2.3, 2.3, 16).forEach((x, i) => k.box(i % 2 ? 'stripe' : 'hazard', [0.29, 0.04, 0.12], [x, 0.0, 0.93]));
      k.ball('go', 0.06, [-1.4, 1.27, cz]);
      k.in('beacon');
      k.ball('stop', 0.06, [1.4, 1.27, cz]);
      k.in('base');
    },
    tick(t, live) {
      const b = live.layers.beacon;
      if (b) b.visible = Math.sin(t * 3.4) > -0.2;
    },
  },

  /*
    Snowy Hollow: an igloo, cut away at the front so the prisoners can
    be seen inside it. Block seams in courses, a thick rim round the
    cut, drifts at its foot and a few snowballs ready.
  */
  igloo: {
    looks: (p) => ({
      platform: { color: p.platform, rough: 0.9 },
      snow: { color: '#eef4f9', rough: 0.85 },
      hollow: { color: '#b4cadc', rough: 0.9, inside: true },
      rim: { color: '#fbfdff', rough: 0.8 },
      seam: { color: '#7d9cb8', rough: 0.9 },
      drift: { color: '#eef4f8', rough: 0.9 },
    }),
    build(k) {
      // The floor stays the board's blue-grey: on white, a white igloo
      // was not there at all.
      platform(k);
      // Deep rather than tall: from nearly overhead an igloo is its
      // rings of blocks seen from above, so the dome reaches back well
      // past the platform (a snowbank carries it) and stays low.
      k.box('drift', [PLATFORM_W, FLOOR, 0.6], [0, -FLOOR / 2, -1.28]);
      const cz = -0.45;
      const rx = 2.45;
      const ry = 1.2;
      const rz = 1.15;
      // One dome, two materials: white outside, shaded blue inside, so
      // the hollow the figures stand in reads as a hollow.
      k.put('snow', new THREE.SphereGeometry(1, 20, 8, PI, PI, 0, PI / 2).scale(rx, ry, rz), [0, 0, cz]);
      k.put('hollow', new THREE.SphereGeometry(1, 20, 8, PI, PI, 0, PI / 2).scale(rx, ry, rz), [0, 0, cz]);
      k.tube('rim', span(0, PI, 17).map((a) => [rx * Math.cos(a), ry * Math.sin(a), cz] as V3), 0.09, 32);
      // Courses of blocks: rings, with the joints staggered between them.
      // On the OUTSIDE of the dome: from this camera, nearly overhead,
      // the top of the dome is what shows, far more than its inside.
      const courses = [0, 0.3, 0.58, 0.84, 1.04];
      for (const face of [1.012, 0.985]) courses.forEach((y, ci) => {
        const c = Math.cos(Math.asin(Math.min(0.99, y / ry))) * face;
        if (ci > 0) k.tube('seam', span(0, PI, 15).map((a) => [rx * c * Math.cos(a), y, cz - rz * c * Math.sin(a)] as V3), 0.028, 24);
        if (ci === courses.length - 1) return;
        const y2 = courses[ci + 1];
        const n = 7 - ci;
        for (let j = 0; j < n; j++) {
          const a = (PI * (j + (ci % 2 ? 0.5 : 1))) / (n + (ci % 2 ? 0 : 1));
          const pt = (yy: number): V3 => {
            const cc = Math.cos(Math.asin(Math.min(0.99, yy / ry))) * face;
            return [rx * cc * Math.cos(a), yy, cz - rz * cc * Math.sin(a)];
          };
          k.tube('seam', [pt(y), pt((y + y2) / 2), pt(y2)], 0.024, 3);
        }
      });
      for (const s of [-1, 1]) {
        k.ball('drift', 0.3, [s * 2.45, 0.02, -0.25], [1, 0.45, 1.3], 10);
        for (const [dx, y, dz] of [[0, 0.11, 0], [0.22, 0.11, 0.05], [0.1, 0.3, 0.02]] as const)
          k.ball('rim', 0.11, [s * (1.98 + dx), y, 0.62 + dz], ONE, 8);
      }
    },
  },

  /*
    Volcano Rim: obsidian — black glassy bars, each with a point, two
    cross-bars set slightly askew, and embers glowing at the foot of
    every bar and along the platform's seams. The embers breathe.
  */
  obsidianCage: {
    looks: (p) => ({
      platform: { color: p.platform, rough: 0.9 },
      glass: { color: '#2a2233', metal: 0.3, rough: 0.12 },
      sheen: { color: '#4a3a58', metal: 0.3, rough: 0.2 },
      ember: { color: '#5a1c10', glow: '#ff5a1f', glowAmount: 1.3, rough: 0.8 },
    }),
    build(k) {
      platform(k);
      k.box('ember', [PLATFORM_W + 0.02, 0.03, 0.05], [0, -0.005, PLATFORM_D / 2]);
      k.box('ember', [4.4, 0.04, 0.2], [0, 0.0, -0.72]);
      // Each bar is a knapped blade of volcanic glass: a stretched
      // octahedron, uneven in height and lean, with a splinter at its
      // foot — struck from rock, not forged.
      const bar = (x: number, z: number, h: number, i: number) => {
        const lean = 0.09 * Math.sin(i * 2.1);
        k.put('glass', new THREE.OctahedronGeometry(1, 0), [x, h * 0.48, z], [0, PI / 4 + 0.3 * jit(i), lean], [0.13 + 0.05 * jit(i + 3), h / 2, 0.09]);
        k.put('sheen', new THREE.OctahedronGeometry(1, 0), [x + 0.09, 0.2, z + 0.03], [0, jit(i + 7), -0.35], [0.06, 0.24, 0.05]);
        k.ball('ember', 0.085, [x, 0.03, z + 0.08], [1, 0.5, 1], 6);
      };
      span(-2.2, 2.2, 12).forEach((x, i) => bar(x, -0.84, 0.95 + 0.4 * jit(i), i));
      for (const [y, r] of [[0.32, 0.04], [0.92, -0.035]] as const) k.box('sheen', [4.6, 0.09, 0.08], [0, y, -0.79], [0.1, 0, r]);
      for (const s of [-1, 1]) {
        [-0.5, -0.15, 0.2].forEach((z, i) => bar(s * 2.3, z, 0.8 + 0.2 * jit(i + s * 9), i + 20 + s));
        k.box('sheen', [0.09, 0.1, 1.15], [s * 2.3, 0.85, -0.3], [0.03 * s, 0, 0]);
        k.box('ember', [0.05, 0.03, PLATFORM_D], [s * PLATFORM_W / 2, -0.005, 0]);
      }
    },
    tick(t, live) {
      const e = live.mats.ember;
      if (e) std(e).emissiveIntensity = 1.2 + 0.45 * Math.sin(t * 2.1) + 0.2 * Math.sin(t * 5.3);
    },
  },

  /*
    Sunny Farm: a red chicken coop. A gable end with white trim and a
    round window, a shingled roof, a ramp down from the hatch, straw on
    the floor, chicken wire round the open sides — and a hen on the roof.
  */
  chickenCoop: {
    looks: (p) => ({
      platform: { color: p.platform, rough: 0.95 },
      straw: { color: '#e2c46c', rough: 1 },
      red: { color: '#b5443b', rough: 0.8 },
      trim: { color: '#f2ede3', rough: 0.7 },
      roof: { color: '#5e4b40', rough: 0.85 },
      wood: { color: '#9c7448', rough: 0.9 },
      wire: { color: '#d0d5da', metal: 0.4, rough: 0.5 },
      gloom: { color: p.bars, rough: 1 },
      hen: { color: '#f7f3ea', rough: 0.8 },
      comb: { color: '#d2453a', rough: 0.7 },
      beak: { color: '#e8a33a', rough: 0.7 },
    }),
    build(k) {
      platform(k);
      k.box('straw', [4.7, 0.03, 1.8], [0, 0.0, 0]);
      k.box('red', [4.9, 0.95, 0.26], [0, 0.475, -0.87]);
      k.box('trim', [4.96, 0.07, 0.05], [0, 0.95, -0.73]);
      // The gable: a triangular prism, apex up.
      k.put('red', new THREE.CylinderGeometry(1, 1, 0.26, 3).rotateX(-PI / 2).scale(1.386, 0.25, 1), [0, 1.075, -0.87]);
      const pitch = Math.atan2(0.375, 1.2);
      for (const s of [-1, 1]) {
        k.box('trim', [0.07, 0.95, 0.05], [s * 2.42, 0.475, -0.73]);
        k.box('roof', [1.36, 0.06, 0.34], [s * 0.6, 1.17, -0.86], [0, 0, -s * pitch]);
        k.box('trim', [1.32, 0.05, 0.04], [s * 0.6, 1.13, -0.725], [0, 0, -s * pitch]);
        k.box('roof', [1.32, 0.06, 0.4], [s * 1.86, 1.0, -0.92], [0.12, 0, 0]);
        // Chicken wire: a diamond lattice down each open side.
        for (const z of span(-0.7, 0.3, 6))
          for (const r of [0.75, -0.75]) k.box('wire', [0.012, 0.012, 0.3], [s * 2.3, 0.3, z], [r, 0, 0]);
        for (const y of [0.05, 0.58]) k.box('wire', [0.015, 0.015, 1.1], [s * 2.3, y, -0.2]);
        k.box('trim', [0.06, 0.62, 0.06], [s * 2.3, 0.31, 0.3]);
      }
      k.ring('trim', 0.11, 0.028, [0, 1.11, -0.735], ZERO, PI * 2, 16);
      k.cyl('gloom', 0.1, 0.1, 0.02, 14, [0, 1.11, -0.74], [PI / 2, 0, 0]);
      // The hatch with its X brace, and the ramp down from it.
      k.box('wood', [0.42, 0.55, 0.03], [0, 0.3, -0.73]);
      for (const r of [0.65, -0.65]) k.box('trim', [0.05, 0.66, 0.02], [0, 0.3, -0.71], [0, 0, r]);
      k.box('wood', [0.36, 0.03, 0.5], [0, 0.12, -0.48], [0.5, 0, 0]);
      for (const f of [0.25, 0.5, 0.75]) k.box('roof', [0.36, 0.025, 0.03], [0, 0.24 - f * 0.24 + 0.02, -0.7 + f * 0.44]);
      // The hen.
      k.ball('hen', 0.11, [-1.8, 1.12, -0.88], [1.25, 0.9, 0.9], 10);
      k.ball('hen', 0.065, [-1.66, 1.22, -0.85], ONE, 8);
      k.cone('comb', 0.03, 0.06, 5, [-1.66, 1.3, -0.85]);
      k.cone('beak', 0.02, 0.05, 4, [-1.6, 1.22, -0.83], [0, 0, -PI / 2]);
    },
  },

  /*
    Treasure Beach: the prisoners are kept in a treasure chest, standing
    on its gold. A shallow chest on the sand, gold banded, its domed lid
    thrown back to show the red lining, with a heap of coins and gems in
    each back corner.

    The chest is only as deep as the row of figures needs. A lid as
    deep as the whole pen would stand twice as high as anything the
    picture has room for.
  */
  treasureChest: {
    looks: (p) => ({
      platform: { color: p.platform, rough: 1 },
      wood: { color: '#7a4a26', rough: 0.8 },
      gold: { color: '#e3b23c', metal: 0.65, rough: 0.3 },
      coins: { color: '#f2c94c', metal: 0.5, rough: 0.35 },
      velvet: { color: '#8a2534', rough: 0.9 },
      gemA: { color: '#d64a5c', metal: 0.2, rough: 0.2 },
      gemB: { color: '#3fb58a', metal: 0.2, rough: 0.2 },
      gemC: { color: '#4a8fd6', metal: 0.2, rough: 0.2 },
    }),
    build(k) {
      platform(k, 'platform', -0.25);
      for (const z of [-0.5, 0.5]) {
        k.box('wood', [4.9, 0.55, 0.1], [0, 0.025, z]);
        k.box('gold', [4.96, 0.06, 0.13], [0, 0.31, z]);
        for (const x of [-1.62, 1.62]) k.box('gold', [0.1, 0.57, 0.13], [x, 0.025, z]);
      }
      for (const s of [-1, 1]) {
        k.box('wood', [0.1, 0.55, 1.1], [s * 2.4, 0.025, 0]);
        k.box('gold', [0.13, 0.06, 1.1], [s * 2.4, 0.31, 0]);
        k.ball('coins', 0.2, [s * 2.22, 0.0, -0.3], [1, 0.6, 0.85], 10);
        k.put(s > 0 ? 'gemA' : 'gemB', new THREE.OctahedronGeometry(0.07, 0), [s * 2.2, 0.14, -0.3]);
        k.put('gemC', new THREE.OctahedronGeometry(0.06, 0), [s * 2.28, 0.09, -0.16]);
      }
      k.box('coins', [4.7, 0.04, 0.9], [0, -0.02, 0]);
      [0, -0.72, 0.72, -1.44, 1.44].forEach((x, i) => {
        for (const z of [-0.3, 0.3]) k.cyl('coins', 0.07, 0.07, 0.02, 8, [x + 0.05 * jit(i), 0.02, z], [0.3 * jit(i + 3), 0, 0.3]);
      });
      // The lid, hinged along the back of the chest and thrown back.
      k.in('lid', [0, 0.3, -0.5], [-1.85, 0, 0]);
      k.put('wood', new THREE.CylinderGeometry(0.5, 0.5, 4.9, 12, 1, false, 0, PI).rotateZ(PI / 2), [0, 0, 0.5]);
      // The underside is what faces the camera once the lid is back: a
      // wooden frame round a red lining, crossed by the gold straps.
      k.box('velvet', [4.4, 0.02, 0.7], [0, -0.012, 0.5]);
      for (const x of [-1.62, 1.62, -0.55, 0.55]) {
        k.put('gold', new THREE.CylinderGeometry(0.52, 0.52, 0.1, 12, 1, true, 0, PI).rotateZ(PI / 2), [x, 0, 0.5]);
        k.box('gold', [0.1, 0.03, 1.0], [x, -0.02, 0.5]);
      }
      k.box('gold', [4.92, 0.05, 0.05], [0, -0.01, 0.99]);
      k.box('gold', [0.3, 0.05, 0.22], [0, -0.025, 0.9]);
      for (const x of [-2.2, -1.1, 1.1, 2.2]) k.ball('gold', 0.04, [x, -0.03, 0.9], ONE, 6);
      k.in('base');
    },
  },

  /*
    Candy Meadow: a gingerbread house. Gingerbread walls piped with
    icing, a frosted roof dotted with sweets and gumdrops on the ridge,
    warm windows and a door, and a candy cane at each front corner.
  */
  gingerbread: {
    looks: (p) => ({
      platform: { color: p.platform, rough: 0.6 },
      ginger: { color: '#a9652f', rough: 0.85 },
      dark: { color: '#7a451f', rough: 0.85 },
      icing: { color: '#fbf4ea', rough: 0.55 },
      pink: { color: '#f08fb5', rough: 0.5 },
      mint: { color: '#6fd3a8', rough: 0.5 },
      lemon: { color: '#f3cf5a', rough: 0.5 },
      cane: { color: '#d9485a', rough: 0.4 },
      pane: { color: '#ffd98a', rough: 0.4 },
    }),
    build(k) {
      platform(k);
      for (const z of [-1, 1]) k.box('icing', [PLATFORM_W + 0.04, 0.05, 0.08], [0, -0.02, z * PLATFORM_D / 2]);
      for (const x of span(-2.35, 2.35, 21)) k.ball('icing', 0.08, [x, -0.06, PLATFORM_D / 2 + 0.02], [1, 1.4, 0.6], 8);
      k.box('ginger', [4.9, 0.85, 0.22], [0, 0.425, -0.88]);
      k.cyl('icing', 0.045, 0.045, 4.9, 6, [0, 0.86, -0.77], [0, 0, PI / 2]);
      for (const x of span(-2.3, 2.3, 19)) k.ball('icing', 0.035, [x, 0.08, -0.765], ONE, 6);
      for (const x of [-1.45, 1.45]) {
        k.box('pane', [0.5, 0.4, 0.03], [x, 0.48, -0.765]);
        for (const y of [0.27, 0.69]) k.box('icing', [0.6, 0.05, 0.04], [x, y, -0.75]);
        for (const dx of [-0.28, 0, 0.28]) k.box('icing', [0.05, 0.46, 0.04], [x + dx, 0.48, -0.75]);
      }
      k.box('dark', [0.55, 0.62, 0.03], [0, 0.31, -0.76]);
      k.tube('icing', span(0, PI, 9).map((a) => [0.3 * Math.cos(a), 0.62 + 0.12 * Math.sin(a), -0.745] as V3), 0.03, 12);
      k.ball('mint', 0.05, [0.17, 0.3, -0.74]);
      const slope = Math.atan2(0.39, 0.6);
      k.box('ginger', [5.1, 0.1, 0.76], [0, 1.06, -0.85], [-slope, 0, 0]);
      k.box('icing', [5.12, 0.04, 0.74], [0, 1.115, -0.83], [-slope, 0, 0]);
      for (const x of span(-2.4, 2.4, 17)) k.ball('icing', 0.07, [x, 1.2, -0.53], [1, 1.4, 0.8], 8);
      const sweets = ['pink', 'mint', 'lemon'];
      [0.32, 0.68].forEach((f, row) =>
        span(-2.1 + row * 0.3, 2.1 - row * 0.3, 8 - row).forEach((x, i) =>
          k.ball(sweets[(i + row) % 3], 0.06, [x, 1.25 - f * 0.39 + 0.07, -0.55 - f * 0.6], [1, 0.6, 1], 8),
        ),
      );
      span(-2.0, 2.0, 6).forEach((x, i) => k.ball(sweets[i % 3], 0.1, [x, 1.3, -0.6], [1, 0.9, 1], 10));
      for (const s of [-1, 1]) {
        const x = s * 2.3;
        const z = 0.3;
        k.cyl('icing', 0.06, 0.06, 1.0, 8, [x, 0.5, z]);
        for (const y of [0.12, 0.32, 0.52, 0.72, 0.92]) k.cyl('cane', 0.064, 0.064, 0.07, 8, [x, y, z], [0, 0, 0.35]);
        k.ring('icing', 0.14, 0.06, [x - s * 0.14, 1.0, z], [0, s > 0 ? 0 : PI, 0], PI, 10);
      }
    },
  },

  /*
    Glow Glade: a cage of willow roots, woven — two families of roots
    leaning opposite ways and passing in front of and behind each other
    — with glowing spores caught in the weave and small glowing caps
    at the corners. The glow breathes slowly.
  */
  willowCage: {
    looks: (p) => ({
      platform: { color: p.platform, rough: 1 },
      root: { color: '#5d4a35', rough: 1 },
      rootLight: { color: '#7b6447', rough: 1 },
      moss: { color: '#3d7a4c', rough: 1 },
      spore: { color: '#c8ffb0', glow: '#8cff9a', glowAmount: 0.9, rough: 0.6 },
    }),
    build(k) {
      platform(k);
      // Weave along a straight edge from a to b (in x or z), at height 0..h.
      const weave = (along: 'x' | 'z', fixed: number, from: number, to: number, n: number, h: number, seed: number) => {
        const step = (to - from) / n;
        for (let i = -1; i <= n; i++) {
          for (const dir of [-1, 1]) {
            const pts: V3[] = [];
            for (let j = 0; j <= 4; j++) {
              const t = j / 4;
              const a = Math.min(to, Math.max(from, from + step * (i + 0.5) + dir * (t - 0.5) * step * 1.6));
              const bulge = 0.05 * Math.sin(t * PI * 3 + (dir > 0 ? 0 : PI) + i);
              pts.push(along === 'x' ? [a, t * h, fixed + bulge] : [fixed + bulge, t * h, a]);
            }
            k.tube((i + dir + seed) % 2 ? 'root' : 'rootLight', pts, 0.034, 8);
          }
        }
      };
      weave('x', -0.86, -2.3, 2.3, 7, 1.2, 0);
      for (const s of [-1, 1]) {
        weave('z', s * 2.3, -0.86, 0.3, 2, 1.0, 1);
        // A braided rim along the top, and a root arching over the corner.
        k.tube('root', [[s * 2.3, 1.0, 0.3], [s * 2.32, 1.12, -0.3], [s * 2.3, 1.2, -0.86], [s * 1.2, 1.22, -0.88], [0, 1.2, -0.86]], 0.05, 20);
        k.tube('rootLight', [[s * 2.4, 0, 0.35], [s * 2.25, 0.9, -0.3], [s * 1.7, 1.42, -0.75], [s * 0.9, 1.3, -0.9]], 0.045, 16);
        for (const [x, z] of [[2.1, 0.62], [2.25, -0.95], [0.6, -1.0]] as const) {
          k.cyl('rootLight', 0.025, 0.035, 0.16, 5, [s * x, 0.08, z]);
          k.ball('spore', 0.08, [s * x, 0.17, z], [1, 0.5, 1], 8);
        }
        for (const z of [-0.9, 0.1]) k.ball('moss', 0.22, [s * 2.4, -0.02, z], [1.1, 0.35, 1.6], 8);
      }
      for (const x of span(-2.0, 2.0, 5)) k.ball('moss', 0.22, [x, -0.02, -0.95], [1.6, 0.35, 0.8], 8);
      [[-1.9, 0.5], [-1.2, 0.95], [-0.5, 0.35], [0.3, 0.8], [1.0, 0.6], [1.7, 1.05], [2.0, 0.3], [-2.3, 0.75], [2.3, 0.55]].forEach(([x, y], i) =>
        k.ball('spore', 0.055, [x, y, Math.abs(x) > 2.2 ? -0.2 - 0.3 * jit(i) : -0.8], ONE, 6),
      );
    },
    tick(t, live) {
      const s = live.mats.spore;
      if (s) std(s).emissiveIntensity = 0.8 + 0.35 * Math.sin(t * 1.4);
    },
  },

  /*
    Pirate Cove: the brig below decks. A planked bulkhead under a heavy
    beam, square iron bars with riveted bands in front of it and down
    the sides, a padlock, deck planks underfoot and a lantern hanging
    from the beam, swinging with the ship.
  */
  brig: {
    looks: (p) => ({
      platform: { color: p.platform, rough: 0.9 },
      plank: { color: '#6e4c2f', rough: 0.9 },
      dark: { color: '#46301d', rough: 0.9 },
      seam: { color: p.bars, rough: 0.9 },
      iron: { color: '#35373c', metal: 0.6, rough: 0.4 },
      brass: { color: '#c9a04a', metal: 0.6, rough: 0.35 },
      flame: { color: '#ffc56e', unlit: true },
    }),
    build(k) {
      platform(k);
      for (const z of span(-0.6, 0.6, 5)) k.box('seam', [4.7, 0.012, 0.025], [0, 0.004, z]);
      k.box('plank', [4.9, 1.2, 0.18], [0, 0.6, -0.9]);
      for (const y of [0.3, 0.6, 0.9]) k.box('seam', [4.9, 0.025, 0.02], [0, y, -0.805]);
      k.box('dark', [5.0, 0.18, 0.22], [0, 1.27, -0.82]);
      for (const x of span(-2.1, 2.1, 15)) {
        k.box('iron', [0.06, 1.16, 0.06], [x, 0.58, -0.66]);
        k.ball('iron', 0.03, [x, 0.62, -0.62], ONE, 6);
      }
      for (const y of [0.12, 0.62, 1.1]) k.box('iron', [4.4, 0.07, 0.05], [0, y, -0.64]);
      for (const s of [-1, 1]) {
        k.box('dark', [0.1, 0.55, 0.1], [s * 2.25, 0.98, -0.72], [0, 0, s * 0.6]);
        for (const z of span(-0.5, 0.3, 5)) k.box('iron', [0.06, 1.0, 0.06], [s * 2.3, 0.5, z]);
        for (const y of [0.12, 0.95]) k.box('iron', [0.05, 0.07, 1.2], [s * 2.3, y, -0.25]);
      }
      k.box('brass', [0.06, 0.16, 0.14], [2.36, 0.55, -0.1]);
      k.ring('iron', 0.055, 0.014, [2.36, 0.66, -0.1], [0, PI / 2, 0], PI, 8);
      k.in('lamp', [0, 1.18, -0.55]);
      k.cyl('iron', 0.01, 0.01, 0.16, 4, [0, -0.08, 0]);
      k.cone('brass', 0.1, 0.08, 6, [0, -0.2, 0]);
      k.cyl('flame', 0.065, 0.065, 0.16, 6, [0, -0.32, 0]);
      for (const a of [0, 1, 2, 3]) k.box('brass', [0.015, 0.17, 0.015], [0.07 * Math.cos(a * PI / 2 + PI / 4), -0.32, 0.07 * Math.sin(a * PI / 2 + PI / 4)]);
      k.cyl('brass', 0.09, 0.09, 0.03, 6, [0, -0.415, 0]);
      k.in('base');
    },
    tick(t, live) {
      const l = live.layers.lamp;
      if (l) l.rotation.z = 0.08 * Math.sin(t * 1.3);
    },
  },

  /*
    Coral Reef: a giant clam. The prisoners stand on its mantle inside
    the scalloped lip of the lower shell; the upper shell stands open
    behind them, ribbed outside, lined inside, and a pearl sits at the
    back. The clam breathes — the shell eases open and shut a little.
  */
  giantClam: {
    looks: (p) => ({
      platform: { color: p.platform, rough: 0.95 },
      shell: { color: '#f2e2d2', rough: 0.5, twoSided: true },
      rib: { color: '#cfa78f', rough: 0.6 },
      mantle: { color: '#3fa9a8', rough: 0.5, twoSided: true },
      spot: { color: '#8fe6d6', rough: 0.5 },
      pearl: { color: '#f7f2ff', rough: 0.15, metal: 0.25 },
    }),
    build(k) {
      platform(k);
      k.put('mantle', new THREE.CircleGeometry(1, 28).rotateX(-PI / 2).scale(2.36, 1, 0.88), [0, 0.012, 0]);
      span(0, PI * 2, 27).slice(0, 26).forEach((a, i) => {
        k.ball('shell', 0.17, [2.42 * Math.cos(a), 0.04, 0.92 * Math.sin(a)], [1, 0.5, 1], 8, [0, -a, 0]);
        if (i % 2) k.ball('spot', 0.05, [1.9 * Math.cos(a), 0.02, 0.66 * Math.sin(a)], [1, 0.3, 1], 6);
      });
      k.ball('pearl', 0.15, [0, 0.15, -0.62], ONE, 14);
      // The upper shell, built closed over the pen and then swung open on
      // its hinge along the back.
      k.in('lid', [0, 0.06, -0.92], [-1.45, 0, 0]);
      k.put('shell', new THREE.SphereGeometry(1, 22, 6, 0, PI * 2, 0, PI / 2).scale(2.4, 0.38, 0.62), [0, 0, 0.62]);
      // What faces the camera is the INSIDE of the shell, so the ribs are
      // laid just inside its surface and fan out from the hinge, the way
      // a clam's do.
      const inside = (x: number, z: number): V3 => {
        const u = 1 - (x / 2.4) ** 2 - ((z - 0.62) / 0.62) ** 2;
        return [x, 0.38 * Math.sqrt(Math.max(0, u)) * 0.93 - 0.012, z];
      };
      for (const a of span(0.12, PI - 0.12, 11)) {
        const rim: V3 = [2.36 * Math.cos(a), 0, 0.62 + 0.6 * Math.sin(a)];
        k.tube('rib', span(0.04, 1, 6).map((t) => inside(rim[0] * t, rim[2] * t)), 0.03, 8);
      }
      // The giant clam's coloured lip, round the inside of the rim.
      k.tube('mantle', span(0.05, PI - 0.05, 19).map((a) => [2.26 * Math.cos(a), 0.02, 0.62 + 0.56 * Math.sin(a)] as V3), 0.06, 36);
      span(0, PI, 13).forEach((a) => k.ball('shell', 0.13, [2.4 * Math.cos(a), 0.0, 0.62 + 0.62 * Math.sin(a)], [1, 0.5, 1], 8, [0, -a, 0]));
      k.in('base');
    },
    tick(t, live) {
      const lid = live.layers.lid;
      if (lid) lid.rotation.x = -1.45 + 0.06 * Math.sin(t * 1.1);
    },
  },

  /*
    Rooftop City: a fire-escape landing. A brick wall with two lit
    windows and a ladder up it, a slatted steel floor, and a railing of
    thin balusters round the open sides.
  */
  fireEscape: {
    looks: (p) => ({
      platform: { color: p.platform, rough: 0.9 },
      steel: { color: p.bars, metal: 0.55, rough: 0.45 },
      brick: { color: '#9c4c3c', rough: 0.95 },
      mortar: { color: '#cbb8a4', rough: 1 },
      frame: { color: '#d9d4cb', rough: 0.7 },
      lit: { color: '#f6cf7e', rough: 0.5 },
    }),
    build(k) {
      platform(k);
      for (const z of span(-0.75, 0.75, 11)) k.box('steel', [4.7, 0.025, 0.06], [0, 0.0, z]);
      k.box('brick', [4.9, 1.32, 0.2], [0, 0.66, -0.9]);
      span(0.22, 1.1, 5).forEach((y, row) => {
        k.box('mortar', [4.9, 0.02, 0.012], [0, y, -0.797]);
        for (const x of span(-2.2 + (row % 2) * 0.22, 2.2, 10)) k.box('mortar', [0.016, 0.22, 0.012], [x, y - 0.11, -0.797]);
      });
      for (const x of [-1.2, 1.2]) {
        k.box('frame', [0.62, 0.56, 0.04], [x, 0.66, -0.79]);
        k.box('lit', [0.5, 0.44, 0.04], [x, 0.66, -0.775]);
        k.box('frame', [0.03, 0.44, 0.05], [x, 0.66, -0.77]);
        k.box('frame', [0.5, 0.03, 0.05], [x, 0.7, -0.77]);
        k.box('frame', [0.7, 0.05, 0.1], [x, 0.36, -0.76]);
      }
      // A ladder up the wall to the roof.
      for (const x of [-2.05, -1.8]) k.box('steel', [0.03, 1.3, 0.03], [x, 0.65, -0.74]);
      for (const y of span(0.15, 1.2, 7)) k.box('steel', [0.25, 0.02, 0.02], [-1.925, y, -0.74]);
      // The railing.
      const rail = (len: number, pos: V3, alongZ: boolean) => {
        for (const y of [0.42, 0.85]) k.box('steel', alongZ ? [0.04, 0.04, len] : [len, 0.04, 0.04], [pos[0], y, pos[2]]);
        for (const a of span(-len / 2, len / 2, Math.round(len / 0.2) + 1))
          k.box('steel', [0.022, 0.85, 0.022], alongZ ? [pos[0], 0.425, pos[2] + a] : [pos[0] + a, 0.425, pos[2]]);
      };
      rail(4.4, [0, 0, 0.86], false);
      for (const s of [-1, 1]) rail(1.66, [s * 2.2, 0, 0.03], true);
    },
  },

  /*
    Toy Room: a painted toy chest, its flat lid propped open and spotted
    with dots, building blocks and a ball tumbling out of the back
    corners. Paint and toys where the beach chest has gold and wood.
  */
  toyChest: {
    looks: (p) => ({
      platform: { color: p.platform, rough: 0.9 },
      paint: { color: '#5fb8c4', rough: 0.55 },
      lid: { color: '#f2a65a', rough: 0.55 },
      trim: { color: '#fff2d6', rough: 0.6 },
      dotA: { color: '#f4d35e', rough: 0.5 },
      dotB: { color: '#e86f8a', rough: 0.5 },
      blockR: { color: '#e2574c', rough: 0.55 },
      blockB: { color: '#4a86d4', rough: 0.55 },
      blockY: { color: '#f2c84b', rough: 0.55 },
      blockG: { color: '#4fb36a', rough: 0.55 },
    }),
    build(k) {
      platform(k, 'platform', -0.25);
      for (const z of [-0.5, 0.5]) {
        k.box('paint', [4.9, 0.55, 0.1], [0, 0.025, z]);
        k.box('trim', [4.9, 0.05, 0.14], [0, 0.3, z]);
      }
      for (const s of [-1, 1]) {
        k.box('paint', [0.1, 0.55, 1.1], [s * 2.4, 0.025, 0]);
        for (const z of [-0.5, 0.5]) k.cyl('trim', 0.09, 0.09, 0.62, 10, [s * 2.42, 0.03, z]);
      }
      k.box('trim', [4.7, 0.04, 0.9], [0, -0.02, 0]);
      // Toys in the back corners, clear of the row.
      k.box('blockR', [0.26, 0.26, 0.26], [2.2, 0.13, -0.32], [0, 0.3, 0]);
      k.box('blockB', [0.24, 0.24, 0.24], [2.18, 0.38, -0.3], [0, -0.3, 0]);
      k.box('blockY', [0.24, 0.24, 0.24], [-2.18, 0.12, -0.36], [0, 0.5, 0]);
      k.ball('blockG', 0.17, [-2.2, 0.41, -0.33], ONE, 12);
      k.ring('trim', 0.17, 0.02, [-2.2, 0.41, -0.33], [0.4, 0, 0], PI * 2, 14);
      k.in('lid', [0, 0.3, -0.5], [-1.78, 0, 0]);
      k.box('lid', [4.9, 0.1, 1.02], [0, 0.05, 0.51]);
      k.box('trim', [4.96, 0.04, 0.06], [0, 0.05, 1.0]);
      span(-1.9, 1.9, 6).forEach((x, i) => {
        for (const z of [0.3, 0.72])
          k.cyl((i + (z > 0.5 ? 1 : 0)) % 2 ? 'dotA' : 'dotB', 0.12, 0.12, 0.02, 12, [x + (z > 0.5 ? 0.32 : 0), -0.005, z]);
      });
      k.in('base');
    },
  },

  /*
    Dino Valley, 20 Oct 2026: a cage of dinosaur bones. The bamboo
    cage's footprint exactly — bars along the back and down both sides,
    open at the front — so it stands clear of every figure the same way;
    only the material is new. Every bar is a bone, knobbed at both ends,
    the rails are long bones lashed across them, and a horned skull sits
    on each back corner.
  */
  boneCage: {
    looks: (p) => ({
      platform: { color: p.platform, rough: 0.95 },
      bone: { color: p.bars, rough: 0.65 },
      knob: { color: '#f4ecd6', rough: 0.6 },
      socket: { color: '#3a2e24', rough: 0.9 },
      horn: { color: '#d8c8a2', rough: 0.6 },
      lash: { color: '#6e5a3a', rough: 0.9 },
    }),
    build(k) {
      platform(k);
      const bar = (x: number, z: number, h: number) => {
        k.cyl('bone', 0.04, 0.046, h, 7, [x, h / 2, z]);
        for (const y of [0.04, h]) {
          for (const dx of [-0.035, 0.035]) k.ball('knob', 0.05, [x + dx, y, z], ONE, 8);
        }
      };
      const rail = (len: number, pos: V3, rot: V3, along: 'x' | 'z') => {
        k.cyl('bone', 0.038, 0.038, len, 7, pos, rot);
        for (const s of [-1, 1]) {
          const end: V3 = along === 'x' ? [pos[0] + (s * len) / 2, pos[1], pos[2]] : [pos[0], pos[1], pos[2] + (s * len) / 2];
          k.ball('knob', 0.06, end, ONE, 8);
        }
      };
      span(-2.25, 2.25, 14).forEach((x, i) => bar(x, -0.86, 1.18 + 0.06 * jit(i)));
      for (const y of [0.32, 1.08]) rail(4.6, [0, y, -0.8], [0, 0, PI / 2], 'x');
      for (const s of [-1, 1]) {
        for (const z of [-0.5, -0.15, 0.2]) bar(s * 2.28, z, 1.16);
        for (const y of [0.32, 1.08]) rail(1.15, [s * 2.22, y, -0.33], [PI / 2, 0, 0], 'z');
        // Lashings where the rails cross the corner bars.
        for (const y of [0.32, 1.08]) k.ring('lash', 0.06, 0.016, [s * 2.25, y, -0.84], [PI / 2, 0, 0], PI * 2, 10);
        // A horned skull on the back corner, looking out.
        k.ball('bone', 0.16, [s * 2.25, 1.38, -0.82], [1, 0.75, 1.15], 10);
        k.ball('bone', 0.1, [s * 2.25, 1.32, -0.66], [1, 0.8, 1.2], 8);
        for (const dx of [-0.06, 0.06]) k.ball('socket', 0.04, [s * 2.25 + dx, 1.42, -0.7], ONE, 6);
        for (const dx of [-0.08, 0.08]) k.cyl('horn', 0.005, 0.03, 0.18, 6, [s * 2.25 + dx, 1.52, -0.78], [-0.6, 0, dx * 3]);
      }
    },
  },

  /*
    Sun Temple, season 2 of the pass (21 Oct 2026): a shrine of cut
    sandstone. Pillars along the back carry a carved lintel with a gold
    sun on its face, low walls with a pillar at each end run down the
    sides, and a brazier burns on each back corner. The bamboo cage's
    footprint — bars along the back and down both sides, open at the
    front — so it stands clear of every figure the same way.
  */
  sunShrine: {
    looks: (p) => ({
      platform: { color: p.platform, rough: 0.95 },
      stone: { color: '#e8d0a0', rough: 0.9 },
      carved: { color: '#c8a264', rough: 0.9 },
      dark: { color: p.bars, rough: 0.9 },
      gold: { color: '#f0b240', rough: 0.35, metal: 0.5 },
      flame: { color: '#ffb347', unlit: true },
      core: { color: '#fff0b0', unlit: true },
    }),
    build(k) {
      platform(k);
      for (const x of span(-2.0, 2.0, 9)) k.box('carved', [0.02, 0.012, 1.5], [x, 0.004, 0]);
      for (const x of span(-1.6, 1.6, 6)) {
        k.box('stone', [0.16, 1.1, 0.16], [x, 0.55, -0.86]);
        k.box('carved', [0.22, 0.08, 0.22], [x, 1.12, -0.86]);
        k.box('carved', [0.22, 0.06, 0.22], [x, 0.03, -0.86]);
      }
      k.box('stone', [4.0, 0.18, 0.26], [0, 1.25, -0.86]);
      k.box('carved', [4.1, 0.06, 0.3], [0, 1.37, -0.86]);
      // The sun on the lintel's face, eight rays round it.
      k.cyl('gold', 0.2, 0.2, 0.04, 20, [0, 1.25, -0.71], [PI / 2, 0, 0]);
      k.cyl('core', 0.1, 0.1, 0.05, 16, [0, 1.25, -0.71], [PI / 2, 0, 0]);
      for (const a of span(0, PI * 2 - PI / 4, 8)) {
        k.cone('gold', 0.04, 0.12, 4, [Math.cos(a) * 0.28, 1.25 + Math.sin(a) * 0.28, -0.71], [0, 0, a - PI / 2]);
      }
      for (const s of [-1, 1]) {
        k.box('stone', [0.16, 0.6, 1.1], [s * 2.28, 0.3, -0.33]);
        k.box('stone', [0.18, 1.0, 0.18], [s * 2.28, 0.5, 0.2]);
        k.box('stone', [0.2, 1.3, 0.2], [s * 2.28, 0.65, -0.86]);
        k.box('carved', [0.26, 0.06, 0.26], [s * 2.28, 1.33, -0.86]);
        // A brazier on each back corner, burning.
        k.cyl('dark', 0.13, 0.07, 0.12, 8, [s * 2.28, 1.42, -0.86]);
        k.in(`flame${s > 0 ? 'R' : 'L'}`, [s * 2.28, 1.46, -0.86]);
        k.cone('flame', 0.1, 0.24, 7, [0, 0.12, 0]);
        k.cone('core', 0.05, 0.13, 6, [0, 0.065, 0]);
        k.in('base');
      }
    },
    tick(t, live) {
      flicker(live.layers.flameL, t, 0);
      flicker(live.layers.flameR, t, 2.1);
    },
  },

  /*
    Moon Garden, season 2 of the pass: a torii gate at the back of the
    pen — two round lacquered posts, the curved top beam with its
    upturned ends, the tie beam under it — over a bamboo fence that runs
    along the back and down both sides, and three paper lanterns hanging
    from the tie beam, swinging gently.
  */
  toriiGate: {
    looks: (p) => ({
      platform: { color: p.platform, rough: 0.95 },
      lacquer: { color: '#9a2f2a', rough: 0.5 },
      dark: { color: p.bars, rough: 0.8 },
      stone: { color: '#8a93a8', rough: 0.95 },
      bamboo: { color: '#8aa36a', rough: 0.8 },
      paper: { color: '#ffe9b0', unlit: true },
    }),
    build(k) {
      platform(k);
      for (const z of span(-0.6, 0.6, 7)) k.box('stone', [4.6, 0.01, 0.02], [0, 0.004, z]);
      for (const s of [-1, 1]) {
        k.cyl('lacquer', 0.09, 0.11, 1.35, 10, [s * 2.1, 0.675, -0.86]);
        k.cyl('dark', 0.14, 0.14, 0.08, 10, [s * 2.1, 0.04, -0.86]);
      }
      k.box('lacquer', [4.9, 0.12, 0.16], [0, 1.36, -0.86]);
      k.box('dark', [5.0, 0.06, 0.2], [0, 1.45, -0.86]);
      for (const s of [-1, 1]) k.box('dark', [0.3, 0.1, 0.2], [s * 2.5, 1.5, -0.86], [0, 0, s * -0.35]);
      k.box('lacquer', [4.4, 0.1, 0.12], [0, 1.1, -0.86]);
      k.box('lacquer', [0.14, 0.2, 0.14], [0, 1.23, -0.86]);
      for (const x of span(-1.9, 1.9, 12)) k.cyl('bamboo', 0.03, 0.03, 0.9, 6, [x, 0.45, -0.8]);
      for (const y of [0.3, 0.75]) k.cyl('bamboo', 0.025, 0.025, 4.0, 6, [0, y, -0.76], [0, 0, PI / 2]);
      for (const s of [-1, 1]) {
        for (const z of span(-0.55, 0.2, 4)) k.cyl('bamboo', 0.03, 0.03, 0.9, 6, [s * 2.28, 0.45, z]);
        for (const y of [0.3, 0.75]) k.cyl('bamboo', 0.025, 0.025, 0.95, 6, [s * 2.24, y, -0.18], [PI / 2, 0, 0]);
      }
      [-1.3, 0, 1.3].forEach((x, i) => {
        k.in(`lantern${i}`, [x, 1.05, -0.86]);
        k.cyl('dark', 0.008, 0.008, 0.12, 4, [0, -0.06, 0]);
        k.cyl('paper', 0.1, 0.1, 0.22, 10, [0, -0.23, 0]);
        // A knob on top rather than a cap: a cap hid the light from this camera.
        k.cyl('dark', 0.04, 0.04, 0.03, 8, [0, -0.11, 0]);
        k.cyl('dark', 0.11, 0.11, 0.02, 10, [0, -0.34, 0]);
        k.in('base');
      });
    },
    tick(t, live) {
      for (let i = 0; i < 3; i++) {
        const l = live.layers[`lantern${i}`];
        if (l) l.rotation.z = 0.07 * Math.sin(t * 1.1 + i * 2.0);
      }
    },
  },
};

/* ── the component ────────────────────────────────────────────────── */

/**
 * A jail's solids, merged, in pen-local space (see the top of this file),
 * each part with the pivot and rotation it is drawn at. The component
 * draws exactly this; the test suite measures it — that nothing stands
 * where a figure stands or rises into the HUD.
 */
export function buildJail(kind: JailKind): BakedLayer[] {
  const kit = new Kit();
  DESIGNS[kind].build(kit);
  return bake(kit);
}

/** Where pen-local (0, 0, 0) is in the world. */
export const JAIL_ORIGIN = { y: FLOOR, z: PEN_Z } as const;

/**
 * The jail for one board, at the shared pen position behind the far wall.
 *
 * `platform` and `bars` are the board's own jail colours (themeData's
 * `jail` field, or the bespoke arena's palette); each design decides what
 * they paint, so a theme repainted in themeData repaints its jail too.
 */
export function Jail({ kind, platform: platformColor, bars }: { kind: JailKind } & Paint) {
  const design = DESIGNS[kind];
  const baked = useMemo(() => buildJail(kind), [kind]);
  const mats = useMemo(() => {
    const out: Record<string, THREE.Material> = {};
    for (const [name, look] of Object.entries(design.looks({ platform: platformColor, bars }))) out[name] = makeMaterial(look);
    return out;
  }, [design, platformColor, bars]);

  useEffect(() => () => baked.forEach((l) => l.meshes.forEach((m) => m.geometry.dispose())), [baked]);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  const live = useRef<Live>({ mats, layers: {} });
  live.current.mats = mats;
  // Hung on ONE mesh, the platform, which is always in view: three.js
  // calls it once per drawn frame, just before drawing that mesh.
  const tick = useMemo(() => {
    const run = design.tick;
    return run ? () => run(seconds(), live.current) : null;
  }, [design]);

  return (
    <group position={[0, FLOOR, PEN_Z]}>
      {baked.map((layer) => (
        <group
          key={layer.name}
          position={layer.pivot}
          rotation={layer.rotation}
          ref={(g) => {
            live.current.layers[layer.name] = g ?? undefined;
          }}
        >
          {layer.meshes.map((m, i) => (
            <mesh
              key={`${m.mat}-${i}`}
              geometry={m.geometry}
              material={mats[m.mat]}
              ref={
                tick && layer.name === 'base' && m.mat === 'platform'
                  ? (mesh: THREE.Mesh | null) => {
                      if (mesh) mesh.onBeforeRender = tick;
                    }
                  : undefined
              }
            />
          ))}
        </group>
      ))}
    </group>
  );
}
