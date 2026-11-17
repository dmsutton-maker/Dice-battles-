import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rgb } from './paint';
import { cachedTexture } from './textureCache';

/**
 * What Dino Valley's dinosaurs are made of, and how they walk: the
 * shapes, the painted hides and the gait, everything that can be
 * checked without a renderer. dinoLife.tsx puts the parts together and
 * moves them round the board; tests/dinoValley.test.ts reads them here.
 *
 * David, 1 Nov 2026: "Make the dinosaurs in Dino valley look much
 * better." The first ones were a few spheres and cones in one flat
 * colour each, with legs that did not move, and from the game's camera
 * (nearly straight down, see cameraFit.ts) they read as blobs. So:
 *
 * - Every geometry is built ONCE here and shared: the two raptors use
 *   the same parts, so do the two pterodactyls, and the eyes of all six
 *   are the same two spheres. Segment counts are low on purpose — a
 *   dinosaur is a few hundred vertices, not a few thousand.
 * - A hide is a tiny painted picture (skinPixels), not a flat colour: a
 *   paler underside the near-end three-quarter view sees, and spots or
 *   stripes along the back where the camera looks. The body spheres
 *   and tubes are turned so the picture's underside lands on the belly
 *   (see bodyGeometry and tube).
 * - The walk is one pure function of DISTANCE WALKED (gait), so the
 *   legs swing in step with the pace, the head bobs with each
 *   footfall, the tail sways behind, and a dinosaur that stops to
 *   graze stops moving its legs.
 */

export type DinoKind = 'longNeck' | 'triceratops' | 'raptor' | 'pterodactyl';

/* ── hides ─────────────────────────────────────────────────────────── */

export interface DinoSkin {
  /** What most of the hide is. */
  base: string;
  /** The underside: paler, the way most animals are. */
  belly: string;
  /** Spots or stripes, darker, along the back. Also the crest and frill. */
  mark: string;
  pattern: 'spots' | 'stripes' | 'plain';
}

export const DINO_SKINS: Record<DinoKind, DinoSkin> = {
  longNeck: { base: '#8fa872', belly: '#d6dcb4', mark: '#58744a', pattern: 'spots' },
  triceratops: { base: '#7f9e4c', belly: '#d4d8a4', mark: '#46662c', pattern: 'stripes' },
  raptor: { base: '#e3893c', belly: '#f7e2b4', mark: '#7a3818', pattern: 'stripes' },
  pterodactyl: { base: '#c47a4c', belly: '#eed4ac', mark: '#86462a', pattern: 'plain' },
};

/** A hide picture is this many texels square. Power of two, for mipmaps. */
export const SKIN_SIZE = 64;

const smooth = (e0: number, e1: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * Where the long-neck's spots go, in hide coordinates: u round the body
 * (0.75 is the middle of the back), v from tail (0) to nose (1), and a
 * radius in v. Hand-placed so no two sit on top of each other.
 */
const SPOTS: [number, number, number][] = [
  [0.75, 0.2, 0.07], [0.62, 0.36, 0.05], [0.88, 0.42, 0.06], [0.74, 0.55, 0.08],
  [0.6, 0.7, 0.05], [0.9, 0.72, 0.05], [0.76, 0.86, 0.06], [0.65, 0.08, 0.04], [0.86, 0.1, 0.04],
];

/** How many stripes cross the back, nose to tail. */
export const STRIPES = 5;

/**
 * Paint one hide. Column i is u = round the body, with the underside at
 * u = 0.25 and the back at u = 0.75; row j is v = along the body, tail
 * to nose. The texture does not flip rows, so row 0 is v = 0.
 */
export function skinPixels(skin: DinoSkin, size = SKIN_SIZE): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  const base = rgb(skin.base);
  const belly = rgb(skin.belly);
  const mark = rgb(skin.mark);
  for (let j = 0; j < size; j++) {
    const v = (j + 0.5) / size;
    for (let i = 0; i < size; i++) {
      const u = (i + 0.5) / size;
      const under = 1 - smooth(0.12, 0.23, Math.abs(u - 0.25));
      const back = 1 - smooth(0.14, 0.28, Math.abs(u - 0.75));
      let m = 0;
      if (skin.pattern === 'stripes') {
        // Bands across the back, nose to tail, fading down the flanks.
        const band = 0.5 + 0.5 * Math.cos(v * Math.PI * 2 * STRIPES);
        m = smooth(0.6, 0.85, band) * back;
      } else if (skin.pattern === 'spots') {
        for (const [su, sv, r] of SPOTS) {
          const du = Math.abs(u - su);
          const d = Math.hypot(Math.min(du, 1 - du) * 1.7, v - sv);
          m = Math.max(m, 1 - smooth(r * 0.7, r, d));
        }
        m *= back;
      }
      const k = (j * size + i) * 4;
      for (let c = 0; c < 3; c++) {
        const tone = base[c] + (belly[c] - base[c]) * under;
        data[k + c] = Math.round(tone + (mark[c] - tone) * m);
      }
      data[k + 3] = 255;
    }
  }
  return data;
}

