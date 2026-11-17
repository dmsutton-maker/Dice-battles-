import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { TUNING } from '../game/tuning';
import { CORNER_TOWERS } from '../game/stations';
import { cachedTexture } from './textureCache';
import { createStoneBlockTexture } from './bespokeFloors';
import { Instanced, Placement } from './Instanced';
import { scaleUv, worldUvBox } from './paint';
import { useSceneryTick } from './sceneryClock';

/**
 * The Castle Courtyard's walls: the default battlefield, and the first
 * thing everybody who opens the game sees.
 *
 * Its palette, in the five roles the board redesign gives every board
 * (docs/board-redesign.md):
 *   base     #b5ac9c  the flagstones (bespokeFloors.ts)
 *   surface  #a19d95  dressed grey stone
 *   accent   #3d5f9e  royal-blue banners, with the coral roofs
 *   glow     #e2bf62  gold trim on the banners and pennants
 *   shadow   #5a5650  mortar and arrow slits
 *
 * The shape language is ORDER: dressed blocks, a level wall-walk, and a
 * crenellated parapet whose merlons repeat at one exact pitch all the way
 * round. That regularity is precisely what the Sunset Castle's ruin
 * throws away, so the two read as different places with the colour off.
 */

const { innerWidth, innerDepth, wallHeight, wallThickness } = TUNING.tray;
const halfW = innerWidth / 2;
const halfD = innerDepth / 2;

export const CASTLE_STONE = '#a19d95';
const WALKWAY = '#b3aea4';
const ROOF = '#d0584a';
const BANNER = '#3d5f9e';
const BANNER_ALT = '#9e3f3c';
const GOLD = '#e2bf62';
const SLIT = '#3f3c38';

/** The wall-walk slab on top of the wall. */
const WALK_T = 0.06;
/** The parapet runs along the OUTER edge; the walk is the rest. */
const PARAPET_T = 0.15;
const PARAPET_BASE = 0.08;
const MERLON_H = 0.22;
const MERLON_L = 0.4;
const MERLON_PITCH = 0.72;

/**
 * Why a PARAPET, on the outside edge, and not merlons across the whole
 * wall top as before: from a camera looking almost straight down, a real
 * wall-walk is what makes a wall read as a castle wall — a pale level path
 * with the teeth along its outer side. Merlons the full thickness of the
 * wall read from above as a row of bricks.
 *
 * It also gives the captured prisoners on the far wall (WALL_SLOTS)
 * something to stand on: they parade along the walk, behind the teeth,
 * which is where a sentry would stand.
 */
function merlonPlacements(): Placement[] {
  const out: Placement[] = [];
  const y = wallHeight + WALK_T + PARAPET_BASE + MERLON_H / 2;
  const outerOffset = wallThickness / 2 - PARAPET_T / 2;
  // Long runs end in the corner towers, so stop short of them.
  const runs: { alongX: boolean; at: number; from: number; to: number }[] = [
    { alongX: true, at: -(halfD + wallThickness / 2) - outerOffset, from: -halfW + 0.15, to: halfW - 0.15 },
    { alongX: true, at: halfD + wallThickness / 2 + outerOffset, from: -halfW + 0.15, to: halfW - 0.15 },
    { alongX: false, at: -(halfW + wallThickness / 2) - outerOffset, from: -halfD + 0.1, to: halfD - 0.1 },
    { alongX: false, at: halfW + wallThickness / 2 + outerOffset, from: -halfD + 0.1, to: halfD - 0.1 },
  ];
  for (const run of runs) {
    const span = run.to - run.from;
    const count = Math.max(2, Math.round(span / MERLON_PITCH));
    // Centred on the run, so the pattern is symmetrical about its middle
    // and both ends of a wall look alike.
    const pitch = span / count;
    for (let i = 0; i < count; i++) {
      const a = run.from + pitch * (i + 0.5);
      out.push({
        position: run.alongX ? [a, y, run.at] : [run.at, y, a],
        rotation: run.alongX ? [0, 0, 0] : [0, Math.PI / 2, 0],
      });
    }
  }
  return out;
}

