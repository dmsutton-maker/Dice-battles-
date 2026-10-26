import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { TUNING } from '../game/tuning';
import { cachedTexture } from './textureCache';
import { createGlowTexture, createHullPlateTexture } from './bespokeFloors';
import { Instanced, Placement } from './Instanced';
import { hash } from './paint';
import { useSceneryTick } from './sceneryClock';

/**
 * The Space Station's hull, its deck apron, and the drop to the stars.
 *
 * Its palette, in the board redesign's five roles:
 *   base     #606a7b  deck plate (bespokeFloors.ts)
 *   surface  #8a93a8  hull plating
 *   accent   #e0a63c  hazard amber
 *   glow     #3ff2ff  light strips, lamps, the containment field
 *   shadow   #0b1026  the void
 *
 * The shape language is ENGINEERED and OPEN: a low bulwark of bolted
 * plates and ribs with light in its seams, and beyond it — instead of a
 * meadow or a jungle — nothing. The deck is a platform in orbit, and the
 * strip of screen either side of the tray looks straight down past its
 * edge at a planet and the stars.
 */

const { innerWidth, innerDepth, wallThickness } = TUNING.tray;
const halfW = innerWidth / 2;
const halfD = innerDepth / 2;
const outerX = halfW + wallThickness;
const outerZ = halfD + wallThickness;

const HULL = '#8a93a8';
const HULL_ALT = '#7b8499';
const RIB = '#566074';
const CAP = '#4a5164';
const AMBER = '#ffb347';
const CYAN = '#3ff2ff';

/**
 * The bulwark: plates along each run with a rib between each pair, a cap
 * rail on top, and a status lamp on every rib. `rimHeight` comes from the
 * arena so the field above it starts exactly where the plating stops.
 */
export function HullBulwark({ rimHeight }: { rimHeight: number }) {
  const { plates, ribs, lampsA, lampsB } = useMemo(() => {
    const plates: Placement[] = [];
    const ribs: Placement[] = [];
    const lampsA: Placement[] = [];
    const lampsB: Placement[] = [];
    const runs = [
      { alongX: true, at: -(halfD + wallThickness / 2), from: -outerX, to: outerX, inner: 1 },
      { alongX: true, at: halfD + wallThickness / 2, from: -outerX, to: outerX, inner: -1 },
      { alongX: false, at: -(halfW + wallThickness / 2), from: -halfD, to: halfD, inner: 1 },
      { alongX: false, at: halfW + wallThickness / 2, from: -halfD, to: halfD, inner: -1 },
    ];
    let k = 0;
    for (const run of runs) {
      const span = run.to - run.from;
      const n = Math.max(2, Math.round(span / 0.9));
      const len = span / n;
      for (let i = 0; i < n; i++) {
        const a = run.from + len * (i + 0.5);
        const h = rimHeight - 0.05;
        plates.push({
          position: run.alongX ? [a, h / 2, run.at] : [run.at, h / 2, a],
          scale: run.alongX ? [len - 0.035, h, wallThickness - 0.04] : [wallThickness - 0.04, h, len - 0.035],
          color: (i + k) % 2 ? HULL : HULL_ALT,
        });
        if (i === 0) continue;
        // A rib at each joint, standing proud of the inner face.
        const b = run.from + len * i;
        const face = run.at + run.inner * (wallThickness / 2 + 0.02);
        ribs.push({
          position: run.alongX ? [b, rimHeight / 2, face] : [face, rimHeight / 2, b],
          scale: run.alongX ? [0.08, rimHeight, 0.06] : [0.06, rimHeight, 0.08],
        });
        const lamp: Placement = {
          position: run.alongX ? [b, rimHeight + 0.035, run.at] : [run.at, rimHeight + 0.035, b],
        };
        (i % 2 ? lampsA : lampsB).push(lamp);
      }
      k++;
    }
    return { plates, ribs, lampsA, lampsB };
  }, [rimHeight]);

  // Two banks of status lamps, blinking out of step — the station is
  // awake. Built once; the tick only writes a colour into two materials.
  const lampA = useRef<THREE.MeshBasicMaterial>(null);
  const lampB = useRef<THREE.MeshBasicMaterial>(null);
  const tick = useMemo(() => {
    const on = new THREE.Color(AMBER);
    const off = new THREE.Color('#5a3a1a');
    return (t: number) => {
      const phase = (t * 0.8) % 2;
      lampA.current?.color.copy(phase < 1 ? on : off);
      lampB.current?.color.copy(phase < 1 ? off : on);
    };
  }, []);
  useSceneryTick(tick);

  return (
    <group>
      <Instanced items={plates}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.45} metalness={0.5} />
      </Instanced>
      <Instanced items={ribs}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={RIB} roughness={0.4} metalness={0.6} />
      </Instanced>
      {/* The cap rail, the whole way round. */}
      {(
        [
          [0, -(halfD + wallThickness / 2), outerX * 2, wallThickness],
          [0, halfD + wallThickness / 2, outerX * 2, wallThickness],
          [-(halfW + wallThickness / 2), 0, wallThickness, innerDepth],
          [halfW + wallThickness / 2, 0, wallThickness, innerDepth],
        ] as const
      ).map(([x, z, w, d], i) => (
        <mesh key={`cap-${i}`} position={[x, rimHeight - 0.02, z]}>
          <boxGeometry args={[w, 0.05, d]} />
          <meshStandardMaterial color={CAP} roughness={0.4} metalness={0.6} />
        </mesh>
      ))}
      <Instanced items={lampsA}>
        <boxGeometry args={[0.1, 0.03, 0.1]} />
        <meshBasicMaterial ref={lampA} color={AMBER} toneMapped={false} />
      </Instanced>
      <Instanced items={lampsB}>
        <boxGeometry args={[0.1, 0.03, 0.1]} />
        <meshBasicMaterial ref={lampB} color={AMBER} toneMapped={false} />
      </Instanced>
    </group>
  );
}

