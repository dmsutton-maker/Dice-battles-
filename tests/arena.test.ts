import { readFileSync } from 'node:fs';
import {
  clearJungleFloorCacheForTests,
  jungleFloorPixels,
  JUNGLE_FLOOR_SIZE,
} from '../src/arena/jungleFloorTexture';
import { join } from 'node:path';
import * as THREE from 'three';
import { ARENAS, ArenaId } from '../src/arena/arenas';
import { createSkyGradient } from '../src/arena/skyGradient';
import { OBSTACLE_LOOKS, obstacleLook } from '../src/arena/obstacleLooks';
import { MOAT, MOUND, obstacleHint } from '../src/game/obstacles';
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

suite('split screen · difficulty reaches both players', () => {
  const root = join(__dirname, '..');
  const source = readFileSync(join(root, 'src/demo/TwoPlayerScreen.tsx'), 'utf8');
  const parent = readFileSync(join(root, 'src/demo/DiceDemoScreen.tsx'), 'utf8');

  test('split screen no longer hard-codes an empty courtyard', () => {
    // It used to pass EMPTY_LAYOUT, so picking Hard and handing the phone
    // over silently put both players back on Easy.
    assert(
      !source.includes('EMPTY_LAYOUT'),
      'TwoPlayerScreen still forces an empty courtyard',
    );
    assert(
      source.includes('generateObstacleLayout(difficulty)'),
      'the obstacles are not generated from the chosen difficulty',
    );
  });

  test('the parent passes the chosen difficulty through', () => {
    assert(
      /<TwoPlayerScreen[\s\S]{0,400}?difficulty=\{difficulty\}/.test(parent),
      'DiceDemoScreen does not hand its difficulty to split screen',
    );
  });

  test('both zones roll on ONE layout, not one each', () => {
    // generateObstacleLayout randomises positions, so a call per zone would
    // give each player a different courtyard — on Hard, a pond in a
    // different place. That is not variety, it is an unfair match.
    // Exactly one place holds the layout (the initial state) and one place
    // refreshes it (the rematch) — never one per zone.
    const calls = source.match(/generateObstacleLayout\(/g) ?? [];
    assertEqual(calls.length, 2, 'generateObstacleLayout call sites');

    const zones = [...source.matchAll(/<ZoneView[\s\S]*?\/>/g)].map(([tag]) => tag);
    assertEqual(zones.length, 2, 'there should be exactly two zones');
    for (const [i, zone] of zones.entries()) {
      assert(
        zone.includes('layout={layout}'),
        `zone ${i} is not given the shared layout`,
      );
    }
  });

  test('a rematch rebuilds the physics world around the new obstacles', () => {
    // DiceScene builds its world once per mount. Without a changing key the
    // dice would collide with the previous match's hill while the new one
    // is drawn somewhere else.
    assert(
      source.includes('key={matchKey}'),
      'DiceScene is not keyed, so the physics world would go stale',
    );
    assert(
      /setMatchKey\(\(n\) => n \+ 1\)/.test(source),
      'matchKey never changes, so the key does nothing',
    );
    const start = source.indexOf('const startMatch');
    const body = source.slice(start, start + 900);
    assert(
      body.includes('setLayout(generateObstacleLayout(difficulty))'),
      'a rematch does not roll fresh obstacles',
    );
  });
});

suite('arena · the jungle rolls on ground, not on the castle floor', () => {
  /**
   * The jungle used to use `createFlagstoneTexture` tinted green — the
   * castle's laid slabs, grout and all. That is the surface the camera is
   * centred on and the dice come to rest on, so it was doing more than
   * anything else in the arena to make the jungle look like the castle
   * repainted.
   */
  const floor = jungleFloorPixels();
  const S = JUNGLE_FLOOR_SIZE;
  const at = (x: number, y: number) => {
    const i = ((y % S) * S + (x % S)) * 3;
    return [floor[i], floor[i + 1], floor[i + 2]];
  };

  test('the arena asks for the forest floor and not the flagstone', () => {
    const source = readFileSync('src/arena/JungleArena.tsx', 'utf8');
    assert(
      source.includes('createJungleFloorTexture'),
      'the jungle is not using the forest floor',
    );
    assert(
      !source.includes('createFlagstoneTexture'),
      'the jungle is still laying the castle flagstones',
    );
  });

  test('it has no grid ruled through it', () => {
    // A flagstone floor has grout: whole rows and columns that are darker
    // than everything around them. That is exactly the regularity a forest
    // floor must not have, and it is measurable without looking.
    const rowMean = (y: number) => {
      let sum = 0;
      for (let x = 0; x < S; x++) sum += at(x, y)[0] + at(x, y)[1] + at(x, y)[2];
      return sum / (S * 3);
    };
    const means = Array.from({ length: S }, (_, y) => rowMean(y));
    const avg = means.reduce((a, b) => a + b, 0) / means.length;
    // How far the darkest row falls below the average. Grout lines drop a
    // long way; earth and moss drift.
    const darkest = Math.min(...means);
    const drop = ((avg - darkest) / avg) * 100;
    note(`jungle floor: darkest row sits ${drop.toFixed(1)}% below average`);
    assert(drop < 22, `a row ${drop.toFixed(0)}% darker than its neighbours is a grout line`);
  });

  test('it tiles without a seam', () => {
    // The floor repeats several times across the tray, so an edge that
    // does not meet its opposite draws a straight line across the clearing
    // — the very grid this replaced.
    const step = (a: number[], b: number[]) =>
      Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

    // The bound is the texture's OWN worst internal step, not a number
    // chosen to fit. A leaf edge is a big jump wherever it falls, and one
    // landing on the boundary is a correctly tiling texture, not a seam —
    // so the question is only whether the wrap is worse than the picture.
    let worstInside = 0;
    for (let y = 0; y < S; y++) {
      for (let x = 1; x < S; x++) worstInside = Math.max(worstInside, step(at(x, y), at(x - 1, y)));
    }

    let worstWrap = 0;
    for (let i = 0; i < S; i++) {
      worstWrap = Math.max(worstWrap, step(at(0, i), at(S - 1, i)));
      worstWrap = Math.max(worstWrap, step(at(i, 0), at(i, S - 1)));
    }

    note(`jungle floor: worst wrap step ${worstWrap} against ${worstInside} inside the tile`);
    assert(
      worstWrap <= worstInside,
      `the floor meets itself worse than it meets anything inside — ${worstWrap} vs ${worstInside}`,
    );
  });

  test('it is the same floor every launch', () => {
    // The flagstone it replaced used Math.random, so it was different on
    // every build and could not be checked at all.
    const again = jungleFloorPixels();
    assertEqual(
      floor.join(',') === again.join(','),
      true,
      'the jungle floor changes between builds',
    );
  });

  test('it is earth and moss, not one flat colour', () => {
    const greens = new Set<number>();
    for (let i = 1; i < floor.length; i += 3) greens.add(floor[i]);
    note(`jungle floor: ${greens.size} distinct green levels`);
    assert(greens.size > 40, 'the forest floor is flat');
  });
});

suite('arena · switching battlefields does not repaint the world', () => {
  /**
   * Why the previous arena stayed on screen for a moment after tapping a
   * new one. Every procedural texture is painted pixel by pixel in
   * JavaScript — React Native has no canvas — and each arena built its own
   * inside `useMemo`, which caches only for the life of one component
   * instance. Every switch blocked the JavaScript thread long enough for
   * the old frame to sit there, and returning to an arena already viewed
   * paid the entire cost over again.
   */
  test('the jungle floor is painted once, however many times it is asked for', () => {
    clearJungleFloorCacheForTests();

    const first = process.hrtime.bigint();
    jungleFloorPixels();
    const paintMs = Number(process.hrtime.bigint() - first) / 1e6;

    const second = process.hrtime.bigint();
    for (let i = 0; i < 20; i++) jungleFloorPixels();
    const cachedMs = Number(process.hrtime.bigint() - second) / 1e6;

    note(`jungle floor: ${paintMs.toFixed(0)}ms to paint, ${cachedMs.toFixed(2)}ms for 20 more`);
    // The painting is real work — this is not a test that passes because
    // the function is cheap.
    assert(paintMs > 3, `the floor painted in ${paintMs.toFixed(1)}ms — is it still being painted?`);
    assert(
      cachedMs < paintMs,
      `twenty cached reads cost ${cachedMs.toFixed(1)}ms against ${paintMs.toFixed(1)}ms to paint one`,
    );
  });

  test('the same bytes come back every time', () => {
    // A cache that returned something different would be worse than none.
    clearJungleFloorCacheForTests();
    const a = jungleFloorPixels();
    const b = jungleFloorPixels();
    assertEqual(a === b, true, 'the cache handed back a different array');
  });

  test('every arena builds its floor through the cache', () => {
    // The cache only helps for textures that actually go through it, and
    // a new arena added later would silently miss it.
    for (const file of ['CastleArena.tsx', 'JungleArena.tsx', 'SpaceArena.tsx']) {
      const source = readFileSync(join('src', 'arena', file), 'utf8');
      const builds = [...source.matchAll(/create(FlagstoneTexture|JungleFloorTexture|SkyGradient)\(/g)];
      assert(builds.length > 0, `${file} builds no texture at all`);
      assert(
        source.includes('cachedTexture('),
        `${file} paints a texture on every mount instead of going through the cache`,
      );
    }
  });

  test('two textures from the same painting do not collide in the cache', () => {
    // The jungle asks for two: the tray floor and the clearing around it,
    // painted from the same bytes but repeated differently. One cache key
    // for both would hand the clearing's repeat to the tray floor.
    const source = readFileSync(join('src', 'arena', 'JungleArena.tsx'), 'utf8');
    const keys = [...source.matchAll(/cachedTexture\('([^']+)'/g)].map((m) => m[1]);
    assertEqual(new Set(keys).size, keys.length, `the jungle reuses a cache key: ${keys.join(', ')}`);
  });
});

suite('arena · the hazards belong to the battlefield', () => {
  /**
   * Both hazards used to be drawn identically everywhere: a green grassy
   * sphere and a blue pool inside a square of cut kerbstone. That is a
   * castle lawn and a castle moat, and it was being placed in a rainforest
   * and on an orbiting station alike — a grass hill on a space station, as
   * David put it.
   */
  test('every arena dresses its own hazards', () => {
    const ids = Object.keys(ARENAS) as ArenaId[];
    for (const id of ids) {
      assert(OBSTACLE_LOOKS[id] !== undefined, `${id} has no hazard dressing`);
    }
    assertEqual(
      Object.keys(OBSTACLE_LOOKS).length,
      ids.length,
      'the hazard dressings and the arenas have drifted apart',
    );
  });

  test('the jungle has a lake, not a swimming pool', () => {
    // The giveaway was a square of cut stone running round the water.
    const jungle = obstacleLook('jungle');
    assertEqual(jungle.pit.border?.kind, 'bank', 'the jungle lake still has a cut kerb round it');
    assertEqual(jungle.words.pit, 'lake', 'the jungle still calls it a pond');
  });

  test('the space station has no grass and no water', () => {
    const space = obstacleLook('space');
    // Green grass on a station is the thing David actually pointed at.
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(space.mound.color.slice(i, i + 2), 16));
    assert(
      !(g > r + 20 && g > b + 20),
      `the station's bump is still green (${space.mound.color})`,
    );
    assert(space.mound.metalness > 0.3, 'the station bump is not metal');
    // And what it falls into is a drop, not a pond.
    assert(space.pit.surfaceOpacity < 0.4, 'the hatch still has a liquid surface');
    assert(!/pond|lake|water/i.test(space.words.sink), `station callout says "${space.words.sink}"`);
  });

  test('the words follow the picture', () => {
    // A hint telling somebody on the station to watch out for the pond
    // describes a different game from the one on their screen.
    for (const id of Object.keys(OBSTACLE_LOOKS) as ArenaId[]) {
      const look = obstacleLook(id);
      const hard = obstacleHint('hard', look.words);
      assert(hard.includes(look.words.pit), `${id}: the Hard hint does not name its own hazard`);
      assert(hard.includes(look.words.mound), `${id}: the Hard hint does not name its own bump`);
      const medium = obstacleHint('medium', look.words);
      assert(medium.includes(look.words.mound), `${id}: the Medium hint names the wrong bump`);
      assert(
        !medium.includes(look.words.pit) || look.words.pit === look.words.mound,
        `${id}: Medium mentions a hazard that only Hard has`,
      );
    }
  });

  test('dressing a hazard never changes the difficulty', () => {
    // The whole point. If a hazard behaved differently by arena, picking a
    // battlefield would secretly be picking a difficulty — and the Store
    // sells battlefields.
    const sizes = new Set<string>();
    for (const id of Object.keys(OBSTACLE_LOOKS) as ArenaId[]) {
      const look = obstacleLook(id);
      // Nothing in the dressing may carry a dimension. Colours, opacity
      // and roughness are all it is allowed to say.
      const fields = JSON.stringify(look);
      sizes.add(fields.replace(/"#[0-9a-f]{6}"/gi, '"C"'));
      assert(
        !('radius' in look.mound) && !('size' in look.pit) && !('depth' in look.pit),
        `${id}'s dressing carries a dimension — that would change the physics`,
      );
    }
    // MOUND and MOAT stay the single source of the shapes.
    assert(MOUND.radius > 0 && MOAT.size > 0, 'the hazard dimensions have moved');
  });
});
