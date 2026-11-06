import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TUNING } from '../game/tuning';
import { createGlowTexture } from './bespokeFloors';
import { loop } from './boardLife';
import { cachedTexture } from './textureCache';

/**
 * The Sun Temple's phoenix.
 *
 * David, 1 Nov 2026: "Change the birds in the sun arena to one Phoenix
 * and make it look like it has a fire aura coming off it."
 *
 * One big, friendly firebird circling the temple where the two ibises
 * used to: gold at the shoulders running to orange and red at the wing
 * tips, a crest of three plumes, and five long tail feathers streaming
 * behind it. A few slow wing beats, then a long glide.
 *
 * The aura is a handful of meshes, all built here once:
 *   - tongues of flame licking back off each wing's trailing edge, the
 *     crest and the tail tips (one mesh per wing, one for the body), each
 *     tongue a little fan of five vertices the tick stretches and sways;
 *   - a soft additive glow round the whole bird, breathing with the
 *     flames, so it reads as LIGHT from above, like the braziers;
 *   - a trail of embers drifting off behind it: one point cloud whose
 *     points are placed where the bird WAS when each was shed, so they
 *     hang in the air behind it and fade, with no state carried between
 *     frames at all.
 * Nine draw calls for the whole bird; the two ibises it replaces were
 * fourteen.
 *
 * Where it flies: a stadium loop over the side walls, round behind the
 * jail at the far end and round beyond the near wall at the near end,
 * so it never crosses the tray where it could hide a die. It lingers
 * over the far end, where the camera sees it best, and sweeps quickly
 * round the near end, by easing its pace round the loop. High enough to
 * clear everything on the board: the prisoners' heads stand at about
 * 2.6, the obelisks at 2.
 *
 * NOT REACT. A plain class, the way the dice fire is (src/dice/
 * diceFire.ts): templeLife.tsx mounts `group` and registers `tick` on
 * the scenery clock, and tests/phoenix.test.ts drives it in node. The
 * tick only writes numbers into objects built here: nothing per frame
 * is new.
 *
 * LOOKS ONLY. Nothing here has a body in the physics world.
 */

export const PHOENIX = {
  /** The loop: side runs at x = ±half, turning at z = far and z = near. */
  half: 2.75,
  far: -3.9,
  near: 4.0,
  /** Height above the ground, and how far it rises and falls on that. */
  height: 3.1,
  bob: 0.12,
  /** Laps a second, on average: about 36 seconds round. */
  pace: 0.028,
  /**
   * How much it slows over the far end and speeds round the near one:
   * 0 is an even pace, 0.5 makes the far end three times slower than
   * the near.
   */
  linger: 0.5,
  /** The whole bird's size. Wingspan is about 2.1 times this. */
  scale: 0.85,
} as const;

const STRAIGHT = PHOENIX.near - PHOENIX.far;
const ARC = Math.PI * PHOENIX.half;
const LAP_LENGTH = 2 * STRAIGHT + 2 * ARC;
/** Where on the loop (0..1) the middle of the far turn is. */
const FAR_MIDDLE = (STRAIGHT + ARC / 2) / LAP_LENGTH;
const TAU = Math.PI * 2;

/**
 * Where the phoenix is at time `t`, written into `out`; returns its
 * heading (radians about +y, for a bird built nose toward +z). Pure and
 * allocation-free, so the embers can ask where it was a moment ago.
 */
export function phoenixFlight(t: number, out: THREE.Vector3): number {
  const u = t * PHOENIX.pace;
  const eased = u - (PHOENIX.linger / TAU) * Math.sin(TAU * (u - FAR_MIDDLE));
  const heading = loop(eased, PHOENIX.half, PHOENIX.far, PHOENIX.near, out);
  out.y = PHOENIX.height + Math.sin(t * 0.7) * PHOENIX.bob;
  return heading;
}

/** A repeatable 0..1 jitter. Never random, so a picture can be retaken. */
function jitter(i: number, k: number): number {
  const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a: number, b: number, v: number) => {
  const x = clamp01((v - a) / (b - a));
  return x * x * (3 - 2 * x);
};

/* ── The plumage, built once ───────────────────────────────────────── */

