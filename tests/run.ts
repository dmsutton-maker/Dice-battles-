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
  await import('./currency.test');
  await import('./audio.test');
  await import('./bugReport.test');
  await import('./flight.test');
  await import('./matchmaking.test');
  await import('./colorblind.test');
  await import('./splitRules.test');
  await import('./aim.test');
  await import('./tournament.test');
  await import('./preview.test');
  await import('./arena.test');
  await import('./layout.test');
  await import('./popupLayout.test');
  process.exit(await runAll());
}

main();
