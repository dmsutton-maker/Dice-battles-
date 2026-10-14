import AsyncStorage from '@react-native-async-storage/async-storage';
import { adsRemoved } from './purchases';
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
 * 1. `src/game/adSdk.ts` is the single file holding the require. It is
 *    currently ON, so the SDK does ship in the over-the-air bundle.
 *    Provable by grepping the built bundle, not by argument.
 * 2. `runtimeVersion` in app.json, which is therefore an explicit string
 *    — so a binary built before the SDK was added is never offered this
 *    JavaScript at all.
 *
 * Those two must agree, and `tests/ads.test.ts` fails if they do not.
 * Both of these paragraphs described the OFF state until 11 Sep 2026,
 * months after it had been switched on.
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
    requestInfoUpdate(options?: {
      tagForUnderAgeOfConsent?: boolean;
    }): Promise<{ canRequestAds: boolean }>;
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

/**
 * How long the game will wait for an ad's CLOSED event before carrying
 * on regardless. Long enough for any real interstitial, short enough
 * that a dropped event is a pause rather than a hang.
 */
const AD_CLOSE_TIMEOUT_MS = 90_000;

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

/**
 * Where the ad machinery got to, in one word.
 *
 * David, 11 Sep 2026: "there's no ads in the game." Nothing in this file
 * reported anything — every failure is swallowed on purpose, which is
 * right for a player and useless for working out WHY. Without a Mac
 * there is no device log to read either, so the state is kept here and
 * shown in Settings under family tester mode: one line that says which
 * step stopped, instead of a guess.
 */
export type AdStage =
  | 'not-started'
  | 'bought-out'
  | 'no-sdk'
  | 'no-consent'
  | 'init-failed'
  | 'ready';

let native: NativeAds | null | undefined;
let ready = false;
let stage: AdStage = 'not-started';
let starting: Promise<void> | null = null;
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
  /*
    SAFE TO CALL AGAIN, and something does.

    This used to run once, on launch, and a failure was permanent for the
    session. That is the wrong shape for the most likely failure there
    is: a cold start reaches this within a second of the app opening,
    before the phone has a usable connection, so the consent fetch below
    fails and ads are off until the app is killed and reopened at a
    luckier moment. Which is indistinguishable, from the sofa, from "the
    ads do not work".

    So a finished run that did not reach `ready` may be tried again, and
    `showAdIfDue` asks for one when an ad is actually due. Concurrent
    calls share the one attempt rather than racing two consent forms onto
    the screen.
  */
  if (ready) return;
  if (starting) return starting;
  starting = attemptInit().finally(() => {
    starting = null;
  });
  return starting;
}

async function attemptInit(): Promise<void> {
  // Nothing to start up for somebody who bought the adverts away — no
  // SDK, no consent form, no network.
  if (adsRemoved()) {
    stage = 'bought-out';
    return;
  }
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const n = Number(raw);
    gamesFinished = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    gamesFinished = 0;
  }

  const mod = moduleOrNull();
  if (!mod) {
    stage = 'no-sdk';
    return;
  }

  try {
    // Consent FIRST. In the EU an ad may not be requested before the user
    // has answered, and Google's own form is the thing that asks. Outside
    // the EU there is nothing to show and this returns immediately.
    let canRequestAds = false;
    try {
      /*
        UNDER AGE OF CONSENT, declared to the consent SDK BEFORE the form
        can be drawn — not afterwards on the request configuration.

        The two calls do different jobs and the order matters. Without
        this flag the SDK builds a GDPR/TCF form and shows it to whoever
        is holding the phone, and takes their tap as consent to
        personalised advertising. That person is frequently a child, a
        child cannot give that consent, and the App Privacy filing on
        this app says "not used for tracking" — an answer that is only
        true while nothing here asks for it. Flagged under-age, the SDK
        asks for the far narrower consent it is allowed to ask a child
        for, and the request configuration below then says the same
        thing a second time at request level.
      */
      await mod.AdsConsent.requestInfoUpdate({ tagForUnderAgeOfConsent: true });
      const info = await mod.AdsConsent.loadAndShowConsentFormIfRequired();
      canRequestAds = info?.canRequestAds ?? false;
    } catch {
      // A consent failure means NO ads, never ads-anyway: the whole point
      // of the form is that skipping it is not allowed.
      canRequestAds = false;
    }
    if (!canRequestAds) {
      stage = 'no-consent';
      return;
    }

    await mod.default().setRequestConfiguration({
      maxAdContentRating: mod.MaxAdContentRating.G,
      tagForChildDirectedTreatment: true,
      tagForUnderAgeOfConsent: true,
    });
    await mod.default().initialize();
    ready = true;
    stage = 'ready';
    preload();
  } catch {
    ready = false;
    stage = 'init-failed';
  }
}