const GOLD = new THREE.Color('#ffc21f');
const AMBER = new THREE.Color('#ff7a12');
const EMBER_RED = new THREE.Color('#d8300f');
const IVORY = new THREE.Color('#ffeaa0');
const EYE_WHITE = new THREE.Color('#fffaf0');
const PUPIL = new THREE.Color('#1a0c04');
/*
  The flames' and embers' colours. THREE.Color takes these as the sRGB
  you see and stores them linear, which is what a vertex colour must be;
  the first try wrote the numbers straight in, and every flame came out
  pale cream.
*/
const FLAME_ROOT = new THREE.Color('#ffc42a');
const FLAME_WAIST = new THREE.Color('#ff6a10');
const FLAME_TIP = new THREE.Color('#d02a08');
const EMBER = new THREE.Color('#ff8a1a');

/** Gold to amber to red as `f` goes 0..1. */
function fireColor(f: number, out: THREE.Color): THREE.Color {
  if (f < 0.55) return out.copy(GOLD).lerp(AMBER, f / 0.55);
  return out.copy(AMBER).lerp(EMBER_RED, (f - 0.55) / 0.45);
}

/** Give every vertex of `geo` a colour worked out from where it is. */
function paint(geo: THREE.BufferGeometry, colour: (x: number, y: number, z: number, out: THREE.Color) => void): THREE.BufferGeometry {
  const p = geo.getAttribute('position');
  const c = new Float32Array(p.count * 3);
  const col = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    colour(p.getX(i), p.getY(i), p.getZ(i), col);
    c[i * 3] = col.r;
    c[i * 3 + 1] = col.g;
    c[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}

/** The crest: three plumes swept back off the crown, and where they end. */
const CREST = [-1, 0, 1].map((k) => {
  const base = new THREE.Vector3(k * 0.045, 0.15, 0.36);
  const dir = new THREE.Vector3(k * 0.35, 0.55, -0.85).normalize();
  const length = k === 0 ? 0.26 : 0.2;
  return { base, dir, length, tip: base.clone().addScaledVector(dir, length) };
});

/**
 * Body, head, beak, eyes and crest as ONE mesh: vertex colours carry the
 * differences, so the whole of it is a single draw call.
 */
function bodyGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const torso = new THREE.SphereGeometry(1, 14, 10).scale(0.14, 0.11, 0.36);
  // Golden breast at the front, warming to amber at the rump.
  parts.push(paint(torso, (_x, _y, z, out) => void fireColor(clamp01((0.3 - z) / 0.7), out)));
  const head = new THREE.SphereGeometry(0.115, 12, 8).translate(0, 0.06, 0.38);
  parts.push(paint(head, (_x, _y, _z, out) => void out.copy(GOLD)));
  const beak = new THREE.ConeGeometry(0.04, 0.15, 8).rotateX(Math.PI / 2).translate(0, 0.04, 0.54);
  parts.push(paint(beak, (_x, _y, _z, out) => void out.copy(IVORY)));
  for (const side of [-1, 1]) {
    // Big round friendly eyes on top of the head, where the camera above
    // sees them: white, with a dark pupil looking ahead.
    const eye = new THREE.SphereGeometry(0.038, 8, 6).translate(side * 0.06, 0.12, 0.43);
    parts.push(paint(eye, (_x, _y, _z, out) => void out.copy(EYE_WHITE)));
    const pupil = new THREE.SphereGeometry(0.024, 8, 6).translate(side * 0.062, 0.14, 0.45);
    parts.push(paint(pupil, (_x, _y, _z, out) => void out.copy(PUPIL)));
  }
  const up = new THREE.Vector3(0, 1, 0);
  for (const plume of CREST) {
    const cone = new THREE.ConeGeometry(0.03, plume.length, 6);
    cone.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, plume.dir));
    const mid = plume.base.clone().addScaledVector(plume.dir, plume.length / 2);
    cone.translate(mid.x, mid.y, mid.z);
    parts.push(paint(cone, (x, y, z, out) => {
      const along = clamp01(Math.hypot(x - plume.base.x, y - plume.base.y, z - plume.base.z) / plume.length);
      fireColor(along * 0.9, out);
    }));
  }
  const merged = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  return merged;
}

