import * as THREE from 'three';
import { MOAT, MOUND } from '../game/obstacles';
import type { MoundKind, ObstacleLook, PitKind } from './obstacleLooks';
import { createPitMaterial, PitMode } from './pitShader';

/**
 * The two traps, drawn as each board's own hazard.
 *
 * Request, 18 Oct 2026: "make sure each trap matches its board name"
 * (docs/board-redesign.md). Until then every bump was the same plain
 * sphere and every pit the same flat square, only recoloured, so the
 * Volcano Rim's lava was an orange tile and the Moon Base's boulder a
 * grey ball.
 *
 * THE PHYSICS DOES NOT CHANGE, and these shapes are built to respect it:
 *
 * - The bump is a cannon sphere of radius MOUND.radius whose centre is
 *   MOUND.buried below the floor. Every piece a die could touch is pushed
 *   down until it sits INSIDE that sphere (`dropToFit` below), so nothing
 *   drawn sticks out where the physics has nothing. Only `crown` pieces
 *   are exempt: ones near the middle of the top, or high above it (a
 *   flag), where a die skidding off the dome never gets.
 * - The pit is a MOAT.size square hole. Its inside is one shader
 *   (pitShader.ts) lying exactly over the hole, and everything else here
 *   sits AROUND it. Nothing hangs over the opening below 0.3, except
 *   `float` pieces lying flat on a pond's surface.
 *
 * tests/hazards.test.ts builds every one of the forty and checks both
 * rules against the real vertices.
 *
 * React Native has no canvas, so there are no painted textures here:
 * pattern comes from per-face colours, from instancing, and from the pit
 * shader. Everything built is listed, and `dispose()` frees all of it.
 */

export interface BuiltHazard {
  group: THREE.Group;
  /** Shader materials that want the shared clock (see water.tsx LIVE). */
  live: THREE.ShaderMaterial[];
  dispose(): void;
}

/** What a piece is allowed to do, read by the tests. */
export interface PieceFlags {
  /** Above the dome's top, near its middle: decoration dice never reach. */
  crown?: boolean;
  /** Lies flat on a pond's surface, over the opening. */
  float?: boolean;
  /** The pit's own surface or shaft, exactly over the hole. */
  surface?: boolean;
}

const R = MOUND.radius;
const C = -MOUND.buried;
/** Just inside the physics sphere, so a fitted piece never pokes out. */
const FIT_R = R * 0.997;
/** Polar angle at which the sphere meets the floor. */
const THETA_FLOOR = Math.acos(-C / R);
/** Radius of the bump where it meets the floor. */
export const MOUND_FOOT = Math.sqrt(R * R - C * C);
/** Height of the bump's top. */
export const MOUND_TOP = R + C;
/** Half the side of the pit's square hole. */
const H = MOAT.size / 2;

/** Height of the dome's surface at horizontal distance r from its middle. */
export function domeHeight(r: number): number {
  return Math.sqrt(Math.max(R * R - r * r, 0)) + C;
}

/** Deterministic random numbers, so a board looks the same every round. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const UP = new THREE.Vector3(0, 1, 0);

/**
 * How far a piece must drop to sit inside the physics sphere, given its
 * vertices already placed in the trap's own space. Exact rather than
 * iterated: lowering a piece leaves each vertex's distance from the
 * axis unchanged, so each vertex has one height it must get under.
 */
function dropToFit(points: THREE.Vector3[]): number {
  let drop = 0;
  for (const v of points) {
    if (v.y <= 0) continue;
    const rr = v.x * v.x + v.z * v.z;
    const ceiling = rr < FIT_R * FIT_R ? Math.sqrt(FIT_R * FIT_R - rr) + C : 0;
    drop = Math.max(drop, v.y - Math.max(ceiling, 0));
  }
  return drop;
}

function verticesOf(geo: THREE.BufferGeometry, matrix: THREE.Matrix4): THREE.Vector3[] {
  const pos = geo.getAttribute('position');
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < pos.count; i++) {
    out.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(matrix));
  }
  return out;
}

/** Give every triangle one flat colour, chosen from its centre and normal. */
function paintFaces(
  geo: THREE.BufferGeometry,
  pick: (centre: THREE.Vector3, normal: THREE.Vector3) => THREE.Color,
): THREE.BufferGeometry {
  const flat = geo.index ? geo.toNonIndexed() : geo;
  if (flat !== geo) geo.dispose();
  flat.computeVertexNormals();
  const pos = flat.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const centre = new THREE.Vector3();
  const normal = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    centre.copy(a).add(b).add(c).divideScalar(3);
    normal.copy(c).sub(b).cross(a.clone().sub(b)).normalize();
    const col = pick(centre, normal);
    for (let k = 0; k < 3; k++) {
      colors[(i + k) * 3] = col.r;
      colors[(i + k) * 3 + 1] = col.g;
      colors[(i + k) * 3 + 2] = col.b;
    }
  }
  flat.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return flat;
}

/** Colour every vertex (smooth blends rather than flat facets). */
function paintVertices(
  geo: THREE.BufferGeometry,
  pick: (p: THREE.Vector3) => THREE.Color,
): THREE.BufferGeometry {
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const col = pick(p.fromBufferAttribute(pos, i));
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

function smooth(e0: number, e1: number, x: number): number {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
}

/** Normals pointing straight out from the middle, for soft round shading. */
function smoothNormals(geo: THREE.BufferGeometry) {
  const pos = geo.getAttribute('position');
  const normals = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    normals[i * 3] = v.x;
    normals[i * 3 + 1] = v.y;
    normals[i * 3 + 2] = v.z;
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
}

/**
 * A rock: a polyhedron inscribed in the physics sphere, with its corners
 * pulled inward by a stable random amount. Inscribed means it can never
 * poke outside the sphere; the pulled corners are what make it a rock
 * rather than a ball. Corners shared by several faces move together
 * (keyed by position), so the surface does not tear.
 */
function rockGeometry(seed: number, detail: number, jitter: (r: () => number) => number) {
  const geo = new THREE.IcosahedronGeometry(FIT_R, detail);
  const pos = geo.getAttribute('position');
  const rand = rng(seed);
  const moved = new Map<string, number>();
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
    let k = moved.get(key);
    if (k === undefined) {
      k = 1 - jitter(rand);
      moved.set(key, k);
    }
    v.multiplyScalar(k);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

/** A turned shape (gumdrop, haystack, mushroom cap), kept inside the dome. */
function latheInDome(profile: [number, number][], segments: number, inset = 1) {
  const fit = FIT_R * inset;
  const pts = profile.map(([r, y]) => {
    const limit = Math.sqrt(Math.max(fit * fit - (y - C) * (y - C), 0));
    return new THREE.Vector2(Math.min(r, limit), y);
  });
  // Open at the bottom on purpose: a closing disc on the floor shares its
  // rim vertex with the sides, and the averaged normal there shades the
  // whole foot of the shape as a dark outline.
  return new THREE.LatheGeometry(pts, segments);
}

/**
 * The visible dome itself, from `fromAngle` (0 = the top) down to the
 * floor. `inset` shrinks it about the sphere's centre, leaving a skin
 * for leaves, coins or sugar to sit in: anything scattered on a dome the
 * full size of the physics sphere has to be pushed inside it, which
 * buries it in the dome and hides it.
 */
function domeGeometry(widthSegments = 28, heightSegments = 10, fromAngle = 0, inset = 1) {
  return new THREE.SphereGeometry(
    FIT_R * inset,
    widthSegments,
    heightSegments,
    0,
    Math.PI * 2,
    fromAngle,
    THETA_FLOOR + 0.03 - fromAngle,
  );
}

/** A point on the dome's surface and the way it faces. */
function onDome(r: number, angle: number) {
  const y = domeHeight(r);
  const p = new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r);
  const n = new THREE.Vector3(p.x, p.y - C, p.z).normalize();
  return { p, n };
}

interface Item {
  position: THREE.Vector3;
  /** Which way the item's own +Y points. */
  up?: THREE.Vector3;
  spin?: number;
  scale?: THREE.Vector3 | number;
  color?: THREE.Color | string;
}

const col = (hex: string) => new THREE.Color(hex);
const mixed = (a: string, b: string, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), t);

/** Collects what a trap is made of, so all of it can be freed. */
class Kit {
  group = new THREE.Group();
  private geos: THREE.BufferGeometry[] = [];
  private mats: THREE.Material[] = [];
  live: THREE.ShaderMaterial[] = [];

  constructor(private readonly mound: boolean) {}

  geo<T extends THREE.BufferGeometry>(g: T): T {
    this.geos.push(g);
    return g;
  }

  std(
    color: string,
    o: {
      rough?: number;
      metal?: number;
      emissive?: string;
      glow?: number;
      flat?: boolean;
      painted?: boolean;
      opacity?: number;
      side?: THREE.Side;
    } = {},
  ) {
    const m = new THREE.MeshStandardMaterial({
      color: o.painted ? '#ffffff' : color,
      roughness: o.rough ?? 0.85,
      metalness: o.metal ?? 0,
      flatShading: o.flat ?? false,
      vertexColors: o.painted ?? false,
      side: o.side ?? THREE.FrontSide,
    });
    if (o.emissive) {
      m.emissive = new THREE.Color(o.emissive);
      m.emissiveIntensity = o.glow ?? 1;
    }
    if (o.opacity !== undefined && o.opacity < 1) {
      m.transparent = true;
      m.opacity = o.opacity;
      m.depthWrite = false;
    }
    this.mats.push(m);
    return m;
  }

  /** Unlit: for things that give off light (lamps, flames, glow). */
  basic(color: string, o: { opacity?: number; additive?: boolean; side?: THREE.Side } = {}) {
    const m = new THREE.MeshBasicMaterial({ color, side: o.side ?? THREE.FrontSide });
    if (o.opacity !== undefined || o.additive) {
      m.transparent = true;
      m.opacity = o.opacity ?? 1;
      m.depthWrite = false;
    }
    if (o.additive) m.blending = THREE.AdditiveBlending;
    this.mats.push(m);
    return m;
  }

  shader(m: THREE.ShaderMaterial, live = true) {
    this.mats.push(m);
    if (live) this.live.push(m);
    return m;
  }

  mesh(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    at: [number, number, number] = [0, 0, 0],
    o: { rot?: [number, number, number]; scale?: [number, number, number] | number; flags?: PieceFlags } = {},
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(this.geo(geo), mat);
    mesh.position.set(...at);
    if (o.rot) mesh.rotation.set(...o.rot);
    if (o.scale !== undefined) {
      if (typeof o.scale === 'number') mesh.scale.setScalar(o.scale);
      else mesh.scale.set(...o.scale);
    }
    mesh.userData.hazard = o.flags ?? {};
    if (this.mound && !o.flags?.crown) {
      mesh.updateMatrix();
      mesh.position.y -= dropToFit(verticesOf(geo, mesh.matrix));
    }
    mesh.updateMatrix();
    this.group.add(mesh);
    return mesh;
  }

  /** Many copies of one shape in ONE draw call, each with its own colour. */
  scatter(geo: THREE.BufferGeometry, mat: THREE.Material, items: Item[], flags: PieceFlags = {}) {
    const mesh = new THREE.InstancedMesh(this.geo(geo), mat, items.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const spin = new THREE.Quaternion();
    const s = new THREE.Vector3();
    items.forEach((it, i) => {
      q.setFromUnitVectors(UP, it.up ?? UP);
      spin.setFromAxisAngle(UP, it.spin ?? 0);
      q.multiply(spin);
      if (it.scale instanceof THREE.Vector3) s.copy(it.scale);
      else s.setScalar(it.scale ?? 1);
      m.compose(it.position, q, s);
      if (this.mound && !flags.crown) {
        const drop = dropToFit(verticesOf(geo, m));
        if (drop > 0) {
          it.position.y -= drop;
          m.compose(it.position, q, s);
        }
      }
      mesh.setMatrixAt(i, m);
      if (it.color !== undefined) mesh.setColorAt(i, typeof it.color === 'string' ? col(it.color) : it.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.userData.hazard = flags;
    // Instances spread past the one shape's bounds; without this the
    // whole set can be culled when the shape's own box leaves the view.
    mesh.frustumCulled = false;
    this.group.add(mesh);
    return mesh;
  }

  done(): BuiltHazard {
    const { group, live, geos, mats } = this;
    return {
      group,
      live,
      dispose: () => {
        for (const g of geos) g.dispose();
        for (const m of mats) m.dispose();
        group.traverse((o) => {
          if (o instanceof THREE.InstancedMesh) o.dispose();
        });
      },
    };
  }
}

/* ────────────────────────── shared pieces ────────────────────────── */

/** A pennant on a pole, standing on the very top (or on `base`). */
function pennant(kit: Kit, pole: string, flag: string, height = 0.5, size = 1, base = MOUND_TOP - 0.04) {
  kit.mesh(new THREE.CylinderGeometry(0.022, 0.026, height, 6), kit.std(pole, { rough: 0.7 }), [0, base + height / 2, 0], {
    flags: { crown: true },
  });
  const tri = new THREE.BufferGeometry();
  tri.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0.26 * size, -0.1 * size, 0, 0, -0.22 * size, 0]), 3),
  );
  tri.computeVertexNormals();
  // Square to the camera, which looks down from in front: turned any
  // further and a flag seen from that high up is a thin line.
  kit.mesh(tri, kit.std(flag, { side: THREE.DoubleSide, rough: 0.8 }), [0.01, base + height - 0.01, 0], {
    rot: [-0.3, -0.15, 0],
    flags: { crown: true },
  });
}

