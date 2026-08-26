import { ObstacleLook } from './obstacleLooks';
import type { ArenaLighting } from './arenas';

/**
 * The sixteen themed battlefields, as DATA.
 *
 * David asked on 26 Aug 2026 for "about 15-20 new arenas", some bought
 * with coins and some earned with trophies. The four originals are each a
 * five-hundred-line bespoke scene; sixteen more at that size would be
 * eight thousand lines that nobody could keep visually consistent — and
 * consistency is what an arena SET needs, because every one of them has
 * to hold the same tray, the same jail, the same retreat and the same
 * hazards in the same places (src/game/stations.ts) or the figures stand
 * inside the scenery.
 *
 * So the sixteen share one renderer (ThemedArena.tsx) and differ only in
 * this file: colours, materials, which props stand where, what the sky
 * holds, what the hazards look like and what they are called. A theme is
 * ~40 lines a designer can read top to bottom.
 *
 * This file is deliberately free of React and three.js, so the test suite
 * can check every theme — palette contrast, prop placement against the
 * figure slots, economy routes — without a renderer.
 *
 * DISTINCTNESS RULE, learned the hard way twice (the Sunset Castle bug,
 * the Cups icon): no two themes may share a biome. One snow, one desert,
 * one lava. Where two lean on similar hues (autumn's orange and the
 * volcano's) the difference is carried by VALUE as well — autumn is a
 * bright day, the volcano is night lit from below.
 */

/** What kind of standing prop to draw. Each is ~15 lines of ThemedArena. */
export type PropKind =
  | 'pine'          // conical tree; snowCap tints the tips
  | 'roundTree'     // trunk + sphere canopy (autumn/farm woods)
  | 'palm'
  | 'cactus'
  | 'rock'
  | 'crystal'       // emissive shard cluster
  | 'mushroom'      // stem + glowing cap
  | 'snowman'
  | 'lollipop'      // candy stick + disc
  | 'umbrella'      // beach parasol
  | 'shipMast'      // hull + mast + sail, for the cove
  | 'barn'          // box + gable roof
  | 'hayBale'
  | 'coral'         // branching cones
  | 'seaweed'       // wavy emissive ribbons
  | 'lavaPool'      // emissive disc in dark rock
  | 'cityTower'     // dark slab + lit window texture
  | 'cloudIsle'     // floating cloud puff platform
  | 'toyBlock'      // big coloured cube
  | 'balloon'
  | 'moonRock'      // pale crater boulder
  | 'lantern';      // post + warm glow head

export interface PropPlacement {
  kind: PropKind;
  /** World position; y is ground level unless the prop floats. */
  x: number;
  z: number;
  /** Uniform scale, default 1. */
  scale?: number;
  /** Optional per-prop colour override (balloon skins, toy blocks…). */
  color?: string;
}

export interface ArenaTheme {
  /** Ground plane outside the tray. */
  meadow: string;
  /** Soft mounds on that ground. */
  hill: string;
  /** Distant cones on the horizon; null for flat worlds. */
  mountain: string | null;
  /** Cloud puffs; null for clear or starry skies. */
  cloud: string | null;

  /** Tray floor: two tones painted as offset flagstones. */
  floor: { a: string; b: string };
  /** Tray walls and the merlon caps along them. */
  wall: { color: string; cap: string; metalness?: number };
  /** Corner tower body + roof cone. */
  tower: { body: string; roof: string };

  /** Jail pen: platform and bars, themed so the cage belongs to the place. */
  jail: { platform: string; bars: string };
  /** Retreat: pad colours alternate, posts carry canopies, pool liquid. */
  retreat: { padA: string; padB: string; post: string; canopy: string; pool: string };

  /**
   * Sky dressing. `sun` draws a disc (null for none); `stars` scatters
   * unlit points, for night worlds; `body` is one big celestial feature —
   * a planet, a moon, an aurora hue — drawn behind everything.
   */
  sky: {
    sun: { color: string; size: number } | null;
    stars: boolean;
    body: { kind: 'moon' | 'planet' | 'aurora' | 'rainbow' | 'earth'; color: string } | null;
  };

  /** Standing scenery, placed by hand around the shared stations. */
  props: PropPlacement[];

  /** How the two hazards dress in this world, and what they are called. */
  look: ObstacleLook;
  /** Scene lighting; null uses the shared daylight rig. */
  lighting: ArenaLighting | null;
}

