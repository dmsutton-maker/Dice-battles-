import * as THREE from 'three';
import { ARENAS, ArenaId } from '../src/arena/arenas';
import { createSkyGradient } from '../src/arena/skyGradient';
import { assert, assertEqual, note, suite, test } from './harness';

/**
 * The arenas, and specifically the thing that made Sunset Castle read as
 * the day castle repainted: lighting used to be identical for all of them.
 */

/** Elevation of a light above the horizon, in degrees. */
function elevation(position: [number, number, number]): number {
  const [x, y, z] = position;
  return (Math.atan2(y, Math.hypot(x, z)) * 180) / Math.PI;
}

/** How warm a colour is: red channel minus blue, in 0..1. */
function warmth(hex: string): number {
  const c = new THREE.Color(hex);
  return c.r - c.b;
}

suite('arena · every arena is lit deliberately', () => {
  test('every arena declares lighting', () => {
    for (const id of Object.keys(ARENAS) as ArenaId[]) {
      const lighting = ARENAS[id].lighting;
      assert(lighting !== undefined, `${id} has no lighting`);
      assert(lighting.key.intensity > 0, `${id} has no key light`);
    }
  });

  test('the sunset sun is low where the day sun is high', () => {
    const day = elevation(ARENAS.castle.lighting.key.position);
    const dusk = elevation(ARENAS.castleSunset.lighting.key.position);
    note(`sun elevation — day ${day.toFixed(0)}°, sunset ${dusk.toFixed(0)}°`);
    assert(day > 45, `the day sun should be high overhead, it is at ${day.toFixed(0)}°`);
    assert(dusk < 20, `the sunset sun should be near the horizon, it is at ${dusk.toFixed(0)}°`);
  });

  test('the sunset key light is warm and its fill is cool', () => {
    const { key, fill } = ARENAS.castleSunset.lighting;
    // A low sun that is still white is just a lamp on the floor. The warm
    // key against a cool fill is what separates dusk from midday.
    assert(warmth(key.color) > 0.3, 'the sunset key light is not warm');
    assert(warmth(fill.color) < 0, 'the sunset fill should be cool skylight');
    assert(
      warmth(key.color) > warmth(ARENAS.castle.lighting.key.color),
      'the sunset sun is no warmer than the midday one',
    );
  });

  test('sunset is dimmer overall than midday', () => {
    const total = (id: ArenaId) => {
      const l = ARENAS[id].lighting;
      return l.hemisphere.intensity + l.key.intensity + l.fill.intensity;
    };
    assert(
      total('castleSunset') < total('castle'),
      'evening should be darker than midday, not just oranger',
    );
  });
});

suite('arena · the sky gradient runs the right way up', () => {
  const HORIZON = '#ffd27a';
  const ZENITH = '#2e2050';
  const texture = createSkyGradient([HORIZON, '#e2557f', ZENITH]);
  const { data, width, height } = texture.image as {
    data: Uint8Array;
    width: number;
    height: number;
  };

  /** The stored bytes of a row, which are sRGB-encoded. */
  const rowBytes = (y: number): [number, number, number] => {
    const i = y * width * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };

  /** What a stop colour should look like once stored: sRGB bytes. */
  const expectedBytes = (hex: string): [number, number, number] => {
    const c = new THREE.Color(hex).convertLinearToSRGB();
    return [
      Math.round(c.r * 255),
      Math.round(c.g * 255),
      Math.round(c.b * 255),
    ];
  };

  test('row 0 is the horizon and the last row is the zenith', () => {
    // DataTexture does not flip like a loaded image, so v=0 is row 0. Get
    // this backwards and the sky renders upside down — deep night sitting
    // on the ground with the hot band overhead.
    assertEqual(rowBytes(0).join(','), expectedBytes(HORIZON).join(','), 'horizon row');
    assertEqual(
      rowBytes(height - 1).join(','),
      expectedBytes(ZENITH).join(','),
      'zenith row',
    );
  });

  test('flipY is off, which is what makes that row order true', () => {
    assertEqual(texture.flipY, false, 'flipY');
  });

  test('it gets darker going up, with no banding jumps', () => {
    const luma = (y: number) => {
      const i = y * width * 4;
      return 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    };
    assert(luma(0) > luma(height - 1), 'the horizon should be brighter than the zenith');
    let biggest = 0;
    for (let y = 1; y < height; y++) biggest = Math.max(biggest, Math.abs(luma(y) - luma(y - 1)));
    note(`biggest step between sky rows: ${biggest.toFixed(1)}/255`);
    assert(biggest < 20, `the gradient bands — ${biggest.toFixed(1)} jump between rows`);
  });

  test('every row is fully opaque', () => {
    for (let y = 0; y < height; y++) {
      assertEqual(data[y * width * 4 + 3], 255, `row ${y} alpha`);
    }
  });
});
