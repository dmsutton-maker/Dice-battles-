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
   *  - `prize`: won in a tournament, and available no other way.
   * A skin with none of the three is free from the start.
   */
  unlock?: UnlockId | null;
  price?: number;
  /**
   * Won in a tournament. Not on the Store shelf, not on the ladder, and
   * not free.
   *
   * The flag has to EXIST rather than being inferred from "no price and
   * no unlock", because that combination already means the opposite —
   * it is how Ivory says it is free to everyone. A prize die without
   * this flag would be handed to every player on install, which is the
   * one thing it must never be.
   */
  prize?: true;
  /**
   * Won on the season pass (src/game/seasonPass.ts), and available no
   * other way. Its own flag for the same reason `prize` has one: "no
   * price and no unlock" already means FREE, which is Ivory.
   */
  pass?: true;
  /**
   * Something the skin does beyond its paint, drawn by the scene rather
   * than the shell texture: 'fire' and 'ice' — see src/dice/dieEffect.ts.
   * Looks only: an effect never reaches the physics or the settle rule.
   */
  effect?: 'fire' | 'ice';
}

export const DICE_SKINS: DiceSkin[] = [
  // Earned on the trophy ladder.
  // Ivory was a flat #ffffff 'plain' until 31 Aug 2026 — not ivory, just
  // blank white, and as the default it set the quality bar at nothing.
  // Warm cream now, with the material painted in: faint parallel grain
  // and a soft sheen, kept quiet so the face stickers still dominate.
  { id: 'ivory', name: 'Ivory', body: '#f3ead9', pattern: 'ivory', ink: '#fffdf4', unlock: 'ivory-dice' },
  {
    id: 'gold',
    name: 'Gold',
    body: '#ffd76a',
    /*
      ONE POLISHED SURFACE, FOUR COLOURS.

      David, 11 Sep 2026: "make the ruby, copper, silver, and gold all
      have the exact same skin and texture just different colours. Make
      sure they're all shiny." So gold, silver, copper and ruby all use
      `sheen` and differ ONLY in these two colours. Three separate
      painters — `brushed`, `ruby` and `copper` — were deleted rather
      than left unused; a painter nobody calls is a second version of
      the look waiting to drift.

      `body` is the material and `ink` is the colour the HOTSPOT
      reaches. The ink is near-white on purpose: a glint on a polished
      surface is the light SOURCE, not the material, so it is white with
      the faintest tint of the metal in it. #fff8dc left gold's
      brightest point visibly cream, which is what a satin finish does.
    */
    pattern: 'sheen',
    ink: '#fffdf2',
    unlock: 'golden-dice',
  },
  /*
    The three ladder prizes were `plain` — one flat fill, no shell
    material — which made a die a family had to EARN look blanker than
    the Ivory they start with. `satin` is ivory's sheen on its own: a
    broad sweep of light, no grain, no mottle, so the face stickers
    still dominate and the flat-ladder / patterned-store split holds.
  */
  {
    id: 'mint',
    name: 'Mint',
    body: '#a8f0d8',
    pattern: 'satin',
    ink: '#e6fdf4',
    unlock: 'mint-dice',
  },
  {
    id: 'bubblegum',
    name: 'Bubblegum',
    body: '#ff9ecb',
    pattern: 'satin',
    ink: '#ffd2e8',
    unlock: 'bubblegum-dice',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    body: '#262b40',
    pattern: 'satin',
    // A LIFTED navy, not a white: Midnight has to stay night-dark, so
    // its sweep is moonlight on navy rather than a grey wash.
    ink: '#556398',
    unlock: 'midnight-dice',
  },

  // Bought in the Store with coins. Patterned, so they read as a different
  // kind of prize from the ladder's flat colours.
  {
    id: 'zebra',
    name: 'Zebra',
    body: '#f4f2ef',
    pattern: 'stripes',
    ink: '#3b3b46',
    price: 250,
  },
  {
    id: 'bubbles',
    name: 'Bubbles',
    body: '#cfe9ff',
    pattern: 'bubbles',
    // Near-white so the rims and glints read as light on glass.
    ink: '#f4fbff',
    price: 265,
  },
  {
    id: 'starry',
    name: 'Starry',
    body: '#2b2f52',
    pattern: 'stars',
    // White, not the palette's yellow: stars in that exact yellow competed
    // with the yellow face sticker they sit beside.
    ink: '#ffffff',
    price: 435,
  },
  {
    id: 'timber',
    name: 'Timber',
    body: '#c49a68',
    // Growth rings rather than the old wavy bands, which were the same
    // painter marble would have used and read as neither.
    pattern: 'wood',
    ink: '#7d5228',
    price: 355,
  },
  {
    id: 'frost',
    name: 'Frost',
    body: '#e8f6ff',
    pattern: 'frost',
    ink: '#9fd3f0',
    price: 300,
  },
  {
    id: 'marble',
    name: 'Marble',
    body: '#f2efe8',
    pattern: 'marble',
    // Grey-blue veining. Warm veins on warm stone disappeared at the size
    // a die is actually seen, and #7f8792 was still a step too pale to
    // survive a Store thumbnail.
    ink: '#6b7480',
    price: 525,
  },
  {
    id: 'granite',
    name: 'Granite',
    body: '#9aa0a6',
    pattern: 'granite',
    // Pale quartz. The dark flecks come from the shading side of the mask
    // rather than from a second colour.
    ink: '#eef1f4',
    price: 680,
  },
  {
    id: 'silver',
    name: 'Silver',
    body: '#c3cad1',
    // Brushed, not polished like gold. Sharing gold's pattern would make
    // the two one picture in two tints.
    // The same painter as gold — see the note there. Silver is the
    // coolest of the four, so its glint is pure white.
    pattern: 'sheen',
    ink: '#ffffff',
    price: 925,
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
  /*
    Ruby was #8e2f4a, which is nearly black once the polished shadow is
    taken off it — there was nowhere for a highlight to go. Lifted so the
    stone has a lit side as well as a dark one.

    NOT as far as it wanted to go. The first lift was #c0304f, and the
    suite refused it at ΔLab 19 from the RED face colour: the shell
    surrounds the six face stickers, and a shell that close to one of
    them hides that face. The six colours are the whole game signal, and
    no dice skin is allowed to eat one. So it leans magenta instead of
    brighter — which is also what separates a garnet from a fire engine.
  */
  { id: 'ruby', name: 'Ruby', body: '#b02a5c', pattern: 'sheen', ink: '#ffdfe6', unlock: 'ruby-dice' },
  { id: 'ocean', name: 'Ocean', body: '#1f6e8a', pattern: 'ocean', unlock: 'ocean-dice' },
  // Lavender mixes its own paint too (green stems, purple bud spikes),
  // so like blossom it carries no ink.
  { id: 'lavender', name: 'Lavender', body: '#b9a8e8', pattern: 'lavender', unlock: 'lavender-dice' },
  { id: 'slate', name: 'Slate', body: '#5c6470', pattern: 'slate', unlock: 'slate-dice' },
  // Blossom mixes its own paint (white petals, gold hearts), so like
  // the other colour-painted skins it carries no ink.
  { id: 'blossom', name: 'Blossom', body: '#f5d7e3', pattern: 'blossom', unlock: 'blossom-dice' },
  // Lifted from #b56a3d for the same reason as ruby: polished copper is
  // a bright warm metal, and the old one was the colour of a dull penny.
  { id: 'copper', name: 'Copper', body: '#cf7a41', pattern: 'sheen', ink: '#ffe6d2', unlock: 'copper-dice' },

  // Animals.
  { id: 'paws', name: 'Paw Prints', body: '#b98a5e', pattern: 'paws', ink: '#4a2f16', price: 280 },
  { id: 'cow', name: 'Cow', body: '#f7f4ee', pattern: 'patches', ink: '#2e2a26', price: 315 },
  // Amber bands, not true yellow: #f5c518 sat ΔLab 15.9 from the
  // yellow FACE, and pattern ink obeys the same rule shells do.
  { id: 'bee', name: 'Bumblebee', body: '#2a2418', pattern: 'bands', ink: '#c98a2e', price: 375 },
  { id: 'turtle', name: 'Turtle', body: '#7aa85c', pattern: 'shell', ink: '#3d5c2a', price: 455 },
  { id: 'fish', name: 'Fish', body: '#7fb8d9', pattern: 'fish', price: 550 },
  { id: 'snake', name: 'Snake', body: '#8fae4a', pattern: 'diamonds', ink: '#3d4a1a', price: 710 },
  { id: 'leopard', name: 'Leopard', body: '#d9a55c', pattern: 'rosettes', ink: '#4a3018', price: 825 },
  { id: 'tiger', name: 'Tiger', body: '#a85a1a', pattern: 'tigerStripes', ink: '#1d1a2e', price: 955 },
  { id: 'giraffe', name: 'Giraffe', body: '#e8c078', pattern: 'giraffe', ink: '#a5651e', price: 1025 },
  { id: 'peacock', name: 'Peacock', body: '#1f7a8a', pattern: 'peacock', ink: '#0a3d4a', price: 1130 },

  // Sports balls.
  { id: 'golf', name: 'Golf Ball', body: '#f2f7f2', pattern: 'dimples', ink: '#ffffff', price: 335 },
  { id: 'tennis', name: 'Tennis Ball', body: '#a8b83d', pattern: 'tennis', ink: '#f2f7f2', price: 395 },
  // Wine-dark stitches: true stitch red sat ΔLab 10.6 from the red face.
  { id: 'baseball', name: 'Baseball', body: '#f5f2ea', pattern: 'baseball', ink: '#7a2a3d', price: 480 },
  { id: 'soccer', name: 'Soccer Ball', body: '#f7f7f7', pattern: 'soccer', ink: '#1d1a2e', price: 575 },
  { id: 'basketball', name: 'Basketball', body: '#a34e26', pattern: 'basketball', ink: '#1d1a2e', price: 735 },
  { id: 'football', name: 'Football', body: '#8a4a2a', pattern: 'laces', ink: '#ffffff', price: 860 },
  { id: 'bowling', name: 'Bowling Ball', body: '#2e2a3d', pattern: 'bowling', ink: '#f0ede6', price: 990 },
  // ink unused: a colour painter mixes its own paint. Same below.
  { id: 'volleyball', name: 'Volleyball', body: '#f0ede6', pattern: 'volleyball', ink: '#2a4a8a', price: 1060 },

  // Food.
  { id: 'cookie', name: 'Cookie', body: '#d9a55c', pattern: 'cookie', ink: '#4a2f1a', price: 415 },
  // Cherry-dark stripes — the same face rule that recoloured the
  // baseball stitches. On white they still read as candy at a glance.
  { id: 'candycane', name: 'Candy Cane', body: '#ffffff', pattern: 'candyStripes', ink: '#8e2438', price: 500 },
  { id: 'lemon', name: 'Lemon Slice', body: '#f5e69a', pattern: 'citrus', ink: '#c98a2e', price: 600 },
  { id: 'chocolate', name: 'Chocolate', body: '#6e4226', pattern: 'chocolate', ink: '#a5764a', price: 625 },
  { id: 'strawberry', name: 'Strawberry', body: '#e87a8a', pattern: 'strawberry', ink: '#f7e6a0', price: 765 },
  { id: 'honeycomb', name: 'Honeycomb', body: '#c2882e', pattern: 'honeycomb', ink: '#6e4a16', price: 890 },
  // The one David named. The waffle carries its own chicken.
  { id: 'waffles', name: 'Chicken & Waffles', body: '#e8b45c', pattern: 'waffle', ink: '#8a5a1e', price: 1165 },
  { id: 'watermelon', name: 'Watermelon', body: '#f08585', pattern: 'watermelon', ink: '#2e6e38', price: 1240 },
  { id: 'pizza', name: 'Pizza', body: '#e8c078', pattern: 'pizza', ink: '#7a2a3d', price: 1320 },
  { id: 'donut', name: 'Donut', body: '#e8a8b8', pattern: 'donut', ink: '#d9a55c', price: 1360 },

  // Fabrics and oddities.
  { id: 'denim', name: 'Denim', body: '#3d5a80', pattern: 'denim', ink: '#a8c0d9', price: 655 },
  { id: 'camo', name: 'Camo', body: '#4a5c3d', pattern: 'camo', ink: '#2e3d26', price: 795 },
  { id: 'tartan', name: 'Tartan', body: '#742533', pattern: 'tartan', ink: '#1d2438', price: 1095 },
  // Teal traces, not mint: mint sat ΔLab 15 from the green face.
  { id: 'circuit', name: 'Circuit Board', body: '#143a2a', pattern: 'circuit', ink: '#57d0c9', price: 1205 },
  { id: 'rainbow', name: 'Rainbow', body: '#f2f7fc', pattern: 'rainbow', ink: '#2a4a8a', price: 1280 },
  { id: 'galaxy', name: 'Galaxy', body: '#1d1440', pattern: 'galaxy', ink: '#8a3d8f', price: 1400 },

  /*
    FIRE — the first die that does something rather than just looking
    like something.

    David, 29 Sep 2026, after a preview page: "make a pair of dice that
    are on fire ... and if it lands in the water, then it shows the fire
    going out and you know smoke coming up." Then: "do an over the air
    update to add the flaming dice so we could see it in the real game
    and then the boys could decide how much they want to charge for it."

    NOT SOLD. It was on the Store shelf for a day at a placeholder
    price while the boys voted on one; then David made it a season pass
    reward instead (30 Sep 2026), which is the only way to get it now.

    The shell is charred wood with embers glowing in the cracks, so a
    die that has been put out still looks like something that burned.
    The charcoal is what keeps it clear of all six face colours; the
    glow is kept thin, and away from the middle of each face where the
    sticker sits.
  */
  {
    id: 'fire',
    name: 'Fire',
    // The deep ember red the flames burn over (42 ΔLab from the red face).
    body: '#5a1407',
    pattern: 'embers',
    // On sale for a day at a placeholder 1500, then moved to the season
    // pass (level 20) on 30 Sep 2026. Anybody who bought it keeps it.
    pass: true,
    effect: 'fire',
  },
  /*
    ICE — the Fire dice's opposite number.

    David, 30 Sep 2026: "can we do the same concept with ice like dice
    made of ice and when it touches the ground, it freezes the ground
    around it a little bit and maybe freezes the pond and you see it like
    half sticking out of the pond frozen."

    Clear pale ice with cracks and trapped bubbles, cold mist off it,
    frost where it lands, and on Hard a moat that freezes over with the
    die caught in it. Looks only: the die still sinks and is fished out
    on the usual clock, so the ice never makes the moat safe.

    Season pass only, like Fire — see seasonPass.ts.

    Not to be confused with Frost (300 coins), which is snowflakes
    PAINTED on a white shell. This one is the die made of ice.
  */
  {
    id: 'ice',
    name: 'Ice',
    body: '#b4dcee',
    pattern: 'ice',
    // Season pass, level 6. Was on sale for a day at a placeholder 1550.
    pass: true,
    effect: 'ice',
  },

  /*
    WON, NEVER BOUGHT.

    David, 25 Sep 2026, asked tournaments for "unique rewards ... even a
    dice or arena". A die already on the shelf is a discount; this one is
    the only thing in the game that money cannot reach, and The Gauntlet
    — six Hard wins in a row — is the only way it exists on a phone.

    NOT "CHAMPION", which is what it shipped as for an hour. David, the
    same day: "don't name it champion dice." He was right, and the reason
    is sitting four lines up: `sheen` is the polished finish shared by
    Gold, Silver, Copper and Ruby, and every one of those is named for
    what it is MADE of. Champion named the achievement instead, so the
    fifth member of a set of materials was the one that did not say what
    it was. Amethyst is deep violet polished stone, which is exactly what
    this is, and it finishes the set.

    It is the darkest shell in the game, which is what keeps it clear of
    all six face colours: the palette's deepest face is Blue at #043fe0,
    and this sits well away from it in hue as well as lightness.
  */
  {
    id: 'amethyst',
    name: 'Amethyst',
    body: '#3d2a6e',
    pattern: 'sheen',
    ink: '#f4ecff',
    prize: true,
  },
];

/**
 * Skins bought with coins, cheapest first — so the Store reads as a ladder
 * you climb rather than a jumble, and the thing you can almost afford is
 * near the top.
 */
export const STORE_SKINS = DICE_SKINS.filter((s) => s.price !== undefined).sort(
  (a, b) => a.price! - b.price!,
);
/**
 * Skins earned by climbing the trophy ladder.
 *
 * Prize skins are excluded explicitly. They also have no price, so
 * "everything without a price" — which this used to be — swept them onto
 * the ladder and made the game promise them at a trophy count that does
 * not exist.
 */
export const LADDER_SKINS = DICE_SKINS.filter(
  (s) => s.price === undefined && !s.prize && !s.pass,
);

/** Skins that can only be won on the season pass. */
export const PASS_SKINS = DICE_SKINS.filter((s) => s.pass);

/** Skins that can only be won in a tournament. */
export const PRIZE_SKINS = DICE_SKINS.filter((s) => s.prize);

export const DEFAULT_SKIN_ID = 'ivory';

export function skinById(id: string): DiceSkin {
  return DICE_SKINS.find((s) => s.id === id) ?? DICE_SKINS[0];
}
