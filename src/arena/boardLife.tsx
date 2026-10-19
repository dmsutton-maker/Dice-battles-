import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useSceneryTick } from './sceneryClock';

/**
 * Creatures that live on the store boards, 19 Oct 2026.
 *
 * David: "add swimming around the reef board. Add a shark swimming under
 * the pirate boat. Add helicopters flying around the city board. Add
 * farm animals wondering around the farm board. Show surfers and sun
 * bathers on the beach board moving around. Show a toy train going
 * around the toy board."
 *
 * Every one of these is built once and MOVED by a scenery tick (see
 * sceneryClock.ts): the tick only writes numbers into objects that
 * already exist, so a frame allocates nothing. They move whenever the
 * board is drawing — during a battle and in a preview — and hold still
 * on the menus, like the water and the torches.
 *
 * They keep to the ground OUTSIDE the tray: the two strips beside it and
 * the strip beyond the far wall. Nothing crosses the play surface, where
 * it could be mistaken for a die or hide one. The boards' own props
 * stand along x = ±3.4, so anything that walks keeps to the outer edge
 * of a strip, around x = ±3.9, and passes behind them.
 */

/** Every path writes into these; nothing per frame is new. */
const P = new THREE.Vector3();

/**
 * A point on a stadium-shaped loop round the tray: straight runs down
 * both sides at x = ±half, joined by semicircles at zFar and zNear.
 * `u` in 0..1 goes once round, anticlockwise seen from above. Heading
 * is returned as the angle the mover faces, in radians about +y.
 */
function loop(u: number, half: number, zFar: number, zNear: number, out: THREE.Vector3): number {
  const straight = zNear - zFar;
  const arc = Math.PI * half;
  const total = 2 * straight + 2 * arc;
  let d = ((u % 1) + 1) % 1 * total;
  // Right side, heading toward zFar (negative z).
  if (d < straight) {
    out.set(half, 0, zNear - d);
    return Math.PI / 2;
  }
  d -= straight;
  // Far arc, from the right round to the left.
  if (d < arc) {
    const a = d / half;
    out.set(Math.cos(a) * half, 0, zFar - Math.sin(a) * half);
    return Math.PI / 2 + a;
  }
  d -= arc;
  // Left side, heading toward zNear.
  if (d < straight) {
    out.set(-half, 0, zFar + d);
    return -Math.PI / 2;
  }
  d -= straight;
  // Near arc, from the left round to the right.
  const a = d / half;
  out.set(-Math.cos(a) * half, 0, zNear + Math.sin(a) * half);
  return -Math.PI / 2 + a;
}

