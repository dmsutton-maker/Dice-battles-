import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { TUNING } from '../game/tuning';
import { CORNER_TOWERS } from '../game/stations';
import { cachedTexture } from './textureCache';
import { createDuskGroundTexture, createGlowTexture, DUSK_GROUND } from './bespokeFloors';
import { Instanced, Placement } from './Instanced';
import { hash } from './paint';
import {
  brazierSpots,
  COURSE,
  DUSK_SILHOUETTES,
  fallenStones,
  ruinBlocks,
  ruinHeightAt,
  RuinSide,
  STUMP_RADIUS,
  stumpBlocks,
} from './ruin';
import { useSceneryTick } from './sceneryClock';

/**
 * The Sunset Castle: a ruin at dusk.
 *
 * Its palette, in the board redesign's five roles:
 *   base     #a39686  worn cobbles (bespokeFloors.ts)
 *   surface  #a8998a  warm limestone, the same stone the day castle is
 *                     built of, left out in the weather for a few hundred
 *                     years
 *   accent   #4a6a32  ivy
 *   glow     #ffb35c  brazier fire
 *   shadow   #2f2340  dusk violet: the silhouettes, the far shadows
 *
 * The SHAPE language is the whole point (see ruin.ts for the bug report
 * that asked for it): loose blocks instead of dressed walls, a broken
 * skyline instead of a regular row of merlons, hollow roofless stumps
 * instead of coral cones, fire instead of flags.
 */

const { innerWidth, innerDepth, wallThickness } = TUNING.tray;
const halfW = innerWidth / 2;
const halfD = innerDepth / 2;

const STONE_DARK = new THREE.Color('#8a7d6f');
const STONE_PALE = new THREE.Color('#b9a892');
const IVY = ['#4f6f33', '#5d7f3a', '#466330', '#6a8a42'];
const IRON = '#2e2a28';
const FIRE = '#ff9440';
const FIRE_CORE = '#ffe08a';
const SILHOUETTE = '#2f2340';

/** A stone's colour from its tone, darker toward the foot of the wall. */
function stoneColor(tone: number, y: number): THREE.Color {
  const c = STONE_DARK.clone().lerp(STONE_PALE, tone);
  return c.multiplyScalar(0.84 + Math.min(1, y / 1.6) * 0.16);
}

/**
 * Ivy, over the broken tops and down the inner faces. Placed from the
 * ruin's own height profile, so a clump sits ON the stone that is there
 * rather than floating over a breach.
 */
function ivyClumps(): Placement[] {
  const out: Placement[] = [];
  const runs: { side: RuinSide; alongX: boolean; at: number; inner: number; from: number; to: number }[] = [
    { side: 'left', alongX: false, at: -(halfW + wallThickness / 2), inner: 1, from: -halfD, to: halfD },
    { side: 'right', alongX: false, at: halfW + wallThickness / 2, inner: -1, from: -halfD, to: halfD },
    { side: 'far', alongX: true, at: -(halfD + wallThickness / 2), inner: 1, from: -halfW, to: halfW },
    { side: 'near', alongX: true, at: halfD + wallThickness / 2, inner: -1, from: -halfW, to: halfW },
  ];
  let k = 0;
  for (const run of runs) {
    const n = run.alongX ? 8 : 15;
    for (let i = 0; i < n; i++) {
      k++;
      const along = run.from + ((i + 0.3 + hash(k, 2.2) * 0.4) / n) * (run.to - run.from);
      const top = ruinHeightAt(run.side, along);
      const size = 0.1 + hash(k, 5.1) * 0.07;
      // On the wall top, leaning to the inner edge: a loose cluster of
      // three or four small mats rather than one round blob, which from
      // above read as a row of identical bushes.
      const across = run.at + run.inner * (0.06 + hash(k, 3.3) * 0.1);
      const mats = 3 + Math.floor(hash(k, 4.7) * 2);
      for (let m = 0; m < mats; m++) {
        const da = (hash(k + m, 6.1) - 0.5) * 0.34;
        const dc = (hash(k - m, 2.7) - 0.5) * 0.22;
        const s = size * (0.55 + hash(k * m, 3.9) * 0.45);
        out.push({
          position: run.alongX
            ? [along + da, ruinHeightAt(run.side, along + da) + 0.02, across + dc]
            : [across + dc, ruinHeightAt(run.side, along + da) + 0.02, along + da],
          scale: [s * 1.5, s * 0.3, s * 1.2],
          rotation: [0, hash(k, m + 1.1) * 3, 0],
          color: IVY[(Math.floor(hash(k, 8.8) * IVY.length) + m) % IVY.length],
        });
      }
      // And a curtain falling down the courtyard side, smaller as it goes.
      const falls = 1 + Math.floor(hash(k, 6.6) * 3);
      const face = run.at + run.inner * (wallThickness / 2 + 0.02);
      for (let f = 1; f <= falls; f++) {
        const s = size * (1 - f * 0.18);
        const y = top - f * 0.15;
        const shift = (hash(k + f, 9.1) - 0.5) * 0.18;
        out.push({
          position: run.alongX ? [along + shift, y, face] : [face, y, along + shift],
          scale: run.alongX ? [s * 1.5, s * 1.3, s * 0.4] : [s * 0.4, s * 1.3, s * 1.5],
          rotation: [0, 0, 0],
          color: IVY[(Math.floor(hash(k, 8.8) * IVY.length) + f) % IVY.length],
        });
      }
    }
  }
  // A crown of ivy on each tower stump, round the broken rim.
  CORNER_TOWERS.forEach((t, ti) => {
    for (let i = 0; i < 4; i++) {
      const a = ti * 1.3 + i * 1.6;
      out.push({
        position: [t.x + Math.sin(a) * STUMP_RADIUS, (t.z < 0 ? 7 : 5) * COURSE, t.z + Math.cos(a) * STUMP_RADIUS],
        scale: [0.26, 0.14, 0.26],
        rotation: [0, a, 0],
        color: IVY[(ti + i) % IVY.length],
      });
    }
  });
  return out;
}

