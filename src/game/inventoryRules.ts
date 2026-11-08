import { ArenaId } from '../arena/arenas';
import { DiceSkin } from './diceSkins';
import { monthStamp } from './easternTime';
import type { PreviewTarget } from './itemPreview';
import { ARENA_ORDER, ARENA_UNLOCKS, INVENTORY_SKIN_ORDER, isArenaUnlocked, isSkinUnlocked } from './loadout';
import { PRODUCTS } from './products';
import { Tier, TIERS } from './progress';
import { passInfo } from './seasonPass';
import { tierItem } from './tierItem';

/**
 * What belongs in the Inventory: the player's cupboard, and nothing else.
 *
 * David, 1 Nov 2026: "Take the future season stuff and anything not
 * owned by a player out of their inventory so they can only view it in
 * the store or gold pass, wherever they're from."
 *
 * Until then the Inventory listed every die and every battlefield in the
 * game, owned or not, with a locked card saying where each came from — a
 * coin price, a trophy rung, "Win it in a cup", "$1.99", and "Season 7
 * pass" for Sun & Moon, a season that does not start until June 2027.
 * Now each unowned thing is seen where it is got instead:
 *
 *   - coin items on the Store's coin shelf,
 *   - real-money items on the Store's money shelf,
 *   - the running season's items on the Gold Pass card in Cups,
 *   - a cup's prize on that cup's card in Cups,
 *   - trophy-ladder items on the ladder in Records (`ladderPreview`),
 *
 * and a FUTURE season's items nowhere at all, which was the point of
 * the request. A finished season's items stay in the cupboard of whoever
 * earned them, and are simply not shown to anybody who did not.
 *
 * The rules only, free of React, so the tests can hold the screen to
 * them. The screen asks these and draws what comes back.
 */

/**
 * Whether an item belongs to a season whose month has not begun yet, in
 * New York time — the same clock seasonAt turns on.
 *
 * Asked of the item's OWN season, not of the one running: Sun & Moon is
 * Season 7's, and stays a future item all the way through Seasons 1 to
 * 6, whoever holds which of them.
 */
export function isFutureSeasonItem(kind: 'dice' | 'arena', id: string, now: number = Date.now()): boolean {
  const place = passInfo(kind, id, now);
  return place !== null && place.season.month > monthStamp(now);
}

/**
 * Whether a future season's item could already have been earned: its
 * season ran before, under another number (`earnedFrom`). Fire & Ice
 * was Season 1 from 1 Oct to 8 Nov 2026 before moving to January, and
 * the Fire dice a player won in October are theirs to see now.
 */
export function earnedEarlier(kind: 'dice' | 'arena', id: string, now: number = Date.now()): boolean {
  const place = passInfo(kind, id, now);
  const from = place?.season.earnedFrom;
  return from !== undefined && from <= monthStamp(now);
}

/**
 * Whether an item is kept out of sight as "the future season stuff": its
 * season is still to come AND nobody could have earned it yet. Fire &
 * Ice's items are a future season's from 8 Nov 2026 to January, but some
 * players won them in October, so they are shown to those players and
 * counted in the "of N" like anything else; otherwise somebody could own
 * 59 of 58.
 */
export function hiddenFutureItem(kind: 'dice' | 'arena', id: string, now: number = Date.now()): boolean {
  return isFutureSeasonItem(kind, id, now) && !earnedEarlier(kind, id, now);
}

/**
 * The one rule: in the cupboard if it is yours, and never if its season
 * is still to come.
 *
 * `owned` is the game's own answer (isSkinUnlocked / isArenaUnlocked),
 * which already covers the ladder, the coin shelf, the wallet, the
 * purchase record and family tester mode. A future season's item stays
 * out even then — tester mode opens it for USE, but "the future season
 * stuff" was named on its own in the request, so it is not shown here
 * to anybody until its month comes — unless its season already ran once
 * (`earnedEarlier`), in which case an owned one was honestly won.
 */
