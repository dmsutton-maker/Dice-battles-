import { assert, assertEqual, note, suite, test } from './harness';
import {
  describe as describeError,
  getLastFatal,
  installCrashGuard,
  onFatal,
  reportFatal,
} from '../src/debug/crashGuard';

/**
 * The thing that keeps a crash on screen instead of vanishing the app.
 *
 * In a standalone build there is no red error screen. When JavaScript
 * throws a fatal, expo-updates' error recovery tries a cached bundle and
 * then deliberately aborts the process — the app disappears and the
 * reason goes with it, which is exactly what happened to the first
 * TestFlight builds. `crashGuard.ts` takes the fatal handler over so the
 * error is remembered and drawn.
 *
 * It shipped with no tests at all, which is the wrong way round: this is
 * the code that runs when everything else has already failed, and it is
 * the one place where a bug means the player can tell us nothing.
 */
suite('crash guard · a failure that can be read', () => {
  /**
   * A fake `ErrorUtils`, installed for one test and taken back out.
   *
   * It has to be removed in a `finally`: leaving a global behind would
   * change how every later suite in the same process behaves, and the
   * failure would surface somewhere unrelated.
   */
  function withErrorUtils(
    run: (seen: { previousCalls: [unknown, boolean | undefined][] }) => void,
  ): void {
    const g = globalThis as {
      ErrorUtils?: unknown;
    };
    const had = 'ErrorUtils' in g;
    const original = g.ErrorUtils;

    const previousCalls: [unknown, boolean | undefined][] = [];
    let handler = (error: unknown, isFatal?: boolean) => {
      previousCalls.push([error, isFatal]);
    };
    g.ErrorUtils = {
      getGlobalHandler: () => handler,
      setGlobalHandler: (h: (error: unknown, isFatal?: boolean) => void) => {
        handler = h;
      },
    };
    try {
      run({ previousCalls });
    } finally {
      if (had) g.ErrorUtils = original;
      else delete g.ErrorUtils;
    }
  }

  /** The handler currently installed on the fake. */
  const current = () =>
    (
      globalThis as {
        ErrorUtils?: { getGlobalHandler: () => (e: unknown, f?: boolean) => void };
      }
    ).ErrorUtils!.getGlobalHandler();

  test('it takes over the global handler', () => {
    withErrorUtils(() => {
      const before = current();
      installCrashGuard();
      assert(current() !== before, 'the global error handler was never replaced');
    });
  });

  test('a FATAL error is kept, and never passed on to be aborted', () => {
    withErrorUtils(({ previousCalls }) => {
      installCrashGuard();
      const boom = new Error('the menu never drew');
      current()(boom, true);

      assertEqual(getLastFatal(), boom, 'the fatal error was not remembered');
      assertEqual(
        previousCalls.length,
        0,
        'the fatal was handed to the default handler, which is what aborts the app',
      );
    });
  });

  test('a NON-fatal error still reaches the handler underneath', () => {
    // Taking over everything would swallow ordinary logging. Only the
    // fatal path is intercepted, because only the fatal path aborts.
    withErrorUtils(({ previousCalls }) => {
      installCrashGuard();
      const minor = new Error('a warning');
      current()(minor, false);

      assertEqual(previousCalls.length, 1, 'a non-fatal error was swallowed');
      assertEqual(previousCalls[0][0], minor, 'the wrong error was passed on');
    });
  });

  test('no ErrorUtils at all is not a crash of its own', () => {
    // In node, and on any runtime that does not provide it, installing
    // has to be a no-op rather than a throw — this runs at startup,
    // before anything is on screen to report it.
    const g = globalThis as { ErrorUtils?: unknown };
    const had = 'ErrorUtils' in g;
    const original = g.ErrorUtils;
    delete g.ErrorUtils;
    try {
      installCrashGuard();
    } finally {
      if (had) g.ErrorUtils = original;
    }
  });

  test('something thrown that is not an Error still becomes one', () => {
    // `throw 'oops'` is legal JavaScript and a real thing libraries do.
    // Without this the screen would render `undefined: undefined`.
    reportFatal('the bundle did not load');
    const kept = getLastFatal();
    assert(kept instanceof Error, 'a thrown string was stored as something else');
    assertEqual(kept!.message, 'the bundle did not load', 'the message was lost');

    reportFatal(null);
    assert(getLastFatal() instanceof Error, 'a thrown null was stored as something else');
  });

  test('one broken listener does not stop the others', () => {
    /*
      The listeners are what draw the crash screen. If the first one to
      run throws — and one drawing a screen in a half-dead app very well
      might — every listener after it would never fire, and the player
      would be back to an app that vanished silently.
    */
    const order: string[] = [];
    const stopA = onFatal(() => {
      order.push('a');
      throw new Error('this listener is broken too');
    });
    const stopB = onFatal(() => {
      order.push('b');
    });
    try {
      reportFatal(new Error('boom'));
    } finally {
      stopA();
      stopB();
    }
    assertEqual(order.join(','), 'a,b', 'a throwing listener stopped the ones after it');
  });

  test('unsubscribing actually stops delivery', () => {
    let calls = 0;
    const stop = onFatal(() => {
      calls += 1;
    });
    reportFatal(new Error('one'));
    stop();
    reportFatal(new Error('two'));
    assertEqual(calls, 1, 'a listener kept firing after it unsubscribed');
  });

  test('the account of a failure fits on a phone', () => {
    assertEqual(
      describeError(null),
      'No error recorded.',
      'a screen with no error to show says something odd',
    );

    const long = new Error('something went wrong');
    long.stack = ['Error: something went wrong']
      .concat(Array.from({ length: 40 }, (_v, i) => `    at frame${i} (file.js:${i}:1)`))
      .join('\n');
    const shown = describeError(long);
    assert(shown.includes('something went wrong'), 'the message is not in the account');
    const lines = shown.split('\n').filter((l) => l.trim().startsWith('at '));
    assert(
      lines.length <= 12,
      `${lines.length} stack lines would be shown — a phone screen holds far fewer`,
    );
    note(`a 40-frame stack shows as ${lines.length} lines`);
  });
});
