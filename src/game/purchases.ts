import AsyncStorage from '@react-native-async-storage/async-storage';
import { grantCoins } from './currency';
import { loadStoreKit } from './storeKit';
import { PRODUCTS, Product, REMOVE_ADS, productById, sellable } from './products';

/**
 * Buying things with real money.
 *
 * THE RULE, the same one `ads.ts` and `gameCenter.ts` follow: nothing
 * here may throw, reject, or block. A player with no connection, on a
 * build without the StoreKit module, or in a country where the products
 * were never published, must get a Store screen that says so — never a
 * crash, and never a spinner that spins for ever.
 *
 * ── WHAT IS STORED, AND WHERE ─────────────────────────────────────────
 *
 * Entitlements live on the DEVICE, and Apple's receipt is the real
 * record behind them. There is no account and no server holding what
 * anybody bought — this game deliberately has neither — so "Restore
 * purchases" asks StoreKit, which asks Apple, which knows. The local
 * copy is a cache so the game works on a plane, not the source of truth.
 *
 * Consumables are the exception and it is Apple's rule, not ours: coins
 * are granted once, spent, and never restored. Buying a Chest twice
 * gives you two chests.
 *
 * ── WHAT THIS FILE WILL NOT DO ────────────────────────────────────────
 *
 * It will not grant anything StoreKit did not confirm. There is no
 * "assume it worked" path, because the failure mode of one is a player
 * charged for something they did not receive.
 */

/** Where the device remembers what has been bought. */
const STORAGE_KEY = 'dice-battles:entitlements';
/** When this phone first opened the game — the starter window's clock. */
const INSTALLED_KEY = 'dice-battles:installed-at';

/** Long enough for a slow shop request, short enough not to feel broken. */
const TIMEOUT_MS = 12_000;

/** Everything bought with money on this device, by entitlement id. */
let owned = new Set<string>();
let installedAt: number | null = null;
let ready = false;

/** The real prices the phone reported, by product id. Empty until asked. */
let priceById = new Map<string, string>();

export interface StoreState {
  /**
   * Can this phone buy anything at all?
   *
   * False on a build without the StoreKit module, which is every build
   * until the switch in storeKit.ts is thrown — see that file.
   */
  available: boolean;
  /** What is on sale, after the starter window and readiness are applied. */
  products: Product[];
  /** Apple's own localised price string, e.g. "£3.99". */
  priceOf: (id: string) => string | null;
}

function moduleOrNull(): Record<string, unknown> | null {
  const mod = loadStoreKit();
  return mod && typeof mod === 'object' ? (mod as Record<string, unknown>) : null;
}

/** Never let a shop request hang the screen that is waiting on it. */
async function withTimeout<T>(work: Promise<T>, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), TIMEOUT_MS);
      }),
    ]);
  } catch {
    return fallback;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Read what this device owns, and note when it was installed.
 *
 * Called once on launch. Safe to call again; safe to fail.
 */
export async function initPurchases(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    owned = new Set(Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : []);
  } catch {
    owned = new Set();
  }

  /*
    The install time is written the FIRST time the game runs and never
    again, which is what makes the two-day starter window mean anything.
    A player who has had the game for a month must not be shown it
    because an update reset the clock.
  */
  try {
    const raw = await AsyncStorage.getItem(INSTALLED_KEY);
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) {
      installedAt = n;
    } else {
      installedAt = Date.now();
      AsyncStorage.setItem(INSTALLED_KEY, String(installedAt)).catch(() => {});
    }
  } catch {
    installedAt = null;
  }

  const mod = moduleOrNull();
  if (!mod) return;

  try {
    const connect = mod.initConnection as (() => Promise<unknown>) | undefined;
    if (connect) await withTimeout(connect(), null);
    ready = true;
    void refreshPrices();
  } catch {
    ready = false;
  }
}

/** Ask the phone what these products actually cost where the player is. */
async function refreshPrices(): Promise<void> {
  const mod = moduleOrNull();
  if (!mod || !ready) return;
  try {
    const fetchProducts = mod.getProducts as
      | ((ids: string[]) => Promise<{ id: string; displayPrice?: string }[]>)
      | undefined;
    if (!fetchProducts) return;
    const ids = PRODUCTS.filter((p) => p.available).map((p) => p.id);
    const found = await withTimeout(fetchProducts(ids), []);
    const next = new Map<string, string>();
    for (const item of found) {
      if (item?.id && typeof item.displayPrice === 'string') {
        next.set(item.id, item.displayPrice);
      }
    }
    priceById = next;
  } catch {
    // Prices stay unknown; the Store screen says so rather than guessing.
  }
}