/** Banners draped over the wall-walk, hanging into the courtyard. */
const BANNER_SPOTS: { side: -1 | 1; z: number; alt: boolean }[] = [
  { side: -1, z: -3.05, alt: false },
  { side: -1, z: -0.25, alt: true },
  { side: -1, z: 2.55, alt: false },
  { side: 1, z: -3.05, alt: true },
  { side: 1, z: -0.25, alt: false },
  { side: 1, z: 2.55, alt: true },
];

function Banner({ side, z, alt }: { side: -1 | 1; z: number; alt: boolean }) {
  // The inner face of this wall, and the walk on top of it.
  const innerX = side * halfW;
  const walkY = wallHeight + WALK_T;
  const cloth = alt ? BANNER_ALT : BANNER;
  const drop = 0.62;
  const across = wallThickness - PARAPET_T;
  return (
    <group position={[innerX, 0, z]} rotation={[0, side < 0 ? 0 : Math.PI, 0]}>
      {/* Over the walk — the part a camera above actually sees. */}
      <mesh position={[-across / 2 + 0.01, walkY + 0.012, 0]}>
        <boxGeometry args={[across, 0.024, 0.34]} />
        <meshStandardMaterial color={cloth} roughness={0.85} />
      </mesh>
      {/* And down the inner face of the wall. */}
      <mesh position={[0.016, walkY - drop / 2, 0]}>
        <boxGeometry args={[0.024, drop, 0.34]} />
        <meshStandardMaterial color={cloth} roughness={0.85} />
      </mesh>
      {/* Swallowtail point. */}
      <mesh position={[0.016, walkY - drop - 0.09, 0]} rotation={[Math.PI, 0, 0]} scale={[0.14, 1, 1]}>
        <coneGeometry args={[0.17, 0.18, 3]} />
        <meshStandardMaterial color={cloth} roughness={0.85} />
      </mesh>
      {/* A gold band across it, and a gold boss in the middle. */}
      <mesh position={[0.03, walkY - 0.14, 0]}>
        <boxGeometry args={[0.012, 0.045, 0.35]} />
        <meshStandardMaterial color={GOLD} roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[0.032, walkY - 0.36, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.07, 0.07, 0.012, 10]} />
        <meshStandardMaterial color={GOLD} roughness={0.5} metalness={0.3} />
      </mesh>
    </group>
  );
}

/**
 * The corner towers: dressed stone, a corbelled ring under the roof, a
 * coral cone and a pennant on top. The pennant is laid back at an angle
 * rather than flying straight out — a flag that stands upright is only its
 * top edge to a camera looking down.
 */
