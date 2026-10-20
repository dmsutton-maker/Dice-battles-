import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { TUNING } from '../game/tuning';
import { cachedTexture } from './textureCache';
import type { ArenaStructure, ArenaTheme } from './themeData';
import type { RimSpot } from './rim';
import { BeachLife, CityHelicopters, CoveShark, FarmAnimals, ReefFish, ToyTrain } from './boardLife';
import { DesertCamels } from './desertLife';
import { MoonAliens } from './moonLife';
import { LavaRiver } from './volcanoLife';
import { SnowLife } from './snowLife';
import { DinoLife } from './dinoLife';

/**
 * The walls, corners and surroundings of eight battlefields: Snowy
 * Hollow, Desert Dunes, Volcano Rim, Autumn Woods, Frozen Lights, Crystal
 * Cavern, Sky Kingdom and Moon Base.
 *
 * The request, 18 Oct 2026: "make sure each board looks totally different
 * don't just make different color castles." The rule that came out of it
 * (docs/board-redesign.md) is that with the colour turned off you can
 * still tell which board it is. Under this camera, which looks almost
 * straight down, that means the SILHOUETTE of the wall top — what you see
 * of a wall from above is its crest — and the relief of the floor.
 *
 * So each board here owns a different shape language for its wall:
 *
 *   Snowy Hollow    a rounded snowbank with a slatted snow-fence in it
 *   Desert Dunes    a round-topped adobe parapet, beam ends through it
 *   Volcano Rim     clustered hexagonal basalt columns, embers between
 *   Autumn Woods    a zigzag split-rail fence, leaves fallen on the wall
 *   Frozen Lights   stacked ice blocks in running bond, lit on top
 *   Crystal Cavern  rows of dripstone, crystal clusters among them
 *   Sky Kingdom     a gold balustrade standing on cloud
 *   Moon Base       a rubble berm with habitat modules lying on it
 *
 * Two of these used to borrow another board's building outright —
 * Frozen Lights wore the Space Station's panelling and Sky Kingdom the
 * castle's merlons — which is the exact fault the request names.
 *
 * Everything that repeats round a wall is ONE instanced mesh, not a mesh
 * per piece. A crest is fifty to three hundred pieces and sixteen arenas
 * multiply everything; as separate meshes that was a draw call and a
 * geometry each. Here it is one of each per kind of piece.
 *
 * Nothing in this file touches the tray the dice bounce in. It is all
 * decoration standing on the wall top, at the corners or outside.
 */

const { innerWidth, innerDepth, wallHeight, wallThickness } = TUNING.tray;
const TOP = wallHeight;
/** The wall's centreline, where the rim ring runs. */
const EX = innerWidth / 2 + wallThickness / 2;
const EZ = innerDepth / 2 + wallThickness / 2;

/* ── shared machinery ─────────────────────────────────────────────── */

type V3 = [number, number, number];

/** One copy of a repeated piece. */
export interface Piece {
  p: V3;
  r?: V3;
  s?: V3;
  c?: string;
}

const SCRATCH = new THREE.Object3D();
const SCRATCH_COLOUR = new THREE.Color();

/** Fill an instanced mesh from a list of pieces. */
function place(mesh: THREE.InstancedMesh, items: Piece[]): void {
  items.forEach((it, i) => {
    SCRATCH.position.set(it.p[0], it.p[1], it.p[2]);
    if (it.r) SCRATCH.rotation.set(it.r[0], it.r[1], it.r[2]);
    else SCRATCH.rotation.set(0, 0, 0);
    if (it.s) SCRATCH.scale.set(it.s[0], it.s[1], it.s[2]);
    else SCRATCH.scale.set(1, 1, 1);
    SCRATCH.updateMatrix();
    mesh.setMatrixAt(i, SCRATCH.matrix);
    // Always set, so no instance is left at the attribute's default.
    mesh.setColorAt(i, SCRATCH_COLOUR.set(it.c ?? '#ffffff'));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
}

/**
 * Many copies of one piece, in one draw call.
 *
 * The children are the geometry and material, written as JSX so react
 * three fiber disposes them when the arena goes. The material's own
 * colour is left white: each copy's colour comes from its Piece.
 */
function Instances({
  items,
  children,
  live,
  roams = false,
}: {
  items: Piece[];
  children: React.ReactNode;
  /** Called before every draw, for the few crests that breathe. */
  live?: (mesh: THREE.InstancedMesh, t: number) => void;
  /** Pieces that move after placing: their bounds cannot be trusted. */
  roams?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (ref.current) place(ref.current, items);
  }, [items]);
  useLive(ref, live);
  if (items.length === 0) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} frustumCulled={!roams}>
      {children}
    </instancedMesh>
  );
}

/** Seconds, from whatever clock this runtime has. */
const now = (): number =>
  (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) / 1000;

/**
 * Idle life without useFrame.
 *
 * The scene already redraws when anything moves (and, while the board is
 * asleep, only as often as the water asks — see waterClock.tsx), so an
 * object's own onBeforeRender is called exactly as often as it is drawn
 * and costs nothing while nothing is drawn. It also keeps this file free
 * of the native fiber entry, which the arena preview cannot load. Every
 * callback here only writes numbers into objects that already exist —
 * nothing is allocated per frame.
 */
function useLive<T extends THREE.Object3D>(
  ref: React.RefObject<T | null>,
  live?: (obj: T, t: number) => void,
): void {
  useLayoutEffect(() => {
    const obj = ref.current;
    if (!obj || !live) return;
    obj.onBeforeRender = () => live(obj, now());
    return () => {
      obj.onBeforeRender = () => {};
    };
  }, [ref, live]);
}

