import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { TUNING } from '../game/tuning';
import { alongRoute, MARKET_ROUTE } from './marketPath';
import { useSceneryTick } from './sceneryClock';
import { Snowfall } from './snowfall';

/**
 * The Twinkle Market's life, Season 1 of the pass, Sugar & Snow (8 Nov
 * 2026): skaters gliding in loops on a frozen pond beyond the far wall,
 * shoppers in bobble hats strolling round the outside strips, the
 * string lights chasing in slow waves along the walls, and a few
 * snowflakes drifting down (snowfall.tsx).
 *
 * The pond lies in the band of ground at the top of the frame, the one
 * place this camera has beyond the far wall (where the Moon Garden puts
 * its moon). The shoppers walk a route round the outside of the tray
 * that steps round every stall, parcel pile and lantern post in their
 * way (marketPath.ts; David, 8 Nov 2026: "make them go around them"),
 * narrow enough to stay inside an iPhone 15's frame. Everything moves
 * on a scenery tick that allocates nothing (sceneryClock.ts), and
 * nothing is ever over the tray.
 */

const { innerWidth, innerDepth, wallThickness, wallHeight } = TUNING.tray;
const CX = innerWidth / 2 + wallThickness / 2;
const CZ = innerDepth / 2 + wallThickness / 2;


const POND = { x: -1.3, z: -9.85, rx: 1.15, rz: 0.55 };

const P = new THREE.Vector3();

