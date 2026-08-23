import { ArenaId } from '../arena/arenas';

/**
 * Trying an item on before you commit to it.
 *
 * The Store and the Inventory used to be shelves of thumbnails you tapped
 * to buy or equip in one go. A 58pt square is not enough to spend 450
 * coins on, and it is certainly not enough to tell Frost from Starry.
 *
 * So tapping a card no longer DOES anything to your loadout — it opens
 * the item on the real battlefield, at full size, in the game's own view.
 * The buy and equip buttons live there, after you have seen the thing.
 *
 * This module holds only the rules: what a given item's button should
 * say and whether it can be pressed. It is deliberately free of React and
 * of the 3D scene so the rules can be tested on their own, which matters
 * because "can I afford this" and "have I unlocked this" are the two
 * questions the screen must never get wrong.
 */

/**
 * Which shelf the preview was opened from.
 *
 * It decides whether the button can take money. Coins are spent in the
 * Store and nowhere else — the Inventory is the cupboard, and a cupboard
 * that quietly charges you is how a child spends 450 coins meaning to
 * look at something.
 */
export type PreviewSource = 'store' | 'inventory';

/** What is being looked at. Ids stay strings — the screens resolve them. */
export type PreviewTarget =
  | { kind: 'die'; id: string; from: PreviewSource }
  | { kind: 'arena'; id: ArenaId; from: PreviewSource };

/**
 * What the button at the bottom of the preview offers.
 *
 * `locked` and `unaffordable` are separate on purpose. Both are dead ends
 * right now, but one is "keep playing" and the other is "keep saving",
 * and telling a five-year-old the wrong one is worse than saying nothing.
 */
export type PreviewAction =
  | { kind: 'equipped' }
  | { kind: 'equip' }
  | { kind: 'buy'; price: number }
  | { kind: 'unaffordable'; price: number; short: number }
  /** For sale, but not from here — you are in the Inventory. */
  | { kind: 'in-store'; price: number }
  | { kind: 'locked'; needTrophies: number; short: number };

export interface PreviewState {
  trophies: number;
  coins: number;
  /** Already bought with coins. */
  owned: boolean;
  /** Earned on the trophy ladder, or free from the start. */
  unlocked: boolean;
  /** Currently worn / currently the battlefield. */
  equipped: boolean;
  /** Coin price, for Store items only. */
  price?: number;
  /**
   * Whether this preview is allowed to take coins. True only in the
   * Store. Everywhere else a priced item points at the Store instead.
   */
  canBuy: boolean;
  /** Trophy cost, for ladder items only. */
  needTrophies?: number;
}

/**
 * Decide the one thing this item offers right now.
 *
 * Order matters and is the whole of the logic: being equipped beats
 * everything (there is nothing left to do), then owning it, then the two
 * ways of not having it yet.
 */
export function previewAction(state: PreviewState): PreviewAction {
  if (state.equipped) return { kind: 'equipped' };
  if (state.owned || state.unlocked) return { kind: 'equip' };

  if (state.price !== undefined) {
    // Checked before affordability on purpose: whether you happen to have
    // the coins is not the question when you are stood in the cupboard.
    if (!state.canBuy) return { kind: 'in-store', price: state.price };
    return state.coins >= state.price
      ? { kind: 'buy', price: state.price }
      : {
          kind: 'unaffordable',
          price: state.price,
          short: state.price - state.coins,
        };
  }

  const need = state.needTrophies ?? 0;
  return { kind: 'locked', needTrophies: need, short: Math.max(0, need - state.trophies) };
}

/** The words on the button. Kept here so the tests can read them too. */
export function actionLabel(action: PreviewAction): string {
  switch (action.kind) {
    case 'equipped':
      return 'Using this one';
    case 'equip':
      return 'Use this one';
    case 'buy':
      return `Buy for ${action.price}`;
    case 'unaffordable':
      return `${action.short} more coins to go`;
    case 'in-store':
      return `In the Store for ${action.price}`;
    case 'locked':
      return `${action.short} more trophies to go`;
  }
}

/** Whether the button does anything when pressed. */
export function isActionPressable(action: PreviewAction): boolean {
  return action.kind === 'equip' || action.kind === 'buy';
}