/** Pterodactyl wings are this wide and this deep in their own plane. */
export const WING_W = 64;
export const WING_H = 32;
/** The wing picture covers x in [-1.2, 1.2] and y in [-0.4, 0.4] of the wing plane. */
export const WING_SPAN = 2.4;
export const WING_DEPTH = 0.8;

/**
 * Paint a wing membrane: the base tone, with the arm and the long
 * finger bones drawn darker along the leading edge and two struts
 * fanning back from the wrist, the way a child draws a bat wing. Drawn
 * in |x| so the same picture serves the left wing and the right.
 */
export function wingPixels(skin: DinoSkin, w = WING_W, h = WING_H): Uint8Array {
  const data = new Uint8Array(w * h * 4);
  // The membrane is the hide, a little paler and thinner-looking.
  const hide = rgb(skin.base);
  const pale = rgb(skin.belly);
  const base = hide.map((c, k) => c + (pale[k] - c) * 0.45);
  const bone = rgb(skin.mark);
  // Bones, each from (x0, y0) to (x1, y1) in wing coordinates.
  const bones: [number, number, number, number][] = [
    [0.05, 0.1, 0.5, 0.16], // the arm, shoulder to wrist
    [0.5, 0.16, 1.05, -0.04], // the wing finger, wrist to tip
    [0.5, 0.16, 0.62, -0.2], // struts fanning back into the membrane
    [0.5, 0.16, 0.3, -0.3],
  ];
  const seg = (px: number, py: number, b: [number, number, number, number]) => {
    const [x0, y0, x1, y1] = b;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(px - (x0 + dx * t), py - (y0 + dy * t));
  };
  for (let j = 0; j < h; j++) {
    const y = ((j + 0.5) / h) * WING_DEPTH - WING_DEPTH / 2;
    for (let i = 0; i < w; i++) {
      const x = Math.abs(((i + 0.5) / w) * WING_SPAN - WING_SPAN / 2);
      let m = 0;
      for (const b of bones) m = Math.max(m, 1 - smooth(0.01, 0.026, seg(x, y, b)));
      const k = (j * w + i) * 4;
      for (let c = 0; c < 3; c++) data[k + c] = Math.round(base[c] + (bone[c] - base[c]) * m * 0.4);
      data[k + 3] = 255;
    }
  }
  return data;
}

function picture(data: Uint8Array, w: number, h: number): THREE.DataTexture {
  const t = new THREE.DataTexture(data, w, h);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

export function skinTexture(kind: DinoKind): THREE.Texture {
  return cachedTexture(`dino-skin-${kind}`, () => picture(skinPixels(DINO_SKINS[kind]), SKIN_SIZE, SKIN_SIZE));
}

export function wingTexture(): THREE.Texture {
  return cachedTexture('dino-wing', () => {
    const t = picture(wingPixels(DINO_SKINS.pterodactyl), WING_W, WING_H);
    // A ShapeGeometry's uvs are its own x and y, so the picture is
    // stretched over the wing's plane rather than tiled across it.
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.repeat.set(1 / WING_SPAN, 1 / WING_DEPTH);
    t.offset.set(0.5, 0.5);
    return t;
  });
}

/* ── shapes ────────────────────────────────────────────────────────── */

/**
 * A body: a sphere turned so its poles lie along z, nose toward +z, and
 * squashed to the given half-sizes. That turn is what puts the hide's
 * u = 0.25 on the underside and u = 0.75 along the back, and runs v
 * from tail to nose.
 */
export function bodyGeometry(sx: number, sy: number, sz: number, around = 12, along = 8): THREE.BufferGeometry {
  return new THREE.SphereGeometry(1, around, along).rotateX(Math.PI / 2).scale(sx, sy, sz);
}

/**
 * A tube (neck, tail, leg) with its base at the origin. `axis` is where
 * the far end points before the mesh is leaned: 'up' for a neck or a
 * leg (hip at the origin, foot below), 'back' for a tail. In every
 * case the hide's underside lands on the side that faces the ground
 * once the mesh is leaned the way its creature leans it.
 */
export function tube(
  rBase: number,
  rEnd: number,
  length: number,
  axis: 'up' | 'down' | 'back',
  radial = 8,
): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rEnd, rBase, length, radial, 1, false).translate(0, length / 2, 0);
  if (axis === 'up') return g.rotateY(-Math.PI / 2);
  if (axis === 'down') return g.rotateY(-Math.PI / 2).rotateZ(Math.PI);
  return g.rotateY(Math.PI / 2).rotateX(-Math.PI / 2);
}

