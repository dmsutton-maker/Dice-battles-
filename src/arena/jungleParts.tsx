import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { TUNING } from '../game/tuning';
import { Instanced, Placement } from './Instanced';
import { hash } from './paint';
import { PalisadeLog, palisadeTopHeight, POLE_RADIUS } from './palisade';
import { useSceneryTick } from './sceneryClock';

/**
 * The Jungle Clearing's fence dressing and its undergrowth.
 *
 * Its palette, in the board redesign's five roles:
 *   base     #56713a  moss and leaf litter (bespokeFloors.ts)
 *   surface  #b3a75a  cane: yellow-green bamboo, olive where it weathers
 *   accent   #e0714a  heliconia flowers in the undergrowth
 *   glow     #f3d36a  sunlit young leaves at the top of the canopy
 *   shadow   #24361f  deep leaf shade
 *
 * The shape language is GROWTH and BINDING: horizontal canes ringed with
 * nodes, lashed to upright stakes in pairs, with vines hanging over them —
 * against the castle's stone and the station's plate. Nothing straight
 * stands above the fence except the buttress trees.
 */

const { innerWidth, innerDepth, wallThickness } = TUNING.tray;
const halfW = innerWidth / 2;
const halfD = innerDepth / 2;

const NODE = '#7d7a3a';
const LASHING = '#5a5128';
const STAKE = '#a49650';
const VINE = ['#3d7a36', '#4a8a3c', '#356b30', '#5c9844'];
const LEAF = ['#2f6b34', '#3a7a3e', '#2a6130', '#4a8a44', '#24561f'];
const LEAF_LIT = ['#6a9e45', '#7fae4e', '#5c9440'];
const HELICONIA = '#e0714a';

/** The runs of the fence: which way each goes, and where it stands. */
const RUNS = [
  { alongX: true, at: -(halfD + wallThickness / 2), from: -halfW, to: halfW, inner: 1 },
  { alongX: true, at: halfD + wallThickness / 2, from: -halfW, to: halfW, inner: -1 },
  { alongX: false, at: -(halfW + wallThickness / 2), from: -halfD - wallThickness, to: halfD + wallThickness, inner: 1 },
  { alongX: false, at: halfW + wallThickness / 2, from: -halfD - wallThickness, to: halfD + wallThickness, inner: -1 },
] as const;

/** Where the lashings fall along a run: evenly, clear of the corners. */
function lashingStops(from: number, to: number): number[] {
  const span = to - from - 0.6;
  const n = Math.max(2, Math.round(span / 1.05));
  return Array.from({ length: n + 1 }, (_, i) => from + 0.3 + (i * span) / n);
}

/**
 * The rings round every cane where one section of bamboo meets the next.
 * They are the single detail that makes a pole read as bamboo rather than
 * a broom handle, so every rail carries them at a hand-span's pitch.
 */
function nodeRings(logs: PalisadeLog[]): Placement[] {
  const out: Placement[] = [];
  logs.forEach((log, li) => {
    const r = log.radius * 1.1;
    if (log.upright) {
      for (let y = 0.3; y < log.length - 0.05; y += 0.42) {
        out.push({
          position: [log.position[0], y, log.position[2]],
          scale: [r, 1, r],
        });
      }
      return;
    }
    const alongX = log.position[0] === 0;
    const offset = hash(li, 4.4) * 0.36;
    for (let a = -log.length / 2 + offset; a < log.length / 2; a += 0.36 + hash(li, a) * 0.06) {
      out.push({
        position: alongX ? [a, log.position[1], log.position[2]] : [log.position[0], log.position[1], a],
        rotation: log.rotation,
        scale: [r, 1, r],
      });
    }
  });
  return out;
}

