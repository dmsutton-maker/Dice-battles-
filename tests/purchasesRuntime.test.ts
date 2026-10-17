import './storageMock';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Module from 'node:module';
import { assert, assertEqual, suite, test } from './harness';
import {
  initPurchases,
  onPurchasesChanged,
  resetPurchasesForTest,
  storeState,
} from '../src/game/purchases';
import { getWallet, resetWalletForTests } from '../src/game/currency';

const root = join(__dirname, '..');
const source = (path: string) => readFileSync(join(root, path), 'utf8');

/**
 * purchases.ts run for real, against a stand-in for expo-iap.
 *
 * The other purchase tests read the source; these call it. What they
 * pin was found by an audit, not a player: a StoreKit that failed to
 * connect still showed Buy buttons, and a purchase that landed after a
 * screen was drawn never reached that screen.
 *
 * Node resolves `require('expo-iap')` itself, so the stand-in is put in
 * its place for the length of one test and always taken out again. That
 * is a statement about THIS file's mock only — whether the real module
 * loads on a phone is a question for a real build (see AGENTS.md).
 */

type Fake = Record<string, unknown>;

async function withFakeStore<T>(fake: Fake, body: () => Promise<T>): Promise<T> {
  const mod = Module as unknown as {
    _load: (request: string, ...rest: unknown[]) => unknown;
  };
  const original = mod._load;
  mod._load = function (request: string, ...rest: unknown[]) {
    return request === 'expo-iap' ? fake : original.call(this, request, ...rest);
  };
  try {
    return await body();
  } finally {
    mod._load = original;
    resetPurchasesForTest();
  }
}

/** Let promise callbacks and the un-awaited price fetch run. */
const settleMicrotasks = () => new Promise<void>((resolve) => setImmediate(resolve));

suite('purchases · a store that will not connect says so', () => {
  test('a rejected connection leaves the shop not ready', async () => {
    resetPurchasesForTest();
    await withFakeStore(
      { initConnection: () => Promise.reject(new Error('StoreKit unavailable')) },
      async () => {
        await initPurchases();
        assertEqual(
          storeState().available,
          false,
          'a rejected initConnection still shows Buy buttons that can only fail',
        );
      },
    );
  });

  test('a connection that answers false leaves the shop not ready', async () => {
    resetPurchasesForTest();
    await withFakeStore({ initConnection: async () => false }, async () => {
      await initPurchases();
      assertEqual(storeState().available, false, 'a refused connection counted as ready');
    });
  });

  test('a connection that never answers gives up and leaves the shop not ready', async () => {
    resetPurchasesForTest();
    // Make the 12 second wait instant rather than sitting through it.
    const realSetTimeout = global.setTimeout;
    (global as unknown as { setTimeout: unknown }).setTimeout = (
      fn: () => void,
      ms?: number,
      ...args: unknown[]
    ) => realSetTimeout(fn, ms && ms >= 10_000 ? 0 : ms, ...args);
    try {
      await withFakeStore({ initConnection: () => new Promise(() => {}) }, async () => {
        await initPurchases();
        assertEqual(storeState().available, false, 'a timed-out connection counted as ready');
      });
    } finally {
      (global as unknown as { setTimeout: unknown }).setTimeout = realSetTimeout;
    }
  });

  test('a good connection is ready', async () => {
    resetPurchasesForTest();
    await withFakeStore(
      {
        initConnection: async () => true,
        purchaseUpdatedListener: () => ({}),
        purchaseErrorListener: () => ({}),
        fetchProducts: async () => [],
      },
      async () => {
        await initPurchases();
        assertEqual(storeState().available, true, 'a working connection was not ready');
      },
    );
  });

  test('nothing in initPurchases throws out to the caller', async () => {
    resetPurchasesForTest();
    await withFakeStore(
      {
        initConnection: () => {
          throw new Error('synchronous native failure');
        },
      },
      async () => {
        await initPurchases();
        assertEqual(storeState().available, false, 'a throwing connection counted as ready');
      },
    );
  });
});

