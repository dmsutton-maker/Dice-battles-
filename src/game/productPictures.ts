import { ARENAS } from '../arena/arenas';
import { DICE_SKINS } from './diceSkins';
import { REMOVE_ADS, type Product } from './products';
import { GOLD_PASS, seasonAt } from './seasonPass';

/**
 * What the picture on a money shop card shows.
 *
 * David, 20 Oct 2026: "Add pictures and icons for the money items in the
 * store so you know what you're getting." The cards were a name and a
 * line of words, which a five-year-old cannot read and a grandparent
 * should not have to.
 *
 * The picture is worked out from what the product actually GRANTS, never
 * drawn separately, so it cannot show one thing and sell another: the
 * Neon card shows the Neon die because `grants` names it, and a pack of
 * coins shows a bigger pile because it pays more coins.
 */
export interface ProductPicture {
  /** The dice and battlefields it hands over, each drawn as itself. */
  items: { kind: 'die' | 'arena'; id: string }[];
  /** Coins it pays, 0 for none. Drawn as a pile that grows with the pack. */
  coins: number;
  /** Switches the ads off. */
  noAds: boolean;
  /**
   * A pack whose contents do not exist yet (family tester mode only):
   * drawn as plain dice or battlefields, because showing a real die would
   * promise that die.
   */
  placeholder?: 'dice' | 'arena';
}

const SKIN_IDS = new Set(DICE_SKINS.map((s) => s.id));
const ARENA_IDS = new Set(Object.keys(ARENAS));

export function pictureOfProduct(product: Product): ProductPicture {
  const items: ProductPicture['items'] = [];
  for (const id of product.grants ?? []) {
    if (SKIN_IDS.has(id)) items.push({ kind: 'die', id });
    else if (ARENA_IDS.has(id)) items.push({ kind: 'arena', id });
  }
  // The Gold Pass grants only itself; what it opens is the Gold row.
  if (product.id === GOLD_PASS.productId) {
    for (const s of seasonAt().items) {
      if (s.track === 'gold') items.push({ kind: s.item.kind === 'dice' ? 'die' : 'arena', id: s.item.id });
    }
  }
  return {
    items,
    coins: product.coins ?? 0,
    noAds: (product.grants ?? []).includes(REMOVE_ADS),
    placeholder:
      product.id === 'premium_dice_pack' ? 'dice'
      : product.id === 'premium_arena_pack' ? 'arena'
      : undefined,
  };
}

/**
 * How many coins to draw in the pile, so a bigger pack LOOKS bigger:
 * three for the pouch, six for the chest, ten for the vault.
 */
export function coinsInPile(coins: number): number {
  if (coins <= 0) return 0;
  if (coins <= 500) return 3;
  if (coins <= 3000) return 6;
  return 10;
}