/** A horn, claw or beak: a cone with its base at the origin, point along +y. */
export function spike(r: number, length: number, radial = 6): THREE.BufferGeometry {
  return new THREE.ConeGeometry(r, length, radial).translate(0, length / 2, 0);
}

/** One geometry out of several, so they draw in one call. Never a mixed index. */
export function merged(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const indexed = parts.every((g) => g.index !== null);
  const source = indexed ? parts : parts.map((g) => (g.index ? g.toNonIndexed() : g));
  const out = mergeGeometries(source, false);
  if (!out) throw new Error('dinoParts: parts with different attributes cannot be merged');
  for (const g of new Set([...parts, ...source])) g.dispose();
  return out;
}

/** Two of a thing, mirrored about x, as one geometry. */
export function pair(make: () => THREE.BufferGeometry, dx: number): THREE.BufferGeometry {
  return merged([make().translate(-dx, 0, 0), make().translate(dx, 0, 0)]);
}

/**
 * A pair of cartoon eyes: whites, and pupils sitting just proud of
 * their front so they read as looking forward. `dx` is half the
 * distance between them, `r` the radius of a white.
 */
export function eyes(r: number, dx: number): { whites: THREE.BufferGeometry; pupils: THREE.BufferGeometry } {
  return {
    whites: pair(() => new THREE.SphereGeometry(r, 7, 5), dx),
    pupils: merged([
      new THREE.SphereGeometry(r * 0.5, 6, 4).translate(-dx - r * 0.25, r * 0.1, r * 0.78),
      new THREE.SphereGeometry(r * 0.5, 6, 4).translate(dx + r * 0.25, r * 0.1, r * 0.78),
    ]),
  };
}

/**
 * A flat shape standing in the plane of the body (x = along, y = up),
 * nose +z: two copies of it, splayed a little either side of upright,
 * because the camera is nearly overhead and one upright blade is a
 * line from there, while a V reads as a crest.
 */
function standing(shape: THREE.Shape, splay = 0.4): THREE.BufferGeometry {
  const blade = () => new THREE.ShapeGeometry(shape, 2).rotateY(-Math.PI / 2);
  return merged([blade().rotateZ(splay), blade().rotateZ(-splay)]);
}

/**
 * The triceratops's frill: a scalloped half-disc, seven bumps round
 * its edge, standing up behind the head. Scale it for the inner plate.
 */
export function frillGeometry(width: number, height: number, bumps = 7): THREE.BufferGeometry {
  const s = new THREE.Shape();
  const steps = 48;
  s.moveTo(-width / 2, 0);
  for (let k = 0; k <= steps; k++) {
    const a = Math.PI - (Math.PI * k) / steps;
    const bump = 1 + 0.08 * (0.5 + 0.5 * Math.cos(bumps * 2 * a));
    s.lineTo((Math.cos(a) * width * bump) / 2, Math.sin(a) * height * bump);
  }
  s.closePath();
  return new THREE.ShapeGeometry(s, 1);
}

/** A raptor's crest: three feathers fanning up and back off the head. */
export function crestGeometry(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0.02, 0.0);
  s.lineTo(-0.02, 0.1);
  s.lineTo(-0.03, 0.03);
  s.lineTo(-0.1, 0.09);
  s.lineTo(-0.06, 0.015);
  s.lineTo(-0.15, 0.03);
  s.lineTo(-0.05, -0.02);
  s.closePath();
  return standing(s);
}

