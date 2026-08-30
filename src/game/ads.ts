import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadAdSdk } from './adSdk';
import { gamesUntilAd, shouldShowAd } from './adRules';
import { getProgress } from './progress';

/**
 * Advertising, behind one door.
 *
 * Nothing else in the game imports the AdMob package. Every call goes
 * through this file — the same arrangement Game Center has, and for the
 * same two reasons: the SDK stays swappable, and no entry point here may
 * be able to break a battle.
 *
 * THE RULE, exactly as in gameCenter.ts: nothing here may throw, reject,
 * or block. No network, no consent, no fill, an old build without the
 * native code compiled in — every one of those must end with the player
 * simply not seeing an ad, and never with a crash or a wait.
 *
 * WHY THE MODULE IS REQUIRED LAZILY, and why it matters more here than
 * anywhere else in this codebase.
 *
 * AdMob is a NATIVE module: it only exists in a binary built after it was
 * added. JavaScript, though, ships over the air.
 *
 * THE LAZY REQUIRE BELOW DOES NOT PROTECT AGAINST THAT, and believing it
 * did cost David a crashing app on 25 Aug 2026.
 *
 * `react-native-google-mobile-ads` calls `TurboModuleRegistry.getEnforcing`
 * at MODULE SCOPE, which throws when the native side is missing. The
 * obvious defence is `try { require(...) } catch {}`, and it looks right
 * — the require sits inside the try in the shipped bundle; that was
 * checked. It does not work, because of what Metro's own module loader
 * does with a factory that throws
 * (metro-runtime/src/polyfills/require.js, `guardedLoadModule`):
 *
 *     try  { returnValue = loadModuleImplementation(moduleId, module); }
 *     catch (e) { global.ErrorUtils.reportFatalError(e); }
 *     return returnValue;
 *
 * Metro catches the error ITSELF, escalates it to a FATAL — the red
 * screen — and returns undefined without rethrowing. The caller's catch
 * is never reached. No `try`/`catch` around a `require` can survive a
 * module whose top-level code throws.
 *
 * TWO THINGS KEEP OLD BINARIES SAFE, and neither of them is a catch.
 *
 * 1. `src/game/adSdk.ts` is the single file holding the require, and it
 *    is currently OFF — so the SDK is not in the over-the-air bundle at
 *    all. Provable by grepping the built bundle, not by argument.
 * 2. `runtimeVersion` in app.json. While ads are OFF it is back on the
 *    sdkVersion policy, because there is nothing native to gate and the
 *    family needs the rest of the fixes. When ads are turned on it must
 *    become an explicit version in the SAME change, so builds without the
 *    SDK compiled in are never offered this JavaScript.
 *
 * Those two must agree, and `tests/ads.test.ts` fails if they do not.
 *
 * Everything below still runs on a build with no ads: the games-finished
 * tally is kept, and every entry point returns quietly. That is what
 * makes turning ads on later a change of one line rather than a feature.
 */

/** Only the parts of the SDK this file uses. Declared so nothing else needs its types. */
interface NativeAds {
  default: () => {
    initialize(): Promise<unknown>;
    setRequestConfiguration(config: {
      maxAdContentRating?: string;
      tagForChildDirectedTreatment?: boolean;
      tagForUnderAgeOfConsent?: boolean;
    }): Promise<void>;
  };
  MaxAdContentRating: { G: string };
  AdsConsent: {
    requestInfoUpdate(): Promise<{ canRequestAds: boolean }>;
    loadAndShowConsentFormIfRequired(): Promise<{ canRequestAds: boolean }>;
    getConsentInfo(): Promise<{ canRequestAds: boolean }>;
  };
  AdEventType: { LOADED: string; ERROR: string; CLOSED: string };
  TestIds: { INTERSTITIAL: string };
  InterstitialAd: {
    createForAdRequest(
      adUnitId: string,
      options?: { requestNonPersonalizedAdsOnly?: boolean },
    ): LoadedInterstitial;
  };
}

interface LoadedInterstitial {
  load(): void;
  show(): Promise<void>;
  addAdEventListener(type: string, listener: (arg?: unknown) => void): () => void;
}