/** A repeatable 0..1 jitter for piece `i`, channel `k`. Never random. */
const jit = (i: number, k: number): number => {
  const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * A seed for a rim spot that is the same for its mirror image across the
 * board's long axis.
 *
 * Jitter keyed on the spot's index is different on the left wall and the
 * right, and on Volcano Rim that was enough for the audit to read the two
 * long walls as differently dressed (176 against 119) — taller columns
 * and more embers had simply landed on one side. Keyed on |x| and z, the
 * two sides are mirror images, which is what a tray's two walls are.
 */
const mirrorSeed = (m: RimSpot): number =>
  // Offset so it is never negative: it indexes palettes with %.
  Math.round(Math.abs(m.pos[0]) * 100) * 7 + (Math.round(m.pos[2] * 100) + 1000) * 13;

/** Which way is OUT of the tray from a rim spot. */
const outOf = (m: RimSpot): [number, number] =>
  m.alongX ? [0, Math.sign(m.pos[2])] : [Math.sign(m.pos[0]), 0];

/**
 * Where prisoners stand on the wall top in Skirmish and War — the middle
 * of the jail-side wall (stations.ts WALL_SLOTS, |x| up to 1.85 plus a
 * figure's radius). Anything taller than a figure's feet there stands in
 * a figure, so every crest keeps low across that stretch.
 */
const onFigureRow = (x: number, z: number): boolean => z < -EZ + 0.3 && Math.abs(x) < 2.25;

/** The four wall centrelines, walked in the rim ring's order. */
interface Wall {
  from: [number, number];
  to: [number, number];
  out: [number, number];
  /** The jail-side wall, where prisoners stand. */
  jail: boolean;
}

const WALLS: Wall[] = [
  { from: [-EX, -EZ], to: [-EX, EZ], out: [-1, 0], jail: false },
  { from: [-EX, EZ], to: [EX, EZ], out: [0, 1], jail: false },
  { from: [EX, EZ], to: [EX, -EZ], out: [1, 0], jail: false },
  { from: [EX, -EZ], to: [-EX, -EZ], out: [0, -1], jail: true },
];

/** Walk a wall at roughly `pitch`, ends included. */
function walk(w: Wall, pitch: number, at: (x: number, z: number, k: number, n: number) => void): void {
  const dx = w.to[0] - w.from[0];
  const dz = w.to[1] - w.from[1];
  const n = Math.max(1, Math.round(Math.hypot(dx, dz) / pitch));
  for (let k = 0; k <= n; k++) at(w.from[0] + (dx * k) / n, w.from[1] + (dz * k) / n, k, n);
}

const alongX = (w: Wall) => w.out[0] === 0;
const wallLength = (w: Wall) => Math.hypot(w.to[0] - w.from[0], w.to[1] - w.from[1]);

export interface CrestProps {
  theme: ArenaTheme;
  rim: RimSpot[];
}

export interface CornerProps {
  theme: ArenaTheme;
  wallMaterial: THREE.Material;
}

/* ── Snowy Hollow ─────────────────────────────────────────────────── */

const SNOW = ['#f7fafc', '#eef4fa', '#ffffff'];

/** Snowy Hollow's crest as data, by kind of piece (see CREST_PIECES). */
function snowPieces(theme: ArenaTheme, rim: RimSpot[]) {
  const cap = theme.wall.cap;
  const bank: Piece[] = [];
  rim.forEach((m, i) => {
    const s = 0.85 + jit(i, 1) * 0.35;
    for (const side of [-1, 1]) {
      const [ox, oz] = outOf(m);
      // Either side of the fence line, slightly overhanging the wall.
      const off = side * 0.15;
      bank.push({
        p: [m.pos[0] + ox * off, TOP + 0.02, m.pos[2] + oz * off],
        s: m.alongX ? [1.3 * s, 0.4 * s, 0.6] : [0.6, 0.4 * s, 1.3 * s],
        c: SNOW[(i + (side > 0 ? 1 : 0)) % 3],
      });
    }
  });
  const laths: Piece[] = [];
  const posts: Piece[] = [];
  const caps: Piece[] = [];
  const wires: Piece[] = [];
  const wood = [cap, '#6b4a30', '#8a6748'];
  for (const w of WALLS) {
    const ax = alongX(w);
    const height = (x: number, z: number) => (onFigureRow(x, z) ? 0.26 : 0.56);
    walk(w, 0.16, (x, z, k) => {
      const h = height(x, z) * (0.92 + jit(k + w.out[0] * 7, 3) * 0.16);
      laths.push({
        p: [x, TOP + h / 2 - 0.02, z],
        // Leaning a little away from the board, the way the wind
        // leaves a snow-fence.
        r: ax ? [w.out[1] * 0.07, 0, 0] : [0, 0, -w.out[0] * 0.07],
        s: ax ? [0.085, h, 0.05] : [0.05, h, 0.085],
        c: wood[k % 3],
      });
    });
    walk(w, 1.3, (x, z) => {
      const h = height(x, z) + 0.1;
      posts.push({ p: [x, TOP + h / 2 - 0.02, z], s: [0.13, h, 0.13], c: '#5a3d26' });
      caps.push({ p: [x, TOP + h + 0.02, z], s: [1.5, 0.7, 1.5], c: '#ffffff' });
    });
    const len = wallLength(w);
    const mid: [number, number] = [(w.from[0] + w.to[0]) / 2, (w.from[1] + w.to[1]) / 2];
    for (const y of w.jail ? [0.1, 0.2] : [0.14, 0.44]) {
      wires.push({
        p: [mid[0], TOP + y, mid[1]],
        s: ax ? [len, 0.022, 0.035] : [0.035, 0.022, len],
        c: '#4a3424',
      });
    }
  }
  // The drift banked against the INSIDE foot of every wall (the 31 Aug
  // 2026 review: white walls on a white floor dissolved into one shape
  // without it). Walked through the rim ring so it goes all the way round.
  const drift: Piece[] = rim.map((m, i) => {
    const s = 0.8 + ((i * 29) % 5) / 12;
    const px = m.alongX ? m.pos[0] : Math.sign(m.pos[0]) * (innerWidth / 2);
    const pz = m.alongX ? Math.sign(m.pos[2]) * (innerDepth / 2) : m.pos[2];
    return {
      p: [px, 0.02, pz],
      s: m.alongX ? [1.15 * s, 0.3 * s, 0.42] : [0.42, 0.3 * s, 1.15 * s],
      c: '#f4f9fd',
    };
  });
  return { bank, laths, posts, caps, wires, drift };
}

/**
 * A snowbank along the wall top with a slatted wooden snow-fence standing
 * in it — the fence that stops drifts crossing a road.
 *
 * The fence runs down the MIDDLE of the bank, not along its outer edge.
 * From above, a white bank is one white band, and the 27 Aug 2026 audit
 * (tools/arena-preview/audit.js) measures the middle of the wall: a fence
 * at the edge would leave that line reading as a bare kerb, which is the
 * exact fault the Snowy Woods once shipped with. Laths sixteen to the
 * metre put a dark–light rhythm right down it instead, and snow piled
 * either side of a fence is what a snow-fence is for.
 */
export function SnowCrest({ theme, rim }: CrestProps) {
  const kit = useMemo(() => snowPieces(theme, rim), [theme, rim]);

  return (
    <group>
      <Instances items={kit.bank}>
        <sphereGeometry args={[0.34, 10, 7]} />
        <meshStandardMaterial roughness={0.85} />
      </Instances>
      <Instances items={kit.drift}>
        <sphereGeometry args={[0.34, 10, 7]} />
        <meshStandardMaterial roughness={0.85} />
      </Instances>
      <Instances items={kit.laths}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.95} />
      </Instances>
      <Instances items={kit.posts}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.95} />
      </Instances>
      <Instances items={kit.caps}>
        <sphereGeometry args={[0.09, 8, 6]} />
        <meshStandardMaterial roughness={0.8} />
      </Instances>
      <Instances items={kit.wires}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.9} />
      </Instances>
    </group>
  );
}

/** A drift heaped in the corner, a striped marker pole stuck in it. */
export function SnowCorner({ theme }: CornerProps) {
  const band = theme.tower.roof;
  return (
    <>
      <mesh position={[0, TOP - 0.15, 0]} scale={[1, 0.95, 1]}>
        <sphereGeometry args={[0.62, 12, 9]} />
        <meshStandardMaterial color="#f7fafc" roughness={0.85} />
      </mesh>
      <mesh position={[0.22, TOP + 0.38, -0.12]} scale={[1, 0.7, 1]}>
        <sphereGeometry args={[0.36, 10, 8]} />
        <meshStandardMaterial color="#eaf2f9" roughness={0.85} />
      </mesh>
      <mesh position={[-0.12, TOP + 0.95, 0.1]} rotation={[0.08, 0, 0.1]}>
        <cylinderGeometry args={[0.05, 0.05, 1.5, 8]} />
        <meshStandardMaterial color="#f2f2ee" roughness={0.6} />
      </mesh>
      {[0.35, 0.75, 1.15].map((y) => (
        <mesh key={y} position={[-0.12 - y * 0.1 + 0.075, TOP + 0.2 + y, 0.1 + y * 0.08 - 0.06]} rotation={[0.08, 0, 0.1]}>
          <cylinderGeometry args={[0.056, 0.056, 0.2, 8]} />
          <meshStandardMaterial color={band} roughness={0.6} />
        </mesh>
      ))}
    </>
  );
}

/* ── Desert Dunes ─────────────────────────────────────────────────── */

/** Desert Dunes's crest as data, by kind of piece (see CREST_PIECES). */
function adobePieces(theme: ArenaTheme, rim: RimSpot[]) {
  const body = theme.wall.color;
  const cap = theme.wall.cap;
  const coping: Piece[] = [];
  for (const w of WALLS) {
    const ax = alongX(w);
    const len = wallLength(w) + wallThickness * 0.8;
    const mx = (w.from[0] + w.to[0]) / 2;
    const mz = (w.from[1] + w.to[1]) / 2;
    coping.push({ p: [mx, TOP + 0.07, mz], s: ax ? [len, 0.14, 0.46] : [0.46, 0.14, len], c: cap });
  }
  /*
    The rounded top: a squashed cylinder laid along the wall, so its
    upper half is the smoothed crown of the parapet. One length per
    spot, in alternating tones, not one per wall — mud walls are laid in
    sections, and across the jail end, where the merlons step down for
    the prisoners, a single smooth roll left the audit nothing to count
    (it read that wall as bare: contrast 0).
  */
  const roll: Piece[] = rim.map((m, i) => ({
    p: [m.pos[0], TOP + 0.14, m.pos[2]],
    r: m.alongX ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0],
    // Squashed in whichever local axis the rotation stood upright.
    s: m.alongX ? [0.11, 0.58, 0.2] : [0.2, 0.58, 0.11],
    c: i % 2 === 0 ? body : '#b98450',
  }));
  const merlons: Piece[] = [];
  const crowns: Piece[] = [];
  const vigas: Piece[] = [];
  rim.forEach((m, i) => {
    const [ox, oz] = outOf(m);
    // Beam ends, through the wall and out the other side.
    vigas.push({
      p: [m.pos[0], TOP - 0.2, m.pos[2]],
      r: m.alongX ? [Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2],
      s: [1, 1, 1],
      c: i % 4 === 0 ? '#4a2f1a' : '#5e3d22',
    });
    if (i % 2 === 1 || onFigureRow(m.pos[0], m.pos[2])) return;
    const h = 0.2 + jit(i, 2) * 0.08;
    merlons.push({
      p: [m.pos[0] - ox * 0.02, TOP + 0.14 + h / 2, m.pos[2] - oz * 0.02],
      s: m.alongX ? [0.34, h, 0.36] : [0.36, h, 0.34],
      c: i % 4 === 0 ? body : cap,
    });
    crowns.push({
      p: [m.pos[0] - ox * 0.02, TOP + 0.14 + h, m.pos[2] - oz * 0.02],
      // Axis ACROSS the wall, so the merlon's top is rounded as you
      // walk along the wall.
      r: m.alongX ? [Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2],
      s: m.alongX ? [0.17, 0.36, 0.136] : [0.136, 0.36, 0.17],
      c: i % 4 === 0 ? body : cap,
    });
  });
  return { coping, roll, merlons, crowns, vigas };
}

