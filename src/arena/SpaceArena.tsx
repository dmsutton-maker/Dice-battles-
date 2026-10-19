import React, { useMemo, useRef } from 'react';
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

import { createDeckGlowTexture, createDeckTexture, createFieldTexture } from './bespokeFloors';
import { DeckApron, HullBulwark, TheDrop, useBlink } from './spaceParts';
import { cachedTexture } from './textureCache';
import { ArenaProps } from './arenaProps';
import { Crate, Signpost, EXTRA_SPOTS } from './sceneryProps';
import { ARENA_JAILS } from './jailKinds';
import { Jail } from './jails';
import { useSceneryTick } from './sceneryClock';
import { SpaceDogfight } from './spaceDogfight';

/**
 * Space Station arena — the 700🏆 Mystery Arena. A dice deck floating in
 * orbit: lit deck plates with hazard striping, a bolted hull bulwark with
 * a containment field above it, antenna pylons, and past the deck edge a
 * long drop to a ringed planet and the stars (spaceParts.tsx). Same
 * footprint as the castle (dimensions from TUNING) so physics and every
 * prisoner slot line up unchanged.
 *
 * Glowing accents use MeshBasicMaterial (unlit) with toneMapped:false so
 * they read as emissive light sources without a bloom pass.
 */

const HULL = '#8a93a8';
const HULL_DARK = '#5c6478';
const GLOW_CYAN = '#3ff2ff';
/**
 * How much of the boundary is solid hull. The rest is the containment
 * field: see-through, so the deck reads as open rather than walled in.
 * Knee-high on the dice, which is enough to look like a real edge you
 * could trip over without becoming a wall.
 */
const RIM_HEIGHT = 0.55;
const GLOW_MAGENTA = '#ff5fd0';

/**
 * Freedom retreat: same landing-slot coordinates as the castle's
 * RetreatGarden (synced with src/game/Prisoners.tsx), themed as a shuttle
 * bay — glowing landing pads, beacon masts, a cryo-pool, and crate stacks.
 */
