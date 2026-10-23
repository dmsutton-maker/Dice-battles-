import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { loop, track } from './boardLife';
import { useSceneryTick } from './sceneryClock';

/**
 * The Sun Temple's life, season 2 of the pass (21 Oct 2026): a
 * procession of three priests carrying the sun round the temple, and
 * two ibises circling overhead.
 *
 * The priests walk the rounded loop outside the tray that Dino Valley's
 * walkers use — down one side, behind the jail, up the other and across
 * the front between the near wall and the landing pads — slowly and in
 * step, the leader holding a tall standard with a gold sun disc on it.
 * Built to be read from above: the gold headdresses and the sun disc
 * are the bright things. Moved on a scenery tick that allocates nothing
 * (sceneryClock.ts), and never over the tray except the ibises, which
 * fly far above it.
 */

/**
 * The lane round the board: a rounded rectangle just outside the tray.
 * Narrower than Dino Valley's: on an iPhone 15 a head at the near end
 * is off screen past |x| 3.5 (measured through fitCamera), and the
 * first render had the priests cut in half at the right-hand edge.
 */
const LANE = { half: 3.3, far: -9.25, near: 5.55, r: 0.6 };
const LAP = 2 * (2 * LANE.half - 2 * LANE.r) + 2 * (LANE.near - LANE.far - 2 * LANE.r) + 2 * Math.PI * LANE.r;

const P = new THREE.Vector3();
const GOLD = '#f0b240';

export function TempleLife() {
  return (
    <group>
      <Priest offset={0} robe="#f4e6c4" sash="#d1402a" standard />
      <Priest offset={-0.55 / LAP} robe="#e8d0a0" sash={GOLD} />
      <Priest offset={-1.1 / LAP} robe="#f4e6c4" sash="#d1402a" />
      <Ibis offset={0} height={2.3} />
      <Ibis offset={0.5} height={2.7} />
    </group>
  );
}

/** A priest in a pale robe with a gold headdress; the leader carries the sun. */
function Priest({ offset, robe, sash, standard }: { offset: number; robe: string; sash: string; standard?: boolean }) {
  const body = useRef<THREE.Group | null>(null);
  const staff = useRef<THREE.Group | null>(null);
  const tick = useMemo(
    () => (t: number) => {
      const g = body.current;
      if (!g) return;
      const heading = track((t * 0.28) / LAP + offset, LANE.half, LANE.far, LANE.near, LANE.r, P);
      const step = t * 3.4;
      g.position.set(P.x, Math.abs(Math.sin(step)) * 0.025, P.z);
      g.rotation.set(0, heading, Math.sin(step) * 0.04);
      if (staff.current) staff.current.rotation.z = Math.sin(t * 1.6) * 0.06;
    },
    [offset],
  );
  useSceneryTick(tick);
  return (
    <group ref={body} scale={1.25}>
      {/* The robe: a capsule like the prisoners', with a sash across it. */}
      <mesh position={[0, 0.2, 0]}>
        <capsuleGeometry args={[0.085, 0.2, 4, 8]} />
        <meshStandardMaterial color={robe} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.22, 0.06]} rotation={[0, 0, 0.5]}>
        <boxGeometry args={[0.05, 0.3, 0.08]} />
        <meshStandardMaterial color={sash} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <sphereGeometry args={[0.075, 8, 6]} />
        <meshStandardMaterial color="#c68a5c" roughness={0.8} />
      </mesh>
      {/* A gold headdress: a disc standing up behind the head, the sun's own shape. */}
      <mesh position={[0, 0.5, -0.03]} rotation={[-0.3, 0, 0]}>
        <cylinderGeometry args={[0.075, 0.075, 0.02, 12]} />
        <meshStandardMaterial color={GOLD} roughness={0.35} metalness={0.5} />
      </mesh>
      {[-0.045, 0.045].map((lx) => (
        <mesh key={lx} position={[lx, 0.05, 0]}>
          <boxGeometry args={[0.05, 0.1, 0.06]} />
          <meshStandardMaterial color="#8a5a34" roughness={0.9} />
        </mesh>
      ))}
      {standard && (
        <group ref={staff} position={[0.12, 0.3, 0.05]}>
          <mesh position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.9, 5]} />
            <meshStandardMaterial color="#6b4a2a" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.78, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.13, 0.13, 0.025, 16]} />
            <meshStandardMaterial color={GOLD} roughness={0.35} metalness={0.5} />
          </mesh>
          <mesh position={[0, 0.78, 0.014]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 0.01, 12]} />
            <meshBasicMaterial color="#fff0b0" />
          </mesh>
        </group>
      )}
    </group>
  );
}

/** An ibis circling high over the temple, white with black wingtips. */
function Ibis({ offset, height }: { offset: number; height: number }) {
  const body = useRef<THREE.Group | null>(null);
  const wingL = useRef<THREE.Group | null>(null);
  const wingR = useRef<THREE.Group | null>(null);
  const tick = useMemo(
    () => (t: number) => {
      const g = body.current;
      if (!g) return;
      const heading = loop(t * 0.032 + offset, 2.9, -8.2, 2.6, P);
      g.position.set(P.x, height + Math.sin(t * 0.8 + offset * 6) * 0.12, P.z);
      g.rotation.set(0, heading, Math.sin(t * 0.6 + offset) * 0.15);
      // A few beats, then a glide, the way a big bird flies.
      const flap = Math.sin(t * 6 + offset * 10) * 0.6 * (0.55 + 0.45 * Math.sin(t * 0.7 + offset));
      if (wingL.current) wingL.current.rotation.z = flap;
      if (wingR.current) wingR.current.rotation.z = -flap;
    },
    [offset, height],
  );
  useSceneryTick(tick);
  return (
    <group ref={body} scale={1.2}>
      <mesh scale={[0.07, 0.06, 0.24]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color="#f7f3ea" roughness={0.8} />
      </mesh>
      {/* The neck out ahead, and the long curved bill. */}
      <mesh position={[0, 0.02, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.04, 0.18, 6]} />
        <meshStandardMaterial color="#f7f3ea" roughness={0.8} />
      </mesh>
      <mesh position={[0, -0.02, 0.46]} rotation={[Math.PI / 2 + 0.5, 0, 0]}>
        <coneGeometry args={[0.018, 0.16, 5]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.6} />
      </mesh>
      {/* Wings lying in the ground plane, hinged at the shoulder, black at the tips. */}
      {([[wingL, -1], [wingR, 1]] as const).map(([ref, side]) => (
        <group key={side} ref={ref} position={[side * 0.05, 0, 0.02]}>
          <mesh position={[side * 0.26, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.52, 0.2]} />
            <meshStandardMaterial color="#f7f3ea" roughness={0.8} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[side * 0.5, 0.001, -0.02]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.1, 0.14]} />
            <meshStandardMaterial color="#2a2a2a" roughness={0.8} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
