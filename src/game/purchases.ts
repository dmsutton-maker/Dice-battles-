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
/** Store transactions already handed over, so a replay never pays twice. */
const HANDLED_KEY = 'dice-battles:handled-transactions';

/** Long enough for a slow shop request, short enough not to feel broken. */
const TIMEOUT_MS = 12_000;

/** Everything bought with money on this device, by entitlement id. */
let owned = new Set<string>();
/** Transaction ids already handed over. Not entitlements — bookkeeping. */
let handled = new Set<string>();
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
  try {
    const raw = await AsyncStorage.getItem(HANDLED_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    handled = new Set(Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : []);
  } catch {
    handled = new Set();
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
    // Before anything else: a purchase interrupted last time is replayed
    // the moment the connection opens, and must find someone listening.
    listen(mod);
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
    const fetchProducts = mod.fetchProducts as
      | ((request: { skus: string[]; type: 'in-app' }) => Promise<{ id: string; displayPrice?: string }[] | null>)
      | undefined;
    if (!fetchProducts) return;
    const ids = PRODUCTS.filter((p) => p.available).map((p) => p.id);
    const found = (await withTimeout(fetchProducts({ skus: ids, type: 'in-app' }), [])) ?? [];
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

async function persistHandled(): Promise<void> {
  try {
    await AsyncStorage.setItem(HANDLED_KEY, JSON.stringify([...handled].slice(-200)));
  } catch {
    // Worst case a replayed transaction is handed over twice.
  }
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
  | {
      ok: false;
      reason: 'unavailable' | 'cancelled' | 'failed' | 'pending';
      message: string;
    };

/**
 * The shape of a purchase as the library reports it. Only what is read
 * here; `id` is the TRANSACTION id, not the product's.
 */
interface StorePurchase {
  id?: string;
  productId?: string;
  purchaseState?: 'pending' | 'purchased' | 'unknown';
}

/**
 * The one purchase sheet that may be open, and how to answer it.
 *
 * The library does not answer a purchase through the call that opened
 * the sheet. The outcome arrives on a listener — and so do purchases
 * nobody is waiting for: a parent approving an Ask to Buy an hour later,
 * or a purchase that was interrupted and is replayed on the next launch.
 * Those are paid for, so they are handed over all the same.
 */
let waiting: { productId: string; settle: (result: BuyResult) => void } | null = null;
let listening = false;

function answer(result: BuyResult): void {
  const open = waiting;
  waiting = null;
  open?.settle(result);
}

const NOT_CHARGED = 'That did not go through. You have not been charged.';

/** Listen once, for the life of the app. Safe to call again. */
function listen(mod: Record<string, unknown>): void {
  if (listening) return;
  const onPurchase = mod.purchaseUpdatedListener as
    | ((fn: (purchase: StorePurchase) => void) => unknown)
    | undefined;
  const onError = mod.purchaseErrorListener as
    | ((fn: (error: { code?: string; message?: string; productId?: string | null }) => void) => unknown)
    | undefined;
  if (!onPurchase || !onError) return;
  try {
    onPurchase((purchase) => {
      void settle(mod, purchase);
    });
    onError((error) => {
      if (!waiting) return;
      if (error?.productId && error.productId !== waiting.productId) return;
      const cancelled =
        error?.code === 'user-cancelled' || /cancel/i.test(String(error?.message ?? ''));
      answer(
        cancelled
          ? { ok: false, reason: 'cancelled', message: '' }
          : { ok: false, reason: 'failed', message: NOT_CHARGED },
      );
    });
    listening = true;
  } catch {
    listening = false;
  }
}

/**
 * A purchase the store has reported: hand it over ONCE, then finish it.
 *
 * Finishing matters as much as granting. An unfinished transaction is
 * replayed on every launch on iPhone, and on Android one left unfinished
 * for three days is refunded by Google. Coins are finished as
 * consumables so the same pack can be bought again.
 */
async function settle(mod: Record<string, unknown>, purchase: StorePurchase): Promise<void> {
  try {
    const product = purchase?.productId ? productById(purchase.productId) : undefined;
    if (!product) return;

    if (purchase.purchaseState === 'pending') {
      // Ask to Buy: a grown-up has to say yes first. Nothing is charged
      // until they do, and when they do it arrives here again.
      if (waiting?.productId === product.id) {
        answer({
          ok: false,
          reason: 'pending',
          message: 'A grown-up has been asked. It will arrive by itself once they say yes.',
        });
      }
      return;
    }

    const key = purchase.id ?? '';
    if (!key || !handled.has(key)) {
      await grant(product);
      if (key) {
        handled.add(key);
        await persistHandled();
      }
    }

    const finish = mod.finishTransaction as
      | ((args: { purchase: StorePurchase; isConsumable: boolean }) => Promise<unknown>)
      | undefined;
    if (finish) {
      await withTimeout(finish({ purchase, isConsumable: product.kind === 'consumable' }), null);
    }

    if (waiting?.productId === product.id) answer({ ok: true, product });
  } catch {
    if (waiting) answer({ ok: false, reason: 'failed', message: NOT_CHARGED });
  }
}

/** Long enough for a slow Face ID and a parent's thumb; not for ever. */
const SHEET_TIMEOUT_MS = 10 * 60_000;

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
  const request = mod?.requestPurchase as ((args: unknown) => Promise<unknown>) | undefined;
  if (!mod || !ready || !listening || !request) {
    return {
      ok: false,
      reason: 'unavailable',
      message: 'Buying is not available on this phone yet.',
    };
  }
  if (waiting) {
    return { ok: false, reason: 'failed', message: 'Finish the other purchase first.' };
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const outcome = new Promise<BuyResult>((resolve) => {
    waiting = { productId: product.id, settle: resolve };
    timer = setTimeout(
      () =>
        answer({
          ok: false,
          reason: 'failed',
          message: 'That took too long. If you were charged, it will arrive by itself.',
        }),
      SHEET_TIMEOUT_MS,
    );
  });

  try {
    await request({
      request: { apple: { sku: product.id }, google: { skus: [product.id] } },
      type: 'in-app',
    });
  } catch (error) {
    const message = String((error as { message?: string })?.message ?? '');
    const code = String((error as { code?: string })?.code ?? '');
    answer(
      code === 'user-cancelled' || /cancel/i.test(message)
        ? { ok: false, reason: 'cancelled', message: '' }
        : { ok: false, reason: 'failed', message: NOT_CHARGED },
    );
  }

  const result = await outcome;
  if (timer) clearTimeout(timer);
  return result;
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
    const sync = mod.restorePurchases as (() => Promise<unknown>) | undefined;
    if (sync) await withTimeout(sync(), null);

    const fetchOwned = mod.getAvailablePurchases as
      | (() => Promise<StorePurchase[]>)
      | undefined;
    if (!fetchOwned) return { restored: 0, ok: false };

    const purchases = await withTimeout(fetchOwned(), []);
    let restored = 0;
    for (const purchase of purchases) {
      // productId, not id: id is the transaction.
      const id = purchase?.productId;
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
  handled = new Set();
  waiting = null;
  listening = false;
}
