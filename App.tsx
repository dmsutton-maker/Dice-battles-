import React from 'react';
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
 */
interface State {
  error: Error | null;
  /** The title card is up; the game is mounted behind it either way. */
  booting: boolean;
}

export default class App extends React.Component<Record<string, never>, State> {
  state: State = { error: getLastFatal(), booting: true };
  private stopListening?: () => void;

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidMount(): void {
    this.stopListening = onFatal((error) => this.setState({ error }));
  }

  componentWillUnmount(): void {
    this.stopListening?.();
  }

  componentDidCatch(error: Error): void {
    reportFatal(error);
  }

  render() {
    if (this.state.error) return <CrashScreen error={this.state.error} />;
    // The game mounts underneath the title card rather than after it, so
    // the first frame is ready by the time the card clears.
    return (
      <>
        <DiceDemoScreen />
        {this.state.booting && (
          <BootSplash onDone={() => this.setState({ booting: false })} />
        )}
      </>
    );
  }
}
