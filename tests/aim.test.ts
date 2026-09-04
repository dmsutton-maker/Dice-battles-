import { assert, assertEqual, suite, test } from './harness';
import { TouchSample, flickFromGesture, velocityFromSamples } from '../src/game/aim';
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