/** A repeatable 0..1 jitter for creature `i`, channel `k`. Never random. */
const jit = (i: number, k: number): number => {
  const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/* ── Coral Reef: fish ──────────────────────────────────────────────── */

const FISH_TONES = ['#ff8a3c', '#ffd23c', '#3ca8ff', '#ff5c8a', '#7be06a', '#ffffff', '#ff8a3c', '#a070ff'];

/**
 * Eight little fish, each circling its own narrow oval: three in each
 * side strip, two along the far strip, at different heights and speeds
 * so they never read as one formation. A fish points where it is going
 * and its tail beats as it swims.
 */
export function ReefFish() {
  const fish = useRef<(THREE.Group | null)[]>([]);
  const tails = useRef<(THREE.Mesh | null)[]>([]);
  const tick = useMemo(
    () => (t: number) => {
      for (let i = 0; i < 8; i++) {
        const g = fish.current[i];
        const tail = tails.current[i];
        if (!g) continue;
        // Which strip, and the oval inside it.
        let cx: number;
        let cz: number;
        let rx: number;
        let rz: number;
        if (i < 3) { cx = -3.75; cz = -3.2 + i * 2.6; rx = 0.32; rz = 1.3 + jit(i, 1) * 0.6; }
        else if (i < 6) { cx = 3.75; cz = -5.2 + (i - 3) * 2.8; rx = 0.32; rz = 1.3 + jit(i, 1) * 0.6; }
        else { cx = -1.6 + (i - 6) * 3.2; cz = -9.1; rx = 1.4; rz = 0.35; }
        const speed = 0.16 + jit(i, 2) * 0.1;
        const dir = i % 2 === 0 ? 1 : -1;
        const a = (t * speed + jit(i, 3)) * Math.PI * 2 * dir;
        const x = cx + Math.cos(a) * rx;
        const z = cz + Math.sin(a) * rz;
        // The tangent of the oval is where the nose points.
        const dx = -Math.sin(a) * rx * dir;
        const dz = Math.cos(a) * rz * dir;
        g.position.set(x, 0.28 + jit(i, 4) * 0.25 + Math.sin(t * 2.1 + i) * 0.04, z);
        g.rotation.set(0, Math.atan2(dx, dz), 0);
        if (tail) tail.rotation.y = Math.sin(t * 9 + i * 1.7) * 0.5;
      }
    },
    [],
  );
  useSceneryTick(tick);
  return (
    <group>
      {FISH_TONES.map((tone, i) => (
        <group key={i} ref={(g) => { fish.current[i] = g; }}>
          {/*
            Built for the game's camera, which looks almost straight
            down: the body is wide and flat so its shape reads from
            above, with a dark stripe down the back and a forked tail.
          */}
          <mesh scale={[0.17, 0.08, 0.3]}>
            <sphereGeometry args={[1, 12, 8]} />
            <meshStandardMaterial color={tone} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.05, 0.02]} scale={[0.05, 0.05, 0.2]}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshStandardMaterial color={i % 3 === 0 ? '#ffffff' : '#20304a'} roughness={0.5} />
          </mesh>
          {/* An eye either side of the nose. */}
          <mesh position={[0.1, 0.03, 0.2]} scale={[0.035, 0.035, 0.035]}>
            <sphereGeometry args={[1, 6, 5]} />
            <meshStandardMaterial color="#111111" roughness={0.4} />
          </mesh>
          <mesh position={[-0.1, 0.03, 0.2]} scale={[0.035, 0.035, 0.035]}>
            <sphereGeometry args={[1, 6, 5]} />
            <meshStandardMaterial color="#111111" roughness={0.4} />
          </mesh>
          {/* The tail, hinged at the back of the body: a flat fork. */}
          <mesh ref={(m) => { tails.current[i] = m; }} position={[0, 0, -0.28]}>
            <mesh position={[0, 0, -0.1]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.5, 1, 1]}>
              <coneGeometry args={[0.1, 0.22, 3]} />
              <meshStandardMaterial color={tone} roughness={0.5} side={THREE.DoubleSide} />
            </mesh>
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ── Pirate Cove: the shark ────────────────────────────────────────── */

/**
 * One shark, the way a shark is seen from a deck: a fin cutting the
 * water with a dark shape under it, circling the ship. Down one side,
 * round the bow, down the other — and at the stern it dives under the
 * hull and comes up on the far side, which is the "under the pirate
 * boat" David asked for. While it is under the hull it is simply not
 * drawn: the deck is the tray, and a fin poking up through the planks
 * would be a different request.
 */
export function CoveShark() {
  const shark = useRef<THREE.Group | null>(null);
  const tick = useMemo(
    () => (t: number) => {
      const g = shark.current;
      if (!g) return;
      // A loop that rounds the bow inside the frame — the far arc peaks
      // at z = -10 — and dips under the stern at the near end.
      const heading = loop(t * 0.05, 3.6, -6.4, 4.4, P);
      // Under the hull: the near arc's middle, where |x| is small.
      const under = Math.abs(P.x) < 2.95 && P.z > 3.5;
      g.visible = !under;
      // The cove's sea is painted on the ground at y = 0, so the shark
      // rides just above it, not in a water sheet below it.
      g.position.set(P.x, 0.02, P.z);
      g.rotation.set(0, heading, 0);
    },
    [],
  );
  useSceneryTick(tick);
  return (
    <group ref={shark}>
      {/*
        Seen from above, as the camera sees it: a long dark body just
        under the surface, two pectoral fins, a tail, and a paler back
        where the dorsal fin breaks the water, with foam off it.
      */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.42, 1.25, 1]}>
        <circleGeometry args={[1, 18]} />
        <meshStandardMaterial color="#2c4a58" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.03, 0.25]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.33, 0.45, 1]}>
        <circleGeometry args={[1, 14]} />
        <meshStandardMaterial color="#3d6070" roughness={0.6} />
      </mesh>
      {/* Pectoral fins, swept back. */}
      <mesh position={[0.45, 0.02, 0.1]} rotation={[-Math.PI / 2, 0, -0.9]} scale={[0.7, 1, 1]}>
        <coneGeometry args={[0.2, 0.55, 3]} />
        <meshStandardMaterial color="#2c4a58" roughness={0.6} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[-0.45, 0.02, 0.1]} rotation={[-Math.PI / 2, 0, 0.9]} scale={[0.7, 1, 1]}>
        <coneGeometry args={[0.2, 0.55, 3]} />
        <meshStandardMaterial color="#2c4a58" roughness={0.6} side={THREE.DoubleSide} />
      </mesh>
      {/* The tail: a crescent, as two lobes. */}
      <mesh position={[0.16, 0.02, -1.35]} rotation={[-Math.PI / 2, 0, 0.5]} scale={[0.6, 1, 1]}>
        <coneGeometry args={[0.16, 0.5, 3]} />
        <meshStandardMaterial color="#2c4a58" roughness={0.6} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[-0.16, 0.02, -1.35]} rotation={[-Math.PI / 2, 0, -0.5]} scale={[0.6, 1, 1]}>
        <coneGeometry args={[0.16, 0.5, 3]} />
        <meshStandardMaterial color="#2c4a58" roughness={0.6} side={THREE.DoubleSide} />
      </mesh>
      {/* The dorsal fin breaking the surface, and its wake. */}
      <mesh position={[0, 0.2, -0.1]} rotation={[0, Math.PI / 2, 0]}>
        <coneGeometry args={[0.1, 0.3, 3]} />
        <meshStandardMaterial color="#5a7886" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.0, -0.6]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.25, 1.6, 1]}>
        <circleGeometry args={[0.3, 10]} />
        <meshBasicMaterial color="#eef8f6" transparent opacity={0.45} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ── Rooftop City: helicopters ─────────────────────────────────────── */

