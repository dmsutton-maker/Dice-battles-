import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, assertEqual, suite, test } from './harness';
import { TouchSample, flickFromGesture, isGraze, velocityFromSamples } from '../src/game/aim';
import { TUNING } from '../src/game/tuning';

/** PanResponder's shape, with only the fields the aim code reads. */
const gestureWith = (vx: number, vy: number) =>
  ({ vx, vy } as unknown as Parameters<typeof flickFromGesture>[0]);

/** A straight drag of `points` over `ms`, sampled every 16ms. */
function drag(points: number, ms: number, axis: 'x' | 'y' = 'y'): TouchSample[] {
  const samples: TouchSample[] = [];
  for (let t = 0; t <= ms; t += 16) {
    const travelled = (t / ms) * points;
    samples.push({
      x: axis === 'x' ? travelled : 0,
      y: axis === 'y' ? travelled : 0,
      t,
    });
  }
  return samples;
}

suite('aim · release velocity', () => {
  test('a steady drag reports the speed it was actually going', () => {
    // 180 points up over 300ms = 0.6 pt/ms.
    const v = velocityFromSamples(drag(-180, 300));
    assert(Math.abs(v.vy + 0.6) < 0.05, `expected about -0.6, got ${v.vy}`);
    assertEqual(v.vx, 0, 'a vertical drag should have no sideways speed');
  });

  test('a flick that ends after a pause still reads as a flick', () => {
    // THE BUG: finger moves fast, rests a moment, then lifts. PanResponder
    // averages that to almost nothing and the throw came out as a tap.
    const samples: TouchSample[] = [
      { x: 0, y: 400, t: 0 },
      { x: 0, y: 300, t: 40 },
      { x: 0, y: 200, t: 80 },
      { x: 0, y: 120, t: 120 },
      { x: 0, y: 40, t: 160 },
      // ...and now the finger rests before lifting.
      { x: 0, y: 38, t: 220 },
      { x: 0, y: 38, t: 280 },
    ];
    const wholeGestureAverage = (38 - 400) / 280; // ≈ -1.29, what RN reports
    const measured = velocityFromSamples(samples, 90);

    // Over the last 90ms the finger really did slow down, so the honest
    // answer is small — and the code keeps whichever is faster, so the
    // throw still carries the gesture rather than dying to a pause.
    const chosen = flickFromGesture(gestureWith(0, wholeGestureAverage), {
      velocity: measured,
    });
    assert(chosen !== null, 'a real flick was read as a tap');
  });

  test('the faster of the two readings is the one used', () => {
    const fast = { vx: 0, vy: -2 };
    const withMeasured = flickFromGesture(gestureWith(0, -0.01), {
      velocity: fast,
    });
    assert(withMeasured !== null, 'the measured flick was ignored');
    assert(withMeasured!.z < 0, 'a flick up the screen should throw away');
  });

  test('a slow drag is still a tap, not a flick', () => {
    const v = velocityFromSamples(drag(-10, 600));
    assert(
      Math.hypot(v.vx, v.vy) < TUNING.throw.flickThreshold,
      'a slow drag should not reach flick speed',
    );
    assertEqual(
      flickFromGesture(gestureWith(0, -0.01), { velocity: v }),
      null,
      'a slow drag was thrown as a flick',
    );
  });

  test('a stationary press cannot produce a throw direction', () => {
    const still: TouchSample[] = [
      { x: 5, y: 5, t: 0 },
      { x: 5, y: 5, t: 50 },
      { x: 5, y: 5, t: 100 },
    ];
    const v = velocityFromSamples(still);
    assertEqual(v.vx, 0, 'sideways');
    assertEqual(v.vy, 0, 'vertical');
  });

  test('a jitter-free single sample cannot divide by zero', () => {
    assertEqual(velocityFromSamples([]).vy, 0, 'no samples');
    assertEqual(velocityFromSamples([{ x: 0, y: 0, t: 5 }]).vy, 0, 'one sample');
    // Two samples with the same timestamp must not produce Infinity.
    const v = velocityFromSamples([
      { x: 0, y: 0, t: 7 },
      { x: 90, y: 0, t: 7 },
    ]);
    assert(Number.isFinite(v.vx) && v.vx === 0, `got ${v.vx}`);
  });

  test('the split-screen top zone throws the other way', () => {
    const velocity = { vx: 0, vy: -1.5 };
    const bottom = flickFromGesture(gestureWith(0, -1.5), { velocity });
    const top = flickFromGesture(gestureWith(0, -1.5), {
      velocity,
      rotated: true,
    });
    assert(bottom !== null && top !== null, 'both zones should throw');
    assert(
      Math.sign(bottom!.z) === -Math.sign(top!.z),
      'the rotated zone should throw the opposite way',
    );
  });

  test('a throw can never exceed the speed limit', () => {
    const wild = flickFromGesture(gestureWith(0, 0), {
      velocity: { vx: 999, vy: -999 },
    });
    assert(wild !== null, 'a hard flick should throw');
    assert(
      Math.abs(wild!.x) <= TUNING.throw.flickMaxSpeed &&
        Math.abs(wild!.z) <= TUNING.throw.flickMaxSpeed,
      `throw exceeded the limit: ${JSON.stringify(wild)}`,
    );
  });
});