suite('purchases · screens hear when the shop changes', () => {
  /** A store that connects, answers with one price, and lets the test deliver purchases. */
  function makeStore() {
    let deliver: (purchase: Record<string, unknown>) => void = () => {};
    const fake: Fake = {
      initConnection: async () => true,
      purchaseUpdatedListener: (fn: (p: Record<string, unknown>) => void) => {
        deliver = fn;
        return {};
      },
      purchaseErrorListener: () => ({}),
      fetchProducts: async () => [{ id: 'coins_pouch', displayPrice: '$0.99' }],
      finishTransaction: async () => true,
    };
    return { fake, deliver: (p: Record<string, unknown>) => deliver(p) };
  }

  test('readiness, prices and a purchase each tell a listener', async () => {
    resetPurchasesForTest();
    resetWalletForTests();
    const { fake, deliver } = makeStore();
    await withFakeStore(fake, async () => {
      let calls = 0;
      onPurchasesChanged(() => {
        calls += 1;
      });

      await initPurchases();
      await settleMicrotasks();
      assert(calls >= 2, `ready and prices should both have fired, only ${calls} did`);
      assertEqual(storeState().priceOf('coins_pouch'), '$0.99', 'the price never arrived');

      const before = calls;
      const coinsBefore = getWallet().coins;
      // Approved by a parent with no sheet open: nobody is waiting on buy().
      deliver({ id: 'txn-1', productId: 'coins_pouch', purchaseState: 'purchased' });
      await settleMicrotasks();
      await settleMicrotasks();
      assert(calls > before, 'a purchase landing outside buy() told nobody');
      assertEqual(getWallet().coins, coinsBefore + 500, 'the coins were not granted');
    });
    resetWalletForTests();
  });

  test('a replayed transaction is granted once and announced once', async () => {
    resetPurchasesForTest();
    resetWalletForTests();
    const { fake, deliver } = makeStore();
    await withFakeStore(fake, async () => {
      await initPurchases();
      await settleMicrotasks();
      let calls = 0;
      onPurchasesChanged(() => {
        calls += 1;
      });
      const purchase = { id: 'txn-9', productId: 'coins_pouch', purchaseState: 'purchased' };
      deliver(purchase);
      await settleMicrotasks();
      await settleMicrotasks();
      deliver(purchase);
      await settleMicrotasks();
      await settleMicrotasks();
      assertEqual(calls, 1, 'a replay announced a second grant');
      assertEqual(getWallet().coins, 500, 'a replay paid twice');
    });
    resetWalletForTests();
  });

  test('stopping listening stops the calls', async () => {
    resetPurchasesForTest();
    resetWalletForTests();
    const { fake, deliver } = makeStore();
    await withFakeStore(fake, async () => {
      await initPurchases();
      await settleMicrotasks();
      let calls = 0;
      const stop = onPurchasesChanged(() => {
        calls += 1;
      });
      stop();
      deliver({ id: 'txn-2', productId: 'coins_pouch', purchaseState: 'purchased' });
      await settleMicrotasks();
      await settleMicrotasks();
      assertEqual(calls, 0, 'a listener that unsubscribed was still called');
    });
    resetWalletForTests();
  });

  test('a listener that throws neither blocks the others nor the purchase', async () => {
    resetPurchasesForTest();
    resetWalletForTests();
    const { fake, deliver } = makeStore();
    await withFakeStore(fake, async () => {
      await initPurchases();
      await settleMicrotasks();
      let heard = 0;
      onPurchasesChanged(() => {
        throw new Error('a broken screen');
      });
      onPurchasesChanged(() => {
        heard += 1;
      });
      deliver({ id: 'txn-3', productId: 'coins_pouch', purchaseState: 'purchased' });
      await settleMicrotasks();
      await settleMicrotasks();
      assertEqual(heard, 1, 'one broken listener silenced the next');
      assertEqual(getWallet().coins, 500, 'a broken listener stopped the grant');
    });
    resetWalletForTests();
  });
});

suite('purchases · the screens use it', () => {
  test('the shelf subscribes with cleanup instead of one fixed delay', () => {
    const shelf = source('src/demo/MoneyShelf.tsx');
    assert(/onPurchasesChanged\(/.test(shelf), 'MoneyShelf does not listen for purchase changes');
    assert(
      !/setTimeout\(refresh,\s*1200\)/.test(shelf),
      'MoneyShelf is back to reading the shop once at a fixed delay',
    );
    assert(
      /const stop = onPurchasesChanged\(refresh\);[\s\S]{0,80}return stop;/.test(shelf),
      'MoneyShelf does not unsubscribe when it unmounts',
    );
  });

  test('the main screen refreshes the purse and the Gold Pass when told', () => {
    const screen = source('src/demo/DiceDemoScreen.tsx');
    const at = screen.indexOf('onPurchasesChanged((');
    assert(at >= 0, 'DiceDemoScreen does not listen for purchase changes');
    const body = screen.slice(at, at + 200);
    assert(/setWallet\(/.test(body), 'a purchase outside the Store does not refresh the coins');
    assert(
      /claimGoldLevels\(\)/.test(body),
      'a purchase outside the Store does not pay the Gold Pass levels',
    );
  });
});

suite('power · split screen rests between rolls', () => {
  const screen = source('src/demo/TwoPlayerScreen.tsx');
  const expr = screen.slice(screen.indexOf('frameloop={'), screen.indexOf('camera={{ position'));

  test('inside a battle a board only draws while something moves', () => {
    assert(
      /phase === 'battle' && \(rolling \|\| boardBusy\)/.test(expr),
      'the split-screen boards draw through the whole battle again',
    );
    assert(!/phase === 'battle'\s*\)\s*\?/.test(expr), 'a bare battle phase keeps the loop on');
  });

  test('idle water keeps rippling at the slow rate, and the scene is told', () => {
    assert(/waterIdle\s*\?\s*'demand'/.test(expr), 'idle water no longer uses the demand loop');
    assert(
      /waterIdle=\{waterIdle\}/.test(screen),
      'the scene is never told to run the water clock',
    );
  });

  test('the dice and the prisoners are what wake the board', () => {
    assert(/onThrow=\{handleThrow\}/.test(screen), 'a throw does not wake the board');
    assert(/onSettled=\{handleSettled\}/.test(screen), 'a settle does not end the roll');
    assert(/setRolling\(true\)/.test(screen) && /setRolling\(false\)/.test(screen), 'rolling is never set and cleared');
    assert(
      /useEffect\(\(\) => \{\s*markBoardBusy\(\);\s*\}, \[units, markBoardBusy\]\)/.test(screen),
      'a prisoner leap no longer keeps the board drawing',
    );
    assert(
      /FLIGHT_SECONDS \* 1000 \+ 400/.test(screen),
      'the busy window no longer outlasts a leap',
    );
  });
});