/**
 * A wing, lying in the ground plane so the camera above sees its whole
 * spread, hinged at the shoulder. Long primaries scalloped along the
 * trailing edge. `side` is +1 for the wing on +x.
 */
const WING_LEADING: readonly [number, number][] = [
  [0, 0.14], [0.25, 0.2], [0.5, 0.18], [0.75, 0.1], [0.95, -0.03], [1.04, -0.14],
];
const WING_TRAILING: readonly [number, number][] = [
  [0.96, -0.32], [0.88, -0.24], [0.81, -0.38], [0.71, -0.28], [0.63, -0.4],
  [0.53, -0.3], [0.44, -0.38], [0.33, -0.27], [0.2, -0.31], [0.08, -0.2], [0, -0.13],
];
function wingGeometry(side: 1 | -1): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(side * WING_LEADING[0][0], WING_LEADING[0][1]);
  for (const [x, z] of WING_LEADING.slice(1)) s.lineTo(side * x, z);
  for (const [x, z] of WING_TRAILING) s.lineTo(side * x, z);
  s.closePath();
  // The shape is drawn in x-y; turn y into z, so it lies flat.
  const geo = new THREE.ShapeGeometry(s).rotateX(Math.PI / 2);
  return paint(geo, (x, _y, z, out) => {
    // Gold at the shoulder, red at the tip, and redder along the feather ends.
    fireColor(clamp01(Math.abs(x) / 1.04 * 0.85 + clamp01(-z - 0.2) * 0.6), out);
  });
}

/**
 * The tail: five long feathers fanned out behind, the middle one
 * longest, each a thin quill that opens into a plume and narrows to a
 * point. Drawn as ribbons the tick waves from side to side.
 */
const TAIL_FEATHERS = [
  { angle: -0.28, length: 1.0 },
  { angle: -0.13, length: 1.3 },
  { angle: 0, length: 1.6 },
  { angle: 0.13, length: 1.3 },
  { angle: 0.28, length: 1.0 },
] as const;
const TAIL_ROWS = 11;
const TAIL_ROOT = { x: 0, y: -0.02, z: -0.3 };
/** The width of a feather at each row: quill, then plume, then point. */
const TAIL_WIDTH = Float32Array.from({ length: TAIL_ROWS }, (_v, r) => {
  const s = r / (TAIL_ROWS - 1);
  return 0.035 + 0.17 * smooth(0.42, 0.78, s) * (1 - smooth(0.86, 1, s)) - 0.02 * smooth(0.9, 1, s);
});

/* ── The flames ────────────────────────────────────────────────────── */

interface Tongue {
  /** Where it starts, in the space of whatever it is attached to. */
  x: number; y: number; z: number;
  /** Which way it streams. Need not be unit length. */
  dx: number; dy: number; dz: number;
  length: number;
  width: number;
}

/**
 * A fringe of flame tongues as one mesh. Each tongue is five vertices —
 * two at its root, two at its waist, one at its tip — whose colours run
 * from hot yellow to orange to nothing, and whose shape the tick
 * stretches and sways every frame. Only the positions change; the
 * colours, the triangles and the arrays themselves are made here once.
 */
export class FlameFringe {
  readonly mesh: THREE.Mesh;
  readonly count: number;
  /** Where each tongue starts. Writable: the tail's move with the tail. */
  readonly base: Float32Array;
  /** Which way each streams, unit length. Writable the same way. */
  readonly dir: Float32Array;
  private readonly size: Float32Array;
  private readonly positions: THREE.BufferAttribute;

