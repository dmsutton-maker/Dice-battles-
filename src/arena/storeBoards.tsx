import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { TUNING } from '../game/tuning';
import { cachedTexture } from './textureCache';
import type { ArenaTheme } from './themeData';
import { LIVE, troughOf, WaterSurface } from './water';

/**
 * The walls, corners and surroundings of the eight STORE battlefields —
 * Treasure Beach, Candy Meadow, Glow Glade, Pirate Cove, Sunny Farm,
 * Coral Reef, Rooftop City and Toy Room.
 *
 * ── WHY THIS FILE EXISTS ──────────────────────────────────────────
 *
 * The board redesign, 18 Oct 2026 (docs/board-redesign.md): "make each
 * board look totally different don't just make different color
 * castles." Seen side by side, these eight were one tray each with a
 * ring of small pieces along the wall top — planks, blobs, studs,
 * diamonds — and the colour was most of what told them apart. Sunny
 * Farm's white diamonds on a brown wall with a grey knob at every
 * corner read as a wrestling ring.
 *
 * The rule the spec sets is that with the colour turned off you can
 * still tell which board it is. Under this camera — almost straight
 * down, from about twenty units up (cameraFit.ts) — that means the
 * SILHOUETTE seen from above: what the wall top is made of, how the
 * pieces on it are spaced, what sticks out over the ground beside it.
 * So each board here builds its wall from its own parts, at its own
 * rhythm, and dresses the strip of world either side of the tray:
 *
 *   beach  — a sand berm, driftwood stakes, a sagging rope with glass
 *            floats; the sea breaking behind the jail.
 *   candy  — piped icing, candy canes with their hooks, gumdrops, drips
 *            of icing down the inside.
 *   glade  — a dry-stone wall of mossy boulders, glowing toadstools in
 *            clumps, fireflies in the air outside.
 *   cove   — bulwarks with a turned balustrade and a rail, cannon run
 *            out through the sides, boarding nets; sea on three sides.
 *   farm   — a grassy bank and a white picket fence: many thin pickets,
 *            two rails, posts; gateposts with sunflowers.
 *   reef   — live rock carrying five kinds of coral; light moving over
 *            everything; the reef falling away to deep water behind.
 *   city   — a concrete parapet with air conditioners, vents, a pipe
 *            run, aerials and dishes; water towers at the corners.
 *   toybox — a wall of interlocking bricks, staggered, studs on top.
 *
 * ── WHAT IT MUST NOT DO ───────────────────────────────────────────
 *
 * Nothing here touches play. The tray the dice bounce in is the box
 * walls in ThemedArena.tsx and the physics in DiceScene; everything in
 * this file sits on or outside them. Where a piece faces the board —
 * icing drips, the brick courses — it stands proud of the wall's inner
 * face by a centimetre, not a die's width.
 *
 * Everything stays inside the frame and off the jail pen's ground
 * (arenaShape.test.ts says why), and nothing is larger than the tray
 * wall is tall: the tallest piece is a corner water tower under three
 * units, which is what the other corners already reach.
 *
 * ── PHONES ────────────────────────────────────────────────────────
 *
 * A wall of a hundred and fifty pickets or two hundred bricks is ONE
 * draw call: every repeated piece is an InstancedMesh, built once per
 * mount from a memoised list. Geometry is low-segment. The textures —
 * stripes, a spiral, a net, a glow — are a few dozen pixels, built once
 * through textureCache like the floors. Anything that moves does it on
 * the GPU from one time uniform, advanced by the WaterClock that
 * already ticks the water (water.tsx) — so nothing here allocates per
 * frame, and nothing here imports the renderer, which keeps this file
 * loadable by the headless tests the way the water is.
 */

const { innerWidth, innerDepth, wallHeight, wallThickness } = TUNING.tray;
const halfW = innerWidth / 2;
const halfD = innerDepth / 2;
/** The middle of the wall top. */
const CX = halfW + wallThickness / 2;
const CZ = halfD + wallThickness / 2;
/** The outside faces of the walls. */
const OUT_X = halfW + wallThickness;
const OUT_Z = halfD + wallThickness;

/* ── shared machinery ─────────────────────────────────────────────── */

/** Deterministic 0..1 from a number. Never Math.random: see groundTexture.ts. */
function h1(n: number): number {
  const s = Math.sin(n * 91.345 + 47.853) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * The four wall runs, along the middle of the wall top.
 *
 * The long walls own the corners and run the full outside length; the
 * short walls fill between the long walls' inner faces. `n` points
 * OUT of the tray, `t` along the run. 0 and 1 are left and right, 2 is
 * the back wall the jail stands behind, 3 the front one by the retreat.
 */
interface Run {
  id: number;
  ax: number;
  az: number;
  bx: number;
  bz: number;
  nx: number;
  nz: number;
  tx: number;
  tz: number;
  len: number;
  /** Yaw that turns a piece's local +x to lie along the run. */
  yaw: number;
}

const RUNS: Run[] = [
  [0, -CX, -OUT_Z, -CX, OUT_Z, -1, 0],
  [1, CX, -OUT_Z, CX, OUT_Z, 1, 0],
  [2, -halfW, -CZ, halfW, -CZ, 0, -1],
  [3, -halfW, CZ, halfW, CZ, 0, 1],
].map(([id, ax, az, bx, bz, nx, nz]) => {
  const len = Math.hypot(bx - ax, bz - az);
  const tx = (bx - ax) / len;
  const tz = (bz - az) / len;
  return { id, ax, az, bx, bz, nx, nz, tx, tz, len, yaw: Math.atan2(-tz, tx) };
});

interface Spot {
  x: number;
  z: number;
  /** Index along this run. */
  k: number;
  /** A seed unique to this spot on this run. */
  seed: number;
  /** Distance along the run from its start. */
  s: number;
}

/**
 * Evenly spaced spots along a run, `pitch` apart, kept `inset` from both
 * ends. Opposite walls get the same count, so a pattern read through
 * `k` is the same on both — which is what audit.js measures.
 */
function spots(run: Run, pitch: number, inset = 0): Spot[] {
  const span = run.len - inset * 2;
  const n = Math.max(1, Math.round(span / pitch));
  const out: Spot[] = [];
  for (let k = 0; k < n; k++) {
    const s = inset + ((k + 0.5) * span) / n;
    out.push({ x: run.ax + run.tx * s, z: run.az + run.tz * s, k, seed: run.id * 1000 + k * 7.13, s });
  }
  return out;
}

/** One instance: position, optional rotation and scale, optional colour. */
interface Inst {
  p: [number, number, number];
  r?: [number, number, number];
  s?: [number, number, number] | number;
  c?: string;
}

/**
 * Many copies of one mesh in one draw call.
 *
 * Children are the geometry and material, as for a mesh. The matrices
 * are written once, when the list changes, never per frame. Colours go
 * in as an instanceColor attribute from the first render, so the shader
 * is compiled with them rather than recompiled when they arrive.
 */
function Instanced({
  items,
  children,
  extra,
  renderOrder,
}: {
  items: Inst[];
  children: React.ReactNode;
  extra?: React.ReactNode;
  renderOrder?: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const colors = useMemo(() => {
    if (!items.some((i) => i.c)) return null;
    const a = new Float32Array(items.length * 3);
    const col = new THREE.Color();
    items.forEach((it, k) => {
      col.set(it.c ?? '#ffffff');
      a[k * 3] = col.r;
      a[k * 3 + 1] = col.g;
      a[k * 3 + 2] = col.b;
    });
    return a;
  }, [items]);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    items.forEach((it, k) => {
      o.position.set(it.p[0], it.p[1], it.p[2]);
      if (it.r) o.rotation.set(it.r[0], it.r[1], it.r[2]);
      else o.rotation.set(0, 0, 0);
      const s = it.s ?? 1;
      if (typeof s === 'number') o.scale.setScalar(s);
      else o.scale.set(s[0], s[1], s[2]);
      o.updateMatrix();
      m.setMatrixAt(k, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} renderOrder={renderOrder}>
      {children}
      {colors && <instancedBufferAttribute attach="instanceColor" args={[colors, 3]} />}
      {extra}
    </instancedMesh>
  );
}

/** A long piece lying along a run: [position, rotation] for a box of length `len` on local x. */
function lying(run: Run, y: number, out = 0): { position: [number, number, number]; rotation: [number, number, number] } {
  const mx = (run.ax + run.bx) / 2 + run.nx * out;
  const mz = (run.az + run.bz) / 2 + run.nz * out;
  return { position: [mx, y, mz], rotation: [0, run.yaw, 0] };
}

/**
 * A rounded bank along each wall top — sand, icing, turf — so the wall
 * reads as heaped stuff rather than as a box. A cylinder laid along the
 * run and squashed flat; it overhangs the box by a few centimetres.
 */
function Berm({ color, radius, squash, roughness = 0.95 }: {
  color: string;
  radius: number;
  squash: number;
  roughness?: number;
}) {
  return (
    <>
      {RUNS.map((run) => {
        const { position } = lying(run, wallHeight - 0.02);
        const along = run.tz !== 0;
        return (
          <mesh
            key={run.id}
            position={position}
            rotation={along ? [Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2]}
            scale={along ? [1, 1, squash] : [squash, 1, 1]}
          >
            <cylinderGeometry args={[radius, radius, run.len + (along ? 0 : 0.1), 10]} />
            <meshStandardMaterial color={color} roughness={roughness} />
          </mesh>
        );
      })}
    </>
  );
}

/**
 * Keeps a shader's `uTime` ticking with the water's, and frees it after.
 * The WaterClock in the scene advances everything in LIVE every frame.
 */
function useLive(material: THREE.ShaderMaterial) {
  useEffect(() => {
    LIVE.add(material);
    return () => {
      LIVE.delete(material);
      material.dispose();
    };
  }, [material]);
}

/** A tiny RGBA texture painted from a function, cached for the app's life. */
function painted(
  key: string,
  w: number,
  h: number,
  paint: (x: number, y: number) => [number, number, number, number],
  repeat = true,
): THREE.DataTexture {
  return cachedTexture(`store-${key}`, () => {
    const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = paint(x, y);
        const i = (y * w + x) * 4;
        data[i] = c[0];
        data[i + 1] = c[1];
        data[i + 2] = c[2];
        data[i + 3] = c[3];
      }
    }
    const t = new THREE.DataTexture(data, w, h);
    t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) {
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
    }
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
    return t;
  }) as THREE.DataTexture;
}

/** A soft round glow, white, alpha falling off from the middle. */
function glowTexture(): THREE.DataTexture {
  return painted('glow', 32, 32, (x, y) => {
    const d = Math.hypot(x - 15.5, y - 15.5) / 15.5;
    const a = Math.max(0, 1 - d);
    return [255, 255, 255, Math.round(a * a * 255)];
  }, false);
}

