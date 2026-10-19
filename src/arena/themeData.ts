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
  | 'lantern'       // post + warm glow head
  // Added 26 Aug 2026 when David asked for "some extra decorations on
  // them to make them look better". All cheap; sixteen arenas multiply.
  | 'flowers'       // a little clump of stems with coloured heads
  | 'bush'          // rounded shrub, optionally berried
  | 'pebbles'       // a low scatter of stones
  | 'torch'         // post with a flame, for the fiery and the dark
  | 'banner'        // pole and hanging cloth
  /*
    Added 25 Sep 2026. David: "make the surroundings of all arenas on all
    the maps more decorative and maybe put like people fighting on some
    of them."

    `duel` answers the second half and goes on six of the sixteen — the
    ones where a fight belongs, not all of them. The other three are the
    kind of small furniture that reads as somebody LIVING there rather
    than as landscape, which is what most of these arenas were short of:
    a camp, a dock, a road.
  */
  | 'duel'          // two little figures mid-fight, blades crossed
  | 'crate'         // stacked boxes, for a camp or a dock
  | 'signpost'      // post with a crossed board
  | 'campfire';     // ring of stones with a flame

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

/**
 * What the tray is BUILT of — one kind per battlefield, no two alike.
 *
 * David asked on 26 Aug 2026 for arenas that were not all castles: "they
 * can be something that makes sense for the arena name, like how the
 * space station doesn't look like a castle." The first answer to that
 * gave them four shared kinds — battlement, rocks, posts, hull — and he
 * came straight back: "you just used the same like 4 different templates
 * for the arenas now, make them all unique."
 *
 * He is right, and the reason four was not enough is the same reason one
 * was not: a SKYLINE is what you recognise a place by, so four skylines
 * across sixteen battlefields means four places wearing sixteen coats of
 * paint rather than one. So there are sixteen now, one each, named after
 * what the place would actually be built of.
 *
 * The physics tray underneath is identical in every one of them. Only
 * the crest along the wall top and the four corner pieces change, which
 * is the same bargain the hazards make — the suite asserts that the wall
 * geometry never reads this field.
 *
 * Two of the sixteen were still not their own building, and the board
 * redesign of 18 Oct 2026 (docs/board-redesign.md) named them: Frozen
 * Lights wore the Space Station's panelled hull and Sky Kingdom the
 * castle's merlons. They are 'iceBlocks' and 'cloudBalustrade' now, and
 * there is no castle among the sixteen at all — the request was
 * precisely "don't just make different color castles".
 */
export type ArenaStructure =
  | 'snowFence'    // snow: a snowbank with a slatted snow-fence in it
  | 'adobe'        // desert: round-topped adobe parapet, beam ends through it
  | 'basalt'       // volcano: clustered basalt columns, a smoking cone per corner
  | 'logPile'      // autumn: zigzag split-rail fence, stump and pumpkin corners
  | 'iceBlocks'    // aurora: stacked ice blocks, ice obelisks at the corners
  | 'stalagmite'   // cavern: rows of dripstone, crystal clusters among them
  | 'cloudBalustrade' // sky: a gold balustrade standing on cloud
  | 'airlock'      // moon: a regolith berm with habitat modules, dome corners
  | 'driftwood'    // beach: leaning weathered planks, parasols
  | 'gingerbread'  // candy: piped icing scallops, candy swirls
  | 'mossStone'    // glade: mossy boulders, giant toadstools
  | 'shipHull'     // cove: strake planking, barrels and a lantern
  | 'picket'       // farm: pointed pickets, a lantern on the gatepost
  | 'coralRim'     // reef: branching coral heads, anemones
  | 'parapet'      // city: concrete parapet, railing, aerial masts
  | 'blocks';      // toybox: alternating wooden bricks, block towers