  constructor(tongues: readonly Tongue[], material: THREE.Material) {
    const n = tongues.length;
    this.count = n;
    this.base = new Float32Array(n * 3);
    this.dir = new Float32Array(n * 3);
    this.size = new Float32Array(n * 2);
    const colours = new Float32Array(n * 5 * 4);
    const index: number[] = [];
    tongues.forEach((tg, k) => {
      const l = Math.hypot(tg.dx, tg.dy, tg.dz) || 1;
      this.base.set([tg.x, tg.y, tg.z], k * 3);
      this.dir.set([tg.dx / l, tg.dy / l, tg.dz / l], k * 3);
      this.size.set([tg.length, tg.width], k * 2);
      // Root, root, waist, waist, tip: hot yellow, orange, then red fading to nothing.
      const o = k * 20;
      colours.set([FLAME_ROOT.r, FLAME_ROOT.g, FLAME_ROOT.b, 0.92], o);
      colours.set([FLAME_ROOT.r, FLAME_ROOT.g, FLAME_ROOT.b, 0.92], o + 4);
      colours.set([FLAME_WAIST.r, FLAME_WAIST.g, FLAME_WAIST.b, 0.8], o + 8);
      colours.set([FLAME_WAIST.r, FLAME_WAIST.g, FLAME_WAIST.b, 0.8], o + 12);
      colours.set([FLAME_TIP.r, FLAME_TIP.g, FLAME_TIP.b, 0], o + 16);
      const v = k * 5;
      index.push(v, v + 1, v + 3, v, v + 3, v + 2, v + 2, v + 3, v + 4);
    });
    const geo = new THREE.BufferGeometry();
    this.positions = new THREE.BufferAttribute(new Float32Array(n * 5 * 3), 3);
    this.positions.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.positions);
    geo.setAttribute('color', new THREE.BufferAttribute(colours, 4));
    geo.setIndex(index);
    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
  }

  /** Flicker every tongue to time `t`. `seed` keeps two fringes out of step. */
  update(t: number, seed: number): void {
    const p = this.positions.array as Float32Array;
    for (let k = 0; k < this.count; k++) {
      const ph = seed + k * 1.7;
      const flick = Math.sin(t * 9.3 + ph) * 0.5 + Math.sin(t * 15.1 + ph * 2.3) * 0.3 + Math.sin(t * 4.1 + ph * 0.7) * 0.2;
      const len = this.size[k * 2] * (0.8 + flick * 0.3);
      const half = this.size[k * 2 + 1] / 2;
      const bx = this.base[k * 3], by = this.base[k * 3 + 1], bz = this.base[k * 3 + 2];
      const dx = this.dir[k * 3], dy = this.dir[k * 3 + 1], dz = this.dir[k * 3 + 2];
      // Sideways is across the tongue in the ground plane.
      const sl = Math.hypot(dx, dz) || 1;
      const sx = dz / sl, sz = -dx / sl;
      const sway = Math.sin(t * 6.1 + ph * 1.3) * 0.22 * len;
      const o = k * 15;
      p[o] = bx - sx * half; p[o + 1] = by; p[o + 2] = bz - sz * half;
      p[o + 3] = bx + sx * half; p[o + 4] = by; p[o + 5] = bz + sz * half;
      const wx = bx + dx * len * 0.4 + sx * sway * 0.3;
      const wy = by + dy * len * 0.4;
      const wz = bz + dz * len * 0.4 + sz * sway * 0.3;
      p[o + 6] = wx - sx * half * 0.6; p[o + 7] = wy; p[o + 8] = wz - sz * half * 0.6;
      p[o + 9] = wx + sx * half * 0.6; p[o + 10] = wy; p[o + 11] = wz + sz * half * 0.6;
      p[o + 12] = bx + dx * len + sx * sway; p[o + 13] = by + dy * len; p[o + 14] = bz + dz * len + sz * sway;
    }
    this.positions.needsUpdate = true;
  }
}

/** Flames off a wing's trailing edge and its tip, streaming back and out. */
function wingTongues(side: 1 | -1): Tongue[] {
  // Rooted a little inside the edge, so they grow out of the feathers
  // rather than standing on it like teeth, and overlapping each other.
  const spots: [number, number, number][] = [
    // span, z, length
    [0.14, -0.2, 0.34], [0.26, -0.24, 0.46], [0.38, -0.28, 0.4], [0.5, -0.27, 0.52], [0.61, -0.3, 0.44],
    [0.72, -0.26, 0.54], [0.82, -0.27, 0.46], [0.92, -0.22, 0.5], [1.0, -0.12, 0.4],
  ];
  // A little uneven, so the fringe reads as fire and not as a saw blade.
  return spots.map(([x, z, length], i) => ({
    x: side * x, y: 0.012, z,
    dx: side * (x * 0.5 + (jitter(i, 1) - 0.5) * 0.3), dy: 0.12, dz: -1,
    length: length * (0.9 + jitter(i, 2) * 0.2), width: 0.13 + jitter(i, 3) * 0.05,
  }));
}

