import { ArenaId } from './arenas';
import { ARENA_THEMES, ThemedArenaId } from './themeData';

/** Every themed arena's look, read out of its theme. */
function themedLooks(): Record<ThemedArenaId, ObstacleLook> {
  const out = {} as Record<ThemedArenaId, ObstacleLook>;
  for (const id of Object.keys(ARENA_THEMES) as ThemedArenaId[]) {
    out[id] = ARENA_THEMES[id].look;
  }
  return out;
}

/**
 * What the two hazards LOOK like, and what they are called, in each
 * battlefield.
 *
 * Both were drawn identically everywhere: a green grassy sphere and a blue
 * pool with a cut-stone rim around it. That is a castle moat and a castle
 * lawn, and it was being placed in a rainforest and on an orbiting station
 * alike — a grass hill on a space station, as David put it. The hazards are
 * the most-looked-at things on the board after the dice, because they are
 * what you are trying to roll around, so drawing them the same everywhere
 * undid a good deal of the work of making the arenas different.
 *
 * The PHYSICS never changes. Same sphere in the same place, same square
 * hole in the floor — Hard is Hard whichever battlefield you are on, and
 * a hazard that behaved differently by arena would make the choice of
 * arena a choice of difficulty. Only the dressing and the words change.
 */

/**
 * What the bump IS on each board — drawn by src/arena/hazardShapes.ts. One per
 * board, from the table in docs/board-redesign.md.
 */
export type MoundKind =
  | 'hill' | 'rubble' | 'stump' | 'bulkhead' | 'dune'
  | 'leafPile' | 'iceBoulder' | 'crystals' | 'cloud' | 'boulder'
  | 'snowman' | 'smokingRock' | 'haystack' | 'sandcastle' | 'gumdrop'
  | 'mushroom' | 'treasure' | 'anemone' | 'acUnit' | 'beachBall'
  | 'eggNest'
  // Season 2 of the pass (21 Oct 2026): the Sun Temple's altar and the
  // Moon Garden's stone lantern.
  | 'sunAltar' | 'moonLantern'
  // New members go ABOVE this comment, one per line, so six seasons can
  // be built side by side and merge cleanly. The ; stays on its own line.
  ;

/**
 * What the pit IS on each board. The physics is the same square hole for
 * all of them; see src/arena/hazardShapes.ts for how each is dressed round it.
 */
export type PitKind =
  | 'moat' | 'candlePool' | 'lake' | 'hatch' | 'quicksand'
  | 'puddle' | 'iceHole' | 'chasm' | 'cloudGap' | 'crater'
  | 'frozenPond' | 'lava' | 'mud' | 'tidePool' | 'chocolate'
  | 'spring' | 'cargoHatch' | 'whirlpool' | 'skylight' | 'toyBox'
  | 'tarPit'
  | 'sunWell' | 'moonPond'
  // New members go ABOVE this comment, one per line, so six seasons can
  // be built side by side and merge cleanly. The ; stays on its own line.
  ;

export interface ObstacleLook {
  /** The bump the dice deflect off. */
  mound: {
    /** What it is drawn as. Never changes its size: see hazardShapes.ts. */
    kind: MoundKind;
    color: string;
    /** Rougher for earth and rock, smoother for metal. */
    roughness: number;
    metalness: number;
  };
  /** The hole in the floor that swallows a die. */
  pit: {
    /** What it is drawn as. Never changes the hole: see hazardShapes.ts. */
    kind: PitKind;
    /** The void below, which a sinking die silhouettes against. */
    depths: string;
    /** The surface: water, or something else entirely. */
    surface: string;
    surfaceOpacity: number;
    /** How reflective the surface reads. */
    surfaceRoughness: number;
    /** The ring right at the edge — foam, or a lit warning strip. */
    edge: string;
    /**
     * Real water: drawn as moving water with waves and lapping foam
     * (src/arena/water.tsx) rather than a flat surface. David, 30 Sep
     * 2026: "I wanna see the water moving in all the ponds." Left off for
     * the pits that are not water at all — lava, sand, a hatch.
     *
     * It also keeps the board drawing between rolls (DiceDemoScreen), so
     * the whirlpool carries it too even though it has its own shader.
     */
    water?: true;
    /**
     * The border's colour, and roughly what it is: `stone` a cut kerb,
     * `bank` a soft lip, `hull` a metal coaming. Which pieces are actually
     * drawn round the hole is decided by the pit's `kind` (hazardShapes.ts);
     * this carries the board's own colour for them. Null for a pit whose
     * edge is not a border at all — clouds, damp sand.
     */
    border: { kind: 'stone' | 'bank' | 'hull'; color: string } | null;
  };
  /** What to call the pit, in the difficulty hint and the splash callout. */
  words: {
    /** "the pond", "the lake", "the hatch" — used mid-sentence. */
    pit: string;
    /** What the mound is called. */
    mound: string;
    /** The callout when a die goes in. */
    sink: string;
  };
}

