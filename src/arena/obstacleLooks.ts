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

export interface ObstacleLook {
  /** The bump the dice deflect off. */
  mound: {
    color: string;
    /** Rougher for earth and rock, smoother for metal. */
    roughness: number;
    metalness: number;
  };
  /** The hole in the floor that swallows a die. */
  pit: {
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
     * The border around it. `stone` is the castle's cut kerb; `bank` is a
     * soft earth lip; `hull` is a raised metal coaming. Null draws no
     * border at all, which is what makes a lake read as a lake rather than
     * as a swimming pool.
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
  mound: { color: '#7fae66', roughness: 0.85, metalness: 0 },
  pit: {
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
  castleSunset: {
    mound: { color: '#5c8455', roughness: 0.88, metalness: 0 },
    pit: {
      depths: '#161036',
      surface: '#5c6fc4',
      surfaceOpacity: 0.66,
      surfaceRoughness: 0.14,
      edge: '#ffd9b0',
      border: { kind: 'stone', color: '#6b5f52' },
    },
    words: CASTLE_DAY.words,
  },

  // A lake, not a pool. The giveaway on the old one was the cut-stone kerb
  // running round it in a straight square — nothing in a rainforest has
  // that. Soft earth bank instead, and the water is the green-brown of
  // standing water under a canopy rather than swimming-pool blue.
  jungle: {
    mound: { color: '#5f7d3f', roughness: 0.95, metalness: 0 },
    pit: {
      depths: '#08251c',
      surface: '#2f8f74',
      surfaceOpacity: 0.7,
      surfaceRoughness: 0.2,
      edge: '#a9d8b6',
      border: { kind: 'bank', color: '#5c4a2e' },
    },
    words: {
      pit: 'lake',
      mound: 'mossy hillock',
      sink: 'Splash! A die fell in the lake!',
    },
  },

  // Nothing grows here and there is no water. The bump is a bulkhead dome
  // in the deck plating, and the hole is an open hatch onto the drop — a
  // die does not sink, it falls out of the station. The physics is the
  // identical square hole; only what you see round it changes.
  space: {
    mound: { color: '#8d94a3', roughness: 0.4, metalness: 0.55 },
    pit: {
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