/** Ids of the sixteen themed arenas. The four originals are not here. */
export type ThemedArenaId =
  | 'snow' | 'desert' | 'volcano' | 'beach'
  | 'candy' | 'glade' | 'autumn' | 'cove'
  | 'farm' | 'aurora' | 'reef' | 'cavern'
  | 'city' | 'sky' | 'moon' | 'toybox';

/** Shared daylight, matching the rig the originals use. */
const DAY: ArenaLighting | null = null;

/** A dim rig for night worlds, warm or cool per theme. */
const night = (skyTint: string, groundTint: string, key: string): ArenaLighting => ({
  hemisphere: { sky: skyTint, ground: groundTint, intensity: 0.55 },
  key: { position: [4, 12, 6], intensity: 1.6, color: key },
  fill: { position: [-6, 8, -4], intensity: 0.5, color: skyTint },
});

const look = (
  mound: ObstacleLook['mound'],
  pit: ObstacleLook['pit'],
  pitWord: string,
  moundWord: string,
  sink: string,
): ObstacleLook => ({
  mound,
  pit,
  words: { pit: pitWord, mound: moundWord, sink },
});

export const ARENA_THEMES: Record<ThemedArenaId, ArenaTheme> = {
  /* ── TROPHY LADDER ─────────────────────────────────────────────── */

  snow: {
    meadow: '#e9f1f6', hill: '#dae7f0', mountain: '#b9c9d8', cloud: '#ffffff',
    floor: { a: '#dfe9f0', b: '#cfdde8' },
    wall: { color: '#b7c6d2', cap: '#9dafbe' },
    tower: { body: '#b7c6d2', roof: '#5b87b0' },
    jail: { platform: '#9dafbe', bars: '#4b5866' },
    retreat: { padA: '#f3f8fb', padB: '#d8e6f0', post: '#8a5a34', canopy: '#d95f5f', pool: '#9fd3f0' },
    sky: { sun: { color: '#fff6d8', size: 1.6 }, stars: false, body: null },
    props: [
      { kind: 'pine', x: -8, z: -8, scale: 1.4 }, { kind: 'pine', x: 8.5, z: -6 },
      { kind: 'pine', x: -9, z: 2, scale: 1.2 }, { kind: 'pine', x: 9, z: 5, scale: 1.5 },
      { kind: 'pine', x: -7.5, z: 9 }, { kind: 'snowman', x: 7.6, z: 9.4 },
      { kind: 'rock', x: -10, z: -3, color: '#c7d6e2' },
    ],
    look: look(
      { color: '#eef5fa', roughness: 0.6, metalness: 0 },
      { depths: '#0d2f4d', surface: '#bfe2f2', surfaceOpacity: 0.8, surfaceRoughness: 0.05,
        edge: '#ffffff', border: { kind: 'bank', color: '#dae7f0' } },
      'frozen pond', 'snowdrift', 'Crack! A die slid into the frozen pond!',
    ),
    lighting: DAY,
  },

  desert: {
    meadow: '#e8c987', hill: '#dcb968', mountain: '#c4924e', cloud: null,
    floor: { a: '#e3c384', b: '#d4b06a' },
    wall: { color: '#c9a05c', cap: '#b08a48' },
    tower: { body: '#c9a05c', roof: '#a5602f' },
    jail: { platform: '#b08a48', bars: '#5e4426' },
    retreat: { padA: '#f0dfb4', padB: '#dfc78e', post: '#8a5a34', canopy: '#d97f38', pool: '#58b7c9' },
    sky: { sun: { color: '#fff1b8', size: 2 }, stars: false, body: null },
    props: [
      { kind: 'cactus', x: -8, z: -7, scale: 1.3 }, { kind: 'cactus', x: 8.4, z: -4 },
      { kind: 'cactus', x: -9.2, z: 4 }, { kind: 'cactus', x: 8.8, z: 8, scale: 1.2 },
      { kind: 'rock', x: 9.6, z: 1, color: '#c4924e' }, { kind: 'rock', x: -7.4, z: 10, color: '#b08549' },
    ],
    look: look(
      { color: '#d9b268', roughness: 1, metalness: 0 },
      { depths: '#4d3a1c', surface: '#e8cf96', surfaceOpacity: 0.9, surfaceRoughness: 0.9,
        edge: '#f4e4bc', border: null },
      'sandpit', 'dune', 'Floomp! A die sank into the sandpit!',
    ),
    lighting: DAY,
  },

  volcano: {
    meadow: '#3a3038', hill: '#2c242c', mountain: '#4d3540', cloud: '#5c4048',
    floor: { a: '#4a3d42', b: '#3b3036' },
    wall: { color: '#54424a', cap: '#3d2f36' },
    tower: { body: '#54424a', roof: '#e05a2b' },
    jail: { platform: '#3d2f36', bars: '#1d161b' },
    retreat: { padA: '#5e4a50', padB: '#4a3a40', post: '#2c242c', canopy: '#e05a2b', pool: '#ff7a2f' },
    sky: { sun: null, stars: false, body: null },
    props: [
      { kind: 'lavaPool', x: -8, z: -6, scale: 1.4 }, { kind: 'lavaPool', x: 8.6, z: 3 },
      { kind: 'lavaPool', x: -8.6, z: 8, scale: 1.1 },
      { kind: 'rock', x: 8, z: -8, color: '#2c242c', scale: 1.5 },
      { kind: 'rock', x: -10, z: 1, color: '#241d23', scale: 1.2 },
      { kind: 'rock', x: 8.8, z: 9.4, color: '#33282f' },
    ],
    look: look(
      { color: '#43333c', roughness: 1, metalness: 0 },
      { depths: '#3a0c00', surface: '#ff8c2e', surfaceOpacity: 0.85, surfaceRoughness: 0.3,
        edge: '#ffd23f', border: { kind: 'stone', color: '#2c242c' } },
      'lava pool', 'boulder', 'Sssss! A die fell in the lava!',
    ),
    lighting: night('#66303a', '#2a1418', '#ff9440'),
  },

  autumn: {
    meadow: '#c98d4a', hill: '#b3763c', mountain: '#8a6a52', cloud: '#f2ede4',
    floor: { a: '#c9a678', b: '#b8925e' },
    wall: { color: '#9a7a52', cap: '#7d6140' },
    tower: { body: '#9a7a52', roof: '#b3492e' },
    jail: { platform: '#7d6140', bars: '#3e3020' },
    retreat: { padA: '#e3c89a', padB: '#cfae76', post: '#6e4a28', canopy: '#c9622e', pool: '#7fa8c9' },
    sky: { sun: { color: '#fff3cf', size: 1.4 }, stars: false, body: null },
    props: [
      { kind: 'roundTree', x: -8, z: -8, scale: 1.4, color: '#d0642e' },
      { kind: 'roundTree', x: 8.4, z: -5, color: '#c9903a' },
      { kind: 'roundTree', x: -9, z: 3, color: '#b3492e', scale: 1.2 },
      { kind: 'roundTree', x: 9, z: 7, color: '#d0642e' },
      { kind: 'roundTree', x: -7.6, z: 10, color: '#c9903a', scale: 0.9 },
      { kind: 'hayBale', x: 8.8, z: 10 },
    ],
    look: look(
      { color: '#a5772f', roughness: 1, metalness: 0 },
      { depths: '#1e2a12', surface: '#c9903a', surfaceOpacity: 0.75, surfaceRoughness: 0.6,
        edge: '#e8c987', border: { kind: 'bank', color: '#6e4a28' } },
      'leaf pile', 'leaf heap', 'Crunch! A die dived into the leaf pile!',
    ),
    lighting: DAY,
  },

  aurora: {
    meadow: '#12333d', hill: '#0d272f', mountain: '#1b4450', cloud: null,
    floor: { a: '#1d4a56', b: '#153a44' },
    wall: { color: '#245663', cap: '#183f4a' },
    tower: { body: '#245663', roof: '#57e8a9' },
    jail: { platform: '#183f4a', bars: '#0a1d23' },
    retreat: { padA: '#2a6273', padB: '#1d4a56', post: '#0d272f', canopy: '#57e8a9', pool: '#57c9e8' },
    sky: { sun: null, stars: true, body: { kind: 'aurora', color: '#4fe89a' } },
    props: [
      { kind: 'pine', x: -8, z: -7, scale: 1.3, color: '#123d33' },
      { kind: 'pine', x: 8.6, z: -5, color: '#123d33' },
      { kind: 'pine', x: -9, z: 4, color: '#0f332b' },
      { kind: 'rock', x: 8.8, z: 8, color: '#1b4450', scale: 1.3 },
      { kind: 'crystal', x: -7.8, z: 9.6, color: '#57e8a9' },
    ],
    look: look(
      { color: '#1d4a56', roughness: 0.7, metalness: 0 },
      { depths: '#04141a', surface: '#2a8fa8', surfaceOpacity: 0.7, surfaceRoughness: 0.1,
        edge: '#57e8a9', border: { kind: 'bank', color: '#0d272f' } },
      'ice hole', 'ice hummock', 'Brrr! A die fell through the ice!',
    ),
    lighting: night('#1d5a4a', '#0a1d23', '#7fe8c9'),
  },

  cavern: {
    meadow: '#241d2e', hill: '#1b1523', mountain: '#332a40', cloud: null,
    floor: { a: '#3a3046', b: '#2c2438' },
    wall: { color: '#443856', cap: '#332a40' },
    tower: { body: '#443856', roof: '#b06ee8' },
    jail: { platform: '#332a40', bars: '#161020' },
    retreat: { padA: '#4a3d5c', padB: '#3a3046', post: '#241d2e', canopy: '#b06ee8', pool: '#7fd4e8' },
    sky: { sun: null, stars: false, body: null },
    props: [
      { kind: 'crystal', x: -8, z: -7, scale: 1.6, color: '#b06ee8' },
      { kind: 'crystal', x: 8.4, z: -4, scale: 1.2, color: '#8a5ae0' },
      { kind: 'crystal', x: -9, z: 3, color: '#d093ff' },
      { kind: 'crystal', x: 8.8, z: 7, scale: 1.4, color: '#b06ee8' },
      { kind: 'crystal', x: -7.6, z: 10, scale: 0.9, color: '#e8c76e' },
      { kind: 'rock', x: 9.6, z: 0, color: '#332a40', scale: 1.4 },
    ],
    look: look(
      { color: '#3a3046', roughness: 0.9, metalness: 0 },
      { depths: '#08050e', surface: '#4a3d8a', surfaceOpacity: 0.5, surfaceRoughness: 0.2,
        edge: '#b06ee8', border: { kind: 'stone', color: '#2c2438' } },
      'chasm', 'stalagmite stump', 'Whoosh! A die fell down the chasm!',
    ),
    lighting: night('#4a3670', '#161020', '#c9a3ff'),
  },

  sky: {
    meadow: '#a8d4f0', hill: '#8fc4ea', mountain: null, cloud: '#ffffff',
    floor: { a: '#f2f7fc', b: '#dfebf5' },
    wall: { color: '#c9dff0', cap: '#aecbe3' },
    tower: { body: '#c9dff0', roof: '#ffd21f' },
    jail: { platform: '#aecbe3', bars: '#5c7d99' },
    retreat: { padA: '#ffffff', padB: '#e3eff8', post: '#c9a05c', canopy: '#ff8ab0', pool: '#8fd0f0' },
    sky: { sun: { color: '#fff6d8', size: 1.8 }, stars: false, body: { kind: 'rainbow', color: '#ff6e6e' } },
    props: [
      { kind: 'cloudIsle', x: -8.4, z: -7 }, { kind: 'cloudIsle', x: 8.6, z: -4, scale: 1.3 },
      { kind: 'cloudIsle', x: -9, z: 4, scale: 0.9 }, { kind: 'cloudIsle', x: 9, z: 8 },
      { kind: 'balloon', x: -7.6, z: 9.8, color: '#ff6e6e' },
      { kind: 'balloon', x: 8.2, z: 10.4, color: '#57c9e8' },
    ],
    look: look(
      { color: '#e9f3fa', roughness: 0.8, metalness: 0 },
      { depths: '#3a7db3', surface: '#cfe8fa', surfaceOpacity: 0.55, surfaceRoughness: 0.3,
        edge: '#ffffff', border: null },
      'cloud gap', 'cloud bank', 'Wheee! A die fell through the clouds!',
    ),
    lighting: DAY,
  },

  moon: {
    meadow: '#b9bcc4', hill: '#a3a7b0', mountain: '#8a8e99', cloud: null,
    floor: { a: '#c9ccd4', b: '#b3b7c0' },
    wall: { color: '#9a9eaa', cap: '#838794' },
    tower: { body: '#9a9eaa', roof: '#ffd21f' },
    jail: { platform: '#838794', bars: '#3d404a' },
    retreat: { padA: '#d4d7de', padB: '#bcc0c9', post: '#6e7280', canopy: '#ffd21f', pool: '#57c9e8' },
    sky: { sun: null, stars: true, body: { kind: 'earth', color: '#3f7fd0' } },
    props: [
      { kind: 'moonRock', x: -8, z: -7, scale: 1.5 }, { kind: 'moonRock', x: 8.6, z: -4 },
      { kind: 'moonRock', x: -9.2, z: 3, scale: 1.2 }, { kind: 'moonRock', x: 9, z: 7, scale: 0.9 },
      { kind: 'lantern', x: -7.6, z: 9.8, color: '#ffd21f' }, { kind: 'lantern', x: 8.2, z: 10.2, color: '#ffd21f' },
    ],
    look: look(
      { color: '#b3b7c0', roughness: 1, metalness: 0 },
      { depths: '#14161d', surface: '#3d404a', surfaceOpacity: 0.35, surfaceRoughness: 0.9,
        edge: '#ffd21f', border: { kind: 'hull', color: '#6e7280' } },
      'crater', 'moon boulder', 'Gone! A die fell into the crater!',
    ),
    lighting: night('#2a2f45', '#14161d', '#e9ecf5'),
  },

  /* ── BOUGHT IN THE STORE ───────────────────────────────────────── */

  beach: {
    meadow: '#f0dfa8', hill: '#e6d090', mountain: null, cloud: '#ffffff',
    floor: { a: '#efe2b4', b: '#e0cd92' },
    wall: { color: '#d9c284', cap: '#c2a865' },
    tower: { body: '#d9c284', roof: '#ff8a5c' },
    jail: { platform: '#c2a865', bars: '#6e5a34' },
    retreat: { padA: '#fff3d0', padB: '#efe0ae', post: '#8a5a34', canopy: '#ff6e6e', pool: '#4fd0c9' },
    sky: { sun: { color: '#fff6d8', size: 1.7 }, stars: false, body: null },
    props: [
      { kind: 'palm', x: -8, z: -7, scale: 1.3 }, { kind: 'palm', x: 8.6, z: -4 },
      { kind: 'palm', x: -9, z: 4, scale: 1.1 }, { kind: 'umbrella', x: 8.8, z: 8, color: '#ff6e6e' },
      { kind: 'umbrella', x: -7.6, z: 9.8, color: '#57c9e8' },
      { kind: 'rock', x: 9.6, z: 1, color: '#c2a865' },
    ],
    look: look(
      { color: '#e6d090', roughness: 1, metalness: 0 },
      { depths: '#0a4a52', surface: '#3fc9c2', surfaceOpacity: 0.65, surfaceRoughness: 0.1,
        edge: '#fff3d0', border: null },
      'rock pool', 'sandcastle mound', 'Splash! A die fell in the rock pool!',
    ),
    lighting: DAY,
  },

  candy: {
    meadow: '#f7c9e0', hill: '#f0b3d2', mountain: '#d998c4', cloud: '#fff0f7',
    floor: { a: '#fbe3ef', b: '#f3cde2' },
    wall: { color: '#e8a8cc', cap: '#d68cb8' },
    tower: { body: '#e8a8cc', roof: '#8ae0c0' },
    jail: { platform: '#d68cb8', bars: '#8a4a6e' },
    retreat: { padA: '#fff0f7', padB: '#f7d6e8', post: '#a8624a', canopy: '#8ae0c0', pool: '#8ad4e8' },
    sky: { sun: { color: '#fff6d8', size: 1.4 }, stars: false, body: null },
    props: [
      { kind: 'lollipop', x: -8, z: -7, scale: 1.3, color: '#ff6e6e' },
      { kind: 'lollipop', x: 8.6, z: -4, color: '#8ae0c0' },
      { kind: 'lollipop', x: -9, z: 4, color: '#ffd21f' },
      { kind: 'lollipop', x: 9, z: 7, scale: 1.2, color: '#b06ee8' },
      { kind: 'rock', x: -7.6, z: 9.8, color: '#f7f0e0', scale: 0.9 },
      { kind: 'rock', x: 8.4, z: 10, color: '#f7f0e0', scale: 0.7 },
    ],
    look: look(
      { color: '#f0b3d2', roughness: 0.6, metalness: 0 },
      { depths: '#6e2a4a', surface: '#e87fb0', surfaceOpacity: 0.7, surfaceRoughness: 0.2,
        edge: '#fff0f7', border: { kind: 'stone', color: '#d68cb8' } },
      'syrup pond', 'gumdrop hill', 'Gloop! A die fell in the syrup pond!',
    ),
    lighting: DAY,
  },

  glade: {
    meadow: '#1d3345', hill: '#152838', mountain: '#26455c', cloud: null,
    floor: { a: '#2a4a63', b: '#1f3a50' },
    wall: { color: '#33566e', cap: '#264257' },
    tower: { body: '#33566e', roof: '#4fd0c9' },
    jail: { platform: '#264257', bars: '#0d1c28' },
    retreat: { padA: '#3a607a', padB: '#2a4a63', post: '#152838', canopy: '#4fd0c9', pool: '#4fd0c9' },
    sky: { sun: null, stars: true, body: { kind: 'moon', color: '#e9f0f7' } },
    props: [
      { kind: 'mushroom', x: -8, z: -7, scale: 1.5, color: '#4fd0c9' },
      { kind: 'mushroom', x: 8.6, z: -4, color: '#57e8a9' },
      { kind: 'mushroom', x: -9, z: 3, scale: 1.1, color: '#8ad4e8' },
      { kind: 'mushroom', x: 9, z: 7, scale: 1.3, color: '#4fd0c9' },
      { kind: 'pine', x: -7.6, z: 9.8, color: '#14303e', scale: 1.1 },
      { kind: 'pine', x: 8.8, z: 10.2, color: '#14303e', scale: 0.9 },
    ],
    look: look(
      { color: '#264d5c', roughness: 0.9, metalness: 0 },
      { depths: '#04141c', surface: '#2a7a8f', surfaceOpacity: 0.7, surfaceRoughness: 0.15,
        edge: '#4fd0c9', border: { kind: 'bank', color: '#152838' } },
      'glowing pool', 'mossy mound', 'Ploop! A die fell in the glowing pool!',
    ),
    lighting: night('#2a5a6e', '#0d1c28', '#7fd4e8'),
  },

  cove: {
    meadow: '#c9b382', hill: '#b89e68', mountain: '#6e7d8a', cloud: '#e9e4d8',
    floor: { a: '#a8845c', b: '#93714a' },
    wall: { color: '#7d5f3d', cap: '#66492c' },
    tower: { body: '#7d5f3d', roof: '#3d5a74' },
    jail: { platform: '#66492c', bars: '#33241a' },
    retreat: { padA: '#d9c799', padB: '#c2ab78', post: '#66492c', canopy: '#c23b3b', pool: '#2a7a9e' },
    sky: { sun: { color: '#fff0c0', size: 1.4 }, stars: false, body: null },
    props: [
      { kind: 'shipMast', x: -8.6, z: -6, scale: 1.2 },
      { kind: 'palm', x: 8.6, z: -5 },
      { kind: 'rock', x: -9.4, z: 3, color: '#6e7d8a', scale: 1.3 },
      { kind: 'rock', x: 9.2, z: 6, color: '#5c6a78' },
      { kind: 'lantern', x: -7.6, z: 9.8, color: '#ffc95c' },
      { kind: 'hayBale', x: 8.4, z: 10 },
    ],
    look: look(
      { color: '#b89e68', roughness: 1, metalness: 0 },
      { depths: '#0a2c40', surface: '#2a7a9e', surfaceOpacity: 0.7, surfaceRoughness: 0.12,
        edge: '#d9e8ee', border: { kind: 'bank', color: '#93714a' } },
      'tide pool', 'kelp mound', 'Splash! A die fell in the tide pool!',
    ),
    lighting: DAY,
  },

  farm: {
    meadow: '#a8c45c', hill: '#93b34a', mountain: '#7d9958', cloud: '#ffffff',
    floor: { a: '#d9c799', b: '#c9b380' },
    wall: { color: '#a8845c', cap: '#8f6c44' },
    tower: { body: '#c23b3b', roof: '#8a8e99' },
    jail: { platform: '#8f6c44', bars: '#4a3823' },
    retreat: { padA: '#f0e6c4', padB: '#dfd0a0', post: '#8f6c44', canopy: '#c23b3b', pool: '#57b0e8' },
    sky: { sun: { color: '#fff6d8', size: 1.6 }, stars: false, body: null },
    props: [
      { kind: 'barn', x: -8.8, z: -6, scale: 1.2 },
      { kind: 'roundTree', x: 8.6, z: -5, color: '#5c9e3d' },
      { kind: 'hayBale', x: -9, z: 3 }, { kind: 'hayBale', x: -8.2, z: 4.2, scale: 0.8 },
      { kind: 'roundTree', x: 9, z: 6, color: '#6eb34a', scale: 1.2 },
      { kind: 'hayBale', x: 8.4, z: 10 },
    ],
    look: look(
      { color: '#93b34a', roughness: 1, metalness: 0 },
      { depths: '#3d2f16', surface: '#8f6c44', surfaceOpacity: 0.85, surfaceRoughness: 0.7,
        edge: '#d9c799', border: { kind: 'bank', color: '#6e5433' } },
      'mud puddle', 'haystack', 'Squelch! A die fell in the mud!',
    ),
    lighting: DAY,
  },

  reef: {
    meadow: '#1a6673', hill: '#125460', mountain: '#0d4550', cloud: null,
    floor: { a: '#2a8a99', b: '#1f7080' },
    wall: { color: '#33a3b3', cap: '#26858f' },
    tower: { body: '#33a3b3', roof: '#ff8a5c' },
    jail: { platform: '#26858f', bars: '#0a333a' },
    retreat: { padA: '#3fbccc', padB: '#2a9aa8', post: '#c26e3d', canopy: '#ff8a5c', pool: '#0d4550' },
    sky: { sun: null, stars: false, body: null },
    props: [
      { kind: 'coral', x: -8, z: -7, scale: 1.4, color: '#ff8a5c' },
      { kind: 'coral', x: 8.6, z: -4, color: '#ff6e9e' },
      { kind: 'seaweed', x: -9, z: 3 }, { kind: 'seaweed', x: 9, z: 6 },
      { kind: 'coral', x: -7.6, z: 9.8, color: '#ffc95c', scale: 1.1 },
      { kind: 'rock', x: 8.8, z: 10, color: '#125460' },
    ],
    look: look(
      { color: '#1f7080', roughness: 0.8, metalness: 0 },
      { depths: '#041e24', surface: '#0d4550', surfaceOpacity: 0.6, surfaceRoughness: 0.3,
        edge: '#3fbccc', border: { kind: 'stone', color: '#125460' } },
      'deep trench', 'coral head', 'Blub! A die sank into the trench!',
    ),
    lighting: night('#1a8095', '#062a30', '#7fd4e8'),
  },

  city: {
    meadow: '#33364a', hill: '#282b3d', mountain: null, cloud: null,
    floor: { a: '#4a4d63', b: '#3b3e52' },
    wall: { color: '#565a73', cap: '#43465c' },
    tower: { body: '#565a73', roof: '#ffc95c' },
    jail: { platform: '#43465c', bars: '#1d1f2b' },
    retreat: { padA: '#63677f', padB: '#4f5268', post: '#282b3d', canopy: '#ffc95c', pool: '#57c9e8' },
    sky: { sun: null, stars: true, body: { kind: 'moon', color: '#f2ecd8' } },
    props: [
      { kind: 'cityTower', x: -8.6, z: -7, scale: 1.5 }, { kind: 'cityTower', x: 8.6, z: -6, scale: 1.2 },
      { kind: 'cityTower', x: -9.2, z: 2 }, { kind: 'cityTower', x: 9.2, z: 4, scale: 1.4 },
      { kind: 'lantern', x: -7.6, z: 9.8, color: '#ffc95c' }, { kind: 'lantern', x: 8.2, z: 10.2, color: '#ffc95c' },
    ],
    look: look(
      { color: '#4a4d63', roughness: 0.5, metalness: 0.3 },
      { depths: '#0a0c14', surface: '#1d1f2b', surfaceOpacity: 0.4, surfaceRoughness: 0.6,
        edge: '#ffc95c', border: { kind: 'hull', color: '#43465c' } },
      'open manhole', 'rooftop vent', 'Clang! A die fell down the manhole!',
    ),
    lighting: night('#3d4260', '#16181f', '#ffe0a0'),
  },

  toybox: {
    meadow: '#d9a05c', hill: '#c98d4a', mountain: null, cloud: null,
    floor: { a: '#e8c076', b: '#d9a95c' },
    wall: { color: '#c23b3b', cap: '#9e2f2f' },
    tower: { body: '#3f7fd0', roof: '#ffd21f' },
    jail: { platform: '#9e2f2f', bars: '#4a2a1a' },
    retreat: { padA: '#f0dfb4', padB: '#e0c98e', post: '#8a5a34', canopy: '#3fa35c', pool: '#57c9e8' },
    sky: { sun: { color: '#fff6d8', size: 1.4 }, stars: false, body: null },
    props: [
      { kind: 'toyBlock', x: -8.4, z: -7, scale: 1.3, color: '#c23b3b' },
      { kind: 'toyBlock', x: 8.6, z: -5, color: '#3f7fd0' },
      { kind: 'toyBlock', x: -9, z: 3, color: '#3fa35c', scale: 1.1 },
      { kind: 'toyBlock', x: 9, z: 6, color: '#ffd21f' },
      { kind: 'balloon', x: -7.6, z: 9.8, color: '#ff6e6e' },
      { kind: 'toyBlock', x: 8.4, z: 10, color: '#b06ee8', scale: 0.8 },
    ],
    look: look(
      { color: '#3fa35c', roughness: 0.5, metalness: 0 },
      { depths: '#4a2a1a', surface: '#8a5a34', surfaceOpacity: 0.8, surfaceRoughness: 0.5,
        edge: '#ffd21f', border: { kind: 'stone', color: '#9e2f2f' } },
      'toy bin', 'building block', 'Boop! A die fell in the toy bin!',
    ),
    lighting: DAY,
  },
};