/**
 * Set while an ad is on screen: called once, when it closes.
 *
 * `show()` resolves when the ad is PRESENTED, not when it is dismissed,
 * which is the whole reason this exists. The countdown, its 1100/1800ms
 * arm and go timers and then the AI's roll interval are ordinary JS
 * timers, and JS timers do not pause under a native full-screen ad — so
 * a player who watched an interstitial closed it to find the battle
 * already running and the rival ahead.
 */
let closedResolve: (() => void) | null = null;

/** Fetch the next interstitial so it is ready before its turn comes. */
function preload(): void {
  // No point fetching an advert that will never be shown, and no point
  // spending somebody's data on one they have paid not to see.
  if (adsRemoved()) return;
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
      // Wake whoever is waiting behind the ad BEFORE fetching the next
      // one, so the game resumes the instant the ad closes.
      const waiting = closedResolve;
      closedResolve = null;
      waiting?.();
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
 * How long the game will WAIT for a due ad to arrive before giving up
 * on that turn.
 *
 * David, 11 Sep 2026: "I played 4 games and still haven't gotten any
 * ads. Make sure the ad happens when you press play again or start
 * battle."
 *
 * This file used to hold the opposite rule, in as many words: "Due, but
 * nothing ready: SKIP it. Never make a child wait on a network fetch to
 * get back to their game." That was the right instinct and it was also
 * exactly why he saw no ads. An interstitial has to be FETCHED, the
 * fetch was only ever started in the background, and if the SDK had not
 * finished starting up — which on a cold launch it usually has not,
 * because it is racing the phone's connection — there was never
 * anything in hand when the turn came. The advert was then thrown away
 * and the counter moved on to three games' time, where the same thing
 * happened again.
 *
 * So the rule is inverted, with a cap. A due ad is now waited for, but
 * only for as long as an advert is worth waiting for, and the game
 * carries on regardless afterwards. Six seconds is the number: long
 * enough for a normal fetch on a normal connection, short enough that a
 * phone in a tunnel is a pause rather than a hang.
 */
const AD_LOAD_WAIT_MS = 6000;

/** Stop two callers showing the same ad twice. */
let showing = false;

/** Resolve once an ad is in hand, or once the wait is up. */
async function waitForAd(ms: number): Promise<boolean> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (loaded && interstitial) return true;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  return loaded && interstitial !== null;
}

/**
 * Show the interstitial if one is due.
 *
 * Called on both ways out of the result screen, and they are NOT the
 * same call.
 *
 * `wait: true` is the one David asked about — "make sure the ad happens
 * when you press play again or start battle". That caller is starting a
 * battle, the countdown is about to run, and a few seconds there is a
 * pause before a game rather than an interruption of one.
 *
 * The other way out is back to the MENU, and it does not wait. That
 * player is already looking at the menu; an advert arriving six seconds
 * later, over it, out of nothing, is worse than no advert. It shows one
 * only if there is already one in hand.
 *
 * A DUE AD IS NO LONGER LOST. It used to clear `adDue` whatever
 * happened, so a turn that could not show one silently skipped it and
 * the next chance was three games away. Now the flag survives until an
 * advert has actually been on screen, so the very next "play again"
 * tries again.
 *
 * Returns true only if one really went up, so a caller can tell "none
 * was due" from "one was due and could not be fetched".
 */
