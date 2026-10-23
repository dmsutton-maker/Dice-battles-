import { troughOf, WaterSurface } from './water';
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
import { createJungleTrayTexture } from './bespokeFloors';
import { BambooDressing, CrownLeaves, SwayingVines, Undergrowth } from './jungleParts';
import { cachedTexture } from './textureCache';
import { ArenaProps } from './arenaProps';
import { Campfire, Crate, Duel, Signpost, EXTRA_SPOTS } from './sceneryProps';
import { palisadeLogs } from './palisade';
import { ARENA_JAILS } from './jailKinds';
import { Jail } from './jails';

/**
 * Jungle Clearing arena — ancient mossy temple ruins deep in a rainforest.
 * Same footprint as the castle (all dimensions from TUNING), so the physics
 * tray, jail slots, retreat towels, and wall-parade slots line up with
 * src/game/Prisoners.tsx unchanged. Purely visual.
 */

const MOSS_STONE = '#6f8257';
const MOSS_STONE_DARK = '#59694a';

/**
 * The palisade is CANE.
 *
 * It was once drawn in the two mossy-stone greens above — the colours the
 * temple ruins are made of — and read as a heap of grey-green sticks. Then
 * it was brown timber, a log cabin. Now it is bamboo (October 2026, the
 * board redesign): yellow-green cane, olive where it has weathered, with
 * a damp moss green kept for the cut tops of the corner poles.
 */
const LOG_PALE = '#c4b86a';
const LOG_DARK = '#8a8c42';
const LOG_MOSSY = '#6d7a3a';
/** How many cane shades the poles are drawn from. */
const LOG_SHADES = 5;
const TRUNK = '#6b4a2c';

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
 * Freedom retreat: same towel/umbrella slot coordinates as the castle's
 * RetreatGarden (kept in sync with src/game/Prisoners.tsx), themed as a
 * jungle explorer camp — leaf mats, tiki parasols, a lagoon pool, ferns.
 */