/** Random spots on the dome, between two distances from its middle. */
function domeSpots(seed: number, count: number, rMin: number, rMax: number) {
  const rand = rng(seed);
  return Array.from({ length: count }, () => {
    const r = Math.sqrt(rMin * rMin + rand() * (rMax * rMax - rMin * rMin));
    return { ...onDome(r, rand() * Math.PI * 2), rand };
  });
}

function leafShape() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.quadraticCurveTo(0.42, -0.05, 0, 0.5);
  s.quadraticCurveTo(-0.42, -0.05, 0, -0.5);
  const g = new THREE.ShapeGeometry(s, 4);
  g.rotateX(-Math.PI / 2);
  return g;
}

function starShape(arms: number, outer: number, inner: number) {
  const s = new THREE.Shape();
  for (let i = 0; i <= arms * 2; i++) {
    const a = (i / (arms * 2)) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return s;
}

/* ─────────────────────────────── bumps ───────────────────────────── */

type MoundLook = ObstacleLook['mound'];

const MOUNDS: Record<MoundKind, (kit: Kit, look: MoundLook) => void> = {
  // A grassy hill with a little pennant: the castle's own lawn.
  hill: (kit, look) => {
    const rand = rng(11);
    const dome = paintVertices(domeGeometry(28, 10, 0, 0.95), (p) =>
      mixed(look.color, '#4f7a3e', 0.45 - 0.45 * (p.y / R) + rand() * 0.12),
    );
    kit.mesh(dome, kit.std('#ffffff', { painted: true, rough: look.roughness }), [0, C, 0]);
    const tufts = domeSpots(12, 30, 0.1, 0.84).map(({ p, n, rand: r }) => ({
      position: p,
      up: n,
      spin: r() * 6,
      scale: new THREE.Vector3(0.09 + r() * 0.05, 0.04, 0.07 + r() * 0.04),
      color: r() > 0.5 ? '#6a9a52' : '#a2cf80',
    }));
    kit.scatter(new THREE.SphereGeometry(1, 7, 5), kit.std('#ffffff', { rough: 0.9 }), tufts);
    const flowers = domeSpots(13, 12, 0.15, 0.8).map(({ p, rand: r }, i) => ({
      position: p,
      scale: 1.3 + r() * 0.5,
      color: ['#f4eedf', '#f2b6c8', '#f2d36b'][i % 3],
    }));
    kit.scatter(new THREE.SphereGeometry(0.028, 6, 4), kit.std('#ffffff', { rough: 0.6 }), flowers);
    pennant(kit, '#6b5a48', '#d0503f', 0.8, 2.3);
  },

  // A heap of fallen castle stones with ivy growing over it.
  rubble: (kit, look) => {
    kit.mesh(domeGeometry(20, 8, 0, 0.86), kit.std('#5e554b', { rough: 1 }), [0, C, 0]);
    const rand = rng(21);
    const stones = ['#b0a491', '#9a8e7d', '#c2b6a0', '#8a7f72'];
    for (let i = 0; i < 12; i++) {
      const r = i === 0 ? 0 : 0.2 + rand() * 0.6;
      const { p } = onDome(r, rand() * Math.PI * 2);
      const sx = 0.3 + rand() * 0.16;
      kit.mesh(
        new THREE.BoxGeometry(sx, 0.2 + rand() * 0.08, 0.24 + rand() * 0.1),
        kit.std(stones[i % stones.length], { rough: 0.95, flat: true }),
        [p.x, p.y + 0.02, p.z],
        { rot: [rand() * 0.5 - 0.25, rand() * Math.PI, rand() * 0.5 - 0.25] },
      );
    }
    const ivy = domeSpots(22, 11, 0.1, 0.84).map(({ p, n, rand: r }) => ({
      position: p,
      up: n,
      spin: r() * 6,
      scale: new THREE.Vector3(0.13 + r() * 0.06, 0.05, 0.1 + r() * 0.05),
      color: r() > 0.5 ? '#5a8a4c' : '#78a85e',
    }));
    kit.scatter(new THREE.SphereGeometry(1, 7, 5), kit.std('#ffffff', { rough: 0.8 }), ivy);
    void look;
  },

  // A mossy tree stump: bark sides, growth rings on top, moss at its foot.
  stump: (kit, look) => {
    const stumpR = 0.5;
    const top = domeHeight(stumpR) - 0.012;
    const rand = rng(31);
    const moss = paintVertices(domeGeometry(28, 6, Math.asin(stumpR / R) + 0.02), () =>
      mixed(look.color, '#3f5a2c', rand() * 0.5),
    );
    kit.mesh(moss, kit.std('#ffffff', { painted: true, rough: 1 }), [0, C, 0]);
    const bark = paintFaces(new THREE.CylinderGeometry(stumpR - 0.03, stumpR, top, 14, 2, true), (c) => {
      const a = Math.atan2(c.z, c.x);
      return mixed('#5a3f2a', '#3e2b1d', (Math.sin(a * 7) * 0.5 + 0.5) * 0.7);
    });
    kit.mesh(bark, kit.std('#ffffff', { painted: true, rough: 1 }), [0, top / 2, 0]);
    // Growth rings on the cut top, painted ring by ring.
    const rings = paintVertices(new THREE.RingGeometry(0.0, stumpR - 0.03, 20, 8), (p) => {
      const r = Math.hypot(p.x, p.y);
      return mixed('#d6b47a', '#9c7448', (Math.sin(r * 38) * 0.5 + 0.5) * 0.8);
    });
    kit.mesh(rings, kit.std('#ffffff', { painted: true, rough: 0.9 }), [0, top, 0], { rot: [-Math.PI / 2, 0, 0] });
    // A ring of bark lip round the cut top.
    kit.mesh(new THREE.TorusGeometry(stumpR - 0.035, 0.03, 5, 18), kit.std('#4a3322', { rough: 1 }), [0, top - 0.01, 0], {
      rot: [Math.PI / 2, 0, 0],
    });
    // A sapling growing out of it, and a moss cushion on the cut.
    kit.mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.3, 5), kit.std('#6b4f33'), [0.14, top + 0.15, -0.06], {
      flags: { crown: true },
    });
    const leaves = [0, 2.1, 4.2].map((a) => ({
      position: new THREE.Vector3(0.14 + Math.cos(a) * 0.07, top + 0.27 + a * 0.01, -0.06 + Math.sin(a) * 0.07),
      up: new THREE.Vector3(Math.cos(a), 1.4, Math.sin(a)).normalize(),
      spin: a,
      scale: new THREE.Vector3(0.14, 1, 0.14),
      color: '#6fa64a',
    }));
    kit.scatter(leafShape(), kit.std('#ffffff', { side: THREE.DoubleSide }), leaves, { crown: true });
    const cushion = domeSpots(33, 10, 0.5, 0.82).map(({ p, n, rand: r }) => ({
      position: p,
      up: n,
      scale: new THREE.Vector3(0.12 + r() * 0.05, 0.05, 0.12 + r() * 0.05),
      color: r() > 0.5 ? '#4e6f33' : '#6a8f45',
    }));
    kit.scatter(new THREE.SphereGeometry(1, 7, 5), kit.std('#ffffff', { rough: 1 }), cushion);
  },

  // A bulkhead dome in the deck plating, with a blinking beacon on top.
  bulkhead: (kit, look) => {
    const panel = paintFaces(domeGeometry(24, 8, 0, 0.975), (c) => {
      const a = Math.atan2(c.z, c.x);
      const band = Math.floor((a + Math.PI) / (Math.PI / 3)) % 2;
      const ring = c.y > 0.25 ? 1 : 0;
      return mixed(look.color, '#6c7384', (band + ring) % 2 === 0 ? 0 : 0.35);
    });
    kit.mesh(panel, kit.std('#ffffff', { painted: true, rough: look.roughness, metal: look.metalness }), [0, C, 0]);
    // Seams and a heavy base ring.
    for (const y of [0.18, 0.36]) {
      const r = domeHeight(0) > y ? Math.sqrt(FIT_R * FIT_R - (y - C) * (y - C)) : 0;
      kit.mesh(new THREE.TorusGeometry(r - 0.012, 0.014, 4, 32), kit.std('#454c5c', { metal: 0.6, rough: 0.4 }), [0, y, 0], {
        rot: [Math.PI / 2, 0, 0],
      });
    }
    kit.mesh(new THREE.TorusGeometry(MOUND_FOOT - 0.05, 0.05, 6, 32), kit.std('#3b4150', { metal: 0.5, rough: 0.5 }), [0, 0.02, 0], {
      rot: [Math.PI / 2, 0, 0],
    });
    const bolts = Array.from({ length: 16 }, (_, i) => {
      const { p, n } = onDome(0.72, (i / 16) * Math.PI * 2);
      return { position: p, up: n, color: '#2f3442' };
    });
    kit.scatter(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 6), kit.std('#ffffff', { metal: 0.6, rough: 0.4 }), bolts);
    // The beacon: a collar, a lamp that blinks, and a glow on the dome.
    kit.mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.07, 10), kit.std('#3b4150', { metal: 0.6, rough: 0.4 }), [0, MOUND_TOP + 0.01, 0], {
      flags: { crown: true },
    });
    const lamp = kit.shader(blinkMaterial('#ff6a4d', 0.9, false));
    kit.mesh(new THREE.SphereGeometry(0.075, 12, 8), lamp, [0, MOUND_TOP + 0.09, 0], { flags: { crown: true } });
    const halo = kit.shader(blinkMaterial('#ff6a4d', 0.9, true));
    kit.mesh(new THREE.CircleGeometry(0.34, 20), halo, [0, MOUND_TOP + 0.02, 0], {
      rot: [-Math.PI / 2, 0, 0],
      flags: { crown: true },
    });
  },

  // A wind-rippled sand dune with a little cactus on its crest.
  dune: (kit, look) => {
    const geo = domeGeometry(32, 14);
    const pos = geo.getAttribute('position');
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      // Ripples pull the surface IN, never out, so it stays in the sphere.
      const k = 1 - 0.022 * (0.5 + 0.5 * Math.sin(v.x * 15 + v.z * 5));
      v.multiplyScalar(k);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    paintVertices(geo, (p) => mixed(look.color, '#b98c48', 0.5 + 0.5 * Math.sin(p.x * 15 + p.z * 5)));
    kit.mesh(geo, kit.std('#ffffff', { painted: true, rough: 1 }), [0, C, 0]);
    const cactus = kit.std('#4f8a4a', { rough: 0.7 });
    const base = MOUND_TOP - 0.05;
    const g = 1.5;
    kit.mesh(new THREE.CapsuleGeometry(0.075 * g, 0.34 * g, 4, 10), cactus, [0.05, base + 0.24 * g, 0], { flags: { crown: true } });
    kit.mesh(new THREE.CapsuleGeometry(0.05 * g, 0.12 * g, 4, 8), cactus, [0.05 + 0.15 * g, base + 0.3 * g, 0], { flags: { crown: true } });
    kit.mesh(new THREE.CapsuleGeometry(0.045 * g, 0.1 * g, 4, 8), cactus, [0.05 + 0.09 * g, base + 0.22 * g, 0], {
      rot: [0, 0, Math.PI / 2],
      flags: { crown: true },
    });
    kit.mesh(new THREE.CapsuleGeometry(0.045 * g, 0.1 * g, 4, 8), cactus, [0.05 - 0.13 * g, base + 0.36 * g, 0], { flags: { crown: true } });
    kit.mesh(new THREE.CapsuleGeometry(0.04 * g, 0.08 * g, 4, 8), cactus, [0.05 - 0.08 * g, base + 0.3 * g, 0], {
      rot: [0, 0, Math.PI / 2],
      flags: { crown: true },
    });
    kit.mesh(new THREE.SphereGeometry(0.05, 8, 6), kit.std('#f2a3b8', { rough: 0.6 }), [0.05, base + 0.52 * g, 0], {
      flags: { crown: true },
    });
  },

  // A heap of autumn leaves.
  leafPile: (kit, look) => {
    kit.mesh(domeGeometry(20, 8, 0, 0.95), kit.std(mixed(look.color, '#5a3a1e', 0.4).getStyle(), { rough: 1 }), [0, C, 0]);
    const hues = ['#c8502e', '#d9822b', '#e3a83a', '#a8432a', '#b86b2a', '#d4652a'];
    const leaves = domeSpots(41, 70, 0, 0.86).map(({ p, n, rand: r }) => ({
      position: p,
      up: n.clone().add(new THREE.Vector3(r() - 0.5, 0, r() - 0.5).multiplyScalar(0.5)).normalize(),
      spin: r() * Math.PI * 2,
      scale: new THREE.Vector3(0.2 + r() * 0.08, 1, 0.2 + r() * 0.08),
      color: hues[Math.floor(r() * hues.length)],
    }));
    kit.scatter(leafShape(), kit.std('#ffffff', { rough: 0.8, side: THREE.DoubleSide }), leaves);
    // A few leaves on top, tumbling off.
    const crown = [0, 1, 2].map((i) => ({
      position: new THREE.Vector3(Math.cos(i * 2.1) * 0.12, MOUND_TOP + 0.03 + i * 0.015, Math.sin(i * 2.1) * 0.12),
      up: new THREE.Vector3(Math.cos(i * 2.1) * 0.6, 1, Math.sin(i * 2.1) * 0.6).normalize(),
      spin: i * 1.3,
      scale: new THREE.Vector3(0.24, 1, 0.24),
      color: hues[i * 2],
    }));
    kit.scatter(leafShape(), kit.std('#ffffff', { rough: 0.8, side: THREE.DoubleSide }), crown, { crown: true });
  },

  // A faceted ice boulder with snow lying on its top faces.
  iceBoulder: (kit, look) => {
    const geo = paintFaces(
      rockGeometry(51, 1, (r) => r() * 0.1),
      (c, n) => {
        if (n.y > 0.72) return mixed('#f4f9fc', '#dce9f2', Math.abs(c.x) * 0.3);
        return mixed(look.color, '#6fb2c8', (Math.sin(c.x * 9 + c.z * 4) * 0.5 + 0.5) * 0.6);
      },
    );
    kit.mesh(geo, kit.std('#ffffff', { painted: true, rough: 0.25, metal: 0.05, flat: true, emissive: '#57e8a9', glow: 0.06 }), [
      0,
      C,
      0,
    ]);
    const sparkles = domeSpots(52, 7, 0.2, 0.7).map(({ p }) => ({ position: p, color: '#ffffff' }));
    kit.scatter(new THREE.OctahedronGeometry(0.025), kit.basic('#ffffff'), sparkles);
  },

  // A cluster of glowing crystals growing out of dark rock.
  crystals: (kit, look) => {
    kit.mesh(
      paintFaces(rockGeometry(61, 1, (r) => 0.1 + r() * 0.1), () => mixed(look.color, '#2c2440', 0.5)),
      kit.std('#ffffff', { painted: true, rough: 0.9, flat: true }),
      [0, C, 0],
    );
    const crystal = new THREE.LatheGeometry(
      [new THREE.Vector2(0, -0.1), new THREE.Vector2(1, -0.1), new THREE.Vector2(1, 0.75), new THREE.Vector2(0, 1)],
      6,
    );
    const hues = ['#b98aff', '#8fd8ff', '#d79bff', '#9fb2ff'];
    const mat = kit.std('#ffffff', { rough: 0.2, metal: 0.1, flat: true, emissive: '#8a5ce0', glow: 0.85 });
    const big = [
      { x: 0, z: 0, h: 0.62, w: 0.15, tilt: [0.1, 0.25] },
      { x: 0.14, z: 0.06, h: 0.44, w: 0.12, tilt: [0.7, 0.3] },
      { x: -0.13, z: 0.08, h: 0.4, w: 0.11, tilt: [-0.7, 0.4] },
      { x: 0.02, z: -0.15, h: 0.38, w: 0.11, tilt: [0.15, -0.7] },
      { x: -0.08, z: -0.08, h: 0.3, w: 0.09, tilt: [-0.5, -0.5] },
    ].map((c, i) => ({
      position: new THREE.Vector3(c.x, MOUND_TOP - 0.12, c.z),
      up: new THREE.Vector3(c.tilt[0], 1, c.tilt[1]).normalize(),
      spin: i,
      scale: new THREE.Vector3(c.w, c.h, c.w),
      color: hues[i % hues.length],
    }));
    kit.scatter(crystal, mat, big, { crown: true });
    // Smaller crystals lying along the slope, pointing downhill, so from
    // above they show their length rather than their tips.
    const small = domeSpots(62, 14, 0.3, 0.75).map(({ p, n, rand: r }, i) => {
      const downhill = new THREE.Vector3(p.x, 0, p.z).normalize().multiplyScalar(0.8).add(n.clone().multiplyScalar(0.6));
      return {
        position: p,
        up: downhill.normalize(),
        spin: r() * 3,
        scale: new THREE.Vector3(0.08 + r() * 0.03, 0.26 + r() * 0.12, 0.08 + r() * 0.03),
        color: hues[i % hues.length],
      };
    });
    kit.scatter(crystal.clone(), mat, small);
  },

  // A big puffy cloud: lumps of cloud, each tucked inside the sphere.
  cloud: (kit, look) => {
    const mat = kit.std('#ffffff', { rough: 1, emissive: '#ffffff', glow: 0.04 });
    const lumps: Item[] = [];
    const rand = rng(71);
    // Lumps whose surfaces touch the inside of the physics sphere: the
    // low ring in the blue-grey of a cloud's underside, the upper ones
    // white, so the light picks out every puff.
    for (const [n, elev0, r0, tint] of [
      [10, 0.6, 0.3, '#c3d4e6'],
      [7, 0.95, 0.3, look.color],
    ] as const) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rand() * 0.4;
        const elev = elev0 + rand() * 0.12;
        const r = r0 + rand() * 0.1;
        const dir = new THREE.Vector3(Math.cos(a) * Math.cos(elev), Math.sin(elev), Math.sin(a) * Math.cos(elev));
        lumps.push({ position: dir.multiplyScalar(FIT_R - r).add(new THREE.Vector3(0, C, 0)), scale: r, color: tint });
      }
    }
    lumps.push({ position: new THREE.Vector3(0, C, 0), scale: FIT_R * 0.9, color: '#dbe7f2' });
    kit.scatter(new THREE.SphereGeometry(1, 16, 10), mat, lumps);
    const puffs = [
      { x: 0, z: 0, y: 0.08, r: 0.22 },
      { x: 0.16, z: 0.05, y: 0.03, r: 0.16 },
      { x: -0.15, z: -0.04, y: 0.02, r: 0.15 },
    ].map((p) => ({ position: new THREE.Vector3(p.x, MOUND_TOP + p.y - 0.05, p.z), scale: p.r, color: '#ffffff' }));
    kit.scatter(new THREE.SphereGeometry(1, 14, 8), mat, puffs, { crown: true });
  },

  // A grey moon boulder pocked with little craters.
  boulder: (kit, look) => {
    const craters = [
      new THREE.Vector3(0.5, 0.75, 0.3),
      new THREE.Vector3(-0.6, 0.6, 0.4),
      new THREE.Vector3(0.1, 0.8, -0.6),
      new THREE.Vector3(-0.2, 0.95, 0.1),
      new THREE.Vector3(0.75, 0.55, -0.3),
    ].map((v) => v.normalize());
    // Painted per corner rather than per face, so the craters come out
    // round instead of as patches of triangles.
    const geo = paintVertices(rockGeometry(81, 7, (r) => r() * 0.03), (c) => {
      const d = c.clone().normalize();
      let shade = 0.12 + Math.sin(c.x * 11 + c.z * 7) * 0.08;
      for (const cr of craters) {
        const ang = d.angleTo(cr);
        // A dark floor, then a bright lip just outside it.
        const floor = 1 - smooth(0.15, 0.24, ang);
        const lip = Math.max(0, 1 - Math.abs(ang - 0.27) / 0.06);
        shade = Math.max(shade, floor * 0.5) - lip * 0.3;
      }
      return shade >= 0 ? mixed(look.color, '#5c606b', shade) : mixed(look.color, '#e4e6ec', -shade * 3);
    });
    // Smooth light over the flat-coloured faces: a boulder, not a gem.
    smoothNormals(geo);
    kit.mesh(geo, kit.std('#ffffff', { painted: true, rough: look.roughness }), [0, C, 0]);
  },

  // Dino Valley, 20 Oct 2026: a nest of woven twigs with three big
  // speckled dinosaur eggs sitting in it.
  eggNest: (kit, look) => {
    const rand = rng(151);
    const nest = paintVertices(domeGeometry(30, 10, 0, 0.95), (c) => {
      // Twigs woven round and round, light and dark.
      const a = Math.atan2(c.z, c.x);
      const band = Math.sin(a * 9 + c.y * 40) * 0.5 + 0.5;
      return mixed(look.color, '#5a3f22', band * 0.6 + rand() * 0.2);
    });
    kit.mesh(nest, kit.std('#ffffff', { painted: true, rough: 1 }), [0, C, 0]);
    const twigs = domeSpots(152, 46, 0.4, 0.95).map(({ p, n, rand: r }) => ({
      position: p,
      up: new THREE.Vector3(r() - 0.5, 0.15, r() - 0.5).normalize().add(n.clone().multiplyScalar(0.2)).normalize(),
      color: r() > 0.5 ? '#8a6436' : '#6a4a28',
    }));
    kit.scatter(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 3), kit.std('#ffffff', { rough: 1 }), twigs);
    const speck = rng(153);
    const shell = paintVertices(new THREE.SphereGeometry(1, 16, 12), () =>
      speck() > 0.86 ? col('#7a6a4a') : speck() > 0.7 ? col('#c8b48a') : col('#efe4c8'),
    );
    const mat = kit.std('#ffffff', { painted: true, rough: 0.55 });
    for (const [x, z, tilt, spin] of [[-0.14, 0.08, 0.35, 0.4], [0.15, 0.06, -0.3, 1.6], [0.0, -0.15, 0.2, 2.7]] as const) {
      kit.mesh(shell, mat, [x, MOUND_TOP + 0.05, z], { rot: [tilt, spin, tilt * 0.5], scale: [0.13, 0.18, 0.13], flags: { crown: true } });
    }
  },

  /*
    Season 2 of the pass, 21 Oct 2026. The Sun Temple's altar: a dome
    of cut sandstone courses with a gold sun carved on top — a disc, a
    white-hot heart and eight rays — and marigold petals strewn round
    its foot. The sun and its rays are crown pieces, kept within the
    middle of the top where a die skidding off the dome never reaches.
  */
  sunAltar: (kit, look) => {
    const rand = rng(161);
    const stone = paintVertices(domeGeometry(30, 10, 0, 0.95), (c) => {
      const course = Math.floor((c.y + 0.6) / 0.16);
      const a = Math.atan2(c.z, c.x);
      const seam =
        Math.abs(Math.sin(a * 7 + course * 1.3)) < 0.08 || Math.abs(((c.y + 0.6) % 0.16) - 0.01) < 0.012;
      return seam ? mixed(look.color, '#8a6a3a', 0.6) : mixed(look.color, '#f6e6c0', 0.45 + rand() * 0.15 + Math.max(0, c.y) * 0.25);
    });
    kit.mesh(stone, kit.std('#ffffff', { painted: true, rough: look.roughness }), [0, C, 0]);
    const gold = kit.std('#f0b240', { rough: 0.35, metal: 0.5, emissive: '#ff9a2a', glow: 0.25 });
    kit.mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.05, 20), gold, [0, MOUND_TOP + 0.01, 0], { flags: { crown: true } });
    kit.mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.07, 16),
      kit.std('#fff0b0', { rough: 0.3, emissive: '#ffd27a', glow: 0.4 }),
      [0, MOUND_TOP + 0.015, 0],
      { flags: { crown: true } },
    );
    const rays = Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return {
        position: new THREE.Vector3(Math.cos(a) * 0.3, MOUND_TOP + 0.01, Math.sin(a) * 0.3),
        up: new THREE.Vector3(Math.cos(a), 0, Math.sin(a)),
        scale: new THREE.Vector3(0.8, 1, 0.5),
      };
    });
    kit.scatter(new THREE.ConeGeometry(0.05, 0.2, 4), gold, rays, { crown: true });
    const petals = domeSpots(162, 16, 0.55, 0.86).map(({ p, n, rand: r }) => ({
      position: p,
      up: n,
      spin: r() * 6,
      scale: new THREE.Vector3(0.05 + r() * 0.03, 0.02, 0.035),
      color: r() > 0.5 ? '#f0b240' : '#e07a2a',
    }));
    kit.scatter(new THREE.SphereGeometry(1, 6, 4), kit.std('#ffffff', { rough: 0.7 }), petals);
  },

  /*
    The Moon Garden's bump: a mossy mound with moonflowers open on it
    and a stone lantern standing on top, its window lit. The lantern is
    a crown piece — pedestal, post, firebox, roof and finial all within
    the middle of the top.
  */
  moonLantern: (kit, look) => {
    const rand = rng(171);
    const moss = paintVertices(domeGeometry(28, 10, 0, 0.95), (c) =>
      mixed(look.color, '#2e4a3a', 0.35 + rand() * 0.3 - Math.max(0, c.y) * 0.3),
    );
    kit.mesh(moss, kit.std('#ffffff', { painted: true, rough: look.roughness }), [0, C, 0]);
    const flowers = domeSpots(172, 18, 0.32, 0.86).map(({ p, n, rand: r }) => ({
      position: p,
      up: n,
      scale: 0.028 + r() * 0.014,
      color: r() > 0.3 ? '#f4f4ff' : '#ffe9b0',
    }));
    kit.scatter(new THREE.SphereGeometry(1, 7, 5), kit.std('#ffffff', { rough: 0.6, emissive: '#8a98d8', glow: 0.5 }), flowers);
    const stone = kit.std('#8a93a8', { rough: 0.95 });
    const top = MOUND_TOP;
    kit.mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.1, 8), stone, [0, top + 0.04, 0], { flags: { crown: true } });
    kit.mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.22, 8), stone, [0, top + 0.2, 0], { flags: { crown: true } });
    kit.mesh(new THREE.BoxGeometry(0.26, 0.2, 0.26), kit.std('#6c758c', { rough: 0.9 }), [0, top + 0.41, 0], { flags: { crown: true } });
    kit.mesh(new THREE.BoxGeometry(0.28, 0.13, 0.2), kit.basic('#ffe9b0'), [0, top + 0.41, 0], { flags: { crown: true } });
    kit.mesh(new THREE.BoxGeometry(0.2, 0.13, 0.28), kit.basic('#ffe9b0'), [0, top + 0.41, 0], { flags: { crown: true } });
    kit.mesh(new THREE.ConeGeometry(0.26, 0.16, 6), stone, [0, top + 0.59, 0], { flags: { crown: true } });
    kit.mesh(new THREE.SphereGeometry(0.05, 8, 6), stone, [0, top + 0.7, 0], { flags: { crown: true } });
    const disc = new THREE.CircleGeometry(0.42, 18);
    disc.rotateX(-Math.PI / 2);
    kit.mesh(disc, kit.basic('#ffd27a', { additive: true, opacity: 0.35 }), [0, top + 0.012, 0], { flags: { crown: true } });
  },

  // A snowman: the dome is his bottom snowball.
  snowman: (kit, look) => {
    const snow = kit.std(look.color, { rough: 0.7 });
    kit.mesh(
      paintVertices(domeGeometry(28, 10), (p) => mixed(look.color, '#b9cfe2', Math.max(0, 0.5 - (p.y + C) * 0.9))),
      kit.std('#ffffff', { painted: true, rough: 0.7 }),
      [0, C, 0],
    );
    const mid = { y: MOUND_TOP + 0.13, r: 0.29 };
    const head = { y: mid.y + 0.4, r: 0.2 };
    const shaded = kit.std('#ffffff', { painted: true, rough: 0.7 });
    const ball = (r: number) => paintVertices(new THREE.SphereGeometry(r, 18, 12), (p) => mixed(look.color, '#a9c3da', Math.max(0, -p.y / r) * 0.8));
    kit.mesh(ball(mid.r), shaded, [0, mid.y, 0], { flags: { crown: true } });
    kit.mesh(ball(head.r), shaded, [0, head.y, 0], { flags: { crown: true } });
    const coal = kit.std('#2b2a30', { rough: 0.9 });
    const coals: Item[] = [
      { position: new THREE.Vector3(-0.075, head.y + 0.06, head.r * 0.86), scale: 1.25 },
      { position: new THREE.Vector3(0.075, head.y + 0.06, head.r * 0.86), scale: 1.25 },
      { position: new THREE.Vector3(0, mid.y + 0.1, mid.r * 0.94), scale: 1.2 },
      { position: new THREE.Vector3(0, mid.y - 0.02, mid.r * 0.99), scale: 1.2 },
    ];
    kit.scatter(new THREE.SphereGeometry(0.03, 8, 6), coal, coals, { crown: true });
    kit.mesh(new THREE.ConeGeometry(0.05, 0.24, 8), kit.std('#f08a3a', { rough: 0.6 }), [0, head.y - 0.01, head.r + 0.1], {
      rot: [Math.PI / 2, 0, 0],
      flags: { crown: true },
    });
    const scarf = kit.std('#c23b4a', { rough: 0.9 });
    kit.mesh(new THREE.TorusGeometry(0.19, 0.05, 8, 18), scarf, [0, mid.y + mid.r - 0.06, 0], {
      rot: [Math.PI / 2, 0, 0],
      flags: { crown: true },
    });
    kit.mesh(new THREE.BoxGeometry(0.09, 0.2, 0.04), scarf, [0.12, mid.y + 0.07, 0.18], {
      rot: [0.25, 0, 0.15],
      flags: { crown: true },
    });
    // A bobble hat, not a top hat: the camera looks down from in front,
    // and anything tall on his head is drawn straight over his face.
    kit.mesh(new THREE.SphereGeometry(head.r * 1.02, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3.4), scarf, [0, head.y + 0.03, -0.06], {
      flags: { crown: true },
    });
    kit.mesh(new THREE.SphereGeometry(0.055, 10, 8), kit.std('#f4eef0', { rough: 1 }), [0, head.y + head.r + 0.03, -0.08], {
      flags: { crown: true },
    });
    const twig = kit.std('#6b4a30');
    kit.mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.2, 5), twig, [0.33, mid.y + 0.08, 0], {
      rot: [0, 0, -1.0],
      flags: { crown: true },
    });
    kit.mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.2, 5), twig, [-0.33, mid.y + 0.08, 0], {
      rot: [0, 0, 1.0],
      flags: { crown: true },
    });
  },

  // A black basalt rock with lava glowing through its cracks, smoking.
  smokingRock: (kit, look) => {
    kit.mesh(new THREE.SphereGeometry(FIT_R * 0.91, 20, 12), kit.basic('#ff7a2e'), [0, C, 0]);
    const rock = paintFaces(
      rockGeometry(91, 4, (r) => (r() > 0.7 ? 0.1 + r() * 0.04 : r() * 0.025)),
      (c) => mixed(look.color, '#241a1c', 0.55 + Math.sin(c.x * 13 + c.z * 9) * 0.25),
    );
    kit.mesh(rock, kit.std('#ffffff', { painted: true, rough: 0.95, flat: true }), [0, C, 0]);
    for (let i = 0; i < 4; i++) {
      const puff = kit.shader(smokeMaterial(0.15 + i / 4));
      kit.mesh(new THREE.SphereGeometry(0.17, 10, 8), puff, [0.04, MOUND_TOP + 0.05, -0.02], { flags: { crown: true } });
    }
  },

  // A haystack: straw streaks, twine bands, a pitchfork stuck in it.
  haystack: (kit, look) => {
    const rand = rng(101);
    const stack = paintFaces(
      latheInDome(
        [
          [0.9, 0],
          [0.88, 0.1],
          [0.82, 0.2],
          [0.7, 0.31],
          [0.52, 0.4],
          [0.3, 0.46],
          [0, 0.48],
        ],
        40,
        0.95,
      ),
      () => mixed('#e3c56f', '#b88f3a', rand()),
    );
    kit.mesh(stack, kit.std('#ffffff', { painted: true, rough: 1 }), [0, 0, 0]);
    const straws = domeSpots(102, 80, 0.05, 0.86).map(({ p, n, rand: r }) => ({
      position: p,
      up: new THREE.Vector3(r() - 0.5, r() * 0.6, r() - 0.5).add(n).normalize(),
      scale: new THREE.Vector3(1, 0.7 + r() * 0.6, 1),
      color: r() > 0.5 ? '#f0d78a' : '#c9a24c',
    }));
    kit.scatter(new THREE.CylinderGeometry(0.012, 0.012, 0.26, 3), kit.std('#ffffff', { rough: 1 }), straws);
    // Pitchfork: handle leaning out of the top, tines buried.
    const wood = kit.std('#8a6340', { rough: 0.8 });
    kit.mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.75, 6), wood, [0.14, MOUND_TOP + 0.3, 0.1], {
      rot: [0.45, 0, -0.4],
      flags: { crown: true },
    });
    kit.mesh(new THREE.BoxGeometry(0.2, 0.035, 0.035), kit.std('#8d9099', { metal: 0.7, rough: 0.4 }), [0.0, MOUND_TOP - 0.02, -0.06], {
      rot: [0.45, 0, -0.4],
      flags: { crown: true },
    });
    const tuft = [0, 1, 2, 3, 4, 5].map((i) => ({
      position: new THREE.Vector3(-0.08 + i * 0.02, MOUND_TOP + 0.02, -0.06),
      up: new THREE.Vector3(Math.cos(i * 1.1) * 0.5, 1, Math.sin(i * 1.1) * 0.5).normalize(),
      color: '#e8cc78',
    }));
    kit.scatter(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 3), kit.std('#ffffff', { rough: 1 }), tuft, { crown: true });
    void look;
  },

  // A sandcastle: tiers, crenellations, a tower and a flag.
  sandcastle: (kit, look) => {
    const sand = kit.std(look.color, { rough: 1 });
    const wet = kit.std(mixed(look.color, '#a8884a', 0.35).getStyle(), { rough: 1 });
    kit.mesh(latheInDome([[0.9, 0], [0.86, 0.04], [0.7, 0.07], [0, 0.07]], 28), wet, [0, 0, 0]);
    const tiers = [
      { r: 0.76, y0: 0.05, y1: 0.14 },
      { r: 0.56, y0: 0.14, y1: 0.29 },
      { r: 0.34, y0: 0.29, y1: 0.42 },
    ];
    for (const t of tiers) {
      kit.mesh(new THREE.CylinderGeometry(t.r * 0.96, t.r, t.y1 - t.y0, 20), sand, [0, (t.y0 + t.y1) / 2, 0]);
    }
    const crenels: Item[] = [];
    for (const [t, n] of [
      [tiers[1], 10],
      [tiers[2], 7],
    ] as const) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        crenels.push({
          position: new THREE.Vector3(Math.cos(a) * (t.r - 0.06), t.y1 + 0.03, Math.sin(a) * (t.r - 0.06)),
          spin: -a,
        });
      }
    }
    kit.scatter(new THREE.BoxGeometry(0.08, 0.07, 0.08), sand, crenels);
    kit.mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.34, 16), sand, [0, 0.57, 0], { flags: { crown: true } });
    const top: Item[] = Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return { position: new THREE.Vector3(Math.cos(a) * 0.17, 0.77, Math.sin(a) * 0.17), spin: -a };
    });
    kit.scatter(new THREE.BoxGeometry(0.075, 0.08, 0.075), sand, top, { crown: true });
    pennant(kit, '#f4eedf', '#d8503f', 0.42, 1.6, 0.74);
    const shells = domeSpots(111, 5, 0.6, 0.8).map(({ p, rand: r }) => ({
      position: p,
      scale: new THREE.Vector3(1, 0.5, 1),
      color: r() > 0.5 ? '#f4c7c0' : '#f7ead8',
    }));
    kit.scatter(new THREE.SphereGeometry(0.045, 8, 5), kit.std('#ffffff', { rough: 0.5 }), shells);
  },

  // One big sugared gumdrop.
  gumdrop: (kit, look) => {
    const body = latheInDome(
      [
        [0.9, 0],
        [0.88, 0.06],
        [0.82, 0.17],
        [0.72, 0.28],
        [0.56, 0.38],
        [0.34, 0.45],
        [0, 0.48],
      ],
      36,
      0.95,
    );
    kit.mesh(body, kit.std(look.color, { rough: look.roughness, emissive: look.color, glow: 0.18 }), [0, 0, 0]);
    const sugar = domeSpots(121, 90, 0.05, 0.86).map(({ p, n, rand: r }) => ({
      position: p,
      up: n,
      spin: r() * 3,
      scale: 0.7 + r() * 0.6,
      color: '#fff6fb',
    }));
    kit.scatter(new THREE.BoxGeometry(0.03, 0.03, 0.03), kit.std('#ffffff', { rough: 0.3 }), sugar);
  },

  // A giant toadstool glowing in the dark, on a short stem.
  mushroom: (kit, look) => {
    kit.mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.2, 16), kit.std('#cfe6d4', { rough: 0.8, emissive: '#8ff0d8', glow: 0.25 }), [
      0,
      0.1,
      0,
    ]);
    const cap = latheInDome(
      [
        [0.36, 0.17],
        [0.62, 0.12],
        [0.8, 0.12],
        [0.84, 0.16],
        [0.8, 0.24],
        [0.7, 0.33],
        [0.52, 0.41],
        [0.3, 0.46],
        [0, 0.48],
      ],
      32,
      0.95,
    );
    kit.mesh(cap, kit.std(look.color, { rough: look.roughness, emissive: '#3fcfc0', glow: 0.22, side: THREE.DoubleSide }), [0, 0, 0]);
    const spots = domeSpots(131, 16, 0.08, 0.74).map(({ p, n, rand: r }) => ({
      position: p,
      up: n,
      scale: new THREE.Vector3(0.07 + r() * 0.05, 0.02, 0.07 + r() * 0.05),
      color: r() > 0.4 ? '#c9fff2' : '#f5d6ff',
    }));
    kit.scatter(new THREE.SphereGeometry(1, 10, 6), kit.basic('#ffffff'), spots);
    const spores = Array.from({ length: 6 }, (_, i) => ({
      position: new THREE.Vector3(Math.cos(i * 1.7) * 0.25, MOUND_TOP + 0.12 + (i % 3) * 0.1, Math.sin(i * 1.7) * 0.25),
      color: '#b8f0e0',
    }));
    kit.scatter(new THREE.SphereGeometry(0.022, 6, 4), kit.basic('#ffffff'), spores, { crown: true });
  },

  // A pile of gold with gems in it, and a barrel standing on top.
  treasure: (kit, look) => {
    const rand = rng(141);
    const heap = paintVertices(domeGeometry(28, 10, 0, 0.94), () => mixed('#e0b04a', '#b88a2a', rand()));
    kit.mesh(heap, kit.std('#ffffff', { painted: true, rough: 0.35, metal: 0.7 }), [0, C, 0]);
    const coins = domeSpots(142, 40, 0.05, 0.86).map(({ p, n, rand: r }) => ({
      position: p,
      up: n.clone().add(new THREE.Vector3(r() - 0.5, 0, r() - 0.5)).normalize(),
      color: r() > 0.5 ? '#f2c95a' : '#d9a845',
    }));
    kit.scatter(new THREE.CylinderGeometry(0.075, 0.075, 0.016, 10), kit.std('#ffffff', { metal: 0.8, rough: 0.3 }), coins);
    const gems = domeSpots(143, 9, 0.2, 0.8).map(({ p, rand: r }, i) => ({
      position: p,
      spin: r() * 3,
      color: ['#d0405a', '#3fb87a', '#4a7ad8'][i % 3],
    }));
    kit.scatter(new THREE.OctahedronGeometry(0.06), kit.std('#ffffff', { rough: 0.15, metal: 0.2, flat: true, emissive: '#402030', glow: 0.4 }), gems);
    const staves = paintFaces(
      new THREE.LatheGeometry(
        [new THREE.Vector2(0, 0), new THREE.Vector2(0.15, 0), new THREE.Vector2(0.18, 0.17), new THREE.Vector2(0.15, 0.34), new THREE.Vector2(0, 0.34)],
        14,
      ),
      (c) => {
        if (c.y > 0.335) return col('#6e4a2a');
        const a = Math.atan2(c.z, c.x);
        return mixed('#9a6a3c', '#6e4a2a', Math.floor(((a + Math.PI) / (Math.PI * 2)) * 14) % 2 ? 0.35 : 0);
      },
    );
    kit.mesh(staves, kit.std('#ffffff', { painted: true, rough: 0.85 }), [0.02, MOUND_TOP - 0.06, -0.04], { flags: { crown: true } });
    for (const y of [0.06, 0.28]) {
      kit.mesh(new THREE.TorusGeometry(0.162, 0.013, 4, 16), kit.std('#4a4a52', { metal: 0.6, rough: 0.5 }), [0.02, MOUND_TOP - 0.06 + y, -0.04], {
        rot: [Math.PI / 2, 0, 0],
        flags: { crown: true },
      });
    }
    void look;
  },

  // A rock on the sea floor with a sea anemone waving on top.
  anemone: (kit, look) => {
    const geo = paintFaces(rockGeometry(151, 1, (r) => r() * 0.12), (c, n) =>
      n.y > 0.6 && Math.sin(c.x * 8) > 0.3 ? col('#c46a8a') : mixed(look.color, '#4a4e6a', 0.3 + Math.sin(c.z * 9) * 0.25),
    );
    kit.mesh(geo, kit.std('#ffffff', { painted: true, rough: 0.9, flat: true }), [0, C, 0]);
    const disc = MOUND_TOP - 0.03;
    kit.mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.1, 18), kit.std('#e06a7e', { rough: 0.6, emissive: '#ff6f91', glow: 0.2 }), [0, disc, 0], {
      flags: { crown: true },
    });
    kit.mesh(new THREE.CircleGeometry(0.07, 12), kit.std('#7a2840'), [0, disc + 0.052, 0], { rot: [-Math.PI / 2, 0, 0], flags: { crown: true } });
    const tentacles: Item[] = [];
    for (const [ring, n, tilt] of [
      [0.24, 18, 0.95],
      [0.17, 13, 0.6],
      [0.1, 8, 0.3],
    ] as const) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + ring * 7;
        tentacles.push({
          position: new THREE.Vector3(Math.cos(a) * ring, disc + 0.12, Math.sin(a) * ring),
          up: new THREE.Vector3(Math.cos(a) * tilt, 1, Math.sin(a) * tilt).normalize(),
          scale: new THREE.Vector3(1, 0.9 + (i % 3) * 0.12, 1),
          color: i % 2 ? '#ff9ab4' : '#ffb38a',
        });
      }
    }
    kit.scatter(new THREE.CapsuleGeometry(0.026, 0.16, 3, 6), kit.std('#ffffff', { rough: 0.5, emissive: '#ff6f91', glow: 0.3 }), tentacles, {
      crown: true,
    });
  },

  // A rooftop air conditioner on its concrete pad, fan spinning.
  acUnit: (kit, look) => {
    kit.mesh(latheInDome([[0.9, 0], [0.87, 0.06], [0, 0.06]], 24), kit.std('#6a6e80', { rough: 0.95 }), [0, 0, 0]);
    const half = 0.43;
    const top = domeHeight(half * Math.SQRT2) - 0.01;
    const box = paintFaces(new THREE.BoxGeometry(half * 2, top - 0.06, half * 2, 1, 6, 1), (c, n) => {
      if (Math.abs(n.y) > 0.5) return mixed(look.color, '#ffffff', 0.15);
      // Louvres down every side.
      const band = Math.floor((c.y + 1) * 30) % 2;
      return mixed(look.color, '#3a3d50', band ? 0.55 : 0);
    });
    kit.mesh(box, kit.std('#ffffff', { painted: true, rough: look.roughness, metal: look.metalness }), [0, 0.06 + (top - 0.06) / 2, 0]);
    kit.mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.02, 24), kit.std('#23252f', { rough: 0.8 }), [0, top + 0.005, 0]);
    kit.mesh(new THREE.TorusGeometry(0.3, 0.022, 6, 24), kit.std('#9ca1b8', { metal: 0.6, rough: 0.35 }), [0, top + 0.02, 0], {
      rot: [Math.PI / 2, 0, 0],
    });
    const blades = kit.shader(fanMaterial('#8d92a8'));
    for (let i = 0; i < 3; i++) {
      const g = new THREE.BoxGeometry(0.25, 0.012, 0.09);
      g.translate(0.135, 0, 0);
      g.rotateX(0.35);
      g.rotateY((i / 3) * Math.PI * 2);
      kit.mesh(g, blades, [0, top + 0.03, 0]);
    }
    kit.mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 10), kit.std('#4a4e60', { metal: 0.5 }), [0, top + 0.035, 0]);
    const grille: Item[] = [-0.2, -0.1, 0, 0.1, 0.2].map((x) => ({ position: new THREE.Vector3(x, top + 0.04, 0) }));
    kit.scatter(new THREE.BoxGeometry(0.012, 0.012, 0.58), kit.std('#b4b8c8', { metal: 0.6, rough: 0.4 }), grille);
    kit.mesh(new THREE.SphereGeometry(0.025, 8, 6), kit.basic('#7dffb0'), [half - 0.08, 0.2, half + 0.005]);
  },

  // A beach ball, half sunk in the carpet.
  beachBall: (kit, look) => {
    const gores = ['#e8574a', '#f6f1e6', '#f2c14e', '#f6f1e6', '#4a8fd8', '#f6f1e6'];
    const ball = paintFaces(domeGeometry(48, 14), (c) => {
      const polar = Math.acos(Math.min(c.y / Math.hypot(c.x, c.y, c.z), 1));
      if (polar < 0.2) return col('#f6f1e6');
      const a = Math.atan2(c.z, c.x) + Math.PI;
      return col(gores[Math.floor((a / (Math.PI * 2)) * 6) % 6]);
    });
    kit.mesh(ball, kit.std('#ffffff', { painted: true, rough: 0.3 }), [0, C, 0]);
    kit.mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 12), kit.std('#e8574a', { rough: 0.4 }), [0, MOUND_TOP - 0.005, 0], {
      flags: { crown: true },
    });
    void look;
  },
};