function Towers({ stone }: { stone: THREE.Material }) {
  const towerH = wallHeight + 0.45;
  const body = useMemo(
    () => scaleUv(new THREE.CylinderGeometry(0.5, 0.56, towerH, 14), Math.PI * 1.06, towerH),
    [towerH],
  );
  useEffect(() => () => body.dispose(), [body]);

  // The four pennants stir, each to its own rhythm. Built once; the
  // tick only writes rotations into objects it already holds.
  const flags = useRef<(THREE.Group | null)[]>([]);
  const tick = useMemo(
    () => (t: number) => {
      for (let i = 0; i < flags.current.length; i++) {
        const g = flags.current[i];
        if (!g) continue;
        g.rotation.y = 0.5 + Math.sin(t * 1.7 + i * 1.9) * 0.22 + Math.sin(t * 3.1 + i) * 0.06;
      }
    },
    [],
  );
  useSceneryTick(tick);

  return (
    <>
      {CORNER_TOWERS.map((t, i) => {
        /*
          The two NEAR towers (bottom of the screen) have no roof and no
          pennant. Seen from almost straight above, a cone roof that close
          to the camera is a big red disc on a stick — David: "get rid of
          the umbrellas at the bottom of the arenas where it's
          unnecessary." An open stone tower top reads as a tower; the
          roofs stay on the far pair, where they are small and read right.
        */
        const near = t.z > 0;
        return (
        <group key={`tower-${i}`} position={[t.x, 0, t.z]}>
          <mesh material={stone} geometry={body} position={[0, towerH / 2, 0]} />
          {!near && (
          <>
          {/* Corbelled ring the roof sits on. */}
          <mesh position={[0, towerH + 0.06, 0]}>
            <cylinderGeometry args={[0.63, 0.55, 0.14, 14]} />
            <meshStandardMaterial color={WALKWAY} roughness={0.9} />
          </mesh>
          <mesh position={[0, towerH + 0.58, 0]}>
            <coneGeometry args={[0.68, 0.9, 14]} />
            <meshStandardMaterial color={ROOF} roughness={0.6} />
          </mesh>
          </>
          )}
          {/* Arrow slits on the two faces the camera can see. */}
          {[0, 1].map((k) => {
            const a = Math.atan2(-t.x, -t.z) + (k ? 0.55 : -0.55);
            return (
              <mesh
                key={k}
                position={[Math.sin(a) * 0.535, wallHeight * 0.62, Math.cos(a) * 0.535]}
                rotation={[0, a, 0]}
              >
                <boxGeometry args={[0.06, 0.3, 0.02]} />
                <meshStandardMaterial color={SLIT} roughness={1} />
              </mesh>
            );
          })}
          {/* Pennant — far towers only. */}
          {!near && (
          <>
          <mesh position={[0, towerH + 1.2, 0]}>
            <cylinderGeometry args={[0.018, 0.022, 0.5, 5]} />
            <meshStandardMaterial color="#4a4038" roughness={0.8} />
          </mesh>
          <group
            position={[0, towerH + 1.4, 0]}
            ref={(g) => {
              flags.current[i] = g;
            }}
            rotation={[0, 0.5, 0]}
          >
            <mesh position={[0.22, -0.02, 0]} rotation={[0.9, 0, -Math.PI / 2]} scale={[1, 1, 0.08]}>
              <coneGeometry args={[0.11, 0.44, 3]} />
              <meshStandardMaterial color={i % 2 ? BANNER : GOLD} roughness={0.8} side={THREE.DoubleSide} />
            </mesh>
          </group>
          </>
          )}
        </group>
        );
      })}
    </>
  );
}

/**
 * The rest of the castle: curtain walls running on from the two far
 * towers and out of the picture, with a turret where each leaves the
 * frame. The camera's only "distance" is the top corners of the screen,
 * and a wall that carries on past the edge of it says the courtyard is
 * one part of a much bigger castle — the same trick a stage set uses.
 */
export function CastleBackdrop() {
  const stoneTexture = useMemo(() => cachedTexture('castle-stone-blocks', createStoneBlockTexture), []);
  const stone = useMemo(
    () => new THREE.MeshStandardMaterial({ map: stoneTexture, color: CASTLE_STONE, roughness: 0.92 }),
    [stoneTexture],
  );
  useEffect(() => () => stone.dispose(), [stone]);
  const z = -(halfD + wallThickness);
  const from = halfW + wallThickness + 0.45;
  const to = from + 1.9;
  const len = to - from;
  const h = wallHeight * 0.9;
  const geos = useMemo(
    () => ({
      wall: worldUvBox(len, h, 0.42),
      merlon: worldUvBox(0.36, 0.22, 0.14),
      turret: scaleUv(new THREE.CylinderGeometry(0.42, 0.46, h + 0.5, 12), 2.7, h + 0.5),
    }),
    [len, h],
  );
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos]);
  const merlons = useMemo<Placement[]>(() => {
    const out: Placement[] = [];
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        out.push({ position: [side * (from + 0.3 + i * 0.62), h + 0.11, z - 0.14] });
      }
    }
    return out;
  }, [from, h, z]);
  return (
    <group>
      {([-1, 1] as const).map((side) => (
        <group key={side}>
          <mesh material={stone} geometry={geos.wall} position={[side * (from + len / 2), h / 2, z]} />
          <mesh position={[side * (from + len / 2), h + 0.02, z + 0.04]}>
            <boxGeometry args={[len, 0.04, 0.3]} />
            <meshStandardMaterial color={WALKWAY} roughness={0.9} />
          </mesh>
          <group position={[side * to, 0, z]}>
            <mesh material={stone} geometry={geos.turret} position={[0, (h + 0.5) / 2, 0]} />
            <mesh position={[0, h + 0.85, 0]}>
              <coneGeometry args={[0.52, 0.7, 12]} />
              <meshStandardMaterial color={ROOF} roughness={0.6} />
            </mesh>
          </group>
        </group>
      ))}
      <Instanced items={merlons}>
        <primitive object={geos.merlon} attach="geometry" />
        <primitive object={stone} attach="material" />
      </Instanced>
    </group>
  );
}

