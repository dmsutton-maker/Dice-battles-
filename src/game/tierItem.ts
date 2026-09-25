import { ArenaId } from '../arena/arenas';
import { ARENA_UNLOCKS } from './loadout';
import { DICE_SKINS, DiceSkin } from './diceSkins';
import { Tier, UnlockId } from './progress';

/**
 * What a rung of the ladder actually GIVES you.
 *
 * Marc, 27 Aug 2026: "make the emojis on the ladder section just the
 * icons for each item." The ladder was drawing 🍒 for Ruby Dice and 🌋
 * for Volcano Rim — a hand-picked emoji standing in for the thing, when
 * the Store and the Inventory two taps away show the real painted die
 * and the real photograph of the battlefield. There is no reason the
 * ladder should be the one screen that shows a picture of a cherry
 * instead of the dice you are climbing towards.
 *
 * This is the join. It lives out here rather than inside the screen
 * because it is data — which rung hands over which item — and because a
 * test can then check that every rung on the ladder has been matched to
 * something.
 */
export type TierItem =
  | { kind: 'die'; skin: DiceSkin }
  | { kind: 'arena'; arena: ArenaId }
  | { kind: 'none' };

export function tierItem(tier: Tier): TierItem {
  const skin = DICE_SKINS.find((s) => s.unlock === tier.id);
  if (skin) return { kind: 'die', skin };

  const arena = (Object.entries(ARENA_UNLOCKS) as [ArenaId, UnlockId][]).find(
    ([, unlock]) => unlock === tier.id,
  )?.[0];
  if (arena) return { kind: 'arena', arena };

  /*
    Courtyard Treasure is the only rung that is neither. It adds the pile
    of gold to the Castle Courtyard rather than handing over a new thing
    of its own, so it has no picture to show and keeps its emoji.
  */
  return { kind: 'none' };
}

/** The rungs with nothing of their own to show. Kept honest by a test. */
export const TIERS_WITHOUT_A_PICTURE: UnlockId[] = ['treasure'];