/** A lamp that blinks, on the shared clock. */
function blinkMaterial(color: string, rate: number, halo: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uRate: { value: rate } },
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uRate;
      varying vec2 vUv;
      void main() {
        // On for most of a beat, off briefly: a warning light, not a strobe.
        float beat = fract(uTime * uRate + 0.25);
        float on = 0.3 + 0.7 * smoothstep(0.0, 0.08, beat) * smoothstep(0.62, 0.5, beat);
        ${
          halo
            ? 'float r = length(vUv - 0.5) * 2.0; float a = (1.0 - smoothstep(0.0, 1.0, r)) * 0.55 * on; gl_FragColor = vec4(uColor * a, a);'
            : 'gl_FragColor = vec4(mix(uColor * 0.45, uColor + 0.25, on), 1.0);'
        }
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: halo,
    depthWrite: !halo,
    blending: halo ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

/** One puff of smoke that rises, swells and fades, then starts again. */
function smokeMaterial(phase: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPhase: { value: phase } },
    vertexShader: `
      uniform float uTime;
      uniform float uPhase;
      varying float vLife;
      varying vec3 vNormal2;
      void main() {
        float life = fract(uTime * 0.28 + uPhase);
        vLife = life;
        vNormal2 = normalMatrix * normal;
        vec3 p = position * (0.55 + life * 1.1);
        p += vec3(sin(life * 5.0 + uPhase * 9.0) * 0.06, life * 0.75, cos(life * 4.0) * 0.03);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      varying float vLife;
      varying vec3 vNormal2;
      void main() {
        float rim = abs(normalize(vNormal2).z);
        float a = smoothstep(0.0, 0.15, vLife) * (1.0 - vLife) * 0.6 * rim * rim;
        gl_FragColor = vec4(vec3(0.62, 0.58, 0.6), a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
  });
}

/** Fan blades turning about their own centre. */
function fanMaterial(color: string): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) } },
    vertexShader: `
      uniform float uTime;
      varying float vShade;
      void main() {
        float a = uTime * 5.0;
        float c = cos(a);
        float s = sin(a);
        vec3 p = vec3(c * position.x - s * position.z, position.y, s * position.x + c * position.z);
        vShade = 0.75 + 0.25 * normal.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vShade;
      void main() {
        gl_FragColor = vec4(uColor * vShade * 0.8, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

export function buildMound(look: MoundLook): BuiltHazard {
  const kit = new Kit(true);
  MOUNDS[look.kind](kit, look);
  return kit.done();
}

/* ──────────────────────────────── pits ───────────────────────────── */

type PitLook = ObstacleLook['pit'];

/**
 * Pits whose inside is real moving water (water.tsx's WaterSurface),
 * drawn by the Pit component. Everything else is drawn by the pit
 * shader, here.
 */
export const WATER_PITS: readonly PitKind[] = [
  'moat', 'candlePool', 'lake', 'tidePool', 'puddle', 'spring', 'iceHole', 'moonPond',
  // New water pits go ABOVE this comment, one line per season.
];

export function isWaterPit(kind: PitKind): boolean {
  return WATER_PITS.includes(kind);
}

const SHADER_PITS: Partial<Record<PitKind, { mode: PitMode; colors: (l: PitLook) => { a: string; b: string; c: string } }>> = {
  hatch: { mode: 'stars', colors: (l) => ({ a: l.surface, b: l.depths, c: l.edge }) },
  chasm: { mode: 'chasm', colors: (l) => ({ a: l.surface, b: l.border?.color ?? l.surface, c: l.edge }) },
  cloudGap: { mode: 'skyGap', colors: (l) => ({ a: l.surface, b: l.depths, c: l.edge }) },
  crater: { mode: 'crater', colors: (l) => ({ a: l.surface, b: l.depths, c: l.edge }) },
  lava: { mode: 'lava', colors: (l) => ({ a: l.surface, b: l.depths, c: l.edge }) },
  quicksand: { mode: 'quicksand', colors: (l) => ({ a: l.surface, b: l.depths, c: l.edge }) },
  mud: { mode: 'mud', colors: (l) => ({ a: l.surface, b: l.depths, c: l.edge }) },
  chocolate: { mode: 'chocolate', colors: (l) => ({ a: l.surface, b: l.depths, c: l.edge }) },
  whirlpool: { mode: 'whirlpool', colors: (l) => ({ a: l.surface, b: l.depths, c: l.edge }) },
  frozenPond: { mode: 'ice', colors: (l) => ({ a: l.surface, b: l.depths, c: l.edge }) },
  skylight: { mode: 'skylight', colors: (l) => ({ a: l.surface, b: l.depths, c: l.edge }) },
  cargoHatch: { mode: 'cargo', colors: (l) => ({ a: l.surface, b: l.depths, c: l.edge }) },
  toyBox: { mode: 'toyBox', colors: (l) => ({ a: l.surface, b: l.depths, c: l.edge }) },
  tarPit: { mode: 'tar', colors: (l) => ({ a: l.surface, b: l.depths, c: l.edge }) },
  // The Sun Temple's well: the water, the sandstone of the shaft, the sun's light.
  sunWell: { mode: 'well', colors: (l) => ({ a: l.surface, b: l.border?.color ?? l.surface, c: l.edge }) },
};

/** Four boxes round the opening, their inner faces flush with the hole. */
function frame(kit: Kit, width: number, height: number, mat: THREE.Material, y0 = 0, segments = 1) {
  const sides: [number, number, number, number][] = [
    [0, -(H + width / 2), MOAT.size + width * 2, width],
    [0, H + width / 2, MOAT.size + width * 2, width],
    [-(H + width / 2), 0, width, MOAT.size],
    [H + width / 2, 0, width, MOAT.size],
  ];
  return sides.map(([x, z, w, d]) =>
    kit.mesh(new THREE.BoxGeometry(w, height, d, w > d ? segments : 1, 1, d > w ? segments : 1), mat, [x, y0 + height / 2, z]),
  );
}

/** Spots along the outside of the opening, `out` beyond its edge. */
function ringSpots(seed: number, count: number, out: [number, number]) {
  const rand = rng(seed);
  return Array.from({ length: count }, (_, i) => {
    const t = (i + rand() * 0.6) / count;
    const side = Math.floor(t * 4);
    const along = (t * 4 - side) * 2 - 1;
    const o = H + out[0] + rand() * (out[1] - out[0]);
    const s = along * (H + 0.1);
    const p = [
      new THREE.Vector3(s, 0, -o),
      new THREE.Vector3(o, 0, s),
      new THREE.Vector3(-s, 0, o),
      new THREE.Vector3(-o, 0, -s),
    ][side];
    return { p, rand };
  });
}

/**
 * A low lumpy bank of earth, snow or rock round the opening: overlapping
 * flattened lumps, each set back by its own radius so none of them
 * hangs over the hole. `count` is per side.
 */
function lumps(kit: Kit, seed: number, colors: string[], count: number, size: [number, number], height: number) {
  const rand = rng(seed);
  const items: Item[] = [];
  for (let side = 0; side < 4; side++) {
    for (let i = 0; i < count; i++) {
      const s = size[0] + rand() * (size[1] - size[0]);
      const along = -H - 0.15 + ((i + 0.5 + (rand() - 0.5) * 0.5) / count) * (MOAT.size + 0.3);
      const o = H + s + 0.01 + rand() * 0.06;
      const p = [new THREE.Vector3(along, 0, -o), new THREE.Vector3(o, 0, along), new THREE.Vector3(-along, 0, o), new THREE.Vector3(-o, 0, -along)][side];
      items.push({
        position: p,
        spin: rand() * 6,
        scale: new THREE.Vector3(s, height * (0.75 + rand() * 0.5), s * (0.8 + rand() * 0.3)),
        color: colors[Math.floor(rand() * colors.length)],
      });
    }
  }
  return kit.scatter(new THREE.IcosahedronGeometry(1, 1), kit.std('#ffffff', { rough: 1, flat: true }), items);
}

function lilyPads(kit: Kit, spots: [number, number][]) {
  const pads = spots.map(([x, z], i) => ({
    position: new THREE.Vector3(x, 0.05, z),
    spin: i * 2.3,
    scale: 0.85 + (i % 3) * 0.15,
    color: i % 2 ? '#5d9a4a' : '#4f8a3f',
  }));
  const pad = new THREE.CircleGeometry(0.17, 14, 0.35, Math.PI * 2 - 0.7);
  pad.rotateX(-Math.PI / 2);
  kit.scatter(pad, kit.std('#ffffff', { rough: 0.6 }), pads, { float: true });
  const flowers = spots.slice(0, 2).map(([x, z]) => ({ position: new THREE.Vector3(x + 0.04, 0.075, z + 0.02), color: '#f2b6c8' }));
  kit.scatter(new THREE.SphereGeometry(0.04, 8, 5), kit.std('#ffffff', { rough: 0.5 }), flowers, { float: true });
}

function cutStone(kit: Kit, seed: number, color: string, height: number) {
  const rand = rng(seed);
  const blocks: Item[] = [];
  const w = 0.24;
  for (let side = 0; side < 4; side++) {
    for (let i = 0; i < 6; i++) {
      const along = -H - w + (i + 0.5) * ((MOAT.size + w * 2) / 6);
      const o = H + w / 2;
      const p = [new THREE.Vector3(along, 0, -o), new THREE.Vector3(o, 0, along), new THREE.Vector3(-along, 0, o), new THREE.Vector3(-o, 0, -along)][side];
      const h = height * (0.85 + rand() * 0.3);
      blocks.push({
        position: p.setY(h / 2),
        spin: side % 2 ? Math.PI / 2 : 0,
        scale: new THREE.Vector3((MOAT.size + w * 2) / 6 - 0.02, h, w),
        color: mixed(color, '#3a342c', rand() * 0.35),
      });
    }
  }
  kit.scatter(new THREE.BoxGeometry(1, 1, 1), kit.std('#ffffff', { rough: 0.95 }), blocks);
}

/** Diagonal stripes (hazard tape, candy stripes) on a box's faces. */
function striped(kit: Kit, a: string, b: string, width: number, rough = 0.6, metal = 0) {
  return (geo: THREE.BufferGeometry, at: [number, number, number]) =>
    kit.mesh(
      paintFaces(geo, (c) => col(Math.floor((c.x + at[0] + c.z + at[2]) / width) % 2 === 0 ? a : b)),
      kit.std('#ffffff', { painted: true, rough, metal }),
      at,
    );
}

function stripedFrame(kit: Kit, width: number, height: number, a: string, b: string, stripe: number) {
  const paint = striped(kit, a, b, stripe);
  const sides: [number, number, number, number][] = [
    [0, -(H + width / 2), MOAT.size + width * 2, width],
    [0, H + width / 2, MOAT.size + width * 2, width],
    [-(H + width / 2), 0, width, MOAT.size],
    [H + width / 2, 0, width, MOAT.size],
  ];
  for (const [x, z, w, d] of sides) {
    paint(new THREE.BoxGeometry(w, height, d, w > d ? 24 : 2, 1, d > w ? 24 : 2), [x, height / 2, z]);
  }
}

const PITS: Record<PitKind, (kit: Kit, look: PitLook) => void> = {
  // The castle moat: cut kerbstones, lily pads.
  moat: (kit, look) => {
    cutStone(kit, 201, look.border?.color ?? '#8a7c66', 0.13);
    lilyPads(kit, [
      [-0.55, -0.5],
      [0.6, 0.45],
      [-0.2, 0.62],
    ]);
  },

  // Sunset reflecting pool: old kerb, tea-lights floating on it.
  candlePool: (kit, look) => {
    cutStone(kit, 211, look.border?.color ?? '#6b5f52', 0.12);
    const spots: [number, number][] = [
      [-0.55, -0.45],
      [0.5, -0.6],
      [0.6, 0.5],
      [-0.45, 0.55],
      [0.05, 0.05],
    ];
    const cups = spots.map(([x, z]) => ({ position: new THREE.Vector3(x, 0.05, z), color: '#f4ead8' }));
    kit.scatter(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 14), kit.std('#ffffff', { rough: 0.6 }), cups, { float: true });
    const flames = spots.map(([x, z]) => ({ position: new THREE.Vector3(x, 0.11, z), color: '#ffd27a' }));
    kit.scatter(new THREE.ConeGeometry(0.035, 0.09, 6), kit.basic('#ffffff'), flames, { float: true });
    const glows = spots.map(([x, z]) => ({ position: new THREE.Vector3(x, 0.047, z), color: '#ff9a3c' }));
    const disc = new THREE.CircleGeometry(0.3, 16);
    disc.rotateX(-Math.PI / 2);
    kit.scatter(disc, kit.basic('#ffffff', { additive: true, opacity: 0.6 }), glows, { float: true });
    const ivy = ringSpots(212, 9, [0.12, 0.13]).map(({ p, rand }) => ({
      position: p.setY(0.12),
      scale: new THREE.Vector3(0.08 + rand() * 0.03, 0.03, 0.07),
      color: rand() > 0.5 ? '#4f7a45' : '#5e8a4d',
    }));
    kit.scatter(new THREE.SphereGeometry(1, 6, 4), kit.std('#ffffff', { rough: 0.8 }), ivy);
  },

  // A jungle lake: soft earth bank, reeds and cattails, lily pads.
  lake: (kit, look) => {
    lumps(kit, 221, [look.border?.color ?? '#5c4a2e', '#4a3b24', '#6a5636'], 10, [0.20, 0.30], 0.08);
    lilyPads(kit, [
      [-0.5, -0.55],
      [0.55, 0.35],
      [-0.6, 0.4],
      [0.2, -0.3],
    ]);
    const reeds: Item[] = [];
    for (const [cx, cz] of [
      [-H - 0.12, -H - 0.1],
      [H + 0.12, H + 0.05],
      [-H - 0.1, H + 0.12],
    ]) {
      for (let i = 0; i < 7; i++) {
        const a = i * 0.9;
        reeds.push({
          position: new THREE.Vector3(cx + Math.cos(a) * 0.08, 0.2, cz + Math.sin(a) * 0.08),
          up: new THREE.Vector3(Math.cos(a) * 0.15, 1, Math.sin(a) * 0.15).normalize(),
          scale: new THREE.Vector3(1, 0.8 + (i % 3) * 0.2, 1),
          color: i % 2 ? '#5f7d3f' : '#7a9a4a',
        });
      }
    }
    kit.scatter(new THREE.ConeGeometry(0.035, 0.5, 5), kit.std('#ffffff', { rough: 0.9 }), reeds);
    const heads = reeds.filter((_, i) => i % 3 === 0).map((r) => ({ position: r.position.clone().setY(0.36), color: '#6b4a2e' }));
    kit.scatter(new THREE.CapsuleGeometry(0.04, 0.1, 2, 6), kit.std('#ffffff', { rough: 0.9 }), heads);
  },

  // Space station: an open hatch, hazard-striped coaming, lights.
  hatch: (kit, look) => {
    stripedFrame(kit, 0.24, 0.1, '#f2c230', '#22242c', 0.16);
    const lip = kit.basic(look.edge);
    for (const [x, z, w, d] of [
      [0, -H + 0.012, MOAT.size, 0.024],
      [0, H - 0.012, MOAT.size, 0.024],
      [-H + 0.012, 0, 0.024, MOAT.size],
      [H - 0.012, 0, 0.024, MOAT.size],
    ] as const) {
      kit.mesh(new THREE.BoxGeometry(w, 0.02, d), lip, [x, 0.045, z]);
    }
    const lamps = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([sx, sz]) => ({ position: new THREE.Vector3(sx * (H + 0.12), 0.13, sz * (H + 0.12)), color: '#ffb347' }));
    kit.scatter(new THREE.CylinderGeometry(0.06, 0.07, 0.06, 10), kit.basic('#ffffff'), lamps);
    const bolts = ringSpots(231, 20, [0.12, 0.12]).map(({ p }) => ({ position: p.setY(0.105), color: '#4a4f5c' }));
    kit.scatter(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 6), kit.std('#ffffff', { metal: 0.6, rough: 0.4 }), bolts);
    void look;
  },

  // Quicksand: a sinking swirl with damp sand round it.
  quicksand: (kit, look) => {
    const ring = new THREE.RingGeometry(H * Math.SQRT2 * 0.99, H * Math.SQRT2 + 0.35, 4, 1, Math.PI / 4);
    ring.rotateX(-Math.PI / 2);
    kit.mesh(ring, kit.std(mixed(look.surface, '#7a5a30', 0.35).getStyle(), { rough: 1 }), [0, 0.012, 0]);
    frame(kit, 0.12, 0.02, kit.std(mixed(look.surface, '#7a5a30', 0.35).getStyle(), { rough: 1 }), 0.002);
    lumps(kit, 241, [look.surface, mixed(look.surface, '#8a6a3a', 0.2).getStyle()], 6, [0.2, 0.3], 0.04);
  },

  // A rain puddle with leaves floating on it.
  puddle: (kit, look) => {
    lumps(kit, 251, [look.border?.color ?? '#6e4a28', '#5a3c22'], 9, [0.18, 0.28], 0.06);
    const hues = ['#c8502e', '#d9822b', '#e3a83a', '#a8432a'];
    const rand = rng(252);
    const floating = Array.from({ length: 9 }, (_, i) => ({
      position: new THREE.Vector3((rand() * 2 - 1) * 0.75, 0.05, (rand() * 2 - 1) * 0.75),
      spin: rand() * 6,
      scale: new THREE.Vector3(0.22, 1, 0.22),
      color: hues[i % hues.length],
    }));
    kit.scatter(leafShape(), kit.std('#ffffff', { rough: 0.6, side: THREE.DoubleSide }), floating, { float: true });
    const fallen = ringSpots(253, 14, [0.1, 0.4]).map(({ p, rand: r }, i) => ({
      position: p.setY(0.015),
      spin: r() * 6,
      scale: new THREE.Vector3(0.2, 1, 0.2),
      color: hues[i % hues.length],
    }));
    kit.scatter(leafShape(), kit.std('#ffffff', { rough: 0.8, side: THREE.DoubleSide }), fallen);
  },

  // An ice-fishing hole: a thick collar of broken ice, cracks, a flag.
  iceHole: (kit, look) => {
    const rand = rng(261);
    // Set back by half a slab's diagonal, so none overhangs the hole.
    const slabs = ringSpots(262, 26, [0.2, 0.26]).map(({ p, rand: r }) => ({
      position: p.setY(0.04),
      spin: r() * 6,
      scale: new THREE.Vector3(0.22 + r() * 0.1, 0.08 + r() * 0.05, 0.16 + r() * 0.08),
      color: r() > 0.5 ? '#d6eef5' : '#b4dbe8',
    }));
    kit.scatter(new THREE.BoxGeometry(1, 1, 1), kit.std('#ffffff', { rough: 0.2, metal: 0.05, flat: true }), slabs);
    const cracks: Item[] = Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2 + rand() * 0.3;
      const r = H * 1.35 + 0.25 + rand() * 0.2;
      return {
        position: new THREE.Vector3(Math.cos(a) * r, 0.012, Math.sin(a) * r),
        spin: -a,
        scale: new THREE.Vector3(0.45 + rand() * 0.3, 1, 1),
        color: look.edge,
      };
    });
    const crack = new THREE.PlaneGeometry(1, 0.018);
    crack.rotateX(-Math.PI / 2);
    kit.scatter(crack, kit.basic('#ffffff', { opacity: 0.8 }), cracks);
    // The tip-up: a little flag that pops up when a fish bites.
    kit.mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 5), kit.std('#6b4a30'), [-H - 0.28, 0.21, H + 0.18]);
    const flag = new THREE.PlaneGeometry(0.16, 0.11);
    kit.mesh(flag, kit.std('#f0803c', { side: THREE.DoubleSide }), [-H - 0.2, 0.37, H + 0.18]);
  },

  // A chasm in the cavern floor, violet light rising, crystals at its lip.
  chasm: (kit, look) => {
    lumps(kit, 271, ['#6a5a86', '#57497a', look.border?.color ?? '#4e4263'], 9, [0.19, 0.28], 0.09);
    const shard = new THREE.LatheGeometry(
      [new THREE.Vector2(0, -0.1), new THREE.Vector2(1, -0.1), new THREE.Vector2(1, 0.75), new THREE.Vector2(0, 1)],
      6,
    );
    const shards: Item[] = [];
    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].forEach(([sx, sz], k) => {
      for (let i = 0; i < 3; i++) {
        shards.push({
          position: new THREE.Vector3(sx * (H + 0.16 + i * 0.05), 0, sz * (H + 0.14 + (2 - i) * 0.06)),
          up: new THREE.Vector3(sx * (0.3 + i * 0.2), 1, sz * (0.5 - i * 0.15)).normalize(),
          spin: i + k,
          scale: new THREE.Vector3(0.06, 0.32 - i * 0.07, 0.06),
          color: ['#c98aff', '#8fd8ff', '#e0b0ff'][i],
        });
      }
    });
    kit.scatter(shard, kit.std('#ffffff', { rough: 0.2, flat: true, emissive: look.edge, glow: 0.6 }), shards);
    const glow = new THREE.RingGeometry(H * Math.SQRT2 * 0.99, H * Math.SQRT2 + 0.5, 4, 1, Math.PI / 4);
    glow.rotateX(-Math.PI / 2);
    kit.mesh(glow, kit.basic(look.edge, { additive: true, opacity: 0.18 }), [0, 0.01, 0]);
  },

  // A gap in the clouds: puffs of cloud all round the hole.
  cloudGap: (kit, look) => {
    const items = ringSpots(281, 30, [0.0, 0.0]).map(({ p, rand }) => {
      const r = 0.16 + rand() * 0.12;
      // Pushed out by its own radius, so no puff hangs over the hole.
      const out = p.clone().setY(0);
      if (Math.abs(out.x) > Math.abs(out.z)) out.x += Math.sign(out.x) * r;
      else out.z += Math.sign(out.z) * r;
      return { position: out.setY(r * 0.25), scale: new THREE.Vector3(r, r * 0.75, r), color: rand() > 0.3 ? '#ffffff' : '#e3eef8' };
    });
    kit.scatter(new THREE.SphereGeometry(1, 12, 8), kit.std('#ffffff', { rough: 1, emissive: '#ffffff', glow: 0.2 }), items);
    void look;
  },

  // An impact crater: a raised rim of regolith and thrown-out rocks.
  crater: (kit, look) => {
    const rim = look.border?.color ?? look.surface;
    lumps(kit, 290, [rim, mixed(rim, '#ffffff', 0.2).getStyle(), mixed(rim, '#5c606b', 0.25).getStyle()], 8, [0.26, 0.36], 0.15);
    const rocks = ringSpots(291, 18, [0.35, 0.8]).map(({ p, rand }) => ({
      position: p.setY(0.01),
      spin: rand() * 6,
      scale: 0.035 + rand() * 0.05,
      color: rand() > 0.5 ? '#9a9ea8' : '#7c808b',
    }));
    kit.scatter(new THREE.IcosahedronGeometry(1, 0), kit.std('#ffffff', { rough: 1, flat: true }), rocks);
  },

  // A frozen pond with a snowbank round it.
  frozenPond: (kit, look) => {
    lumps(kit, 301, [look.border?.color ?? '#dae7f0', '#f4f8fb', '#e8f0f6'], 11, [0.20, 0.32], 0.10);
  },

  // A lava pool ringed with basalt, glow spilling on the ground, embers.
  lava: (kit, look) => {
    const glow = new THREE.RingGeometry(H * Math.SQRT2 * 0.99, H * Math.SQRT2 + 0.6, 4, 1, Math.PI / 4);
    glow.rotateX(-Math.PI / 2);
    kit.mesh(glow, kit.basic(look.surface, { additive: true, opacity: 0.3 }), [0, 0.01, 0]);
    lumps(kit, 311, [look.border?.color ?? '#4a3336', '#2e2224', '#3a2a2c'], 10, [0.18, 0.28], 0.10);
    const embers = Array.from({ length: 10 }, (_, i) => ({
      position: new THREE.Vector3(Math.cos(i * 2.4) * 0.7, 0.4 + (i % 4) * 0.13, Math.sin(i * 2.4) * 0.7),
      color: i % 2 ? '#ffd23f' : '#ff8c2e',
    }));
    kit.scatter(new THREE.SphereGeometry(0.018, 5, 4), kit.basic('#ffffff'), embers);
  },

  // A farmyard mud puddle with straw scattered round it.
  mud: (kit, look) => {
    lumps(kit, 321, [look.border?.color ?? '#6e5433', '#5a4428'], 9, [0.18, 0.28], 0.06);
    const straws = ringSpots(322, 20, [0.15, 0.55]).map(({ p, rand }) => ({
      position: p.setY(0.012),
      up: new THREE.Vector3(1, 0.05, 0).normalize(),
      spin: rand() * 6,
      color: rand() > 0.5 ? '#e3c56f' : '#c9a24c',
    }));
    kit.scatter(new THREE.CylinderGeometry(0.01, 0.01, 0.22, 3), kit.std('#ffffff', { rough: 1 }), straws);
  },

  // Dino Valley's tar pit: dark rock round it, and the ribs of something
  // that wandered in long ago arching up beside it — outside the hole,
  // so nothing hangs over where a die falls in.
  tarPit: (kit, look) => {
    lumps(kit, 341, [look.border?.color ?? '#5a4a3a', '#3f342a', '#6e5a40'], 9, [0.18, 0.3], 0.1);
    const bone = kit.std('#e6dcc0', { rough: 0.7 });
    for (const [z, r] of [[-0.35, 0.2], [-0.12, 0.26], [0.12, 0.27], [0.35, 0.21]] as const) {
      kit.mesh(new THREE.TorusGeometry(r, 0.028, 6, 12, Math.PI), bone, [-H - 0.2, 0, z], { rot: [0, Math.PI / 2, 0] });
    }
    kit.mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.95, 7), bone, [-H - 0.2, 0.04, 0], { rot: [Math.PI / 2, 0, 0] });
  },

  /*
    The Sun Temple's well (season 2, 21 Oct 2026): a square well of cut
    sandstone going down to sunlit water (the shader), a kerb of blocks
    round it with a small gold sun on each corner, and marigold petals
    on the stone. Nothing over the opening.
  */
  sunWell: (kit, look) => {
    cutStone(kit, 351, look.border?.color ?? '#c8a264', 0.15);
    const gold = kit.std('#f0b240', { rough: 0.35, metal: 0.5, emissive: '#ff9a2a', glow: 0.2 });
    const suns = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([sx, sz]) => ({ position: new THREE.Vector3(sx * (H + 0.12), 0.17, sz * (H + 0.12)), scale: 1 }));
    kit.scatter(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 12), gold, suns);
    kit.scatter(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 10), kit.basic('#fff0b0'), suns);
    const petals = ringSpots(352, 14, [0.3, 0.42]).map(({ p, rand }) => ({
      position: p.setY(0.012),
      spin: rand() * 6,
      scale: new THREE.Vector3(0.05 + rand() * 0.03, 0.015, 0.035),
      color: rand() > 0.5 ? '#f0b240' : '#e07a2a',
    }));
    kit.scatter(new THREE.SphereGeometry(1, 6, 4), kit.std('#ffffff', { rough: 0.7 }), petals);
  },

  /*
    The Moon Garden's pond: a still pool edged with river stones, the
    moon's reflection lying on the water, lotus pads and two open lotus
    flowers floating, and a little stone lantern on the bank.
  */
  moonPond: (kit, look) => {
    lumps(kit, 361, [look.border?.color ?? '#6c758c', '#56688a', '#7f8aa6'], 9, [0.18, 0.28], 0.1);
    const moon = new THREE.CircleGeometry(0.32, 20);
    moon.rotateX(-Math.PI / 2);
    kit.mesh(moon, kit.basic('#f4f0e0', { opacity: 0.55 }), [0.18, 0.052, -0.12], { flags: { float: true } });
    const pad = new THREE.CircleGeometry(0.15, 14, 0.35, Math.PI * 2 - 0.7);
    pad.rotateX(-Math.PI / 2);
    const spots: [number, number][] = [
      [-0.55, 0.5],
      [0.58, 0.52],
      [-0.5, -0.56],
    ];
    const pads = spots.map(([x, z], i) => ({
      position: new THREE.Vector3(x, 0.05, z),
      spin: i * 2.1,
      scale: 0.9 + (i % 2) * 0.2,
      color: i % 2 ? '#3f6a4a' : '#4f7a55',
    }));
    kit.scatter(pad, kit.std('#ffffff', { rough: 0.6 }), pads, { float: true });
    const petals: Item[] = [];
    for (const [x, z] of spots.slice(0, 2)) {
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        petals.push({
          position: new THREE.Vector3(x + Math.cos(a) * 0.045, 0.085, z + Math.sin(a) * 0.045),
          up: new THREE.Vector3(Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5).normalize(),
          color: k % 2 ? '#ffd9e8' : '#fff4f8',
        });
      }
    }
    kit.scatter(new THREE.ConeGeometry(0.035, 0.09, 5), kit.std('#ffffff', { rough: 0.7 }), petals, { float: true });
    const hearts = spots.slice(0, 2).map(([x, z]) => ({ position: new THREE.Vector3(x, 0.08, z), color: '#ffe9b0' }));
    kit.scatter(new THREE.SphereGeometry(0.025, 6, 5), kit.std('#ffffff', { rough: 0.6 }), hearts, { float: true });
    const stone = kit.std('#8a93a8', { rough: 0.95 });
    kit.mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.16, 8), stone, [H + 0.3, 0.08, -H - 0.25]);
    kit.mesh(new THREE.BoxGeometry(0.16, 0.12, 0.16), kit.basic('#ffe9b0'), [H + 0.3, 0.22, -H - 0.25]);
    kit.mesh(new THREE.ConeGeometry(0.16, 0.1, 6), stone, [H + 0.3, 0.33, -H - 0.25]);
    void look;
  },

  // A tide pool: rocks round it, a starfish and a shell on them.
  tidePool: (kit, look) => {
    lumps(kit, 331, ['#a89a84', '#8f8270', '#c2b49a'], 9, [0.20, 0.32], 0.14);
    const star = new THREE.ExtrudeGeometry(starShape(5, 0.17, 0.07), {
      depth: 0.03,
      bevelEnabled: true,
      bevelSize: 0.02,
      bevelThickness: 0.02,
      bevelSegments: 1,
    });
    star.rotateX(-Math.PI / 2);
    kit.mesh(star, kit.std('#f0804a', { rough: 0.7 }), [-H - 0.3, 0.16, H - 0.3], { rot: [0, 0.4, 0], scale: 1.5 });
    kit.mesh(new THREE.SphereGeometry(0.07, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), kit.std('#f4d9cc', { rough: 0.5 }), [-H - 0.2, 0.1, H + 0.15], {
      scale: [1, 0.6, 1.2],
    });
    void look;
  },

  // A chocolate fondue pool in a candy-striped rim, marshmallows by it.
  chocolate: (kit, look) => {
    stripedFrame(kit, 0.2, 0.12, look.border?.color ?? '#f2a0c4', '#fff4f8', 0.18);
    const mallows = [
      [-H - 0.25, -H + 0.3],
      [H + 0.26, H - 0.2],
    ].map(([x, z], i) => ({ position: new THREE.Vector3(x, 0.08, z), spin: i, color: i ? '#ffe3ef' : '#fffaf2' }));
    kit.scatter(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 14), kit.std('#ffffff', { rough: 0.9 }), mallows);
    kit.mesh(new THREE.ConeGeometry(0.09, 0.18, 10), kit.std('#e0405e', { rough: 0.5 }), [H + 0.25, 0.09, -H - 0.22], { rot: [Math.PI, 0, 0] });
    kit.mesh(new THREE.ConeGeometry(0.07, 0.05, 6), kit.std('#4f9a4a', { rough: 0.8 }), [H + 0.25, 0.2, -H - 0.22]);
  },

  // A glowing spring: mossy stones, little glowing mushrooms, spores.
  spring: (kit, look) => {
    lumps(kit, 341, [look.border?.color ?? '#33684a', '#2c5a40', '#3d7454'], 9, [0.19, 0.28], 0.09);
    const shrooms = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([sx, sz], i) => ({ position: new THREE.Vector3(sx * (H + 0.2), 0.1 + (i % 2) * 0.03, sz * (H + 0.18)), color: '#9ff5e0' }));
    kit.scatter(new THREE.CylinderGeometry(0.025, 0.03, 0.2, 6), kit.std('#d8efe4'), shrooms.map((s) => ({ ...s, position: s.position.clone().setY(0.08) })));
    kit.scatter(new THREE.SphereGeometry(0.09, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), kit.basic('#ffffff'), shrooms);
    const spores = Array.from({ length: 12 }, (_, i) => ({
      position: new THREE.Vector3(Math.cos(i * 2.2) * 0.8, 0.35 + (i % 5) * 0.12, Math.sin(i * 2.2) * 0.8),
      color: i % 3 ? '#b8f0e0' : '#e8ffb0',
    }));
    kit.scatter(new THREE.SphereGeometry(0.02, 5, 4), kit.basic('#ffffff'), spores);
  },

  // A ship's open cargo hatch: wooden coaming, a grating set aside, rope.
  cargoHatch: (kit, look) => {
    frame(kit, 0.18, 0.14, kit.std(look.border?.color ?? '#6e4a2a', { rough: 0.85 }), 0, 6);
    const slats: Item[] = [];
    for (let i = 0; i < 6; i++) {
      slats.push({ position: new THREE.Vector3(-H - 0.55, 0.03, -0.6 + i * 0.24), scale: new THREE.Vector3(0.7, 0.04, 0.1), color: '#9a7048' });
    }
    for (const x of [-H - 0.82, -H - 0.28]) {
      slats.push({ position: new THREE.Vector3(x, 0.05, 0), scale: new THREE.Vector3(0.08, 0.04, 1.42), color: '#7a5634' });
    }
    kit.scatter(new THREE.BoxGeometry(1, 1, 1), kit.std('#ffffff', { rough: 0.85 }), slats);
    kit.mesh(new THREE.TorusGeometry(0.16, 0.05, 6, 16), kit.std('#c9b088', { rough: 1 }), [H + 0.35, 0.05, H + 0.3], { rot: [Math.PI / 2, 0, 0] });
    kit.mesh(new THREE.TorusGeometry(0.09, 0.045, 6, 14), kit.std('#b89c74', { rough: 1 }), [H + 0.35, 0.12, H + 0.3], { rot: [Math.PI / 2, 0, 0] });
  },

  // A whirlpool: rough coral stone round it, bubbles rising.
  whirlpool: (kit, look) => {
    lumps(kit, 351, [look.border?.color ?? '#125460', '#1a6a74', '#c46a8a'], 9, [0.19, 0.28], 0.10);
    const bubbles = Array.from({ length: 10 }, (_, i) => ({
      position: new THREE.Vector3(Math.cos(i * 2.5) * 0.5, 0.35 + (i % 5) * 0.14, Math.sin(i * 2.5) * 0.5),
      scale: 0.6 + (i % 3) * 0.3,
    }));
    kit.scatter(new THREE.SphereGeometry(0.04, 8, 6), kit.std('#cff4fa', { rough: 0.1, opacity: 0.55, emissive: '#3fbccc', glow: 0.3 }), bubbles);
  },

  // An open skylight, warm light coming up, its glass panes propped open.
  skylight: (kit, look) => {
    frame(kit, 0.16, 0.16, kit.std(look.border?.color ?? '#717691', { metal: 0.5, rough: 0.45 }));
    const glass = kit.std('#a9d0ec', { rough: 0.1, metal: 0.2, opacity: 0.6, side: THREE.DoubleSide, emissive: '#3a5878', glow: 0.5 });
    const bar = kit.std('#5a5f78', { metal: 0.5, rough: 0.4 });
    // Hinged along the back and left edges, tipped OUT, away from the hole.
    const back = new THREE.Group();
    back.position.set(0, 0.16, -H - 0.16);
    back.rotation.x = -0.55;
    const left = new THREE.Group();
    left.position.set(-H - 0.16, 0.16, 0);
    left.rotation.z = 0.55;
    kit.group.add(back, left);
    for (const [g, w, d, ox, oz] of [
      [back, MOAT.size, 0.9, 0, -0.45],
      [left, 0.9, MOAT.size, -0.45, 0],
    ] as const) {
      const pane = new THREE.Mesh(kit.geo(new THREE.BoxGeometry(w, 0.02, d)), glass);
      pane.position.set(ox, 0, oz);
      pane.userData.hazard = {};
      g.add(pane);
      const rail = new THREE.Mesh(kit.geo(new THREE.BoxGeometry(w + 0.04, 0.04, d + 0.04)), bar);
      rail.scale.set(w > d ? 1 : 0.06, 1, w > d ? 0.06 : 1);
      rail.position.set(w > d ? ox : ox * 2, 0, w > d ? oz * 2 : oz);
      rail.userData.hazard = {};
      g.add(rail);
    }
    const glow = new THREE.RingGeometry(H * Math.SQRT2 * 0.99, H * Math.SQRT2 + 0.45, 4, 1, Math.PI / 4);
    glow.rotateX(-Math.PI / 2);
    kit.mesh(glow, kit.basic(look.edge, { additive: true, opacity: 0.22 }), [0, 0.01, 0]);
  },

  // An open toy box: painted sides, a trim, and its lid standing up.
  toyBox: (kit, look) => {
    const side = look.border?.color ?? '#9e2f2f';
    frame(kit, 0.16, 0.24, kit.std(side, { rough: 0.6 }));
    frame(kit, 0.2, 0.04, kit.std(look.edge, { rough: 0.5 }), 0.24);
    const lid = new THREE.Group();
    lid.position.set(0, 0.28, -H - 0.18);
    lid.rotation.x = -0.25;
    kit.group.add(lid);
    const board = new THREE.Mesh(kit.geo(new THREE.BoxGeometry(MOAT.size + 0.4, 0.95, 0.08)), kit.std(side, { rough: 0.6 }));
    board.position.set(0, 0.47, -0.04);
    board.userData.hazard = {};
    const trim = new THREE.Mesh(kit.geo(new THREE.BoxGeometry(MOAT.size + 0.44, 0.08, 0.1)), kit.std(look.edge, { rough: 0.5 }));
    trim.position.set(0, 0.92, -0.04);
    trim.userData.hazard = {};
    const star = new THREE.Mesh(kit.geo(new THREE.ShapeGeometry(starShape(5, 0.22, 0.1))), kit.std(look.edge, { rough: 0.5 }));
    star.position.set(0, 0.5, 0.005);
    star.userData.hazard = {};
    lid.add(board, trim, star);
    kit.mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), kit.std('#4a8fd8', { rough: 0.5 }), [H + 0.3, 0.08, H + 0.1], { rot: [0, 0.5, 0] });
    kit.mesh(new THREE.SphereGeometry(0.1, 12, 8), kit.std('#f2c14e', { rough: 0.4 }), [-H - 0.28, 0.1, H + 0.2]);
  },
};

