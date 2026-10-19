import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { loop } from './boardLife';
import { useSceneryTick } from './sceneryClock';

/**
 * The dogfight under the Space Station, 19 Oct 2026.
 *
 * David: "On the space station, add fighting spaceships with lasers
 * shooting at each other in the background."
 *
 * The background of this board is the drop: the station floats, and
 * past the catwalk on either side the camera looks down into stars, a
 * nebula and a ringed planet (spaceParts.tsx, TheDrop). That is where
 * the fight goes. Three pairs of ships chase each other round one long
 * loop BELOW the deck, so they show in the two strips of space beside
 * it, fly under the station at either end and come out the other side.
 * Nothing crosses above the deck, where it could be mistaken for a die
 * or hide one; the deck and apron are solid, so a ship under them is
 * simply not drawn.
 *
 * Each pair is a chase. The ship behind fires forward at the one in
 * front, which jinks side to side, banks into every jink and fires back
 * over its tail; a bolt that reaches its target lights a flash on it.
 * The bolts are the same few boxes moved along the line of fire and
 * sent back to the gun when they arrive, so a frame allocates nothing
 * (sceneryClock.ts).
 *
 * Built as TOP-VIEW silhouettes: a delta wing laid flat, a short body,
 * a cockpit, an engine glow at the tail. The camera looks nearly
 * straight down, so a ship with its wings on edge would be a line.
 */

/** The loop below the deck: down one side, under the station, back up the other. */
const HALF = 4.0;
/**
 * The strip of space beside the deck is a wedge from this camera: wider
 * at the far end than the near end, and on an iPhone 15 narrower than a
 * ship at the near end. The path leans out toward the far end to stay in
 * the middle of the wedge, and sits inward at the near end so that where
 * a ship cannot fit, it is the deck's edge that clips it — a ship flying
 * under the station — and not the edge of the screen.
 */
const LEAN = 0.0375;
const FAR = -8.6;
const NEAR = 4.4;
/** How deep below the deck the ships fly. */
const DEPTH = -2.5;
/** Laps per second; one lap takes about 24 seconds. */
const SPEED = 1 / 24;
/** How far along the loop the chaser trails the leader, as a share of a lap. */
const GAP = 0.043;
/** The same gap in world units, which is how far a bolt has to fly. */
const RANGE = GAP * (2 * (NEAR - FAR) + 2 * Math.PI * HALF);

const P = new THREE.Vector3();
const Q = new THREE.Vector3();

type Team = { body: string; trim: string; bolt: string };
const HERO: Team = { body: '#e9edf5', trim: '#ff8a3c', bolt: '#3ff2ff' };
const RAIDER: Team = { body: '#363b4e', trim: '#ff4a4a', bolt: '#ff4a4a' };

/** The three chases, spread round the loop so one is always in view. */
const CHASES: { offset: number; seed: number; leader: Team; chaser: Team }[] = [
  { offset: 0, seed: 1.3, leader: HERO, chaser: RAIDER },
  { offset: 1 / 3, seed: 4.1, leader: RAIDER, chaser: HERO },
  { offset: 2 / 3, seed: 7.9, leader: HERO, chaser: RAIDER },
];

export function SpaceDogfight() {
  return (
    <group>
      {CHASES.map((c, i) => (
        <Chase key={i} {...c} />
      ))}
    </group>
  );
}

