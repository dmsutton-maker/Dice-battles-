import React, { useMemo } from 'react';
import * as THREE from 'three';
import { TUNING } from '../game/tuning';
import {
  RETREAT_POOL,
  RETREAT_POST_XS,
  RETREAT_POST_Z,
  RETREAT_PROPS,
  RETREAT_XS,
  RETREAT_Z,
} from '../game/stations';

import { createJungleFloorTexture } from './jungleFloorTexture';
import { palisadeLogs } from './palisade';

/**
 * Jungle Clearing arena — ancient mossy temple ruins deep in a rainforest.
 * Same footprint as the castle (all dimensions from TUNING), so the physics
 * tray, jail slots, retreat towels, and wall-parade slots line up with
 * src/game/Prisoners.tsx unchanged. Purely visual.
 */

const MOSS_STONE = '#6f8257';
const MOSS_STONE_DARK = '#59694a';
const JUNGLE_FLOOR = '#4d7a3a';
const TRUNK = '#6b4a2c';

/** Palm tree: leaning trunk + a fan of bent frond boxes. */
function Palm({
  position,
  scale = 1,
  lean = 0.12,
  spin = 0,
}: {
  position: [number, number, number];
  scale?: number;
  lean?: number;
  spin?: number;
}) {
  const fronds = useMemo(() => {
    const list: { rotY: number; tilt: number }[] = [];
    for (let i = 0; i < 6; i++) {
      list.push({ rotY: (i / 6) * Math.PI * 2 + spin, tilt: 0.55 + (i % 2) * 0.18 });
    }
    return list;
  }, [spin]);
  return (
    <group position={position} scale={scale} rotation={[0, spin, lean]}>
      {/* Trunk: stacked, slightly offset segments for a curved toy look */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={`seg-${i}`} position={[i * 0.07, 0.35 + i * 0.62, 0]}>
          <cylinderGeometry args={[0.13 - i * 0.012, 0.16 - i * 0.012, 0.7, 7]} />
          <meshStandardMaterial color={TRUNK} roughness={0.9} />
        </mesh>
      ))}
      {/* Fronds */}
      <group position={[0.24, 2.75, 0]}>
        {fronds.map((f, i) => (
          <group key={`frond-${i}`} rotation={[0, f.rotY, 0]}>
            <mesh position={[0.62, 0.05, 0]} rotation={[0, 0, -f.tilt]}>
              <boxGeometry args={[1.25, 0.05, 0.34]} />
              <meshStandardMaterial color="#3f8f3f" roughness={0.85} />
            </mesh>
          </group>
        ))}
        {/* Coconuts */}
        <mesh position={[0.1, -0.12, 0.12]}>
          <sphereGeometry args={[0.11, 8, 6]} />
          <meshStandardMaterial color="#5a4026" roughness={0.9} />
        </mesh>
        <mesh position={[-0.08, -0.14, -0.1]}>
          <sphereGeometry args={[0.1, 8, 6]} />
          <meshStandardMaterial color="#6b4a2c" roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
}

const PALMS: {
  position: [number, number, number];
  scale: number;
  lean: number;
  spin: number;
}[] = [
  { position: [-6.4, -0.1, -3.4], scale: 1.15, lean: 0.14, spin: 0.6 },
  { position: [-7.8, -0.1, -6.6], scale: 1.35, lean: -0.1, spin: 2.1 },
  { position: [6.5, -0.1, -2.8], scale: 1.05, lean: 0.1, spin: 3.4 },
  { position: [7.4, -0.1, -6.0], scale: 1.3, lean: -0.14, spin: 1.2 },
  { position: [-5.8, -0.1, 6.8], scale: 1.2, lean: 0.12, spin: 4.4 },
  { position: [6.2, -0.1, 7.2], scale: 1.3, lean: -0.12, spin: 5.1 },
  { position: [8.4, -0.1, 2.2], scale: 1.0, lean: 0.1, spin: 0.2 },
  { position: [-8.8, -0.1, 0.8], scale: 1.25, lean: -0.1, spin: 2.8 },
  { position: [5.0, -0.1, 9.4], scale: 1.1, lean: 0.14, spin: 3.9 },
  { position: [-4.8, -0.1, -8.6], scale: 1.2, lean: -0.12, spin: 1.7 },
];