/** Upright stakes in pairs either side of the stack, and the lashings that bind them. */
function stakesAndLashings(): { stakes: Placement[]; lashings: Placement[] } {
  const stakes: Placement[] = [];
  const lashings: Placement[] = [];
  const top = palisadeTopHeight();
  const stakeH = top + 0.16;
  RUNS.forEach((run, ri) => {
    lashingStops(run.from, run.to).forEach((a, i) => {
      for (const s of [-1, 1]) {
        const across = run.at + s * (POLE_RADIUS + 0.05);
        const lean = (hash(ri * 7 + i, s) - 0.5) * 0.06;
        stakes.push({
          position: run.alongX ? [a, stakeH / 2, across] : [across, stakeH / 2, a],
          rotation: run.alongX ? [lean, 0, 0] : [0, 0, lean],
          scale: [1, stakeH, 1],
        });
      }
      // Three wraps of vine round the bundle, high, middle and low.
      for (const y of [top * 0.18, top * 0.52, top * 0.86]) {
        lashings.push({
          position: run.alongX ? [a, y, run.at] : [run.at, y, a],
          rotation: run.alongX ? [0, 0, 0] : [0, Math.PI / 2, 0],
        });
      }
    });
  });
  return { stakes, lashings };
}

/** The bamboo fence's nodes, stakes and lashings. */
export function BambooDressing({ logs }: { logs: PalisadeLog[] }) {
  const nodes = useMemo(() => nodeRings(logs), [logs]);
  const { stakes, lashings } = useMemo(() => stakesAndLashings(), []);
  return (
    <group>
      <Instanced items={nodes}>
        <cylinderGeometry args={[1, 1, 0.035, 8, 1, true]} />
        <meshStandardMaterial color={NODE} roughness={0.8} side={THREE.DoubleSide} />
      </Instanced>
      <Instanced items={stakes}>
        <cylinderGeometry args={[0.05, 0.055, 1, 7]} />
        <meshStandardMaterial color={STAKE} roughness={0.85} />
      </Instanced>
      <Instanced items={lashings}>
        <boxGeometry args={[0.1, 0.07, 2 * POLE_RADIUS + 0.16]} />
        <meshStandardMaterial color={LASHING} roughness={1} />
      </Instanced>
    </group>
  );
}

/**
 * A leaf, lying flat with its stalk at the origin and its tip along +Z.
 * One shape, drawn hundreds of times through instancing, so the
 * undergrowth costs a draw call or two rather than one per leaf.
 */
function leafGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(0.42, 0.35, 0.05, 1);
  shape.lineTo(-0.05, 1);
  shape.quadraticCurveTo(-0.42, 0.35, 0, 0);
  const g = new THREE.ShapeGeometry(shape, 4);
  // Shapes are drawn in XY; lay it down into XZ, tip toward +Z.
  g.rotateX(Math.PI / 2);
  return g;
}

/**
 * Vines hanging over the fence into the clearing, swaying.
 *
 * All their leaves are ONE instanced mesh; the sway rewrites those few
 * dozen matrices each drawn frame from objects built once, swinging each
 * leaf further the lower it hangs — which is how a hanging vine moves.
 */
