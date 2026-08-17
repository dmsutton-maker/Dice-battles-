import React from 'react';
import { CrashScreen } from './src/debug/CrashScreen';
import { getLastFatal, onFatal, reportFatal } from './src/debug/crashGuard';
import { DiceDemoScreen } from './src/demo/DiceDemoScreen';

/**
 * The app, wrapped so a failure shows a message instead of vanishing.
 *
 * Two ways in: an error thrown while React renders (caught by the
 * boundary below), and an error thrown from anywhere else, which the
 * crash guard hands over.
 */
interface State {
  error: Error | null;
}

export default class App extends React.Component<Record<string, never>, State> {
  state: State = { error: getLastFatal() };
  private stopListening?: () => void;

  static getDerivedStateFromError(error: Error): State {
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
    return <DiceDemoScreen />;
  }
}
