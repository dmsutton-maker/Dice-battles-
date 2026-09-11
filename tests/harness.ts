/**
 * A tiny test harness (no jest — the React Native preset fights with
 * cannon/three in node, and everything worth testing here is pure logic or
 * headless physics). Run with `npm test`.
 */
interface Failure {
  suite: string;
  name: string;
  error: string;
}

const failures: Failure[] = [];
let passed = 0;
let currentSuite = 'general';
const pending: { suite: string; name: string; fn: () => void | Promise<void> }[] =
  [];

export function suite(name: string, body: () => void): void {
  const previous = currentSuite;
  currentSuite = name;
  body();
  currentSuite = previous;
}

export function test(name: string, fn: () => void | Promise<void>): void {
  pending.push({ suite: currentSuite, name, fn });
}

export function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

export function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message} — expected ${String(expected)}, got ${String(actual)}`);
  }
}

/** Asserts a measured value sits within budget, and reports the number. */
export function assertAtMost(
  actual: number,
  limit: number,
  message: string,
): void {
  if (!(actual <= limit)) {
    throw new Error(`${message} — ${actual.toFixed(2)} exceeds limit ${limit}`);
  }
}

export function assertClose(
  actual: number,
  expected: number,
  tolerance: number,
  message: string,
): void {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(
      `${message} — expected ${expected} ±${tolerance}, got ${actual}`,
    );
  }
}

/** Notes a measured number in the output without asserting anything. */
const notes: string[] = [];
export function note(message: string): void {
  notes.push(message);
}

export async function runAll(): Promise<number> {
  const started = Date.now();
  let lastSuite = '';
  for (const item of pending) {
    if (item.suite !== lastSuite) {
      lastSuite = item.suite;
      console.log(`\n  ${item.suite}`);
    }
    try {
      await item.fn();
      passed++;
      console.log(`    ✓ ${item.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ suite: item.suite, name: item.name, error: message });
      console.log(`    ✗ ${item.name}`);
      console.log(`      ${message}`);
    }
  }

  if (notes.length) {
    console.log('\n  measurements');
    notes.forEach((n) => console.log(`    · ${n}`));
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `\n${failures.length === 0 ? '✅' : '❌'} ${passed} passed, ${failures.length} failed (${seconds}s)\n`,
  );
  if (failures.length) {
    failures.forEach((f) => console.log(`  ✗ ${f.suite} › ${f.name}\n    ${f.error}`));
    console.log('');
  }
  return failures.length === 0 ? 0 : 1;
}
