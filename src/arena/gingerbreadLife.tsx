import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { TUNING } from '../game/tuning';
import { track } from './boardLife';
import { useSceneryTick } from './sceneryClock';
import { Snowfall } from './snowfall';

/**
 * The Gingerbread Village's life, Season 2 of the pass, Sugar & Snow
 * (8 Nov 2026): a little train of sweets running round the village on
 * a track outside the walls, gingerbread people waving from the corner
 * cottages' doors, smoke curling from the cottage chimneys, and snow
 * falling gently (snowfall.tsx).
 *
 * The train runs the loop the Toy Room's train does (boardLife.tsx
 * `track`): down one side, behind the jail, up the other and across the
 * front between the near wall and the landing pads, outside the props
 * at x ±3.05. Everything moves on a scenery tick that allocates nothing
 * (sceneryClock.ts), and nothing here is ever over the tray.
 */

const { innerWidth, innerDepth, wallThickness, wallHeight } = TUNING.tray;
/** The corner cottages stand on the wall's corners. */
const CX = innerWidth / 2 + wallThickness / 2;
const CZ = innerDepth / 2 + wallThickness / 2;

const TRACK_HALF = 3.72;
const TRACK_FAR = -9.4;
const TRACK_NEAR = 5.55;
const TRACK_R = 0.55;
const LAP = 2 * (2 * (TRACK_HALF - TRACK_R)) + 2 * (TRACK_NEAR - TRACK_FAR - 2 * TRACK_R) + 2 * Math.PI * TRACK_R;

const P = new THREE.Vector3();
const SWEETS = ['#f2a4c6', '#a6e3cc', '#f5df96', '#c9a6e8'];

export function GingerbreadLife() {
  return (
    <group>
      <SweetTrain />
      {/* A gingerbread person at the door of each far cottage, waving. */}
      <GingerPerson x={-CX - 0.62} z={-CZ + 0.1} i={0} />
      <GingerPerson x={CX + 0.62} z={-CZ + 0.1} i={1} />
      {/* Smoke from the four cottage chimneys (the chimney is at (+0.2, -0.2) of each). */}
      {([
        [-CX + 0.2, -CZ - 0.2],
        [CX + 0.2, -CZ - 0.2],
        [-CX + 0.2, CZ - 0.2],
        [CX + 0.2, CZ - 0.2],
      ] as const).map(([x, z], i) => (
        <Smoke key={i} x={x} z={z} i={i} />
      ))}
      <Snowfall />
    </group>
  );
}

