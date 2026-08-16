import { CastleArena, SunsetCastleArena } from './CastleArena';

/**
 * Arena registry. Every battlefield theme is a drop-in visual component
 * rendered over the SAME physics tray (src/physics/world.ts) and the same
 * dimensions from src/game/tuning.ts — so new arenas (jungle clearing,
 * desert fort, space station, …) only need a visual component and a sky
 * color here. Cosmetic only; never gameplay-affecting.
 */
export interface ArenaDef {
  name: string;
  /** Canvas / letterbox background. */
  skyColor: string;
  Component: () => React.JSX.Element;
}

export const ARENAS = {
  castle: {
    name: 'Castle Courtyard',
    skyColor: '#8ec8f7',
    Component: () => <CastleArena />,
  },
  castleSunset: {
    name: 'Sunset Castle',
    skyColor: '#f5a05c',
    Component: SunsetCastleArena,
  },
} satisfies Record<string, ArenaDef>;

export type ArenaId = keyof typeof ARENAS;

/** The arena used everywhere until an arena picker exists. */
export const CURRENT_ARENA: ArenaId = 'castle';