/* ── Treasure Beach ───────────────────────────────────────────────── */

const DRIFTWOOD = ['#b9b2a3', '#d3cbbb', '#9a8f7c', '#c4b8a2', '#ada08a'];
const GLASS = ['#7fd6cf', '#e8a85a', '#9bc4ef'];

function BeachWall() {
  const { stakes, floats, ropes } = useMemo(() => {
    const stakes: Inst[] = [];
    const floats: Inst[] = [];
    const ropes: THREE.TubeGeometry[] = [];
    for (const run of RUNS) {
      const tops: THREE.Vector3[] = [];
      for (const s of spots(run, 0.36, 0.14)) {
        const h = 0.45 + h1(s.seed) * 0.45;
        const r = 0.085 + h1(s.seed + 7) * 0.045;
        // Each stake leans its own way, across the wall and a little along it.
        const lean = (h1(s.seed + 3) - 0.5) * 0.3;
        const len = h + 0.3;
        const bottom = wallHeight - 0.3;
        const along = run.tz !== 0;
        const x = s.x + run.nx * (h1(s.seed + 5) - 0.5) * 0.1;
        const z = s.z + run.nz * (h1(s.seed + 5) - 0.5) * 0.1;
        const rot: [number, number, number] = along ? [0, h1(s.seed) * 6, lean] : [lean, h1(s.seed) * 6, 0];
        stakes.push({
          p: [x, bottom + len / 2, z],
          r: rot,
          s: [r, len, r],
          c: DRIFTWOOD[Math.floor(h1(s.seed + 11) * DRIFTWOOD.length)],
        });
        // Where the top of the stake ended up once leant.
        const tipX = along ? x - Math.sin(lean) * len * 0.5 : x;
        const tipZ = along ? z : z + Math.sin(lean) * len * 0.5;
        tops.push(new THREE.Vector3(tipX, bottom + len * Math.cos(lean) - 0.08, tipZ));
      }
      // A rope swagged from stake to stake, sagging between them.
      const path: THREE.Vector3[] = [];
      tops.forEach((t, i) => {
        path.push(t);
        const next = tops[i + 1];
        if (!next) return;
        const mid = t.clone().lerp(next, 0.5);
        mid.y -= 0.13;
        path.push(mid);
        // A glass fishing float hung in every third swag.
        if (i % 3 === 1) {
          floats.push({
            p: [mid.x + run.nx * 0.03, mid.y - 0.07, mid.z + run.nz * 0.03],
            s: 1,
            c: GLASS[(i + run.id) % GLASS.length],
          });
        }
      });
      const curve = new THREE.CatmullRomCurve3(path, false, 'centripetal');
      ropes.push(new THREE.TubeGeometry(curve, path.length * 3, 0.024, 5, false));
    }
    return { stakes, floats, ropes };
  }, []);
  useEffect(() => () => ropes.forEach((g) => g.dispose()), [ropes]);

  return (
    <group>
      {/* The berm: dune sand heaped along the wall top. */}
      <Berm color="#dcc893" radius={0.29} squash={0.42} />
      <Instanced items={stakes}>
        <cylinderGeometry args={[0.85, 1, 1, 7]} />
        <meshStandardMaterial color="#ffffff" roughness={1} />
      </Instanced>
      {ropes.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial color="#c9a46a" roughness={0.95} />
        </mesh>
      ))}
      <Instanced items={floats}>
        <sphereGeometry args={[0.075, 10, 8]} />
        <meshStandardMaterial color="#ffffff" roughness={0.15} metalness={0.1} />
      </Instanced>
    </group>
  );
}