function Chase({ offset, seed, leader, chaser }: { offset: number; seed: number; leader: Team; chaser: Team }) {
  const lead = useRef<THREE.Group | null>(null);
  const tail = useRef<THREE.Group | null>(null);
  const forward = useRef<(THREE.Mesh | null)[]>([]);
  const backward = useRef<(THREE.Mesh | null)[]>([]);
  const hitLead = useRef<THREE.Mesh | null>(null);
  const hitTail = useRef<THREE.Mesh | null>(null);

  const tick = useMemo(
    () => (t: number) => {
      const u = t * SPEED + offset;
      const heading = loop(u, HALF, FAR, NEAR, P);
      P.x -= Math.sign(P.x) * P.z * LEAN;
      const dx = Math.sin(heading);
      const dz = Math.cos(heading);
      // Across the line of flight, for the jinks.
      const px = dz;
      const pz = -dx;
      const jinkL = Math.sin(t * 1.9 + seed) * 0.08;
      const jinkT = Math.sin((t - 0.45) * 1.9 + seed) * 0.08;
      const l = lead.current;
      if (l) {
        l.position.set(P.x + px * jinkL, DEPTH, P.z + pz * jinkL);
        l.rotation.set(0, heading, Math.cos(t * 1.9 + seed) * 0.5);
      }
      loop(u - GAP, HALF, FAR, NEAR, Q);
      Q.x -= Math.sign(Q.x) * Q.z * LEAN;
      const c = tail.current;
      if (c) {
        c.position.set(Q.x + px * jinkT, DEPTH, Q.z + pz * jinkT);
        c.rotation.set(0, heading, Math.cos((t - 0.45) * 1.9 + seed) * 0.5);
      }
      // Two bolts each way, half a flight apart. `s` runs 0..1 from the
      // gun to the target; past 0.86 the target flashes.
      let flashLead = false;
      let flashTail = false;
      for (let k = 0; k < 2; k++) {
        const s = ((t * 1.6 + k * 0.5 + seed * 0.37) % 1 + 1) % 1;
        const f = forward.current[k];
        if (f && c) {
          const d = 0.35 + s * (RANGE - 0.5);
          f.position.set(c.position.x + dx * d, DEPTH, c.position.z + dz * d);
          f.rotation.set(0, heading, 0);
        }
        if (s > 0.86) flashLead = true;
        const s2 = ((t * 1.3 + k * 0.5 + seed * 0.61) % 1 + 1) % 1;
        const b = backward.current[k];
        if (b && l) {
          const d = 0.35 + s2 * (RANGE - 0.5);
          b.position.set(l.position.x - dx * d, DEPTH, l.position.z - dz * d);
          b.rotation.set(0, heading, 0);
        }
        if (s2 > 0.86) flashTail = true;
      }
      if (hitLead.current) hitLead.current.visible = flashLead;
      if (hitTail.current) hitTail.current.visible = flashTail;
    },
    [offset, seed],
  );
  useSceneryTick(tick);

  return (
    <group>
      <group ref={lead}>
        <Ship team={leader} />
        <mesh ref={hitLead} visible={false}>
          <sphereGeometry args={[0.16, 8, 6]} />
          <meshBasicMaterial color={chaser.bolt} transparent opacity={0.8} toneMapped={false} />
        </mesh>
      </group>
      <group ref={tail}>
        <Ship team={chaser} />
        <mesh ref={hitTail} visible={false}>
          <sphereGeometry args={[0.16, 8, 6]} />
          <meshBasicMaterial color={leader.bolt} transparent opacity={0.8} toneMapped={false} />
        </mesh>
      </group>
      {[0, 1].map((k) => (
        <mesh key={`f${k}`} ref={(m) => { forward.current[k] = m; }}>
          <boxGeometry args={[0.04, 0.04, 0.38]} />
          <meshBasicMaterial color={chaser.bolt} toneMapped={false} />
        </mesh>
      ))}
      {[0, 1].map((k) => (
        <mesh key={`b${k}`} ref={(m) => { backward.current[k] = m; }}>
          <boxGeometry args={[0.04, 0.04, 0.38]} />
          <meshBasicMaterial color={leader.bolt} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/** One fighter, nose toward +z, built to be read from above. */
function Ship({ team }: { team: Team }) {
  return (
    <group>
      {/*
        The delta wing: a three-sided cone tipped onto its side so the
        point is the nose and the two upper base corners are the wing
        tips, then squashed flat. Same trick as the shark's fins.
      */}
      <mesh position={[0, 0, -0.08]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.22]}>
        <coneGeometry args={[0.3, 0.54, 3]} />
        <meshStandardMaterial color={team.body} roughness={0.5} metalness={0.3} side={THREE.DoubleSide} />
      </mesh>
      {/* The body, longer than the wing so the nose leads. */}
      <mesh position={[0, 0.03, 0.02]}>
        <boxGeometry args={[0.12, 0.08, 0.56]} />
        <meshStandardMaterial color={team.trim} roughness={0.5} metalness={0.3} />
      </mesh>
      {/* Cockpit. */}
      <mesh position={[0, 0.08, 0.1]}>
        <sphereGeometry args={[0.06, 8, 6]} />
        <meshBasicMaterial color="#9fe8ff" toneMapped={false} />
      </mesh>
      {/* Engine glow at the tail. */}
      <mesh position={[0, 0.02, -0.3]}>
        <boxGeometry args={[0.1, 0.05, 0.08]} />
        <meshBasicMaterial color="#8fd8ff" toneMapped={false} />
      </mesh>
    </group>
  );
}