/** A repeatable 0..1 jitter. Never random. */
const jit = (i: number, k: number): number => {
  const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * The train: a gingerbread engine with an icing roof and a chimney
 * puffing sugar, and three wagons of sweets behind it, each following
 * the track its own distance back so the train bends round the
 * corners. The track is a ring of icing sleepers with gingerbread rails
 * along the straights.
 */
function SweetTrain() {
  const cars = useRef<(THREE.Group | null)[]>([]);
  const puff = useRef<THREE.Mesh | null>(null);
  const SLEEPERS = 90;
  const lay = useMemo(
    () => (mesh: THREE.InstancedMesh) => {
      const o = new THREE.Object3D();
      for (let i = 0; i < SLEEPERS; i++) {
        const heading = track(i / SLEEPERS, TRACK_HALF, TRACK_FAR, TRACK_NEAR, TRACK_R, P);
        o.position.set(P.x, 0.012, P.z);
        o.rotation.set(0, heading, 0);
        o.updateMatrix();
        mesh.setMatrixAt(i, o.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
    [],
  );
  const tick = useMemo(
    () => (t: number) => {
      const head = (t * 1.2) / LAP;
      for (let i = 0; i < 4; i++) {
        const g = cars.current[i];
        if (!g) continue;
        const heading = track(head - (i * 0.62) / LAP, TRACK_HALF, TRACK_FAR, TRACK_NEAR, TRACK_R, P);
        g.position.set(P.x, 0.03, P.z);
        g.rotation.set(0, heading, 0);
      }
      const p = puff.current;
      if (p) {
        const c = (((t * 0.9) % 1) + 1) % 1;
        p.position.y = 0.46 + c * 0.35;
        const sc = 0.05 + c * 0.1;
        p.scale.set(sc, sc, sc);
        (p.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - c);
      }
    },
    [],
  );
  useSceneryTick(tick);
  // In place from the first frame, not at the origin until the first tick.
  useLayoutEffect(() => tick(0), [tick]);
  const Wagon = ({ i, sweet }: { i: number; sweet: string }) => (
    <group ref={(g) => { cars.current[i] = g; }}>
      <mesh position={[0, 0.11, 0]}>
        <boxGeometry args={[0.3, 0.16, 0.5]} />
        <meshStandardMaterial color="#9a5a2a" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.195, 0]}>
        <boxGeometry args={[0.32, 0.03, 0.52]} />
        <meshStandardMaterial color="#fff8f0" roughness={0.55} />
      </mesh>
      {/* The load: gumdrops heaped in the wagon. */}
      {[-0.13, 0.0, 0.13].map((z, k) => (
        <mesh key={z} position={[(k - 1) * 0.06, 0.26, z]} scale={[1, 0.75, 1]}>
          <sphereGeometry args={[0.07, 8, 6]} />
          <meshStandardMaterial color={k === 1 ? sweet : SWEETS[(i + k) % SWEETS.length]} roughness={0.4} />
        </mesh>
      ))}
      {[-0.16, 0.16].map((wx) =>
        [-0.16, 0.16].map((wz) => (
          <mesh key={`${wx}${wz}`} position={[wx, 0.06, wz]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.055, 0.055, 0.03, 10]} />
            <meshStandardMaterial color="#fff8f0" roughness={0.6} />
          </mesh>
        )),
      )}
    </group>
  );
  return (
    <group>
      <instancedMesh ref={(m) => { if (m) lay(m); }} args={[undefined, undefined, SLEEPERS]} frustumCulled={false}>
        <boxGeometry args={[0.38, 0.02, 0.07]} />
        <meshStandardMaterial color="#fff8f0" roughness={0.6} />
      </instancedMesh>
      {[-TRACK_HALF, TRACK_HALF].map((x) =>
        [-0.13, 0.13].map((off) => (
          <mesh key={`${x}${off}`} position={[x + off, 0.03, (TRACK_FAR + TRACK_NEAR) / 2]}>
            <boxGeometry args={[0.03, 0.02, TRACK_NEAR - TRACK_FAR - 2 * TRACK_R]} />
            <meshStandardMaterial color="#7e4620" roughness={0.7} />
          </mesh>
        )),
      )}
      {[TRACK_FAR, TRACK_NEAR].map((z) =>
        [-0.13, 0.13].map((off) => (
          <mesh key={`${z}${off}`} position={[0, 0.03, z + off]}>
            <boxGeometry args={[2 * (TRACK_HALF - TRACK_R), 0.02, 0.03]} />
            <meshStandardMaterial color="#7e4620" roughness={0.7} />
          </mesh>
        )),
      )}
      {/* The engine: a gingerbread boiler, an iced cab, a chimney puffing sugar. */}
      <group ref={(g) => { cars.current[0] = g; }}>
        <mesh position={[0, 0.16, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.13, 0.13, 0.4, 12]} />
          <meshStandardMaterial color="#9a5a2a" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.2, -0.17]}>
          <boxGeometry args={[0.3, 0.3, 0.22]} />
          <meshStandardMaterial color="#a8662f" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.37, -0.17]}>
          <boxGeometry args={[0.34, 0.04, 0.26]} />
          <meshStandardMaterial color="#fff8f0" roughness={0.55} />
        </mesh>
        <mesh position={[0, 0.17, -0.06]}>
          <boxGeometry args={[0.2, 0.12, 0.02]} />
          <meshBasicMaterial color="#ffd98a" />
        </mesh>
        <mesh position={[0, 0.36, 0.18]}>
          <cylinderGeometry args={[0.04, 0.05, 0.16, 8]} />
          <meshStandardMaterial color="#6e3c14" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.1, 0.3]}>
          <boxGeometry args={[0.3, 0.1, 0.06]} />
          <meshStandardMaterial color="#f2a4c6" roughness={0.5} />
        </mesh>
        <mesh ref={puff} position={[0, 0.5, 0.18]}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.8} depthWrite={false} />
        </mesh>
        {[-0.16, 0.16].map((wx) =>
          [-0.15, 0.15].map((wz) => (
            <mesh key={`${wx}${wz}`} position={[wx, 0.06, wz]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.06, 0.06, 0.03, 10]} />
              <meshStandardMaterial color="#fff8f0" roughness={0.6} />
            </mesh>
          )),
        )}
      </group>
      <Wagon i={1} sweet="#f2a4c6" />
      <Wagon i={2} sweet="#a6e3cc" />
      <Wagon i={3} sweet="#f5df96" />
    </group>
  );
}

