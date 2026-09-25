import { ARENAS, ArenaId } from '../arena/arenas';
import { THEMED_ARENA_META, ThemedArenaId } from '../arena/themeData';
import { DICE_SKINS } from './diceSkins';
import { grantItem, owns } from './currency';
import { arenaKey } from './loadout';
import { awardTrophies } from './progress';
import { grantCoins } from './currency';
import { rollReward } from './rewards';
import { PrizeItem, TournamentPrize } from './tournament';

/**
 * Turning a tournament prize into things a player actually has.
 *
 * SEPARATE FROM tournament.ts on purpose. That module is the rules —
 * which battles count, what a streak does, when a prize is earned — and
 * it is read by a test suite with no renderer. This one knows what a die
 * and a battlefield ARE, which means reaching the dice list, the arena
 * registry and the wallet. Keeping the two apart is what lets the rules
 * be tested without any of that, and what lets a tournament name a prize
 * without tournament.ts having an opinion about what a prize is.
 */

export interface ResolvedItem {
  kind: 'dice' | 'arena';
  /** What to call it on screen. */
  name: string;
  emoji: string;
  /** The id the wallet files it under — the one route in for both kinds. */
  walletKey: string;
  /**
   * What it is worth in coins, if it is something the Store sells.
   *
   * Used for one thing: paying out when the winner already owns it. Zero
   * for anything with no shelf price, which today is the Amethyst die —
   * it cannot be bought at all, so there is no price to pay instead, and
   * there is also no way to already own it except by having won this.
   */
  coins: number;
}

/**
 * What a prize item actually is, or null if this game has never heard of
 * it.
 *
 * Null is a real answer and the call sites must handle it. Tournaments
 * arrive over the network, so a row can name a die added in a later
 * version, or one removed in this one. An unknown item is dropped and the
 * coins and trophies are still paid — a prize that is partly wrong is
 * better than a tournament that cannot be claimed at all.
 */
export function resolveItem(item: PrizeItem): ResolvedItem | null {
  if (item.kind === 'dice') {
    const skin = DICE_SKINS.find((s) => s.id === item.id);
    if (!skin) return null;
    return {
      kind: 'dice',
      name: `${skin.name} Dice`,
      emoji: skin.emoji,
      walletKey: skin.id,
      coins: skin.price ?? 0,
    };
  }
  if (!(item.id in ARENAS)) return null;
  const id = item.id as ArenaId;
  const meta = THEMED_ARENA_META[id as ThemedArenaId];
  return {
    kind: 'arena',
    name: ARENAS[id].name,
    emoji: ARENAS[id].emoji,
    walletKey: arenaKey(id),
    coins: meta?.price ?? 0,
  };
}

export interface PaidPrize {
  coins: number;
  trophies: number;
  /** The item handed over, if there was one and it was not already owned. */
  item: ResolvedItem | null;
  /**
   * Set when the item was already in the cupboard and its shelf price was
   * paid in coins instead. The popup says so, because being handed a
   * second copy of something silently is how a prize stops feeling like
   * one.
   */
  insteadOf: ResolvedItem | null;
  /** Trophy tiers crossed by the trophies just awarded. */
  unlocked: { id: string; name: string; emoji: string }[];
}

/**
 * Hand over a tournament prize, and say what was handed over.
 *
 * ALREADY OWN IT? You get its Store price in coins instead. A prize that
 * silently evaporates because you bought the battlefield last week is
 * worse than no item prize at all, and a second copy of something is not
 * a prize either. The one case where that pays nothing extra is an item
 * with no shelf price — which today means the Amethyst die, and the only
 * way to already own that is to have won this same tournament, which
 * cannot happen twice.
 */
export function payPrize(
  prize: TournamentPrize,
  rng: () => number = Math.random,
): PaidPrize {
  let coins = rollReward(prize.coins, rng);
  let item: ResolvedItem | null = null;
  let insteadOf: ResolvedItem | null = null;

  if (prize.item) {
    const resolved = resolveItem(prize.item);
    if (resolved) {
      if (owns(resolved.walletKey)) {
        insteadOf = resolved;
        coins += resolved.coins;
      } else {
        grantItem(resolved.walletKey);
        item = resolved;
      }
    }
  }

  grantCoins(coins);
  // Trophies LAST, so the tiers it reports are the ones this prize
  // crossed and not ones an earlier line of this function moved.
  const climbed = awardTrophies(prize.trophies);

  return {
    coins,
    trophies: prize.trophies,
    item,
    insteadOf,
    unlocked: climbed.newUnlocks.map((t) => ({
      id: t.id,
      name: t.name,
      emoji: t.emoji,
    })),
  };
}