/**
 * A brazier: an iron bowl on three legs, standing on the wall top, with
 * fire in it. The fire is unlit material, so it stays bright while the
 * low sun lets the stone around it fall dark, and a soft additive glow
 * underneath is what makes it read as LIGHT from above.
 */
function Brazier({
  position,
  index,
  flames,
  glows,
}: {
  position: [number, number, number];
  index: number;
  flames: React.MutableRefObject<(THREE.Group | null)[]>;
  glows: React.MutableRefObject<(THREE.MeshBasicMaterial | null)[]>;
}) {
  const glowTexture = useMemo(() => cachedTexture('glow-disc', createGlowTexture), []);
  return (
    <group position={position}>
      {[0, 1, 2].map((k) => {
        const a = (k / 3) * Math.PI * 2;
        return (
          <mesh key={k} position={[Math.sin(a) * 0.08, 0.15, Math.cos(a) * 0.08]} rotation={[Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25]}>
            <cylinderGeometry args={[0.014, 0.018, 0.32, 4]} />
            <meshStandardMaterial color={IRON} roughness={0.7} metalness={0.4} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.34, 0]}>
        <cylinderGeometry args={[0.18, 0.09, 0.12, 10]} />
        <meshStandardMaterial color={IRON} roughness={0.7} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.401, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.16, 10]} />
        <meshBasicMaterial color="#ff6a2a" toneMapped={false} />
      </mesh>
      <group
        position={[0, 0.4, 0]}
        ref={(g) => {
          flames.current[index] = g;
        }}
      >
        <mesh position={[0, 0.16, 0]}>
          <coneGeometry args={[0.12, 0.34, 7]} />
          <meshBasicMaterial color={FIRE} toneMapped={false} />
        </mesh>
        <mesh position={[0.02, 0.11, 0.01]}>
          <coneGeometry args={[0.065, 0.22, 6]} />
          <meshBasicMaterial color={FIRE_CORE} toneMapped={false} />
        </mesh>
      </group>
      <mesh position={[0, 0.46, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
        <planeGeometry args={[1.5, 1.5]} />
        <meshBasicMaterial
          ref={(m) => {
            glows.current[index] = m;
          }}
          map={glowTexture}
          color="#ff9a4a"
          transparent
          opacity={0.6}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/** The ruined walls, the tower stumps, the ivy and the braziers. */
export function RuinWalls() {
  const blocks = useMemo<Placement[]>(
    () =>
      ruinBlocks().map((b) => ({
        position: b.position,
        rotation: [0, b.yaw, 0],
        scale: b.size,
        color: stoneColor(b.tone, b.position[1]),
      })),
    [],
  );
  const stump = useMemo<Placement[]>(
    () =>
      stumpBlocks().map((b) => ({
        position: b.position,
        rotation: [0, b.yaw, 0],
        color: stoneColor(b.tone, b.position[1]),
      })),
    [],
  );
  const ivy = useMemo(() => ivyClumps(), []);
  const fallen = useMemo<Placement[]>(
    () =>
      fallenStones().map((s, i) => ({
        position: s.position,
        rotation: [s.tilt, s.yaw, s.tilt * 0.5],
        scale: [s.size * 1.5, s.size, s.size],
        color: stoneColor(hash(i, 3.7), 0.6),
      })),
    [],
  );
  const braziers = useMemo(() => brazierSpots(), []);

  // Fire flickers: each flame's height and its glow's strength breathe on
  // two out-of-step waves, so no two braziers pulse together.
  const flames = useRef<(THREE.Group | null)[]>([]);
  const glows = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const tick = useMemo(
    () => (t: number) => {
      for (let i = 0; i < flames.current.length; i++) {
        const f = flames.current[i];
        const flick = Math.sin(t * 9.1 + i * 2.3) * 0.5 + Math.sin(t * 15.7 + i * 4.1) * 0.3 + Math.sin(t * 4.3 + i) * 0.2;
        if (f) {
          f.scale.set(1 - flick * 0.06, 1 + flick * 0.16, 1 - flick * 0.06);
          f.rotation.y = t * 0.6 + i;
        }
        const g = glows.current[i];
        if (g) g.opacity = 0.55 + flick * 0.12;
      }
    },
    [],
  );
  useSceneryTick(tick);

  return (
    <group>
      <Instanced items={blocks}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.95} />
      </Instanced>
      <Instanced items={stump}>
        <boxGeometry args={[0.34, COURSE - 0.02, 0.28]} />
        <meshStandardMaterial roughness={0.95} />
      </Instanced>
      {/* The dark, empty inside of each stump: what makes it a ruin
          rather than a short tower when seen from above. */}
      {CORNER_TOWERS.map((t, i) => (
        <mesh key={`core-${i}`} position={[t.x, (t.z < 0 ? 5 : 3.5) * COURSE * 0.5, t.z]}>
          <cylinderGeometry args={[STUMP_RADIUS - 0.08, STUMP_RADIUS - 0.08, (t.z < 0 ? 5 : 3.5) * COURSE, 12]} />
          <meshStandardMaterial color="#3b302b" roughness={1} />
        </mesh>
      ))}
      <Instanced items={ivy}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={0.9} flatShading />
      </Instanced>
      <Instanced items={fallen}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.95} />
      </Instanced>
      {braziers.map((b, i) => (
        <Brazier key={`brazier-${i}`} position={b.position} index={i} flames={flames} glows={glows} />
      ))}
    </group>
  );
}

/**
 * The world beyond the ruin: turf lit by the last of the sun, warm at the
 * horizon end of the frame and falling to violet toward the player (see
 * duskGroundPixels), with the black shapes of fallen towers standing
 * against it at the two far corners.
 *
 * The sky dome this replaced was never once on screen — the camera looks
 * almost straight down (see groundTexture.ts for the measurements) — so
 * the dusk is laid where the camera DOES look: on the ground.
 */
export function DuskSurroundings() {
  const ground = useMemo(() => cachedTexture('sunset-ground', createDuskGroundTexture), []);
  /*
    Unlit and nearly black-violet: a silhouette is a shape with the light
    BEHIND it, so lighting it from the front would undo the whole effect.
    The jagged teeth on top are what make it a broken tower rather than a
    post — they are the outline a camera above actually sees.
  */
  const silhouette = useMemo(() => new THREE.MeshBasicMaterial({ color: SILHOUETTE }), []);
  useEffect(() => () => silhouette.dispose(), [silhouette]);
  return (
    <group>
      <mesh position={[0, -0.12, DUSK_GROUND.centerZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[DUSK_GROUND.width, DUSK_GROUND.depth]} />
        <meshBasicMaterial map={ground} />
      </mesh>
      {DUSK_SILHOUETTES.map(({ x, z, r, h }, i) => (
        <group key={`ruin-${i}`} position={[x, 0, z]}>
          <mesh material={silhouette} position={[0, h / 2, 0]}>
            <cylinderGeometry args={[r, r * 1.1, h, 10]} />
          </mesh>
          {[0, 1, 2, 3].map((k) => {
            const a = k * 1.7 + i;
            const tall = 0.25 + ((k * 7 + i * 3) % 4) * 0.16;
            return (
              <mesh
                key={k}
                material={silhouette}
                position={[Math.sin(a) * r * 0.78, h + tall / 2, Math.cos(a) * r * 0.78]}
                rotation={[0, a, 0]}
              >
                <boxGeometry args={[r * 0.55, tall, r * 0.32]} />
              </mesh>
            );
          })}
        </group>
      ))}
    </group>
  );
}
