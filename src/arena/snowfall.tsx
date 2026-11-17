import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { TUNING } from '../game/tuning';
import { useSceneryTick } from './sceneryClock';

/**
 * Snow falling gently over a winter board. Season 1 of the pass, Sugar
 * & Snow (8 Nov 2026): the Gingerbread Village and the Twinkle Market
 * share it.
 *
 * NEVER OVER THE TRAY. Every flake lives in the strips beside the walls
 * or in the band of ground beyond the far wall, so none can drift in
 * front of a die or be taken for one from the game's camera, which
 * looks almost straight down. One instanced mesh of small pale spheres,
 * moved on a scenery tick that allocates nothing (sceneryClock.ts): a
 * flake drifts down with a little sideways sway, and when it reaches
 * the ground it goes back to the top of its own column.
 */

const { innerWidth, innerDepth, wallThickness } = TUNING.tray;
const OUT_X = innerWidth / 2 + wallThickness;
const OUT_Z = innerDepth / 2 + wallThickness;

/** A repeatable 0..1 jitter for flake `i`, channel `k`. Never random. */
const jit = (i: number, k: number): number => {
  const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

const TOP = 3.2;
const COUNT = 64;

export function Snowfall({ color = '#ffffff', speed = 0.35 }: { color?: string; speed?: number }) {
  const mesh = useRef<THREE.InstancedMesh | null>(null);
  const homes = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => {
        // Two in three in the side strips, the rest in the far band.
        const side = jit(i, 1) < 0.66;
        const x = side
          ? (jit(i, 2) < 0.5 ? -1 : 1) * (OUT_X + 0.25 + jit(i, 3) * 1.4)
          : (jit(i, 3) - 0.5) * 8.4;
        const z = side ? -OUT_Z + jit(i, 4) * (2 * OUT_Z + 1.2) - 0.4 : -OUT_Z - 0.5 - jit(i, 4) * 2.4;
        return { x, z, phase: jit(i, 5) * TOP, sway: 0.5 + jit(i, 6), size: 0.03 + jit(i, 7) * 0.03 };
      }),
    [],
  );
  const o = useMemo(() => new THREE.Object3D(), []);
  const tick = useMemo(
    () => (t: number) => {
      const m = mesh.current;
      if (!m) return;
      for (let i = 0; i < COUNT; i++) {
        const h = homes[i];
        const y = TOP - ((t * speed + h.phase) % TOP);
        o.position.set(h.x + Math.sin(t * h.sway + i) * 0.12, y, h.z + Math.cos(t * h.sway * 0.7 + i) * 0.08);
        o.scale.setScalar(h.size);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
      }
      m.instanceMatrix.needsUpdate = true;
    },
    [homes, o, speed],
  );
  useSceneryTick(tick);
  // Laid out once on mount: an instanced mesh whose matrices are never
  // written draws every copy at the origin, a white ball in the middle
  // of the board until the first tick.
  useLayoutEffect(() => tick(0), [tick]);
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, COUNT]} frustumCulled={false}>
      <sphereGeometry args={[1, 6, 5]} />
      <meshBasicMaterial color={color} transparent opacity={0.85} depthWrite={false} />
    </instancedMesh>
  );
}