/** A pterodactyl's crest: one long blade sweeping back off the skull. */
export function pteroCrestGeometry(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0.04, 0.0);
  s.lineTo(-0.02, 0.05);
  s.lineTo(-0.26, 0.16);
  s.lineTo(-0.06, -0.01);
  s.closePath();
  return standing(s);
}

/**
 * One pterodactyl wing, lying in the ground plane with x out to the
 * tip and +z toward the nose: a leading edge out to the wrist and on
 * to the finger tip, and a trailing edge scalloped back to the hip
 * between the struts. Its uvs are its own coordinates (see
 * wingTexture).
 */
export function wingGeometry(side: 1 | -1): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0.1);
  s.lineTo(side * 0.5, 0.16);
  s.lineTo(side * 1.05, -0.04);
  s.quadraticCurveTo(side * 0.82, -0.02, side * 0.62, -0.2);
  s.quadraticCurveTo(side * 0.47, -0.15, side * 0.3, -0.3);
  s.quadraticCurveTo(side * 0.14, -0.19, 0, -0.26);
  s.closePath();
  return new THREE.ShapeGeometry(s, 3).rotateX(Math.PI / 2);
}

/* ── the kit ───────────────────────────────────────────────────────── */

export interface DinoGeometries {
  longNeck: {
    body: THREE.BufferGeometry;
    neckLow: THREE.BufferGeometry;
    neckHigh: THREE.BufferGeometry;
    head: THREE.BufferGeometry;
    whites: THREE.BufferGeometry;
    pupils: THREE.BufferGeometry;
    tailBase: THREE.BufferGeometry;
    tailTip: THREE.BufferGeometry;
    leg: THREE.BufferGeometry;
  };
  triceratops: {
    body: THREE.BufferGeometry;
    head: THREE.BufferGeometry;
    frill: THREE.BufferGeometry;
    plate: THREE.BufferGeometry;
    beak: THREE.BufferGeometry;
    horns: THREE.BufferGeometry;
    whites: THREE.BufferGeometry;
    pupils: THREE.BufferGeometry;
    tail: THREE.BufferGeometry;
    leg: THREE.BufferGeometry;
  };
  raptor: {
    body: THREE.BufferGeometry;
    neck: THREE.BufferGeometry;
    head: THREE.BufferGeometry;
    crest: THREE.BufferGeometry;
    whites: THREE.BufferGeometry;
    pupils: THREE.BufferGeometry;
    arms: THREE.BufferGeometry;
    tail: THREE.BufferGeometry;
    leg: THREE.BufferGeometry;
    claw: THREE.BufferGeometry;
  };
  pterodactyl: {
    body: THREE.BufferGeometry;
    head: THREE.BufferGeometry;
    beak: THREE.BufferGeometry;
    crest: THREE.BufferGeometry;
    whites: THREE.BufferGeometry;
    pupils: THREE.BufferGeometry;
    wingL: THREE.BufferGeometry;
    wingR: THREE.BufferGeometry;
    legs: THREE.BufferGeometry;
  };
}

/** A raptor's leg: thigh forward, shin back, a flat foot. One piece, swung at the hip. */
function raptorLeg(): THREE.BufferGeometry {
  const thigh = tube(0.042, 0.03, 0.15, 'down').rotateX(-0.6);
  const knee = new THREE.Vector3(0, -0.15, 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), -0.6);
  const shin = tube(0.028, 0.02, 0.17, 'down').rotateX(0.75).translate(knee.x, knee.y, knee.z);
  const ankle = knee.clone().add(new THREE.Vector3(0, -0.17, 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), 0.75));
  const foot = new THREE.BoxGeometry(0.05, 0.022, 0.11).translate(0, ankle.y - 0.005, ankle.z + 0.035);
  return merged([thigh, shin, foot]);
}

/** A quadruped's leg: a stout column with a rounded foot, hip at the origin. */
function stompLeg(rHip: number, rFoot: number, length: number): THREE.BufferGeometry {
  return merged([
    tube(rHip, rFoot, length, 'down', 8),
    new THREE.SphereGeometry(rFoot * 1.25, 8, 5).scale(1, 0.45, 1.1).translate(0, -length + rFoot * 0.3, rFoot * 0.15),
  ]);
}

