/**
 * `react-native`, as react-native-web, but pretending to be an iPhone.
 *
 * WHY THIS SHIM EXISTS. The whole point of the Duo preview is to see the
 * home-indicator inset the game works out for a folding phone. That
 * number comes from `bottomInsetFor`, which asks `Platform.OS` — and
 * under react-native-web the honest answer is `'web'`, which routes to
 * the 12pt Android gesture bar instead of the 34pt iPhone indicator.
 *
 * A preview that quietly drew 12pt of bottom padding would show a tab
 * row sitting 22pt lower than a real Duo would, which is precisely the
 * fault the preview is meant to catch. So the OS is forced to 'ios'
 * here, at the module boundary, rather than the screens being modified
 * to accept an override they would never use on a phone.
 *
 * The explicit `Platform` export deliberately shadows the one coming
 * through `export *` — an explicit local export wins over a star
 * re-export, so every `import { Platform } from 'react-native'` in the
 * game resolves to this one and nothing else changes.
 */
import { Platform as WebPlatform } from 'react-native-web';

export * from 'react-native-web';

export const Platform = { ...WebPlatform, OS: 'ios', isPad: false };

/**
 * Stubs for the parts of `react-native` that only exist on a phone.
 *
 * react-native-web has no TurboModules, and expo-modules-core imports
 * the registry unconditionally. Nothing in a MENU reaches for a native
 * module while it renders — storage reads and audio are all behind
 * effects or taps — so an empty registry is enough to get the layout on
 * screen, which is the only thing being looked at here. Anything that
 * did genuinely need one would fail loudly rather than silently, which
 * is the right way round for a preview tool.
 */
const nothing = new Proxy(
  {},
  {
    get: () => () => undefined,
  },
);

export const TurboModuleRegistry = {
  get: () => nothing,
  getEnforcing: () => nothing,
};