/**
 * The real interstitial unit, from David's AdMob account.
 *
 * Note the SLASH. An App ID (`ca-app-pub-…~…`, tilde) identifies the app
 * and lives in app.json; an ad unit id (`ca-app-pub-…/…`, slash)
 * identifies this one placement. They look nearly identical and the App
 * ID was pasted here first, which is why `hasRealAdUnit()` checks for the
 * slash and a test fails on anything else — the wrong one would not error
 * loudly, it would simply never serve an ad.
 *
 * If this is ever emptied again the game falls back to GOOGLE'S TEST
 * INTERSTITIAL, which always fills and is the only safe thing to develop
 * against: requesting real ads from a device that is not a registered
 * test device is what gets an AdMob account suspended for invalid
 * traffic.
 *
 * Both ids are public by design — they are compiled into the binary and
 * readable by anyone who downloads it. The AdMob ACCOUNT is the secret;
 * these are not, which is why they may live in this public repo.
 */
export const INTERSTITIAL_AD_UNIT_ID = 'ca-app-pub-5310885665976703/5594525845';

/** True once a real unit is configured — the launch checklist reads this. */
export function hasRealAdUnit(): boolean {
  return INTERSTITIAL_AD_UNIT_ID.startsWith('ca-app-pub-')
    && INTERSTITIAL_AD_UNIT_ID.includes('/');
}

/**
 * The family's phones get FAKE ads, and no device id is needed to arrange it.
 *
 * Google suspends AdMob accounts for "invalid traffic" — loading and
 * tapping your own real ads — and the people most likely to do exactly
 * that are David, Marc and AJ testing the game. Google offers two safe
 * ways out, and this file takes the simpler one.
 *
 * THE ONE NOT TAKEN: registering each phone's test-device id. Those ids
 * exist only on the phone itself, printed to its system log the first
 * time an ad is requested, and reading one needs a Mac with the phone
 * plugged in. Nobody here has a Mac, and an id that cannot be collected
 * is a safety net that does not exist.
 *
 * THE ONE TAKEN: request Google's TEST ad unit instead of the real one.
 * The test unit always fills, is meant to be tapped, and earns nothing —
 * which is the entire point. It is Google's own recommended route for
 * development, not a workaround.
 *
 * WHO GETS IT: anyone in family tester mode — the `FAMILY` code in
 * Settings that David, Marc and AJ already type on a fresh install to
 * open every arena. That code now means "I am a tester" in both senses,
 * so registering a phone is typing a word into it rather than plugging it
 * into a laptop. `LOCK` turns it off again, and real ads come back.
 *
 * The check is deliberately made at REQUEST time rather than remembered,
 * so switching tester mode changes the very next ad.
 */
export function usingTestAds(): boolean {
  try {
    // Before the save is read back `unlockAll` is undefined, so this is
    // already false — real ads — which is the right default: a player
    // who is not a tester must never be handed a test ad, since a test
    // ad earns nothing. The catch is belt and braces for a future where
    // this getter does more than read a field.
    return getProgress().unlockAll === true;
  } catch {
    return false;
  }
}

const STORAGE_KEY = 'dice-battles/games-finished';

let native: NativeAds | null | undefined;
let ready = false;
let interstitial: LoadedInterstitial | null = null;
let loaded = false;
let gamesFinished = 0;
let adDue = false;

/** The SDK, or null forever if this binary does not contain it. */
function moduleOrNull(): NativeAds | null {
  if (native !== undefined) return native;
  native = null;
  try {
    // Required, never imported — see the note at the top of this file.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Platform } = require('react-native');
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return native;
    // The require lives in adSdk.ts, alone, so that whether the SDK is in
    // the bundle at all is a one-line decision in one file — see the note
    // at the top of this one.
    const mod = loadAdSdk() as NativeAds | null;
    if (mod && typeof mod.default === 'function') native = mod;
  } catch {
    // No native module in this binary. Nothing to do, ever.
  }
  return native;
}

/**
 * Start the SDK, gather consent, and remember how many games have been
 * played. Called once on launch; safe to call again.
 *
 * WHY CHILD-DIRECTED AND NON-PERSONALISED.
 *
 * This game is built for ages 5+, so COPPA applies to it whatever
 * category the App Store listing sits in. `tagForChildDirectedTreatment`
 * tells Google to treat every request as a child's, which turns off
 * personalised advertising and ad-tech that profiles a user. That is why
 * the game asks for no App Tracking Transparency permission and declares
 * "not used for tracking" in App Store Connect: those answers are true
 * BECAUSE of this call, and changing it silently would make them lies.
 *
 * `MaxAdContentRating.G` is the second half: G-rated creative only, so
 * what actually appears on screen suits the youngest person holding the
 * phone.
 */