/*
  A GRAZE IS NOT A THROW. Marc, 5 Nov 2026: "If someone swipes twice too
  fast and doesn't even really touch it the second time it automatically
  rolls the second time but it shouldn't." Two things made that happen:
  the scene queued a touch that arrived mid-roll and threw it by itself
  when the dice landed, and the screen threw for any release at all,
  however short and still. Both are pinned here.
*/
suite('aim · a graze is not a throw', () => {
  /** A finger down at (100, 400) for `ms`, wandering at most `px`. */
  const touch = (ms: number, px: number): TouchSample[] => [
    { x: 100, y: 400, t: 0 },
    { x: 100 + px, y: 400, t: ms / 2 },
    { x: 100 + px / 2, y: 400, t: ms },
  ];

  test('the bars are in tuning.ts, with a reason', () => {
    assertEqual(TUNING.throw.minTouchMs, 60, 'minTouchMs');
    assertEqual(TUNING.throw.minTouchPx, 6, 'minTouchPx');
    const tuning = readFileSync(join(__dirname, '..', 'src/game/tuning.ts'), 'utf8');
    const before = tuning.slice(0, tuning.indexOf('minTouchMs: 60'));
    assert(/5 Nov 2026/.test(before.slice(-1600)), 'the graze bars carry no reason');
  });

  test('a brush of the screen — short and still — is a graze', () => {
    assert(isGraze(touch(30, 2), 30), 'thirty milliseconds and two points was thrown');
    assert(isGraze(touch(59, 5), 59), 'just under both bars was thrown');
    assert(isGraze([], 10), 'a touch with no samples was thrown');
  });

  test('a quick flick travels, so it is thrown', () => {
    assert(!isGraze(touch(40, 30), 40), 'a 40 ms flick of 30 points was dropped');
    // The travel is the furthest any sample got, not where the finger ended.
    const outAndBack: TouchSample[] = [
      { x: 0, y: 0, t: 0 },
      { x: 0, y: -40, t: 20 },
      { x: 0, y: -2, t: 40 },
    ];
    assert(!isGraze(outAndBack, 40), 'a flick that came back to where it started was dropped');
  });

  test('a deliberate press stays put but lasts, so it is thrown', () => {
    assert(!isGraze(touch(120, 0), 120), 'a still 120 ms tap was dropped');
    assert(!isGraze(touch(60, 0), 60), 'a tap exactly at the bar was dropped');
  });

  test('the scene never throws for a touch that arrived mid-roll', () => {
    const scene = readFileSync(join(__dirname, '..', 'src/demo/DiceScene.tsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
    assert(!/queuedThrow/.test(scene), 'the queued throw is back');
    assert(!/launchRef/.test(scene), 'a launch is kept to fire after the settle');
    assert(!/setTimeout\([\s\S]{0,200}launch/.test(scene), 'something launches on a timer');
    assert(
      /if \(awaitingSettle\.current\) return 'ignored';/.test(scene),
      'a touch during a roll is not simply ignored',
    );
    const settle = scene.slice(scene.indexOf('onSettled(readFaces(diceBodies))'));
    assert(!/launch\(/.test(settle.slice(0, settle.indexOf('});'))), 'the settle launches a throw');
  });

  test('the screen drops a graze, except as the first tap of a round on an idle board', () => {
    const screen = readFileSync(join(__dirname, '..', 'src/demo/DiceDemoScreen.tsx'), 'utf8');
    const release = screen.slice(
      screen.indexOf('onPanResponderRelease: (event, gesture) => {'),
      screen.indexOf('onStartShouldSetPanResponder: () => previewRef.current === null') > 0
        ? screen.indexOf(').current;', screen.indexOf('onPanResponderRelease'))
        : screen.length,
    );
    assert(
      /const deliberateTap = !rollingRef\.current && throwsThisRoundRef\.current === 0;/.test(release),
      'the first tap of a round on an idle board is not spared',
    );
    assert(
      /if \(!deliberateTap && isGraze\(samples\.current, event\.nativeEvent\.timestamp - touchedAt\.current\)\) \{\s*samples\.current = \[\];\s*return;/.test(
        release,
      ),
      'a graze is still thrown',
    );
    assert(/touchedAt\.current = event\.nativeEvent\.timestamp;/.test(screen), 'the touch has no start time');
    assert(/throwsThisRoundRef\.current \+= 1;/.test(screen), 'throws are not counted per round');
    assert(/throwsThisRoundRef\.current = 0;/.test(screen), 'the count never starts again');
    // And a real tap still rolls: the slow-gesture path is unchanged.
    assert(/flickFromGesture\(gesture, \{ velocity \}\) \?\? undefined/.test(release), 'a tap no longer rolls');
  });
});
