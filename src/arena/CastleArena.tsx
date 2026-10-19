import { troughOf, WaterSurface } from './water';
import React, { useMemo } from 'react';
import { TUNING } from '../game/tuning';
import {
  RETREAT_POOL,
  RETREAT_POST_XS,
  RETREAT_POST_Z,
  RETREAT_PROPS,
  RETREAT_XS,
  RETREAT_Z,
} from '../game/stations';

import {
  createCourtyardFloorTexture,
  createMeadowTexture,
  createSunsetFloorTexture,
} from './bespokeFloors';
import { CastleBackdrop, CourtyardWalls } from './castleParts';
import { DuskSurroundings, RuinWalls } from './ruinParts';
import { cachedTexture } from './textureCache';
import { ArenaProps } from './arenaProps';
import { Campfire, Crate, Duel, Signpost, EXTRA_SPOTS } from './sceneryProps';

/**
 * Where the two fights stand, by day and at dusk; see the note at their
 * mount. Both pairs sit a little inside the shared far spots: a fight
 * circles about 0.6 around its spot, and from the far spots that swing
 * takes a head over the edge of an iPhone 15's frame.
 */
const DAY_DUEL_X = 3.55;
const DAY_DUEL_Z = -9.0;
const DUSK_DUEL_X = 3.6;
const DUSK_DUEL_Z = -8.2;
import { ARENA_JAILS } from './jailKinds';
import { Jail } from './jails';

const STONE_DARK = '#7d6e58';

/** Palette knobs that differ between the day and sunset variants. */
const VARIANTS = {
  day: {
    water: '#4a8fc0',
    umbrellaA: '#ff7f66',
    umbrellaB: '#5bc8e8',
    path: '#c7ad83',
    dusk: false,
  },
  /*
   * Dusk. Only the retreat's few colours live here now: the walls, the
   * floor and the world around them are two different PLACES (see
   * castleParts.tsx and ruinParts.tsx), not one place in two palettes —
   * which is what the family reported on 20 Aug 2026, "the sunset castle
   * doesn't really look any different from the regular".
   */
  sunset: {
    water: '#c9743f',
    umbrellaA: '#d96b3c',
    umbrellaB: '#8b5cc4',
    path: '#6e5a4c',
    dusk: true,
  },
} as const;
export type CastleVariant = keyof typeof VARIANTS;
type Palette = (typeof VARIANTS)[CastleVariant];

/**
 * The freedom retreat on the player's side of the castle — the rescuer's
 * camp where freed prisoners come to relax: beach towels to land on, two
 * sun umbrellas, a little pool, and flowering bushes. Slot positions must
 * stay in sync with the free slots in src/game/Prisoners.tsx.
 */
