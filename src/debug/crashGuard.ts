/**
 * Keeps a startup failure visible instead of fatal.
 *
 * In a standalone build there is no red error screen: when JavaScript
 * throws a fatal error, expo-updates' error recovery tries a cached
 * bundle and, failing that, deliberately aborts the process. The app
 * simply disappears, and the reason goes with it — which is exactly what
 * happened to the first TestFlight builds.
 *
 * So the fatal handler is taken over here: the error is remembered and
 * shown on screen rather than rethrown. A player seeing "something went
 * wrong, here is what" can tell us what it said; a player watching the
 * app vanish can only say "it crashed".
 */

let lastFatal: Error | null = null;
const listeners = new Set<(error: Error) => void>();

export function getLastFatal(): Error | null {
  return lastFatal;
}

export function onFatal(listener: (error: Error) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Records an error and tells anyone drawing a screen about it. */
export function reportFatal(error: unknown): void {
  const asError =
    error instanceof Error ? error : new Error(String(error ?? 'Unknown error'));
  lastFatal = asError;
  for (const listener of listeners) {
    try {
      listener(asError);
    } catch {
      // A failing listener must not become a second crash.
    }
  }
}

/** A short, readable account of a failure, safe to show on a phone. */
export function describe(error: Error | null): string {
  if (!error) return 'No error recorded.';
  const stack = (error.stack ?? '')
    .split('\n')
    .slice(0, 12)
    .join('\n');
  return `${error.name}: ${error.message}\n\n${stack}`;
}

interface ErrorUtilsLike {
  getGlobalHandler?: () => (error: unknown, isFatal?: boolean) => void;
  setGlobalHandler?: (
    handler: (error: unknown, isFatal?: boolean) => void,
  ) => void;
}

export function installCrashGuard(): void {
  const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (!errorUtils?.setGlobalHandler) return;

  const previous = errorUtils.getGlobalHandler?.();
  errorUtils.setGlobalHandler((error, isFatal) => {
    reportFatal(error);
    // Deliberately NOT passing a fatal error on to the default handler:
    // that is what triggers the abort, and an abort tells nobody anything.
    if (!isFatal && previous) previous(error, isFatal);
  });
}
