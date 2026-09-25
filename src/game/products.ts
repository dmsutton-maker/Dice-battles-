/**
 * Everything the game sells for real money.
 *
 * The family voted on 31 Aug 2026 and David confirmed on 7 Sep 2026 that
 * advertising and the full set of payment options ship in the first
 * public release. This file is that list, as data.
 *
 * ── THE RULE THAT OUTRANKS EVERYTHING HERE ────────────────────────────
 *
 * NOTHING SOLD HERE CHANGES HOW THE DICE LAND. Not the odds, not the
 * obstacles, not the opponent. Everything on this list is a cosmetic, a
 * convenience, or the removal of an advert. The moment money buys a
 * better chance of winning, a game two people play at one table stops
 * being fair, and fair is the entire point of it.
 *
 * The family wrote that rule themselves — "paying for luck" was on the
 * NOT ON THE MENU list, alongside mystery boxes, which are a slot
 * machine with extra steps and have no place in front of a five-year-old.
 * `tests/purchases.test.ts` enforces both.
 *
 * ── IDS ARE FOREVER ───────────────────────────────────────────────────
 *
 * A product id is created once in App Store Connect and can never be
 * reused or renamed, even after the product is removed from sale. Treat
 * every string below as permanent.
 */

/** Apple's price tiers are fixed points, so "$5" means $4.99. */
export type ProductKind =
  /** Bought once, kept for ever. Restorable on a new phone. */
  | 'once'
  /** Bought repeatedly, spent in the game. NOT restorable — Apple's rule. */
  | 'consumable'
  /** Charged until cancelled. Apple requires continuing value for these. */
  | 'subscription'
  /** One season, does not renew itself. */
  | 'season';

export interface Product {
  /** Permanent. Created in App Store Connect and never changed. */
  id: string;
  kind: ProductKind;
  name: string;
  /** One plain sentence, written for whoever is holding the phone. */
  blurb: string;
  /**
   * What we intend to charge, in US dollars.
   *
   * The PHONE is the authority, never this number: StoreKit returns the
   * real localised price and that is what the Store screen shows. This
   * exists so the catalogue is readable and so a mistake in App Store
   * Connect is visible in a diff.
   */
  usd: number;
  /** Coins granted on purchase, for the consumable packs. */
  coins?: number;
  /** Ids unlocked on purchase — a die, a battlefield, or `remove-ads`. */
  grants?: string[];
  /**
   * False while the product is not ready to be sold.
   *
   * Kept in the list rather than deleted, because "what are we selling"
   * is a question with a written answer, and a product missing from the
   * file reads as a decision nobody made. Anything false here needs
   * something that does not exist yet — see `blockedBy`.
   */
  available: boolean;
  /** Why it is not for sale yet. Required whenever `available` is false. */
  blockedBy?: string;
  /**
   * Only offered in the first 48 hours after the game was installed.
   * A starter pack, in the family's words.
   */
  starterOnly?: boolean;
}

/** How long a starter offer stays open. David's "first like 48 hours". */
export const STARTER_WINDOW_MS = 48 * 60 * 60 * 1000;

/** The entitlement id that switches advertising off for good. */
export const REMOVE_ADS = 'remove-ads';