function SpaceRetreat({ padColors }: ArenaProps) {
  const padXs = RETREAT_XS;
  /*
    Each bay lights up in its lane's colour — David, 20 Sep 2026, so a
    rescued soldier lands on the pad that matches it. The station's own
    neon is the fallback for when no round is being played.

    The light is a PANEL rather than the little ring it used to be: a
    ring of radius 0.26 sat entirely underneath the figure standing on
    it, so the one arena where the pads already glowed was the one where
    you could not see what colour they were.
  */
  const neon = ['#3ff2ff', '#7fff9e', '#ffd93f', '#ff9e5f', '#c98aff', '#ff5fd0'];
  return (
    <group>
      {/* Glowing landing pads where freed prisoners celebrate */}
      {padXs.map((x, i) => (
        <group key={`pad-${i}`} position={[x, 0, RETREAT_Z]}>
          <mesh position={[0, 0.015, 0]}>
            <boxGeometry args={[0.62, 0.03, 0.97]} />
            <meshStandardMaterial color={HULL_DARK} roughness={0.5} metalness={0.5} />
          </mesh>
          <mesh position={[0, 0.032, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.46, 0.8]} />
            <meshBasicMaterial color={padColors?.[i] ?? neon[i]} toneMapped={false} />
          </mesh>
          {/* The landing reticle, dark on the lit panel. */}
          <mesh position={[0, 0.034, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.18, 0.26, 16]} />
            <meshBasicMaterial color={HULL_DARK} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* Beacon masts at the umbrella slots */}
      {[GLOW_CYAN, GLOW_MAGENTA].map((color, i) => (
        <group
          key={`beacon-${i}`}
          position={[RETREAT_POST_XS[i], 0, RETREAT_POST_Z]}
        >
          <mesh position={[0, 0.7, 0]}>
            <cylinderGeometry args={[0.04, 0.05, 1.4, 8]} />
            <meshStandardMaterial color={HULL} roughness={0.4} metalness={0.6} />
          </mesh>
          <mesh position={[0, 1.48, 0]}>
            <sphereGeometry args={[0.16, 12, 10]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
          <mesh position={[0, 1.32, 0]}>
            <coneGeometry args={[0.24, 0.16, 10]} />
            <meshStandardMaterial color={HULL_DARK} roughness={0.4} metalness={0.6} />
          </mesh>
        </group>
      ))}

      {/* Cryo-pool (same spot as the castle pool) */}
      <group position={[RETREAT_POOL[0], 0, RETREAT_POOL[1]]}>
        <mesh position={[0, 0.09, 0]}>
          <cylinderGeometry args={[1.05, 1.1, 0.18, 20]} />
          <meshStandardMaterial color={HULL_DARK} roughness={0.5} metalness={0.5} />
        </mesh>
        <mesh position={[0, 0.19, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.92, 20]} />
          <meshBasicMaterial color="#5fd8ff" toneMapped={false} transparent opacity={0.9} />
        </mesh>
      </group>

      {/* Supply crate stacks where the castle bushes were */}
      {RETREAT_PROPS.map(([x, z], i) => (
        <group key={`crates-${i}`} position={[x, 0, z]}>
          <mesh position={[0, 0.2, 0]}>
            <boxGeometry args={[0.5, 0.4, 0.5]} />
            <meshStandardMaterial color="#6b7488" roughness={0.5} metalness={0.4} />
          </mesh>
          <mesh position={[0.12, 0.55, -0.05]} rotation={[0, 0.5, 0]}>
            <boxGeometry args={[0.34, 0.3, 0.34]} />
            <meshStandardMaterial color="#8a93a8" roughness={0.5} metalness={0.4} />
          </mesh>
          <mesh position={[0.12, 0.72, -0.05]}>
            <sphereGeometry args={[0.05, 8, 6]} />
            <meshBasicMaterial color="#7fff9e" toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * The orbital surroundings: the deck apron the tray is set into, the
 * glowing walkway to the shuttle bay, and the drop past the deck's edge.
 */
function SpaceWorld() {
  return (
    <group>
      <DeckApron />

      {/* Glowing walkway strip toward the player (replaces the dirt path) */}
      <mesh position={[0, -0.055, 8.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.7, 6.4]} />
        <meshBasicMaterial color="#1f5f7a" toneMapped={false} />
      </mesh>
      {[6.2, 7.4, 8.6, 9.8].map((z, i) => (
        <mesh key={`chevron-${i}`} position={[0, -0.05, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.2, 0.18]} />
          <meshBasicMaterial color={GLOW_CYAN} toneMapped={false} />
        </mesh>
      ))}

      <TheDrop />
    </group>
  );
}

/**
 * The space-station battlefield. A bulwark of hull plates with light in
 * its seams and a containment field above it replaces the castle
 * battlements; antenna pylons with blinking beacons stand at the corners.
 * Collision bodies are unchanged in src/physics/world.ts — all visual.
 */
export function SpaceArena({ padColors }: ArenaProps) {
  const { innerWidth, innerDepth, wallHeight, wallThickness } = TUNING.tray;
  const halfW = innerWidth / 2;
  const halfD = innerDepth / 2;

  // Deck plates, and the light the deck gives off — painted together so
  // each lamp sits in its own slot (bespokeFloors.ts).
  const floorTexture = useMemo(() => cachedTexture('space-floor', createDeckTexture), []);
  const floorGlow = useMemo(() => cachedTexture('space-floor-glow', createDeckGlowTexture), []);
  const fieldAlpha = useMemo(() => cachedTexture('space-field', createFieldTexture), []);

  const wallMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: HULL, roughness: 0.45, metalness: 0.5 }),
    [],
  );
  const stripMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: GLOW_CYAN, toneMapped: false }),
    [],
  );
  /**
   * The containment field. Unlit and see-through, drawn on both sides so
   * it reads the same looking out from the deck as looking in — a
   * one-sided panel would vanish from whichever side the camera is on.
   */
  const fieldMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: GLOW_CYAN,
        transparent: true,
        // Rising off the hull and fading as it climbs: see createFieldTexture.
        alphaMap: fieldAlpha,
        opacity: 0.3,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
      }),
    [fieldAlpha],
  );

  // Glowing light strips along every wall top — the station's "battlements".
  const strips = useMemo(() => {
    // On the rim, not at wall height: the wall above the rim is a
    // see-through field now, so a light strip up there would be a glowing
    // line floating in the air.
    const y = RIM_HEIGHT + 0.012;
    return [
      { pos: [0, y, -(halfD + wallThickness / 2)] as const, size: [innerWidth, 0.03, 0.07] as const },
      { pos: [0, y, halfD + wallThickness / 2] as const, size: [innerWidth, 0.03, 0.07] as const },
      { pos: [-(halfW + wallThickness / 2), y, 0] as const, size: [0.07, 0.03, innerDepth] as const },
      { pos: [halfW + wallThickness / 2, y, 0] as const, size: [0.07, 0.03, innerDepth] as const },
    ];
  }, [halfW, halfD, wallThickness, innerWidth, innerDepth]);

  /**
   * Vents low on the rim, where the portholes used to be.
   *
   * Portholes need a wall to be set into. They sat at 55% of wall height,
   * which is now open field — they would have hung in mid-air. Dropped to
   * the rim they read as deck vents, which is what a low hull edge would
   * actually carry.
   */
  const portholes = useMemo(() => {
    const list: { pos: [number, number, number]; rotY: number }[] = [];
    const y = RIM_HEIGHT * 0.55;
    for (let i = 0; i < 4; i++) {
      const x = -halfW + 0.9 + i * 1.0;
      list.push({ pos: [x, y, -(halfD - 0.01)], rotY: 0 });
      list.push({ pos: [x, y, halfD - 0.01], rotY: Math.PI });
    }
    for (let i = 0; i < 5; i++) {
      const z = -halfD + 1.2 + i * 1.7;
      list.push({ pos: [-(halfW - 0.01), y, z], rotY: Math.PI / 2 });
      list.push({ pos: [halfW - 0.01, y, z], rotY: -Math.PI / 2 });
    }
    return list;
  }, [halfW, halfD]);

  // The pylon beacons flash in turn round the deck (spaceParts.useBlink).
  const beacons = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  useBlink(beacons);
  // The deck's inset lamps breathe, slowly — the station is running.
  const floorMaterial = useRef<THREE.MeshStandardMaterial>(null);
  const breathe = useMemo(
    () => (t: number) => {
      if (floorMaterial.current) floorMaterial.current.emissiveIntensity = 0.85 + Math.sin(t * 1.4) * 0.2;
    },
    [],
  );
  useSceneryTick(breathe);

  const pylonPositions: [number, number][] = [
    [-(halfW + wallThickness), -(halfD + wallThickness)],
    [halfW + wallThickness, -(halfD + wallThickness)],
    [-(halfW + wallThickness), halfD + wallThickness],
    [halfW + wallThickness, halfD + wallThickness],
  ];

  return (
    <group>
      {/* Deck floor */}
      <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry
          args={[innerWidth + wallThickness * 2, innerDepth + wallThickness * 2]}
        />
        <meshStandardMaterial
          ref={floorMaterial}
          map={floorTexture}
          emissiveMap={floorGlow}
          emissive="#ffffff"
          emissiveIntensity={0.9}
          roughness={0.6}
          metalness={0.35}
        />
      </mesh>

      <SpaceWorld />
      {/* Ships chasing each other in the space beside the deck (spaceDogfight.tsx). */}
      <SpaceDogfight />
      {/* Force-field cell — one jail per board, see jails.tsx. */}
      <Jail kind={ARENA_JAILS.space} platform={HULL_DARK} bars={GLOW_CYAN} />
      <SpaceRetreat padColors={padColors} />

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
      <group key="s0" position={[EXTRA_SPOTS[0][0], 0, EXTRA_SPOTS[0][1]]} scale={1}><Signpost color="#3d4457" /></group>
      <group key="s1" position={[EXTRA_SPOTS[1][0], 0, EXTRA_SPOTS[1][1]]} scale={0.95}><Signpost color="#3d4457" /></group>
      <group key="s2" position={[EXTRA_SPOTS[2][0], 0, EXTRA_SPOTS[2][1]]} scale={0.9}><Crate color="#3d4457" /></group>
      <group key="s3" position={[EXTRA_SPOTS[3][0], 0, EXTRA_SPOTS[3][1]]} scale={0.9}><Crate color="#3d4457" /></group>
      <group key="s4" position={[EXTRA_SPOTS[4][0], 0, EXTRA_SPOTS[4][1]]} scale={0.85}><Crate color="#3d4457" /></group>
      <group key="s5" position={[EXTRA_SPOTS[5][0], 0, EXTRA_SPOTS[5][1]]} scale={0.85}><Crate color="#3d4457" /></group>
      <group key="s6" position={[EXTRA_SPOTS[6][0], 0, EXTRA_SPOTS[6][1]]} scale={0.85}><Crate color="#4c5170" /></group>
      <group key="s7" position={[EXTRA_SPOTS[7][0], 0, EXTRA_SPOTS[7][1]]} scale={0.85}><Crate color="#4c5170" /></group>

      {/*
        A knee-high hull rim, and above it a containment field.
        
        The station used to be four full-height solid walls — the castle's
        walls in grey, which is why it read as a castle in space. It is now
        mostly OPEN: you can see out across the deck in every direction,
        and what stops the dice is light rather than stone.
        
        The physics boundary has not moved. It is still a full-height
        invisible box (src/physics/world.ts), and the field panel is drawn
        at exactly that height so a die visibly stops where it always did
        rather than appearing to halt in mid-air.
      */}
      <HullBulwark rimHeight={RIM_HEIGHT} />

      {/* The containment field: full height, and you can see through it. */}
      {(
        [
          [-(halfW + wallThickness / 2), 0, 0.06, innerDepth + wallThickness * 2],
          [halfW + wallThickness / 2, 0, 0.06, innerDepth + wallThickness * 2],
          [0, -(halfD + wallThickness / 2), innerWidth + wallThickness * 2, 0.06],
          [0, halfD + wallThickness / 2, innerWidth + wallThickness * 2, 0.06],
        ] as const
      ).map(([x, z, w, d], i) => (
        <mesh key={`field-${i}`} material={fieldMaterial} position={[x, wallHeight / 2 + RIM_HEIGHT / 2, z]}>
          <boxGeometry args={[w, wallHeight - RIM_HEIGHT, d]} />
        </mesh>
      ))}

      {/* Light strips along the wall tops */}
      {strips.map((s, i) => (
        <mesh key={`strip-${i}`} material={stripMaterial} position={[...s.pos]}>
          <boxGeometry args={[...s.size]} />
        </mesh>
      ))}

      {/* Portholes */}
      {portholes.map((p, i) => (
        <mesh key={`porthole-${i}`} position={p.pos} rotation={[0, p.rotY, 0]}>
          <circleGeometry args={[0.14, 12]} />
          <meshBasicMaterial color="#0a0e2a" toneMapped={false} />
        </mesh>
      ))}

      {/* Corner antenna pylons */}
      {pylonPositions.map(([x, z], i) => (
        <group key={`pylon-${i}`} position={[x, 0, z]}>
          {/*
            A thin mast on a small base, not a tower. At 0.42-0.55 radius
            and full wall height these were the castle's corner towers in
            grey — four cylinders with a cap on is a keep whatever colour
            it is painted, and it was half of why this read as a castle in
            space.
          */}
          <mesh material={wallMaterial} position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.34, 0.44, 0.24, 8]} />
          </mesh>
          <mesh material={wallMaterial} position={[0, wallHeight * 0.85, 0]}>
            <cylinderGeometry args={[0.07, 0.11, wallHeight * 1.5, 6]} />
          </mesh>
          <mesh material={wallMaterial} position={[0, wallHeight + 0.75, 0]}>
            <cylinderGeometry args={[0.05, 0.08, 0.7, 6]} />
          </mesh>
          <mesh position={[0, wallHeight + 1.14, 0]}>
            <sphereGeometry args={[0.11, 10, 8]} />
            <meshBasicMaterial
              ref={(m) => {
                beacons.current[i] = m;
              }}
              color={i % 2 === 0 ? GLOW_CYAN : GLOW_MAGENTA}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
