import { registerRootComponent } from 'expo';
import type { ComponentType } from 'react';
import { installCrashGuard, reportFatal } from './src/debug/crashGuard';

/**
 * The very first thing that runs.
 *
 * The crash guard is installed BEFORE the app is loaded, and the app is
 * loaded with `require` inside a try/catch rather than a top-level
 * import, so that a failure while a module is being set up is caught
 * too. A static import would run before this file's own code and take
 * the process down before anything could report it.
 */
installCrashGuard();

let Root: ComponentType;
try {
  Root = require('./App').default;
} catch (error) {
  reportFatal(error);
  // The app could not even be loaded; show the reason on its own.
  Root = require('./src/debug/CrashScreen').CrashRoot;
}

registerRootComponent(Root);