export function buildDinoGeometries(): DinoGeometries {
  const ln = eyes(0.05, 0.1);
  const tr = eyes(0.042, 0.12);
  const ra = eyes(0.03, 0.045);
  const pt = eyes(0.024, 0.045);
  return {
    longNeck: {
      body: bodyGeometry(0.5, 0.42, 0.92, 14, 10),
      neckLow: tube(0.18, 0.13, 1.0, 'up'),
      neckHigh: tube(0.13, 0.09, 0.8, 'up'),
      head: bodyGeometry(0.19, 0.16, 0.34, 10, 7),
      whites: ln.whites,
      pupils: ln.pupils,
      tailBase: tube(0.22, 0.11, 1.0, 'back'),
      tailTip: tube(0.11, 0.015, 1.1, 'back'),
      leg: stompLeg(0.15, 0.14, 0.85),
    },
    triceratops: {
      body: bodyGeometry(0.3, 0.26, 0.47, 14, 10),
      head: bodyGeometry(0.17, 0.14, 0.26, 10, 7),
      frill: frillGeometry(0.66, 0.38),
      plate: frillGeometry(0.66, 0.38).scale(0.55, 0.55, 1).translate(0, 0.012, 0.006),
      beak: spike(0.07, 0.17, 7),
      horns: merged([
        spike(0.032, 0.28).rotateX(Math.PI / 2 - 0.55).translate(-0.09, 0.09, 0.2),
        spike(0.032, 0.28).rotateX(Math.PI / 2 - 0.55).translate(0.09, 0.09, 0.2),
        spike(0.03, 0.13).rotateX(Math.PI / 2 - 0.75).translate(0, 0.07, 0.3),
      ]),
      whites: tr.whites,
      pupils: tr.pupils,
      tail: tube(0.1, 0.02, 0.45, 'back'),
      leg: stompLeg(0.075, 0.07, 0.26),
    },
    raptor: {
      body: bodyGeometry(0.11, 0.11, 0.25, 12, 8),
      neck: tube(0.06, 0.045, 0.2, 'up', 7),
      head: bodyGeometry(0.075, 0.068, 0.16, 10, 7),
      crest: crestGeometry().scale(1.4, 1.4, 1),
      whites: ra.whites,
      pupils: ra.pupils,
      arms: pair(() => tube(0.02, 0.014, 0.1, 'down', 5).rotateX(-0.9).rotateZ(0.25), 0.1),
      tail: tube(0.06, 0.012, 0.52, 'back', 7),
      leg: raptorLeg(),
      claw: spike(0.012, 0.055, 5).rotateX(0.9),
    },
    pterodactyl: {
      body: bodyGeometry(0.085, 0.07, 0.3, 10, 7),
      head: bodyGeometry(0.06, 0.055, 0.1, 8, 6),
      beak: spike(0.035, 0.3, 6).rotateX(Math.PI / 2),
      crest: pteroCrestGeometry(),
      whites: pt.whites,
      pupils: pt.pupils,
      wingL: wingGeometry(-1),
      wingR: wingGeometry(1),
      legs: pair(() => tube(0.016, 0.01, 0.14, 'back', 5).rotateX(-0.4), 0.035),
    },
  };
}

let kit: DinoGeometries | null = null;
/** The one set of geometries every dinosaur on the board shares. */
export function dinoGeometries(): DinoGeometries {
  if (!kit) kit = buildDinoGeometries();
  return kit;
}

/** Every geometry in the kit, flat, with where it came from. */
export function listDinoGeometries(): { kind: DinoKind; part: string; geometry: THREE.BufferGeometry }[] {
  const out: { kind: DinoKind; part: string; geometry: THREE.BufferGeometry }[] = [];
  const g = dinoGeometries();
  for (const kind of Object.keys(g) as DinoKind[]) {
    for (const [part, geometry] of Object.entries(g[kind])) out.push({ kind, part, geometry });
  }
  return out;
}

/* ── materials ─────────────────────────────────────────────────────── */

export interface DinoMaterials {
  /** The painted hide of each kind. */
  skin: Record<DinoKind, THREE.MeshStandardMaterial>;
  /** Legs and arms: the hide's dark tone, flat. */
  hide: Record<DinoKind, THREE.MeshStandardMaterial>;
  /** Crests: the mark tone, flat, seen from both sides. */
  mark: Record<DinoKind, THREE.MeshStandardMaterial>;
  frill: THREE.MeshStandardMaterial;
  wing: THREE.MeshStandardMaterial;
  bone: THREE.MeshStandardMaterial;
  eye: THREE.MeshStandardMaterial;
  pupil: THREE.MeshStandardMaterial;
}

