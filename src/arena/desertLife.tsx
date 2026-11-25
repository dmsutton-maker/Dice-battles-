import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useSceneryTick } from './sceneryClock';

/**
 * Desert Dunes: a camel train, 19 Oct 2026.
 *
 * David: "In the desert show me people riding on camels in the
 * background."
 *
 * The background is the strip of dune beyond the far wall. Three camels
 * walk it in a line from left to right, two of them with a rider, and
 * when the last is off the right edge of the frame the train comes
 * back in on the left. Their legs swing, their heads nod with the step,
 * and they rock a little the way a camel does. Built and moved on a
 * scenery tick that allocates nothing (sceneryClock.ts).
 *
 * Built to be read from ABOVE, like every creature on these boards: the
 * long body, the two humps, the red saddle blanket between them, the
 * neck reaching forward and a rider sitting high behind the front hump
 * in a bright robe and a white headscarf.
 */

/**
 * Where the train walks: the far strip, behind the cactus and rocks. Not
 * right at the back — a camel is tall, and from this camera anything
 * tall at z -9.8 has its humps and head above the top of the frame.
 */
const TRAIL_Z = -9.45;
/** Walking pace, in units per second. */
const PACE = 0.32;
/** Walk from one edge of the frame to the other, with room to turn round. */
const WRAP = 12.4;
/** Nose to nose spacing. */
const SPACING = 1.25;

const CAMELS: { rider: { robe: string; skin: string } | null; tone: string }[] = [
  { rider: { robe: '#2f6fd0', skin: '#8a5a3a' }, tone: '#cfa66e' },
  { rider: null, tone: '#c49a62' },
  { rider: { robe: '#d8453a', skin: '#c68a5c' }, tone: '#d4ac74' },
];

export function DesertCamels() {
  const bodies = useRef<(THREE.Group | null)[]>([]);
  const legs = useRef<(THREE.Group | null)[]>([]);
  const necks = useRef<(THREE.Group | null)[]>([]);
  const tick = useMemo(
    () => (t: number) => {
      for (let i = 0; i < CAMELS.length; i++) {
        const g = bodies.current[i];
        if (!g) continue;
        const along = ((t * PACE - i * SPACING) % WRAP + WRAP) % WRAP - WRAP / 2;
        // A camel rolls side to side as it walks; the step is slow.
        const step = t * 3.2 + i * 1.9;
        g.position.set(along, 0, TRAIL_Z + Math.sin(step * 0.5) * 0.04);
        g.rotation.set(0, Math.PI / 2, Math.sin(step) * 0.05);
        g.scale.setScalar(1.1);
        for (let k = 0; k < 4; k++) {
          const leg = legs.current[i * 4 + k];
          // Diagonal pairs move together, the way a camel's do not —
          // but a pace gait reads as a limp from above; this reads as a walk.
          if (leg) leg.rotation.x = Math.sin(step + (k % 2 ? Math.PI : 0)) * 0.4;
        }
        const neck = necks.current[i];
        if (neck) neck.rotation.x = -0.55 + Math.sin(step) * 0.08;
      }
    },
    [],
  );
  useSceneryTick(tick);
  return (
    <group>
      {CAMELS.map((c, i) => (
        <group key={i} ref={(g) => { bodies.current[i] = g; }}>
          {/* Body. */}
          <mesh position={[0, 0.5, 0]}>
            <boxGeometry args={[0.26, 0.28, 0.66]} />
            <meshStandardMaterial color={c.tone} roughness={0.9} />
          </mesh>
          {/* Two humps, and the blanket between them. */}
          {[0.16, -0.16].map((hz) => (
            <mesh key={hz} position={[0, 0.66, hz]} scale={[0.12, 0.12, 0.13]}>
              <sphereGeometry args={[1, 10, 8]} />
              <meshStandardMaterial color={c.tone} roughness={0.9} />
            </mesh>
          ))}
          <mesh position={[0, 0.645, 0]}>
            <boxGeometry args={[0.3, 0.03, 0.16]} />
            <meshStandardMaterial color={c.rider ? '#c8382e' : '#8a4a9a'} roughness={0.9} />
          </mesh>
          {/* Neck and head, reaching forward. */}
          <group ref={(g) => { necks.current[i] = g; }} position={[0, 0.58, 0.3]} rotation={[-0.55, 0, 0]}>
            <mesh position={[0, 0.2, 0]}>
              <boxGeometry args={[0.1, 0.42, 0.1]} />
              <meshStandardMaterial color={c.tone} roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.42, 0.06]}>
              <boxGeometry args={[0.11, 0.1, 0.22]} />
              <meshStandardMaterial color={c.tone} roughness={0.9} />
            </mesh>
            {[-0.05, 0.05].map((ex) => (
              <mesh key={ex} position={[ex, 0.49, 0]}>
                <boxGeometry args={[0.03, 0.05, 0.04]} />
                <meshStandardMaterial color={c.tone} roughness={0.9} />
              </mesh>
            ))}
          </group>
          {/* Tail. */}
          <mesh position={[0, 0.5, -0.36]} rotation={[0.5, 0, 0]}>
            <boxGeometry args={[0.03, 0.16, 0.03]} />
            <meshStandardMaterial color="#9a7447" roughness={0.9} />
          </mesh>
          {/* Legs, hung from the hip so they swing. */}
          {[[-0.09, 0.22], [0.09, 0.22], [-0.09, -0.22], [0.09, -0.22]].map(([lx, lz], k) => (
            <group key={k} ref={(g) => { legs.current[i * 4 + k] = g; }} position={[lx, 0.38, lz]}>
              <mesh position={[0, -0.2, 0]}>
                <boxGeometry args={[0.07, 0.4, 0.07]} />
                <meshStandardMaterial color={c.tone} roughness={0.9} />
              </mesh>
            </group>
          ))}
          {/* The rider, sitting behind the front hump. */}
          {c.rider && (
            <group position={[0, 0.7, 0.02]}>
              <mesh position={[0, 0.14, 0]}>
                <capsuleGeometry args={[0.075, 0.2, 4, 8]} />
                <meshStandardMaterial color={c.rider.robe} roughness={0.85} />
              </mesh>
              <mesh position={[0, 0.36, 0]}>
                <sphereGeometry args={[0.07, 8, 6]} />
                <meshStandardMaterial color={c.rider.skin} roughness={0.8} />
              </mesh>
              {/* A white headscarf: a cap over the head and a tail down the back. */}
              <mesh position={[0, 0.4, 0]} scale={[0.085, 0.05, 0.085]}>
                <sphereGeometry args={[1, 8, 6]} />
                <meshStandardMaterial color="#f7f3ea" roughness={0.9} />
              </mesh>
              <mesh position={[0, 0.28, -0.08]} rotation={[0.3, 0, 0]}>
                <boxGeometry args={[0.1, 0.18, 0.02]} />
                <meshStandardMaterial color="#f7f3ea" roughness={0.9} />
              </mesh>
            </group>
          )}
        </group>
      ))}
    </group>
  );
}