export async function showAdIfDue(
  options: { wait?: boolean } = {},
): Promise<boolean> {
  if (!adDue || showing) return false;
  /*
    Somebody who paid to be rid of adverts never sees another one.

    Checked HERE rather than at the counting end, so the every-third-game
    counter keeps running: if they ever restore onto a phone where the
    purchase is not recognised, or a refund goes through, the rhythm is
    already correct rather than starting over.
  */
  if (adsRemoved()) {
    adDue = false;
    return false;
  }

  const mod = moduleOrNull();
  if (!mod) {
    /*
      No SDK in this binary at all — an old build from before ads
      existed. This one really can never happen, so the flag is cleared
      rather than left to be retried for ever.
    */
    adDue = false;
    return false;
  }

  showing = true;
  try {
    /*
      Start the SDK if it is not started. This is the moment to have
      another go at it: there is demonstrably a player, a finished game,
      and a session that has been running long enough to have a
      connection — which is exactly what a cold launch did not have.
    */
    if (!ready) {
      /*
        Only the waiting caller may start the SDK. The other one is the
        player arriving back at the menu, and they are already looking at
        it — an advert that appeared six seconds later, over the menu,
        out of nothing, would be worse than no advert.
      */
      if (!options.wait) return false;
      await initAds();
    }
    if (!ready) return false;

    // Ask for one if there is not one in hand, then wait a little.
    preload();
    if (!(loaded && interstitial)) {
      if (!options.wait) return false;
      const arrived = await waitForAd(AD_LOAD_WAIT_MS);
      if (!arrived) {
        /*
          `adDue` is deliberately LEFT SET. The advert is still owed and
          the next way out of a result screen will try again, rather than
          the player getting three more free games because one fetch was
          slow.
        */
        return false;
      }
    }
  } finally {
    showing = false;
  }

  adDue = false;
  showing = true;
  try {
    /*
      Resolve on CLOSED, not on shown — but never wait forever. If the
      event never arrives (an SDK that drops it, an ad dismissed by the
      system) the game must still start, so the wait is capped. Nothing
      in this file may block the game; a late resume is a bug, a stuck
      one is a dead app.
    */
    const closed = new Promise<void>((resolve) => {
      closedResolve = resolve;
      setTimeout(() => {
        if (closedResolve === resolve) {
          closedResolve = null;
          resolve();
        }
      }, AD_CLOSE_TIMEOUT_MS);
    });
    await interstitial!.show();
    await closed;
    return true;
  } catch {
    closedResolve = null;
    loaded = false;
    interstitial = null;
    preload();
    return false;
  } finally {
    showing = false;
  }
}

/**
 * What the ad machinery is doing, for the tester line in Settings.
 *
 * Reading only — it starts nothing and shows nothing. Every field is
 * something that was already being decided silently.
 */
export function adStatus(): {
  stage: AdStage;
  sdk: boolean;
  loaded: boolean;
  due: boolean;
  gamesFinished: number;
  untilNext: number;
  unit: 'test' | 'real';
} {
  return {
    stage,
    sdk: moduleOrNull() !== null,
    loaded,
    due: adDue,
    gamesFinished,
    untilNext: gamesUntilAd(gamesFinished),
    unit: hasRealAdUnit() && !usingTestAds() ? 'real' : 'test',
  };
}

/** Total finished games on this device. Exposed for the tests. */
export function gamesPlayed(): number {
  return gamesFinished;
}

/** Test seam: forget everything this module has cached. */
export function resetAdsForTest(): void {
  closedResolve = null;
  native = undefined;
  ready = false;
  stage = 'not-started';
  starting = null;
  showing = false;
  interstitial = null;
  loaded = false;
  gamesFinished = 0;
  adDue = false;
}
