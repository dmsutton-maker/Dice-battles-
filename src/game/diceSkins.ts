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
    pattern: 'plain',
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
    pattern: 'grain',
    ink: '#8a5f38',
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