/** The crest's and the back's flames; the tail tips' are placed each frame. */
function bodyTongues(): Tongue[] {
  const crest = CREST.map((c) => ({ x: c.tip.x, y: c.tip.y, z: c.tip.z + 0.04, dx: c.dir.x, dy: c.dir.y * 0.5, dz: c.dir.z, length: 0.3, width: 0.1 }));
  const back = [-1, 1].map((s) => ({ x: s * 0.07, y: 0.1, z: 0.05, dx: s * 0.25, dy: 0.3, dz: -1, length: 0.4, width: 0.13 }));
  const tail = TAIL_FEATHERS.map(() => ({ x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: -1, length: 0.45, width: 0.15 }));
  return [...crest, ...back, ...tail];
}
const TAIL_TONGUE_FIRST = CREST.length + 2;

/* ── The bird ──────────────────────────────────────────────────────── */

const EMBERS = 16;
/** Seconds an ember lives. */
const EMBER_LIFE = 1.8;

export class PhoenixBird {
  /** Add this to the scene. The bird moves inside it; the embers hang in it. */
  readonly group = new THREE.Group();
  /** The bird itself, placed and turned by the tick. */
  readonly bird = new THREE.Group();
  readonly wingL = new THREE.Group();
  readonly wingR = new THREE.Group();
  readonly flames: { wingL: FlameFringe; wingR: FlameFringe; body: FlameFringe };
  readonly tail: THREE.Mesh;
  readonly halo: THREE.Mesh;
  readonly embers: THREE.Points;

  private readonly plumage: THREE.MeshStandardMaterial;
  private readonly flameMaterial: THREE.MeshBasicMaterial;
  private readonly haloMaterial: THREE.MeshBasicMaterial;
  private readonly emberMaterial: THREE.PointsMaterial;
  private readonly tailPositions: THREE.BufferAttribute;
  private readonly emberPositions: THREE.BufferAttribute;
  private readonly emberColours: THREE.BufferAttribute;
  private readonly at = new THREE.Vector3();
  private readonly was = new THREE.Vector3();