/**
 * Two helicopters circling the rooftop, well above the neighbouring
 * towers, one wider and higher than the other. From the camera a
 * helicopter is its rotor: a blurred disc with two blades turning in
 * it, over a small body with a tail boom, a tail rotor and a red light
 * that blinks. Each banks a little into its turn.
 */
export function CityHelicopters() {
  const craft = useRef<(THREE.Group | null)[]>([]);
  const rotors = useRef<(THREE.Group | null)[]>([]);
  const lights = useRef<(THREE.Mesh | null)[]>([]);
  const tick = useMemo(
    () => (t: number) => {
      for (let i = 0; i < 2; i++) {
        const g = craft.current[i];
        if (!g) continue;
        const wide = i === 1;
        const heading = loop(t * (wide ? 0.028 : 0.036) + i * 0.5, wide ? 4.0 : 3.6, wide ? -8.2 : -7.4, 4.6, P);
        g.position.set(P.x, (wide ? 3.3 : 2.7) + Math.sin(t * 0.9 + i * 2) * 0.12, P.z);
        // Nose along the path, banked into the turn.
        g.rotation.set(0, heading, 0.12);
        const rotor = rotors.current[i];
        if (rotor) rotor.rotation.y = t * 38 + i;
        const light = lights.current[i];
        if (light) light.visible = Math.sin(t * 5 + i * 2) > 0.3;
      }
    },
    [],
  );
  useSceneryTick(tick);
  return (
    <group>
      {[0, 1].map((i) => (
        <group key={i} ref={(g) => { craft.current[i] = g; }} scale={1.8}>
          {/*
            Big and bright on purpose: against the night city a small
            dark helicopter was a grey smudge. These are the size a news
            helicopter would look from a rooftop, in white and yellow.
          */}
          {/* Body: a short capsule, nose toward +z. */}
          <mesh scale={[0.22, 0.18, 0.42]}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshStandardMaterial color={i === 0 ? '#f4f1ea' : '#ffcf3c'} roughness={0.5} metalness={0.2} />
          </mesh>
          {/* A stripe along the body. */}
          <mesh position={[0, 0.1, -0.02]} scale={[0.24, 0.05, 0.36]}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshStandardMaterial color={i === 0 ? '#e0452f' : '#243a66'} roughness={0.5} />
          </mesh>
          {/* The cockpit glass. */}
          <mesh position={[0, 0.06, 0.2]} scale={[0.16, 0.12, 0.2]}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshStandardMaterial color="#8fd0f0" roughness={0.2} metalness={0.3} />
          </mesh>
          {/* The tail boom and its rotor. */}
          <mesh position={[0, 0.02, -0.5]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.035, 0.06, 0.6, 6]} />
            <meshStandardMaterial color={i === 0 ? '#f4f1ea' : '#ffcf3c'} roughness={0.5} metalness={0.2} />
          </mesh>
          <mesh position={[0.05, 0.08, -0.8]} rotation={[0, Math.PI / 2, 0]}>
            <circleGeometry args={[0.1, 10]} />
            <meshBasicMaterial color="#555b66" transparent opacity={0.5} side={THREE.DoubleSide} />
          </mesh>
          {/* The main rotor: a blurred disc and two blades, turning. */}
          <group ref={(g) => { rotors.current[i] = g; }} position={[0, 0.2, 0]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.62, 24]} />
              <meshBasicMaterial color="#c9cfdb" transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
            <mesh>
              <boxGeometry args={[1.24, 0.015, 0.07]} />
              <meshBasicMaterial color="#e6e9f0" transparent opacity={0.85} />
            </mesh>
            <mesh rotation={[0, Math.PI / 2, 0]}>
              <boxGeometry args={[1.24, 0.015, 0.07]} />
              <meshBasicMaterial color="#e6e9f0" transparent opacity={0.85} />
            </mesh>
          </group>
          {/* Skids. */}
          <mesh position={[0.14, -0.16, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 0.5, 5]} />
            <meshStandardMaterial color="#2a2d35" roughness={0.6} />
          </mesh>
          <mesh position={[-0.14, -0.16, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 0.5, 5]} />
            <meshStandardMaterial color="#2a2d35" roughness={0.6} />
          </mesh>
          {/* The blinking light on the tail. */}
          <mesh ref={(m) => { lights.current[i] = m; }} position={[0, 0.1, -0.78]}>
            <sphereGeometry args={[0.045, 8, 6]} />
            <meshBasicMaterial color="#ff4a4a" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ── Sunny Farm: animals ───────────────────────────────────────────── */

/**
 * Where each animal lives and how far it wanders: a home on the grass,
 * a reach along the strip and across it. Cows on the far strip behind
 * the barn, sheep on the outer edge of the side strips, chickens
 * pecking about between them. Every one keeps to the outside of its
 * strip, behind the board's own trees and bales.
 */
const FARM_ANIMALS: readonly { kind: 'cow' | 'sheep' | 'chicken'; x: number; z: number; dx: number; dz: number }[] = [
  // The barn's roof reaches z -9 and a bale stands at the middle of the
  // far strip, so the cows keep to the open grass beyond both.
  { kind: 'cow', x: -2.0, z: -9.85, dx: 0.6, dz: 0.18 },
  { kind: 'cow', x: 2.1, z: -9.8, dx: 0.6, dz: 0.18 },
  { kind: 'sheep', x: -3.95, z: -0.9, dx: 0.12, dz: 1.1 },
  { kind: 'sheep', x: -3.95, z: 2.7, dx: 0.12, dz: 0.9 },
  { kind: 'sheep', x: 3.95, z: 1.3, dx: 0.12, dz: 1.2 },
  { kind: 'chicken', x: 3.95, z: -5.0, dx: 0.1, dz: 0.6 },
  { kind: 'chicken', x: 3.95, z: -7.1, dx: 0.1, dz: 0.5 },
  { kind: 'chicken', x: 0.9, z: -9.75, dx: 0.4, dz: 0.1 },
];

/**
 * Cows, sheep and chickens wandering the farm. Each follows its own
 * slow figure-of-eight inside its patch, which slows to a stop at the
 * turns the way an animal stops to graze, and faces where it is going.
 * Sheep and cows drop their heads to the grass as they slow; chickens
 * bob and dart.
 */
export function FarmAnimals() {
  const bodies = useRef<(THREE.Group | null)[]>([]);
  const heads = useRef<(THREE.Group | null)[]>([]);
  const tick = useMemo(
    () => (t: number) => {
      for (let i = 0; i < FARM_ANIMALS.length; i++) {
        const g = bodies.current[i];
        if (!g) continue;
        const a = FARM_ANIMALS[i];
        const speed = a.kind === 'chicken' ? 0.09 : a.kind === 'sheep' ? 0.045 : 0.035;
        const p = (t * speed + jit(i, 1)) * Math.PI * 2;
        // A figure of eight along the strip: sin along, sin 2p across.
        const x = a.x + Math.sin(p) * a.dx + Math.sin(2 * p) * a.dz * 0.15 * (a.dx > a.dz ? 1 : 0);
        const z = a.z + (a.dx > a.dz ? Math.sin(2 * p) * a.dz : Math.sin(p) * a.dz);
        const vx = a.dx > a.dz ? Math.cos(p) * a.dx : Math.cos(2 * p) * 2 * a.dx * 0.5;
        const vz = a.dx > a.dz ? Math.cos(2 * p) * 2 * a.dz : Math.cos(p) * a.dz;
        const pace = Math.hypot(vx, vz);
        g.position.set(x, 0, z);
        if (pace > 0.02) g.rotation.set(0, Math.atan2(vx, vz), 0);
        const head = heads.current[i];
        if (head) {
          if (a.kind === 'chicken') head.position.y = 0.16 + Math.abs(Math.sin(t * 7 + i)) * 0.03;
          else head.rotation.x = 0.1 + Math.max(0, 0.35 - pace * 3) * 1.8;
        }
      }
    },
    [],
  );
  useSceneryTick(tick);
  return (
    <group>
      {FARM_ANIMALS.map((a, i) => (
        <group key={i} ref={(g) => { bodies.current[i] = g; }}>
          {a.kind === 'cow' && (
            <>
              <mesh position={[0, 0.22, 0]}>
                <boxGeometry args={[0.3, 0.26, 0.56]} />
                <meshStandardMaterial color="#f4f1ea" roughness={0.8} />
              </mesh>
              {/* Black patches, where the camera sees them: on the back. */}
              <mesh position={[0.07, 0.36, 0.12]}>
                <boxGeometry args={[0.14, 0.01, 0.2]} />
                <meshStandardMaterial color="#2b2622" roughness={0.8} />
              </mesh>
              <mesh position={[-0.08, 0.36, -0.14]}>
                <boxGeometry args={[0.12, 0.01, 0.16]} />
                <meshStandardMaterial color="#2b2622" roughness={0.8} />
              </mesh>
              <group ref={(g) => { heads.current[i] = g; }} position={[0, 0.3, 0.3]}>
                <mesh position={[0, 0, 0.1]}>
                  <boxGeometry args={[0.18, 0.16, 0.22]} />
                  <meshStandardMaterial color="#f4f1ea" roughness={0.8} />
                </mesh>
                <mesh position={[0, -0.02, 0.22]}>
                  <boxGeometry args={[0.16, 0.08, 0.04]} />
                  <meshStandardMaterial color="#e8a0a8" roughness={0.8} />
                </mesh>
                <mesh position={[0.11, 0.06, 0.02]} rotation={[0, 0, 0.5]}>
                  <boxGeometry args={[0.1, 0.03, 0.06]} />
                  <meshStandardMaterial color="#f4f1ea" roughness={0.8} />
                </mesh>
                <mesh position={[-0.11, 0.06, 0.02]} rotation={[0, 0, -0.5]}>
                  <boxGeometry args={[0.1, 0.03, 0.06]} />
                  <meshStandardMaterial color="#f4f1ea" roughness={0.8} />
                </mesh>
              </group>
              {[-0.1, 0.1].map((lx) =>
                [-0.2, 0.2].map((lz) => (
                  <mesh key={`${lx}${lz}`} position={[lx, 0.06, lz]}>
                    <boxGeometry args={[0.07, 0.12, 0.07]} />
                    <meshStandardMaterial color="#2b2622" roughness={0.8} />
                  </mesh>
                )),
              )}
            </>
          )}
          {a.kind === 'sheep' && (
            <>
              <mesh position={[0, 0.2, 0]} scale={[0.2, 0.16, 0.26]}>
                <sphereGeometry args={[1, 10, 8]} />
                <meshStandardMaterial color="#f7f3ea" roughness={1} />
              </mesh>
              {/* Fleece lumps, so it is woolly from above. */}
              {[[0.1, 0.1], [-0.1, 0.08], [0.06, -0.14], [-0.08, -0.12]].map(([fx, fz], k) => (
                <mesh key={k} position={[fx, 0.3, fz]} scale={[0.09, 0.07, 0.09]}>
                  <sphereGeometry args={[1, 8, 6]} />
                  <meshStandardMaterial color="#fbf8f0" roughness={1} />
                </mesh>
              ))}
              <group ref={(g) => { heads.current[i] = g; }} position={[0, 0.24, 0.22]}>
                <mesh position={[0, 0, 0.06]} scale={[0.09, 0.09, 0.13]}>
                  <sphereGeometry args={[1, 8, 6]} />
                  <meshStandardMaterial color="#2b2622" roughness={0.8} />
                </mesh>
              </group>
              {[-0.08, 0.08].map((lx) =>
                [-0.12, 0.12].map((lz) => (
                  <mesh key={`${lx}${lz}`} position={[lx, 0.05, lz]}>
                    <boxGeometry args={[0.05, 0.1, 0.05]} />
                    <meshStandardMaterial color="#2b2622" roughness={0.8} />
                  </mesh>
                )),
              )}
            </>
          )}
          {a.kind === 'chicken' && (
            <>
              <mesh position={[0, 0.1, 0]} scale={[0.09, 0.09, 0.13]}>
                <sphereGeometry args={[1, 8, 6]} />
                <meshStandardMaterial color="#f7f3ea" roughness={0.9} />
              </mesh>
              <group ref={(g) => { heads.current[i] = g; }} position={[0, 0.16, 0.1]}>
                <mesh scale={[0.06, 0.06, 0.07]}>
                  <sphereGeometry args={[1, 8, 6]} />
                  <meshStandardMaterial color="#f7f3ea" roughness={0.9} />
                </mesh>
                <mesh position={[0, 0.06, 0]}>
                  <boxGeometry args={[0.03, 0.05, 0.06]} />
                  <meshStandardMaterial color="#e0452f" roughness={0.8} />
                </mesh>
                <mesh position={[0, 0, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
                  <coneGeometry args={[0.025, 0.06, 4]} />
                  <meshStandardMaterial color="#f2b02a" roughness={0.8} />
                </mesh>
              </group>
              <mesh position={[0, 0.1, -0.13]} rotation={[-0.6, 0, 0]}>
                <coneGeometry args={[0.04, 0.09, 4]} />
                <meshStandardMaterial color="#d9cfb8" roughness={0.9} />
              </mesh>
            </>
          )}
        </group>
      ))}
    </group>
  );
}

/* ── Treasure Beach: surfers and sunbathers ────────────────────────── */

/**
 * Two surfers riding the sea along the top of the frame, two
 * sunbathers on towels on the outer edge of the sand who roll over now
 * and then, and two people strolling the water's edge of each strip.
 * The surfers lean into their turns and trail foam; the strollers bob
 * as they walk and turn round at the end of their beat.
 */
export function BeachLife() {
  const surfers = useRef<(THREE.Group | null)[]>([]);
  const bathers = useRef<(THREE.Group | null)[]>([]);
  const walkers = useRef<(THREE.Group | null)[]>([]);
  const tick = useMemo(
    () => (t: number) => {
      for (let i = 0; i < 2; i++) {
        const s = surfers.current[i];
        if (s) {
          const p = t * (0.22 + i * 0.05) + i * 2.1;
          const x = Math.sin(p) * 2.6;
          const vx = Math.cos(p);
          s.position.set(x, 0.0, -9.75 + i * 0.35 + Math.sin(t * 1.3 + i) * 0.18);
          // Facing along the wave, leaning into the ride.
          s.rotation.set(0, vx >= 0 ? Math.PI / 2 : -Math.PI / 2, 0);
          s.rotation.z = -vx * 0.25;
        }
        const b = bathers.current[i];
        if (b) {
          // Roll over every so often: a smooth half turn, then rest.
          const cycle = ((t * 0.08 + i * 0.5) % 1 + 1) % 1;
          const roll = cycle < 0.12 ? (1 - Math.cos((cycle / 0.12) * Math.PI)) / 2 : 1;
          const side = Math.floor(t * 0.08 + i * 0.5) % 2;
          b.rotation.set(0, 0, (side + roll) * Math.PI);
        }
        const w = walkers.current[i];
        if (w) {
          const side = i === 0 ? -1 : 1;
          const p = t * 0.12 + i * 1.7;
          const z = (i === 0 ? -1.0 : 0.6) + Math.sin(p) * 2.0;
          const vz = Math.cos(p);
          w.position.set(side * 3.95, Math.abs(Math.sin(t * 6 + i)) * 0.02, z);
          w.rotation.set(0, vz >= 0 ? 0 : Math.PI, 0);
        }
      }
    },
    [],
  );
  useSceneryTick(tick);
  const Person = ({ skin, suit, lying = false }: { skin: string; suit: string; lying?: boolean }) =>
    lying ? (
      <group>
        <mesh position={[0, 0.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[0.07, 0.3, 4, 8]} />
          <meshStandardMaterial color={skin} roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.07, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[0.075, 0.12, 4, 8]} />
          <meshStandardMaterial color={suit} roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.07, 0.3]}>
          <sphereGeometry args={[0.07, 8, 6]} />
          <meshStandardMaterial color={skin} roughness={0.8} />
        </mesh>
      </group>
    ) : (
      <group>
        <mesh position={[0, 0.17, 0]}>
          <capsuleGeometry args={[0.06, 0.2, 4, 8]} />
          <meshStandardMaterial color={suit} roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.07, 0]}>
          <cylinderGeometry args={[0.05, 0.06, 0.14, 6]} />
          <meshStandardMaterial color={skin} roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.36, 0]}>
          <sphereGeometry args={[0.075, 8, 6]} />
          <meshStandardMaterial color={skin} roughness={0.8} />
        </mesh>
      </group>
    );
  return (
    <group>
      {/* Surfers: a bright board, a rider, foam off the tail. */}
      {[0, 1].map((i) => (
        <group key={`surf-${i}`} ref={(g) => { surfers.current[i] = g; }}>
          <mesh position={[0, 0.02, 0]}>
            <boxGeometry args={[0.2, 0.03, 0.62]} />
            <meshStandardMaterial color={i === 0 ? '#ff6e6e' : '#ffd21f'} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.036, 0]}>
            <boxGeometry args={[0.03, 0.01, 0.5]} />
            <meshStandardMaterial color="#ffffff" roughness={0.4} />
          </mesh>
          <group position={[0, 0.03, -0.05]} rotation={[0, Math.PI / 2, 0]}>
            <Person skin={i === 0 ? '#c68a5c' : '#8a5a3a'} suit={i === 0 ? '#1f8fd6' : '#2fb88a'} />
          </group>
          <mesh position={[0, -0.01, -0.5]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.5, 1.4, 1]}>
            <circleGeometry args={[0.3, 10]} />
            <meshBasicMaterial color="#fbfaf3" transparent opacity={0.6} depthWrite={false} />
          </mesh>
        </group>
      ))}
      {/* Sunbathers: a striped towel at the top of each sand strip, a person on it. */}
      {[
        { x: -3.95, z: 2.5, a: '#ff6e9e', b: '#ffffff' },
        { x: 3.95, z: -5.3, a: '#1f8fd6', b: '#fff3b0' },
      ].map((tw, i) => (
        <group key={`towel-${i}`} position={[tw.x, 0.01, tw.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.42, 0.8]} />
            <meshStandardMaterial color={tw.a} roughness={0.9} />
          </mesh>
          {[-0.25, 0, 0.25].map((sz) => (
            <mesh key={sz} position={[0, 0.002, sz]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.42, 0.1]} />
              <meshStandardMaterial color={tw.b} roughness={0.9} />
            </mesh>
          ))}
          <group ref={(g) => { bathers.current[i] = g; }} position={[0, 0.0, -0.08]}>
            <Person skin={i === 0 ? '#e0b088' : '#a06a44'} suit={i === 0 ? '#2fb88a' : '#ff6e6e'} lying />
          </group>
        </group>
      ))}
      {/* Strollers along the outer edge of each strip. */}
      {[0, 1].map((i) => (
        <group key={`walk-${i}`} ref={(g) => { walkers.current[i] = g; }}>
          <Person skin={i === 0 ? '#8a5a3a' : '#e0b088'} suit={i === 0 ? '#ffd21f' : '#cc79fc'} />
          {/* A sun hat, seen from above as a disc. */}
          <mesh position={[0, 0.43, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.13, 12]} />
            <meshStandardMaterial color={i === 0 ? '#f4e2b0' : '#ffffff'} roughness={0.9} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ── Toy Room: the train ───────────────────────────────────────────── */

/**
 * A point on a rounded rectangle round the tray: straights at x = ±half
 * and at zFar and zNear, joined by quarter circles of radius `r`. The
 * near straight runs between the tray's near wall and the retreat pads.
 */
function track(u: number, half: number, zFar: number, zNear: number, r: number, out: THREE.Vector3): number {
  const sx = 2 * (half - r);
  const sz = zNear - zFar - 2 * r;
  const q = (Math.PI / 2) * r;
  const total = 2 * sx + 2 * sz + 4 * q;
  let d = ((u % 1) + 1) % 1 * total;
  // Right side, toward zFar.
  if (d < sz) { out.set(half, 0, zNear - r - d); return Math.PI; }
  d -= sz;
  if (d < q) { const a = d / r; out.set(half - r + Math.cos(a) * r, 0, zFar + r - Math.sin(a) * r); return Math.PI + a; }
  d -= q;
  // Far side, toward -x.
  if (d < sx) { out.set(half - r - d, 0, zFar); return -Math.PI / 2; }
  d -= sx;
  if (d < q) { const a = d / r; out.set(-half + r - Math.sin(a) * r, 0, zFar + r - Math.cos(a) * r); return -Math.PI / 2 + a; }
  d -= q;
  // Left side, toward zNear.
  if (d < sz) { out.set(-half, 0, zFar + r + d); return 0; }
  d -= sz;
  if (d < q) { const a = d / r; out.set(-half + r - Math.cos(a) * r, 0, zNear - r + Math.sin(a) * r); return a; }
  d -= q;
  // Near side, toward +x.
  if (d < sx) { out.set(-half + r + d, 0, zNear); return Math.PI / 2; }
  d -= sx;
  const a = d / r;
  out.set(half - r + Math.sin(a) * r, 0, zNear - r + Math.cos(a) * r);
  return Math.PI / 2 + a;
}

const TRACK_HALF = 3.72;
const TRACK_FAR = -9.4;
const TRACK_NEAR = 5.55;
const TRACK_R = 0.55;

/**
 * A toy train going round the playmat on a loop of track laid on the
 * floorboards: an engine with a boiler, a cab and a chimney puffing,
 * and two carriages behind it, each following the track at its own
 * distance back so the train bends round the corners. The track is
 * sleepers all the way round (one instanced mesh) and rails on the
 * straights.
 */
export function ToyTrain() {
  const cars = useRef<(THREE.Group | null)[]>([]);
  const puff = useRef<THREE.Mesh | null>(null);
  const sleepers = useRef<THREE.InstancedMesh | null>(null);
  const SLEEPERS = 96;
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
      // Path length, for spacing the carriages a fixed distance apart.
      const sx = 2 * (TRACK_HALF - TRACK_R);
      const sz = TRACK_NEAR - TRACK_FAR - 2 * TRACK_R;
      const total = 2 * sx + 2 * sz + 2 * Math.PI * TRACK_R;
      const head = (t * 1.5) / total;
      for (let i = 0; i < 3; i++) {
        const g = cars.current[i];
        if (!g) continue;
        const heading = track(head - (i * 0.66) / total, TRACK_HALF, TRACK_FAR, TRACK_NEAR, TRACK_R, P);
        g.position.set(P.x, 0.03, P.z);
        g.rotation.set(0, heading, 0);
      }
      const p = puff.current;
      if (p) {
        const c = ((t * 0.8) % 1 + 1) % 1;
        p.position.y = 0.42 + c * 0.35;
        const sc = 0.05 + c * 0.1;
        p.scale.set(sc, sc, sc);
        (p.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - c);
      }
    },
    [],
  );
  useSceneryTick(tick);
  const Car = ({ body, roof, i }: { body: string; roof: string; i: number }) => (
    <group ref={(g) => { cars.current[i] = g; }}>
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[0.3, 0.18, 0.56]} />
        <meshStandardMaterial color={body} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.24, 0]}>
        <boxGeometry args={[0.32, 0.04, 0.5]} />
        <meshStandardMaterial color={roof} roughness={0.5} />
      </mesh>
      {[-0.16, 0.16].map((wx) =>
        [-0.18, 0.18].map((wz) => (
          <mesh key={`${wx}${wz}`} position={[wx, 0.06, wz]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.06, 0.06, 0.03, 10]} />
            <meshStandardMaterial color="#2b2b33" roughness={0.6} />
          </mesh>
        )),
      )}
    </group>
  );
  return (
    <group>
      {/* The track: sleepers all round, rails on the straights. */}
      <instancedMesh ref={(m) => { sleepers.current = m; if (m) lay(m); }} args={[undefined, undefined, SLEEPERS]} frustumCulled={false}>
        <boxGeometry args={[0.38, 0.02, 0.07]} />
        <meshStandardMaterial color="#8a6a46" roughness={0.9} />
      </instancedMesh>
      {[-TRACK_HALF, TRACK_HALF].map((x) =>
        [-0.13, 0.13].map((off) => (
          <mesh key={`${x}${off}`} position={[x + off, 0.03, (TRACK_FAR + TRACK_NEAR) / 2]}>
            <boxGeometry args={[0.03, 0.02, TRACK_NEAR - TRACK_FAR - 2 * TRACK_R]} />
            <meshStandardMaterial color="#5a5e66" roughness={0.4} metalness={0.5} />
          </mesh>
        )),
      )}
      {[TRACK_FAR, TRACK_NEAR].map((z) =>
        [-0.13, 0.13].map((off) => (
          <mesh key={`${z}${off}`} position={[0, 0.03, z + off]}>
            <boxGeometry args={[2 * (TRACK_HALF - TRACK_R), 0.02, 0.03]} />
            <meshStandardMaterial color="#5a5e66" roughness={0.4} metalness={0.5} />
          </mesh>
        )),
      )}
      {/* The engine: a boiler, a cab, a chimney, and a puff of steam. */}
      <group ref={(g) => { cars.current[0] = g; }}>
        <mesh position={[0, 0.1, 0]}>
          <boxGeometry args={[0.3, 0.1, 0.6]} />
          <meshStandardMaterial color="#2b2b33" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.2, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 0.36, 12]} />
          <meshStandardMaterial color="#2f8f4e" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.24, -0.18]}>
          <boxGeometry args={[0.3, 0.28, 0.22]} />
          <meshStandardMaterial color="#d04a3a" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.4, -0.18]}>
          <boxGeometry args={[0.34, 0.04, 0.26]} />
          <meshStandardMaterial color="#2b2b33" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.36, 0.2]}>
          <cylinderGeometry args={[0.04, 0.05, 0.12, 8]} />
          <meshStandardMaterial color="#2b2b33" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.2, 0.3]}>
          <sphereGeometry args={[0.05, 8, 6]} />
          <meshStandardMaterial color="#ffd21f" roughness={0.4} />
        </mesh>
        <mesh ref={puff} position={[0, 0.45, 0.2]}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.8} depthWrite={false} />
        </mesh>
        {[-0.16, 0.16].map((wx) =>
          [-0.2, 0, 0.2].map((wz) => (
            <mesh key={`${wx}${wz}`} position={[wx, 0.06, wz]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.06, 0.06, 0.03, 10]} />
              <meshStandardMaterial color="#2b2b33" roughness={0.6} />
            </mesh>
          )),
        )}
      </group>
      <Car body="#7c95d6" roof="#e7b84f" i={1} />
      <Car body="#e7b84f" roof="#7c95d6" i={2} />
    </group>
  );
}
