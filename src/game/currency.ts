import AsyncStorage from '@react-native-async-storage/async-storage';
import { AiDifficultyId } from './ai';

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
 * Coins per battle. Winning pays properly; losing still pays a little, so
 * a young player who keeps losing on Hard is still working toward
 * something. Harder battles pay more, matching the trophy stakes.
 */
export const COIN_REWARDS: Record<AiDifficultyId, { win: number; loss: number }> = {
  easy: { win: 20, loss: 5 },
  medium: { win: 40, loss: 10 },
  hard: { win: 75, loss: 15 },
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

/** Pay out for a finished battle. Returns the coins awarded. */
export function awardCoins(
  outcome: 'won' | 'lost' | 'tie',
  difficulty: AiDifficultyId,
): number {
  const rates = COIN_REWARDS[difficulty];
  const amount =
    outcome === 'won'
      ? rates.win
      : Math.round(rates.loss * (outcome === 'tie' ? COIN_TIE_MULTIPLIER : 1));
  current = { ...current, coins: current.coins + amount };
  persist();
  return amount;
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

/** Test-only reset so suites do not leak state between cases. */
export function resetWalletForTests(wallet: Wallet = { coins: 0, owned: [] }): void {
  current = { ...wallet, owned: [...wallet.owned] };
}