/**
 * A pueblo parapet: the wall top rounded over like hand-smoothed mud,
 * rounded merlons on every other spot, and the ends of the roof beams —
 * vigas — poking through both faces of the wall below the coping. From
 * above that is a soft band with a comb of dark dots down each side of
 * it, which no other wall in the set has.
 */
export function AdobeCrest({ theme, rim }: CrestProps) {
  const kit = useMemo(() => adobePieces(theme, rim), [theme, rim]);

  return (
    <group>
      <Instances items={kit.coping}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={1} />
      </Instances>
      <Instances items={[...kit.roll, ...kit.crowns]}>
        <cylinderGeometry args={[1, 1, 1, 12]} />
        <meshStandardMaterial roughness={1} />
      </Instances>
      <Instances items={kit.merlons}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={1} />
      </Instances>
      <Instances items={kit.vigas}>
        <cylinderGeometry args={[0.055, 0.06, wallThickness + 0.24, 6]} />
        <meshStandardMaterial roughness={0.95} />
      </Instances>
    </group>
  );
}

/** A round adobe tower with a domed roof, beams through its waist. */
export function AdobeCorner({ theme, wallMaterial }: CornerProps) {
  return (
    <>
      <mesh material={wallMaterial} position={[0, (TOP + 0.5) / 2, 0]}>
        <cylinderGeometry args={[0.5, 0.58, TOP + 0.5, 14]} />
      </mesh>
      <mesh position={[0, TOP + 0.5, 0]} scale={[1, 0.8, 1]}>
        <sphereGeometry args={[0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={theme.tower.roof} roughness={1} />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((k) => {
        const a = (k * Math.PI) / 3 + 0.3;
        return (
          <mesh
            key={k}
            position={[Math.cos(a) * 0.56, TOP + 0.2, Math.sin(a) * 0.56]}
            rotation={[0, -a, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.05, 0.05, 0.22, 6]} />
            <meshStandardMaterial color="#5e3d22" roughness={0.95} />
          </mesh>
        );
      })}
    </>
  );
}

/* ── Volcano Rim ──────────────────────────────────────────────────── */

const LAVA = '#ff7a2a';

/** Volcano Rim's crest as data, by kind of piece (see CREST_PIECES). */
function basaltPieces(theme: ArenaTheme, rim: RimSpot[]) {
  const body = theme.wall.color;
  const columns: Piece[] = [];
  const embers: Piece[] = [];
  // Paler than the wall: under the volcano's red night rig the wall's
  // own greys went black, and black hexagons on a black wall are not
  // columns, they are holes.
  const tones = [body, '#6e6266', '#7c7073', '#55494c'];
  const SLOTS: [number, number][] = [[-0.12, -0.18], [0.12, 0.0], [-0.09, 0.19]];
  rim.forEach((m) => {
    const low = onFigureRow(m.pos[0], m.pos[2]);
    for (let b = 0; b < 3; b++) {
      const k = mirrorSeed(m) * 3 + b;
      const [ox, oz] = outOf(m);
      const across = SLOTS[b][0] + (jit(k, 5) - 0.5) * 0.05;
      const along = SLOTS[b][1] + (jit(k, 6) - 0.5) * 0.05;
      const x = m.pos[0] + ox * across + (m.alongX ? along : 0);
      const z = m.pos[2] + oz * across + (m.alongX ? 0 : along);
      const h = low ? 0.12 + jit(k, 7) * 0.1 : 0.18 + jit(k, 7) * 0.62;
      const r = 0.13 + jit(k, 8) * 0.05;
      columns.push({ p: [x, TOP + h / 2 - 0.04, z], r: [0, jit(k, 9) * 1.05, 0], s: [r, h, r], c: tones[k % 4] });
      if (k % 7 === 0) {
        embers.push({ p: [x, TOP + h - 0.03, z], r: [0, jit(k, 9) * 1.05, 0], s: [r * 0.7, 0.03, r * 0.7], c: '#ffffff' });
      }
    }
  });
  const seams: Piece[] = [];
  for (const w of WALLS) {
    const len = wallLength(w);
    const mx = (w.from[0] + w.to[0]) / 2;
    const mz = (w.from[1] + w.to[1]) / 2;
    seams.push({ p: [mx, TOP + 0.03, mz], s: alongX(w) ? [len, 0.05, 0.3] : [0.3, 0.05, len], c: '#c8461c' });
  }
  return { columns, embers, seams };
}

/**
 * Basalt columns, clustered two to a spot and stepped in height, with
 * embers glowing in the joints between them.
 *
 * The old crest was one hexagonal stump per spot on top of a smooth wall
 * — from above, a row of beads. Columnar basalt is a CROWD of columns
 * shouldering each other at different heights, and that ragged stepped
 * top is the silhouette. A few column tops are still hot.
 */
export function BasaltCrest({ theme, rim }: CrestProps) {
  const kit = useMemo(() => basaltPieces(theme, rim), [theme, rim]);

  return (
    <group>
      {/* The embers in the joints: unlit, so they burn at night. */}
      <Instances items={kit.seams}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial />
      </Instances>
      <Instances items={kit.columns}>
        <cylinderGeometry args={[1, 1.04, 1, 6]} />
        <meshStandardMaterial roughness={0.9} flatShading />
      </Instances>
      <Instances items={kit.embers} live={EMBER_BREATH}>
        <cylinderGeometry args={[1, 1, 1, 6]} />
        <meshStandardMaterial color={LAVA} emissive={LAVA} emissiveIntensity={0.85} roughness={0.6} />
      </Instances>
    </group>
  );
}

/**
 * A small volcano at each corner: a cone of basalt with a glowing crater,
 * smoke rising out of it. The obsidian spire it replaces was a cone too,
 * but a cone pointing UP is a spike; a cone with its top knocked off and
 * lit from inside is a volcano.
 */
export function BasaltCorner({ theme, wallMaterial }: CornerProps) {
  return (
    <>
      <mesh material={wallMaterial} position={[0, (TOP + 0.75) / 2, 0]}>
        <cylinderGeometry args={[0.24, 0.66, TOP + 0.75, 8]} />
      </mesh>
      <Live live={CRATER_BREATH}>
        <mesh position={[0, TOP + 0.76, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.2, 10]} />
          <meshStandardMaterial color={theme.tower.roof} emissive={theme.tower.roof} emissiveIntensity={1} />
        </mesh>
      </Live>
      {/* Lava running down one flank. */}
      <mesh position={[0.2, TOP + 0.25, 0.2]} rotation={[0.42, Math.PI / 4, 0]}>
        <boxGeometry args={[0.07, 0.9, 0.03]} />
        <meshBasicMaterial color={LAVA} />
      </mesh>
      <Smoke phase={0} />
      <Smoke phase={0.5} />
    </>
  );
}

/** A puff rising from a crater, swelling and fading, over and over. */
function Smoke({ phase }: { phase: number }) {
  const live = useMemo(
    () => (mesh: THREE.Mesh, t: number) => {
      const k = (t * 0.22 + phase) % 1;
      mesh.position.set(0.05 * k, TOP + 0.95 + k * 1.1, -0.08 * k);
      mesh.scale.setScalar(0.5 + k * 0.9);
      (mesh.material as THREE.MeshStandardMaterial).opacity = 0.55 * (1 - k) * Math.min(1, k * 6);
    },
    [phase],
  );
  const ref = useRef<THREE.Mesh>(null);
  useLive(ref, live);
  return (
    <mesh ref={ref} position={[0, TOP + 1, 0]}>
      <sphereGeometry args={[0.2, 8, 6]} />
      <meshStandardMaterial color="#8a7a7a" roughness={1} transparent opacity={0.4} depthWrite={false} />
    </mesh>
  );
}

/* ── Autumn Woods ─────────────────────────────────────────────────── */

const LEAF_TONES = ['#c0502a', '#d68a2e', '#a83828', '#e2aa46', '#965c2e'];

/** Autumn Woods's crest as data, by kind of piece (see CREST_PIECES). */
function logPieces(theme: ArenaTheme, rim: RimSpot[]) {
  // Weathered grey-brown, paler than the wall under it, so the zigzag
  // stands out against the dark band it rests on.
  const cap = theme.wall.cap;
  const rails: Piece[] = [];
  const leaves: Piece[] = [];
  for (const w of WALLS) {
    const pts: [number, number][] = [];
    walk(w, 0.6, (x, z, k) => {
      const zig = (k % 2 === 0 ? 1 : -1) * 0.15;
      pts.push([x + w.out[0] * zig, z + w.out[1] * zig]);
    });
    for (let s = 0; s + 1 < pts.length; s++) {
      const [x0, z0] = pts[s];
      const [x1, z1] = pts[s + 1];
      const dx = x1 - x0;
      const dz = z1 - z0;
      const len = Math.hypot(dx, dz) + 0.16;
      const mx = (x0 + x1) / 2;
      const mz = (z0 + z1) / 2;
      const courses = onFigureRow(mx, mz) ? 2 : 3;
      for (let c = 0; c < courses; c++) {
        // Alternate segments sit half a rail higher, so the rails cross
        // over each other at the zig corners the way a worm fence does.
        const y = TOP + 0.07 + c * 0.1 + (s % 2) * 0.05;
        rails.push({
          p: [mx, y, mz],
          r: [0, Math.atan2(dz, -dx), Math.PI / 2],
          s: [0.065, len, 0.065],
          c: (s + c) % 3 === 0 ? '#a08a6c' : (s + c) % 3 === 1 ? cap : '#b49c7a',
        });
      }
    }
    // Leaves lying on the wall top under the rails.
    walk(w, 0.23, (x, z, k) => {
      const i = k + Math.round(w.from[0] * 13 + w.from[1] * 7);
      if (jit(i, 4) < 0.35) return;
      const a = (jit(i, 5) - 0.5) * 0.36;
      leaves.push({
        p: [x + w.out[0] * a, TOP + 0.006, z + w.out[1] * a],
        r: [-Math.PI / 2, 0, jit(i, 6) * 6.28],
        s: [1.5, 1, 1],
        c: LEAF_TONES[Math.floor(jit(i, 7) * LEAF_TONES.length)],
      });
    });
  }
  return { rails, leaves };
}

/**
 * A zigzag split-rail fence — the "worm" fence of old farm woodland —
 * with leaves fallen on the wall top under it.
 *
 * It replaces cordwood laid along the wall, which from above was a plain
 * brown band with a seam down it. A worm fence needs no posts because the
 * rails zigzag and rest on each other at the corners; from above that is
 * a zigzag running round the whole tray, and nothing else in the set is
 * a zigzag. The rails are three-sided because split rails are.
 */
export function LogCrest({ theme, rim }: CrestProps) {
  const kit = useMemo(() => logPieces(theme, rim), [theme, rim]);

  return (
    <group>
      <Instances items={kit.leaves}>
        <circleGeometry args={[0.07, 6]} />
        <meshStandardMaterial roughness={0.95} side={THREE.DoubleSide} />
      </Instances>
      <Instances items={kit.rails}>
        <cylinderGeometry args={[1, 1, 1, 3]} />
        <meshStandardMaterial roughness={1} flatShading />
      </Instances>
    </group>
  );
}

/** A sawn stump at each corner, with a pumpkin left on it. */
export function LogCorner({ theme, wallMaterial }: CornerProps) {
  return (
    <>
      <mesh material={wallMaterial} position={[0, (TOP + 0.3) / 2, 0]}>
        <cylinderGeometry args={[0.52, 0.62, TOP + 0.3, 10]} />
      </mesh>
      <mesh position={[0, TOP + 0.31, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.52, 12]} />
        <meshStandardMaterial color="#c9a678" roughness={1} />
      </mesh>
      <mesh position={[0, TOP + 0.312, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.2, 0.25, 14]} />
        <meshStandardMaterial color="#a8865a" roughness={1} />
      </mesh>
      <mesh position={[0.08, TOP + 0.52, 0.06]} scale={[1, 0.74, 1]}>
        <sphereGeometry args={[0.3, 12, 8]} />
        <meshStandardMaterial color={theme.tower.roof} roughness={0.7} />
      </mesh>
      <mesh position={[0.08, TOP + 0.78, 0.06]} rotation={[0.2, 0, 0.3]}>
        <cylinderGeometry args={[0.035, 0.05, 0.14, 5]} />
        <meshStandardMaterial color="#4f6a2a" roughness={0.9} />
      </mesh>
      {/* A bracket fungus on the stump's flank. */}
      <mesh position={[-0.5, TOP - 0.1, 0.1]} scale={[1, 0.3, 1]}>
        <sphereGeometry args={[0.16, 8, 6]} />
        <meshStandardMaterial color="#d8b48a" roughness={0.9} />
      </mesh>
    </>
  );
}

/* ── Frozen Lights ────────────────────────────────────────────────── */

const ICE = ['#9fd6ea', '#86c8e0', '#b4e2f2', '#7fc0dc', '#a8dcee'];

/** Frozen Lights's crest as data, by kind of piece (see CREST_PIECES). */
function icePieces(theme: ArenaTheme, rim: RimSpot[]) {
  const blocks: Piece[] = [];
  const tops: Piece[] = [];
  for (const w of WALLS) {
    const ax = alongX(w);
    const len = wallLength(w);
    const n = Math.max(1, Math.round(len / 0.6));
    const unit = len / n;
    for (let course = 0; course < 2; course++) {
      const count = course === 0 ? n + 1 : n;
      for (let k = 0; k < count; k++) {
        // Course 0 is centred on the corners; course 1 sits over its joints.
        const t = (course === 0 ? k : k + 0.5) / n;
        const x = w.from[0] + (w.to[0] - w.from[0]) * t;
        const z = w.from[1] + (w.to[1] - w.from[1]) * t;
        if (course === 1 && onFigureRow(x, z)) continue;
        const i = k * 3 + course * 101 + Math.round(w.from[0] * 17 + w.from[1] * 5);
        // A real gap between blocks, so the joints read from above.
        const long = unit * 0.9;
        const y = TOP + 0.1 + course * 0.22;
        blocks.push({
          p: [x, y, z],
          s: ax ? [long, 0.2, 0.48 - course * 0.1] : [0.48 - course * 0.1, 0.2, long],
          c: ICE[Math.abs(i) % ICE.length],
        });
        const lit = course === 1 || onFigureRow(x, z);
        if (lit) {
          tops.push({
            p: [x, y + 0.105, z],
            // Most of the top, a frosted pale cyan: the lit face of the
            // block, with its darker sides showing round it as the bevel.
            s: ax ? [long * 0.86, 0.012, 0.3] : [0.3, 0.012, long * 0.86],
            c: '#b8e6f4',
          });
        }
      }
    }
  }
  return { blocks, tops };
}

/**
 * Stacked ice blocks, two courses in running bond, each top lit along its
 * edge.
 *
 * Frozen Lights wore the Space Station's panelled hull until October
 * 2026 — the borrowed building the redesign was asked to end. Ice blocks
 * are what a wall in a frozen place is cut from. Real translucency
 * (transmission) is a second render of the scene per frame and is not on
 * the table on a phone, so it is faked the cheap way: a cold emissive
 * tint, so the blocks glow a little from within, and a pale unlit slab on
 * each top that reads as the light catching the bevel. The glow drifts
 * slowly, like the light coming off the sky.
 */
export function IceCrest({ theme, rim }: CrestProps) {
  const kit = useMemo(() => icePieces(theme, rim), [theme, rim]);

  return (
    <group>
      <Instances items={kit.blocks} live={ICE_BREATH}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.14} metalness={0.05} emissive={theme.wall.color} emissiveIntensity={0.3} />
      </Instances>
      <Instances items={kit.tops}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial />
      </Instances>
    </group>
  );
}

