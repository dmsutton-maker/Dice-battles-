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

/** The monthly Gold Pass product. One id, bought again each month. */
export const GOLD_PASS_ID = 'gold_pass';

/** Season 1's own pass, the product-per-season design: honoured for its month. */
export const SEASON_1_PASS = { id: 'season_pass_1', month: '2026-10' } as const;

export const PRODUCTS: Product[] = [
  {
    id: 'remove_ads',
    kind: 'once',
    name: 'No more ads',
    details:
      "No more ads after games, ever. Works on all your phones.",
    blurb: 'No more ads, ever.',
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
      "3,000 coins to spend in the Store. A better deal than pouches.",
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
      "7,000 coins to spend in the Store. The best deal.",
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
    blurb: '1,500 coins and a special die.',
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
    NEON, the first die sold on its own. David, 20 Oct 2026: "make a new
    cool dice that is worth one or two dollars", then "I like the neon.
    Add it to the game in the store and write the $1.99 price tag." The
    die is `neon` in diceSkins.ts (`paid: true`), owned through the
    purchase record so Restore brings it back. Needs its own product in
    App Store Connect: neon_dice, Non-Consumable, $1.99. Until that
    exists the button shows $1.99 and Apple's sheet cannot open; family
    tester mode lends the die regardless, like every paid die.
  */
  {
    id: 'neon_dice',
    kind: 'once',
    name: 'Neon dice',
    details:
      "Black dice that glow pink and leave a trail of light. Yours to keep.",
    blurb: 'Glowing dice with a light trail.',
    usd: 1.99,
    grants: ['neon'],
    available: true,
  },

  /*
    DINO VALLEY, the first battlefield sold on its own. David, 20 Oct
    2026: "give me a cool arena worth 3 dollars", then "Yes, do those
    things." The board is `dino` in themeData.ts (`paid: true`), owned
    through the purchase record so Restore brings it back. Needs its own
    product in App Store Connect: dino_valley, Non-Consumable, $2.99.
    Family tester mode lends it regardless.
  */
  {
    id: 'dino_valley',
    kind: 'once',
    name: 'Dino Valley',
    details:
      "Dinosaurs roam round a tar pit while you play. Plays like any battlefield. Yours to keep.",
    blurb: 'A battlefield full of dinosaurs.',
    usd: 2.99,
    grants: ['dino'],
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
      "Special dice you can only buy.",
    blurb: 'Special dice.',
    usd: 1.99,
    available: false,
    // A pack needs several new dice; Neon, the first, is sold on its own.
    blockedBy: 'More new dice to put in it. Neon was the first.',
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
    // A pack needs several; Dino Valley, the first, is sold on its own.
    blockedBy: 'More new battlefields. Dino Valley was the first.',
  },
  /*
    The Gold Pass. David, 13 Oct 2026: "Make a paid season pass bought
    with real money in the shop ... we'll figure that more out later."
    The price is the family's 31 Aug choice and is a placeholder until
    then.

    ONE PRODUCT, BOUGHT EACH MONTH, since 21 Oct 2026, when the season
    pass started turning over on the first of every month (David: "I
    want the gold pass to rotate on the first of every month according
    to EST"). It is a NON-RENEWING SUBSCRIPTION in App Store Connect
    (one month), which is the one kind Apple lets a player buy again and
    again and still restore: the month it is bought in, New York time,
    is the season it unlocks (purchases.ts, hasGoldPass). Buying it on
    the 28th buys three days — the Store says so before asking.

    Its predecessor was `season_pass_1`, one product per season, which
    would have meant David creating a new product every month. That id
    stays honoured for October 2026 (SEASON_1_PASS) in case it was ever
    bought, and like every id here is never reused.
  */
  {
    id: GOLD_PASS_ID,
    kind: 'season',
    name: 'Gold Pass',
    details:
      "This month's Gold row: two of the new dice and battlefields, and coins at every level. Lasts until the end of the month.",
    blurb: "This month's extra prizes.",
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
 * Where a money-only die or battlefield is got, in a few words for its
 * locked card and its preview: "Starter pack" for the Supporter die, the
 * price for one sold on its own (Neon: "$1.99", Dino Valley: "$2.99"). The phone's localised price is not
 * to hand on those screens, so this is the catalogue's US price, the
 * same stand-in the shelf shows before the store answers.
 */
export function paidSkinWhere(skinId: string): string {
  const product = PRODUCTS.find((p) => p.available && (p.grants ?? []).includes(skinId));
  if (!product) return 'Money shop';
  if (product.starterOnly) return product.name;
  return priceLabel(product, null);
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