export interface ArenaTheme {
  /** What the walls and corners are made of. */
  structure: ArenaStructure;
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

/**
 * A rig for the night worlds — moodier than daylight, but still LIT.
 *
 * It used to be a third dimmer than this (0.55 / 1.6 / 0.5 against
 * daylight's 1.0 / 2.4 / 0.7), and rendering the sixteen showed what
 * that cost: Rooftop City came out at 0.26 mean brightness with 54% of
 * the board in deep shadow, and the volcano at 0.28 with 78%. The
 * palettes had already been lifted once for exactly this complaint; it
 * was the lighting undoing them, and the scene's filmic tone mapping
 * compressing what was left.
 *
 * The moodiness now comes from the COLOUR of the light rather than from
 * how little of it there is, which is what it should have been doing all
 * along — a volcano at night is not dark, it is orange.
 */
const night = (skyTint: string, groundTint: string, key: string): ArenaLighting => ({
  hemisphere: { sky: skyTint, ground: groundTint, intensity: 0.95 },
  key: { position: [4, 12, 6], intensity: 2.2, color: key },
  fill: { position: [-6, 8, -4], intensity: 0.7, color: skyTint },
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
    // A hollow in the woods: a snowbank round it with a wooden
    // snow-fence standing in the drift. Not a fortress.
    structure: 'snowFence',
    // The hill and floor.b tones sit a real step bluer than their pale
    // partners — the 31 Aug 2026 skin review found the old pair so
    // close that the drift painter showed nothing and the whole floor
    // read as flat plaster rather than snow.
    meadow: '#e7f0f6', hill: '#c8d9e8', mountain: '#b9c9d8', cloud: '#ffffff',
    floor: { a: '#e3edf4', b: '#c2d3e6' },
    /*
      Five roles (docs/board-redesign.md): base the floor pair, surface
      the packed-snow wall, accent the marker poles' red, glow and shadow
      in boardKits.tsx (a low winter sun; snow-shadow blue). The cap is
      the snow-fence's timber, the one dark thing on the rim.
    */
    wall: { color: '#d3dfea', cap: '#7d5b3c' },
    tower: { body: '#d3dfea', roof: '#c4473d' },
    jail: { platform: '#9dafbe', bars: '#4b5866' },
    retreat: { padA: '#f3f8fb', padB: '#d8e6f0', post: '#8a5a34', canopy: '#d95f5f', pool: '#9fd3f0' },
    sky: { sun: { color: '#fff6d8', size: 1.6 }, stars: false, body: null },
    props: [
      { kind: 'pine', x: -3.44, z: -7.4, scale: 0.62 },
      { kind: 'pine', x: -3.38, z: -3.3, scale: 0.55 },
      { kind: 'bush', x: -3.46, z: -0.9, scale: 0.9, color: '#9db8a8' },
      { kind: 'pine', x: -3.4, z: 1.6, scale: 0.58 },
      { kind: 'pebbles', x: -3.46, z: 3.6, scale: 0.9, color: '#c7d6e2' },
      // The snowman that stood at (3.42, -7.4) is built there now, over
      // and over, by a child (snowLife.tsx, 19 Oct 2026).
      { kind: 'pine', x: 3.38, z: -3.3, scale: 0.6 },
      { kind: 'rock', x: 3.46, z: -0.9, scale: 0.7, color: '#c7d6e2' },
      { kind: 'pine', x: 3.4, z: 1.6, scale: 0.52 },
      { kind: 'bush', x: 3.46, z: 3.6, scale: 0.85, color: '#9db8a8' },
      { kind: 'pine', x: -2.4, z: -8.8, scale: 0.5 },
      { kind: 'pebbles', x: 0.1, z: -9, scale: 0.9, color: '#c7d6e2' },
      { kind: 'pine', x: 2.5, z: -8.8, scale: 0.46 },
      { kind: 'duel', x: -3.75, z: -5.6, scale: 1.0, color: '#c23b3b' },
      { kind: 'campfire', x: -3.95, z: -9.15, scale: 0.85 },
      { kind: 'pine', x: 3.75, z: -5.6, scale: 0.46 },
      { kind: 'signpost', x: 3.95, z: -9.15, scale: 0.8, color: '#8a6a4a' },
      { kind: 'bush', x: -3.05, z: 0.35, scale: 0.8, color: '#9db8a8' },
      { kind: 'pine', x: -3.05, z: -4.55, scale: 0.52 },
      { kind: 'pebbles', x: -3.05, z: -2.1, scale: 0.85, color: '#c7d6e2' },
      { kind: 'snowman', x: 3.05, z: 0.35, scale: 0.5 },
      { kind: 'pine', x: 3.05, z: -4.55, scale: 0.48 },
      { kind: 'bush', x: 3.05, z: -2.1, scale: 0.75, color: '#9db8a8' },
    ],
    look: look(
      { kind: 'snowman', color: '#eef5fa', roughness: 0.6, metalness: 0 },
      { kind: 'frozenPond', depths: '#6aa8cc', surface: '#bfe2f2', surfaceOpacity: 0.8, surfaceRoughness: 0.05,
        edge: '#f6fbff', border: { kind: 'bank', color: '#dae7f0' } },
      'frozen pond', 'snowman', 'Crack! A die slid into the frozen pond!',
    ),
    lighting: DAY,
  },

  desert: {
    // An adobe pueblo wall, rounded over by hand, beam ends through it;
    // a round tower with a domed roof at each corner.
    structure: 'adobe',
    // `mountain` is the shaded face of a dune in the ground painter.
    meadow: '#e8c987', hill: '#dcb968', mountain: '#b98448', cloud: null,
    floor: { a: '#e6c78c', b: '#d0a865' },
    // Base the sand, surface sun-baked adobe a step redder than the sand
    // so the wall does not melt into the floor, accent the terracotta
    // domes; glow (white sun) and shadow (lee-side brown) in boardKits.
    wall: { color: '#cf9a62', cap: '#bf8853' },
    tower: { body: '#cf9a62', roof: '#b0623a' },
    jail: { platform: '#b08a48', bars: '#5e4426' },
    retreat: { padA: '#f0dfb4', padB: '#dfc78e', post: '#8a5a34', canopy: '#d97f38', pool: '#58b7c9' },
    sky: { sun: { color: '#fff1b8', size: 2 }, stars: false, body: null },
    props: [
      { kind: 'cactus', x: -3.44, z: -7.3, scale: 0.7 },
      { kind: 'rock', x: -3.38, z: -3.4, scale: 0.75, color: '#c4924e' },
      { kind: 'cactus', x: -3.46, z: -0.8, scale: 0.6 },
      { kind: 'pebbles', x: -3.4, z: 1.5, scale: 0.95, color: '#c4924e' },
      { kind: 'flowers', x: -3.46, z: 3.5, scale: 0.95, color: '#e85c7a' },
      { kind: 'cactus', x: 3.42, z: -7.3, scale: 0.62 },
      { kind: 'bush', x: 3.38, z: -3.4, scale: 0.8, color: '#93a35c' },
      { kind: 'rock', x: 3.46, z: -0.8, scale: 0.8, color: '#b08549' },
      { kind: 'cactus', x: 3.4, z: 1.5, scale: 0.68 },
      { kind: 'pebbles', x: 3.46, z: 3.5, scale: 0.9, color: '#b08549' },
      { kind: 'rock', x: -2.4, z: -8.8, scale: 0.7, color: '#c4924e' },
      { kind: 'cactus', x: 0.1, z: -9, scale: 0.5 },
      { kind: 'pebbles', x: 2.5, z: -8.8, scale: 0.85, color: '#c4924e' },
      { kind: 'duel', x: -3.75, z: -5.6, scale: 1.0, color: '#c98a4a' },
      { kind: 'campfire', x: -3.95, z: -9.15, scale: 0.85 },
      { kind: 'crate', x: 3.75, z: -5.6, scale: 0.85, color: '#b08549' },
      { kind: 'signpost', x: 3.95, z: -9.15, scale: 0.8, color: '#b08549' },
      { kind: 'cactus', x: -3.05, z: -2.1, scale: 0.6 },
      { kind: 'rock', x: -3.05, z: -4.6, scale: 0.65, color: '#c4924e' },
      { kind: 'pebbles', x: -3.05, z: 0.35, scale: 0.85, color: '#b08549' },
      { kind: 'cactus', x: 3.05, z: -2.1, scale: 0.55 },
      { kind: 'bush', x: 3.05, z: -4.6, scale: 0.7, color: '#93a35c' },
      { kind: 'rock', x: 3.05, z: 0.35, scale: 0.6, color: '#b08549' },
    ],
    look: look(
      { kind: 'dune', color: '#d9b268', roughness: 1, metalness: 0 },
      { kind: 'quicksand', depths: '#7a5a2e', surface: '#d4b073', surfaceOpacity: 0.9, surfaceRoughness: 0.9,
        edge: '#f4e4bc', border: null },
      'quicksand pit', 'sand dune', 'Floomp! A die sank in the quicksand!',
    ),
    lighting: DAY,
  },

  volcano: {
    /*
      Basalt boulders, not battlements. The palette was lifted on 26 Aug
      2026 — David: "a lot of these new maps are way too dark and you
      can't really tell what it is." It was 53% of its pixels below a
      third brightness. It is still NIGHT and still lit from below; the
      rock is now warm grey-plum rather than near-black, which is what
      rock beside an open lava flow actually looks like.
    */
    structure: 'basalt',
    /*
      October 2026: the spec asks for BLACK basalt with glowing seams, and
      the 26 Aug note above asks for nothing too dark to read. Both hold
      because the light now comes from the rock itself: the floor and
      ground are a dark warm grey (a good step brighter than true basalt;
      the painter darkens the ground outside, so the meadow and hill the
      shelf picture is drawn from stay as they were),
      and the lava in their seams is an emissive map that shines under
      the night rig. Base and surface are the two greys; accent and glow
      are the lava; shadow is the crust in the cracks (boardKits.tsx).
    */
    meadow: '#6b4a48', hill: '#573b3d', mountain: '#7d4a48', cloud: '#8a5450',
    floor: { a: '#5c5254', b: '#474043' },
    wall: { color: '#5c4b4e', cap: '#433538' },
    tower: { body: '#5c4b4e', roof: '#ff7a2a' },
    jail: { platform: '#6e4e4c', bars: '#33232a' },
    retreat: { padA: '#94706a', padB: '#7a5a54', post: '#4a3336', canopy: '#ff6b2b', pool: '#ff7a2f' },
    sky: { sun: null, stars: false, body: null },
    /*
      No fighters here since 19 Oct 2026 (David: "take away the fighting
      people"), and the torches and the far crate sit a step in from
      the edge, on the near bank of the lava river that now runs round
      the outside of the rim (volcanoLife.tsx). Rocks and lava pools
      stay where they were; a rock in a lava river is a rock in a lava
      river.
    */
    props: [
      { kind: 'torch', x: -3.3, z: -7.3, scale: 0.75, color: '#ff9440' },
      { kind: 'rock', x: -3.38, z: -3.4, scale: 0.8, color: '#5c4042' },
      { kind: 'lavaPool', x: -3.5, z: -0.8, scale: 0.42 },
      { kind: 'rock', x: -3.4, z: 1.6, scale: 0.65, color: '#4a3336' },
      { kind: 'torch', x: -3.3, z: 3.5, scale: 0.7, color: '#ff9440' },
      { kind: 'rock', x: 3.42, z: -7.3, scale: 0.75, color: '#67494a' },
      { kind: 'torch', x: 3.3, z: -3.4, scale: 0.75, color: '#ff9440' },
      { kind: 'lavaPool', x: 3.5, z: -0.8, scale: 0.42 },
      { kind: 'pebbles', x: 3.4, z: 1.6, scale: 0.95, color: '#573b3d' },
      { kind: 'rock', x: 3.46, z: 3.5, scale: 0.7, color: '#5c4042' },
      { kind: 'rock', x: -2.4, z: -8.8, scale: 0.65, color: '#4a3336' },
      { kind: 'lavaPool', x: 0.1, z: -9, scale: 0.4 },
      { kind: 'rock', x: 2.5, z: -8.8, scale: 0.6, color: '#67494a' },
      { kind: 'torch', x: -3.3, z: -9.0, scale: 0.85, color: '#ff9440' },
      { kind: 'rock', x: 3.75, z: -5.6, scale: 0.7, color: '#5c4042' },
      { kind: 'crate', x: 3.3, z: -9.0, scale: 0.8, color: '#4a3336' },
      { kind: 'lavaPool', x: -3.05, z: -2.1, scale: 0.7 },
      { kind: 'rock', x: -3.05, z: 0.4, scale: 0.6, color: '#67494a' },
      { kind: 'pebbles', x: -3.05, z: -4.6, scale: 0.85, color: '#573b3d' },
      { kind: 'torch', x: 3.05, z: -2.1, scale: 0.8, color: '#ff9440' },
      { kind: 'rock', x: 3.05, z: 0.4, scale: 0.65, color: '#4a3336' },
      { kind: 'pebbles', x: 3.05, z: -4.6, scale: 0.85, color: '#573b3d' },
    ],
    look: look(
      { kind: 'smokingRock', color: '#4a3a3a', roughness: 1, metalness: 0 },
      { kind: 'lava', depths: '#3a0c00', surface: '#ff7a2a', surfaceOpacity: 0.85, surfaceRoughness: 0.3,
        edge: '#ffd23f', border: { kind: 'stone', color: '#4a3336' } },
      'lava pool', 'smoking rock', 'Sssss! A die fell in the lava!',
    ),
    lighting: night('#9e4a54', '#5c3038', '#ffb070'),
  },

  autumn: {
    // A zigzag split-rail fence round a clearing in the woods.
    structure: 'logPile',
    meadow: '#c98d4a', hill: '#b3763c', mountain: '#8a6a52', cloud: '#f2ede4',
    /*
      The floor is EARTH now, a forest-floor brown, and the leaves are
      drawn on it (groundTexture.ts). Base the earth, surface the dark wall
      the rails stand on, accent the pumpkins; glow (low gold sun) and
      shadow (leaf shadow brown) in boardKits.tsx. The earth is well below
      the ivory dice in value and well away from the dice colours in
      saturation — and a step darker than Pirate Cove's deck, which a
      lighter earth matched almost exactly in colour (0.11 apart on the
      suite's histogram, against a floor of 0.1).
    */
    floor: { a: '#7f654a', b: '#957756' },
    wall: { color: '#6e5238', cap: '#8f7558' },
    tower: { body: '#6e5238', roof: '#d4742e' },
    jail: { platform: '#7d6140', bars: '#3e3020' },
    retreat: { padA: '#e3c89a', padB: '#cfae76', post: '#6e4a28', canopy: '#c9622e', pool: '#7fa8c9' },
    sky: { sun: { color: '#fff3cf', size: 1.4 }, stars: false, body: null },
    props: [
      { kind: 'roundTree', x: -3.44, z: -7.4, scale: 0.62, color: '#d0642e' },
      { kind: 'roundTree', x: -3.38, z: -3.3, scale: 0.55, color: '#c9903a' },
      { kind: 'bush', x: -3.46, z: -0.9, scale: 0.9, color: '#a8422e' },
      { kind: 'roundTree', x: -3.4, z: 1.6, scale: 0.58, color: '#b3492e' },
      { kind: 'flowers', x: -3.46, z: 3.6, scale: 0.95, color: '#e8a33a' },
      { kind: 'roundTree', x: 3.42, z: -7.4, scale: 0.6, color: '#c9903a' },
      { kind: 'hayBale', x: 3.38, z: -3.3, scale: 0.85 },
      { kind: 'roundTree', x: 3.46, z: -0.9, scale: 0.56, color: '#d0642e' },
      { kind: 'bush', x: 3.4, z: 1.6, scale: 0.85, color: '#a8422e' },
      { kind: 'roundTree', x: 3.46, z: 3.6, scale: 0.5, color: '#c9903a' },
      { kind: 'pebbles', x: -2.4, z: -8.8, scale: 0.9, color: '#8a6a52' },
      { kind: 'roundTree', x: 0.1, z: -9, scale: 0.46, color: '#b3492e' },
      { kind: 'hayBale', x: 2.5, z: -8.8, scale: 0.8 },
      { kind: 'campfire', x: -3.75, z: -5.6, scale: 0.85 },
      { kind: 'roundTree', x: -3.95, z: -9.15, scale: 0.6, color: '#c9903a' },
      { kind: 'signpost', x: 3.75, z: -5.6, scale: 0.8, color: '#8a6a52' },
      { kind: 'bush', x: 3.95, z: -9.15, scale: 0.8, color: '#a8422e' },
      { kind: 'roundTree', x: -3.05, z: 0.35, scale: 0.55, color: '#d0642e' },
      { kind: 'flowers', x: -3.05, z: -4.55, scale: 0.85, color: '#e8a33a' },
      { kind: 'pebbles', x: -3.05, z: -2.1, scale: 0.85, color: '#8a6a52' },
      { kind: 'roundTree', x: 3.05, z: 0.35, scale: 0.58, color: '#b3492e' },
      { kind: 'bush', x: 3.05, z: -4.55, scale: 0.75, color: '#a8422e' },
      { kind: 'hayBale', x: 3.05, z: -2.1, scale: 0.7 },
    ],
    look: look(
      { kind: 'leafPile', color: '#a5772f', roughness: 1, metalness: 0 },
      { kind: 'puddle', water: true, depths: '#1e2a2a', surface: '#7b97a6', surfaceOpacity: 0.75, surfaceRoughness: 0.1,
        edge: '#dfe8ea', border: { kind: 'bank', color: '#6e4a28' } },
      'puddle', 'leaf pile', 'Splash! A die fell in the puddle!',
    ),
    lighting: DAY,
  },

  aurora: {
    /*
      A frozen lake under the lights, walled in ice. Before October 2026
      it was a polar station wearing the Space Station's panelling, and
      before that a castle standing on
      near-black ice, 69% of it below a third brightness and unreadable
      at thumbnail size. The ground is now SNOW, which is what ground
      under an aurora is, and the dark is kept where it belongs: the sky.
      The contrast between pale ground and green curtains is the whole
      picture.
    */
    structure: 'iceBlocks',
    // Floor, wall, meadow and hill all used to sit in one narrow value
    // band under the night rig — exactly the fault the glade's own note
    // warns about — so the whole arena read flat and foggy. The outside
    // is pulled DOWN out of that band and the board stays pale, so it
    // reads as a lit clearing in a dark snowfield.
    meadow: '#6e93a0', hill: '#5d818e', mountain: '#4e6f7c', cloud: null,
    /*
      October 2026: the board is a frozen LAKE now — cracked pale ice with
      the lights lying faint across it — walled in stacked ice blocks
      rather than the Space Station's panelling. Base the ice, surface the
      block blue (also their inner glow), accent the aurora green; glow
      and shadow (deep-ice blue) in boardKits.tsx. The ice stays pale:
      the contrast between a pale board and a dark sky is the picture.
    */
    floor: { a: '#cde5ee', b: '#a8cddd' },
    wall: { color: '#9cc9da', cap: '#d4f1fa' },
    tower: { body: '#9cc9da', roof: '#5ef0b4' },
    jail: { platform: '#7a9daa', bars: '#2c4450' },
    retreat: { padA: '#c9e2e8', padB: '#aecfd8', post: '#4a6470', canopy: '#57e8a9', pool: '#57c9e8' },
    sky: { sun: null, stars: true, body: { kind: 'aurora', color: '#4fe89a' } },
    props: [
      // Pines a saturated deep green and crystals two steps brighter —
      // at the old values both rendered as near-black blobs under the
      // night rig (skin review, 31 Aug 2026).
      { kind: 'pine', x: -3.44, z: -7.4, scale: 0.6, color: '#2d8a62' },
      { kind: 'crystal', x: -3.38, z: -3.3, scale: 0.7, color: '#7df5c2' },
      { kind: 'pebbles', x: -3.46, z: -0.9, scale: 0.95, color: '#7ba2b0' },
      { kind: 'pine', x: -3.4, z: 1.6, scale: 0.55, color: '#247550' },
      { kind: 'crystal', x: -3.46, z: 3.6, scale: 0.6, color: '#a8ecf8' },
      { kind: 'crystal', x: 3.42, z: -7.4, scale: 0.75, color: '#7df5c2' },
      { kind: 'pine', x: 3.38, z: -3.3, scale: 0.58, color: '#2d8a62' },
      { kind: 'rock', x: 3.46, z: -0.9, scale: 0.75, color: '#7ba2b0' },
      { kind: 'bush', x: 3.4, z: 1.6, scale: 0.85, color: '#3f8068' },
      { kind: 'crystal', x: 3.46, z: 3.6, scale: 0.55, color: '#a8ecf8' },
      { kind: 'pebbles', x: -2.4, z: -8.8, scale: 0.9, color: '#7ba2b0' },
      { kind: 'crystal', x: 0.1, z: -9, scale: 0.5, color: '#7df5c2' },
      { kind: 'pine', x: 2.5, z: -8.8, scale: 0.46, color: '#247550' },
      { kind: 'lantern', x: -3.75, z: -5.6, scale: 0.85, color: '#7df5c2' },
      { kind: 'pine', x: -3.95, z: -9.15, scale: 0.5, color: '#2d8a62' },
      { kind: 'crystal', x: 3.75, z: -5.6, scale: 0.7, color: '#a8ecf8' },
      { kind: 'pebbles', x: 3.95, z: -9.15, scale: 0.85, color: '#7ba2b0' },
      { kind: 'pine', x: -3.05, z: 0.35, scale: 0.48, color: '#247550' },
      { kind: 'crystal', x: -3.05, z: -4.55, scale: 0.65, color: '#7df5c2' },
      { kind: 'bush', x: -3.05, z: -2.1, scale: 0.75, color: '#3f8068' },
      { kind: 'pine', x: 3.05, z: 0.35, scale: 0.52, color: '#2d8a62' },
      { kind: 'rock', x: 3.05, z: -4.55, scale: 0.6, color: '#7ba2b0' },
      { kind: 'crystal', x: 3.05, z: -2.1, scale: 0.6, color: '#a8ecf8' },
    ],
    look: look(
      { kind: 'iceBoulder', color: '#a9d3e0', roughness: 0.7, metalness: 0 },
      { kind: 'iceHole', water: true, depths: '#04141a', surface: '#1d5a6e', surfaceOpacity: 0.7, surfaceRoughness: 0.1,
        edge: '#7fe8c0', border: { kind: 'bank', color: '#93b8c4' } },
      'fishing hole', 'frozen boulder', 'Brrr! A die fell through the ice!',
    ),
    lighting: night('#5a9aa0', '#8aabb8', '#dff8ec'),
  },

  cavern: {
    /*
      Heaped rock underground — a cave has no battlements. Lifted out of
      near-black on 26 Aug 2026 for the same reason as the volcano: at
      55% of pixels below a third brightness, the amethyst read as one
      dark smudge. The stone is now lit violet-grey; the crystals still
      glow, and now they glow against something.
    */
    structure: 'stalagmite',
    meadow: '#4a3d5c', hill: '#3d3350', mountain: '#584a6e', cloud: null,
    /*
      October 2026: dark rock with glowing crystal veins. Marc's cut slabs
      are still the floor; the crystal moved from their faces into the
      seams, where it glows. Base the slab rock, surface the cave wall,
      accent the amethyst; the cap is the paler dripstone the stalagmites
      are made of. Glow and shadow in boardKits.tsx.
    */
    floor: { a: '#5a4e6c', b: '#473d58' },
    wall: { color: '#6a5d7e', cap: '#8f7fa2' },
    tower: { body: '#6a5d7e', roof: '#c98aff' },
    jail: { platform: '#63537a', bars: '#2a2138' },
    retreat: { padA: '#6e5f88', padB: '#5e5075', post: '#3d3350', canopy: '#c98aff', pool: '#7fd4e8' },
    sky: { sun: null, stars: false, body: null },
    props: [
      { kind: 'crystal', x: -3.44, z: -7.3, scale: 0.95, color: '#c98aff' },
      { kind: 'crystal', x: -3.28, z: -5.4, scale: 0.6, color: '#8ad4e8' },
      { kind: 'crystal', x: -3.38, z: -3.4, scale: 0.75, color: '#a37ae8' },
      { kind: 'mushroom', x: -3.46, z: -1.4, scale: 0.7, color: '#7fd4e8' },
      { kind: 'crystal', x: -3.3, z: 0.5, scale: 0.8, color: '#dcaeff' },
      { kind: 'crystal', x: -3.44, z: 2.2, scale: 0.62, color: '#f0d68a' },
      { kind: 'rock', x: -3.46, z: 3.7, scale: 0.75, color: '#584a6e' },
      { kind: 'torch', x: 3.42, z: -7.3, scale: 0.75, color: '#ffb04a' },
      { kind: 'crystal', x: 3.3, z: -5.4, scale: 0.85, color: '#c98aff' },
      { kind: 'crystal', x: 3.38, z: -3.4, scale: 0.65, color: '#dcaeff' },
      { kind: 'crystal', x: 3.46, z: -1.4, scale: 0.9, color: '#a37ae8' },
      { kind: 'mushroom', x: 3.3, z: 0.5, scale: 0.68, color: '#7fd4e8' },
      { kind: 'crystal', x: 3.4, z: 2.2, scale: 0.7, color: '#f0d68a' },
      { kind: 'torch', x: 3.46, z: 3.7, scale: 0.7, color: '#ffb04a' },
      { kind: 'crystal', x: -2.5, z: -8.8, scale: 0.72, color: '#a37ae8' },
      { kind: 'crystal', x: 0.1, z: -9.1, scale: 0.6, color: '#c98aff' },
      { kind: 'crystal', x: 2.5, z: -8.8, scale: 0.68, color: '#dcaeff' },
      { kind: 'duel', x: -3.95, z: -9.15, scale: 1.0, color: '#a37ae8' },
      { kind: 'torch', x: -3.8, z: -6.3, scale: 0.85, color: '#ffb04a' },
      { kind: 'crystal', x: 3.95, z: -9.15, scale: 0.7, color: '#dcaeff' },
      { kind: 'rock', x: 3.8, z: -6.3, scale: 0.65, color: '#584a6e' },
      { kind: 'crystal', x: -3.05, z: -2.4, scale: 0.65, color: '#8ad4e8' },
      { kind: 'mushroom', x: -3.7, z: -4.4, scale: 0.7, color: '#7fd4e8' },
      { kind: 'pebbles', x: -3.05, z: -0.5, scale: 0.85, color: '#584a6e' },
      { kind: 'crystal', x: 3.05, z: -2.4, scale: 0.6, color: '#f0d68a' },
      { kind: 'torch', x: 3.7, z: -4.4, scale: 0.8, color: '#ffb04a' },
      { kind: 'rock', x: 3.05, z: -0.5, scale: 0.6, color: '#584a6e' },
    ],
    look: look(
      { kind: 'crystals', color: '#5e5075', roughness: 0.9, metalness: 0 },
      { kind: 'chasm', depths: '#08050e', surface: '#5f4fa8', surfaceOpacity: 0.5, surfaceRoughness: 0.2,
        edge: '#c98aff', border: { kind: 'stone', color: '#4e4263' } },
      'glowing chasm', 'crystal cluster', 'Whoosh! A die fell down the chasm!',
    ),
    lighting: night('#7d5eb8', '#3f3054', '#e0c8ff'),
  },

  sky: {
    /*
      A palace in the air: a gold balustrade standing on cloud. It was
      "the one real castle" until October 2026 — merlons and cone roofs —
      and a castle in different colours is exactly what the redesign
      request said not to make.
    */
    structure: 'cloudBalustrade',
    /*
      Repainted 31 Aug 2026 off a two-lens review that scored the old
      white-on-white 4 and 3. The ground pair is now open SKY — the
      painter draws cumulus on it, not tiles — with `mountain` carrying
      the blue-grey of a cloud's shaded belly. The floor pair spans a
      real value range so the marble blocks differ from one another,
      and the wall is a mid-blue so the one real castle in the set has
      a silhouette instead of vanishing into its own floor.
    */
    meadow: '#9fd0f2', hill: '#5b9fd8', mountain: '#8fa9c6', cloud: '#ffffff',
    /*
      Base the ivory paving, surface the cloud the balustrade stands on
      (the wall body is the cloud bank's shaded face, a soft blue so the
      board keeps its edge), accent the gold; glow and shadow (cloud-belly
      blue) in boardKits.tsx. Gold, not #ffd21f: a near-primary yellow
      the length of a balustrade is the yellow die's colour.
    */
    floor: { a: '#f7f3e8', b: '#cbd8e6' },
    wall: { color: '#a9c4e0', cap: '#d9b25a' },
    tower: { body: '#f6f1e2', roof: '#e3b84e' },
    jail: { platform: '#aecbe3', bars: '#5c7d99' },
    retreat: { padA: '#ffffff', padB: '#e3eff8', post: '#c9a05c', canopy: '#ff8ab0', pool: '#8fd0f0' },
    sky: { sun: { color: '#fff6d8', size: 1.8 }, stars: false, body: { kind: 'rainbow', color: '#ff6e6e' } },
    props: [
      { kind: 'cloudIsle', x: -3.46, z: -7.4, scale: 0.5 },
      { kind: 'cloudIsle', x: -3.2, z: -5.6, scale: 0.34 },
      { kind: 'banner', x: -3.38, z: -3.3, scale: 0.75, color: '#ff8ab0' },
      // Balloons pulled in from the far corners to the mid-walls, where
      // the camera actually looks — they were the only pigment on the
      // board and all of it was at the edges of the frame.
      { kind: 'balloon', x: -3.1, z: -1.6, scale: 0.6, color: '#33cc6b' },
      { kind: 'cloudIsle', x: -3.3, z: 0.2, scale: 0.3 },
      { kind: 'flowers', x: -3.4, z: 2, scale: 0.95, color: '#ff6e6e' },
      { kind: 'balloon', x: -3.46, z: 3.6, scale: 0.6, color: '#ff6e6e' },
      { kind: 'balloon', x: 3.42, z: -7.4, scale: 0.62, color: '#57c9e8' },
      { kind: 'cloudIsle', x: 3.44, z: -5.6, scale: 0.46 },
      { kind: 'banner', x: 3.46, z: -3.3, scale: 0.75, color: '#ffd21f' },
      { kind: 'balloon', x: 3.1, z: -1.6, scale: 0.58, color: '#ff8ab0' },
      { kind: 'cloudIsle', x: 3.28, z: 0.4, scale: 0.32 },
      { kind: 'balloon', x: 3.15, z: 2.2, scale: 0.62, color: '#cc79fc' },
      { kind: 'flowers', x: 3.46, z: 3.8, scale: 0.9, color: '#ff8ab0' },
      { kind: 'cloudIsle', x: -2.6, z: -8.9, scale: 0.42 },
      { kind: 'balloon', x: 0.1, z: -9, scale: 0.5, color: '#ffd21f' },
      { kind: 'cloudIsle', x: 2.6, z: -8.9, scale: 0.4 },
      { kind: 'cloudIsle', x: -1.1, z: -9.4, scale: 0.3 },
      { kind: 'cloudIsle', x: 1.4, z: -9.5, scale: 0.34 },
      { kind: 'banner', x: -3.95, z: -9.15, scale: 0.85, color: '#57c9e8' },
      { kind: 'cloudIsle', x: -3.8, z: -6.45, scale: 0.7 },
      { kind: 'balloon', x: 3.95, z: -9.15, scale: 0.7, color: '#ffd21f' },
      { kind: 'flowers', x: 3.8, z: -6.5, scale: 0.85, color: '#ff8ab0' },
      { kind: 'balloon', x: -3.7, z: -4.5, scale: 0.65, color: '#33cc6b' },
      { kind: 'lantern', x: 3.05, z: -4.45, scale: 0.8, color: '#ffd21f' },
      { kind: 'flowers', x: 3.5, z: -0.65, scale: 0.8, color: '#ff6e6e' },
    ],
    look: look(
      { kind: 'cloud', color: '#e9f3fa', roughness: 0.8, metalness: 0 },
      { kind: 'cloudGap', depths: '#5a8fc0', surface: '#cfe8fa', surfaceOpacity: 0.55, surfaceRoughness: 0.3,
        edge: '#ffffff', border: null },
      'cloud gap', 'puffy cloud', 'Wheee! A die fell through the clouds!',
    ),
    lighting: DAY,
  },

  moon: {
    // A base. David's own example of the rule: "like how the space
    // station doesn't look like a castle." Dug in, since October 2026:
    // the walls are bulldozed regolith with habitat modules on them.
    structure: 'airlock',
    meadow: '#b9bcc4', hill: '#a3a7b0', mountain: '#8a8e99', cloud: null,
    /*
      Base the regolith, surface the berm (dust, so no metalness), accent
      the warm window light; the cap is the modules' white. Glow and
      shadow (the black of space past the horizon) in boardKits.tsx.
    */
    floor: { a: '#c6c9d0', b: '#adb1ba' },
    wall: { color: '#8f939c', cap: '#e8eaee' },
    tower: { body: '#e8eaee', roof: '#ffc845' },
    jail: { platform: '#838794', bars: '#3d404a' },
    retreat: { padA: '#d4d7de', padB: '#bcc0c9', post: '#6e7280', canopy: '#ffd21f', pool: '#57c9e8' },
    sky: { sun: null, stars: true, body: { kind: 'earth', color: '#3f7fd0' } },
    props: [
      { kind: 'moonRock', x: -3.44, z: -7.3, scale: 0.7 },
      { kind: 'moonRock', x: -3.28, z: -5.4, scale: 0.45 },
      { kind: 'lantern', x: -3.38, z: -3.4, scale: 0.85, color: '#ffd21f' },
      { kind: 'moonRock', x: -3.46, z: -1.4, scale: 0.55 },
      { kind: 'pebbles', x: -3.3, z: 0.5, scale: 0.95, color: '#a3a7b0' },
      { kind: 'moonRock', x: -3.44, z: 2.2, scale: 0.6 },
      { kind: 'banner', x: -3.46, z: 3.7, scale: 0.75, color: '#3f7fd0' },
      { kind: 'lantern', x: 3.42, z: -7.3, scale: 0.85, color: '#ffd21f' },
      { kind: 'moonRock', x: 3.3, z: -5.4, scale: 0.62 },
      { kind: 'moonRock', x: 3.38, z: -3.4, scale: 0.48 },
      { kind: 'pebbles', x: 3.46, z: -1.4, scale: 0.9, color: '#9a9eaa' },
      { kind: 'moonRock', x: 3.3, z: 0.5, scale: 0.55 },
      { kind: 'moonRock', x: 3.4, z: 2.2, scale: 0.4 },
      { kind: 'lantern', x: 3.46, z: 3.7, scale: 0.8, color: '#ffd21f' },
      { kind: 'moonRock', x: -2.5, z: -8.8, scale: 0.6 },
      { kind: 'pebbles', x: 0.1, z: -9.1, scale: 0.9, color: '#a3a7b0' },
      { kind: 'moonRock', x: 2.5, z: -8.8, scale: 0.55 },
      { kind: 'crate', x: -3.95, z: -9.15, scale: 0.85, color: '#9a9eaa' },
      { kind: 'moonRock', x: -3.8, z: -6.3, scale: 0.7 },
      { kind: 'lantern', x: 3.95, z: -9.15, scale: 0.85, color: '#ffd21f' },
      { kind: 'pebbles', x: 3.8, z: -6.3, scale: 0.85, color: '#a3a7b0' },
      { kind: 'moonRock', x: -3.05, z: -2.4, scale: 0.6 },
      { kind: 'crystal', x: -3.7, z: -4.4, scale: 0.6, color: '#8ad4e8' },
      { kind: 'pebbles', x: -3.05, z: -0.5, scale: 0.85, color: '#9a9eaa' },
      { kind: 'moonRock', x: 3.05, z: -2.4, scale: 0.65 },
      { kind: 'lantern', x: 3.7, z: -4.4, scale: 0.8, color: '#ffd21f' },
      { kind: 'banner', x: 3.05, z: -0.5, scale: 0.8, color: '#3f7fd0' },
    ],
    look: look(
      { kind: 'boulder', color: '#b3b7c0', roughness: 1, metalness: 0 },
      { kind: 'crater', depths: '#14161d', surface: '#9a9ea8', surfaceOpacity: 0.35, surfaceRoughness: 0.9,
        edge: '#e4e6ec', border: { kind: 'bank', color: '#a3a7b1' } },
      'crater', 'moon boulder', 'Gone! A die fell into the crater!',
    ),
    lighting: night('#3d445f', '#2a2e3a', '#f2f4fa'),
  },

  /* ── BOUGHT IN THE STORE ───────────────────────────────────────── */

  beach: {
    /*
      A sand berm fenced with driftwood stakes and a sagging rope, the
      sea breaking at the top of the board (storeBoards.tsx).

      Palette, 18 Oct 2026 (docs/board-redesign.md): base the dry sand,
      surface the berm, accent the life-ring coral, glow the shallow
      turquoise, shadow the wet sand. The floor's second tone was
      lifted a real step apart from the first; at a whisker apart the
      ripples and the footprints painted nothing.
    */
    structure: 'driftwood',
    meadow: '#f0dfa8', hill: '#e6d090', mountain: null, cloud: '#ffffff',
    floor: { a: '#eedcae', b: '#d2b986' },
    wall: { color: '#d8c38e', cap: '#9a8e7a' },
    tower: { body: '#a99c86', roof: '#ef7d6a' },
    jail: { platform: '#c2a865', bars: '#6e5a34' },
    retreat: { padA: '#fff3d0', padB: '#efe0ae', post: '#8a5a34', canopy: '#ff6e6e', pool: '#4fd0c9' },
    sky: { sun: { color: '#fff6d8', size: 1.7 }, stars: false, body: null },
    props: [
      { kind: 'palm', x: -3.46, z: -7.3, scale: 0.62 },
      { kind: 'rock', x: -3.38, z: -3.4, scale: 0.7, color: '#c2a865' },
      { kind: 'palm', x: -3.5, z: -0.8, scale: 0.55 },
      { kind: 'pebbles', x: -3.4, z: 1.6, scale: 0.95, color: '#d9c08a' },
      // Was a beach umbrella; at the bottom of the screen it sat over the pads.
      { kind: 'rock', x: -3.46, z: 3.5, scale: 0.6, color: '#c2a865' },
      { kind: 'umbrella', x: 3.44, z: -7.3, scale: 0.58, color: '#ff6e6e' },
      { kind: 'palm', x: 3.42, z: -3.4, scale: 0.6 },
      { kind: 'bush', x: 3.46, z: -0.8, scale: 0.85, color: '#3a8a4a' },
      { kind: 'palm', x: 3.5, z: 1.6, scale: 0.52 },
      { kind: 'flowers', x: 3.46, z: 3.5, scale: 0.95, color: '#ff6e9e' },
      // Behind the jail is the surf now (storeBoards.tsx), so what stands
      // there is what stands in surf: rocks, and the palms and the sign
      // moved up onto the wet sand.
      { kind: 'rock', x: -2.4, z: -8.8, scale: 0.65, color: '#a99c86' },
      { kind: 'rock', x: 0.3, z: -9.2, scale: 0.45, color: '#9a8f7c' },
      { kind: 'rock', x: 2.5, z: -8.9, scale: 0.55, color: '#a99c86' },
      { kind: 'campfire', x: -3.75, z: -5.6, scale: 0.85 },
      { kind: 'palm', x: -3.9, z: -7.9, scale: 0.55 },
      { kind: 'crate', x: 3.75, z: -5.6, scale: 0.85, color: '#c2a865' },
      { kind: 'signpost', x: 3.85, z: -7.9, scale: 0.8, color: '#c2a865' },
      { kind: 'umbrella', x: -3.05, z: -2.1, scale: 0.7, color: '#ff6e6e' },
      { kind: 'pebbles', x: -3.05, z: 0.4, scale: 0.85, color: '#d9c08a' },
      { kind: 'bush', x: -3.05, z: -4.6, scale: 0.75, color: '#3a8a4a' },
      { kind: 'palm', x: 3.05, z: -2.1, scale: 0.5 },
      { kind: 'flowers', x: 3.05, z: 0.4, scale: 0.85, color: '#ff6e9e' },
      { kind: 'rock', x: 3.05, z: -4.6, scale: 0.6, color: '#c2a865' },
    ],
    look: look(
      { kind: 'sandcastle', color: '#e6d090', roughness: 1, metalness: 0 },
      { kind: 'tidePool', water: true, depths: '#0a4a52', surface: '#3fc9c2', surfaceOpacity: 0.65, surfaceRoughness: 0.1,
        edge: '#fff3d0', border: null },
      'tide pool', 'sandcastle', 'Splash! A die fell in the tide pool!',
    ),
    lighting: DAY,
  },

  candy: {
    /*
      A bar of milk chocolate in a frosting meadow, fenced with candy
      canes and gumdrops on a piped-icing wall.

      The floor was pale pink squares — "pink bathroom tiles" in the
      18 Oct 2026 review — and is chocolate now: base the milk
      chocolate, surface the pink frosting, accent the cane red, glow
      the mint, shadow the dark chocolate in the moulding. Pink stays
      outside the tray, where the meadow is, so the board itself is the
      one brown thing in a pink world and every die sits on it clearly.
    */
    structure: 'gingerbread',
    meadow: '#f4b5d6', hill: '#e89cc6', mountain: '#d086b4', cloud: '#ffe8f4',
    floor: { a: '#8f5f40', b: '#6a4029' },
    wall: { color: '#eea4c4', cap: '#fff2f7' },
    tower: { body: '#eea4c4', roof: '#8ae0c0' },
    jail: { platform: '#d68cb8', bars: '#8a4a6e' },
    retreat: { padA: '#fff0f7', padB: '#f7d6e8', post: '#a8624a', canopy: '#8ae0c0', pool: '#8ad4e8' },
    sky: { sun: { color: '#fff6d8', size: 1.4 }, stars: false, body: null },
    props: [
      { kind: 'lollipop', x: -3.44, z: -7.3, scale: 0.7, color: '#ff6e6e' },
      { kind: 'flowers', x: -3.38, z: -3.4, scale: 0.95, color: '#ff8ab0' },
      { kind: 'lollipop', x: -3.46, z: -0.8, scale: 0.6, color: '#8ae0c0' },
      { kind: 'rock', x: -3.4, z: 1.6, scale: 0.65, color: '#f7f0e0' },
      { kind: 'banner', x: -3.46, z: 3.5, scale: 0.75, color: '#ff6e6e' },
      { kind: 'lollipop', x: 3.42, z: -7.3, scale: 0.72, color: '#ffd21f' },
      { kind: 'rock', x: 3.38, z: -3.4, scale: 0.6, color: '#f7f0e0' },
      { kind: 'lollipop', x: 3.46, z: -0.8, scale: 0.62, color: '#b06ee8' },
      { kind: 'flowers', x: 3.4, z: 1.6, scale: 0.9, color: '#8ae0c0' },
      { kind: 'lollipop', x: 3.46, z: 3.5, scale: 0.55, color: '#ff6e6e' },
      { kind: 'flowers', x: -2.4, z: -8.8, scale: 0.9, color: '#ff8ab0' },
      { kind: 'lollipop', x: 0.1, z: -9, scale: 0.5, color: '#8ae0c0' },
      { kind: 'flowers', x: 2.5, z: -8.8, scale: 0.85, color: '#ffd21f' },
      { kind: 'lollipop', x: -3.75, z: -5.6, scale: 0.7, color: '#8ae0c0' },
      { kind: 'flowers', x: -3.95, z: -9.15, scale: 0.85, color: '#ff8ab0' },
      { kind: 'lollipop', x: 3.75, z: -5.6, scale: 0.65, color: '#b06ee8' },
      { kind: 'banner', x: 3.95, z: -9.15, scale: 0.8, color: '#ff6e6e' },
      { kind: 'lollipop', x: -3.05, z: -2.1, scale: 0.7, color: '#ffd21f' },
      { kind: 'flowers', x: -3.05, z: 0.4, scale: 0.8, color: '#8ae0c0' },
      { kind: 'rock', x: -3.05, z: -4.6, scale: 0.6, color: '#f7f0e0' },
      { kind: 'lollipop', x: 3.05, z: -2.1, scale: 0.68, color: '#ff6e6e' },
      { kind: 'flowers', x: 3.05, z: 0.4, scale: 0.85, color: '#ffd21f' },
      { kind: 'rock', x: 3.05, z: -4.6, scale: 0.55, color: '#f7f0e0' },
    ],
    look: look(
      { kind: 'gumdrop', color: '#e2609a', roughness: 0.35, metalness: 0 },
      { kind: 'chocolate', depths: '#3a1d12', surface: '#7a4428', surfaceOpacity: 0.7, surfaceRoughness: 0.2,
        edge: '#e8c9a8', border: { kind: 'stone', color: '#e88ab4' } },
      'chocolate pool', 'gumdrop', 'Gloop! A die fell in the chocolate!',
    ),
    lighting: DAY,
  },

  glade: {
    /*
      Mossy boulders round a clearing. Was a blue-black castle at 70%
      below a third brightness; it is now a MOSSY green glade under a
      moon, which is both brighter and further from the reef — the two
      were the closest pair of teals in the set.
    */
    structure: 'mossStone',
    /*
      Three value bands on purpose, after a 31 Aug 2026 review found
      everything living in one: the tray is a LIGHT mown clearing, the
      ground outside is DARK dusk moss pulled toward the teal sky, and
      the wall between them is warm earth-and-stone brown so the border
      belongs to neither green. Collapse any of these back together and
      the arena edge disappears again.
    */
    meadow: '#2b5747', hill: '#1e453c', mountain: '#3c7a64',
    cloud: null,
    /*
      Dark moss now, as the 18 Oct 2026 brief asks — and still apart from
      the green die by LIGHTNESS, which is what the old note here was
      protecting. The lawn it replaces was paler than the die (#a3c9a5);
      this is two value steps darker than it and pulled toward blue, so
      #33cc6b reads as the brightest green on the board instead of
      dissolving into it. At the old mid-green #74b183 the die vanished;
      neither side of that value is the problem, the middle was.

      Palette: base the moss, surface the dark stone of the wall, accent
      the lichen grey on the boulders, glow the cyan and lime spores,
      shadow the crevices between the cushions.
    */
    floor: { a: '#4a7d66', b: '#2f5747' },
    wall: { color: '#4f4c45', cap: '#7c776a' },
    tower: { body: '#4f4c45', roof: '#7ff0dc' },
    jail: { platform: '#2f5a48', bars: '#152e22' },
    retreat: { padA: '#5f9c78', padB: '#4a8562', post: '#33684a', canopy: '#4fd0c9', pool: '#4fd0c9' },
    sky: { sun: null, stars: true, body: { kind: 'moon', color: '#e9f0f7' } },
    props: [
      // Toadstool caps in the two spore colours — cyan and yellow-green
      // — so the glow on the ground has lamps standing over it.
      { kind: 'mushroom', x: -3.44, z: -7.3, scale: 0.6, color: '#4fe8d6' },
      { kind: 'mushroom', x: -3.28, z: -5.5, scale: 0.42, color: '#c9f26e' },
      { kind: 'pine', x: -3.38, z: -3.4, scale: 0.58, color: '#245c40' },
      { kind: 'mushroom', x: -3.46, z: -1.4, scale: 0.5, color: '#c9f26e' },
      { kind: 'flowers', x: -3.3, z: 0.4, scale: 0.95, color: '#8ad4e8' },
      { kind: 'mushroom', x: -3.44, z: 2.1, scale: 0.46, color: '#4fe8d6' },
      { kind: 'bush', x: -3.46, z: 3.6, scale: 0.9, color: '#2f6b4a' },
      { kind: 'pine', x: 3.42, z: -7.3, scale: 0.6, color: '#245c40' },
      { kind: 'mushroom', x: 3.3, z: -5.5, scale: 0.55, color: '#4fe8d6' },
      { kind: 'mushroom', x: 3.38, z: -3.4, scale: 0.48, color: '#4fe8d6' },
      { kind: 'pebbles', x: 3.46, z: -1.4, scale: 0.95, color: '#8a7f6d' },
      { kind: 'mushroom', x: 3.3, z: 0.5, scale: 0.52, color: '#c9f26e' },
      { kind: 'flowers', x: 3.4, z: 2.2, scale: 0.9, color: '#8ad4e8' },
      { kind: 'bush', x: 3.46, z: 3.7, scale: 0.85, color: '#2f6b4a' },
      { kind: 'mushroom', x: -2.5, z: -8.8, scale: 0.5, color: '#c9f26e' },
      { kind: 'pebbles', x: 0.1, z: -9.1, scale: 0.9, color: '#8a7f6d' },
      { kind: 'pine', x: 2.5, z: -8.8, scale: 0.46, color: '#245c40' },
      { kind: 'mushroom', x: -3.95, z: -9.15, scale: 0.75, color: '#c9f26e' },
      { kind: 'lantern', x: -3.4, z: -8.3, scale: 0.8, color: '#4fe8d6' },
      { kind: 'pine', x: 3.95, z: -9.15, scale: 0.5, color: '#245c40' },
      { kind: 'pebbles', x: 3.4, z: -8.3, scale: 0.85, color: '#8a7f6d' },
      { kind: 'mushroom', x: -3.7, z: -4.45, scale: 0.7, color: '#4fe8d6' },
      { kind: 'bush', x: -3.05, z: -2.4, scale: 0.75, color: '#2f6b4a' },
      { kind: 'flowers', x: 3.7, z: -4.45, scale: 0.85, color: '#8ad4e8' },
      { kind: 'mushroom', x: 3.05, z: -2.4, scale: 0.65, color: '#c9f26e' },
      { kind: 'pine', x: 3.05, z: -0.5, scale: 0.48, color: '#245c40' },
    ],
    look: look(
      { kind: 'mushroom', color: '#3a7f86', roughness: 0.6, metalness: 0 },
      { kind: 'spring', water: true, depths: '#0a2418', surface: '#2fb8a0', surfaceOpacity: 0.7, surfaceRoughness: 0.15,
        edge: '#8ff5e0', border: { kind: 'bank', color: '#33684a' } },
      'glowing spring', 'glowing mushroom', 'Ploop! A die fell in the glowing spring!',
    ),
    lighting: night('#4a9a7e', '#2c5a44', '#b8f0e0'),
  },

  cove: {
    /*
      A ship tied up at a quay: the board is her deck, the walls are her
      bulwarks with a railing, cannon and boarding nets, and the sea is
      on three sides of her (storeBoards.tsx). It used to be a hull
      beached on sand, which from above is a wooden box in a sandpit.

      Palette: base the honey deck, surface the dark hull, accent the
      brass, glow the lanterns, shadow the tar in the seams.
    */
    structure: 'shipHull',
    meadow: '#c9b382', hill: '#b89e68', mountain: '#6e7d8a', cloud: '#e9e4d8',
    floor: { a: '#c19763', b: '#94693e' },
    wall: { color: '#5a3b27', cap: '#3d281a' },
    tower: { body: '#5a3b27', roof: '#ffd27a' },
    jail: { platform: '#66492c', bars: '#33241a' },
    retreat: { padA: '#d9c799', padB: '#c2ab78', post: '#66492c', canopy: '#c23b3b', pool: '#2a7a9e' },
    sky: { sun: { color: '#fff0c0', size: 1.4 }, stars: false, body: null },
    /*
      Everything round the ship is sea now, so the scenery is what floats
      or stands in it: other ships at anchor, rocks, drifting cargo and
      kelp. The hay bales, the bush and the campfire were standing on the
      water. Kept off the cannon (z -3.0, -0.4, 2.2) so the guns show.
    */
    props: [
      { kind: 'shipMast', x: -3.6, z: -7.3, scale: 0.42 },
      { kind: 'rock', x: -3.55, z: -4.3, scale: 0.55, color: '#6e7d8a' },
      { kind: 'seaweed', x: -3.5, z: -1.7, scale: 0.7 },
      { kind: 'crate', x: -3.6, z: 0.9, scale: 0.7, color: '#6e5a3d' },
      { kind: 'rock', x: -3.5, z: 3.4, scale: 0.6, color: '#5c6a78' },
      { kind: 'shipMast', x: 3.6, z: -6.9, scale: 0.4 },
      { kind: 'crate', x: 3.55, z: -4.3, scale: 0.75, color: '#6e5a3d' },
      { kind: 'rock', x: 3.55, z: -1.6, scale: 0.65, color: '#5c6a78' },
      { kind: 'seaweed', x: 3.5, z: 0.8, scale: 0.75 },
      { kind: 'rock', x: 3.55, z: 3.3, scale: 0.55, color: '#6e7d8a' },
      { kind: 'rock', x: -2.4, z: -8.8, scale: 0.7, color: '#6e7d8a' },
      { kind: 'shipMast', x: 0.4, z: -9.3, scale: 0.36 },
      { kind: 'crate', x: 2.5, z: -8.7, scale: 0.7, color: '#6e5a3d' },
      { kind: 'rock', x: -3.95, z: -9.15, scale: 0.6, color: '#5c6a78' },
      { kind: 'seaweed', x: 3.95, z: -9.15, scale: 0.7 },
    ],
    look: look(
      { kind: 'treasure', color: '#d9a845', roughness: 0.35, metalness: 0.7 },
      { kind: 'cargoHatch', depths: '#0b3550', surface: '#7a5a3a', surfaceOpacity: 0.7, surfaceRoughness: 0.12,
        edge: '#3f8fb0', border: { kind: 'hull', color: '#6e4a2a' } },
      'cargo hatch', 'treasure pile', 'Splash! A die fell through the cargo hatch!',
    ),
    lighting: DAY,
  },

  farm: {
    /*
      A white picket fence on a grassy bank round a ploughed field.

      It was meant to be a fence all along, and from above it read as a
      wrestling ring: a thick brown wall with white diamonds on it and a
      grey knob on every corner post (18 Oct 2026 review). From almost
      straight down a fence is its PICKETS — a close white dashed line —
      so the bank is green, the pickets are many, thin and white, and
      the corners are gateposts with a sunflower.

      Palette: base the ploughed earth, surface the grass bank, accent
      the fence white, glow the sunflower, shadow the furrows.
    */
    structure: 'picket',
    meadow: '#a8c45c', hill: '#93b34a', mountain: '#7d9958', cloud: '#ffffff',
    floor: { a: '#a8805a', b: '#7a5739' },
    wall: { color: '#7ea650', cap: '#efeadc' },
    tower: { body: '#c23b3b', roof: '#f0c040' },
    jail: { platform: '#8f6c44', bars: '#4a3823' },
    retreat: { padA: '#f0e6c4', padB: '#dfd0a0', post: '#8f6c44', canopy: '#c23b3b', pool: '#57b0e8' },
    sky: { sun: { color: '#fff6d8', size: 1.6 }, stars: false, body: null },
    props: [
      { kind: 'barn', x: -3.5, z: -7.3, scale: 0.5 },
      { kind: 'hayBale', x: -3.3, z: -5.4, scale: 0.8 },
      { kind: 'roundTree', x: -3.38, z: -3.4, scale: 0.58, color: '#5c9e3d' },
      { kind: 'flowers', x: -3.44, z: -1.5, scale: 0.9, color: '#ffffff' },
      { kind: 'hayBale', x: -3.46, z: 0.3, scale: 0.9 },
      { kind: 'flowers', x: -3.4, z: 2, scale: 0.95, color: '#ffd21f' },
      { kind: 'bush', x: -3.46, z: 3.6, scale: 0.9, color: '#5c9e3d' },
      { kind: 'roundTree', x: 3.42, z: -7.3, scale: 0.6, color: '#6eb34a' },
      { kind: 'hayBale', x: 3.3, z: -5.4, scale: 0.85 },
      { kind: 'hayBale', x: 3.38, z: -3.4, scale: 0.75 },
      { kind: 'roundTree', x: 3.46, z: -1.4, scale: 0.52, color: '#5c9e3d' },
      { kind: 'flowers', x: 3.32, z: 0.4, scale: 0.9, color: '#ff6e6e' },
      { kind: 'bush', x: 3.4, z: 2.1, scale: 0.85, color: '#6eb34a' },
      { kind: 'hayBale', x: 3.46, z: 3.7, scale: 0.8 },
      { kind: 'bush', x: -2.5, z: -8.8, scale: 0.85, color: '#6eb34a' },
      { kind: 'hayBale', x: 0.1, z: -9.1, scale: 0.8 },
      { kind: 'roundTree', x: 2.5, z: -8.8, scale: 0.46, color: '#5c9e3d' },
      { kind: 'signpost', x: -3.95, z: -9.15, scale: 0.85, color: '#8a5a34' },
      { kind: 'hayBale', x: -3.8, z: -6.3, scale: 0.7 },
      { kind: 'roundTree', x: 3.95, z: -9.15, scale: 0.6, color: '#5c9e3d' },
      { kind: 'crate', x: 3.8, z: -6.3, scale: 0.85, color: '#8a5a34' },
      { kind: 'flowers', x: -3.7, z: -4.4, scale: 0.85, color: '#ffd21f' },
      { kind: 'bush', x: -3.05, z: -2.45, scale: 0.75, color: '#6eb34a' },
      { kind: 'flowers', x: -3.05, z: -0.6, scale: 0.8, color: '#ffffff' },
      { kind: 'roundTree', x: 3.05, z: -2.4, scale: 0.58, color: '#6eb34a' },
      { kind: 'hayBale', x: 3.7, z: -4.4, scale: 0.65 },
    ],
    look: look(
      { kind: 'haystack', color: '#d9b45a', roughness: 1, metalness: 0 },
      { kind: 'mud', depths: '#3d2a16', surface: '#7a5634', surfaceOpacity: 0.85, surfaceRoughness: 0.7,
        edge: '#d9c799', border: { kind: 'bank', color: '#6e5433' } },
      'mud puddle', 'haystack', 'Squelch! A die fell in the mud!',
    ),
    lighting: DAY,
  },

  reef: {
    /*
      Coral heads heaped round the rim. Nothing on a reef is squared off.

      18 Oct 2026: the wall is now live rock carrying five KINDS of coral
      — brain domes, table plates, staghorn, tube sponges, anemones — not
      one repeated blob, and the floor is open sea-floor sand with light
      moving over it (storeBoards.tsx). The tray was teal water-on-teal;
      sand is what a reef stands on and what a die is easy to see on.

      Palette: base the pale sand, surface the violet live rock, accent
      the coral, glow the caustic light, shadow the deep water beyond.
    */
    structure: 'coralRim',
    meadow: '#1a6673', hill: '#125460', mountain: '#0d4550', cloud: null,
    floor: { a: '#d6c9a2', b: '#a2977a' },
    wall: { color: '#7a6f95', cap: '#5f5679' },
    tower: { body: '#625878', roof: '#ff8a5c' },
    jail: { platform: '#26858f', bars: '#0a333a' },
    retreat: { padA: '#3fbccc', padB: '#2a9aa8', post: '#c26e3d', canopy: '#ff8a5c', pool: '#0d4550' },
    sky: { sun: null, stars: false, body: null },
    props: [
      { kind: 'coral', x: -3.44, z: -7.3, scale: 0.85, color: '#ff8a5c' },
      { kind: 'coral', x: -3.3, z: -5.5, scale: 0.6, color: '#b884d8' },
      { kind: 'seaweed', x: -3.38, z: -3.4, scale: 0.8 },
      { kind: 'coral', x: -3.46, z: -1.4, scale: 0.7, color: '#ff6e9e' },
      { kind: 'coral', x: -3.3, z: 0.4, scale: 0.55, color: '#5ce0b0' },
      { kind: 'pebbles', x: -3.4, z: 2, scale: 0.95, color: '#125460' },
      { kind: 'coral', x: -3.46, z: 3.6, scale: 0.65, color: '#8ad4e8' },
      { kind: 'coral', x: 3.42, z: -7.3, scale: 0.8, color: '#ffc95c' },
      { kind: 'coral', x: 3.3, z: -5.5, scale: 0.58, color: '#5ce0b0' },
      { kind: 'coral', x: 3.38, z: -3.4, scale: 0.72, color: '#b884d8' },
      { kind: 'seaweed', x: 3.46, z: -1.4, scale: 0.85 },
      { kind: 'coral', x: 3.32, z: 0.4, scale: 0.62, color: '#ff8a5c' },
      { kind: 'coral', x: 3.4, z: 2.1, scale: 0.7, color: '#ff6e9e' },
      { kind: 'seaweed', x: 3.46, z: 3.7, scale: 0.75 },
      { kind: 'coral', x: -2.5, z: -8.8, scale: 0.6, color: '#ff6e9e' },
      { kind: 'coral', x: 0.1, z: -9.1, scale: 0.55, color: '#ffc95c' },
      { kind: 'coral', x: 2.5, z: -8.8, scale: 0.58, color: '#8ad4e8' },
      { kind: 'coral', x: -3.95, z: -9.15, scale: 0.7, color: '#5ce0b0' },
      { kind: 'seaweed', x: -3.4, z: -8.3, scale: 0.8 },
      { kind: 'coral', x: 3.95, z: -9.15, scale: 0.65, color: '#ffc95c' },
      { kind: 'pebbles', x: 3.4, z: -8.3, scale: 0.85, color: '#125460' },
      { kind: 'coral', x: -3.7, z: -4.45, scale: 0.68, color: '#ff8a5c' },
      { kind: 'seaweed', x: -3.05, z: -2.4, scale: 0.75 },
      { kind: 'coral', x: 3.7, z: -4.45, scale: 0.6, color: '#b884d8' },
      { kind: 'coral', x: 3.05, z: -2.4, scale: 0.7, color: '#ff6e9e' },
    ],
    look: look(
      { kind: 'anemone', color: '#5c5a7a', roughness: 0.8, metalness: 0 },
      { kind: 'whirlpool', water: true, depths: '#041e24', surface: '#1a7a8a', surfaceOpacity: 0.6, surfaceRoughness: 0.3,
        edge: '#bff4fa', border: { kind: 'stone', color: '#125460' } },
      'whirlpool', 'sea anemone', 'Swoosh! A die got sucked into the whirlpool!',
    ),
    // The key is a paler sea-light than it was (#9fe0f0), so the sand reads
    // as sand and the coral keeps its warm colours under the water.
    lighting: night('#3a9cb4', '#1a5662', '#d6f2f6'),
  },

  city: {
    /*
      A ROOFTOP: panelled parapet, a lit strip along it, aerial masts at
      the corners. It was the darkest picture in the set by a distance —
      88% of its pixels below a third brightness, which is why David
      could not tell what it was. It is now DUSK rather than midnight,
      the concrete is lit from the streets below, and the skyline behind
      still reads as night because the sky and the towers carry that.
    */
    /*
      18 Oct 2026: the roof is tarred felt with gravel, sealant and
      drains, the parapet carries what a real roof does — air
      conditioners, vents, a pipe run, aerials and a dish — the corners
      are water towers, and the ground outside is the street grid a long
      way down rather than more roof (storeBoards.tsx, groundTexture.ts).

      Palette: base the tar felt, surface the concrete parapet, accent
      the lit windows, glow the street lamps, shadow the streets.
    */
    /*
      19 Oct 2026, David: "Keep the same night time city aesthetic but
      make it look better." Still night, but a night with light in it:
      the tar is moonlit blue-grey rather than wet cement, the parapet is
      a shade cooler and darker so the fittings on it read, the roofs
      below are lighter so the street grid shows as a grid of buildings
      rather than a void with dots in it, and the lighting is split the
      way a city night is — sodium-warm key, blue fill — so lit faces go
      amber and shadows go blue instead of everything going grey.
    */
    structure: 'parapet',
    meadow: '#7a82a8', hill: '#585f86', mountain: null, cloud: '#565d80',
    floor: { a: '#6b7290', b: '#4f5570' },
    wall: { color: '#777d96', cap: '#9fa5ba', metalness: 0.1 },
    tower: { body: '#777d96', roof: '#ffc95c' },
    jail: { platform: '#717691', bars: '#2c2f42' },
    retreat: { padA: '#8a90ab', padB: '#747a97', post: '#4c5170', canopy: '#ffc95c', pool: '#57c9e8' },
    sky: { sun: null, stars: true, body: { kind: 'moon', color: '#f2ecd8' } },
    /*
      Neighbouring towers, and nothing else. The ground outside the
      parapet is the street a long way down now, and the lanterns,
      bushes, banners and signposts that used to stand on it read as
      giants on the pavement. Towers of different heights coming up past
      the roof are the one thing that belongs there — and they are what
      makes the drop.
    */
    props: [
      { kind: 'cityTower', x: -3.5, z: -7.3, scale: 0.46 },
      { kind: 'cityTower', x: -3.35, z: -5.4, scale: 0.32 },
      { kind: 'cityTower', x: -3.45, z: -3.4, scale: 0.4 },
      { kind: 'cityTower', x: -3.35, z: -1.5, scale: 0.3 },
      { kind: 'cityTower', x: -3.5, z: 0.4, scale: 0.38 },
      { kind: 'cityTower', x: -3.35, z: 2.1, scale: 0.3 },
      { kind: 'cityTower', x: -3.45, z: 3.7, scale: 0.4 },
      { kind: 'cityTower', x: 3.5, z: -7.3, scale: 0.5 },
      { kind: 'cityTower', x: 3.35, z: -5.4, scale: 0.34 },
      { kind: 'cityTower', x: 3.4, z: -3.4, scale: 0.36 },
      { kind: 'cityTower', x: 3.5, z: -1.4, scale: 0.44 },
      { kind: 'cityTower', x: 3.4, z: 0.5, scale: 0.36 },
      { kind: 'cityTower', x: 3.35, z: 2.2, scale: 0.3 },
      { kind: 'cityTower', x: 3.45, z: 3.7, scale: 0.4 },
      { kind: 'cityTower', x: -2.5, z: -8.8, scale: 0.42 },
      { kind: 'cityTower', x: 0.1, z: -9.1, scale: 0.3 },
      { kind: 'cityTower', x: 2.5, z: -8.8, scale: 0.4 },
    ],
    look: look(
      { kind: 'acUnit', color: '#9aa0b8', roughness: 0.5, metalness: 0.3 },
      { kind: 'skylight', depths: '#b0743e', surface: '#f0d9a8', surfaceOpacity: 0.4, surfaceRoughness: 0.6,
        edge: '#ffc95c', border: { kind: 'hull', color: '#717691' } },
      'skylight', 'rooftop air conditioner', 'Clang! A die fell through the skylight!',
    ),
    lighting: night('#7d8ac4', '#363a56', '#ffd39a'),
  },

  toybox: {
    /*
      A playmat on the floorboards, walled with interlocking bricks.

      18 Oct 2026: the wall is now a real brick wall — courses of
      two-, three- and four-stud bricks, staggered, studs on top — where
      it was a row of small cubes, and the floor is a soft mint playmat
      with a road printed round its edge instead of yellow checks
      (storeBoards.tsx, groundTexture.ts). Mint because none of the six
      dice is mint, and ivory dice read on it at a glance.

      Palette: base the mint mat, surface the brick, accent the mustard
      and cream bricks, glow the beach ball, shadow the mat's binding.
    */
    structure: 'blocks',
    meadow: '#d9a05c', hill: '#c98d4a', mountain: null, cloud: null,
    floor: { a: '#93c9bf', b: '#6ba69c' },
    // The cap and roof are OFF the dice palette. The crest cycles
    // [wall.color, cap, accent], and at #c23b3b / #3f7fd0 / #ffd21f that
    // put 48 red, blue and yellow cubes the size and colour of dice
    // along the rim — so the wall looked like a row of dice and you had
    // to look twice to find the real ones. It is the last arena a
    // player unlocks, at 3350 coins, and it should be the clearest.
    // Red toy frame stays; the rim goes mint and cream. The bricks
    // themselves (storeBoards.tsx) keep to the same rule: coral, teal,
    // mustard, periwinkle, cream and sage, none of them a die's colour,
    // and long with studs so none of them is a die's shape either.
    wall: { color: '#d06a5e', cap: '#f1e6cf' },
    tower: { body: '#5aa7a8', roof: '#e7b84f' },
    jail: { platform: '#9e2f2f', bars: '#4a2a1a' },
    retreat: { padA: '#f0dfb4', padB: '#e0c98e', post: '#8a5a34', canopy: '#3fa35c', pool: '#57c9e8' },
    sky: { sun: { color: '#fff6d8', size: 1.4 }, stars: false, body: null },
    props: [
      // Blocks in the wall's own muted colours: a red, blue or yellow cube
      // beside the board is a die you have to look at twice.
      { kind: 'toyBlock', x: -3.46, z: -7.3, scale: 0.5, color: '#d06a5e' },
      { kind: 'balloon', x: -3.38, z: -3.4, scale: 0.6, color: '#ff6e6e' },
      { kind: 'toyBlock', x: -3.46, z: -0.8, scale: 0.45, color: '#93c27e' },
      { kind: 'flowers', x: -3.4, z: 1.6, scale: 0.95, color: '#ff6e6e' },
      { kind: 'toyBlock', x: -3.46, z: 3.5, scale: 0.42, color: '#b79ad8' },
      { kind: 'toyBlock', x: 3.44, z: -7.3, scale: 0.5, color: '#7c95d6' },
      { kind: 'banner', x: 3.38, z: -3.4, scale: 0.75, color: '#7c95d6' },
      { kind: 'toyBlock', x: 3.46, z: -0.8, scale: 0.46, color: '#e7b84f' },
      { kind: 'balloon', x: 3.4, z: 1.6, scale: 0.58, color: '#57c9e8' },
      { kind: 'toyBlock', x: 3.46, z: 3.5, scale: 0.42, color: '#d06a5e' },
      { kind: 'toyBlock', x: -2.4, z: -8.8, scale: 0.44, color: '#e7b84f' },
      { kind: 'pebbles', x: 0.1, z: -9, scale: 0.9, color: '#c98d4a' },
      { kind: 'toyBlock', x: 2.5, z: -8.8, scale: 0.42, color: '#93c27e' },
      { kind: 'duel', x: -3.75, z: -5.6, scale: 1.0, color: '#7c95d6' },
      { kind: 'crate', x: -3.95, z: -9.15, scale: 0.85, color: '#c98d4a' },
      { kind: 'toyBlock', x: 3.75, z: -5.6, scale: 0.6, color: '#93c27e' },
      { kind: 'balloon', x: 3.95, z: -9.15, scale: 0.7, color: '#e7b84f' },
      { kind: 'toyBlock', x: -3.05, z: -2.1, scale: 0.58, color: '#b79ad8' },
      { kind: 'balloon', x: -3.05, z: 0.4, scale: 0.65, color: '#57c9e8' },
      { kind: 'flowers', x: -3.05, z: -4.6, scale: 0.85, color: '#ff6e6e' },
      { kind: 'toyBlock', x: 3.05, z: -2.1, scale: 0.55, color: '#d06a5e' },
      { kind: 'toyBlock', x: 3.05, z: 0.4, scale: 0.6, color: '#7c95d6' },
      { kind: 'pebbles', x: 3.05, z: -4.6, scale: 0.85, color: '#c98d4a' },
    ],
    look: look(
      { kind: 'beachBall', color: '#3fa35c', roughness: 0.5, metalness: 0 },
      { kind: 'toyBox', depths: '#e8d6b0', surface: '#f2c98a', surfaceOpacity: 0.8, surfaceRoughness: 0.5,
        edge: '#f2c14e', border: { kind: 'stone', color: '#b8403a' } },
      'toy box', 'beach ball', 'Boing! A die fell in the toy box!',
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
 *
 * The prices climb by a widening step — 200, then 250, then 300 and on
 * to 500 — rather than the flat 200 they used to, which made the shelf
 * read as a list rather than a ladder. David, 26 Aug 2026: prices should
 * "make sense scaling up higher and higher." They sit above the dice
 * deliberately: a battlefield is a bigger thing to own than a die, and
 * the dearest arena is about fifty Hard wins against the dearest die's
 * twenty.
 */
export interface ThemedArenaMeta {
  name: string;
  short: string;
  skyColor: string;
  tier?: string;
  price?: number;
  /** Won on the season pass, and available no other way (seasonPass.ts). */
  pass?: true;
}

export const THEMED_ARENA_META: Record<ThemedArenaId, ThemedArenaMeta> = {
  // Trophy ladder, in climbing order. Tier thresholds live in progress.ts.
  desert: { name: 'Desert Dunes', short: 'Desert', skyColor: '#ffe8b0', tier: 'desert-arena' },
  autumn: { name: 'Autumn Woods', short: 'Autumn', skyColor: '#d8e2ea', tier: 'autumn-arena' },
  aurora: { name: 'Frozen Lights', short: 'Aurora', skyColor: '#16394a', tier: 'aurora-arena' },
  cavern: { name: 'Crystal Cavern', short: 'Cavern', skyColor: '#3a2552', tier: 'cavern-arena' },
  sky: { name: 'Sky Kingdom', short: 'Sky', skyColor: '#7fc4f0', tier: 'sky-arena' },
  moon: { name: 'Moon Base', short: 'Moon', skyColor: '#0a0c16', tier: 'moon-arena' },

  // Won on the season pass only — moved off the ladder on 30 Sep 2026.
  snow: { name: 'Snowy Hollow', short: 'Snow', skyColor: '#b6dbf2', pass: true },
  volcano: { name: 'Volcano Rim', short: 'Volcano', skyColor: '#5c2430', pass: true },

  // Bought in the Store, cheapest first.
  farm: { name: 'Sunny Farm', short: 'Farm', skyColor: '#bfe0f5', price: 900 },
  beach: { name: 'Treasure Beach', short: 'Beach', skyColor: '#8fd8f0', price: 1100 },
  candy: { name: 'Candy Meadow', short: 'Candy', skyColor: '#ffabd6', price: 1350 },
  glade: { name: 'Glow Glade', short: 'Glade', skyColor: '#1d4450', price: 1650 },
  cove: { name: 'Pirate Cove', short: 'Cove', skyColor: '#a8c9d8', price: 2000 },
  reef: { name: 'Coral Reef', short: 'Reef', skyColor: '#0e4e5c', price: 2400 },
  city: { name: 'Rooftop City', short: 'City', skyColor: '#2e3352', price: 2850 },
  toybox: { name: 'Toy Room', short: 'Toys', skyColor: '#f2e2c4', price: 3350 },
};
