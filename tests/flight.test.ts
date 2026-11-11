import {
  DIE_TOP,
  FLIGHT_APEX,
  flightAt,
  isOverTray,
  lowestOverTray,
  peakOf,
  type FlightPoint,
} from '../src/game/flight';
import { JAIL_SLOTS, RETREAT_SLOTS } from '../src/game/stations';
import { assert, suite, test } from './harness';

const jail: FlightPoint = JAIL_SLOTS[2];
const retreat: FlightPoint = RETREAT_SLOTS[2];

/** Positions are floating point — sin(PI) is not quite zero. */
function assertAt(actual: FlightPoint, expected: FlightPoint, what: string): void {
  (['x', 'y', 'z'] as const).forEach((axis) => {
    const drift = Math.abs(actual[axis] - expected[axis]);
    assert(
      drift < 1e-9,
      `${what}: ${axis} was ${actual[axis]}, expected ${expected[axis]}`,
    );
  });
}

suite('prisoner flight · clearing the dice', () => {
  test('a rescue leap passes well above the dice', () => {
    const lowest = lowestOverTray(jail, retreat);
    assert(
      lowest > DIE_TOP,
      `figure dipped to ${lowest.toFixed(2)} over the tray, dice reach ${DIE_TOP}`,
    );
  });

  test('a back-to-jail leap passes well above the dice', () => {
    const lowest = lowestOverTray(retreat, jail);
    assert(
      lowest > DIE_TOP,
      `figure dipped to ${lowest.toFixed(2)} over the tray, dice reach ${DIE_TOP}`,
    );
  });
});

suite('prisoner flight · interrupted mid-air', () => {
  /**
   * Ultimate mode sends a rescued prisoner back to jail the moment its
   * colour is matched again — which can happen while it is still in the
   * air from being rescued. The second leap starts from wherever the
   * figure is, and must not stack a fresh arc on top of that height.
   */
  test('a leap interrupted at its peak does not rocket upward', () => {
    const midAir = flightAt(jail, retreat, 0.5);
    const peak = peakOf(midAir, jail);
    assert(
      peak <= FLIGHT_APEX + 0.001,
      `interrupted leap peaked at ${peak.toFixed(2)}, above the ${FLIGHT_APEX} apex`,
    );
  });

  test('no interruption at any moment can beat an ordinary leap', () => {
    const ordinaryPeak = peakOf(jail, retreat);
    for (let i = 1; i < 20; i++) {
      const midAir = flightAt(jail, retreat, i / 20);
      const peak = peakOf(midAir, jail);
      assert(
        peak <= Math.max(ordinaryPeak, FLIGHT_APEX) + 0.001,
        `interrupting at t=${(i / 20).toFixed(2)} peaked at ${peak.toFixed(2)}`,
      );
    }
  });

  test('an interrupted leap still clears the dice', () => {
    for (let i = 1; i < 20; i++) {
      const midAir = flightAt(jail, retreat, i / 20);
      const lowest = lowestOverTray(midAir, jail);
      assert(
        lowest > DIE_TOP,
        `interrupting at t=${(i / 20).toFixed(2)} dipped to ${lowest.toFixed(2)}`,
      );
    }
  });
});

suite('prisoner flight · a clock that misbehaves', () => {
  /**
   * The render clock is not ours: a backgrounded app or a re-mounted
   * canvas can hand the animation a negative or enormous t. Unclamped,
   * the smoothstep turns that into a figure flung outside the arena.
   */
  test('a negative t sits the figure at the start, not off the map', () => {
    assertAt(flightAt(jail, retreat, -12), jail, 'a wildly negative t');
  });

  test('a t past the end sits the figure at the destination', () => {
    assertAt(flightAt(jail, retreat, 40), retreat, 'a t long past the end');
  });
});

suite('prisoner flight · the tray test itself', () => {
  test('knows the middle of the board is over the tray', () => {
    assert(isOverTray({ x: 0, y: 0.5, z: 0 }), 'centre should be over the tray');
  });

  test('knows the jail and the retreat are not', () => {
    assert(!isOverTray(jail), 'the jail sits behind the far wall');
    assert(!isOverTray(retreat), 'the retreat sits past the near wall');
  });
});
