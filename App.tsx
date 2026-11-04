import React from 'react';
import { InteractionManager } from 'react-native';
import { CrashScreen } from './src/debug/CrashScreen';
import { getLastFatal, onFatal, reportFatal } from './src/debug/crashGuard';
import { ScreenRuler } from './src/debug/ScreenRuler';
import { DiceDemoScreen } from './src/demo/DiceDemoScreen';
import { BootSplash } from './src/demo/BootSplash';
import { SafeInsetsProbe } from './src/game/safeInsets';
import {
  giveUpWaiting,
  launchReady,
  LOADING_CAP_MS,
  LOADING_MIN_MS,
  onLaunchChange,
  shouldReveal,
} from './src/game/launchReady';

/**
 * The app, wrapped so a failure shows a message instead of vanishing.
 *
 * Two ways in: an error thrown while React renders (caught by the
 * boundary below), and an error thrown from anywhere else, which the
 * crash guard hands over.
 *
 * ## Why the game is not mounted on the first render
 *
 * It used to be. `<DiceDemoScreen />` rendered immediately with the title
 * card drawn on top, which meant the GL canvas, the physics world, the
 * audio players and four storage reads all ran before React could paint
 * anything at all. The title card therefore appeared AFTER the slow part
 * rather than during it — a loading screen that shows up once the loading
 * is over is doing nothing.
 *
 * Now the card renders alone, and the game is mounted a beat later, once
 * the card is actually on screen. The heavy work then happens underneath
 * it, which is the point of having one.
 *
 * ## The card is a loading screen, since 3 Nov 2026
 *
 * The family: "i want the speed fixes now. like make sure the game is
 * fully loaded before showing the home screen". The card used to lift
 * after a fixed 1.9 seconds, and the home screen then spent its first
 * minute painting dice in blocks that froze it. Now it lifts when the
 * game reports everything the home screen and its tabs need is ready
 * (src/game/launchReady.ts) — after at least LOADING_MIN_MS so it never
 * just flashes, and at the latest LOADING_CAP_MS, so a phone slower
 * than anything measured still gets its home screen.
 */
interface State {
  error: Error | null;
  /** The title card is up. */
  booting: boolean;
  /** The game is mounted — deliberately false on the first render. */
  loading: boolean;
}

export default class App extends React.Component<Record<string, never>, State> {
  state: State = { error: getLastFatal(), booting: true, loading: false };
  private stopListening?: () => void;
  private deferred?: { cancel: () => void };
  private fallback?: ReturnType<typeof setTimeout>;
  /**
   * The card has done its job: the game reported ready and the card has
   * had its minimum time, or the cap was reached.
   */
  private cardDone = false;
  private shownAt = Date.now();
  private stopLaunch?: () => void;
  private minTimer?: ReturnType<typeof setTimeout>;
  private capTimer?: ReturnType<typeof setTimeout>;

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidMount(): void {
    this.stopListening = onFatal((error) => this.setState({ error }));

    // The loading screen: lift when the game says it is ready, never
    // before the minimum, never later than the cap.
    this.shownAt = Date.now();
    this.stopLaunch = onLaunchChange(this.checkCard);
    this.minTimer = setTimeout(this.checkCard, LOADING_MIN_MS);
    this.capTimer = setTimeout(() => {
      // Whatever is still going carries on behind the home screen; the
      // board stops waiting for its pictures and mounts now.
      giveUpWaiting();
      this.checkCard();
    }, LOADING_CAP_MS);

    // runAfterInteractions waits for the current frame to settle, so the
    // title card is painted before any of the game's setup begins.
    this.deferred = InteractionManager.runAfterInteractions(() => this.startLoading());

    // Belt and braces: runAfterInteractions waits on a handle that a stray
    // animation can hold open, and a title card that never lifts is far
    // worse than one that lifts a moment early. This fires regardless.
    this.fallback = setTimeout(() => this.startLoading(), 900);
  }

  componentWillUnmount(): void {
    this.stopListening?.();
    this.stopLaunch?.();
    this.deferred?.cancel();
    if (this.fallback) clearTimeout(this.fallback);
    if (this.minTimer) clearTimeout(this.minTimer);
    if (this.capTimer) clearTimeout(this.capTimer);
  }

  /** Mount the game. Safe to call twice — whichever trigger wins, wins. */
  private startLoading = (): void => {
    if (this.fallback) {
      clearTimeout(this.fallback);
      this.fallback = undefined;
    }
    if (this.state.loading) return;
    this.setState({ loading: true }, this.revealIfReady);
  };

  componentDidCatch(error: Error): void {
    reportFatal(error);
  }

  /** Ready, minimum and cap: has the card done its job? */
  private checkCard = (): void => {
    if (this.cardDone) return;
    if (!shouldReveal(Date.now() - this.shownAt, launchReady())) return;
    this.cardDone = true;
    this.stopLaunch?.();
    this.revealIfReady();
  };

  /**
   * The card only lifts once it has had its time AND the game is mounted
   * behind it — otherwise a slow device would show an empty screen between
   * the two.
   */
  private revealIfReady = (): void => {
    if (this.cardDone && this.state.loading) this.setState({ booting: false });
  };

  render() {
    if (this.state.error) return <CrashScreen error={this.state.error} />;
    return (
      <>
        {/* Measures the screen's real safe edges, under everything, drawing
            nothing (safeInsets.tsx). First, so it has a figure before the
            game mounts. */}
        <SafeInsetsProbe />
        {this.state.loading && <DiceDemoScreen />}
        {this.state.booting && <BootSplash />}
        {/* Never in a release bundle: __DEV__ is false in every OTA update. */}
        {__DEV__ && <ScreenRuler />}
      </>
    );
  }
}