/** Big-leaf fern cluster used to dress ruin bases and the retreat. */
function Fern({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh
          key={i}
          position={[Math.cos(i * 1.26) * 0.16, 0.24, Math.sin(i * 1.26) * 0.16]}
          rotation={[0.5, i * 1.26, 0]}
        >
          <coneGeometry args={[0.16, 0.62, 5]} />
          <meshStandardMaterial color="#3a8a44" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Bamboo-cage jail pen behind the far ruin wall — same platform and bar
 * coordinates as the castle's JailPen so prisoner slots line up exactly.
 */
function JungleJailPen() {
  const { innerDepth, wallThickness } = TUNING.tray;
  const { innerWidth: penW, depth: penD, platformHeight, barHeight } = TUNING.prison;
  const zNear = -(innerDepth / 2 + wallThickness);
  const zFar = zNear - penD;
  const zCenter = (zNear + zFar) / 2;
  const halfW = penW / 2;
  const floorY = platformHeight;

  const bars: [number, number][] = [];
  const farCount = 10;
  for (let i = 0; i <= farCount; i++) {
    bars.push([-halfW + (i * penW) / farCount, zFar]);
  }
  const endCount = 3;
  for (let i = 1; i <= endCount; i++) {
    const z = zNear - (i * penD) / (endCount + 1);
    bars.push([-halfW, z]);
    bars.push([halfW, z]);
  }

  return (
    <group>
      {/* Mossy stone platform */}
      <mesh position={[0, floorY / 2, zCenter]}>
        <boxGeometry args={[penW + 0.4, floorY, penD + 0.3]} />
        <meshStandardMaterial color="#75855c" roughness={0.95} />
      </mesh>

      {/* Bamboo bars */}
      {bars.map(([x, z], i) => (
        <mesh key={`bar-${i}`} position={[x, floorY + barHeight / 2, z]}>
          <cylinderGeometry args={[0.05, 0.055, barHeight, 6]} />
          <meshStandardMaterial color="#b8a13f" roughness={0.7} />
        </mesh>
      ))}

      {/* Lashed bamboo top rails */}
      <mesh position={[0, floorY + barHeight, zFar]}>
        <boxGeometry args={[penW + 0.2, 0.09, 0.09]} />
        <meshStandardMaterial color="#8f7c2e" roughness={0.7} />
      </mesh>
      {([-halfW, halfW] as const).map((x, i) => (
        <mesh key={`rail-${i}`} position={[x, floorY + barHeight, zCenter]}>
          <boxGeometry args={[0.09, 0.09, penD + 0.1]} />
          <meshStandardMaterial color="#8f7c2e" roughness={0.7} />
        </mesh>
      ))}

      {/* Carved stone corner totems */}
      {(
        [
          [-halfW, zFar],
          [halfW, zFar],
        ] as const
      ).map(([x, z], i) => (
        <group key={`totem-${i}`} position={[x, 0, z]}>
          <mesh position={[0, (floorY + barHeight + 0.15) / 2, 0]}>
            <boxGeometry args={[0.26, floorY + barHeight + 0.15, 0.26]} />
            <meshStandardMaterial color={MOSS_STONE_DARK} roughness={0.9} />
          </mesh>
          <mesh position={[0, floorY + barHeight + 0.28, 0]}>
            <boxGeometry args={[0.34, 0.26, 0.34]} />
            <meshStandardMaterial color={MOSS_STONE} roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Freedom retreat: same towel/umbrella slot coordinates as the castle's
 * RetreatGarden (kept in sync with src/game/Prisoners.tsx), themed as a
 * jungle explorer camp — leaf mats, tiki parasols, a lagoon pool, ferns.
 */
function JungleRetreat() {
  const towelXs = RETREAT_XS;
  const matColors = ['#c9e07a', '#8fd6a8', '#e0d07a', '#a8d67f', '#7fceb0', '#d6c96b'];
  return (
    <group>
      {/* Woven leaf mats the freed prisoners celebrate on */}
      {towelXs.map((x, i) => (
        <mesh key={`mat-${i}`} position={[x, 0.015, RETREAT_Z]}>
          <boxGeometry args={[0.6, 0.03, 0.95]} />
          <meshStandardMaterial color={matColors[i]} roughness={0.95} />
        </mesh>
      ))}

      {/* Tiki-thatch parasols at the umbrella slots */}
      {RETREAT_POST_XS.map((x, i) => (
        <group key={`tiki-${i}`} position={[x, 0, RETREAT_POST_Z]}>
          <mesh position={[0, 0.7, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 1.4, 7]} />
            <meshStandardMaterial color={TRUNK} roughness={0.9} />
          </mesh>
          <mesh position={[0, 1.42, 0]}>
            <coneGeometry args={[0.9, 0.5, 9]} />
            <meshStandardMaterial color="#c9b356" roughness={0.95} />
          </mesh>
        </group>
      ))}

      {/* Lagoon pool */}
      <group position={[RETREAT_POOL[0], 0, RETREAT_POOL[1]]}>
        <mesh position={[0, 0.09, 0]}>
          <cylinderGeometry args={[1.05, 1.1, 0.18, 20]} />
          <meshStandardMaterial color={MOSS_STONE_DARK} roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.19, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.92, 20]} />
          <meshStandardMaterial color="#3fb8a0" roughness={0.2} />
        </mesh>
      </group>

      {/* Ferns and a jungle flower */}
      <Fern position={[RETREAT_PROPS[0][0], 0, RETREAT_PROPS[0][1]]} scale={1.2} />
      <Fern position={[RETREAT_PROPS[1][0], 0, RETREAT_PROPS[1][1]]} />
      <mesh position={[RETREAT_PROPS[1][0], 0.55, RETREAT_PROPS[1][1]]}>
        <sphereGeometry args={[0.09, 8, 6]} />
        <meshStandardMaterial color="#ff5f9e" roughness={0.6} />
      </mesh>
    </group>
  );
}

/** The rainforest world beyond the ruins. */
function JungleWorld() {
  // The same ground as the tray, tiled far more times because this plane
  // is 34x40 rather than the tray's few units across. It used to be one
  // flat green — the biggest unbroken surface in the arena, and the sort
  // of thing that reads as a backdrop rather than as a place.
  const groundTexture = useMemo(() => {
    const texture = createJungleFloorTexture();
    texture.repeat.set(10, 12);
    return texture;
  }, []);

  return (
    <group>
      {/* Jungle floor */}
      <mesh position={[0, -0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[34, 40]} />
        <meshStandardMaterial map={groundTexture} color={JUNGLE_FLOOR} roughness={1} />
      </mesh>

      {/* Worn dirt trail out toward the player */}
      <mesh position={[0, -0.06, 8.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.7, 6.4]} />
        <meshStandardMaterial color="#8a6b42" roughness={1} />
      </mesh>

      {/* Winding river */}
      <mesh position={[-6.6, -0.05, 2.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.1, 24]} />
        <meshStandardMaterial color="#3fa8c9" roughness={0.25} />
      </mesh>
      <mesh position={[-8.4, -0.055, -1.2]} rotation={[-Math.PI / 2, 0, 0.5]}>
        <planeGeometry args={[1.6, 5.5]} />
        <meshStandardMaterial color="#3fa8c9" roughness={0.25} />
      </mesh>

      {/* Palms */}
      {PALMS.map((palm, i) => (
        <Palm key={`palm-${i}`} {...palm} />
      ))}

      {/* Undergrowth ferns scattered around the clearing */}
      <Fern position={[-4.2, -0.08, 5.2]} scale={1.3} />
      <Fern position={[4.6, -0.08, 4.8]} scale={1.1} />
      <Fern position={[-6.9, -0.08, -1.1]} scale={1.4} />
      <Fern position={[7.6, -0.08, -0.4]} scale={1.2} />
      <Fern position={[3.9, -0.08, -7.9]} scale={1.3} />
      <Fern position={[-3.6, -0.08, -7.4]} scale={1.1} />

      {/* Dense canopy mounds ringing the clearing */}
      {(
        [
          [-12, -1.2, -9, 4.5, '#2f6b34'],
          [12.5, -1.4, -10, 5.2, '#3a7a3e'],
          [0, -2.2, -17, 8.5, '#2a6130'],
          [-13, -1.6, 4, 4.8, '#357238'],
          [13.5, -1.8, 6, 5, '#2f6b34'],
          [-6, -2.0, -14, 6, '#3a7a3e'],
          [7, -2.2, -15, 6.5, '#2a6130'],
        ] as const
      ).map(([x, y, z, r, color], i) => (
        <mesh key={`canopy-${i}`} position={[x, y, z]} scale={[1, 0.55, 1]}>
          <sphereGeometry args={[r, 16, 12]} />
          <meshStandardMaterial color={color} roughness={1} />
        </mesh>
      ))}

      {/* Misty mountains behind the canopy */}
      {(
        [
          [-9.5, -20, 5, 6.5],
          [1.5, -24, 7.5, 9],
          [10.5, -19, 4.6, 5.5],
        ] as const
      ).map(([x, z, r, h], i) => (
        <mesh key={`mtn-${i}`} position={[x, h / 2 - 1.2, z]}>
          <coneGeometry args={[r, h, 10]} />
          <meshStandardMaterial color="#7d9488" roughness={1} />
        </mesh>
      ))}

      {/* Low jungle mist — unlit pale puffs drifting between the trees */}
      {(
        [
          [-7.5, 1.2, -10, 2.2],
          [6.5, 1.6, -12, 2.6],
          [-1.5, 2.2, -15, 3.2],
          [10, 1.0, -8, 1.8],
        ] as const
      ).map(([x, y, z, s], i) => (
        <group key={`mist-${i}`} position={[x, y, z]} scale={[s, s * 0.32, s]}>
          <mesh>
            <sphereGeometry args={[1, 12, 8]} />
            <meshBasicMaterial color="#dcefe2" transparent opacity={0.55} />
          </mesh>
          <mesh position={[1.2, -0.05, 0.2]} scale={0.7}>
            <sphereGeometry args={[1, 12, 8]} />
            <meshBasicMaterial color="#dcefe2" transparent opacity={0.45} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * The jungle-temple battlefield. Mossy ruin walls with cracked slab tops
 * replace the castle battlements; vine-wrapped stone pillars stand where
 * the corner towers were. Collision bodies are unchanged in
 * src/physics/world.ts — this is all visual.
 */
export function JungleArena() {
  const { innerWidth, innerDepth, wallHeight, wallThickness } = TUNING.tray;
  const halfW = innerWidth / 2;
  const halfD = innerDepth / 2;

  const floorTexture = useMemo(() => {
    // Forest floor, not the castle's slabs in green. Repeated a few times
    // across the tray: at one repeat a single leaf would be the size of a
    // die, which reads as wallpaper rather than as ground.
    const texture = createJungleFloorTexture();
    const floorW = innerWidth + wallThickness * 2;
    const floorD = innerDepth + wallThickness * 2;
    const acrossTray = 2.5;
    texture.repeat.set(acrossTray, (acrossTray * floorD) / floorW);
    return texture;
  }, [innerWidth, innerDepth, wallThickness]);

  const wallMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: MOSS_STONE, roughness: 0.95 }),
    [],
  );
  const slabMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: MOSS_STONE_DARK, roughness: 0.95 }),
    [],
  );
  const vineMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#2f7a38', roughness: 0.9 }),
    [],
  );
  const trunkMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: TRUNK, roughness: 0.95 }),
    [],
  );
  const bankMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#4a3a26', roughness: 1 }),
    [],
  );

  /**
   * A log palisade instead of a battlement — the thing that stopped every
   * battlefield looking like the castle. The shape itself lives in
   * ./palisade so it can be measured; nothing here can render a scene to
   * look at, so an unmeasurable shape is one that can quietly go wrong.
   *
   * The physics wall is untouched and still a full-height box (see
   * src/physics/world.ts). The logs stand in front of it.
   */
  const logs = useMemo(() => palisadeLogs(), []);

  /** Vine lashings binding the palisade, at two heights. */
  const lashings = useMemo(() => {
    const list: { pos: [number, number, number]; size: [number, number, number] }[] = [];
    for (const y of [wallHeight * 0.3, wallHeight * 0.72]) {
      list.push({
        pos: [0, y, -(halfD + wallThickness / 2)],
        size: [innerWidth + wallThickness * 2, 0.07, wallThickness + 0.08],
      });
      list.push({
        pos: [0, y, halfD + wallThickness / 2],
        size: [innerWidth + wallThickness * 2, 0.07, wallThickness + 0.08],
      });
      list.push({
        pos: [-(halfW + wallThickness / 2), y, 0],
        size: [wallThickness + 0.08, 0.07, innerDepth + wallThickness * 2],
      });
      list.push({
        pos: [halfW + wallThickness / 2, y, 0],
        size: [wallThickness + 0.08, 0.07, innerDepth + wallThickness * 2],
      });
    }
    return list;
  }, [halfW, halfD, innerWidth, innerDepth, wallHeight, wallThickness]);

  // Vine patches climbing the outer wall faces.
  const vines = useMemo(() => {
    const list: { pos: [number, number, number]; size: [number, number, number] }[] = [];
    const outerZ = halfD + wallThickness + 0.01;
    const outerX = halfW + wallThickness + 0.01;
    for (let i = 0; i < 4; i++) {
      const x = -halfW + 0.8 + i * 1.1;
      list.push({ pos: [x, wallHeight * 0.55, outerZ], size: [0.3, wallHeight * 0.9, 0.05] });
      list.push({ pos: [x + 0.4, wallHeight * 0.4, -outerZ], size: [0.26, wallHeight * 0.7, 0.05] });
    }
    for (let i = 0; i < 5; i++) {
      const z = -halfD + 1 + i * 1.8;
      list.push({ pos: [outerX, wallHeight * 0.5, z], size: [0.05, wallHeight * 0.8, 0.3] });
      list.push({ pos: [-outerX, wallHeight * 0.6, z + 0.5], size: [0.05, wallHeight * 0.85, 0.26] });
    }
    return list;
  }, [halfW, halfD, wallHeight, wallThickness]);

  const pillarPositions: [number, number][] = [
    [-(halfW + wallThickness), -(halfD + wallThickness)],
    [halfW + wallThickness, -(halfD + wallThickness)],
    [-(halfW + wallThickness), halfD + wallThickness],
    [halfW + wallThickness, halfD + wallThickness],
  ];

  return (
    <group>
      {/* Temple floor */}
      <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry
          args={[innerWidth + wallThickness * 2, innerDepth + wallThickness * 2]}
        />
        <meshStandardMaterial map={floorTexture} roughness={0.95} />
      </mesh>

      <JungleWorld />
      <JungleJailPen />
      <JungleRetreat />

      {/*
        A low earth bank the logs are driven into, only knee-high, so what
        you see above it is the palisade and not a wall. The full-height
        collision box is separate and invisible.
      */}
      {(
        [
          [-(halfW + wallThickness / 2), 0, wallThickness, innerDepth + wallThickness * 2],
          [halfW + wallThickness / 2, 0, wallThickness, innerDepth + wallThickness * 2],
          [0, -(halfD + wallThickness / 2), innerWidth + wallThickness * 2, wallThickness],
          [0, halfD + wallThickness / 2, innerWidth + wallThickness * 2, wallThickness],
        ] as const
      ).map(([x, z, w, d], i) => (
        <mesh key={`bank-${i}`} material={bankMaterial} position={[x, 0.16, z]}>
          <boxGeometry args={[w, 0.32, d]} />
        </mesh>
      ))}

      {/* The palisade itself */}
      {logs.map((log, i) => (
        <group key={`log-${i}`} position={log.position} rotation={log.rotation}>
          <mesh material={i % 3 === 0 ? slabMaterial : wallMaterial}>
            <cylinderGeometry args={[log.radius * 0.86, log.radius, log.height, 7]} />
          </mesh>
          {/* Cut at an angle, so the tops are points rather than a line. */}
          <mesh material={slabMaterial} position={[0, log.height / 2 + 0.06, 0]}>
            <coneGeometry args={[log.radius * 0.92, 0.18, 7]} />
          </mesh>
        </group>
      ))}

      {/* Vine lashings binding the logs together */}
      {lashings.map((l, i) => (
        <mesh key={`lash-${i}`} material={vineMaterial} position={l.pos}>
          <boxGeometry args={l.size} />
        </mesh>
      ))}

      {/* Climbing vines */}
      {vines.map((v, i) => (
        <mesh key={`vine-${i}`} material={vineMaterial} position={v.pos}>
          <boxGeometry args={v.size} />
        </mesh>
      ))}

      {/*
        Buttress trees at the corners, where the castle has round towers.
        A tower is the other half of what made every arena read as a
        castle — four cylinders with a cap on, one at each corner, is a
        keep whatever colour it is painted. These flare outward at the
        base into roots, which no tower does.
      */}
      {pillarPositions.map(([x, z], i) => (
        <group key={`buttress-${i}`} position={[x, 0, z]} rotation={[0, i * 0.9, 0]}>
          {/* Roots spreading out where a tower would meet the ground. */}
          {[0, 1, 2, 3, 4].map((r) => (
            <mesh
              key={`root-${r}`}
              material={trunkMaterial}
              position={[
                Math.cos((r / 5) * Math.PI * 2) * 0.42,
                0.16,
                Math.sin((r / 5) * Math.PI * 2) * 0.42,
              ]}
              rotation={[0, -(r / 5) * Math.PI * 2, 0.5]}
            >
              <boxGeometry args={[0.7, 0.26, 0.2]} />
            </mesh>
          ))}
          <mesh material={trunkMaterial} position={[0, wallHeight * 0.9, 0]}>
            <cylinderGeometry args={[0.3, 0.52, wallHeight * 1.8, 7]} />
          </mesh>
          {/* Canopy well above the wall, so the corners break the skyline
              upward instead of capping it flat like a battlement. */}
          <mesh position={[0, wallHeight * 1.95, 0]} scale={[1, 0.62, 1]}>
            <sphereGeometry args={[0.86, 10, 8]} />
            <meshStandardMaterial color="#3f8f3f" roughness={0.9} />
          </mesh>
          <mesh position={[0.3, wallHeight * 1.7, -0.24]} scale={[1, 0.6, 1]}>
            <sphereGeometry args={[0.52, 9, 7]} />
            <meshStandardMaterial color="#357b35" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