function BeachCorner({ theme }: { theme: ArenaTheme }) {
  // A gnarled driftwood post with a life ring hung on it and a coil of
  // rope at its foot — a ring, from above, where every other board has
  // a tower.
  const ring = theme.tower.roof;
  return (
    <group>
      <mesh position={[0, (wallHeight + 0.95) / 2, 0]} rotation={[0.07, 0.4, -0.09]}>
        <cylinderGeometry args={[0.12, 0.19, wallHeight + 0.95, 7]} />
        <meshStandardMaterial color={theme.tower.body} roughness={1} />
      </mesh>
      <mesh position={[0.17, (wallHeight + 0.45) / 2, 0.1]} rotation={[0.1, 0, 0.28]}>
        <cylinderGeometry args={[0.07, 0.11, wallHeight + 0.45, 6]} />
        <meshStandardMaterial color="#c4b8a2" roughness={1} />
      </mesh>
      <group position={[0, wallHeight + 0.6, 0]} rotation={[Math.PI / 2 - 0.4, 0, 0]}>
        {([0, 1, 2, 3] as const).map((k) => (
          <mesh key={k} rotation={[0, 0, (k * Math.PI) / 2]}>
            <torusGeometry args={[0.32, 0.085, 8, 8, Math.PI / 2]} />
            <meshStandardMaterial color={k % 2 === 0 ? ring : '#f6f1e6'} roughness={0.6} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, wallHeight + 0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.26, 0.045, 6, 16]} />
        <meshStandardMaterial color="#c9a46a" roughness={0.95} />
      </mesh>
    </group>
  );
}

function BeachBackdrop() {
  /*
    The far backdrop: the sea, breaking on the beach behind the jail.
    Flat, at ground level, so it can lie across the top of the frame
    without looming — the lesson of the horizon blob (ThemedArena.tsx).
    The band of darker wet sand in front of it is where the waves reach.
  */
  return (
    <group>
      <WaterSurface
        look={{ shallow: '#62d2c6', deep: troughOf('#3fb5bf', 0.45), foam: '#fbfaf3', opacity: 1 }}
        shape="square"
        size={[12, 4]}
        flow={[0.05, -0.07]}
        position={[0, -0.1, -10.45]}
      />
      <mesh position={[0, -0.112, -8.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 0.9]} />
        <meshStandardMaterial color="#b89a64" roughness={0.6} transparent opacity={0.45} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ── Candy Meadow ─────────────────────────────────────────────────── */

const GUMDROP = ['#9fe3c4', '#f7d774', '#c7a6ef', '#ff9e9a', '#ffc08a'];

function candyStripes(): THREE.DataTexture {
  // Diagonal so that wrapped round a cylinder it spirals, like a cane.
  return painted('cane', 32, 32, (x, y) => {
    const red = ((x + y) % 16) < 7;
    return red ? [222, 64, 88, 255] : [255, 246, 240, 255];
  });
}

function lollipopSwirl(): THREE.DataTexture {
  return painted('swirl', 64, 64, (x, y) => {
    const dx = x - 31.5;
    const dy = y - 31.5;
    const r = Math.hypot(dx, dy) / 31.5;
    if (r > 0.94) return [255, 246, 240, 255];
    const t = Math.atan2(dy, dx) / (Math.PI * 2) + 0.5;
    const band = Math.floor(((t * 3 + r * 3.2) % 1 + 1) % 1 * 3);
    return band === 0 ? [255, 143, 184, 255] : band === 1 ? [255, 246, 240, 255] : [159, 227, 196, 255];
  }, false);
}

function CandyWall({ theme }: { theme: ArenaTheme }) {
  const { shafts, hooks, gums, drips } = useMemo(() => {
    const shafts: Inst[] = [];
    const hooks: Inst[] = [];
    const gums: Inst[] = [];
    const drips: Inst[] = [];
    for (const run of RUNS) {
      for (const s of spots(run, 0.62, 0.22)) {
        if (s.k % 2 === 0) {
          // A candy cane, its hook curled out over the meadow.
          shafts.push({ p: [s.x, wallHeight + 0.4, s.z], r: [0, h1(s.seed) * 6, 0], s: [1, 0.74, 1] });
          hooks.push({
            p: [s.x + run.nx * 0.13, wallHeight + 0.77, s.z + run.nz * 0.13],
            r: [0, Math.atan2(-run.nz, run.nx), 0],
          });
        } else {
          const sc = 0.85 + h1(s.seed + 2) * 0.35;
          gums.push({
            p: [s.x, wallHeight + 0.07, s.z],
            s: [sc, sc * 1.15, sc],
            c: GUMDROP[(s.k + run.id * 2) % GUMDROP.length],
          });
        }
      }
      // Icing run down the inside face, in drips of uneven length.
      for (const s of spots(run, 0.24, 0.1)) {
        const len = 0.1 + h1(s.seed + 4) * 0.22;
        drips.push({
          p: [s.x - run.nx * 0.255, wallHeight - 0.06 - len / 2, s.z - run.nz * 0.255],
          s: [run.tz !== 0 ? 0.035 : 0.07, len / 2, run.tz !== 0 ? 0.07 : 0.035],
        });
      }
    }
    return { shafts, hooks, gums, drips };
  }, []);
  const stripes = candyStripes();
  return (
    <group>
      <Berm color={theme.wall.cap} radius={0.28} squash={0.5} roughness={0.55} />
      <Instanced items={drips}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color={theme.wall.cap} roughness={0.55} />
      </Instanced>
      <Instanced items={shafts}>
        <cylinderGeometry args={[0.065, 0.065, 1, 8]} />
        <meshStandardMaterial map={stripes} roughness={0.35} />
      </Instanced>
      <Instanced items={hooks}>
        <torusGeometry args={[0.13, 0.065, 6, 10, Math.PI]} />
        <meshStandardMaterial map={stripes} roughness={0.35} />
      </Instanced>
      <Instanced items={gums}>
        <sphereGeometry args={[0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#ffffff" roughness={0.75} />
      </Instanced>
    </group>
  );
}

function CandyCorner({ theme }: { theme: ArenaTheme }) {
  // A swirl lollipop, its face turned up to the camera, on a gumdrop.
  // A cylinder takes three materials — side, top, bottom — so the swirl
  // goes on the two faces and the edge stays plain sugar.
  const faces = useMemo(() => {
    const swirl = lollipopSwirl();
    const face = new THREE.MeshStandardMaterial({ map: swirl, roughness: 0.3 });
    return [new THREE.MeshStandardMaterial({ color: '#ffd6e6', roughness: 0.3 }), face, face];
  }, []);
  useEffect(() => () => faces.forEach((m) => m.dispose()), [faces]);
  return (
    <group>
      <mesh position={[0, (wallHeight + 1.05) / 2, 0]}>
        <cylinderGeometry args={[0.055, 0.055, wallHeight + 1.05, 8]} />
        <meshStandardMaterial color="#fff6f0" roughness={0.5} />
      </mesh>
      <mesh position={[0, wallHeight + 1.1, 0]} rotation={[0.3, 0, 0]} material={faces}>
        <cylinderGeometry args={[0.52, 0.52, 0.12, 28]} />
      </mesh>
      <mesh position={[0, wallHeight, 0]} scale={[1, 1.1, 1]}>
        <sphereGeometry args={[0.36, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={theme.tower.roof} roughness={0.75} />
      </mesh>
    </group>
  );
}

/* ── Glow Glade ───────────────────────────────────────────────────── */

const STONE = ['#77736a', '#6b675d', '#868072', '#5f5c55'];
const MOSS = ['#4f8550', '#437a48', '#5a9152'];
const SPORE = ['#86f7e6', '#d8f78a'];

function GladeWall() {
  const { stones, moss, stems, caps, halos } = useMemo(() => {
    const stones: Inst[] = [];
    const moss: Inst[] = [];
    const stems: Inst[] = [];
    const caps: Inst[] = [];
    const halos: Inst[] = [];
    for (const run of RUNS) {
      // Dry-stone: boulders of every size, packed shoulder to shoulder.
      for (const s of spots(run, 0.27, 0.05)) {
        const r = 0.15 + h1(s.seed) * 0.1;
        const off = (h1(s.seed + 1) - 0.5) * 0.18;
        const x = s.x + run.nx * off;
        const z = s.z + run.nz * off;
        const y = wallHeight + r * 0.3;
        stones.push({
          p: [x, y, z],
          r: [h1(s.seed + 2) * 6, h1(s.seed + 3) * 6, h1(s.seed + 4) * 6],
          s: [r, r * 0.75, r],
          c: STONE[Math.floor(h1(s.seed + 5) * STONE.length)],
        });
        if (h1(s.seed + 6) < 0.45) {
          moss.push({
            p: [x, y + r * 0.45, z],
            s: [r * 0.85, r * 0.32, r * 0.85],
            c: MOSS[Math.floor(h1(s.seed + 8) * MOSS.length)],
          });
        }
      }
      // Toadstools in clumps of two or three, every metre or so.
      for (const s of spots(run, 0.95, 0.3)) {
        const n = 2 + (h1(s.seed + 9) > 0.5 ? 1 : 0);
        const glow = SPORE[(s.k + run.id) % 2];
        for (let m = 0; m < n; m++) {
          const ox = (h1(s.seed + 10 + m) - 0.5) * 0.26;
          const oz = (h1(s.seed + 20 + m) - 0.5) * 0.26;
          const hgt = 0.1 + h1(s.seed + 30 + m) * 0.16;
          const cr = 0.06 + h1(s.seed + 40 + m) * 0.05;
          const base = wallHeight + 0.14;
          stems.push({ p: [s.x + ox, base + hgt / 2, s.z + oz], s: [1, hgt, 1] });
          caps.push({ p: [s.x + ox, base + hgt, s.z + oz], s: [cr, cr * 0.7, cr], c: glow });
        }
        halos.push({ p: [s.x, wallHeight + 0.32, s.z], r: [-Math.PI / 2, 0, 0], s: 0.75, c: glow });
      }
    }
    return { stones, moss, stems, caps, halos };
  }, []);
  const glow = glowTexture();
  return (
    <group>
      <Instanced items={stones}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#ffffff" roughness={1} flatShading />
      </Instanced>
      <Instanced items={moss}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color="#ffffff" roughness={1} />
      </Instanced>
      <Instanced items={stems}>
        <cylinderGeometry args={[0.022, 0.032, 1, 5]} />
        <meshStandardMaterial color="#e6e0cf" roughness={0.8} />
      </Instanced>
      {/* Unlit, so the caps are LIGHTS under the night rig, not paint. */}
      <Instanced items={caps}>
        <sphereGeometry args={[1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial color="#ffffff" />
      </Instanced>
      <Instanced items={halos} renderOrder={2}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color="#ffffff"
          map={glow}
          transparent
          opacity={0.5}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </Instanced>
    </group>
  );
}

function GladeCorner({ theme }: { theme: ArenaTheme }) {
  // A mossy cairn with three glowing toadstools growing out of its top.
  const glow = theme.tower.roof;
  return (
    <group>
      <mesh position={[0, 0.5, 0]} scale={[1, 0.85, 1]} rotation={[0.3, 0.7, 0.1]}>
        <dodecahedronGeometry args={[0.55, 0]} />
        <meshStandardMaterial color="#6b675d" roughness={1} flatShading />
      </mesh>
      <mesh position={[0.05, 1.16, -0.04]} scale={[1, 0.8, 1]} rotation={[0.9, 0.2, 0.4]}>
        <dodecahedronGeometry args={[0.42, 0]} />
        <meshStandardMaterial color="#77736a" roughness={1} flatShading />
      </mesh>
      <mesh position={[0.05, 1.42, -0.04]} scale={[1, 0.35, 1]}>
        <sphereGeometry args={[0.38, 10, 6]} />
        <meshStandardMaterial color="#5d9a58" roughness={1} />
      </mesh>
      {([[0, 0.55, 0.3], [0.24, 0.36, 0.22], [-0.2, 0.26, 0.16]] as const).map(([ox, h, r], k) => (
        <group key={k} position={[ox, 1.5, k === 0 ? 0 : 0.14 * (k === 1 ? 1 : -1)]}>
          <mesh position={[0, h / 2, 0]}>
            <cylinderGeometry args={[r * 0.22, r * 0.32, h, 6]} />
            <meshStandardMaterial color="#e6e0cf" roughness={0.8} />
          </mesh>
          <mesh position={[0, h, 0]} scale={[1, 0.62, 1]}>
            <sphereGeometry args={[r, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshBasicMaterial color={k === 1 ? SPORE[1] : glow} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Fireflies over the moss outside the walls — the glade's idle life.
 *
 * Each is a camera-facing quad drawn additively; the twinkle and the
 * slow wander are worked out in the vertex shader from one time uniform
 * and a per-fly phase, so the CPU does nothing per frame.
 */
const FIREFLY_VERTEX = `
  attribute float aPhase;
  uniform float uTime;
  varying vec2 vUv;
  varying float vGlow;
  varying float vPick;
  void main() {
    vUv = uv;
    vec3 c = vec3(instanceMatrix[3]);
    c.y += sin(uTime * 0.9 + aPhase * 9.0) * 0.08;
    c.x += sin(uTime * 0.6 + aPhase * 5.0) * 0.06;
    c.z += cos(uTime * 0.5 + aPhase * 7.0) * 0.06;
    vec4 mv = modelViewMatrix * vec4(c, 1.0);
    mv.xy += position.xy * length(vec3(instanceMatrix[0]));
    gl_Position = projectionMatrix * mv;
    float tw = 0.5 + 0.5 * sin(uTime * 1.8 + aPhase * 6.2831);
    vGlow = 0.3 + 0.7 * tw * tw;
    vPick = step(0.5, fract(aPhase * 7.0));
  }
`;

const FIREFLY_FRAGMENT = `
  uniform vec3 uA;
  uniform vec3 uB;
  varying vec2 vUv;
  varying float vGlow;
  varying float vPick;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float a = 1.0 - smoothstep(0.0, 1.0, d);
    a *= a;
    vec3 col = mix(uA, uB, vPick) * (1.0 + 1.6 * (1.0 - smoothstep(0.0, 0.3, d)));
    gl_FragColor = vec4(col * a * vGlow, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function Fireflies({ colors = SPORE }: { colors?: readonly string[] } = {}) {
  const { items, phases } = useMemo(() => {
    const items: Inst[] = [];
    const ph: number[] = [];
    for (let i = 0; i < 46; i++) {
      const band = i % 3;
      let x: number;
      let z: number;
      if (band < 2) {
        x = (band === 0 ? -1 : 1) * (3.0 + h1(i + 1) * 0.85);
        z = -9.2 + h1(i + 2) * 14;
      } else {
        x = -3.7 + h1(i + 3) * 7.4;
        z = -7.4 - h1(i + 4) * 2.1;
      }
      items.push({ p: [x, 0.35 + h1(i + 5) * 1.4, z], s: 0.16 + h1(i + 6) * 0.1 });
      ph.push(h1(i + 7));
    }
    return { items, phases: new Float32Array(ph) };
  }, []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: FIREFLY_VERTEX,
        fragmentShader: FIREFLY_FRAGMENT,
        uniforms: {
          uTime: { value: 0 },
          uA: { value: new THREE.Color(colors[0]) },
          uB: { value: new THREE.Color(colors[1]) },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [colors],
  );
  useLive(material);
  return (
    <Instanced
      items={items}
      renderOrder={3}
      extra={<primitive object={material} attach="material" />}
    >
      <planeGeometry args={[1, 1]}>
        <instancedBufferAttribute attach="attributes-aPhase" args={[phases, 1]} />
      </planeGeometry>
    </Instanced>
  );
}

/* ── Pirate Cove ──────────────────────────────────────────────────── */

function netTexture(): THREE.DataTexture {
  // Knotted rope in an 8-pixel mesh; the gaps are cut out by alphaTest.
  return painted('net', 32, 32, (x, y) => {
    const rope = x % 8 < 3 || y % 8 < 3;
    return [255, 255, 255, rope ? 255 : 0];
  });
}

/** Where the cannon are run out, along both sides. */
const GUN_Z = [-3.0, -0.4, 2.2];
/** And where the boarding nets hang between them. */
const NET_Z = [-1.7, 3.5];

function CoveWall({ theme }: { theme: ArenaTheme }) {
  const { balusters, studs } = useMemo(() => {
    const balusters: Inst[] = [];
    const studs: Inst[] = [];
    for (const run of RUNS) {
      for (const s of spots(run, 0.26, 0.1)) {
        balusters.push({ p: [s.x, wallHeight + 0.22, s.z] });
      }
      // Stanchions up through the rail at every other baluster, each with
      // a brass cap: from above, the rail is a run of bright beads on dark
      // wood, which is what a ship's rail looks like and what audit.js
      // counts. A plain varnished rail read as a bare kerb (contrast 8).
      for (const s of spots(run, 0.52, 0.1)) {
        studs.push({ p: [s.x, wallHeight + 0.5, s.z] });
      }
    }
    return { balusters, studs };
  }, []);
  const net = useMemo(() => {
    const t = netTexture().clone();
    t.repeat.set(2.2, 3);
    // No mipmaps: averaged down, a net is mostly hole, falls under the
    // alpha cut-off and vanishes from the phone's distance.
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return t;
  }, []);
  useEffect(() => () => net.dispose(), [net]);
  return (
    <group>
      {RUNS.map((run) => {
        const deck = lying(run, wallHeight + 0.03);
        const rail = lying(run, wallHeight + 0.42);
        const long = run.len + (run.tz !== 0 ? 0 : 0.1);
        return (
          <group key={run.id}>
            {/* The covering board along the bulwark top. */}
            <mesh position={deck.position} rotation={deck.rotation}>
              <boxGeometry args={[long, 0.06, wallThickness + 0.08]} />
              <meshStandardMaterial color="#6b4a30" roughness={0.85} />
            </mesh>
            {/* The rail, varnished, on its balusters. */}
            <mesh position={rail.position} rotation={rail.rotation}>
              <boxGeometry args={[long, 0.08, 0.2]} />
              <meshStandardMaterial color="#8a5a32" roughness={0.35} />
            </mesh>
          </group>
        );
      })}
      <Instanced items={balusters}>
        <cylinderGeometry args={[0.035, 0.045, 0.34, 6]} />
        <meshStandardMaterial color="#d8b07a" roughness={0.6} />
      </Instanced>
      <Instanced items={studs}>
        <sphereGeometry args={[0.065, 8, 6]} />
        <meshStandardMaterial color="#e0b25a" roughness={0.3} metalness={0.5} />
      </Instanced>
      {/* Cannon run out through ports in both sides, over the water. */}
      {[-1, 1].map((side) =>
        GUN_Z.map((z) => (
          <group key={`${side}${z}`} position={[side * OUT_X, wallHeight * 0.62, z]}>
            <mesh position={[side * 0.005, 0, 0]}>
              <boxGeometry args={[0.04, 0.32, 0.34]} />
              <meshStandardMaterial color="#241810" roughness={0.9} />
            </mesh>
            <mesh position={[side * 0.18, 0, 0]} rotation={[0, 0, -side * (Math.PI / 2)]}>
              <cylinderGeometry args={[0.09, 0.12, 0.72, 10]} />
              <meshStandardMaterial color="#2f2f35" roughness={0.45} metalness={0.5} />
            </mesh>
            <mesh position={[side * 0.53, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
              <torusGeometry args={[0.085, 0.028, 6, 12]} />
              <meshStandardMaterial color="#2f2f35" roughness={0.45} metalness={0.5} />
            </mesh>
          </group>
        )),
      )}
      {/* Boarding nets hung over the side, from the rail to the water. */}
      {[-1, 1].map((side) =>
        NET_Z.map((z) => (
          <group key={`net${side}${z}`} position={[side * (OUT_X + 0.22), (wallHeight + 0.45) / 2, z]} rotation={[0, Math.PI / 2, 0]}>
            <mesh rotation={[-side * 0.32, 0, 0]}>
              <planeGeometry args={[1.05, 1.5]} />
              <meshStandardMaterial
                color="#ead6a6"
                map={net}
                alphaTest={0.5}
                side={THREE.DoubleSide}
                roughness={1}
              />
            </mesh>
          </group>
        )),
      )}
    </group>
  );
}

function CoveCorner({ theme }: { theme: ArenaTheme }) {
  // A knighthead post with a ship's lantern on it.
  return (
    <group>
      <mesh position={[0, (wallHeight + 0.6) / 2, 0]}>
        <cylinderGeometry args={[0.17, 0.21, wallHeight + 0.6, 10]} />
        <meshStandardMaterial color={theme.wall.color} roughness={0.85} />
      </mesh>
      <mesh position={[0, wallHeight + 0.62, 0]}>
        <cylinderGeometry args={[0.21, 0.21, 0.06, 10]} />
        <meshStandardMaterial color="#8a5a32" roughness={0.35} />
      </mesh>
      <mesh position={[0, wallHeight + 0.8, 0]}>
        <cylinderGeometry args={[0.12, 0.14, 0.28, 8]} />
        <meshBasicMaterial color={theme.tower.roof} />
      </mesh>
      <mesh position={[0, wallHeight + 1.02, 0]}>
        <coneGeometry args={[0.18, 0.16, 8]} />
        <meshStandardMaterial color="#2f2f35" roughness={0.5} metalness={0.5} />
      </mesh>
      <mesh position={[0, wallHeight + 1.13, 0]}>
        <torusGeometry args={[0.05, 0.015, 4, 10]} />
        <meshStandardMaterial color="#2f2f35" roughness={0.5} metalness={0.5} />
      </mesh>
    </group>
  );
}

function CoveBackdrop() {
  /*
    The sea on three sides of the ship: one sheet from the quay at the
    near end to past the top of the frame, running on under the deck.
    WaterSurface laps foam at its own edges, so that edge is the quay;
    the wash along the ship's sides is a band of its own, because three
    sheets meeting at the hull drew a seam of foam out across the water
    behind the jail where two of them touched.
  */
  const look = { shallow: '#3a9fb0', deep: troughOf('#2a7f9e', 0.5), foam: '#eef8f6', opacity: 1 };
  const len = OUT_Z + 12.2;
  const wash = painted('wash', 16, 4, (x, y) => {
    const t = x / 15;
    const fleck = ((x * 7 + y * 13) % 5) / 10;
    return [244, 251, 250, Math.round(Math.max(0, 1 - t * (1.1 + fleck)) * 200)];
  }, false);
  return (
    <group>
      <WaterSurface
        look={look}
        shape="square"
        size={[12, len]}
        flow={[0.03, -0.05]}
        position={[0, -0.1, OUT_Z - len / 2]}
      />
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * (OUT_X + 0.12), -0.09, 0]}
          rotation={[-Math.PI / 2, 0, side < 0 ? Math.PI : 0]}
        >
          <planeGeometry args={[0.26, OUT_Z * 2]} />
          <meshBasicMaterial map={wash} transparent depthWrite={false} />
        </mesh>
      ))}
      <mesh position={[0, -0.05, OUT_Z + 0.14]}>
        <boxGeometry args={[12, 0.14, 0.28]} />
        <meshStandardMaterial color="#5a4632" roughness={0.9} />
      </mesh>
    </group>
  );
}

/* ── Sunny Farm ───────────────────────────────────────────────────── */

function picketGeometry(): THREE.ExtrudeGeometry {
  const w = 0.13;
  const h = 0.56;
  const tip = 0.09;
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(w / 2, h);
  shape.lineTo(0, h + tip);
  shape.lineTo(-w / 2, h);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: false });
  g.translate(0, 0, -0.03);
  return g;
}

function sunflowerGeometry(): THREE.CircleGeometry {
  // A circle whose rim points alternate in and out: a ring of petals.
  const g = new THREE.CircleGeometry(0.3, 24);
  const pos = g.attributes.position;
  for (let i = 1; i < pos.count; i++) {
    const k = (i - 1) % 2 === 0 ? 1 : 0.7;
    pos.setXY(i, pos.getX(i) * k, pos.getY(i) * k);
  }
  pos.needsUpdate = true;
  return g;
}

const TURF = ['#6f9c45', '#7fae4f', '#8fbd5a'];

function FarmWall({ theme }: { theme: ArenaTheme }) {
  const { pickets, posts, caps, tufts } = useMemo(() => {
    const pickets: Inst[] = [];
    const posts: Inst[] = [];
    const caps: Inst[] = [];
    const tufts: Inst[] = [];
    for (const run of RUNS) {
      const face = Math.atan2(run.nx, run.nz);
      for (const s of spots(run, 0.19, 0.06)) {
        pickets.push({ p: [s.x, wallHeight - 0.04, s.z], r: [0, face, 0] });
      }
      for (const s of spots(run, 0.95, 0.25)) {
        posts.push({ p: [s.x, wallHeight + 0.28, s.z] });
        caps.push({ p: [s.x, wallHeight + 0.65, s.z], r: [0, Math.PI / 4, 0] });
      }
      // Tufts of grass on the inner half of the bank.
      for (const s of spots(run, 0.21, 0.05)) {
        const off = -0.08 - h1(s.seed) * 0.1;
        tufts.push({
          p: [s.x + run.nx * off, wallHeight + 0.08, s.z + run.nz * off],
          s: [1, 0.7 + h1(s.seed + 1) * 0.6, 1],
          c: TURF[Math.floor(h1(s.seed + 2) * TURF.length)],
        });
      }
    }
    return { pickets, posts, caps, tufts };
  }, []);
  const picket = useMemo(picketGeometry, []);
  useEffect(() => () => picket.dispose(), [picket]);
  const white = theme.wall.cap;
  return (
    <group>
      <Berm color="#86b257" radius={0.29} squash={0.4} />
      <Instanced items={tufts}>
        <coneGeometry args={[0.06, 0.16, 5]} />
        <meshStandardMaterial color="#ffffff" roughness={1} />
      </Instanced>
      <Instanced items={pickets}>
        <primitive object={picket} attach="geometry" />
        <meshStandardMaterial color={white} roughness={0.8} />
      </Instanced>
      {RUNS.map((run) =>
        [0.1, 0.34].map((y) => {
          const r = lying(run, wallHeight + y, 0.05);
          return (
            <mesh key={`${run.id}${y}`} position={r.position} rotation={r.rotation}>
              <boxGeometry args={[run.len, 0.06, 0.04]} />
              <meshStandardMaterial color={white} roughness={0.8} />
            </mesh>
          );
        }),
      )}
      <Instanced items={posts}>
        <boxGeometry args={[0.12, 0.68, 0.12]} />
        <meshStandardMaterial color={white} roughness={0.8} />
      </Instanced>
      <Instanced items={caps}>
        <coneGeometry args={[0.085, 0.09, 4]} />
        <meshStandardMaterial color={white} roughness={0.8} />
      </Instanced>
    </group>
  );
}

function FarmCorner({ theme }: { theme: ArenaTheme }) {
  // A white gatepost, and a sunflower turning its face up to the sun.
  const petals = useMemo(sunflowerGeometry, []);
  useEffect(() => () => petals.dispose(), [petals]);
  const white = theme.wall.cap;
  return (
    <group>
      <mesh position={[0, (wallHeight + 0.75) / 2, 0]}>
        <boxGeometry args={[0.26, wallHeight + 0.75, 0.26]} />
        <meshStandardMaterial color={white} roughness={0.8} />
      </mesh>
      <mesh position={[0, wallHeight + 0.78, 0]}>
        <boxGeometry args={[0.32, 0.06, 0.32]} />
        <meshStandardMaterial color={white} roughness={0.8} />
      </mesh>
      <mesh position={[0, wallHeight + 0.88, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[0.21, 0.16, 4]} />
        <meshStandardMaterial color="#d9d3c2" roughness={0.8} />
      </mesh>
      <group position={[0.3, 0, 0.2]}>
        <mesh position={[0, (wallHeight + 1.1) / 2, 0]}>
          <cylinderGeometry args={[0.03, 0.04, wallHeight + 1.1, 6]} />
          <meshStandardMaterial color="#5f8c3a" roughness={0.9} />
        </mesh>
        <mesh position={[0.1, wallHeight * 0.7, 0]} rotation={[0, 0, -0.6]} scale={[1, 0.25, 0.6]}>
          <sphereGeometry args={[0.16, 8, 6]} />
          <meshStandardMaterial color="#6f9c45" roughness={0.9} />
        </mesh>
        <group position={[0, wallHeight + 1.12, 0]} rotation={[-Math.PI / 2 + 0.35, 0, 0]}>
          <mesh geometry={petals}>
            <meshStandardMaterial color={theme.tower.roof} roughness={0.7} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.13, 0.13, 0.05, 14]} />
            <meshStandardMaterial color="#5a3a1f" roughness={0.95} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/* ── Coral Reef ───────────────────────────────────────────────────── */

const LIVE_ROCK = ['#8a7fa3', '#7a7094', '#9a8fb2', '#857a9e'];
const BRAIN = ['#f2a07a', '#f0c86a', '#ef8fb0'];
const TABLE = ['#7ccfb0', '#b9a0e0', '#9fd8e8'];
const STAG = ['#f2905a', '#a77ad8', '#ff8fa8'];
const TUBE = ['#d96aa0', '#e8b45a', '#8f7ad8'];
const ANEMONE = ['#9ff0d0', '#ffb0d0'];

function brainTexture(): THREE.DataTexture {
  // The meandering grooves of a brain coral: light ridges, dark valleys.
  return painted('brain', 32, 32, (x, y) => {
    const v = Math.sin(x * 0.78 + Math.sin(y * 0.39) * 2.2) * Math.cos(y * 0.39 + Math.sin(x * 0.2) * 1.5);
    const k = Math.round(190 + 65 * Math.max(-1, Math.min(1, v * 1.8)));
    return [k, k, k, 255];
  });
}

function ReefWall() {
  const parts = useMemo(() => {
    const rocks: Inst[] = [];
    const brains: Inst[] = [];
    const stalks: Inst[] = [];
    const plates: Inst[] = [];
    const branches: Inst[] = [];
    const tips: Inst[] = [];
    const tubes: Inst[] = [];
    const holes: Inst[] = [];
    const tentacles: Inst[] = [];
    for (const run of RUNS) {
      for (const s of spots(run, 0.3, 0.05)) {
        const r = 0.17 + h1(s.seed) * 0.09;
        rocks.push({
          p: [s.x + run.nx * (h1(s.seed + 1) - 0.5) * 0.12, wallHeight + 0.02, s.z + run.nz * (h1(s.seed + 1) - 0.5) * 0.12],
          r: [h1(s.seed + 2) * 6, h1(s.seed + 3) * 6, 0],
          s: [r, r * 0.7, r],
          c: LIVE_ROCK[Math.floor(h1(s.seed + 4) * LIVE_ROCK.length)],
        });
      }
      for (const s of spots(run, 0.5, 0.22)) {
        // Five kinds, in a cycle that starts somewhere different on each
        // wall, so no wall is a copy of its neighbour but every wall
        // carries all five.
        const kind = (s.k + run.id * 2) % 5;
        const base = wallHeight + 0.1;
        const j = (h1(s.seed + 5) - 0.5) * 0.12;
        const x = s.x + run.nx * j;
        const z = s.z + run.nz * j;
        if (kind === 0) {
          const r = 0.21 + h1(s.seed + 6) * 0.08;
          brains.push({ p: [x, base, z], r: [0, h1(s.seed) * 6, 0], s: [r, r * 0.8, r], c: BRAIN[(s.k + run.id) % 3] });
        } else if (kind === 1) {
          const r = 0.28 + h1(s.seed + 6) * 0.1;
          const tilt = (h1(s.seed + 7) - 0.5) * 0.3;
          stalks.push({ p: [x, base + 0.1, z], s: [1, 0.22, 1] });
          plates.push({ p: [x, base + 0.22, z], r: [tilt, 0, -tilt], s: [r, 0.045, r], c: TABLE[(s.k + run.id) % 3] });
        } else if (kind === 2) {
          const col = STAG[(s.k + run.id) % 3];
          for (let b = 0; b < 5; b++) {
            const az = b * 1.26 + h1(s.seed + b) * 0.8;
            const lean = 0.35 + h1(s.seed + b + 9) * 0.5;
            const L = 0.28 + h1(s.seed + b + 3) * 0.16;
            const dx = Math.sin(lean) * Math.cos(az);
            const dz = Math.sin(lean) * Math.sin(az);
            const dy = Math.cos(lean);
            // Rotate +y onto (dx, dy, dz): about the axis (dz, 0, -dx).
            const q = new THREE.Quaternion().setFromUnitVectors(
              new THREE.Vector3(0, 1, 0),
              new THREE.Vector3(dx, dy, dz),
            );
            const e = new THREE.Euler().setFromQuaternion(q);
            branches.push({ p: [x + (dx * L) / 2, base + (dy * L) / 2, z + (dz * L) / 2], r: [e.x, e.y, e.z], s: [1, L, 1], c: col });
            tips.push({ p: [x + dx * L, base + dy * L, z + dz * L], s: 1, c: col });
          }
        } else if (kind === 3) {
          const col = TUBE[(s.k + run.id) % 3];
          for (let b = 0; b < 3; b++) {
            const ox = Math.cos(b * 2.1) * 0.1;
            const oz = Math.sin(b * 2.1) * 0.08;
            const hh = 0.22 + h1(s.seed + b) * 0.22;
            tubes.push({ p: [x + ox, base + hh / 2, z + oz], s: [0.085, hh, 0.085], c: col });
            holes.push({ p: [x + ox, base + hh - 0.02, z + oz], r: [-Math.PI / 2, 0, 0], s: 0.072 });
          }
        } else {
          const col = ANEMONE[(s.k + run.id) % 2];
          for (let b = 0; b < 9; b++) {
            const az = (b * Math.PI * 2) / 9;
            const lean = 0.55 + (b % 2) * 0.25;
            const L = 0.16;
            const dx = Math.sin(lean) * Math.cos(az);
            const dz = Math.sin(lean) * Math.sin(az);
            const dy = Math.cos(lean);
            const q = new THREE.Quaternion().setFromUnitVectors(
              new THREE.Vector3(0, 1, 0),
              new THREE.Vector3(dx, dy, dz),
            );
            const e = new THREE.Euler().setFromQuaternion(q);
            tentacles.push({ p: [x + (dx * L) / 2, base + 0.04 + (dy * L) / 2, z + (dz * L) / 2], r: [e.x, e.y, e.z], s: [1, L, 1], c: col });
          }
        }
      }
    }
    return { rocks, brains, stalks, plates, branches, tips, tubes, holes, tentacles };
  }, []);
  const brain = brainTexture();
  return (
    <group>
      <Instanced items={parts.rocks}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#ffffff" roughness={1} flatShading />
      </Instanced>
      <Instanced items={parts.brains}>
        <sphereGeometry args={[1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#ffffff" map={brain} roughness={0.85} emissive="#3a3446" />
      </Instanced>
      <Instanced items={parts.stalks}>
        <cylinderGeometry args={[0.04, 0.06, 1, 6]} />
        <meshStandardMaterial color="#8a7f9a" roughness={0.9} />
      </Instanced>
      <Instanced items={parts.plates}>
        <cylinderGeometry args={[1, 0.8, 1, 14]} />
        <meshStandardMaterial color="#ffffff" roughness={0.8} emissive="#3a3446" />
      </Instanced>
      <Instanced items={parts.branches}>
        <cylinderGeometry args={[0.03, 0.05, 1, 5]} />
        <meshStandardMaterial color="#ffffff" roughness={0.8} emissive="#3a3446" />
      </Instanced>
      <Instanced items={parts.tips}>
        <sphereGeometry args={[0.032, 6, 4]} />
        <meshBasicMaterial color="#ffffff" />
      </Instanced>
      <Instanced items={parts.tubes}>
        <cylinderGeometry args={[1, 0.8, 1, 10, 1, true]} />
        <meshStandardMaterial color="#ffffff" roughness={0.85} side={THREE.DoubleSide} emissive="#3a3446" />
      </Instanced>
      <Instanced items={parts.holes}>
        <circleGeometry args={[1, 10]} />
        <meshBasicMaterial color="#2a1630" />
      </Instanced>
      <Instanced items={parts.tentacles}>
        <coneGeometry args={[0.026, 1, 5]} />
        <meshBasicMaterial color="#ffffff" />
      </Instanced>
    </group>
  );
}

function ReefCorner({ theme }: { theme: ArenaTheme }) {
  // A heap of live rock carrying two tiers of table coral, the top one
  // crowned with an anemone.
  return (
    <group>
      <mesh position={[0, 0.48, 0]} scale={[1, 0.85, 1]} rotation={[0.4, 0.3, 0.2]}>
        <dodecahedronGeometry args={[0.55, 0]} />
        <meshStandardMaterial color="#665c78" roughness={1} flatShading />
      </mesh>
      <mesh position={[0, 1.1, 0]} scale={[1, 0.8, 1]} rotation={[0.9, 0.5, 0.1]}>
        <dodecahedronGeometry args={[0.4, 0]} />
        <meshStandardMaterial color="#7c7090" roughness={1} flatShading />
      </mesh>
      <mesh position={[0, wallHeight + 0.2, 0]}>
        <cylinderGeometry args={[0.06, 0.09, 0.5, 6]} />
        <meshStandardMaterial color="#8a7f9a" roughness={0.9} />
      </mesh>
      <mesh position={[0, wallHeight + 0.28, 0]} rotation={[0.12, 0, 0.1]}>
        <cylinderGeometry args={[0.52, 0.44, 0.05, 16]} />
        <meshStandardMaterial color={TABLE[0]} roughness={0.8} />
      </mesh>
      <mesh position={[0.04, wallHeight + 0.55, 0.02]}>
        <cylinderGeometry args={[0.04, 0.06, 0.3, 6]} />
        <meshStandardMaterial color="#8a7f9a" roughness={0.9} />
      </mesh>
      <mesh position={[0.04, wallHeight + 0.7, 0.02]} rotation={[-0.1, 0, -0.08]}>
        <cylinderGeometry args={[0.32, 0.27, 0.05, 14]} />
        <meshStandardMaterial color={TABLE[1]} roughness={0.8} />
      </mesh>
      {([0, 1, 2, 3, 4, 5, 6, 7] as const).map((k) => {
        const a = (k * Math.PI * 2) / 8;
        return (
          <mesh
            key={k}
            position={[0.04 + Math.cos(a) * 0.07, wallHeight + 0.82, 0.02 + Math.sin(a) * 0.07]}
            rotation={[Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6]}
          >
            <coneGeometry args={[0.035, 0.24, 5]} />
            <meshBasicMaterial color={theme.tower.roof} />
          </mesh>
        );
      })}
    </group>
  );
}

/**
 * Light moving over the sea floor — the reef's idle life.
 *
 * The same rippled-light cells the water shader draws (water.tsx),
 * worked out in WORLD space and laid additively over the whole floor,
 * tray and reef alike, so the dice sit in shifting light. Fainter
 * inside the tray, where the dice have to be read.
 */
const CAUSTIC_VERTEX = `
  varying vec2 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const CAUSTIC_FRAGMENT = `
  uniform float uTime;
  uniform vec3 uTint;
  uniform vec2 uTray;
  varying vec2 vWorld;
  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
  }
  float cells(vec2 p, float t) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float d1 = 8.0;
    float d2 = 8.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 g = vec2(float(x), float(y));
        vec2 o = 0.5 + 0.3 * sin(t * 0.7 + 6.2831 * hash2(i + g));
        vec2 r = g + o - f;
        float d = dot(r, r);
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
      }
    }
    return sqrt(d2) - sqrt(d1);
  }
  void main() {
    vec2 q = vWorld * 1.7 + vec2(uTime * 0.05, -uTime * 0.035);
    q += 0.12 * vec2(sin(q.y * 2.1 + uTime), sin(q.x * 1.9 - uTime * 0.8));
    float web = 1.0 - smoothstep(0.0, 0.06, cells(q, uTime));
    bool inTray = abs(vWorld.x) < uTray.x && abs(vWorld.y) < uTray.y;
    float k = web * (inTray ? 0.035 : 0.12);
    gl_FragColor = vec4(uTint * k, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function ReefBackdrop() {
  const caustics = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: CAUSTIC_VERTEX,
        fragmentShader: CAUSTIC_FRAGMENT,
        uniforms: {
          uTime: { value: 0 },
          uTint: { value: new THREE.Color('#c6f6ff') },
          uTray: { value: new THREE.Vector2(halfW, halfD) },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  useLive(caustics);
  const deep = painted('deep', 2, 32, (_x, y) => {
    const t = y / 31;
    return [6, 40, 58, Math.round(Math.min(1, t * 1.3) * 225)];
  }, false);
  return (
    <group>
      {/* The reef dropping away into deep water behind the jail. */}
      <mesh position={[0, -0.105, -10.3]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 4]} />
        <meshBasicMaterial map={deep} transparent depthWrite={false} />
      </mesh>
      <mesh position={[0, -0.035, -1.35]} rotation={[-Math.PI / 2, 0, 0]} material={caustics} renderOrder={1}>
        <planeGeometry args={[9.4, 19.6]} />
      </mesh>
    </group>
  );
}

/* ── Rooftop City ─────────────────────────────────────────────────── */

/** Where the air conditioners stand: [run, distance along it]. */
const AC_UNITS: [number, number][] = [
  [0, 2.2], [0, 5.3], [0, 8.2],
  [1, 2.0], [1, 4.9], [1, 8.0],
  [3, 1.3], [3, 3.4],
];

function CityWall({ theme }: { theme: ArenaTheme }) {
  const { stems, caps } = useMemo(() => {
    const stems: Inst[] = [];
    const caps: Inst[] = [];
    for (const run of RUNS) {
      for (const s of spots(run, 0.62, 0.25)) {
        const clear = AC_UNITS.every(([r, d]) => r !== run.id || Math.abs(d - s.s) > 0.55);
        if (!clear || s.k % 2 === 1) continue;
        stems.push({ p: [s.x + run.nx * 0.08, wallHeight + 0.2, s.z + run.nz * 0.08] });
        caps.push({ p: [s.x + run.nx * 0.08, wallHeight + 0.33, s.z + run.nz * 0.08] });
      }
    }
    return { stems, caps };
  }, []);
  const at = (run: Run, d: number, out = 0): [number, number, number] => [
    run.ax + run.tx * d + run.nx * out,
    0,
    run.az + run.tz * d + run.nz * out,
  ];
  return (
    <group>
      {RUNS.map((run) => {
        const coping = lying(run, wallHeight + 0.05);
        const pipe = lying(run, wallHeight + 0.15, -0.17);
        return (
          <group key={run.id}>
            <mesh position={coping.position} rotation={coping.rotation}>
              <boxGeometry args={[run.len + (run.tz !== 0 ? 0 : 0.1), 0.1, wallThickness + 0.08]} />
              <meshStandardMaterial color={theme.wall.cap} roughness={0.9} />
            </mesh>
            {/* A pipe run along the inside edge of the parapet. */}
            <mesh position={pipe.position} rotation={[0, run.yaw, Math.PI / 2]}>
              <cylinderGeometry args={[0.045, 0.045, run.len - 0.2, 8]} />
              <meshStandardMaterial color="#9aa1ae" roughness={0.4} metalness={0.5} />
            </mesh>
          </group>
        );
      })}
      <Instanced items={stems}>
        <cylinderGeometry args={[0.05, 0.05, 0.22, 8]} />
        <meshStandardMaterial color="#b4bac6" roughness={0.4} metalness={0.5} />
      </Instanced>
      <Instanced items={caps}>
        <coneGeometry args={[0.12, 0.08, 10]} />
        <meshStandardMaterial color="#c9ced8" roughness={0.4} metalness={0.5} />
      </Instanced>
      {/* Air conditioners: a box with a fan grille on top — a circle in a
          square, which is the most recognisable thing on a roof from above. */}
      {AC_UNITS.map(([r, d]) => {
        const run = RUNS[r];
        const [x, , z] = at(run, d, 0.04);
        return (
          <group key={`${r}-${d}`} position={[x, wallHeight + 0.1, z]} rotation={[0, run.yaw, 0]}>
            <mesh position={[0, 0.15, 0]}>
              <boxGeometry args={[0.5, 0.3, 0.44]} />
              <meshStandardMaterial color="#c9cdd6" roughness={0.6} metalness={0.2} />
            </mesh>
            <mesh position={[0, 0.305, 0]}>
              <cylinderGeometry args={[0.16, 0.16, 0.02, 16]} />
              <meshStandardMaterial color="#2f3440" roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.315, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.16, 0.016, 4, 18]} />
              <meshStandardMaterial color="#e0e3ea" roughness={0.5} metalness={0.3} />
            </mesh>
            <mesh position={[0, 0.32, 0]}>
              <boxGeometry args={[0.3, 0.012, 0.03]} />
              <meshStandardMaterial color="#9aa1ae" roughness={0.5} />
            </mesh>
          </group>
        );
      })}
      {/* An aerial on each long wall, with its warning light. */}
      {([[0, 6.7], [1, 3.4]] as const).map(([r, d]) => {
        const [x, , z] = at(RUNS[r], d, 0.1);
        return (
          <group key={`aerial-${r}`} position={[x, wallHeight + 0.1, z]}>
            <mesh position={[0, 0.6, 0]}>
              <cylinderGeometry args={[0.022, 0.03, 1.2, 6]} />
              <meshStandardMaterial color="#8f96a8" roughness={0.4} metalness={0.6} />
            </mesh>
            {[0.55, 0.8, 1.02].map((y, k) => (
              <mesh key={k} position={[0, y, 0]} rotation={[0, k * 0.5, 0]}>
                <boxGeometry args={[0.5 - k * 0.12, 0.02, 0.02]} />
                <meshStandardMaterial color="#8f96a8" roughness={0.4} metalness={0.6} />
              </mesh>
            ))}
            <mesh position={[0, 1.22, 0]}>
              <sphereGeometry args={[0.05, 8, 6]} />
              <meshBasicMaterial color="#ff6e6e" />
            </mesh>
          </group>
        );
      })}
      {/* A satellite dish on each long wall, turned to the sky. */}
      {([[0, 3.7], [1, 6.5]] as const).map(([r, d]) => {
        const [x, , z] = at(RUNS[r], d, 0.05);
        return (
          <group key={`dish-${r}`} position={[x, wallHeight + 0.1, z]}>
            <mesh position={[0, 0.1, 0]}>
              <boxGeometry args={[0.16, 0.2, 0.16]} />
              <meshStandardMaterial color="#9aa1ae" roughness={0.5} />
            </mesh>
            <mesh position={[0, 0.3, 0]} rotation={[0.9, 0.5, 0]}>
              <sphereGeometry args={[0.24, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2.6]} />
              <meshStandardMaterial color="#e6e8ee" roughness={0.45} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function CityCorner() {
  // A rooftop water tower: a timber tank on stilts with a conical lid.
  return (
    <group>
      <mesh position={[0, wallHeight / 2, 0]}>
        <boxGeometry args={[0.66, wallHeight, 0.66]} />
        <meshStandardMaterial color="#8a8fa2" roughness={0.9} />
      </mesh>
      {([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).map(([sx, sz], k) => (
        <mesh key={k} position={[sx * 0.24, wallHeight + 0.3, sz * 0.24]}>
          <cylinderGeometry args={[0.03, 0.03, 0.6, 5]} />
          <meshStandardMaterial color="#4c5170" roughness={0.6} metalness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, wallHeight + 0.6 + 0.31, 0]}>
        <cylinderGeometry args={[0.4, 0.4, 0.62, 14]} />
        <meshStandardMaterial color="#8a6a4f" roughness={0.9} />
      </mesh>
      {[0.12, 0.5].map((y) => (
        <mesh key={y} position={[0, wallHeight + 0.6 + y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.405, 0.016, 4, 20]} />
          <meshStandardMaterial color="#3a3d4a" roughness={0.5} metalness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, wallHeight + 1.22 + 0.15, 0]}>
        <coneGeometry args={[0.45, 0.3, 14]} />
        <meshStandardMaterial color="#4f3f33" roughness={0.85} />
      </mesh>
      <mesh position={[0, wallHeight + 1.55, 0]}>
        <sphereGeometry args={[0.05, 8, 6]} />
        <meshBasicMaterial color="#ff6e6e" />
      </mesh>
    </group>
  );
}

/* ── Toy Room ─────────────────────────────────────────────────────── */

const BRICK = ['#d06a5e', '#5aa7a8', '#e7b84f', '#7c95d6', '#efe3c8', '#93c27e'];
/** Four courses to the wall's height, and a fifth standing proud as the crest. */
const COURSE = wallHeight / 4;
const CREST_TOP = wallHeight + COURSE * 0.9;

function ToyWall() {
  const { bricks, studs } = useMemo(() => {
    const bricks: Inst[] = [];
    const studs: Inst[] = [];
    for (const run of RUNS) {
      // A whole number of studs to the run, so every course closes.
      const n = Math.round(run.len / 0.25);
      const pitch = run.len / n;
      for (let course = 0; course < 5; course++) {
        const y0 = course * COURSE;
        const hgt = course === 4 ? CREST_TOP - wallHeight : COURSE;
        // Stagger: odd courses start half a brick along.
        let at = 0;
        let first = true;
        let prev = -1;
        let b = 0;
        while (at < n) {
          const seed = run.id * 977 + course * 131 + b * 17;
          let len = 2 + Math.floor(h1(seed) * 3);
          if (first && course % 2 === 1) len = 1 + Math.floor(h1(seed + 1) * 2);
          len = Math.min(len, n - at);
          let ci = Math.floor(h1(seed + 2) * BRICK.length);
          if (ci === prev) ci = (ci + 1 + Math.floor(h1(seed + 3) * 4)) % BRICK.length;
          prev = ci;
          const mid = (at + len / 2) * pitch;
          const x = run.ax + run.tx * mid;
          const z = run.az + run.tz * mid;
          bricks.push({
            p: [x, y0 + hgt / 2, z],
            r: [0, run.yaw, 0],
            s: [len * pitch - 0.016, hgt - 0.014, wallThickness + 0.02],
            c: BRICK[ci],
          });
          if (course === 4) {
            for (let k = 0; k < len; k++) {
              const d = (at + k + 0.5) * pitch;
              for (const across of [-0.125, 0.125]) {
                studs.push({
                  p: [run.ax + run.tx * d + run.nx * across, CREST_TOP + 0.035, run.az + run.tz * d + run.nz * across],
                  c: BRICK[ci],
                });
              }
            }
          }
          at += len;
          first = false;
          b++;
        }
      }
    }
    return { bricks, studs };
  }, []);
  return (
    <group>
      <Instanced items={bricks}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ffffff" roughness={0.45} />
      </Instanced>
      <Instanced items={studs}>
        <cylinderGeometry args={[0.082, 0.082, 0.07, 12]} />
        <meshStandardMaterial color="#ffffff" roughness={0.45} />
      </Instanced>
    </group>
  );
}

function ToyCorner({ theme }: { theme: ArenaTheme }) {
  // Big two-by-four bricks stacked crossways, a beach ball on the top.
  const layers = 5;
  const h = 0.38;
  return (
    <group>
      {Array.from({ length: layers }, (_, k) => (
        <mesh key={k} position={[0, h / 2 + k * h, 0]} rotation={[0, (k % 2) * (Math.PI / 2), 0]}>
          <boxGeometry args={[1.0, h - 0.02, 0.5]} />
          <meshStandardMaterial color={BRICK[(k * 2 + 1) % BRICK.length]} roughness={0.45} />
        </mesh>
      ))}
      {([-0.375, -0.125, 0.125, 0.375] as const).map((sx) =>
        ([-0.125, 0.125] as const).map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx, layers * h + 0.035, sz]}>
            <cylinderGeometry args={[0.085, 0.085, 0.07, 12]} />
            <meshStandardMaterial color={BRICK[(layers * 2 - 1) % BRICK.length]} roughness={0.45} />
          </mesh>
        )),
      )}
      <group position={[0, layers * h + 0.33, 0]} rotation={[0.5, 0.3, 0.2]}>
        <mesh>
          <sphereGeometry args={[0.28, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={theme.tower.roof} roughness={0.35} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.28, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
          <meshStandardMaterial color="#f6f1e6" roughness={0.35} />
        </mesh>
      </group>
    </group>
  );
}

/* ── Dino Valley ──────────────────────────────────────────────────── */

const BOULDER = ['#857a68', '#7a705f', '#948a76', '#6f6656'];
const FERN = ['#4f8a30', '#5f9a3a', '#3f7a28', '#6aa844'];

/**
 * Dino Valley's rim, a concept, 20 Oct 2026: a mossy bank heaped with
 * boulders, ferns sprouting between them and leaning out over the edge.
 * Every boulder and every frond is one instanced draw.
 */
function DinoWall() {
  const { rocks, fronds } = useMemo(() => {
    const rocks: Inst[] = [];
    const fronds: Inst[] = [];
    for (const run of RUNS) {
      for (const s of spots(run, 0.4, 0.1)) {
        const sz = 0.15 + h1(s.seed) * 0.09;
        const off = (h1(s.seed + 3) - 0.5) * 0.14;
        rocks.push({
          p: [s.x + run.nx * off, wallHeight + sz * 0.5, s.z + run.nz * off],
          r: [h1(s.seed + 4) * 3, h1(s.seed + 5) * 3, h1(s.seed + 6) * 3],
          s: [sz * 1.2, sz, sz * 1.1],
          c: BOULDER[Math.floor(h1(s.seed + 7) * BOULDER.length)],
        });
      }
      for (const s of spots(run, 0.33, 0.05)) {
        for (let k = 0; k < 2; k++) {
          const seed = s.seed + k * 17;
          const out = k === 0 ? 0.18 : -0.05;
          const lean = (k === 0 ? 1 : -0.4) * (0.7 + h1(seed) * 0.4);
          // A frond leans along the run's normal: tilt about the run's own axis.
          const yaw = Math.atan2(run.nx, run.nz) + (h1(seed + 1) - 0.5) * 1.2;
          fronds.push({
            p: [s.x + run.nx * out, wallHeight + 0.12, s.z + run.nz * out],
            r: [lean, yaw, 0],
            s: [0.55, 1.2 + h1(seed + 2) * 0.5, 0.18],
            c: FERN[Math.floor(h1(seed + 3) * FERN.length)],
          });
        }
      }
    }
    return { rocks, fronds };
  }, []);
  return (
    <group>
      <Berm color="#6f9a3c" radius={0.3} squash={0.45} />
      <Instanced items={rocks}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#ffffff" roughness={0.95} flatShading />
      </Instanced>
      <Instanced items={fronds}>
        <coneGeometry args={[0.18, 0.5, 4]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      </Instanced>
    </group>
  );
}

/**
 * A corner of Dino Valley: a giant fossil ribcage half buried in the
 * bank — a spine lying across the corner with five ribs arching up out
 * of it, the middle ones tallest — beside a mossy boulder.
 */
function DinoCorner({ theme }: { theme: ArenaTheme }) {
  const bone = theme.tower.body;
  return (
    <group rotation={[0, Math.PI / 4, 0]}>
      <mesh position={[0, wallHeight + 0.06, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.07, 0.05, 1.2, 8]} />
        <meshStandardMaterial color={bone} roughness={0.7} />
      </mesh>
      {[-0.44, -0.22, 0, 0.22, 0.44].map((x, k) => {
        const r = 0.42 - Math.abs(x) * 0.45;
        return (
          <mesh key={k} position={[x, wallHeight + 0.04, 0]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[r, 0.045, 6, 14, Math.PI]} />
            <meshStandardMaterial color={bone} roughness={0.7} />
          </mesh>
        );
      })}
      <mesh position={[0.55, wallHeight + 0.18, 0.35]} scale={[0.32, 0.26, 0.3]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#7a705f" roughness={0.95} flatShading />
      </mesh>
      <mesh position={[0.55, wallHeight + 0.4, 0.35]} scale={[0.26, 0.06, 0.24]}>
        <sphereGeometry args={[1, 10, 6]} />
        <meshStandardMaterial color="#5f9a3a" roughness={1} />
      </mesh>
    </group>
  );
}

/* ── Sun Temple ───────────────────────────────────────────────────── */

const SANDSTONE = ['#c99a55', '#b8864a', '#d4a962', '#a8743c'];

/**
 * The Sun Temple's wall, season 2 of the pass (21 Oct 2026): two
 * courses of cut sandstone laid in running bond along the wall top, a
 * gold sun medallion lying on the top course every so often, and a
 * brazier burning between them. Blocks, medallions, rays, bowls, flames
 * and halos are one instanced draw each.
 */
function TempleWall() {
  const { blocks, medals, rays, bowls, flames, halos } = useMemo(() => {
    const blocks: Inst[] = [];
    const medals: Inst[] = [];
    const rays: Inst[] = [];
    const bowls: Inst[] = [];
    const flames: Inst[] = [];
    const halos: Inst[] = [];
    for (const run of RUNS) {
      for (const s of spots(run, 0.36, 0.02)) {
        blocks.push({
          p: [s.x, wallHeight + 0.09, s.z],
          r: [0, run.yaw, 0],
          s: [0.34, 0.18, 0.46],
          c: SANDSTONE[Math.floor(h1(s.seed) * SANDSTONE.length)],
        });
        if (s.k % 2 === 0) {
          blocks.push({
            p: [s.x + run.tx * 0.18, wallHeight + 0.27, s.z + run.tz * 0.18],
            r: [0, run.yaw, 0],
            s: [0.34, 0.18, 0.34],
            c: SANDSTONE[Math.floor(h1(s.seed + 5) * SANDSTONE.length)],
          });
        }
      }
      for (const s of spots(run, 1.15, 0.45)) {
        if (s.k % 2 === 0) {
          medals.push({ p: [s.x, wallHeight + 0.38, s.z], s: [0.15, 0.03, 0.15], c: '#f0b240' });
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2 + run.yaw;
            rays.push({
              p: [s.x + Math.cos(a) * 0.19, wallHeight + 0.38, s.z + Math.sin(a) * 0.19],
              r: [0, -a, -Math.PI / 2],
              s: [0.045, 0.09, 0.03],
              c: '#f0b240',
            });
          }
        } else {
          bowls.push({ p: [s.x, wallHeight + 0.42, s.z], s: [0.1, 0.1, 0.1], c: '#4a3823' });
          flames.push({ p: [s.x, wallHeight + 0.56, s.z], s: [0.075, 0.13, 0.075], c: '#ffb347' });
          halos.push({ p: [s.x, wallHeight + 0.5, s.z], r: [-Math.PI / 2, 0, 0], s: 0.6, c: '#ff9a2a' });
        }
      }
    }
    return { blocks, medals, rays, bowls, flames, halos };
  }, []);
  const glow = glowTexture();
  return (
    <group>
      <Instanced items={blocks}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      </Instanced>
      <Instanced items={medals}>
        <cylinderGeometry args={[1, 1, 1, 18]} />
        <meshStandardMaterial color="#ffffff" roughness={0.35} metalness={0.5} />
      </Instanced>
      <Instanced items={rays}>
        <coneGeometry args={[1, 1, 4]} />
        <meshStandardMaterial color="#ffffff" roughness={0.35} metalness={0.5} />
      </Instanced>
      <Instanced items={bowls}>
        <cylinderGeometry args={[1, 0.6, 1, 8]} />
        <meshStandardMaterial color="#ffffff" roughness={0.8} />
      </Instanced>
      {/* Unlit, so a flame is a light under any rig. */}
      <Instanced items={flames}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color="#ffffff" />
      </Instanced>
      <Instanced items={halos} renderOrder={2}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#ffffff" map={glow} transparent opacity={0.45} depthWrite={false} blending={THREE.AdditiveBlending} />
      </Instanced>
    </group>
  );
}

/** A corner of the Sun Temple: a stepped shrine with a gold sun on top. */
function TempleCorner({ theme }: { theme: ArenaTheme }) {
  const gold = theme.tower.roof;
  return (
    <group>
      {([
        [0.9, 0.26],
        [0.62, 0.24],
        [0.36, 0.22],
      ] as const).map(([w, h], k) => (
        <mesh key={k} position={[0, wallHeight + 0.02 + k * 0.25 + h / 2, 0]}>
          <boxGeometry args={[w, h, w]} />
          <meshStandardMaterial color={k % 2 ? '#e8d0a0' : '#d9b878'} roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, wallHeight + 1.0, 0]}>
        <cylinderGeometry args={[0.24, 0.24, 0.05, 20]} />
        <meshStandardMaterial color={gold} roughness={0.35} metalness={0.5} />
      </mesh>
      <mesh position={[0, wallHeight + 1.01, 0]}>
        <cylinderGeometry args={[0.11, 0.11, 0.07, 16]} />
        <meshBasicMaterial color="#fff0b0" />
      </mesh>
      {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => {
        const a = (k * Math.PI) / 4;
        return (
          <mesh key={k} position={[Math.cos(a) * 0.33, wallHeight + 1.0, Math.sin(a) * 0.33]} rotation={[0, -a, -Math.PI / 2]}>
            <coneGeometry args={[0.05, 0.16, 4]} />
            <meshStandardMaterial color={gold} roughness={0.35} metalness={0.5} />
          </mesh>
        );
      })}
    </group>
  );
}

/* ── Moon Garden ──────────────────────────────────────────────────── */

const DARK_STONE = ['#555e72', '#4a5266', '#616a7e', '#3f4658'];

/**
 * The Moon Garden's wall, season 2 of the pass: a low wall of dark
 * stone slabs with moss on it, a paper lantern on a post every few
 * steps, bamboo leaning out over the edge, and moonflowers open along
 * the top. The lanterns are unlit material with a halo, so they are
 * lights under the night rig.
 */
function LanternWall() {
  const { slabs, moss, posts, lanterns, caps, halos, stalks, flowers } = useMemo(() => {
    const slabs: Inst[] = [];
    const moss: Inst[] = [];
    const posts: Inst[] = [];
    const lanterns: Inst[] = [];
    const caps: Inst[] = [];
    const halos: Inst[] = [];
    const stalks: Inst[] = [];
    const flowers: Inst[] = [];
    for (const run of RUNS) {
      for (const s of spots(run, 0.3, 0.02)) {
        slabs.push({
          p: [s.x, wallHeight + 0.07, s.z],
          r: [0, run.yaw, 0],
          s: [0.28, 0.14, 0.46],
          c: DARK_STONE[Math.floor(h1(s.seed) * DARK_STONE.length)],
        });
        if (s.k % 2) {
          slabs.push({
            p: [s.x + run.tx * 0.15, wallHeight + 0.2, s.z + run.tz * 0.15],
            r: [0, run.yaw, 0],
            s: [0.28, 0.12, 0.38],
            c: DARK_STONE[Math.floor(h1(s.seed + 1) * DARK_STONE.length)],
          });
        }
        if (h1(s.seed + 3) < 0.4) {
          const off = (h1(s.seed + 4) - 0.5) * 0.2;
          moss.push({
            p: [s.x + run.nx * off, wallHeight + 0.27, s.z + run.nz * off],
            s: [0.09, 0.03, 0.08],
            c: h1(s.seed + 5) > 0.5 ? '#3f6a4a' : '#4f7a55',
          });
        }
      }
      for (const s of spots(run, 1.3, 0.5)) {
        posts.push({ p: [s.x, wallHeight + 0.5, s.z], s: [0.03, 0.5, 0.03], c: '#3a2f2a' });
        lanterns.push({ p: [s.x, wallHeight + 0.82, s.z], s: [0.1, 0.2, 0.1], c: '#ffe9b0' });
        // A small knob on top, not a full cap: from this camera a cap the
        // width of the lantern hid the light and left a black dot.
        caps.push({ p: [s.x, wallHeight + 0.94, s.z], s: [0.04, 0.03, 0.04], c: '#3a2f2a' });
        caps.push({ p: [s.x, wallHeight + 0.71, s.z], s: [0.11, 0.02, 0.11], c: '#3a2f2a' });
        halos.push({ p: [s.x, wallHeight + 0.86, s.z], r: [-Math.PI / 2, 0, 0], s: 0.8, c: '#ffd27a' });
      }
      for (const s of spots(run, 0.85, 0.2)) {
        const lean = 0.3 + h1(s.seed) * 0.25;
        const yaw = Math.atan2(run.nx, run.nz) + (h1(s.seed + 1) - 0.5) * 0.6;
        stalks.push({
          p: [s.x + run.nx * 0.2, wallHeight + 0.5, s.z + run.nz * 0.2],
          r: [lean, yaw, 0],
          s: [0.025, 1.0, 0.025],
          c: h1(s.seed + 2) > 0.5 ? '#7f9a5a' : '#95ad66',
        });
      }
      for (const s of spots(run, 0.5, 0.1)) {
        if (h1(s.seed + 9) < 0.5) continue;
        const off = (h1(s.seed + 7) - 0.5) * 0.3;
        flowers.push({
          p: [s.x + run.nx * off, wallHeight + 0.3, s.z + run.nz * off],
          s: 0.035,
          c: h1(s.seed + 8) > 0.3 ? '#f4f4ff' : '#ffe9b0',
        });
      }
    }
    return { slabs, moss, posts, lanterns, caps, halos, stalks, flowers };
  }, []);
  const glow = glowTexture();
  return (
    <group>
      <Instanced items={slabs}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ffffff" roughness={0.95} />
      </Instanced>
      <Instanced items={moss}>
        <sphereGeometry args={[1, 7, 5]} />
        <meshStandardMaterial color="#ffffff" roughness={1} />
      </Instanced>
      <Instanced items={posts}>
        <cylinderGeometry args={[1, 1, 1, 6]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      </Instanced>
      <Instanced items={lanterns}>
        <cylinderGeometry args={[1, 1, 1, 10]} />
        <meshBasicMaterial color="#ffffff" />
      </Instanced>
      <Instanced items={caps}>
        <cylinderGeometry args={[1, 1, 1, 10]} />
        <meshStandardMaterial color="#ffffff" roughness={0.8} />
      </Instanced>
      <Instanced items={stalks}>
        <cylinderGeometry args={[0.7, 1, 1, 5]} />
        <meshStandardMaterial color="#ffffff" roughness={0.8} />
      </Instanced>
      <Instanced items={flowers}>
        <sphereGeometry args={[1, 7, 5]} />
        <meshBasicMaterial color="#ffffff" />
      </Instanced>
      <Instanced items={halos} renderOrder={2}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#ffffff" map={glow} transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} />
      </Instanced>
    </group>
  );
}

/** A corner of the Moon Garden: a big stone lantern, lit, on the wall. */
function GardenCorner({ theme }: { theme: ArenaTheme }) {
  const glow = theme.tower.roof;
  const stone = '#8a93a8';
  return (
    <group position={[0, wallHeight, 0]}>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.3, 0.34, 0.24, 8]} />
        <meshStandardMaterial color={stone} roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.1, 0.13, 0.55, 8]} />
        <meshStandardMaterial color={stone} roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.95, 0]}>
        <boxGeometry args={[0.42, 0.34, 0.42]} />
        <meshStandardMaterial color="#6c758c" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.95, 0]}>
        <boxGeometry args={[0.44, 0.22, 0.3]} />
        <meshBasicMaterial color={glow} />
      </mesh>
      <mesh position={[0, 0.95, 0]}>
        <boxGeometry args={[0.3, 0.22, 0.44]} />
        <meshBasicMaterial color={glow} />
      </mesh>
      <mesh position={[0, 1.23, 0]}>
        <coneGeometry args={[0.4, 0.22, 4]} />
        <meshStandardMaterial color={stone} roughness={0.95} />
      </mesh>
      {/* A lit finial, so the lantern reads as lit from above, where the roof hides its window. */}
      <mesh position={[0, 1.4, 0]}>
        <sphereGeometry args={[0.08, 8, 6]} />
        <meshBasicMaterial color={glow} />
      </mesh>
      <mesh position={[0, 0.96, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.4, 1.4]} />
        <meshBasicMaterial color={glow} map={glowTexture()} transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

/* ── what ThemedArena asks for ────────────────────────────────────── */

/** The wall of a store board, or null for any other structure. */
export function StoreCrest({ theme }: { theme: ArenaTheme }) {
  switch (theme.structure) {
    case 'driftwood': return <BeachWall />;
    case 'gingerbread': return <CandyWall theme={theme} />;
    case 'mossStone': return <GladeWall />;
    case 'shipHull': return <CoveWall theme={theme} />;
    case 'picket': return <FarmWall theme={theme} />;
    case 'coralRim': return <ReefWall />;
    case 'parapet': return <CityWall theme={theme} />;
    case 'blocks': return <ToyWall />;
    case 'fernRock': return <DinoWall />;
    // Season 2 of the pass, Sun & Moon (21 Oct 2026).
    case 'sunstone': return <TempleWall />;
    case 'lanternWall': return <LanternWall />;
    default: return null;
  }
}

/** One corner piece of a store board, drawn at the origin. */
export function StoreCorner({ theme }: { theme: ArenaTheme }) {
  switch (theme.structure) {
    case 'driftwood': return <BeachCorner theme={theme} />;
    case 'gingerbread': return <CandyCorner theme={theme} />;
    case 'mossStone': return <GladeCorner theme={theme} />;
    case 'shipHull': return <CoveCorner theme={theme} />;
    case 'picket': return <FarmCorner theme={theme} />;
    case 'coralRim': return <ReefCorner theme={theme} />;
    case 'parapet': return <CityCorner />;
    case 'blocks': return <ToyCorner theme={theme} />;
    case 'fernRock': return <DinoCorner theme={theme} />;
    case 'sunstone': return <TempleCorner theme={theme} />;
    case 'lanternWall': return <GardenCorner theme={theme} />;
    default: return null;
  }
}

/**
 * What lies around a store board beyond its own ground: the sea at the
 * beach and round the ship, the reef's drop-off and its moving light,
 * the glade's fireflies. Flat or small, and never behind the jail in a
 * way that rises — see the horizon-blob note in ThemedArena.tsx.
 */
export function StoreBackdrop({ theme }: { theme: ArenaTheme }) {
  switch (theme.structure) {
    case 'driftwood': return <BeachBackdrop />;
    case 'mossStone': return <Fireflies />;
    case 'shipHull': return <CoveBackdrop />;
    case 'coralRim': return <ReefBackdrop />;
    // The Moon Garden's fireflies: silver and lantern-gold, not the glade's spores.
    case 'lanternWall': return <Fireflies colors={['#dfe8ff', '#ffe9b0']} />;
    default: return null;
  }
}
