import AsyncStorage from '@react-native-async-storage/async-storage';
import { AiDifficultyId } from './ai';
import { RewardRange, rollReward } from './rewards';

/**
 * Coins: the in-game currency, earned by playing and spent in the Store.
 *
 * Deliberately separate from trophies. Trophies are your RANK — they go up
 * and down with wins and losses and decide what the ladder has unlocked.
 * Coins are a REWARD — they only ever accumulate, and losing never takes
 * them away, so a bad run still leaves something to show for it.
 *
 * Nothing bought with coins can affect a roll: the Store sells dice shells
 * and battlefields, never anything that touches the six face colours.
 */
export interface Wallet {
  coins: number;
  /** Everything bought with coins, by item id. */
  owned: string[];
}

/**
 * Coins per battle, as ranges — the payout varies inside the band so the
 * number is worth looking at each time. Winning pays properly; losing
 * still pays a little, so a young player on a losing streak is still
 * working toward something. Harder battles pay more.
 *
 * A loss never SUBTRACTS coins. That is the whole difference from
 * trophies: trophies are rank and can fall, coins only accumulate.
 */
export const COIN_REWARDS: Record<
  AiDifficultyId,
  { win: RewardRange; loss: RewardRange }
> = {
  easy: { win: { min: 10, max: 20 }, loss: { min: 3, max: 7 } },
  medium: { win: { min: 25, max: 45 }, loss: { min: 6, max: 14 } },
  hard: { win: { min: 50, max: 85 }, loss: { min: 10, max: 20 } },
};

/** A tie is a draw, not a loss — it pays the losing rate. */
export const COIN_TIE_MULTIPLIER = 1;

const STORAGE_KEY = 'dice-battles:wallet';

let current: Wallet = { coins: 0, owned: [] };

export function getWallet(): Wallet {
  return current;
}

export async function loadWallet(): Promise<Wallet> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      current = {
        coins: Number.isFinite(parsed.coins) ? Math.max(0, Math.floor(parsed.coins)) : 0,
        owned: Array.isArray(parsed.owned)
          ? parsed.owned.filter((id: unknown) => typeof id === 'string')
          : [],
      };
    }
  } catch {
    // Defaults are fine if storage is unavailable.
  }
  return current;
}

function persist(): void {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current)).catch(() => {});
}

/** Pay out for a finished battle. Returns the coins awarded, never negative. */
export function awardCoins(
  outcome: 'won' | 'lost' | 'tie',
  difficulty: AiDifficultyId,
  rng: () => number = Math.random,
): number {
  const rates = COIN_REWARDS[difficulty];
  const band = outcome === 'won' ? rates.win : rates.loss;
  const rolled = rollReward(band, rng);
  const amount =
    outcome === 'tie' ? Math.round(rolled * COIN_TIE_MULTIPLIER) : rolled;
  current = { ...current, coins: current.coins + amount };
  persist();
  return amount;
}

/** The MONEY code in Settings. Returns the new balance. */
export function grantCoins(amount: number): number {
  current = { ...current, coins: current.coins + Math.max(0, Math.floor(amount)) };
  persist();
  return current.coins;
}

/**
 * Spend coins on something that is not an item — a tournament entry fee.
 * Refuses rather than going negative, like buyWithCoins, but records no
 * ownership: there is nothing to own.
 */
export function spendCoins(amount: number): boolean {
  const cost = Math.max(0, Math.floor(amount));
  if (current.coins < cost) return false;
  current = { ...current, coins: current.coins - cost };
  persist();
  return true;
}

export function canAfford(price: number): boolean {
  return current.coins >= price;
}

export function owns(itemId: string): boolean {
  return current.owned.includes(itemId);
}

export type PurchaseResult =
  | { ok: true; coins: number }
  | { ok: false; reason: 'already-owned' | 'too-expensive' };

/** Spend coins on an item. Refuses rather than going negative. */
export function buyWithCoins(itemId: string, price: number): PurchaseResult {
  if (owns(itemId)) return { ok: false, reason: 'already-owned' };
  if (!canAfford(price)) return { ok: false, reason: 'too-expensive' };
  current = {
    coins: current.coins - price,
    owned: [...current.owned, itemId],
  };
  persist();
  return { ok: true, coins: current.coins };
}

/**
 * Forget everything bought with coins, so the Store can be walked through
 * again from nothing. The RESET code in Settings.
 *
 * Coins are deliberately NOT refunded: the point is to buy the items a
 * second time and see the shelf work, which a refund would skip past.
 * Returns how many items were let go.
 */
export function clearPurchases(): number {
  const removed = current.owned.length;
  if (removed === 0) return 0;
  current = { ...current, owned: [] };
  persist();
  return removed;
}

/** Test-only reset so suites do not leak state between cases. */
export function resetWalletForTests(wallet: Wallet = { coins: 0, owned: [] }): void {
  current = { ...wallet, owned: [...wallet.owned] };
}