/** A repeatable 0..1 jitter. Never random. */
const jit = (i: number, k: number): number => {
  const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

export function MarketLife() {
  return (
    <group>
      <Pond />
      <Skater i={0} coat="#b84a5c" hat="#f0e6d2" />
      <Skater i={1} coat="#3a8a8f" hat="#e8c25a" />
      <Shopper offset={0} coat="#8a6ab8" hat="#f0e6d2" />
      <Shopper offset={-1.6 / MARKET_ROUTE.total} coat="#3a8a8f" hat="#b84a5c" />
      <Shopper offset={0.42} coat="#b84a5c" hat="#e8c25a" />
      <Chase />
      <Snowfall color="#f4f7ff" speed={0.28} />
    </group>
  );
}

/** The frozen pond: a pale oval of ice with a snowy bank, flat in the far band. */
function Pond() {
  return (
    <group position={[POND.x, -0.08, POND.z]}>
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[POND.rx + 0.18, POND.rz + 0.16, 1]}>
        <circleGeometry args={[1, 28]} />
        <meshStandardMaterial color="#e4ecf6" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[POND.rx, POND.rz, 1]}>
        <circleGeometry args={[1, 28]} />
        <meshStandardMaterial color="#b9d0e8" roughness={0.15} metalness={0.1} />
      </mesh>
      {/* Skate tracks scored in the ice. */}
      {[0, 1, 2].map((k) => (
        <mesh key={k} position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, k * 0.5]} scale={[POND.rx * (0.7 - k * 0.15), POND.rz * (0.7 - k * 0.12), 1]}>
          <ringGeometry args={[0.98, 1, 32]} />
          <meshBasicMaterial color="#dfe9f4" transparent opacity={0.6} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * A skater: a small figure in a coat and bobble hat, scarf streaming,
 * gliding round the pond in a figure of eight, leaning into the turns.
 */
function Skater({ i, coat, hat }: { i: number; coat: string; hat: string }) {
  const body = useRef<THREE.Group | null>(null);
  const tick = useMemo(
    () => (t: number) => {
      const g = body.current;
      if (!g) return;
      const s = t * 0.55 + i * Math.PI;
      // A figure of eight that fits the oval.
      const x = Math.sin(s) * POND.rx * 0.7;
      const z = Math.sin(2 * s) * POND.rz * 0.6;
      const dx = Math.cos(s) * POND.rx * 0.7;
      const dz = 2 * Math.cos(2 * s) * POND.rz * 0.6;
      g.position.set(POND.x + x, -0.075, POND.z + z);
      g.rotation.set(0, Math.atan2(dx, dz), Math.sin(2 * s) * 0.18);
    },
    [i],
  );
  useSceneryTick(tick);
  // In place from the first frame, not at the origin until the first tick.
  useLayoutEffect(() => tick(0), [tick]);
  return (
    <group ref={body} scale={0.9}>
      <mesh position={[0, 0.2, 0]}>
        <capsuleGeometry args={[0.07, 0.16, 4, 8]} />
        <meshStandardMaterial color={coat} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.38, 0]}>
        <sphereGeometry args={[0.065, 8, 6]} />
        <meshStandardMaterial color="#e8c4a0" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.45, 0]}>
        <coneGeometry args={[0.07, 0.12, 8]} />
        <meshStandardMaterial color={hat} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.52, 0]}>
        <sphereGeometry args={[0.03, 6, 5]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      </mesh>
      {/* A scarf trailing behind. */}
      <mesh position={[0, 0.32, -0.1]} rotation={[0.5, 0, 0]}>
        <boxGeometry args={[0.05, 0.02, 0.18]} />
        <meshStandardMaterial color={hat} roughness={0.9} />
      </mesh>
      {/* Blades. */}
      {[-0.03, 0.03].map((lx) => (
        <mesh key={lx} position={[lx, 0.02, 0]}>
          <boxGeometry args={[0.012, 0.03, 0.12]} />
          <meshStandardMaterial color="#c8d0dc" roughness={0.3} metalness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

/** A shopper in a coat and bobble hat with a parcel under one arm, strolling round the stalls. */
function Shopper({ offset, coat, hat }: { offset: number; coat: string; hat: string }) {
  const body = useRef<THREE.Group | null>(null);
  const tick = useMemo(
    () => (t: number) => {
      const g = body.current;
      if (!g) return;
      const heading = alongRoute(MARKET_ROUTE, (t * 0.22) / MARKET_ROUTE.total + offset, P);
      const step = t * 3.0 + offset * 40;
      g.position.set(P.x, Math.abs(Math.sin(step)) * 0.02, P.z);
      g.rotation.set(0, heading, Math.sin(step) * 0.04);
    },
    [offset],
  );
  useSceneryTick(tick);
  // In place from the first frame, not at the origin until the first tick.
  useLayoutEffect(() => tick(0), [tick]);
  return (
    <group ref={body} scale={1.2}>
      <mesh position={[0, 0.2, 0]}>
        <capsuleGeometry args={[0.08, 0.18, 4, 8]} />
        <meshStandardMaterial color={coat} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.41, 0]}>
        <sphereGeometry args={[0.07, 8, 6]} />
        <meshStandardMaterial color="#e8c4a0" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.49, 0]}>
        <coneGeometry args={[0.075, 0.12, 8]} />
        <meshStandardMaterial color={hat} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.56, 0]}>
        <sphereGeometry args={[0.03, 6, 5]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      </mesh>
      <mesh position={[0.11, 0.2, 0.02]}>
        <boxGeometry args={[0.1, 0.1, 0.1]} />
        <meshStandardMaterial color="#b84a5c" roughness={0.6} />
      </mesh>
      <mesh position={[0.11, 0.2, 0.02]}>
        <boxGeometry args={[0.105, 0.105, 0.025]} />
        <meshStandardMaterial color="#e8c25a" roughness={0.4} metalness={0.4} />
      </mesh>
      {[-0.045, 0.045].map((lx) => (
        <mesh key={lx} position={[lx, 0.05, 0]}>
          <boxGeometry args={[0.05, 0.1, 0.06]} />
          <meshStandardMaterial color="#3a2f2a" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * The lights chasing: bright halos over the wall tops whose size swells
 * in a slow wave travelling round the square, one instanced mesh. The
 * bulbs themselves are the wall's (storeBoards.tsx); these ride a
 * little above them.
 */
const CHASE = 56;

function Chase() {
  const mesh = useRef<THREE.InstancedMesh | null>(null);
  const spots = useMemo(() => {
    const out: [number, number][] = [];
    const perimeter = 2 * (2 * CX) + 2 * (2 * CZ);
    for (let i = 0; i < CHASE; i++) {
      let d = ((i + 0.5) / CHASE) * perimeter;
      if (d < 2 * CZ) out.push([CX, -CZ + d]);
      else if ((d -= 2 * CZ) < 2 * CX) out.push([CX - d, CZ]);
      else if ((d -= 2 * CX) < 2 * CZ) out.push([-CX, CZ - d]);
      else out.push([-CX + (d - 2 * CZ), -CZ]);
    }
    return out;
  }, []);
  const o = useMemo(() => new THREE.Object3D(), []);
  const tick = useMemo(
    () => (t: number) => {
      const m = mesh.current;
      if (!m) return;
      for (let i = 0; i < CHASE; i++) {
        const [x, z] = spots[i];
        const wave = 0.5 + 0.5 * Math.sin(t * 1.6 - (i / CHASE) * Math.PI * 6);
        const s = 0.12 + wave * 0.32;
        o.position.set(x, wallHeight + 0.78, z);
        o.rotation.set(-Math.PI / 2, 0, 0);
        o.scale.setScalar(s);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
      }
      m.instanceMatrix.needsUpdate = true;
    },
    [spots, o],
  );
  useSceneryTick(tick);
  // In place from the first frame, not at the origin until the first tick.
  useLayoutEffect(() => tick(0), [tick]);
  const glow = useMemo(() => {
    const size = 16;
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = Math.hypot(x - 7.5, y - 7.5) / 7.5;
        const a = Math.max(0, 1 - d);
        const i = (y * size + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = 255;
        data[i + 3] = Math.round(a * a * 255);
      }
    }
    const tex = new THREE.DataTexture(data, size, size);
    tex.needsUpdate = true;
    return tex;
  }, []);
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, CHASE]} frustumCulled={false} renderOrder={3}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color="#ffd27a" map={glow} transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} />
    </instancedMesh>
  );
}