export function SwayingVines() {
  const geometry = useMemo(() => leafGeometry(), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const top = palisadeTopHeight();

  const leaves = useMemo(() => {
    const list: { anchor: [number, number, number]; drop: number; alongX: boolean; inner: number; yaw: number; size: number; phase: number; color: string }[] = [];
    let k = 0;
    RUNS.forEach((run) => {
      const count = run.alongX ? 4 : 8;
      for (let i = 0; i < count; i++) {
        k++;
        const a = run.from + ((i + 0.5 + (hash(k, 1.3) - 0.5) * 0.6) / count) * (run.to - run.from);
        const face = run.at + run.inner * (POLE_RADIUS + 0.06);
        const anchor: [number, number, number] = run.alongX ? [a, top, face] : [face, top, a];
        const length = 4 + Math.floor(hash(k, 2.9) * 4);
        for (let j = 0; j < length; j++) {
          list.push({
            anchor,
            drop: 0.06 + j * 0.16,
            alongX: run.alongX,
            inner: run.inner,
            yaw: (j % 2 ? 0.7 : -0.7) + (hash(k, j) - 0.5) * 0.4,
            size: 0.27 - j * 0.018,
            phase: k * 1.37,
            color: VINE[(k + j) % VINE.length],
          });
        }
      }
    });
    return list;
  }, [top]);

  const ref = useRef<THREE.InstancedMesh>(null);
  const tick = useMemo(() => {
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3();
    return (t: number) => {
      const mesh = ref.current;
      if (!mesh) return;
      for (let i = 0; i < leaves.length; i++) {
        const l = leaves[i];
        const swing = Math.sin(t * 1.3 + l.phase) * 0.05 * l.drop * 3;
        // Hang down the inner face, and swing along the wall.
        if (l.alongX) p.set(l.anchor[0] + swing, l.anchor[1] - l.drop, l.anchor[2] + l.inner * 0.02);
        else p.set(l.anchor[0] + l.inner * 0.02, l.anchor[1] - l.drop, l.anchor[2] + swing);
        // Leaf tips point into the clearing and droop.
        const facing = l.alongX ? (l.inner > 0 ? 0 : Math.PI) : l.inner > 0 ? Math.PI / 2 : -Math.PI / 2;
        e.set(0.9, facing + l.yaw + swing * 2, 0, 'YXZ');
        q.setFromEuler(e);
        s.setScalar(l.size);
        m.compose(p, q, s);
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
  }, [leaves]);
  useSceneryTick(tick);

  // First placement, so a scene with no clock (the preview, a still
  // board) shows the vines hanging rather than all at the origin.
  useEffect(() => {
    tick(0);
    const mesh = ref.current;
    if (!mesh) return;
    const c = new THREE.Color();
    leaves.forEach((l, i) => mesh.setColorAt(i, c.set(l.color)));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [tick, leaves]);

  return (
    <instancedMesh ref={ref} args={[geometry, undefined, leaves.length]} frustumCulled={false}>
      <meshStandardMaterial roughness={0.8} side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

/**
 * Big leaves fanned out over the crowns of the four buttress trees. A
 * crown drawn as a ball reads, from directly above, as a green disc; the
 * same crown with leaves radiating from it reads as a tree.
 */
export function CrownLeaves({ crowns }: { crowns: [number, number, number][] }) {
  const geometry = useMemo(() => leafGeometry(), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const items = useMemo<Placement[]>(() => {
    const out: Placement[] = [];
    crowns.forEach(([x, y, z], ti) => {
      for (let i = 0; i < 8; i++) {
        const yaw = (i / 8) * Math.PI * 2 + ti * 0.4;
        // No leaf reaches in over the board: the far crowns flank the jail
        // and the near ones the retreat, and a leaf over a prisoner's
        // head hides the prisoner.
        if (Math.sin(yaw) * Math.sign(x) < -0.45) continue;
        if (z > 0 && Math.cos(yaw) > 0.45) continue;
        out.push({
          position: [x, y + (i % 2) * 0.05, z],
          rotation: [0.3 + hash(ti, i) * 0.25, yaw, 0],
          order: 'YXZ',
          scale: 1.1 + hash(i, ti) * 0.35,
          color: i % 3 === 0 ? LEAF_LIT[(ti + i) % LEAF_LIT.length] : LEAF[(ti + i) % LEAF.length],
        });
      }
    });
    return out;
  }, [crowns]);
  return (
    <Instanced items={items}>
      <primitive object={geometry} attach="geometry" />
      <meshStandardMaterial roughness={0.8} side={THREE.DoubleSide} />
    </Instanced>
  );
}

/**
 * The undergrowth either side of the clearing and the canopy at its
 * corners, in three layers so the jungle has depth from directly above:
 * dark ground-layer leaves, mid-height leaves fanned out, and a high
 * layer of sunlit leaves overhanging the edges of the frame.
 *
 * Big flat leaves, because flat leaves are what a camera looking down
 * sees best — a palm or a tree is a dot from up there, a leaf the size of
 * a die is unmistakable.
 */
export function Undergrowth() {
  const geometry = useMemo(() => leafGeometry(), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const { low, high, flowers } = useMemo(() => {
    const low: Placement[] = [];
    const high: Placement[] = [];
    const flowers: Placement[] = [];
    // Clumps down both side strips: a fan of leaves from a centre.
    const clumps: [number, number, number][] = [
      // x, z, size — clear of the river on the left and of the prop spots
      [3.55, -4.1, 1.0], [3.7, -1.0, 0.9], [3.5, 1.6, 1.05], [3.75, 3.9, 0.9],
      [-3.0, -4.5, 0.7], [-3.1, 2.4, 0.75], [-2.95, 4.4, 0.7],
      [-3.4, -8.2, 1.1], [3.3, -8.4, 1.0], [0.0, -8.6, 0.9],
    ];
    clumps.forEach(([x, z, size], ci) => {
      const n = 5 + Math.floor(hash(ci, 2.2) * 3);
      for (let i = 0; i < n; i++) {
        const yaw = (i / n) * Math.PI * 2 + hash(ci, i) * 0.6;
        low.push({
          position: [x, 0.05 + i * 0.012, z],
          rotation: [-0.35 - hash(ci, i + 9) * 0.3, yaw, 0],
          order: 'YXZ',
          scale: size * (0.45 + hash(i, ci) * 0.25),
          color: LEAF[(ci + i) % LEAF.length],
        });
      }
      if (ci % 3 === 0) {
        flowers.push({ position: [x + 0.08, 0.32, z + 0.05], scale: [1, 1, 1] });
      }
    });
    // The high layer: sunlit leaves leaning in over the corners of the
    // frame, the nearest thing to the camera and the brightest green.
    const canopy: [number, number, number, number][] = [
      // x, y, z, yaw (pointing in toward the clearing)
      [-4.3, 2.4, -6.4, Math.PI / 2], [-4.2, 2.6, -7.6, Math.PI / 2 + 0.4], [-3.9, 2.9, -9.6, Math.PI / 2 + 0.2],
      [4.3, 2.5, -6.8, -Math.PI / 2], [4.2, 2.8, -8.2, -Math.PI / 2 - 0.3], [3.8, 3.0, -9.8, -Math.PI / 2 - 0.1],
      [-4.4, 2.2, 0.8, Math.PI / 2 - 0.3], [4.45, 2.3, -2.2, -Math.PI / 2 + 0.2], [4.4, 2.1, 2.9, -Math.PI / 2 - 0.2],
    ];
    canopy.forEach(([x, y, z, yaw], i) => {
      for (let k = 0; k < 3; k++) {
        high.push({
          position: [x, y - k * 0.12, z + (k - 1) * 0.35],
          rotation: [-0.25, yaw + (k - 1) * 0.35, 0],
          order: 'YXZ',
          scale: 1.05 - k * 0.15,
          color: k === 0 ? LEAF_LIT[i % LEAF_LIT.length] : LEAF[(i + k) % LEAF.length],
        });
      }
    });
    return { low, high, flowers };
  }, []);

  return (
    <group>
      <Instanced items={low}>
        <primitive object={geometry} attach="geometry" />
        <meshStandardMaterial roughness={0.85} side={THREE.DoubleSide} />
      </Instanced>
      <Instanced items={high}>
        <primitive object={geometry} attach="geometry" />
        <meshStandardMaterial roughness={0.75} side={THREE.DoubleSide} />
      </Instanced>
      {/* Heliconia: a few hot spots of colour in all that green. */}
      <Instanced items={flowers}>
        <coneGeometry args={[0.07, 0.22, 5]} />
        <meshStandardMaterial color={HELICONIA} roughness={0.6} />
      </Instanced>
    </group>
  );
}