export const PRODUCTS: Product[] = [
  {
    id: 'remove_ads',
    kind: 'once',
    name: 'No more adverts',
    blurb:
      'Switches off the advert between games, for good, on every phone ' +
      'signed in to your Apple account.',
    usd: 3.99,
    grants: [REMOVE_ADS],
    available: true,
  },

  /*
    Coins, in three sizes. The value per pound improves as the pack gets
    bigger, which is the ordinary and honest shape.

    Sized against the real economy rather than guessed: a hard win pays
    50-85 coins, and the whole shop — 42 dice sets and 8 battlefields —
    comes to 46,695. So the biggest pack is about a seventh of
    everything, and buying the lot outright would take seven of them.
    Playing is still the way you get things; this is a shortcut past a
    particular wall, not a way around the game.
  */
  {
    id: 'coins_pouch',
    kind: 'consumable',
    name: 'Pouch of coins',
    blurb: '500 coins — about seven hard-won battles.',
    usd: 0.99,
    coins: 500,
    available: true,
  },
  {
    id: 'coins_chest',
    kind: 'consumable',
    name: 'Chest of coins',
    blurb: '3,000 coins. Six times the pouch, five times the price.',
    usd: 4.99,
    coins: 3000,
    available: true,
  },
  {
    id: 'coins_vault',
    kind: 'consumable',
    name: 'Vault of coins',
    blurb: '7,000 coins — enough for the most expensive battlefield, twice.',
    usd: 9.99,
    coins: 7000,
    available: true,
  },

  {
    id: 'starter_pack',
    kind: 'once',
    name: 'Starter pack',
    blurb: '1,500 coins and the Supporter die. Only in your first two days.',
    usd: 4.99,
    coins: 1500,
    grants: ['supporter'],
    starterOnly: true,
    available: false,
    blockedBy:
      'The Supporter die does not exist yet. It has to be a set nobody ' +
      'can earn with coins, which means designing one — see the note on ' +
      'premium sets below.',
  },

  /*
    ── The three that are not ready, and why ───────────────────────────

    Left in the file deliberately. The family chose all of these, and a
    product quietly missing from the list would read as somebody having
    decided against it. Each is waiting on something real.
  */
  {
    id: 'premium_dice_pack',
    kind: 'once',
    name: 'Money-only dice sets',
    blurb: 'Dice sets that cannot be earned with coins.',
    usd: 1.99,
    available: false,
    blockedBy:
      'No such sets have been drawn. All 53 in the game are earnable, ' +
      'and the family asked specifically for exclusive ones rather than ' +
      'existing sets moved behind a price. That is artwork, not a ' +
      'product id.',
  },
  {
    id: 'premium_arena_pack',
    kind: 'once',
    name: 'Money-only battlefields',
    blurb: 'Battlefields that cannot be earned with coins.',
    usd: 2.99,
    available: false,
    blockedBy:
      'Same as the dice: all 16 themed battlefields are earnable today, ' +
      'and an exclusive one has to be built before it can be sold.',
  },
  {
    id: 'dice_club_monthly',
    kind: 'subscription',
    name: 'Dice Club',
    blurb: 'No adverts, a daily coin bonus, and the season pass included.',
    usd: 4.99,
    grants: [REMOVE_ADS],
    available: false,
    blockedBy:
      'Apple only allows a repeating charge where the player keeps ' +
      'getting something new for it, and rejects subscriptions whose ' +
      'ongoing value is thin. Charging every month is a promise to ship ' +
      'new content every month, for as long as anybody subscribes. That ' +
      'is a commitment for David to make deliberately, not a switch.',
  },
  {
    id: 'season_pass',
    kind: 'season',
    name: 'Season pass',
    blurb: 'A season of levels to climb, with something at every one.',
    usd: 2.99,
    available: false,
    blockedBy:
      'There is no XP or levels system in the game — that is what a ' +
      'season pass is made of, and it does not exist. Building it is a ' +
      'piece of game design, not a purchase.',
  },
];

/** The products a player can actually be shown right now. */
export function sellable(installedAt: number | null, now: number): Product[] {
  return PRODUCTS.filter((p) => {
    if (!p.available) return false;
    if (p.starterOnly) return withinStarterWindow(installedAt, now);
    return true;
  });
}

/**
 * Is the starter offer still open?
 *
 * An unknown install time means NO. The alternative — treating unknown
 * as "the window is open" — would show a two-day-only offer to somebody
 * who has had the game for a year, which is the kind of thing that gets
 * an app pulled rather than a rejection.
 */
export function withinStarterWindow(
  installedAt: number | null,
  now: number,
): boolean {
  if (installedAt === null || !Number.isFinite(installedAt)) return false;
  const age = now - installedAt;
  return age >= 0 && age < STARTER_WINDOW_MS;
}

export function productById(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}