/** A gingerbread person: a flat brown figure with icing buttons, one arm waving. */
function GingerPerson({ x, z, i }: { x: number; z: number; i: number }) {
  const arm = useRef<THREE.Group | null>(null);
  const body = useRef<THREE.Group | null>(null);
  const tick = useMemo(
    () => (t: number) => {
      if (arm.current) arm.current.rotation.z = -0.7 + Math.sin(t * 4 + i * 2) * 0.5;
      if (body.current) body.current.rotation.z = Math.sin(t * 4 + i * 2) * 0.03;
    },
    [i],
  );
  useSceneryTick(tick);
  // In place from the first frame, not at the origin until the first tick.
  useLayoutEffect(() => tick(0), [tick]);
  const side = x < 0 ? 1 : -1;
  return (
    <group position={[x, 0, z]} rotation={[0, side * 0.6, 0]} scale={1.15}>
      <group ref={body}>
        <mesh position={[0, 0.25, 0]}>
          <boxGeometry args={[0.2, 0.3, 0.08]} />
          <meshStandardMaterial color="#a8662f" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.5, 0]}>
          <sphereGeometry args={[0.1, 10, 8]} />
          <meshStandardMaterial color="#a8662f" roughness={0.85} />
        </mesh>
        {[-0.05, 0.05].map((lx) => (
          <mesh key={lx} position={[lx, 0.06, 0]}>
            <boxGeometry args={[0.07, 0.14, 0.08]} />
            <meshStandardMaterial color="#a8662f" roughness={0.85} />
          </mesh>
        ))}
        {[0.33, 0.24, 0.15].map((y, k) => (
          <mesh key={y} position={[0, y, 0.045]}>
            <sphereGeometry args={[0.022, 6, 5]} />
            <meshStandardMaterial color={SWEETS[k]} roughness={0.4} />
          </mesh>
        ))}
        <mesh position={[0, 0.52, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.035, 0.008, 6, 10, Math.PI]} />
          <meshStandardMaterial color="#fff8f0" roughness={0.55} />
        </mesh>
        {/* The still arm, and the waving one. */}
        <mesh position={[-0.14, 0.3, 0]} rotation={[0, 0, 0.5]}>
          <boxGeometry args={[0.07, 0.2, 0.08]} />
          <meshStandardMaterial color="#a8662f" roughness={0.85} />
        </mesh>
        <group ref={arm} position={[0.12, 0.38, 0]}>
          <mesh position={[0.04, 0.09, 0]}>
            <boxGeometry args={[0.07, 0.2, 0.08]} />
            <meshStandardMaterial color="#a8662f" roughness={0.85} />
          </mesh>
          <mesh position={[0.04, 0.2, 0]}>
            <sphereGeometry args={[0.04, 8, 6]} />
            <meshStandardMaterial color="#fff8f0" roughness={0.55} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/** Three puffs of smoke rising from a chimney in turn, each fading as it climbs. */
function Smoke({ x, z, i }: { x: number; z: number; i: number }) {
  const puffs = useRef<(THREE.Mesh | null)[]>([]);
  const tick = useMemo(
    () => (t: number) => {
      for (let k = 0; k < 3; k++) {
        const m = puffs.current[k];
        if (!m) continue;
        const c = (((t * 0.35 + k / 3 + jit(i, 1)) % 1) + 1) % 1;
        m.position.set(x + Math.sin(t * 0.7 + k) * 0.08 * c, wallHeight + 1.3 + c * 0.9, z + Math.cos(t * 0.5 + k) * 0.06 * c);
        const sc = 0.06 + c * 0.14;
        m.scale.set(sc, sc, sc);
        (m.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - c) * Math.min(1, c * 6);
      }
    },
    [x, z, i],
  );
  useSceneryTick(tick);
  // In place from the first frame, not at the origin until the first tick.
  useLayoutEffect(() => tick(0), [tick]);
  return (
    <group>
      {[0, 1, 2].map((k) => (
        <mesh key={k} ref={(m) => { puffs.current[k] = m; }}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshBasicMaterial color="#f4f4f8" transparent opacity={0.5} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