/**
 * The deck the tray is set into: a platform behind it for the cell, one
 * in front for the shuttle bay, and a narrow catwalk down each side —
 * then the edge, lit, and the drop.
 */
export function DeckApron() {
  const plate = useMemo(() => cachedTexture('space-hull-plate', createHullPlateTexture), []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ map: plate, roughness: 0.6, metalness: 0.4 }), [plate]);
  useEffect(() => () => material.dispose(), [material]);
  const catwalk = outerX + 0.55;
  // Each piece gets its own UV scale so the plates are one world unit
  // square everywhere.
  const pieces = useMemo(() => {
    const list: { x: number; z: number; w: number; d: number }[] = [
      { x: 0, z: (-outerZ - 11) / 2, w: 10, d: 11 - outerZ },
      { x: 0, z: (outerZ + 10) / 2, w: 10, d: 10 - outerZ },
      { x: -(outerX + catwalk) / 2, z: 0, w: catwalk - outerX + 0.02, d: outerZ * 2 },
      { x: (outerX + catwalk) / 2, z: 0, w: catwalk - outerX + 0.02, d: outerZ * 2 },
    ];
    return list.map((p) => {
      const g = new THREE.PlaneGeometry(p.w, p.d);
      const uv = g.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * p.w, uv.getY(i) * p.d);
      return { ...p, g };
    });
  }, [catwalk]);
  useEffect(() => () => pieces.forEach((p) => p.g.dispose()), [pieces]);

  return (
    <group>
      {pieces.map((p, i) => (
        <mesh key={i} geometry={p.g} material={material} position={[p.x, -0.12, p.z]} rotation={[-Math.PI / 2, 0, 0]} />
      ))}
      {/* The edge of the deck: a lit kerb along every drop. */}
      {([-1, 1] as const).map((side) => (
        <group key={side}>
          <mesh position={[side * catwalk, -0.08, 0]}>
            <boxGeometry args={[0.06, 0.1, outerZ * 2]} />
            <meshBasicMaterial color={CYAN} toneMapped={false} />
          </mesh>
          {[-outerZ, outerZ].map((z) => (
            <mesh key={z} position={[side * (catwalk + 2.6), -0.08, z]}>
              <boxGeometry args={[5.2, 0.1, 0.06]} />
              <meshBasicMaterial color={CYAN} toneMapped={false} />
            </mesh>
          ))}
          {/* The deck's own thickness, seen past the edge. */}
          <mesh position={[side * (catwalk - 0.02), -0.45, 0]}>
            <boxGeometry args={[0.04, 0.6, outerZ * 2]} />
            <meshStandardMaterial color="#2a3042" roughness={0.6} metalness={0.4} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Far below the deck edge: solar wings, a ringed planet and the stars —
 * three depths, so looking past the edge reads as a long way down.
 *
 * Placed by projection, not by eye: the strip of screen beside the tray
 * looks down past the catwalk edge at about x 3.4 at deck height, which
 * widens to x 7 to 10 by the time it is 25 units down. Everything here
 * sits in that wedge; the planet and stars that used to hang in the sky
 * above the deck were in a part of the scene the camera never sees.
 */
export function TheDrop() {
  const glow = useMemo(() => cachedTexture('glow-disc', createGlowTexture), []);
  const stars = useMemo(() => {
    const make = (count: number, seed: number) => {
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const side = i % 2 ? 1 : -1;
        const y = -12 - hash(i, seed) * 30;
        // Spread across the wedge the edge looks down into at this depth.
        const reach = 3.4 * ((19.5 - y) / 19.5);
        positions[i * 3] = side * (reach - 0.5 + hash(i, seed + 1) * 4.5);
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = -14 + hash(i, seed + 2) * 26;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      return g;
    };
    return { far: make(260, 3.1), near: make(70, 7.7) };
  }, []);
  // Passed as props, not JSX children, so R3F will not free them; built
  // per mount, so freed per unmount.
  useEffect(
    () => () => {
      stars.far.dispose();
      stars.near.dispose();
    },
    [stars],
  );
  const starMats = useMemo(
    () => ({
      far: new THREE.PointsMaterial({ color: '#cfd8ff', size: 0.16, sizeAttenuation: true, toneMapped: false }),
      near: new THREE.PointsMaterial({ color: '#ffffff', size: 0.3, sizeAttenuation: true, toneMapped: false }),
    }),
    [],
  );
  useEffect(
    () => () => {
      starMats.far.dispose();
      starMats.near.dispose();
    },
    [starMats],
  );

  // A slow twinkle: the near stars breathe, which is all a point can do.
  const tick = useMemo(
    () => (t: number) => {
      starMats.near.size = 0.27 + Math.sin(t * 2.3) * 0.05;
    },
    [starMats],
  );
  useSceneryTick(tick);

  return (
    <group>
      {/* The void itself, so nothing shows through but space. */}
      <mesh position={[0, -46, -2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[80, 90]} />
        <meshBasicMaterial color="#0b1026" />
      </mesh>
      {/* A nebula's glow under the left edge. */}
      <mesh position={[-11, -40, -6]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[18, 30]} />
        <meshBasicMaterial map={glow} color="#6a3fb0" transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <points geometry={stars.far} material={starMats.far} />
      <points geometry={stars.near} material={starMats.near} />
      {/* The planet, its curve showing under the right-hand edge. */}
      <group position={[12.5, -30, -3]}>
        <mesh>
          <sphereGeometry args={[9, 32, 20]} />
          <meshStandardMaterial color="#c98a5c" roughness={1} />
        </mesh>
        <mesh scale={1.06}>
          <sphereGeometry args={[9, 32, 20]} />
          <meshBasicMaterial color="#7fc8ff" transparent opacity={0.18} side={THREE.BackSide} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh rotation={[Math.PI / 2 - 0.35, 0.25, 0]}>
          <ringGeometry args={[11, 14.5, 48]} />
          <meshBasicMaterial color="#e8d5a8" transparent opacity={0.6} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
      {/* Solar wings well below the deck, the nearest of the three depths. */}
      {([-1, 1] as const).map((side) => (
        <group key={side} position={[side * 6.4, -4, -4]}>
          <mesh>
            <boxGeometry args={[3.6, 0.1, 0.18]} />
            <meshStandardMaterial color={HULL} roughness={0.4} metalness={0.6} />
          </mesh>
          {[-1.4, 0, 1.4].map((z) => (
            <mesh key={z} position={[0, 0, z]} rotation={[0.18, 0, 0]}>
              <boxGeometry args={[3.4, 0.05, 1.2]} />
              <meshStandardMaterial color="#1c2c58" roughness={0.25} metalness={0.7} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/** A beacon that blinks: what makes a mast a station mast rather than a pole. */
export function useBlink(materials: React.MutableRefObject<(THREE.MeshBasicMaterial | null)[]>) {
  const tick = useMemo(() => {
    const on = new THREE.Color();
    return (t: number) => {
      for (let i = 0; i < materials.current.length; i++) {
        const m = materials.current[i];
        if (!m) continue;
        // A short flash once every 1.6 seconds, staggered round the deck.
        const f = (t / 1.6 + i * 0.25) % 1;
        const k = f < 0.12 ? 1 : 0.25;
        on.set(i % 2 === 0 ? CYAN : '#ff5fd0').multiplyScalar(k);
        m.color.copy(on);
      }
    };
  }, [materials]);
  useSceneryTick(tick);
}
