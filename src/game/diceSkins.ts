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
  /** Trophy unlock required, or null for the starter skin. */
  unlock: UnlockId | null;
}

export const DICE_SKINS: DiceSkin[] = [
  { id: 'ivory', name: 'Ivory', emoji: '🎲', body: '#ffffff', unlock: null },
  { id: 'gold', name: 'Gold', emoji: '✨', body: '#ffd76a', unlock: 'golden-dice' },
  { id: 'mint', name: 'Mint', emoji: '🍃', body: '#a8f0d8', unlock: 'mint-dice' },
  {
    id: 'bubblegum',
    name: 'Bubblegum',
    emoji: '🍬',
    body: '#ff9ecb',
    unlock: 'bubblegum-dice',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    emoji: '🌑',
    body: '#262b40',
    unlock: 'midnight-dice',
  },
];

export const DEFAULT_SKIN_ID = 'ivory';

export function skinById(id: string): DiceSkin {
  return DICE_SKINS.find((s) => s.id === id) ?? DICE_SKINS[0];
}