/**
 * Registry metadata for each themed arena: what it is called, how the
 * picker abbreviates it, the letterbox sky behind the canvas, and how it
 * is OBTAINED — exactly one of `tier` (a trophy-ladder unlock id) or
 * `price` (coins, bought in the Store), mirroring the rule dice skins
 * already follow.
 *
 * The split is David's ask: "some being purchasable with coins and some
 * being obtained with trophies." Ladder arenas are the grand vistas that
 * mark progress — snow to desert to the moon. Store arenas are the fun
 * ones a pocket of coins should be able to reach on any afternoon.
 */
export interface ThemedArenaMeta {
  name: string;
  short: string;
  emoji: string;
  skyColor: string;
  tier?: string;
  price?: number;
}

export const THEMED_ARENA_META: Record<ThemedArenaId, ThemedArenaMeta> = {
  // Trophy ladder, in climbing order. Tier thresholds live in progress.ts.
  snow: { name: 'Snowy Hollow', short: 'Snow', emoji: '⛄', skyColor: '#cfe4f2', tier: 'snow-arena' },
  desert: { name: 'Desert Dunes', short: 'Desert', emoji: '🌵', skyColor: '#ffe8b0', tier: 'desert-arena' },
  autumn: { name: 'Autumn Woods', short: 'Autumn', emoji: '🍂', skyColor: '#d8e2ea', tier: 'autumn-arena' },
  aurora: { name: 'Frozen Lights', short: 'Aurora', emoji: '🌌', skyColor: '#0d2530', tier: 'aurora-arena' },
  volcano: { name: 'Volcano Rim', short: 'Volcano', emoji: '🌋', skyColor: '#3a1420', tier: 'volcano-arena' },
  cavern: { name: 'Crystal Cavern', short: 'Cavern', emoji: '💎', skyColor: '#231539', tier: 'cavern-arena' },
  sky: { name: 'Sky Kingdom', short: 'Sky', emoji: '🌈', skyColor: '#7fc4f0', tier: 'sky-arena' },
  moon: { name: 'Moon Base', short: 'Moon', emoji: '🌕', skyColor: '#0a0c16', tier: 'moon-arena' },

  // Bought in the Store, cheapest first.
  farm: { name: 'Sunny Farm', short: 'Farm', emoji: '🚜', skyColor: '#bfe0f5', price: 800 },
  beach: { name: 'Treasure Beach', short: 'Beach', emoji: '🏖️', skyColor: '#8fd8f0', price: 1000 },
  candy: { name: 'Candy Meadow', short: 'Candy', emoji: '🍭', skyColor: '#ffbedd', price: 1200 },
  glade: { name: 'Glow Glade', short: 'Glade', emoji: '🍄', skyColor: '#122530', price: 1400 },
  cove: { name: 'Pirate Cove', short: 'Cove', emoji: '🏴‍☠️', skyColor: '#a8c9d8', price: 1600 },
  reef: { name: 'Coral Reef', short: 'Reef', emoji: '🐠', skyColor: '#0e4e5c', price: 1800 },
  city: { name: 'Rooftop City', short: 'City', emoji: '🌃', skyColor: '#1a1c2a', price: 2000 },
  toybox: { name: 'Toy Room', short: 'Toys', emoji: '🧸', skyColor: '#f2e2c4', price: 2400 },
};
