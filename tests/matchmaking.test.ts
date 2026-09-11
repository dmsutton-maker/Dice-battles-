import { assert, test } from './harness';
import {
  DOT_TICK_MS,
  MATCH_TOTAL_MS,
  REVEAL_MS,
  SCAN_MS,
  SCAN_TICK_MS,
  dotsAt,
  isComplete,
  scanIndexAt,
  stageAt,
} from '../src/game/matchmaking';

test('the whole beat is a couple of seconds', () => {
  assert(
    MATCH_TOTAL_MS === SCAN_MS + REVEAL_MS,
    `total ${MATCH_TOTAL_MS} should be scan + reveal`,
  );
  assert(
    MATCH_TOTAL_MS >= 1500 && MATCH_TOTAL_MS <= 3000,
    `a "couple of seconds" should be 1.5-3s, got ${MATCH_TOTAL_MS}ms`,
  );
});

test('scanning gives way to the reveal, and the reveal is held', () => {
  assert(stageAt(0) === 'scanning', 'starts scanning');
  assert(stageAt(SCAN_MS - 1) === 'scanning', 'still scanning just before');
  assert(stageAt(SCAN_MS) === 'found', 'revealed exactly on time');
  assert(stageAt(MATCH_TOTAL_MS) === 'found', 'still revealed at the end');
  assert(
    REVEAL_MS >= 500,
    `the rival must be readable, got ${REVEAL_MS}ms on screen`,
  );
});

test('the reveal is on screen before the round can start', () => {
  assert(!isComplete(0), 'not complete at the start');
  assert(!isComplete(SCAN_MS), 'not complete the instant the name lands');
  assert(!isComplete(MATCH_TOTAL_MS - 1), 'not complete just before the end');
  assert(isComplete(MATCH_TOTAL_MS), 'complete at the end');
  assert(isComplete(MATCH_TOTAL_MS + 5000), 'stays complete if a frame is late');
});

test('names shuffle, and wrap around a short roster', () => {
  assert(scanIndexAt(0, 8) === 0, 'first name at t=0');
  assert(scanIndexAt(SCAN_TICK_MS, 8) === 1, 'second name one tick in');
  assert(scanIndexAt(SCAN_TICK_MS * 8, 8) === 0, 'wraps after a full pass');
  assert(scanIndexAt(SCAN_TICK_MS * 9, 8) === 1, 'keeps cycling past the wrap');
});

test('the scan actually moves — several names before the reveal', () => {
  const seen = new Set<number>();
  for (let t = 0; t < SCAN_MS; t += 10) seen.add(scanIndexAt(t, 8));
  assert(seen.size >= 4, `expected a visible shuffle, saw ${seen.size} names`);
});

test('an empty roster cannot index out of bounds', () => {
  assert(scanIndexAt(500, 0) === 0, 'empty roster returns 0');
  assert(scanIndexAt(-500, 8) === 0, 'a negative clock returns 0');
});

test('the dots cycle one to three and never grow', () => {
  assert(dotsAt(0) === '.', 'one dot at the start');
  assert(dotsAt(DOT_TICK_MS) === '..', 'two dots');
  assert(dotsAt(DOT_TICK_MS * 2) === '...', 'three dots');
  assert(dotsAt(DOT_TICK_MS * 3) === '.', 'back to one');
  for (let t = 0; t < 10000; t += 37) {
    const n = dotsAt(t).length;
    assert(n >= 1 && n <= 3, `dots ran to ${n} at t=${t}`);
  }
});