export function buildPit(look: PitLook): BuiltHazard {
  const kit = new Kit(false);
  const shaded = SHADER_PITS[look.kind];
  if (shaded) {
    const material = kit.shader(createPitMaterial(shaded.mode, shaded.colors(look), H));
    const plane = new THREE.PlaneGeometry(MOAT.size, MOAT.size);
    plane.rotateX(-Math.PI / 2);
    kit.mesh(plane, material, [0, 0.035, 0], { flags: { surface: true } });
  }
  PITS[look.kind](kit, look);
  return kit.done();
}

/* ──────────────────────────── the springs ─────────────────────────── */

/** How long the pit's gulp lasts, in seconds. */
export const GULP_SECONDS = 0.36;

/**
 * The pit's gulp when it swallows a die: a quick pull inward that springs
 * back past rest and settles. A scale factor for the pit's footprint, 1
 * at rest. Damped so it is a twitch rather than a wobble.
 */
export function gulpScale(t: number): number {
  if (t <= 0 || t >= GULP_SECONDS) return 1;
  return 1 - 0.07 * Math.exp(-7 * t) * Math.sin((t * Math.PI * 2) / 0.22);
}

/** How long the bump's squash lasts, in seconds. */
export const BUMP_SECONDS = 0.3;

/**
 * The bump's squash when a die glances off it: its height, as a factor,
 * dipping a few percent and springing back. The width moves the other
 * way by half as much (see DiceScene) so it reads as squash, not shrink.
 */
export function bumpSquash(t: number): number {
  if (t <= 0 || t >= BUMP_SECONDS) return 1;
  return 1 - 0.06 * Math.exp(-9 * t) * Math.sin((t * Math.PI * 2) / 0.2);
}
