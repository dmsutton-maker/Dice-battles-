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
   * The whole story, shown when the card is tapped (David, 14 Oct 2026:
   * "add the ability to click on any of the real money purchases to see
   * the full description of it"). What you get, how long it lasts, and
   * what happens on a new phone — the questions a parent asks.
   */
  details: string;
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
    name: 'No more ads',
    details:
      "No more ads after games, for good. Works on every phone signed in to your Apple account.",
    blurb: 'No more ads, for good.',
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
    details:
      "500 coins to spend in the Store.",
    blurb: '500 coins.',
    usd: 0.99,
    coins: 500,
    available: true,
  },
  {
    id: 'coins_chest',
    kind: 'consumable',
    name: 'Chest of coins',
    details:
      "3,000 coins to spend in the Store. Six pouches for the price of five.",
    blurb: '3,000 coins.',
    usd: 4.99,
    coins: 3000,
    available: true,
  },
  {
    id: 'coins_vault',
    kind: 'consumable',
    name: 'Vault of coins',
    details:
      "7,000 coins to spend in the Store. The best value.",
    blurb: '7,000 coins.',
    usd: 9.99,
    coins: 7000,
    available: true,
  },

  {
    id: 'starter_pack',
    kind: 'once',
    name: 'Starter pack',
    details:
      "1,500 coins and the Supporter die. Only in your first two days.",
    blurb: '1,500 coins and the Supporter die.',
    usd: 4.99,
    coins: 1500,
    grants: ['supporter'],
    starterOnly: true,
    /*
      On sale since 18 Oct 2026. David: "Move the starter pack out of the
      coming later and into the full store." What held it back was the
      Supporter die, which did not exist; it does now (diceSkins.ts,
      `paid: true`), owned through the purchase record so Apple's Restore
      brings it back. The 1,500 coins are spent like any coins and are not
      restored. Needs its own product in App Store Connect:
      starter_pack, Non-Consumable, $4.99.
    */
    available: true,
  },

  /*
    ── The two that are not ready, and why ─────────────────────────────

    Left in the file deliberately. The family chose all of these, and a
    product quietly missing from the list would read as somebody having
    decided against it. Each is waiting on something real.
  */
  {
    id: 'premium_dice_pack',
    kind: 'once',
    name: 'Money-only dice sets',
    details:
      "Special dice sets you can only buy.",
    blurb: 'Special dice sets.',
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
    details:
      "Special battlefields you can only buy.",
    blurb: 'Special battlefields.',
    usd: 2.99,
    available: false,
    blockedBy:
      'Same as the dice: all 16 themed battlefields are earnable today, ' +
      'and an exclusive one has to be built before it can be sold.',
  },
  /*
    The Gold Pass. David, 13 Oct 2026: "Make a paid season pass bought
    with real money in the shop ... we'll figure that more out later."
    The price is the family's 31 Aug choice and is a placeholder until
    then. One product per season — see GOLD_PASS in seasonPass.ts.

    The id was `season_pass` while it was parked; it was never created in
    App Store Connect, so it was still free to change. From here on it is
    permanent like every other id in this file.
  */
  {
    id: 'season_pass_1',
    kind: 'season',
    name: 'Gold Pass — Season 1',
    details:
      "Unlocks the bottom row of the season pass: Snowy Hollow, the Fire Dice, Volcano Rim and coins. Levels you have already reached pay out right away.",
    blurb: 'The bottom row of the season pass.',
    usd: 2.99,
    // Grants nothing but itself — see GOLD_PASS in seasonPass.ts.
    available: true,
  },
];

/** The products a player can actually be shown right now. */
export function sellable(
  installedAt: number | null,
  now: number,
  /**
   * Family tester mode. The family installed the game long before the
   * Starter pack went on sale, so its two-day window closed months ago
   * for every one of them — without this they could never see it, let
   * alone try buying it in the sandbox. Players never have this on.
   */
  family = false,
): Product[] {
  return PRODUCTS.filter((p) => {
    if (!p.available) return false;
    if (p.starterOnly) return family || withinStarterWindow(installedAt, now);
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

/**
 * The price on a money shop button.
 *
 * David, 18 Oct 2026: "Add the prices to all the money shop items." The
 * button showed a dash until the phone's store answered, and for good
 * when it never would — the Starter pack before it exists in App Store
 * Connect, or a phone with no connection. The phone's own localised price
 * still wins whenever it has one; until then the catalogue's US price
 * stands in, as the full-story card already did. Apple's sheet shows the
 * real price again before anything is charged, so this can never be the
 * number somebody pays.
 */
export function priceLabel(product: Pick<Product, 'usd'>, fromStore: string | null): string {
  return fromStore ?? `$${product.usd.toFixed(2)}`;
}