function JungleRetreat({ padColors }: ArenaProps) {
  const towelXs = RETREAT_XS;
  // A mat per lane, dyed the colour of the prisoner who lands on it —
  // see ArenaProps. The woven greens are the empty-camp fallback.
  const matColors = ['#c9e07a', '#8fd6a8', '#e0d07a', '#a8d67f', '#7fceb0', '#d6c96b'];
  return (
    <group>
      {/* Woven leaf mats the freed prisoners celebrate on */}
      {towelXs.map((x, i) => (
        <mesh key={`mat-${i}`} position={[x, 0.015, RETREAT_Z]}>
          <boxGeometry args={[0.6, 0.03, 0.95]} />
          <meshStandardMaterial
            color={padColors?.[i] ?? matColors[i]}
            roughness={0.95}
          />
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
        <WaterSurface
          look={{ shallow: '#3fb8a0', deep: troughOf('#3fb8a0'), foam: '#e6fbf2', opacity: 1 }}
          shape="round"
          size={[1.84, 1.84]}
          flow={[0.05, 0.03]}
          position={[0, 0.19, 0]}
        />
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

/**
 * The rainforest beyond the fence.
 *
 * Laid out in the box the camera actually sees — x about ±3.9, z from
 * -10.5 to 7.8 (groundTexture.ts has the measurements). The palms, the
 * misty mountains, the canopy mounds and the river this replaced were all
 * placed at |x| 6 to 13 and had never once been on screen. The river now
 * runs down the left-hand strip from a pool by the far corner tree, and
 * the undergrowth and canopy (jungleParts.tsx) fill the rest.
 */
function JungleWorld() {
  // The same ground as the old tray floor, tiled far more times because
  // this plane is 34x40 rather than the tray's few units across.
  const groundTexture = useMemo(
    () =>
      cachedTexture('jungle-ground', () => {
        const texture = createJungleFloorTexture();
        texture.repeat.set(10, 12);
        return texture;
      }),
    [],
  );

  return (
    <group>
      {/* Jungle floor */}
      <mesh position={[0, -0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[34, 40]} />
        {/*
          No colour tint. The texture is already green; multiplying a
          second green over it made the clearing far more saturated than
          the tray floor beside it, and the two met in a hard bright band
          around the arena. Same pixels, same colour, no seam.
        */}
        <meshStandardMaterial map={groundTexture} roughness={1} />
      </mesh>

      {/* Worn dirt trail out toward the player */}
      <mesh position={[0, -0.06, 8.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.7, 6.4]} />
        <meshStandardMaterial color="#7a6040" roughness={1} />
      </mesh>

      {/*
        The river: a pool turning slowly by the far-left tree, and a
        channel running fast down the left of the clearing. A muddy bank
        under each, so the water sits IN the ground.
      */}
      <mesh position={[-3.72, -0.1, -5.75]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.78, 20]} />
        <meshStandardMaterial color="#4a3a26" roughness={1} />
      </mesh>
      <WaterSurface
        look={{ shallow: '#3c8577', deep: troughOf('#3c8577', 0.5), foam: '#cfe6da', opacity: 1 }}
        shape="round"
        size={[1.36, 1.36]}
        flow={[0.1, 0.05]}
        position={[-3.72, -0.08, -5.75]}
      />
      <mesh position={[-3.62, -0.1, -0.35]} rotation={[-Math.PI / 2, 0, 0.03]}>
        <planeGeometry args={[0.78, 10.1]} />
        <meshStandardMaterial color="#4a3a26" roughness={1} />
      </mesh>
      <WaterSurface
        look={{ shallow: '#3c8577', deep: troughOf('#3c8577', 0.5), foam: '#cfe6da', opacity: 1 }}
        shape="square"
        size={[0.6, 10]}
        flow={[0, 0.55]}
        position={[-3.62, -0.085, -0.35]}
        rotationZ={0.03}
      />

      {/* Ferns along the banks and round the back. */}
      <Fern position={[-3.1, -0.08, -2.9]} scale={1.1} />
      <Fern position={[-3.15, -0.08, 1.2]} scale={1.0} />
      <Fern position={[3.2, -0.08, -2.6]} scale={1.2} />
      <Fern position={[3.15, -0.08, 2.75]} scale={1.1} />
      <Fern position={[-2.2, -0.08, -8.0]} scale={1.3} />
      <Fern position={[2.3, -0.08, -7.9]} scale={1.2} />

      <Undergrowth />
    </group>
  );
}

/**
 * The jungle battlefield: a clearing fenced with lashed bamboo, vines
 * hanging over it, buttress trees at the corners where the castle has
 * towers, and roots and leaf litter underfoot. Collision bodies are
 * unchanged in src/physics/world.ts — this is all visual, and the cane
 * stands from the ground to above `wallHeight` (palisade.ts) so a die
 * never stops against nothing.
 */
export function JungleArena({ padColors }: ArenaProps) {
  const { innerWidth, innerDepth, wallHeight, wallThickness } = TUNING.tray;
  const halfW = innerWidth / 2;
  const halfD = innerDepth / 2;

  // The clearing floor: ONE picture of the whole tray, not a tile, so the
  // roots can grow out from the corner trees that own them — see
  // bespokeFloors.ts. The tiling forest floor still carpets the world
  // outside the fence.
  const floorTexture = useMemo(() => cachedTexture('jungle-tray-floor', createJungleTrayTexture), []);
  /**
   * A short ramp of timber shades, picked per log from its own tone. One
   * material per shade rather than one per log: eighty-eight materials
   * would be eighty-eight draw setups for a fence.
   */
  const logMaterials = useMemo(
    () =>
      Array.from({ length: LOG_SHADES }, (_, i) => {
        const t = i / (LOG_SHADES - 1);
        return new THREE.MeshStandardMaterial({
          color: new THREE.Color(LOG_DARK).lerp(new THREE.Color(LOG_PALE), t),
          roughness: 0.95,
        });
      }),
    [],
  );
  /** Weathered green on the cut tops, where the damp sits. */
  const logCapMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: LOG_MOSSY, roughness: 1 }),
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

  // Where each crown's leaves fan out from, just above its ball of foliage.
  const crowns = useMemo<[number, number, number][]>(
    () => [
      [-(halfW + wallThickness), wallHeight * 2.02, -(halfD + wallThickness)],
      [halfW + wallThickness, wallHeight * 2.02, -(halfD + wallThickness)],
      [-(halfW + wallThickness), wallHeight * 2.02, halfD + wallThickness],
      [halfW + wallThickness, wallHeight * 2.02, halfD + wallThickness],
    ],
    [halfW, halfD, wallHeight, wallThickness],
  );

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
      {/* Bamboo cage with vine knots — one jail per board, see jails.tsx. */}
      <Jail kind={ARENA_JAILS.jungle} platform="#75855c" bars="#b8a13f" />
      <JungleRetreat padColors={padColors} />

      {/*
        The surroundings, David 25 Sep 2026: "make the surroundings of
        all arenas on all the maps more decorative and maybe put like
        people fighting on some of them."

        The same coordinates the sixteen themed battlefields use, and
        chosen the same way — outside the tray, clear of every jail and
        retreat slot, inside the frame on both phone shapes, and out of
        the JAIL PEN'S SHADOW. That last one is not something the test
        suite can see: a prop can be perfectly inside the frame and
        perfectly hidden behind a platform standing 1.15 high between it
        and the camera, which is exactly what the first attempt did.
      */}
      {/*
        The fight takes the far-left corner and the crate the near-left
        spot, swapped on 19 Oct 2026 when the fighters started moving: the
        big tree at the near-left corner hides most of that spot from
        this camera, and a fight nobody can see is not worth animating.
        A crate half under a tree is just a crate under a tree. The fight
        sits a little inside the shared far spot, because it circles
        about 0.6 around its centre and from the spot itself that swing
        takes a head over the edge of an iPhone 15's frame.
      */}
      <group key="s0" position={[EXTRA_SPOTS[0][0], 0, EXTRA_SPOTS[0][1]]} scale={0.9}><Crate color="#6e4a28" /></group>
      <group key="s1" position={[EXTRA_SPOTS[1][0], 0, EXTRA_SPOTS[1][1]]} scale={0.95}><Signpost color="#6e4a28" /></group>
      <group key="s2" position={[-3.55, 0, -9.0]} scale={1}><Duel color="#c9a03d" seed={3} /></group>
      <group key="s3" position={[EXTRA_SPOTS[3][0], 0, EXTRA_SPOTS[3][1]]} scale={0.9}><Campfire /></group>
      <group key="s4" position={[EXTRA_SPOTS[4][0], 0, EXTRA_SPOTS[4][1]]} scale={0.85}><Signpost color="#6e4a28" /></group>
      <group key="s5" position={[EXTRA_SPOTS[5][0], 0, EXTRA_SPOTS[5][1]]} scale={0.85}><Crate color="#6e4a28" /></group>
      <group key="s6" position={[EXTRA_SPOTS[6][0], 0, EXTRA_SPOTS[6][1]]} scale={0.85}><Crate color="#6e4a28" /></group>
      <group key="s7" position={[EXTRA_SPOTS[7][0], 0, EXTRA_SPOTS[7][1]]} scale={0.85}><Signpost color="#6e4a28" /></group>

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

      {/*
        The palisade: rails lying along each run, and a stout post at each
        corner. Upright posts were what made this read as a ring of sawn
        stumps — the camera looks down, so a standing log shows you its
        top and nothing else.
      */}
      {logs.map((log, i) => (
        <group key={`log-${i}`} position={log.position} rotation={log.rotation}>
          <mesh
            material={
              logMaterials[
                Math.max(0, Math.min(LOG_SHADES - 1, Math.round(log.tone * (LOG_SHADES - 1))))
              ]
            }
          >
            <cylinderGeometry args={[log.radius, log.radius, log.length, 8]} />
          </mesh>
          {/* Only the corner posts are capped — a rail's ends are hidden
              inside the post it runs into. */}
          {log.upright && (
            <mesh material={logCapMaterial} position={[0, log.length / 2 + 0.03, 0]}>
              <cylinderGeometry args={[log.radius * 0.99, log.radius, 0.07, 8]} />
            </mesh>
          )}
        </group>
      ))}

      {/* Nodes, paired stakes and vine lashings: what makes it bamboo. */}
      <BambooDressing logs={logs} />
      <SwayingVines />

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
          <mesh position={[0, wallHeight * 1.9, 0]} scale={[1, 0.55, 1]}>
            <sphereGeometry args={[0.7, 10, 8]} />
            <meshStandardMaterial color="#2f6b34" roughness={0.9} flatShading />
          </mesh>
          <mesh position={[0.3, wallHeight * 1.7, -0.24]} scale={[1, 0.6, 1]}>
            <sphereGeometry args={[0.5, 9, 7]} />
            <meshStandardMaterial color="#285c2c" roughness={0.9} flatShading />
          </mesh>
        </group>
      ))}
      <CrownLeaves crowns={crowns} />
    </group>
  );
}