  constructor() {
    const glow = cachedTexture('glow-disc', createGlowTexture);
    // Lit, so the flap catches the low sun. No emissive: it is added to
    // every vertex alike, and it turned the pupils red.
    this.plumage = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.65,
      side: THREE.DoubleSide,
    });
    // Unlit, so the flames stay at full brightness whatever the sun does.
    // Blended normally rather than added: added to the pale sand, every
    // tongue went white and the wings looked edged with teeth.
    this.flameMaterial = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    this.haloMaterial = new THREE.MeshBasicMaterial({
      map: glow,
      color: '#ff7a1a',
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.emberMaterial = new THREE.PointsMaterial({
      map: glow,
      size: 0.3,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });

    this.bird.scale.setScalar(PHOENIX.scale);
    this.group.add(this.bird);

    const body = new THREE.Mesh(bodyGeometry(), this.plumage);
    this.bird.add(body);

    for (const [g, side] of [[this.wingL, -1], [this.wingR, 1]] as const) {
      g.position.set(side * 0.08, 0.02, 0.05);
      g.add(new THREE.Mesh(wingGeometry(side), this.plumage));
      this.bird.add(g);
    }

    // The tail: TAIL_ROWS pairs of vertices per feather, moved each frame.
    const n = TAIL_FEATHERS.length;
    const tailGeo = new THREE.BufferGeometry();
    this.tailPositions = new THREE.BufferAttribute(new Float32Array(n * TAIL_ROWS * 2 * 3), 3);
    this.tailPositions.setUsage(THREE.DynamicDrawUsage);
    const normals = new Float32Array(n * TAIL_ROWS * 2 * 3);
    const colours = new Float32Array(n * TAIL_ROWS * 2 * 3);
    const index: number[] = [];
    const col = new THREE.Color();
    for (let f = 0; f < n; f++) {
      for (let r = 0; r < TAIL_ROWS; r++) {
        const s = r / (TAIL_ROWS - 1);
        // Gold quill, amber plume with a bright gold eye in it, red point.
        fireColor(s * 0.9, col);
        col.lerp(GOLD, 0.7 * smooth(0.6, 0.72, s) * (1 - smooth(0.8, 0.9, s)));
        for (let e = 0; e < 2; e++) {
          const v = (f * TAIL_ROWS + r) * 2 + e;
          normals[v * 3 + 1] = 1;
          colours.set([col.r, col.g, col.b], v * 3);
        }
        if (r > 0) {
          const a = (f * TAIL_ROWS + r - 1) * 2;
          index.push(a, a + 1, a + 3, a, a + 3, a + 2);
        }
      }
    }
    tailGeo.setAttribute('position', this.tailPositions);
    tailGeo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    tailGeo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    tailGeo.setIndex(index);
    this.tail = new THREE.Mesh(tailGeo, this.plumage);
    this.tail.frustumCulled = false;
    this.bird.add(this.tail);

    this.flames = {
      wingL: new FlameFringe(wingTongues(-1), this.flameMaterial),
      wingR: new FlameFringe(wingTongues(1), this.flameMaterial),
      body: new FlameFringe(bodyTongues(), this.flameMaterial),
    };
    this.wingL.add(this.flames.wingL.mesh);
    this.wingR.add(this.flames.wingR.mesh);
    this.bird.add(this.flames.body.mesh);

    // The glow round it, lying in the plane of the wings.
    this.halo = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2).rotateX(-Math.PI / 2), this.haloMaterial);
    this.halo.position.set(0, -0.06, -0.15);
    this.halo.renderOrder = 2;
    this.bird.add(this.halo);

    // Embers hang in the world, not on the bird, so it leaves them behind.
    const emberGeo = new THREE.BufferGeometry();
    this.emberPositions = new THREE.BufferAttribute(new Float32Array(EMBERS * 3), 3);
    this.emberColours = new THREE.BufferAttribute(new Float32Array(EMBERS * 3), 3);
    this.emberPositions.setUsage(THREE.DynamicDrawUsage);
    this.emberColours.setUsage(THREE.DynamicDrawUsage);
    emberGeo.setAttribute('position', this.emberPositions);
    emberGeo.setAttribute('color', this.emberColours);
    this.embers = new THREE.Points(emberGeo, this.emberMaterial);
    this.embers.frustumCulled = false;
    this.embers.renderOrder = 2;
    this.group.add(this.embers);

    this.tick(0);
  }

  /* ── Every frame: numbers only, nothing new ──────────────────────── */

  /** Move everything to time `t`. Stable, so it can go on the scenery clock. */
  readonly tick = (t: number): void => {
    const heading = phoenixFlight(t, this.at);
    this.bird.position.copy(this.at);
    // Lean into the turns at each end, the way a big bird banks.
    const turning = clamp01((PHOENIX.far - this.at.z) / 0.7) + clamp01((this.at.z - PHOENIX.near) / 0.7);
    this.bird.rotation.set(0, heading, -0.3 * turning + Math.sin(t * 0.6) * 0.05);

    // A few slow beats, then a long glide with the wings held up a little.
    const beating = smooth(-0.2, 0.4, Math.sin(t * 0.5));
    const flap = Math.sin(t * 3.4) * 0.5 * beating + 0.08;
    this.wingL.rotation.z = -flap;
    this.wingR.rotation.z = flap;

    this.waveTail(t);
    this.flames.wingL.update(t, 0);
    this.flames.wingR.update(t, 3.1);
    this.flames.body.update(t, 6.7);

    const breathe = Math.sin(t * 9.1) * 0.5 + Math.sin(t * 15.7) * 0.3 + Math.sin(t * 4.3) * 0.2;
    this.haloMaterial.opacity = 0.75 + breathe * 0.15;

    this.shedEmbers(t);
  };

  /** Stream the tail feathers behind, and put the flames on their tips. */
  private waveTail(t: number): void {
    const p = this.tailPositions.array as Float32Array;
    const fringe = this.flames.body;
    for (let f = 0; f < TAIL_FEATHERS.length; f++) {
      const { angle, length } = TAIL_FEATHERS[f];
      const ax = Math.sin(angle), az = -Math.cos(angle);
      const lx = Math.cos(angle), lz = Math.sin(angle);
      let px = 0, pz = 0, cx = 0, cy = 0, cz = 0;
      for (let r = 0; r < TAIL_ROWS; r++) {
        const s = r / (TAIL_ROWS - 1);
        const wave = 0.2 * Math.pow(s, 1.6) * Math.sin(t * 2.4 - s * 4 + f * 0.9);
        px = cx; pz = cz;
        cx = TAIL_ROOT.x + ax * s * length + lx * wave;
        cy = TAIL_ROOT.y - 0.1 * s + 0.06 * s * Math.sin(t * 1.9 - s * 3 + f);
        cz = TAIL_ROOT.z + az * s * length + lz * wave;
        const w = TAIL_WIDTH[r] * 0.5;
        const o = (f * TAIL_ROWS + r) * 6;
        p[o] = cx - lx * w; p[o + 1] = cy; p[o + 2] = cz - lz * w;
        p[o + 3] = cx + lx * w; p[o + 4] = cy; p[o + 5] = cz + lz * w;
      }
      const k = (TAIL_TONGUE_FIRST + f) * 3;
      const dx = cx - px, dz = cz - pz;
      const dl = Math.hypot(dx, dz) || 1;
      fringe.base[k] = cx; fringe.base[k + 1] = cy; fringe.base[k + 2] = cz;
      fringe.dir[k] = dx / dl; fringe.dir[k + 1] = 0; fringe.dir[k + 2] = dz / dl;
    }
    this.tailPositions.needsUpdate = true;
  }

  /**
   * Each ember was shed from the tail at some moment in the last
   * EMBER_LIFE seconds; put it where the bird's tail was then, drifted
   * up and aside since, and fade it with age. Nothing is remembered
   * between frames, so a still picture shows the same trail a moving
   * one does.
   */
  private shedEmbers(t: number): void {
    const pos = this.emberPositions.array as Float32Array;
    const col = this.emberColours.array as Float32Array;
    for (let i = 0; i < EMBERS; i++) {
      const life = t / EMBER_LIFE + i / EMBERS;
      const born = Math.floor(life);
      const age = life - born;
      const heading = phoenixFlight(t - age * EMBER_LIFE, this.was);
      const back = (0.45 + jitter(i, born) * 0.9) * PHOENIX.scale;
      const aside = (jitter(i, born + 0.5) - 0.5) * 0.7 * PHOENIX.scale;
      const fx = Math.sin(heading), fz = Math.cos(heading);
      const seconds = age * EMBER_LIFE;
      const drift = (jitter(i, born + 0.25) - 0.5) * 0.5;
      pos[i * 3] = this.was.x - fx * back + fz * aside + fz * drift * seconds;
      pos[i * 3 + 1] = this.was.y - 0.1 + 0.3 * seconds;
      pos[i * 3 + 2] = this.was.z - fz * back - fx * aside - fx * drift * seconds;
      const glow = Math.pow(1 - age, 1.3) * Math.min(1, age * 10) * (0.75 + 0.25 * Math.sin(t * 19 + i * 2.1));
      col[i * 3] = EMBER.r * glow;
      col[i * 3 + 1] = EMBER.g * glow;
      col[i * 3 + 2] = EMBER.b * glow;
    }
    this.emberPositions.needsUpdate = true;
    this.emberColours.needsUpdate = true;
  }

  /* ── end of the per-frame code ──────────────────────────────────── */

  /** Free the geometries and materials. The glow texture is shared and stays. */
  dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points) o.geometry.dispose();
    });
    this.plumage.dispose();
    this.flameMaterial.dispose();
    this.haloMaterial.dispose();
    this.emberMaterial.dispose();
  }
}

/**
 * For the tests: the tray the phoenix must never fly over. `halfX` and
 * `floorHalfZ` are the floor the dice roll on; `halfZ` runs on over the
 * end walls.
 */
export const TRAY_FOOTPRINT = {
  halfX: TUNING.tray.innerWidth / 2,
  floorHalfZ: TUNING.tray.innerDepth / 2,
  halfZ: TUNING.tray.innerDepth / 2 + TUNING.tray.wallThickness,
};
