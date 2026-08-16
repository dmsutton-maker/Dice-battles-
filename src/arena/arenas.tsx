import { CastleArena, SunsetCastleArena } from './CastleArena';
import { JungleArena } from './JungleArena';
import { SpaceArena } from './SpaceArena';

/**
 * Arena registry. Every battlefield theme is a drop-in visual component
 * rendered over the SAME physics tray (src/physics/world.ts) and the same
 * dimensions from src/game/tuning.ts — so new arenas (desert fort, volcano,
 * underwater, …) only need a visual component and an entry here. Cosmetic
 * only; never gameplay-affecting.
 */
export interface ArenaDef {
  name: string;
  /** One-word name for the arena picker chip. */
  short: string;
  emoji: string;
  /** Canvas / letterbox background. */
  skyColor: string;
  Component: () => React.JSX.Element;
}

export const ARENAS = {
  castle: {
    name: 'Castle Courtyard',
    short: 'Castle',
    emoji: '🏰',
    skyColor: '#8ec8f7',
    Component: () => <CastleArena />,
  },
  castleSunset: {
    name: 'Sunset Castle',
    short: 'Sunset',
    emoji: '🌅',
    skyColor: '#f5a05c',
    Component: SunsetCastleArena,
  },
  jungle: {
    name: 'Jungle Clearing',
    short: 'Jungle',
    emoji: '🌴',
    skyColor: '#a8d8b8',
    Component: JungleArena,
  },
  space: {
    name: 'Space Station',
    short: 'Space',
    emoji: '🚀',
    skyColor: '#0a0e2a',
    Component: SpaceArena,
  },
} satisfies Record<string, ArenaDef>;

export type ArenaId = keyof typeof ARENAS;

/** Fallback arena when nothing is picked. */
export const CURRENT_ARENA: ArenaId = 'castle';
