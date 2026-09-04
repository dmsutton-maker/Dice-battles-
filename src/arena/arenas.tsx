import { CastleArena, SunsetCastleArena } from './CastleArena';
import { ThemedArena } from './ThemedArena';
import { ARENA_THEMES, THEMED_ARENA_META, ThemedArenaId } from './themeData';
import { JungleArena } from './JungleArena';
import { SpaceArena } from './SpaceArena';

/**
 * Arena registry. Every battlefield theme is a drop-in visual component
 * rendered over the SAME physics tray (src/physics/world.ts) and the same
 * dimensions from src/game/tuning.ts — so new arenas (desert fort, volcano,
 * underwater, …) only need a visual component and an entry here. Cosmetic
 * only; never gameplay-affecting.
 */
/**
 * How an arena is lit.
 *
 * This used to be three hard-coded lights in DiceScene, identical for every
 * arena — which is why Sunset Castle read as the day castle with different
 * paint. Time of day is mostly LIGHT: the angle it comes from, its colour,
 * and how much fill sits opposite it. Swapping seven material colours
 * cannot say "evening" while a high white sun is still overhead.
 *
 * Lighting is global to the scene, so it falls on the dice and the
 * prisoners too, not just the scenery — which is exactly what makes a
 * change of hour believable.
 */
export interface ArenaLighting {
  /** Sky and ground tints of the ambient wash, and its strength. */
  hemisphere: { sky: string; ground: string; intensity: number };
  /** The sun (or its stand-in): where it is, how strong, what colour. */
  key: { position: [number, number, number]; intensity: number; color: string };
  /** The opposite-side fill that keeps shadowed faces from going flat black. */
  fill: { position: [number, number, number]; intensity: number; color: string };
}

/** Midday: sun high overhead, neutral, generous fill. */
const DAYLIGHT: ArenaLighting = {
  hemisphere: { sky: '#eef2fa', ground: '#8f877b', intensity: 1.0 },
  key: { position: [4, 12, 6], intensity: 2.4, color: '#ffffff' },
  fill: { position: [-6, 8, -4], intensity: 0.7, color: '#f2f4f8' },
};

/**
 * Golden hour: the sun is LOW and to one side, deep amber, and what fills
 * the other side is cool skylight rather than more sun. The low angle is
 * the whole trick — it rakes across the walls and towers instead of
 * dropping flatly onto them.
 */
const SUNSET_LIGHT: ArenaLighting = {
  hemisphere: { sky: '#ffb27a', ground: '#43304a', intensity: 0.75 },
  key: { position: [-14, 2.4, -3], intensity: 2.7, color: '#ff9440' },
  fill: { position: [7, 6, 8], intensity: 0.5, color: '#6f7fd0' },
};

export interface ArenaDef {
  name: string;
  /** One-word name for the arena picker chip. */
  short: string;
  emoji: string;
  /** Canvas / letterbox background. */
  skyColor: string;
  lighting: ArenaLighting;
  Component: () => React.JSX.Element;
}

/** Registry entries for every themed arena, built from their data. */
function themedEntries(): Record<ThemedArenaId, ArenaDef> {
  const out = {} as Record<ThemedArenaId, ArenaDef>;
  for (const id of Object.keys(ARENA_THEMES) as ThemedArenaId[]) {
    const meta = THEMED_ARENA_META[id];
    const theme = ARENA_THEMES[id];
    out[id] = {
      name: meta.name,
      short: meta.short,
      emoji: meta.emoji,
      skyColor: meta.skyColor,
      lighting: theme.lighting ?? DAYLIGHT,
      Component: () => <ThemedArena theme={theme} id={id} />,
    };
  }
  return out;
}

export const ARENAS = {
  castle: {
    name: 'Castle Courtyard',
    short: 'Castle',
    emoji: '🏰',
    skyColor: '#8ec8f7',
    lighting: DAYLIGHT,
    Component: () => <CastleArena />,
  },
  castleSunset: {
    name: 'Sunset Castle',
    short: 'Sunset',
    emoji: '🌅',
    // Warm dusk. The real sky is the gradient dome the arena draws; this
    // flat colour is the letterbox behind it AND the swatch in the arena
    // picker, and a swatch that went deep purple would stop reading as
    // "sunset" at thumbnail size.
    skyColor: '#ef8557',
    lighting: SUNSET_LIGHT,
    Component: SunsetCastleArena,
  },
  jungle: {
    name: 'Jungle Clearing',
    short: 'Jungle',
    emoji: '🌴',
    skyColor: '#a8d8b8',
    lighting: DAYLIGHT,
    Component: JungleArena,
  },
  space: {
    name: 'Space Station',
    short: 'Space',
    emoji: '🚀',
    skyColor: '#0a0e2a',
    lighting: DAYLIGHT,
    Component: SpaceArena,
  },
  /*
    The sixteen themed battlefields. One line each on purpose: everything
    that makes Snowy Hollow snowy lives in themeData.ts, and everything
    that draws it lives in ThemedArena.tsx — this registry only says that
    it exists. Names, skies and economy come from THEMED_ARENA_META so a
    theme cannot be added here without deciding how it is obtained.
  */
  ...themedEntries(),
} satisfies Record<string, ArenaDef>;

export type ArenaId = keyof typeof ARENAS;

/** Fallback arena when nothing is picked. */
export const CURRENT_ARENA: ArenaId = 'castle';