const CASTLE_DAY: ObstacleLook = {
  mound: { kind: 'hill', color: '#7fae66', roughness: 0.85, metalness: 0 },
  pit: {
    kind: 'moat',
    water: true,
    depths: '#0a2c4a',
    surface: '#2f9be2',
    surfaceOpacity: 0.62,
    surfaceRoughness: 0.12,
    edge: '#dff2ff',
    border: { kind: 'stone', color: '#8a7c66' },
  },
  words: {
    pit: 'pond',
    mound: 'hill',
    sink: 'Splash! A die fell in the pond!',
  },
};

export const OBSTACLE_LOOKS: Record<ArenaId, ObstacleLook> = {
  ...themedLooks(),
  castle: CASTLE_DAY,

  // The same castle later in the day. Grass goes blue-green as the light
  // leaves it, and the water picks up the sky rather than staying noon-blue.
  // The courtyard of a ruin rather than a working castle (docs/board-
  // redesign.md): the hill is a heap of fallen stones under ivy, and the
  // moat a still reflecting pool with candles floating on it, catching
  // the sunset.
  castleSunset: {
    mound: { kind: 'rubble', color: '#5c8455', roughness: 0.88, metalness: 0 },
    pit: {
      kind: 'candlePool',
      water: true,
      depths: '#161036',
      surface: '#7a6cb8',
      surfaceOpacity: 0.66,
      surfaceRoughness: 0.14,
      edge: '#ffc99a',
      border: { kind: 'stone', color: '#6b5f52' },
    },
    words: {
      pit: 'reflecting pool',
      mound: 'rubble heap',
      sink: 'Splash! A die fell in the reflecting pool!',
    },
  },

  // A lake, not a pool. The giveaway on the old one was the cut-stone kerb
  // running round it in a straight square — nothing in a rainforest has
  // that. Soft earth bank instead, and the water is the green-brown of
  // standing water under a canopy rather than swimming-pool blue.
  jungle: {
    mound: { kind: 'stump', color: '#5f7d3f', roughness: 0.95, metalness: 0 },
    pit: {
      kind: 'lake',
      water: true,
      depths: '#08251c',
      surface: '#2f8f74',
      surfaceOpacity: 0.7,
      surfaceRoughness: 0.2,
      edge: '#a9d8b6',
      border: { kind: 'bank', color: '#5c4a2e' },
    },
    words: {
      pit: 'lake',
      mound: 'mossy stump',
      sink: 'Splash! A die fell in the lake!',
    },
  },

  // Nothing grows here and there is no water. The bump is a bulkhead dome
  // in the deck plating, and the hole is an open hatch onto the drop — a
  // die does not sink, it falls out of the station. The physics is the
  // identical square hole; only what you see round it changes.
  space: {
    mound: { kind: 'bulkhead', color: '#8d94a3', roughness: 0.4, metalness: 0.55 },
    pit: {
      kind: 'hatch',
      depths: '#04050c',
      surface: '#0b1b3a',
      // Barely there: this is a view down into the dark, not a liquid.
      surfaceOpacity: 0.22,
      surfaceRoughness: 0.9,
      edge: '#39d7ff',
      border: { kind: 'hull', color: '#5b6478' },
    },
    words: {
      pit: 'hatch',
      mound: 'bulkhead dome',
      sink: 'Gone! A die fell through the hatch!',
    },
  },
};

export function obstacleLook(arenaId: ArenaId): ObstacleLook {
  return OBSTACLE_LOOKS[arenaId] ?? CASTLE_DAY;
}

/*
 * The sixteen themed arenas carry their look INSIDE their theme
 * (themeData.ts), because a theme without hazard dressing is exactly how
 * the grass-hill-on-a-space-station bug happened. They are merged into
 * the record below.
 */
