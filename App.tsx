import React from 'react';
import { InteractionManager } from 'react-native';
import { CrashScreen } from './src/debug/CrashScreen';
import { getLastFatal, onFatal, reportFatal } from './src/debug/crashGuard';
import { DiceDemoScreen } from './src/demo/DiceDemoScreen';
import { BootSplash } from './src/demo/BootSplash';

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
  /** The card has had its minimum time on screen. */
  private cardDone = false;

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidMount(): void {
    this.stopListening = onFatal((error) => this.setState({ error }));

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
    this.deferred?.cancel();
    if (this.fallback) clearTimeout(this.fallback);
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

  /** The card times out. */
  private onCardDone = (): void => {
    this.cardDone = true;
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
        {this.state.loading && <DiceDemoScreen />}
        {this.state.booting && <BootSplash onDone={this.onCardDone} />}
      </>
    );
  }
}