/** Ice obelisks at the corners, their tips lit aurora green. */
export function IceCorner({ theme }: CornerProps) {
  const glow = theme.tower.roof;
  const prisms: [number, number, number, number, number][] = [
    // x, z, radius, height, lean
    [0, 0, 0.3, TOP + 1.1, 0],
    [0.3, 0.18, 0.2, TOP + 0.4, 0.22],
    [-0.26, 0.2, 0.17, TOP + 0.1, -0.26],
  ];
  return (
    <>
      {prisms.map(([x, z, r, h, lean], k) => (
        <group key={k} position={[x, 0, z]} rotation={[lean * 0.5, k, lean]}>
          <mesh position={[0, h / 2, 0]}>
            <cylinderGeometry args={[r * 0.9, r, h, 6]} />
            <meshStandardMaterial color="#bfe6f3" emissive="#4fb8d8" emissiveIntensity={0.3} roughness={0.12} flatShading />
          </mesh>
          <mesh position={[0, h + r * 0.55, 0]}>
            <coneGeometry args={[r * 0.9, r * 1.1, 6]} />
            <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={0.7} roughness={0.2} flatShading />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** A block of ice on the post with a light frozen inside it. */
export function IceShelter({ theme }: { theme: ArenaTheme }) {
  return (
    <>
      <mesh position={[0, 1.5, 0]} rotation={[0, 0.4, 0]}>
        <boxGeometry args={[0.52, 0.46, 0.52]} />
        <meshStandardMaterial
          color="#cdeef8"
          emissive="#4fb8d8"
          emissiveIntensity={0.25}
          roughness={0.1}
          transparent
          opacity={0.72}
        />
      </mesh>
      <mesh position={[0, 1.5, 0]}>
        <sphereGeometry args={[0.14, 10, 8]} />
        <meshBasicMaterial color={theme.retreat.canopy} />
      </mesh>
    </>
  );
}

/* ── Crystal Cavern ───────────────────────────────────────────────── */

const GEM = ['#c98aff', '#a37ae8', '#dcaeff', '#7fd4e8', '#f0d68a'];

/** Crystal Cavern's crest as data, by kind of piece (see CREST_PIECES). */
function stalagmitePieces(theme: ArenaTheme, rim: RimSpot[]) {
  const stone = theme.wall.cap;
  const flow: Piece[] = [];
  const drips: Piece[] = [];
  const crystals: Piece[] = [];
  const STONE = ['#b8aac4', '#c6b9cf', '#a898b4', stone];
  rim.forEach((m, i) => {
    const low = onFigureRow(m.pos[0], m.pos[2]);
    // The flowstone the teeth grow out of: low, and darker than they
    // are, so each stalagmite stands clear of it from above.
    flow.push({
      p: [m.pos[0], TOP + 0.01, m.pos[2]],
      s: m.alongX ? [1.75, 0.14, 0.85] : [0.85, 0.14, 1.75],
      c: i % 2 ? '#5e5272' : '#544867',
    });
    if (i % 3 === 0) {
      // Marc's cluster: prisms from one root, tallest in the middle.
      for (let b = 0; b < 3; b++) {
        const k = i * 3 + b;
        const h = (low ? 0.2 : 0.32 + jit(k, 1) * 0.3) * (b === 1 ? 1 : 0.7);
        crystals.push({
          p: [m.pos[0] + (b - 1) * 0.09, TOP + h / 2 + 0.05, m.pos[2] + (jit(k, 2) - 0.5) * 0.08],
          r: [0, jit(k, 3) * 2, (b - 1) * 0.3],
          s: [0.07, h, 0.07],
          c: GEM[(i + b) % GEM.length],
        });
      }
      return;
    }
    const count = 2 + (i % 2);
    for (let b = 0; b < count; b++) {
      const k = i * 3 + b;
      const [ox, oz] = outOf(m);
      const across = (jit(k, 4) - 0.5) * 0.24;
      const along = (b - (count - 1) / 2) * 0.17;
      const h = low ? 0.14 + jit(k, 5) * 0.08 : 0.4 + jit(k, 5) * 0.7;
      const r = 0.08 + jit(k, 6) * 0.06;
      drips.push({
        p: [
          m.pos[0] + ox * across + (m.alongX ? along : 0),
          TOP + h / 2 + 0.04,
          m.pos[2] + oz * across + (m.alongX ? 0 : along),
        ],
        s: [r, h, r],
        c: STONE[(k + 1) % STONE.length],
      });
    }
  });
  return { flow, drips, crystals };
}

/**
 * Rows of dripstone — stalagmites rising off a flowstone ridge — with a
 * crystal cluster every third spot.
 *
 * The crest was all crystal clusters (Marc picked the cluster off the
 * design canvas on 28 Aug 2026, and it still stands on every third
 * spot). The redesign's table asks for stalagmite ROWS, and the reason is
 * the silhouette: a crystal is a hard faceted point, a stalagmite is a
 * soft-shouldered cone of wet rock, and a cave reads as a cave by its
 * dripstone. Crystal alone made the wall read as a jewellery tray.
 */
export function StalagmiteCrest({ theme, rim }: CrestProps) {
  const kit = useMemo(() => stalagmitePieces(theme, rim), [theme, rim]);

  return (
    <group>
      <Instances items={kit.flow}>
        <sphereGeometry args={[0.3, 10, 6]} />
        <meshStandardMaterial roughness={0.6} />
      </Instances>
      {/* A cone with a rounded shoulder reads as dripstone; a sharp one
          reads as a tooth. Seven sides and a slightly blunt top. */}
      <Instances items={kit.drips}>
        <cylinderGeometry args={[0.12, 1, 1, 7, 2]} />
        {/* Faceted, so from above each one is a lit star of facets with a
            point at its middle — the only way a cone reads as a cone
            when it is seen from almost straight over its tip. */}
        <meshStandardMaterial roughness={0.5} flatShading />
      </Instances>
      <Instances items={kit.crystals} live={GEM_BREATH}>
        <cylinderGeometry args={[0.55, 1, 1, 6]} />
        <meshStandardMaterial roughness={0.25} emissive="#7a4ab8" emissiveIntensity={0.5} />
      </Instances>
    </group>
  );
}

/** A great stalagmite in each corner, crystal at its foot. */
export function StalagmiteCorner({ theme, wallMaterial }: CornerProps) {
  const roof = theme.tower.roof;
  return (
    <>
      <mesh material={wallMaterial} position={[0, (TOP + 1.3) / 2, 0]}>
        <cylinderGeometry args={[0.1, 0.6, TOP + 1.3, 8, 3]} />
      </mesh>
      <mesh position={[0.32, (TOP + 0.2) / 2, 0.22]}>
        <cylinderGeometry args={[0.06, 0.28, TOP + 0.2, 7]} />
        <meshStandardMaterial color={theme.wall.cap} roughness={0.55} />
      </mesh>
      {([[-0.34, 0.26, 0.7, 0.2], [-0.2, 0.42, 0.5, -0.3], [0.1, 0.48, 0.42, 0.4]] as const).map(
        ([x, z, h, tilt], k) => (
          <mesh key={k} position={[x, TOP * 0.6 + h / 2, z]} rotation={[tilt * 0.5, k, tilt]}>
            <coneGeometry args={[0.12, h, 6]} />
            <meshStandardMaterial color={roof} emissive={roof} emissiveIntensity={0.55} roughness={0.25} />
          </mesh>
        ),
      )}
    </>
  );
}

/* ── Sky Kingdom ──────────────────────────────────────────────────── */

const GOLD = '#e0b552';

/** Sky Kingdom's crest as data, by kind of piece (see CREST_PIECES). */
function skyPieces(theme: ArenaTheme, rim: RimSpot[]) {
  const puffs: Piece[] = [];
  const CLOUD = ['#ffffff', '#f2f7fd', '#e6eef8'];
  rim.forEach((m, i) => {
    const [ox, oz] = outOf(m);
    for (let b = 0; b < 2; b++) {
      const k = i * 2 + b;
      const s = 0.8 + jit(k, 1) * 0.5;
      const across = (b === 0 ? -0.16 : 0.16) + (jit(k, 2) - 0.5) * 0.08;
      const along = (b === 0 ? -0.15 : 0.15);
      puffs.push({
        p: [
          m.pos[0] + ox * across + (m.alongX ? along : 0),
          TOP + 0.04,
          m.pos[2] + oz * across + (m.alongX ? 0 : along),
        ],
        s: [s, 0.6 * s, s],
        c: CLOUD[k % 3],
      });
    }
  });
  const shafts: Piece[] = [];
  const bulbs: Piece[] = [];
  const rails: Piece[] = [];
  const pedestals: Piece[] = [];
  const finials: Piece[] = [];
  for (const w of WALLS) {
    const ax = alongX(w);
    const scaleAt = (x: number, z: number) => (onFigureRow(x, z) ? 0.6 : 1);
    walk(w, 0.21, (x, z, k, n) => {
      if (k % 4 === 0 || k === n) return;
      const s = scaleAt(x, z);
      shafts.push({ p: [x, TOP + 0.18 * s, z], s: [1, s, 1], c: GOLD });
      bulbs.push({ p: [x, TOP + 0.13 * s, z], s: [1, 1.3 * s, 1], c: GOLD });
    });
    walk(w, 0.84, (x, z) => {
      const s = scaleAt(x, z);
      pedestals.push({ p: [x, TOP + 0.2 * s, z], s: [0.12, 0.4 * s, 0.12], c: '#f6f1e2' });
      finials.push({ p: [x, TOP + 0.43 * s, z], c: GOLD });
    });
    const len = wallLength(w);
    const mx = (w.from[0] + w.to[0]) / 2;
    const mz = (w.from[1] + w.to[1]) / 2;
    // The handrail: one per wall, dropped where the figures stand.
    const h = w.jail ? 0.22 : 0.36;
    rails.push({ p: [mx, TOP + h, mz], s: ax ? [len, 0.05, 0.1] : [0.1, 0.05, len], c: GOLD });
  }
  return { puffs, shafts, bulbs, rails, pedestals, finials };
}

/**
 * A gilded balustrade standing on a bank of cloud.
 *
 * Sky Kingdom was "the one real castle" — merlons and cone roofs — until
 * October 2026, and that was the borrowed building: a castle with the
 * colours changed is precisely "different color castles". A kingdom in
 * the sky is a palace terrace, and a palace terrace is a balustrade:
 * turned gold balusters under a handrail, pedestals with finials, the
 * whole thing standing on cloud that billows over both edges of the wall.
 */
export function SkyCrest({ theme, rim }: CrestProps) {
  const kit = useMemo(() => skyPieces(theme, rim), [theme, rim]);

  return (
    <group>
      <Instances items={kit.puffs}>
        <sphereGeometry args={[0.3, 10, 7]} />
        <meshStandardMaterial roughness={1} emissive="#c9dcf0" emissiveIntensity={0.25} />
      </Instances>
      <Instances items={kit.shafts}>
        <cylinderGeometry args={[0.03, 0.04, 0.36, 6]} />
        <meshStandardMaterial roughness={0.3} metalness={0.6} />
      </Instances>
      <Instances items={kit.bulbs}>
        <sphereGeometry args={[0.06, 8, 6]} />
        <meshStandardMaterial roughness={0.3} metalness={0.6} />
      </Instances>
      <Instances items={kit.rails}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.3} metalness={0.6} />
      </Instances>
      <Instances items={kit.pedestals}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.6} />
      </Instances>
      <Instances items={kit.finials}>
        <sphereGeometry args={[0.07, 10, 8]} />
        <meshStandardMaterial roughness={0.3} metalness={0.6} />
      </Instances>
    </group>
  );
}

/** A gilded column on a cloud, a dome and an orb on top. */
export function SkyCorner({ theme }: CornerProps) {
  const roof = theme.tower.roof;
  return (
    <>
      {([[0, 0, 0.62], [0.3, 0.25, 0.42], [-0.28, 0.22, 0.4]] as const).map(([x, z, r], k) => (
        <mesh key={k} position={[x, TOP - 0.1 + k * 0.04, z]} scale={[1, 0.62, 1]}>
          <sphereGeometry args={[r, 12, 8]} />
          <meshStandardMaterial color="#ffffff" roughness={1} emissive="#c9dcf0" emissiveIntensity={0.25} />
        </mesh>
      ))}
      <mesh position={[0, TOP + 0.55, 0]}>
        <cylinderGeometry args={[0.15, 0.17, 1.1, 10]} />
        <meshStandardMaterial color={theme.tower.body} roughness={0.5} />
      </mesh>
      <mesh position={[0, TOP + 1.12, 0]}>
        <boxGeometry args={[0.42, 0.08, 0.42]} />
        <meshStandardMaterial color={roof} roughness={0.3} metalness={0.6} />
      </mesh>
      <mesh position={[0, TOP + 1.16, 0]}>
        <sphereGeometry args={[0.24, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={roof} roughness={0.3} metalness={0.6} />
      </mesh>
      <mesh position={[0, TOP + 1.5, 0]}>
        <sphereGeometry args={[0.09, 10, 8]} />
        <meshStandardMaterial color={roof} roughness={0.25} metalness={0.7} />
      </mesh>
    </>
  );
}

/** A little cloud caught on the post, a gold ring through it. */
export function SkyShelter({ theme }: { theme: ArenaTheme }) {
  return (
    <>
      {([[0, 0, 0.36], [0.26, -0.05, 0.24], [-0.24, -0.06, 0.22]] as const).map(([x, y, r], k) => (
        <mesh key={k} position={[x, 1.46 + y, 0]} scale={[1, 0.66, 1]}>
          <sphereGeometry args={[r, 10, 8]} />
          <meshStandardMaterial color="#ffffff" roughness={1} emissive="#c9dcf0" emissiveIntensity={0.25} />
        </mesh>
      ))}
      <mesh position={[0, 1.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.3, 0.035, 6, 20]} />
        <meshStandardMaterial color={theme.tower.roof} roughness={0.3} metalness={0.6} />
      </mesh>
    </>
  );
}

/* ── Moon Base ────────────────────────────────────────────────────── */

/** Moon Base's crest as data, by kind of piece (see CREST_PIECES). */
function moonPieces(theme: ArenaTheme, rim: RimSpot[]) {
  const white = theme.wall.cap;
  const rubble: Piece[] = [];
  const GREY = [theme.wall.color, '#a3a7b0', '#7e828c', '#b9bcc4'];
  rim.forEach((m, i) => {
    for (let b = 0; b < 2; b++) {
      const k = i * 2 + b;
      const [ox, oz] = outOf(m);
      const across = (b === 0 ? -0.12 : 0.12) + (jit(k, 1) - 0.5) * 0.1;
      const along = (b === 0 ? -0.14 : 0.16);
      const s = 0.75 + jit(k, 2) * 0.55;
      rubble.push({
        p: [
          m.pos[0] + ox * across + (m.alongX ? along : 0),
          TOP + 0.03,
          m.pos[2] + oz * across + (m.alongX ? 0 : along),
        ],
        r: [jit(k, 3) * 3, jit(k, 4) * 3, jit(k, 5) * 3],
        s: [1.25 * s, 0.6 * s, 1.1 * s],
        c: GREY[k % 4],
      });
    }
  });
  const bodies: Piece[] = [];
  const ends: Piece[] = [];
  const ribs: Piece[] = [];
  const windows: Piece[] = [];
  for (const sx of [-1, 1]) {
    for (const z of [-2.3, 2.3]) {
      const x = sx * EX;
      bodies.push({ p: [x, TOP + 0.3, z], r: [Math.PI / 2, 0, 0], c: white });
      for (const e of [-1, 1]) ends.push({ p: [x, TOP + 0.3, z + e * 0.7], s: [1, 1, 0.5], c: white });
      for (const e of [-0.45, 0, 0.45]) {
        ribs.push({ p: [x, TOP + 0.3, z + e], c: '#6e7280' });
      }
      for (const e of [-0.24, 0.24]) {
        // Skylights along the top of the module, lit from inside.
        windows.push({ p: [x, TOP + 0.565, z + e], s: [0.1, 0.02, 0.2], c: theme.tower.roof });
      }
    }
  }
  return { rubble, bodies, ends, ribs, windows };
}

/**
 * A berm of bulldozed regolith along the wall, with habitat modules
 * lying on it.
 *
 * The old crest was hull plating and a hazard stripe — a SPACESHIP's
 * wall, and the set already has a Space Station. A moon base is dug in:
 * the walls are heaped dust and rubble, and the base itself is the row of
 * white cylinders sitting on them with their lit windows. Modules sit on
 * the long walls only, in mirrored pairs, so no wall is dressed and its
 * opposite bare (the audit's symmetry rule) and none stands where a
 * prisoner does.
 */
export function MoonCrest({ theme, rim }: CrestProps) {
  const kit = useMemo(() => moonPieces(theme, rim), [theme, rim]);

  return (
    <group>
      <Instances items={kit.rubble}>
        <dodecahedronGeometry args={[0.2, 0]} />
        <meshStandardMaterial roughness={1} flatShading />
      </Instances>
      <Instances items={kit.bodies}>
        <cylinderGeometry args={[0.26, 0.26, 1.4, 14]} />
        <meshStandardMaterial roughness={0.45} metalness={0.2} />
      </Instances>
      <Instances items={kit.ends}>
        <sphereGeometry args={[0.26, 12, 8]} />
        <meshStandardMaterial roughness={0.45} metalness={0.2} />
      </Instances>
      <Instances items={kit.ribs}>
        <torusGeometry args={[0.27, 0.035, 6, 16]} />
        <meshStandardMaterial roughness={0.4} metalness={0.5} />
      </Instances>
      <Instances items={kit.windows}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial />
      </Instances>
    </group>
  );
}

/** A geodesic dome on a drum, with a beacon blinking on its mast. */
export function MoonCorner({ theme, wallMaterial }: CornerProps) {
  const blink = useMemo(
    () => (mesh: THREE.Mesh, t: number) => {
      const on = (t * 0.8) % 1 < 0.18;
      (mesh.material as THREE.MeshBasicMaterial).color.setHex(on ? 0xff6e5a : 0x5a2a2a);
    },
    [],
  );
  const ref = useRef<THREE.Mesh>(null);
  useLive(ref, blink);
  return (
    <>
      <mesh material={wallMaterial} position={[0, TOP / 2, 0]}>
        <cylinderGeometry args={[0.56, 0.62, TOP, 12]} />
      </mesh>
      <mesh position={[0, TOP, 0]} scale={[1, 0.85, 1]}>
        <icosahedronGeometry args={[0.56, 1]} />
        <meshStandardMaterial color={theme.wall.cap} roughness={0.4} metalness={0.2} flatShading />
      </mesh>
      <mesh position={[0, TOP + 0.08, 0.5]}>
        <boxGeometry args={[0.2, 0.22, 0.1]} />
        <meshBasicMaterial color={theme.tower.roof} />
      </mesh>
      <mesh position={[0.18, TOP + 0.75, -0.1]}>
        <cylinderGeometry args={[0.02, 0.025, 0.5, 5]} />
        <meshStandardMaterial color="#8f939c" roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh ref={ref} position={[0.18, TOP + 1.02, -0.1]}>
        <sphereGeometry args={[0.06, 8, 6]} />
        <meshBasicMaterial color="#ff6e5a" />
      </mesh>
    </>
  );
}

/**
 * Every crest's pieces, by board, for the suite: the pieces are pure data
 * built from the theme and the rim ring, so a test can check that they
 * stand on the wall, out of the tray, and all the way round it — which
 * nothing can check once they are inside an instanced mesh.
 */
export const CREST_PIECES: Partial<
  Record<ArenaStructure, (theme: ArenaTheme, rim: RimSpot[]) => Record<string, Piece[]>>
> = {
  snowFence: snowPieces,
  adobe: adobePieces,
  basalt: basaltPieces,
  logPile: logPieces,
  iceBlocks: icePieces,
  stalagmite: stalagmitePieces,
  cloudBalustrade: skyPieces,
  airlock: moonPieces,
};

/* ── idle life ────────────────────────────────────────────────────── */

/** A material's emissive glow, breathing. Shared by crests and floors. */
function breathe(base: number, swing: number, speed: number) {
  return (obj: THREE.Object3D, t: number) => {
    const m = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial;
    m.emissiveIntensity = base + swing * Math.sin(t * speed);
  };
}

// Made once, so the effects that attach them never re-run for nothing.
const EMBER_BREATH = breathe(0.85, 0.35, 1.7);
const ICE_BREATH = breathe(0.3, 0.12, 0.55);
const GEM_BREATH = breathe(0.5, 0.18, 0.8);
const CRATER_BREATH = breathe(1, 0.4, 1.3);

/** Breathes whatever single mesh it wraps. */
function Live({ live, children }: { live: (obj: THREE.Object3D, t: number) => void; children: React.ReactElement }) {
  const ref = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    const mesh = ref.current?.children[0];
    if (!mesh) return;
    mesh.onBeforeRender = () => live(mesh, now());
    return () => {
      mesh.onBeforeRender = () => {};
    };
  }, [live]);
  return <group ref={ref}>{children}</group>;
}

/* ── the eight boards, as a registry ─────────────────────────────── */

/**
 * The parts of a board's five-role palette (docs/board-redesign.md) that
 * ArenaTheme has no field for. Base, surface and accent are the theme's
 * floor, wall and tower roof; glow and shadow live here because only
 * these renderers use them.
 */
interface BoardKit {
  /** How hard the key light rakes the floor's painted relief. */
  relief: number;
  /** The floor's glow breathing: base, swing, speed. Null: no glow. */
  breath: [number, number, number] | null;
  /** The far haze the board's world fades into at the top of the frame. */
  haze: { color: string; far: number; sides: number };
  /** Five-role palette: the emissive and the deepest shade. */
  glow: string;
  shadow: string;
}

export const BOARD_KITS: Partial<Record<ArenaStructure, BoardKit>> = {
  snowFence: { relief: 1.4, breath: null, haze: { color: '#f4f8fc', far: 0.75, sides: 0 }, glow: '#fff6d8', shadow: '#8fa6c2' },
  adobe: { relief: 1.6, breath: null, haze: { color: '#f7deb0', far: 0.6, sides: 0 }, glow: '#fff1b8', shadow: '#8a5a32' },
  basalt: { relief: 1.8, breath: [1, 0.35, 1.1], haze: { color: '#3a1a1a', far: 0.7, sides: 0.15 }, glow: '#ff7a2a', shadow: '#1e1416' },
  logPile: { relief: 1.6, breath: null, haze: { color: '#f0cf96', far: 0.5, sides: 0 }, glow: '#ffd07a', shadow: '#4a3220' },
  iceBlocks: { relief: 1.0, breath: [1, 0.3, 0.6], haze: { color: '#0c2636', far: 0.85, sides: 0.2 }, glow: '#5ef0b4', shadow: '#2a4a60' },
  stalagmite: { relief: 1.6, breath: [1, 0.3, 0.7], haze: { color: '#0e0a16', far: 0.85, sides: 0.55 }, glow: '#c98aff', shadow: '#1a1426' },
  cloudBalustrade: { relief: 1.2, breath: null, haze: { color: '#dceefc', far: 0.7, sides: 0 }, glow: '#ffe7a0', shadow: '#8fa9c6' },
  airlock: { relief: 1.6, breath: null, haze: { color: '#04050a', far: 0.95, sides: 0.15 }, glow: '#ffc845', shadow: '#2a2e3a' },
};

/** The floor's glow breathing, for the renderer that owns the floor. */
export function floorBreath(structure: ArenaStructure) {
  const b = BOARD_KITS[structure]?.breath;
  return b ? breathe(b[0], b[1], b[2]) : undefined;
}

/** Attach idle life to an object the caller owns (the floor, the ground). */
export function useBoardLive(ref: React.RefObject<THREE.Object3D | null>, live?: (obj: THREE.Object3D, t: number) => void) {
  useLive(ref, live);
}


/* ── the world around the tray ────────────────────────────────────── */

/** The haze sheet covers the visible ground: x ±4.8, z -11.2 to 8.6. */
const HAZE_W = 9.6;
const HAZE_Z0 = -11.2;
const HAZE_Z1 = 8.6;

/**
 * The far backdrop, as a tint laid over the ground.
 *
 * The brief's layering is backdrop → midground → tray, and this camera
 * makes the backdrop a strange thing: it looks almost straight down, so
 * "far away" is the top strip of the frame, two units of ground behind
 * the jail — and anything STANDING there is directly over the board (the
 * horizon-blob lesson, tools/arena-preview/README.md). So the backdrop is
 * flat: a sheet just above the ground and below the tray floor, clear
 * over the middle and fading into the board's own distance at the top —
 * snow mist, heat haze, volcanic smoke, the black of space past the
 * Moon's close horizon, the dark of a cave closing in at the sides. It
 * cannot loom, because it has no height at all.
 */
function hazeTexture(kit: BoardKit, structure: ArenaStructure): THREE.DataTexture {
  const W = 32;
  const H = 96;
  const data = new Uint8Array(W * H * 4);
  const c = new THREE.Color(kit.haze.color);
  const r = Math.round(c.r * 255);
  const g = Math.round(c.g * 255);
  const b = Math.round(c.b * 255);
  const smooth = (e0: number, e1: number, v: number) => {
    const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };
  for (let y = 0; y < H; y++) {
    // Row 0 is the near end (v = 0), as for every plane laid flat here.
    const z = HAZE_Z1 + ((HAZE_Z0 - HAZE_Z1) * (y + 0.5)) / H;
    for (let x = 0; x < W; x++) {
      const wx = -HAZE_W / 2 + (HAZE_W * (x + 0.5)) / W;
      const far = smooth(-7.8, -10.1, z) * kit.haze.far;
      const side = smooth(3.0, 4.6, Math.abs(wx)) * kit.haze.sides;
      let a = Math.max(far, side);
      let cr = r;
      let cg = g;
      let cb = b;
      if (structure === 'iceBlocks') {
        // The aurora itself, hanging in the far dark: curtains of green
        // and cyan that the renderer slides slowly sideways.
        const curtain = 0.5 + 0.5 * Math.sin((x / W) * Math.PI * 6 + Math.sin((x / W) * Math.PI * 2) * 1.5);
        const lit = smooth(-8.6, -10.0, z) * curtain;
        cr = Math.round(r + (70 - r) * lit);
        cg = Math.round(g + (236 - g) * lit);
        cb = Math.round(b + (170 - b) * lit);
        a = Math.max(a, lit * 0.6);
      }
      const i = (y * W + x) * 4;
      data[i] = cr;
      data[i + 1] = cg;
      data[i + 2] = cb;
      data[i + 3] = Math.round(a * 255);
    }
  }
  const t = new THREE.DataTexture(data, W, H);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

function Haze({ structure, kit }: { structure: ArenaStructure; kit: BoardKit }) {
  const tex = useMemo(
    () =>
      cachedTexture(`board-haze-${structure}-${kit.haze.color}-${kit.haze.far}-${kit.haze.sides}`, () =>
        hazeTexture(kit, structure),
      ),
    [structure, kit],
  );
  const ref = useRef<THREE.Mesh>(null);
  // Only the aurora moves: its curtains drift, slowly enough to be felt
  // rather than watched.
  const live = useMemo(
    () =>
      structure === 'iceBlocks'
        ? (_m: THREE.Mesh, t: number) => {
            tex.offset.x = (t * 0.012) % 1;
          }
        : undefined,
    [structure, tex],
  );
  useLive(ref, live);
  return (
    <mesh ref={ref} position={[0, -0.09, (HAZE_Z0 + HAZE_Z1) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[HAZE_W, HAZE_Z1 - HAZE_Z0]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} />
    </mesh>
  );
}

/** Where drifting things may go: the two strips of ground beside the tray. */
const STRIP_X = 3.35;

/**
 * Cloud puffs drifting slowly up past the Sky Kingdom, down both sides
 * of the tray and wrapping round. One instanced mesh; the matrices are
 * rewritten in place each frame it is drawn.
 */
function DriftingClouds() {
  const items = useMemo<Piece[]>(() => {
    const out: Piece[] = [];
    for (let k = 0; k < 6; k++) {
      for (let b = 0; b < 3; b++) {
        out.push({ p: [0, 0, 0], s: [1, 1, 1], c: b === 0 ? '#ffffff' : '#eef4fb' });
      }
    }
    return out;
  }, []);
  const live = useMemo(
    () => (mesh: THREE.InstancedMesh, t: number) => {
      for (let k = 0; k < 6; k++) {
        const side = k % 2 === 0 ? -1 : 1;
        const span = 17;
        const z = 7 - ((t * 0.12 + k * (span / 6)) % span);
        const x = side * (STRIP_X + 0.25 + jit(k, 1) * 0.3);
        for (let b = 0; b < 3; b++) {
          const r = b === 0 ? 0.42 : 0.3;
          SCRATCH.position.set(x + (b - 1) * 0.36, 0.55 + (b === 0 ? 0.08 : 0), z + (b === 2 ? 0.12 : 0));
          SCRATCH.rotation.set(0, 0, 0);
          SCRATCH.scale.set(r, r * 0.6, r);
          SCRATCH.updateMatrix();
          mesh.setMatrixAt(k * 3 + b, SCRATCH.matrix);
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
    [],
  );
  return (
    <Instances items={items} live={live} roams>
      <sphereGeometry args={[1, 10, 7]} />
      <meshStandardMaterial roughness={1} emissive="#c9dcf0" emissiveIntensity={0.3} transparent opacity={0.92} />
    </Instances>
  );
}

/**
 * Leaves coming down in the Autumn Woods, twisting as they fall, beside
 * the tray and never over it — a leaf drifting across the board would be
 * one more thing to mistake for a die.
 */
function FallingLeaves() {
  const items = useMemo<Piece[]>(
    () => Array.from({ length: 12 }, (_v, k) => ({ p: [0, 0, 0], c: LEAF_TONES[k % LEAF_TONES.length] })),
    [],
  );
  const live = useMemo(
    () => (mesh: THREE.InstancedMesh, t: number) => {
      for (let k = 0; k < 12; k++) {
        const side = k % 2 === 0 ? -1 : 1;
        const fall = (t * 0.18 + jit(k, 1)) % 1;
        const sway = Math.sin(t * 1.3 + k) * 0.25;
        SCRATCH.position.set(
          side * (STRIP_X + 0.1 + jit(k, 2) * 0.4) + sway,
          2.6 - fall * 2.5,
          -9 + jit(k, 3) * 15 + fall * 0.8,
        );
        SCRATCH.rotation.set(t * 1.7 + k, t * 0.9 + k * 2, 0);
        SCRATCH.scale.set(1.6, 1, 1);
        SCRATCH.updateMatrix();
        mesh.setMatrixAt(k, SCRATCH.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
    [],
  );
  return (
    <Instances items={items} live={live} roams>
      <circleGeometry args={[0.09, 6]} />
      <meshStandardMaterial roughness={0.9} side={THREE.DoubleSide} />
    </Instances>
  );
}

/**
 * Earth, low over the Moon's horizon, and a handful of stars in the black
 * beyond it — laid flat in the haze band at the top of the frame, which
 * is the only place this camera has a sky.
 */
function MoonSky() {
  const stars = useMemo<Piece[]>(
    () =>
      Array.from({ length: 22 }, (_v, k) => ({
        p: [(jit(k, 1) - 0.5) * 8.6, -0.085, -9.6 - jit(k, 2) * 0.7] as V3,
        r: [-Math.PI / 2, 0, 0] as V3,
        s: [0.5 + jit(k, 3), 0.5 + jit(k, 3), 1] as V3,
        c: '#ffffff',
      })),
    [],
  );
  return (
    <>
      <Instances items={stars}>
        <circleGeometry args={[0.035, 5]} />
        <meshBasicMaterial />
      </Instances>
      <mesh position={[1.5, -0.084, -9.95]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.34, 20]} />
        <meshBasicMaterial color="#4a8ae0" />
      </mesh>
      <mesh position={[1.55, -0.083, -9.98]} rotation={[-Math.PI / 2, 0, 0.6]} scale={[1, 0.5, 1]}>
        <circleGeometry args={[0.2, 12]} />
        <meshBasicMaterial color="#6fbe78" />
      </mesh>
    </>
  );
}

/**
 * Everything around the tray that is this board's and nobody else's: the
 * far haze for all eight, and the idle life where a board has some.
 */
export function BoardScenery({ theme }: { theme: ArenaTheme }) {
  const kit = BOARD_KITS[theme.structure];
  // The store boards have no kit here — their walls live in
  // storeBoards.tsx — but they do have creatures (boardLife.tsx), so
  // this no longer gives up without one.
  return (
    <group>
      {kit && <Haze structure={theme.structure} kit={kit} />}
      {theme.structure === 'cloudBalustrade' && <DriftingClouds />}
      {theme.structure === 'logPile' && <FallingLeaves />}
      {theme.structure === 'airlock' && <MoonSky />}
      {/* The creatures David asked for on 19 Oct 2026, in boardLife.tsx. */}
      {theme.structure === 'coralRim' && <ReefFish />}
      {theme.structure === 'shipHull' && <CoveShark />}
      {theme.structure === 'parapet' && <CityHelicopters />}
      {theme.structure === 'picket' && <FarmAnimals />}
      {theme.structure === 'driftwood' && <BeachLife />}
      {theme.structure === 'blocks' && <ToyTrain />}
      {theme.structure === 'adobe' && <DesertCamels />}
      {theme.structure === 'airlock' && <MoonAliens />}
      {theme.structure === 'basalt' && <LavaRiver />}
      {theme.structure === 'snowFence' && <SnowLife />}
      {theme.structure === 'fernRock' && <DinoLife />}
    </group>
  );
}