export async function initAds(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const n = Number(raw);
    gamesFinished = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    gamesFinished = 0;
  }

  const mod = moduleOrNull();
  if (!mod) return;

  try {
    // Consent FIRST. In the EU an ad may not be requested before the user
    // has answered, and Google's own form is the thing that asks. Outside
    // the EU there is nothing to show and this returns immediately.
    let canRequestAds = false;
    try {
      await mod.AdsConsent.requestInfoUpdate();
      const info = await mod.AdsConsent.loadAndShowConsentFormIfRequired();
      canRequestAds = info?.canRequestAds ?? false;
    } catch {
      // A consent failure means NO ads, never ads-anyway: the whole point
      // of the form is that skipping it is not allowed.
      canRequestAds = false;
    }
    if (!canRequestAds) return;

    await mod.default().setRequestConfiguration({
      maxAdContentRating: mod.MaxAdContentRating.G,
      tagForChildDirectedTreatment: true,
      tagForUnderAgeOfConsent: true,
    });
    await mod.default().initialize();
    ready = true;
    preload();
  } catch {
    ready = false;
  }
}

/** Fetch the next interstitial so it is ready before its turn comes. */
function preload(): void {
  const mod = moduleOrNull();
  if (!mod || !ready || interstitial) return;
  try {
    const unitId = hasRealAdUnit() && !usingTestAds()
      ? INTERSTITIAL_AD_UNIT_ID
      : mod.TestIds.INTERSTITIAL;
    const ad = mod.InterstitialAd.createForAdRequest(unitId, {
      // Belt and braces with tagForChildDirectedTreatment above: this
      // says the same thing at the request level.
      requestNonPersonalizedAdsOnly: true,
    });
    ad.addAdEventListener(mod.AdEventType.LOADED, () => {
      loaded = true;
    });
    ad.addAdEventListener(mod.AdEventType.ERROR, () => {
      // No fill, no network, a bad unit id — drop it and try again after
      // the next game rather than holding a dead object forever.
      loaded = false;
      interstitial = null;
    });
    ad.addAdEventListener(mod.AdEventType.CLOSED, () => {
      loaded = false;
      interstitial = null;
      preload();
    });
    interstitial = ad;
    ad.load();
  } catch {
    interstitial = null;
    loaded = false;
  }
}

/**
 * Record that a game finished. Cheap, synchronous, never shows anything.
 *
 * Counting and SHOWING are deliberately two calls. A game ends on a
 * fanfare, a trophy count and sometimes an unlock popup, and an
 * interstitial slammed over that moment is the single worst place to put
 * one — the player would lose the reward they just earned behind an
 * advert. So the count happens here, at the true end of the game, and
 * the ad waits for `showAdIfDue()` on the way OUT of the result screen.
 */
export function noteGameFinished(): void {
  gamesFinished += 1;
  AsyncStorage.setItem(STORAGE_KEY, String(gamesFinished)).catch(() => {});
  if (shouldShowAd(gamesFinished)) {
    adDue = true;
    preload();
  } else if (gamesUntilAd(gamesFinished) <= 1) {
    // Fetch one game early, so it is in hand when its turn comes.
    preload();
  }
}

/**
 * Show the interstitial if one is due and one is ready.
 *
 * Called when the player leaves the result screen. Returns true only if
 * an ad actually went on screen, so a caller can tell "none was due"
 * from "one was due and none had loaded" — from the player's side those
 * are identical, and neither may delay anything by even a frame.
 */
export async function showAdIfDue(): Promise<boolean> {
  if (!adDue) return false;

  const mod = moduleOrNull();
  if (!mod || !ready || !interstitial || !loaded) {
    // Due, but nothing ready: SKIP it. Never make a child wait on a
    // network fetch to get back to their game — the next one comes
    // around in three more games anyway.
    adDue = false;
    preload();
    return false;
  }

  adDue = false;
  try {
    await interstitial.show();
    return true;
  } catch {
    loaded = false;
    interstitial = null;
    preload();
    return false;
  }
}

/** Total finished games on this device. Exposed for the tests. */
export function gamesPlayed(): number {
  return gamesFinished;
}

/** Test seam: forget everything this module has cached. */
export function resetAdsForTest(): void {
  native = undefined;
  ready = false;
  interstitial = null;
  loaded = false;
  gamesFinished = 0;
  adDue = false;
}
