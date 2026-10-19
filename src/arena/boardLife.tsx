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