/**
 * Four walls of dressed stone with a wall-walk and a crenellated parapet,
 * banners, and the corner towers. Visual only; the collision walls are
 * full-height boxes in src/physics/world.ts and these stand exactly on
 * them — the walk is at `wallHeight`, so a die never stops short of a
 * drawn surface.
 */
export function CourtyardWalls() {
  const stoneTexture = useMemo(() => cachedTexture('castle-stone-blocks', createStoneBlockTexture), []);
  const stone = useMemo(
    () => new THREE.MeshStandardMaterial({ map: stoneTexture, color: CASTLE_STONE, roughness: 0.92 }),
    [stoneTexture],
  );
  const walkway = useMemo(
    () => new THREE.MeshStandardMaterial({ map: stoneTexture, color: WALKWAY, roughness: 0.9 }),
    [stoneTexture],
  );
  useEffect(
    () => () => {
      stone.dispose();
      walkway.dispose();
    },
    [stone, walkway],
  );

  /*
    Built with world-scaled UVs (see worldUvBox), so the same stone block
    is the same size on a ten-unit wall, a merlon and a tower. Imperative,
    so freed here.
  */
  const geos = useMemo(() => {
    const outerD = innerDepth + wallThickness * 2;
    const side = worldUvBox(wallThickness, wallHeight, outerD);
    const end = worldUvBox(innerWidth, wallHeight, wallThickness);
    const walkSide = worldUvBox(wallThickness + 0.04, WALK_T, outerD);
    const walkEnd = worldUvBox(innerWidth, WALK_T, wallThickness + 0.04);
    const parSide = worldUvBox(PARAPET_T, PARAPET_BASE, outerD);
    const parEnd = worldUvBox(innerWidth, PARAPET_BASE, PARAPET_T);
    const merlon = worldUvBox(MERLON_L, MERLON_H, PARAPET_T);
    return { side, end, walkSide, walkEnd, parSide, parEnd, merlon };
  }, []);
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos]);

  const merlons = useMemo(() => merlonPlacements(), []);
  const sx = halfW + wallThickness / 2;
  const sz = halfD + wallThickness / 2;
  const parOff = wallThickness / 2 - PARAPET_T / 2;
  const walkY = wallHeight + WALK_T / 2;
  const parY = wallHeight + WALK_T + PARAPET_BASE / 2;

  return (
    <group>
      {/* The wall bodies. */}
      <mesh material={stone} geometry={geos.side} position={[-sx, wallHeight / 2, 0]} />
      <mesh material={stone} geometry={geos.side} position={[sx, wallHeight / 2, 0]} />
      <mesh material={stone} geometry={geos.end} position={[0, wallHeight / 2, -sz]} />
      <mesh material={stone} geometry={geos.end} position={[0, wallHeight / 2, sz]} />

      {/* The wall-walk, a shade paler and a little proud of both faces. */}
      <mesh material={walkway} geometry={geos.walkSide} position={[-sx, walkY, 0]} />
      <mesh material={walkway} geometry={geos.walkSide} position={[sx, walkY, 0]} />
      <mesh material={walkway} geometry={geos.walkEnd} position={[0, walkY, -sz]} />
      <mesh material={walkway} geometry={geos.walkEnd} position={[0, walkY, sz]} />

      {/* The parapet along the outer edge, and its merlons. */}
      <mesh material={stone} geometry={geos.parSide} position={[-sx - parOff, parY, 0]} />
      <mesh material={stone} geometry={geos.parSide} position={[sx + parOff, parY, 0]} />
      <mesh material={stone} geometry={geos.parEnd} position={[0, parY, -sz - parOff]} />
      <mesh material={stone} geometry={geos.parEnd} position={[0, parY, sz + parOff]} />
      <Instanced items={merlons}>
        <primitive object={geos.merlon} attach="geometry" />
        <primitive object={stone} attach="material" />
      </Instanced>

      {BANNER_SPOTS.map((b, i) => (
        <Banner key={`banner-${i}`} {...b} />
      ))}

      <Towers stone={stone} />
    </group>
  );
}
