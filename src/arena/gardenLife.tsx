import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { TUNING } from '../game/tuning';
import { useSceneryTick } from './sceneryClock';

/**
 * The Moon Garden's life, season 2 of the pass (21 Oct 2026): a big
 * moon laid in the band of sky at the top of the frame, and moths
 * fluttering round the lanterns on the wall.
 *
 * Six moths, each circling its own lantern post in a small wobbly loop,
 * wings beating, pale against the night. Moved on a scenery tick that
 * allocates nothing (sceneryClock.ts). They keep over the wall tops and
 * the strips beside the tray — never over the board, where one could be
 * mistaken for a die or hide one.
 */

const { innerWidth, innerDepth, wallThickness, wallHeight } = TUNING.tray;
/** The middle of the wall top, where the lantern posts stand. */
const CX = innerWidth / 2 + wallThickness / 2;
const CZ = innerDepth / 2 + wallThickness / 2;

/** Where the moths live: beside a lantern post each, over the wall or just outside it. */
const HOMES: readonly (readonly [number, number])[] = [
  [-CX - 0.2, -3.3],
  [-CX - 0.2, 0.6],
  [-CX - 0.2, 3.5],
  [CX + 0.2, -2.0],
  [CX + 0.2, 1.8],
  [0.9, -CZ - 0.2],
];

/** A repeatable 0..1 jitter for moth `i`, channel `k`. Never random. */
const jit = (i: number, k: number): number => {
  const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

export function GardenLife() {
  return (
    <group>
      <GardenMoon />
      {HOMES.map(([x, z], i) => (
        <Moth key={i} x={x} z={z} i={i} />
      ))}
    </group>
  );
}

/**
 * The moon and a scatter of stars, flat in the haze band at the top of
 * the frame — the only place this camera has a sky (the same trick as
 * the Moon Base's Earth in boardKits.tsx).
 */
function GardenMoon() {
  const stars = useMemo(
    () =>
      Array.from({ length: 18 }, (_, k) => [
        (jit(k, 1) - 0.5) * 8.4,
        -9.55 - jit(k, 2) * 0.8,
        0.5 + jit(k, 3),
      ] as [number, number, number]),
    [],
  );
  return (
    <group>
      <mesh position={[-1.4, -0.085, -9.9]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.0, 24]} />
        <meshBasicMaterial color="#aab8ff" transparent opacity={0.25} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh position={[-1.4, -0.084, -9.9]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.55, 24]} />
        <meshBasicMaterial color="#f4f0e0" />
      </mesh>
      {/* Seas on its face. */}
      {([
        [-0.15, 0.1, 0.14],
        [0.12, -0.08, 0.1],
        [0.05, 0.22, 0.08],
      ] as const).map(([ox, oz, r], k) => (
        <mesh key={k} position={[-1.4 + ox, -0.083, -9.9 + oz]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[r, 12]} />
          <meshBasicMaterial color="#d8d2c0" />
        </mesh>
      ))}
      {stars.map(([x, z, s], k) => (
        <mesh key={k} position={[x, -0.084, z]} rotation={[-Math.PI / 2, 0, 0]} scale={[s, s, 1]}>
          <circleGeometry args={[0.035, 5]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
    </group>
  );
}

/** A moth: a small pale body with two wings hinged at the shoulder, beating. */
function Moth({ x, z, i }: { x: number; z: number; i: number }) {
  const body = useRef<THREE.Group | null>(null);
  const wingL = useRef<THREE.Group | null>(null);
  const wingR = useRef<THREE.Group | null>(null);
  const tick = useMemo(
    () => (t: number) => {
      const g = body.current;
      if (!g) return;
      const s = t * (0.9 + jit(i, 1) * 0.5) + jit(i, 2) * 20;
      // A wobbly loop round the lantern, drifting up and down.
      const r = 0.25 + 0.1 * Math.sin(s * 0.7);
      g.position.set(
        x + Math.cos(s) * r,
        wallHeight + 0.75 + Math.sin(s * 2.1) * 0.15 + jit(i, 3) * 0.2,
        z + Math.sin(s * 1.3) * r,
      );
      // Face the way it is going (built nose toward +z).
      g.rotation.set(0, Math.atan2(-Math.sin(s) * r, Math.cos(s * 1.3) * 1.3 * r), 0);
      const flap = Math.sin(t * 22 + i * 3) * 0.9;
      if (wingL.current) wingL.current.rotation.z = flap;
      if (wingR.current) wingR.current.rotation.z = -flap;
    },
    [x, z, i],
  );
  useSceneryTick(tick);
  return (
    <group ref={body}>
      <mesh scale={[0.025, 0.02, 0.06]}>
        <sphereGeometry args={[1, 6, 5]} />
        <meshStandardMaterial color="#d9d2c0" roughness={0.9} />
      </mesh>
      {([[wingL, -1], [wingR, 1]] as const).map(([ref, side]) => (
        <group key={side} ref={ref} position={[side * 0.01, 0.005, 0]}>
          <mesh position={[side * 0.065, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.13, 0.08]} />
            <meshStandardMaterial color="#efe9d8" roughness={0.9} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