function RetreatGarden({ palette, padColors }: { palette: Palette } & ArenaProps) {
  const towelXs = RETREAT_XS;
  /*
    The pastels are the fallback now, not the look.

    Each towel has always been its own colour — they were simply six
    pretty ones in no particular order. David asked on 20 Sep 2026 for
    the platforms to be the colours actually in play, so the towel takes
    the colour of the prisoner whose lane it is, and a soldier walks out
    of the cell above onto a towel that matches. These six are what is
    laid out when no round is being played.
  */
  const towelColors = ['#ffe08a', '#9be0ff', '#ffc4d6', '#c9f0b8', '#e8d5ff', '#ffd7b0'];
  return (
    <group>
      {/* Beach towels the freed prisoners celebrate on */}
      {towelXs.map((x, i) => (
        <mesh key={`towel-${i}`} position={[x, 0.015, RETREAT_Z]}>
          <boxGeometry args={[0.6, 0.03, 0.95]} />
          <meshStandardMaterial
            color={padColors?.[i] ?? towelColors[i]}
            roughness={0.9}
          />
        </mesh>
      ))}

      {/* Sun umbrellas */}
      {[palette.umbrellaA, palette.umbrellaB].map((color, i) => (
        <group
          key={`umbrella-${i}`}
          position={[RETREAT_POST_XS[i], 0, RETREAT_POST_Z]}
        >
          <mesh position={[0, 0.7, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 1.4, 8]} />
            <meshStandardMaterial color="#e8e0d0" roughness={0.7} />
          </mesh>
          <mesh position={[0, 1.42, 0]}>
            <coneGeometry args={[0.85, 0.42, 10]} />
            <meshStandardMaterial color={color} roughness={0.7} />
          </mesh>
        </group>
      ))}

      {/* Little pool */}
      <group position={[RETREAT_POOL[0], 0, RETREAT_POOL[1]]}>
        <mesh position={[0, 0.09, 0]}>
          <cylinderGeometry args={[1.05, 1.1, 0.18, 20]} />
          <meshStandardMaterial color="#bcae94" roughness={0.9} />
        </mesh>
        {/* Moving water, like every pond in the game — see water.tsx. */}
        <WaterSurface
          look={{ shallow: palette.water, deep: troughOf(palette.water), foam: '#f2fbff', opacity: 1 }}
          shape="round"
          size={[1.84, 1.84]}
          flow={[0.05, 0.03]}
          position={[0, 0.19, 0]}
        />
      </group>

      {/* Flowering bushes */}
      {RETREAT_PROPS.map(([x, z], i) => (
        <group key={`bush-${i}`} position={[x, 0, z]}>
          <mesh position={[0, 0.28, 0]} scale={[1, 0.72, 1]}>
            <sphereGeometry args={[0.42, 12, 8]} />
            <meshStandardMaterial color="#48a457" roughness={0.9} />
          </mesh>
          {[0, 1, 2].map((k) => (
            <mesh
              key={k}
              position={[
                Math.cos(k * 2.1) * 0.3,
                0.42 + Math.sin(k * 1.7) * 0.12,
                Math.sin(k * 2.1) * 0.3,
              ]}
            >
              <sphereGeometry args={[0.07, 8, 6]} />
              <meshStandardMaterial color={['#ff8ab0', '#ffe521', '#ff7f66'][k]} roughness={0.6} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/**
 * The world around the day castle: a mown lawn, a gravel apron at the foot
 * of the walls, and a moat down both long sides.
 *
 * Everything here is inside the box the camera actually sees — x about
 * ±3.9, z from -10.5 to 7.8 (see groundTexture.ts for how that was
 * measured). The hills, mountains, clouds and trees this replaced were
 * all outside it: they had never once been on screen, and they were
 * still being drawn. The moat is the opposite — it fills exactly the
 * strip of ground the camera has either side of the tray, so the default
 * board reads as a castle in its own water instead of a box on a lawn.
 */
function DayLandscape({ palette }: { palette: Palette }) {
  const { innerWidth, innerDepth, wallThickness } = TUNING.tray;
  const outerX = innerWidth / 2 + wallThickness;
  const outerZ = innerDepth / 2 + wallThickness;
  const lawn = useMemo(
    () =>
      cachedTexture('castle-meadow', () => {
        const t = createMeadowTexture();
        // 128 texels to 3.2 world units, so the lawn is as sharp as the floor.
        t.repeat.set(16 / 3.2, 22 / 3.2);
        return t;
      }),
    [],
  );
  const moat = { from: -outerZ + 0.35, to: outerZ - 0.55, inner: outerX + 0.23, outer: outerX + 1.13 };
  const moatLen = moat.to - moat.from;
  const moatMid = (moat.to + moat.from) / 2;
  const moatW = moat.outer - moat.inner;
  return (
    <group>
      <mesh position={[0, -0.12, -1]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[16, 22]} />
        <meshStandardMaterial map={lawn} roughness={1} />
      </mesh>
      {/* Gravel apron at the foot of the walls. */}
      <mesh position={[0, -0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[outerX * 2 + 0.4, outerZ * 2 + 0.4]} />
        <meshStandardMaterial color="#b9ad95" roughness={1} />
      </mesh>
      {/* Path from the near gate out toward the player. */}
      <mesh position={[0, -0.09, 8.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.7, 6.4]} />
        <meshStandardMaterial color={palette.path} roughness={1} />
      </mesh>

      {/* The moat, both sides: moving water inside a cut-stone kerb. */}
      {([-1, 1] as const).map((side) => (
        <group key={`moat-${side}`}>
          <WaterSurface
            look={{ shallow: palette.water, deep: troughOf(palette.water, 0.5), foam: '#d4e6ee', opacity: 1 }}
            shape="square"
            size={[moatW, moatLen]}
            flow={[0, 0.06]}
            position={[side * (moat.inner + moatW / 2), -0.085, moatMid]}
          />
          {[moat.inner - 0.04, moat.outer + 0.04].map((x, k) => (
            <mesh key={k} position={[side * x, -0.04, moatMid]}>
              <boxGeometry args={[0.1, 0.12, moatLen + 0.18]} />
              <meshStandardMaterial color="#a8a294" roughness={0.95} />
            </mesh>
          ))}
          {[moat.from - 0.05, moat.to + 0.05].map((z, k) => (
            <mesh key={`end-${k}`} position={[side * (moat.inner + moatW / 2), -0.04, z]}>
              <boxGeometry args={[moatW + 0.18, 0.12, 0.1]} />
              <meshStandardMaterial color="#a8a294" roughness={0.95} />
            </mesh>
          ))}
        </group>
      ))}

      <CastleBackdrop />
    </group>
  );
}

/**
 * The castle-courtyard battlefield, and its dusk twin. Purely visual — the
 * matching collision bodies live in src/physics/world.ts.
 *
 * Two places, not one place in two palettes. By day: dressed stone, a
 * wall-walk behind a regular crenellated parapet, coral-roofed towers with
 * pennants, flagstones, a lawn and a moat (castleParts.tsx). At sunset:
 * the same castle centuries on — a broken, ivy-grown ruin of loose blocks,
 * roofless tower stumps, braziers, cobbles with lantern pools and long
 * shadows, and the black shapes of fallen towers against the last light
 * (ruinParts.tsx, ruin.ts). Both stand on the tray walls exactly: the
 * walls are drawn to `wallHeight` and above, so a die never stops against
 * nothing.
 */
export function CastleArena({
  variant = 'day',
  padColors,
}: { variant?: CastleVariant } & ArenaProps) {
  const palette: Palette = VARIANTS[variant];
  const dusk = palette.dusk;
  const { innerWidth, innerDepth, wallThickness } = TUNING.tray;

  // One picture of the whole floor each, cached across mounts — see
  // bespokeFloors.ts for why they are painted whole rather than tiled.
  const floorTexture = useMemo(
    () =>
      dusk
        ? cachedTexture('castle-sunset-floor', createSunsetFloorTexture)
        : cachedTexture('castle-floor', createCourtyardFloorTexture),
    [dusk],
  );

  return (
    <group>
      {/* Courtyard floor */}
      <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry
          args={[innerWidth + wallThickness * 2, innerDepth + wallThickness * 2]}
        />
        <meshStandardMaterial map={floorTexture} roughness={0.95} />
      </mesh>

      {dusk ? <DuskSurroundings /> : <DayLandscape palette={palette} />}

      {/*
        The surroundings, David 25 Sep 2026: "make the surroundings of
        all arenas on all the maps more decorative and maybe put like
        people fighting on some of them."

        The same coordinates the sixteen themed battlefields use, and
        chosen the same way — outside the tray, clear of every jail and
        retreat slot, inside the frame on both phone shapes, and out of
        the JAIL PEN'S SHADOW. That last one is not something the test
        suite can see: a prop can be perfectly inside the frame and
        perfectly hidden behind a platform that stands 1.15 high between
        it and the camera, which is exactly what the first attempt at
        these did.

        By day the four side spots are in the moat, so only the back four
        are dressed. At dusk the two far ones hold the fallen towers
        (DUSK_SILHOUETTES in ruin.ts) and the four side ones are dressed.
      */}
      {/*
        By day the fights go beside the gatehouse, just inside the far
        pair of spots, and the campfire and crate under the corner towers. It was the other
        way round until the fighters started moving (19 Oct 2026): the
        coral roofs of the two corner towers cover most of the near pair
        from this camera, which hid half of each fight, and a campfire
        half under a roof is nothing anyone looks for. At dusk the far
        pair hold the fallen towers, the corner towers are stumps with no
        roof, and the fights go back toward the near pair — but not onto
        it. The far stumps stand eight courses high, and from this camera
        their broken tops lean out over the ground at (±3.85, -7), so a
        fight placed exactly on the spot was two heads behind a wall. A
        little further back and a little further in, it stands on open
        sand between the stump and the fallen tower.
      */}
      {dusk ? (
        <>
          <group key="s0" position={[-DUSK_DUEL_X, 0, DUSK_DUEL_Z]} scale={1}><Duel color="#c23b3b" seed={1} /></group>
          <group key="s1" position={[DUSK_DUEL_X, 0, DUSK_DUEL_Z]} scale={0.95}><Duel color="#3f7fd0" seed={2} /></group>
        </>
      ) : (
        <>
          <group key="s0" position={[EXTRA_SPOTS[0][0], 0, EXTRA_SPOTS[0][1]]} scale={0.9}><Campfire /></group>
          <group key="s1" position={[EXTRA_SPOTS[1][0], 0, EXTRA_SPOTS[1][1]]} scale={0.9}><Crate color="#8a5a34" /></group>
        </>
      )}
      {!dusk && <group key="s2" position={[-DAY_DUEL_X, 0, DAY_DUEL_Z]} scale={1}><Duel color="#c23b3b" seed={1} /></group>}
      {!dusk && <group key="s3" position={[DAY_DUEL_X, 0, DAY_DUEL_Z]} scale={0.95}><Duel color="#3f7fd0" seed={2} /></group>}
      {dusk && (
        <>
          <group key="s4" position={[EXTRA_SPOTS[4][0], 0, EXTRA_SPOTS[4][1]]} scale={0.85}><Campfire /></group>
          <group key="s5" position={[EXTRA_SPOTS[5][0], 0, EXTRA_SPOTS[5][1]]} scale={0.85}><Crate color="#6a4a32" /></group>
          <group key="s6" position={[EXTRA_SPOTS[6][0], 0, EXTRA_SPOTS[6][1]]} scale={0.85}><Crate color="#6a4a32" /></group>
          <group key="s7" position={[EXTRA_SPOTS[7][0], 0, EXTRA_SPOTS[7][1]]} scale={0.85}><Signpost color="#5a3f2a" /></group>
        </>
      )}
      {/*
        The jail is the gatehouse by day and the timber stockade at dusk —
        one per board, see jails.tsx. The platform keeps the colours the
        old stone pen had.
      */}
      {dusk ? (
        <Jail kind={ARENA_JAILS.castleSunset} platform="#6f5a49" bars="#5a3a26" />
      ) : (
        <Jail kind={ARENA_JAILS.castle} platform="#8f8371" bars="#454a52" />
      )}
      <RetreatGarden palette={palette} padColors={padColors} />

      {dusk ? <RuinWalls /> : <CourtyardWalls />}
    </group>
  );
}


/** Sunset variant used by the arena registry (trophy unlock). */
export function SunsetCastleArena(props: ArenaProps) {
  return <CastleArena variant="sunset" {...props} />;
}
