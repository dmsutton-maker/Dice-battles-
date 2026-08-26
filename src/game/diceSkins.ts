import { PatternId } from '../dice/patterns';
import { UnlockId } from './progress';

/**
 * Dice skins colour the SHELL of the die only.
 *
 * The six circular faces are the game signal — a roll is read by matching
 * two face colours — so those never change. Every shell colour here is
 * checked against all six face colours in the test suite: a shell too close
 * to a face colour would swallow that face and make rolls hard to read.
 * Gold is the tightest (it sits nearest Yellow) and is grandfathered in as
 * the original 100-trophy unlock.
 */
export interface DiceSkin {
  id: string;
  name: string;
  emoji: string;
  /** Shell colour, rendered unlit so it is exact on device. */
  body: string;
  /** Pattern painted over the shell. 'plain' is a flat colour. */
  pattern: PatternId;
  /** Pattern colour. Kept close to the shell so it cannot crowd a face. */
  ink?: string;
  /**
   * How this skin is obtained — exactly one of:
   *  - `unlock`: earned by climbing the trophy ladder.
   *  - `price`: bought in the Store with coins.
   * A skin with neither is free from the start.
   */
  unlock?: UnlockId | null;
  price?: number;
}

export const DICE_SKINS: DiceSkin[] = [
  // Earned on the trophy ladder.
  { id: 'ivory', name: 'Ivory', emoji: '🎲', body: '#ffffff', pattern: 'plain', unlock: 'ivory-dice' },
  {
    id: 'gold',
    name: 'Gold',
    emoji: '✨',
    body: '#ffd76a',
    // The dice are drawn unlit, so gold got no highlight from the scene
    // and read as a flat yellow cube. The sweep of light is painted in.
    pattern: 'sheen',
    ink: '#fff8dc',
    unlock: 'golden-dice',
  },
  { id: 'mint', name: 'Mint', emoji: '🍃', body: '#a8f0d8', pattern: 'plain', unlock: 'mint-dice' },
  {
    id: 'bubblegum',
    name: 'Bubblegum',
    emoji: '🍬',
    body: '#ff9ecb',
    pattern: 'plain',
    unlock: 'bubblegum-dice',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    emoji: '🌑',
    body: '#262b40',
    pattern: 'plain',
    unlock: 'midnight-dice',
  },

  // Bought in the Store with coins. Patterned, so they read as a different
  // kind of prize from the ladder's flat colours.
  {
    id: 'zebra',
    name: 'Zebra',
    emoji: '🦓',
    body: '#f4f2ef',
    pattern: 'stripes',
    ink: '#3b3b46',
    price: 250,
  },
  {
    id: 'bubbles',
    name: 'Bubbles',
    emoji: '🫧',
    body: '#cfe9ff',
    pattern: 'bubbles',
    // Near-white so the rims and glints read as light on glass.
    ink: '#f4fbff',
    price: 300,
  },
  {
    id: 'starry',
    name: 'Starry',
    emoji: '⭐',
    body: '#2b2f52',
    pattern: 'stars',
    // White, not the palette's yellow: stars in that exact yellow competed
    // with the yellow face sticker they sit beside.
    ink: '#ffffff',
    price: 450,
  },
  {
    id: 'timber',
    name: 'Timber',
    emoji: '🪵',
    body: '#c49a68',
    // Growth rings rather than the old wavy bands, which were the same
    // painter marble would have used and read as neither.
    pattern: 'wood',
    ink: '#7d5228',
    price: 400,
  },
  {
    id: 'frost',
    name: 'Frost',
    emoji: '❄️',
    body: '#e8f6ff',
    pattern: 'frost',
    ink: '#9fd3f0',
    price: 350,
  },
  {
    id: 'marble',
    name: 'Marble',
    emoji: '🏛️',
    body: '#f2efe8',
    pattern: 'marble',
    // Grey-blue veining. Warm veins on warm stone disappeared at the size
    // a die is actually seen.
    ink: '#7f8792',
    price: 500,
  },
  {
    id: 'granite',
    name: 'Granite',
    emoji: '🪨',
    body: '#9aa0a6',
    pattern: 'granite',
    // Pale quartz. The dark flecks come from the shading side of the mask
    // rather than from a second colour.
    ink: '#eef1f4',
    price: 550,
  },
  {
    id: 'silver',
    name: 'Silver',
    emoji: '🥈',
    body: '#c3cad1',
    // Brushed, not polished like gold. Sharing gold's pattern would make
    // the two one picture in two tints.
    pattern: 'brushed',
    ink: '#ffffff',
    price: 650,
  },

  /*
   * ── The 26 Aug 2026 batch ────────────────────────────────────────
   *
   * David asked for "about 40 new dice skins with some examples being
   * chicken and waffles or different animals or different sports balls".
   * All forty are here: six flat colours continuing the trophy ladder,
   * and thirty-four patterned sets for the Store — animals, sports
   * balls, food (his chicken and waffles included) and a drawer of
   * fabrics and oddities.
   *
   * Every body colour was solved against the six face colours before it
   * was chosen (the ΔLab > 28 rule the suite enforces): the tiger is
   * burnt umber rather than orange and the tennis ball olive rather
   * than optic yellow because the real colours would swallow the orange
   * and yellow faces. The bee is near-black with yellow bands for the
   * same reason the other way round.
   */

  // The trophy ladder's six new rungs, flat colours as ever.
  { id: 'ruby', name: 'Ruby', emoji: '🍒', body: '#8e2f4a', pattern: 'plain', unlock: 'ruby-dice' },
  { id: 'ocean', name: 'Ocean', emoji: '🌊', body: '#1f6e8a', pattern: 'plain', unlock: 'ocean-dice' },
  { id: 'lavender', name: 'Lavender', emoji: '💐', body: '#b9a8e8', pattern: 'plain', unlock: 'lavender-dice' },
  { id: 'slate', name: 'Slate', emoji: '🗿', body: '#5c6470', pattern: 'plain', unlock: 'slate-dice' },
  { id: 'blossom', name: 'Blossom', emoji: '🌸', body: '#f5d7e3', pattern: 'plain', unlock: 'blossom-dice' },
  { id: 'copper', name: 'Copper', emoji: '🥉', body: '#b56a3d', pattern: 'plain', unlock: 'copper-dice' },

  // Animals.
  { id: 'paws', name: 'Paw Prints', emoji: '🐾', body: '#b98a5e', pattern: 'paws', ink: '#4a2f16', price: 300 },
  { id: 'cow', name: 'Cow', emoji: '🐄', body: '#f7f4ee', pattern: 'patches', ink: '#2e2a26', price: 350 },
  // Amber bands, not true yellow: #f5c518 sat ΔLab 15.9 from the
  // yellow FACE, and pattern ink obeys the same rule shells do.
  { id: 'bee', name: 'Bumblebee', emoji: '🐝', body: '#2a2418', pattern: 'bands', ink: '#c98a2e', price: 400 },
  { id: 'turtle', name: 'Turtle', emoji: '🐢', body: '#7aa85c', pattern: 'shell', ink: '#3d5c2a', price: 450 },
  { id: 'fish', name: 'Fish', emoji: '🐟', body: '#7fb8d9', pattern: 'scales', ink: '#2e6e99', price: 500 },
  { id: 'snake', name: 'Snake', emoji: '🐍', body: '#8fae4a', pattern: 'diamonds', ink: '#3d4a1a', price: 550 },
  { id: 'leopard', name: 'Leopard', emoji: '🐆', body: '#d9a55c', pattern: 'rosettes', ink: '#4a3018', price: 600 },
  { id: 'tiger', name: 'Tiger', emoji: '🐯', body: '#a85a1a', pattern: 'tigerStripes', ink: '#1d1a2e', price: 650 },
  { id: 'giraffe', name: 'Giraffe', emoji: '🦒', body: '#e8c078', pattern: 'giraffe', ink: '#a5651e', price: 700 },
  { id: 'peacock', name: 'Peacock', emoji: '🦚', body: '#1f7a8a', pattern: 'peacock', ink: '#0a3d4a', price: 750 },

  // Sports balls.
  { id: 'golf', name: 'Golf Ball', emoji: '⛳', body: '#f2f7f2', pattern: 'dimples', ink: '#ffffff', price: 350 },
  { id: 'tennis', name: 'Tennis Ball', emoji: '🎾', body: '#a8b83d', pattern: 'tennis', ink: '#f2f7f2', price: 400 },
  // Wine-dark stitches: true stitch red sat ΔLab 10.6 from the red face.
  { id: 'baseball', name: 'Baseball', emoji: '⚾', body: '#f5f2ea', pattern: 'baseball', ink: '#7a2a3d', price: 450 },
  { id: 'soccer', name: 'Soccer Ball', emoji: '⚽', body: '#f7f7f7', pattern: 'soccer', ink: '#1d1a2e', price: 500 },
  { id: 'basketball', name: 'Basketball', emoji: '🏀', body: '#a34e26', pattern: 'basketball', ink: '#1d1a2e', price: 550 },
  { id: 'football', name: 'Football', emoji: '🏈', body: '#8a4a2a', pattern: 'laces', ink: '#ffffff', price: 600 },
  { id: 'bowling', name: 'Bowling Ball', emoji: '🎳', body: '#2e2a3d', pattern: 'bowling', ink: '#f0ede6', price: 650 },
  // ink unused: a colour painter mixes its own paint. Same below.
  { id: 'volleyball', name: 'Volleyball', emoji: '🏐', body: '#f0ede6', pattern: 'volleyball', ink: '#2a4a8a', price: 700 },

  // Food.
  { id: 'cookie', name: 'Cookie', emoji: '🍪', body: '#d9a55c', pattern: 'cookie', ink: '#4a2f1a', price: 400 },
  // Cherry-dark stripes — the same face rule that recoloured the
  // baseball stitches. On white they still read as candy at a glance.
  { id: 'candycane', name: 'Candy Cane', emoji: '🍭', body: '#ffffff', pattern: 'candyStripes', ink: '#8e2438', price: 450 },
  { id: 'lemon', name: 'Lemon Slice', emoji: '🍋', body: '#f5e69a', pattern: 'citrus', ink: '#c98a2e', price: 500 },
  { id: 'chocolate', name: 'Chocolate', emoji: '🍫', body: '#6e4226', pattern: 'chocolate', ink: '#a5764a', price: 500 },
  { id: 'strawberry', name: 'Strawberry', emoji: '🍓', body: '#e87a8a', pattern: 'strawberry', ink: '#f7e6a0', price: 550 },
  { id: 'honeycomb', name: 'Honeycomb', emoji: '🍯', body: '#c2882e', pattern: 'honeycomb', ink: '#6e4a16', price: 600 },
  // The one David named. The waffle carries its own chicken.
  { id: 'waffles', name: 'Chicken & Waffles', emoji: '🧇', body: '#e8b45c', pattern: 'waffle', ink: '#8a5a1e', price: 750 },
  { id: 'watermelon', name: 'Watermelon', emoji: '🍉', body: '#f08585', pattern: 'watermelon', ink: '#2e6e38', price: 800 },
  { id: 'pizza', name: 'Pizza', emoji: '🍕', body: '#e8c078', pattern: 'pizza', ink: '#7a2a3d', price: 850 },
  { id: 'donut', name: 'Donut', emoji: '🍩', body: '#e8a8b8', pattern: 'donut', ink: '#d9a55c', price: 900 },

  // Fabrics and oddities.
  { id: 'denim', name: 'Denim', emoji: '👖', body: '#3d5a80', pattern: 'denim', ink: '#a8c0d9', price: 500 },
  { id: 'camo', name: 'Camo', emoji: '🪖', body: '#4a5c3d', pattern: 'camo', ink: '#2e3d26', price: 550 },
  { id: 'tartan', name: 'Tartan', emoji: '🧣', body: '#742533', pattern: 'tartan', ink: '#1d2438', price: 700 },
  // Teal traces, not mint: mint sat ΔLab 15 from the green face.
  { id: 'circuit', name: 'Circuit Board', emoji: '🔌', body: '#143a2a', pattern: 'circuit', ink: '#57d0c9', price: 750 },
  { id: 'rainbow', name: 'Rainbow', emoji: '🌈', body: '#f2f7fc', pattern: 'rainbow', ink: '#2a4a8a', price: 800 },
  { id: 'galaxy', name: 'Galaxy', emoji: '🌌', body: '#1d1440', pattern: 'galaxy', ink: '#8a3d8f', price: 950 },
];

/**
 * Skins bought with coins, cheapest first — so the Store reads as a ladder
 * you climb rather than a jumble, and the thing you can almost afford is
 * near the top.
 */
export const STORE_SKINS = DICE_SKINS.filter((s) => s.price !== undefined).sort(
  (a, b) => a.price! - b.price!,
);
/** Skins earned by climbing the trophy ladder. */
export const LADDER_SKINS = DICE_SKINS.filter((s) => s.price === undefined);

export const DEFAULT_SKIN_ID = 'ivory';

export function skinById(id: string): DiceSkin {
  return DICE_SKINS.find((s) => s.id === id) ?? DICE_SKINS[0];
}
