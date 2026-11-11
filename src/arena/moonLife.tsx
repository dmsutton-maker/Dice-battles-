import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useSceneryTick } from './sceneryClock';

/**
 * Moon Base: aliens, 19 Oct 2026.
 *
 * David: "On the moon base do aliens walking around."
 *
 * Four of them wander the regolith beyond the far wall, each on its
 * own slow figure of eight so they never march in step and never leave
 * the ground outside the tray. Low gravity: they walk in long slow bounds rather than steps,
 * and their antennae sway behind on every landing. Moved on a scenery
 * tick that allocates nothing (sceneryClock.ts).
 *
 * Built to be read from ABOVE: the big green dome of a head is most of
 * the alien, two black eyes sit on its top-front where the camera sees
 * them, two antennae with lit tips stand up out of it, and a small body
 * with swinging arms hangs underneath.
 */

type Wander = { x: number; z: number; dx: number; dz: number; tone: string; eyes: string };

/**
 * Where each alien lives and how far it roams: all four on the far
 * strip, behind the rocks. The side strips are no good for them — past
 * x = 3.6 a head-high thing is off the edge of an iPhone 15's screen,
 * and inside that the strips are solid moon rock.
 */
const ALIENS: Wander[] = [
  { x: -2.7, z: -9.45, dx: 0.6, dz: 0.18, tone: '#5fd35f', eyes: '#101418' },
  { x: -0.9, z: -9.4, dx: 0.7, dz: 0.2, tone: '#7be06a', eyes: '#101418' },
  { x: 0.9, z: -9.45, dx: 0.7, dz: 0.18, tone: '#4fc9a0', eyes: '#101418' },
  { x: 2.7, z: -9.4, dx: 0.6, dz: 0.2, tone: '#8ae05a', eyes: '#101418' },
];

function jit(i: number, k: number): number {
  return Math.abs((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1);
}

export function MoonAliens() {
  const bodies = useRef<(THREE.Group | null)[]>([]);
  const arms = useRef<(THREE.Group | null)[]>([]);
  const antennae = useRef<(THREE.Group | null)[]>([]);
  const tick = useMemo(
    () => (t: number) => {
      for (let i = 0; i < ALIENS.length; i++) {
        const g = bodies.current[i];
        if (!g) continue;
        const a = ALIENS[i];
        const p = (t * 0.05 + jit(i, 1)) * Math.PI * 2;
        const alongX = a.dx > a.dz;
        // A figure of eight along the strip: sin along, sin 2p across.
        const x = alongX ? a.x + Math.sin(p) * a.dx : a.x + Math.sin(2 * p) * a.dx;
        const z = alongX ? a.z + Math.sin(2 * p) * a.dz : a.z + Math.sin(p) * a.dz;
        const vx = alongX ? Math.cos(p) * a.dx : Math.cos(2 * p) * 2 * a.dx;
        const vz = alongX ? Math.cos(2 * p) * 2 * a.dz : Math.cos(p) * a.dz;
        // Long slow bounds: up for most of a second, down with a bump.
        const bound = t * 2.2 + i * 1.7;
        const hop = Math.abs(Math.sin(bound));
        g.position.set(x, hop * 0.12, z);
        g.rotation.set(0, Math.atan2(vx, vz), 0);
        g.scale.setScalar(1.5);
        const arm = arms.current[i];
        if (arm) arm.rotation.x = Math.sin(bound) * 0.6;
        const ant = antennae.current[i];
        if (ant) ant.rotation.x = Math.cos(bound) * 0.25;
      }
    },
    [],
  );
  useSceneryTick(tick);
  return (
    <group>
      {ALIENS.map((a, i) => (
        <group key={i} ref={(g) => { bodies.current[i] = g; }}>
          {/* Body: a short capsule, in a silver suit. */}
          <mesh position={[0, 0.17, 0]}>
            <capsuleGeometry args={[0.07, 0.12, 4, 8]} />
            <meshStandardMaterial color="#c9ccd6" roughness={0.5} metalness={0.4} />
          </mesh>
          {/* Arms swing together, hung from the shoulders. */}
          <group ref={(g) => { arms.current[i] = g; }} position={[0, 0.26, 0]}>
            {[-0.1, 0.1].map((ax) => (
              <mesh key={ax} position={[ax, -0.08, 0]} rotation={[0, 0, ax > 0 ? -0.3 : 0.3]}>
                <capsuleGeometry args={[0.025, 0.14, 4, 6]} />
                <meshStandardMaterial color={a.tone} roughness={0.7} />
              </mesh>
            ))}
          </group>
          {/* Legs. */}
          {[-0.04, 0.04].map((lx) => (
            <mesh key={lx} position={[lx, 0.06, 0]}>
              <boxGeometry args={[0.04, 0.12, 0.05]} />
              <meshStandardMaterial color={a.tone} roughness={0.7} />
            </mesh>
          ))}
          {/* The head: a big green dome, the thing the camera sees. */}
          <mesh position={[0, 0.4, 0]} scale={[0.15, 0.13, 0.15]}>
            <sphereGeometry args={[1, 12, 10]} />
            <meshStandardMaterial color={a.tone} roughness={0.6} />
          </mesh>
          {/* Two big black eyes on the top-front of the head. */}
          {[-0.06, 0.06].map((ex) => (
            <mesh key={ex} position={[ex, 0.48, 0.08]} scale={[0.035, 0.02, 0.045]}>
              <sphereGeometry args={[1, 8, 6]} />
              <meshStandardMaterial color={a.eyes} roughness={0.3} />
            </mesh>
          ))}
          {/* Antennae, swaying with the landing, lit at the tips. */}
          <group ref={(g) => { antennae.current[i] = g; }} position={[0, 0.5, -0.02]}>
            {[-0.06, 0.06].map((ax) => (
              <group key={ax} position={[ax, 0, 0]} rotation={[0, 0, ax > 0 ? -0.35 : 0.35]}>
                <mesh position={[0, 0.07, 0]}>
                  <boxGeometry args={[0.015, 0.14, 0.015]} />
                  <meshStandardMaterial color="#2f7a3a" roughness={0.7} />
                </mesh>
                <mesh position={[0, 0.15, 0]}>
                  <sphereGeometry args={[0.03, 8, 6]} />
                  <meshBasicMaterial color="#ffd21f" toneMapped={false} />
                </mesh>
              </group>
            ))}
          </group>
        </group>
      ))}
    </group>
  );
}
