import { runAll } from './harness';

/**
 * Test entry point: `npm test`.
 *
 * Suites are imported for their side effect of registering tests, then run
 * in one pass so a single non-zero exit code reports the whole suite.
 */
async function main(): Promise<void> {
  await import('./physics.test');
  await import('./game.test');
  await import('./screen.test');
  await import('./persistence.test');
  process.exit(await runAll());
}

main();