const KINDS: DinoKind[] = ['longNeck', 'triceratops', 'raptor', 'pterodactyl'];

function perKind(make: (kind: DinoKind) => THREE.MeshStandardMaterial): Record<DinoKind, THREE.MeshStandardMaterial> {
  const out = {} as Record<DinoKind, THREE.MeshStandardMaterial>;
  for (const kind of KINDS) out[kind] = make(kind);
  return out;
}

let materials: DinoMaterials | null = null;
/** The one set of materials every dinosaur on the board shares. */
export function dinoMaterials(): DinoMaterials {
  if (materials) return materials;
  materials = {
    skin: perKind((kind) => new THREE.MeshStandardMaterial({ map: skinTexture(kind), roughness: 0.8 })),
    hide: perKind((kind) => {
      const c = new THREE.Color(DINO_SKINS[kind].base).lerp(new THREE.Color(DINO_SKINS[kind].mark), 0.45);
      return new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });
    }),
    mark: perKind(
      (kind) => new THREE.MeshStandardMaterial({ color: DINO_SKINS[kind].mark, roughness: 0.8, side: THREE.DoubleSide }),
    ),
    frill: new THREE.MeshStandardMaterial({ color: '#e8a04c', roughness: 0.8, side: THREE.DoubleSide }),
    wing: new THREE.MeshStandardMaterial({ map: wingTexture(), roughness: 0.75, side: THREE.DoubleSide }),
    bone: new THREE.MeshStandardMaterial({ color: '#f2ead2', roughness: 0.6 }),
    eye: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 }),
    pupil: new THREE.MeshStandardMaterial({ color: '#1b1b1b', roughness: 0.4 }),
  };
  return materials;
}

/* ── gait ──────────────────────────────────────────────────────────── */

/**
 * How a walker moves, in world units: `pace` along the lane a second,
 * `stride` the distance one full cycle (every foot forward once)
 * covers, `swing` the leg's reach in radians, and the small bob, roll,
 * tail sway and head nod that go with each step. The feet keep up
 * with the ground when stride is about four times a leg's reach.
 */
export interface Gait {
  pace: number;
  stride: number;
  swing: number;
  bob: number;
  roll: number;
  tail: number;
  nod: number;
}

export const LONG_NECK_GAIT: Gait = { pace: 0.3, stride: 0.72, swing: 0.34, bob: 0.025, roll: 0.03, tail: 0.28, nod: 0.06 };
export const TRICERATOPS_GAIT: Gait = { pace: 0.3, stride: 0.5, swing: 0.5, bob: 0.02, roll: 0.035, tail: 0.3, nod: 0.08 };
export const RAPTOR_GAIT: Gait = { pace: 1.1, stride: 0.62, swing: 0.8, bob: 0.04, roll: 0, tail: 0.12, nod: 0.12 };

export interface Pose {
  /** Hip angles, radians, forward positive: front-left, front-right, back-left, back-right. */
  legs: [number, number, number, number];
  bob: number;
  roll: number;
  nod: number;
  tail: number;
  tailTip: number;
}

export function newPose(): Pose {
  return { legs: [0, 0, 0, 0], bob: 0, roll: 0, nod: 0, tail: 0, tailTip: 0 };
}

/**
 * The pose `walked` units along the lane. Diagonal legs move together,
 * front-left with back-right, the way a walking animal's do; a biped
 * uses the first two. Writes into `out` and allocates nothing.
 */
export function gait(g: Gait, walked: number, out: Pose): void {
  const phase = (walked / g.stride) * Math.PI * 2;
  const s = Math.sin(phase);
  out.legs[0] = s * g.swing;
  out.legs[1] = -s * g.swing;
  out.legs[2] = -s * g.swing;
  out.legs[3] = s * g.swing;
  // Two footfalls a cycle lift the body twice and nod the head twice.
  out.bob = Math.abs(s) * g.bob;
  out.roll = s * g.roll;
  out.nod = Math.sin(phase * 2 - 0.6) * g.nod;
  // The tail follows the hips a little late, the tip later still.
  out.tail = Math.sin(phase - 0.4) * g.tail;
  out.tailTip = Math.sin(phase - 1.3) * g.tail * 1.5;
}