/** What the Store screen needs to draw itself. */
export function storeState(now: number = Date.now()): StoreState {
  return {
    available: ready,
    products: sellable(installedAt, now),
    priceOf: (id: string) => priceById.get(id) ?? null,
  };
}

/** Does this device own that entitlement? */
export function hasEntitlement(id: string): boolean {
  return owned.has(id);
}

/**
 * Have adverts been bought away?
 *
 * `ads.ts` asks this before showing anything, so a player who paid never
 * sees another one — including on a build where purchasing itself is
 * switched off, because what they bought is remembered locally.
 */
export function adsRemoved(): boolean {
  return owned.has(REMOVE_ADS);
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...owned]));
  } catch {
    // Written again next time. A lost write costs a restore, not a purchase.
  }
}

/**
 * Hand over what a confirmed purchase bought.
 *
 * Only ever called after StoreKit has confirmed, and it is deliberately
 * the only path that grants anything.
 */
async function grant(product: Product): Promise<void> {
  if (product.coins) grantCoins(product.coins);
  for (const id of product.grants ?? []) owned.add(id);
  // A one-off is remembered by its own id too, so the Store can show it
  // as bought even when it granted nothing but coins.
  if (product.kind !== 'consumable') owned.add(product.id);
  await persist();
}

export type BuyResult =
  | { ok: true; product: Product }
  | { ok: false; reason: 'unavailable' | 'cancelled' | 'failed'; message: string };

/**
 * Buy something.
 *
 * A cancel is not an error — it is the most common outcome of opening a
 * purchase sheet, and it must read as nothing having happened.
 */
export async function buy(productId: string): Promise<BuyResult> {
  const product = productById(productId);
  if (!product || !product.available) {
    return { ok: false, reason: 'unavailable', message: 'That is not for sale.' };
  }

  const mod = moduleOrNull();
  if (!mod || !ready) {
    return {
      ok: false,
      reason: 'unavailable',
      message: 'Buying is not available on this phone yet.',
    };
  }

  try {
    const request = mod.requestPurchase as
      | ((args: { sku: string }) => Promise<unknown>)
      | undefined;
    if (!request) {
      return {
        ok: false,
        reason: 'unavailable',
        message: 'Buying is not available on this phone yet.',
      };
    }

    const outcome = await request({ sku: product.id });
    if (!outcome) {
      // A cancelled sheet resolves with nothing. Say nothing back.
      return { ok: false, reason: 'cancelled', message: '' };
    }

    await grant(product);
    return { ok: true, product };
  } catch (error) {
    const message = String((error as { message?: string })?.message ?? '');
    if (/cancel/i.test(message)) {
      return { ok: false, reason: 'cancelled', message: '' };
    }
    return {
      ok: false,
      reason: 'failed',
      message: 'That did not go through. You have not been charged.',
    };
  }
}

/**
 * Put back what this Apple account already bought.
 *
 * Apple requires a visible way to do this in any app selling
 * non-consumables — a new phone, a reinstall, a second device in the
 * family all depend on it. Coins are NOT restored: Apple's rule, and
 * ours, because they have already been spent.
 */
export async function restore(): Promise<{ restored: number; ok: boolean }> {
  const mod = moduleOrNull();
  if (!mod || !ready) return { restored: 0, ok: false };

  try {
    const fetchOwned = mod.getAvailablePurchases as
      | (() => Promise<{ id?: string; productId?: string }[]>)
      | undefined;
    if (!fetchOwned) return { restored: 0, ok: false };

    const purchases = await withTimeout(fetchOwned(), []);
    let restored = 0;
    for (const purchase of purchases) {
      const id = purchase?.id ?? purchase?.productId;
      const product = id ? productById(id) : undefined;
      // Consumables are never restored — they were spent when granted.
      if (!product || product.kind === 'consumable') continue;
      if (owned.has(product.id)) continue;
      for (const grantId of product.grants ?? []) owned.add(grantId);
      owned.add(product.id);
      restored += 1;
    }
    if (restored > 0) await persist();
    return { restored, ok: true };
  } catch {
    return { restored: 0, ok: false };
  }
}

/** Test seam: forget everything this module has cached. */
export function resetPurchasesForTest(state?: {
  owned?: string[];
  installedAt?: number | null;
  ready?: boolean;
}): void {
  owned = new Set(state?.owned ?? []);
  installedAt = state?.installedAt === undefined ? null : state.installedAt;
  ready = state?.ready ?? false;
  priceById = new Map();
}