export function belongsInInventory(
  kind: 'dice' | 'arena',
  id: string,
  owned: boolean,
  now: number = Date.now(),
): boolean {
  return owned && !hiddenFutureItem(kind, id, now);
}

/** The dice in the cupboard, in the cupboard's order (INVENTORY_SKIN_ORDER). */
export function inventoryDice(trophies: number, now: number = Date.now()): DiceSkin[] {
  return INVENTORY_SKIN_ORDER.filter((skin) =>
    belongsInInventory('dice', skin.id, isSkinUnlocked(skin.id, trophies), now),
  );
}

/** The battlefields in the cupboard, in the cupboard's order (ARENA_ORDER). */
export function inventoryArenas(trophies: number, now: number = Date.now()): ArenaId[] {
  return ARENA_ORDER.filter((id) =>
    belongsInInventory('arena', id, isArenaUnlocked(id, trophies), now),
  );
}

/** A rung of the ladder that costs nothing: where everybody starts. */
function freeRung(unlock: string | null | undefined): boolean {
  if (unlock === null || unlock === undefined) return false;
  return TIERS.find((t) => t.id === unlock)?.at === 0;
}

/**
 * What every player owns from the first launch: Ivory Dice and Castle
 * Courtyard today. They are always in the cupboard — a player with
 * nothing else still has dice to battle with and somewhere to battle.
 * The screen also uses them to tell a cupboard holding only these from
 * one with something earned in it.
 */
export const STARTING_DICE: readonly string[] = INVENTORY_SKIN_ORDER.filter(
  (s) =>
    s.price === undefined &&
    !s.prize &&
    !s.pass &&
    !s.paid &&
    !s.retired &&
    (s.unlock === null || s.unlock === undefined || freeRung(s.unlock)),
).map((s) => s.id);

export const STARTING_ARENAS: readonly ArenaId[] = ARENA_ORDER.filter((id) =>
  freeRung(ARENA_UNLOCKS[id]),
);

/** True when a section holds nothing past what everybody starts with. */
export function onlyStarters(ids: readonly string[], starting: readonly string[]): boolean {
  return ids.every((id) => starting.includes(id));
}

/**
 * How many dice and battlefields the game has for a player to own today:
 * everything, less the seasons still to come. The "of N" on the Records
 * tab's cupboard counts — a total that quietly included June's dice
 * would be counting something the player is not to be shown.
 */
export function obtainableDiceCount(now: number = Date.now()): number {
  // A retired die (Baseball, 4 Nov 2026) is nobody's to get, so it is not
  // in the "of N" either — tester mode sees it, but it is not counted.
  return INVENTORY_SKIN_ORDER.filter((s) => !s.retired && !hiddenFutureItem('dice', s.id, now))
    .length;
}

export function obtainableArenaCount(trophies: number, now: number = Date.now()): number {
  // A battlefield only a hidden product grants (Dino Valley, 4 Nov 2026)
  // is nobody's to get, so it is counted only for whoever already has it.
  const hiddenOnly = (id: ArenaId) =>
    PRODUCTS.some((p) => p.hidden && (p.grants ?? []).includes(id)) && !isArenaUnlocked(id, trophies);
  return ARENA_ORDER.filter((id) => !hiddenFutureItem('arena', id, now) && !hiddenOnly(id)).length;
}

/**
 * What a rung of the ladder opens on the board, from the Records tab.
 *
 * The ladder is now the only place an unearned trophy item can be seen
 * (the Inventory shows only what is owned), so every rung opens its die
 * or battlefield the way a Store card does. From `ladder`, so the
 * preview's button can never take coins (itemPreview.ts) — and a ladder
 * item has no price anyway: it reads "N more trophies to go" until it
 * is earned, and "Use this one" after.
 */
export function ladderPreview(tier: Tier): PreviewTarget | null {
  const item = tierItem(tier);
  if (item.kind === 'die') return { kind: 'die', id: item.skin.id, from: 'ladder' };
  if (item.kind === 'arena') return { kind: 'arena', id: item.arena, from: 'ladder' };
  return null;
}
