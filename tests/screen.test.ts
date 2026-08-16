import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { ARENAS, ArenaId } from '../src/arena/arenas';
import { TIERS, UnlockId } from '../src/game/progress';
import {
  JAIL_SLOTS,
  RETREAT_POST_XS,
  RETREAT_SLOTS,
  WALL_SLOTS,
} from '../src/game/stations';
import { TUNING } from '../src/game/tuning';
import { cameraBase, fitCamera } from '../src/demo/cameraFit';
import { assert, assertAtMost, note, suite, test } from './harness';

/**
 * Everything about what actually reaches the screen: the arena registry,
 * the camera framing on real device shapes, and the asset/licensing files
 * the app loads at runtime.
 */

/** Real device aspect ratios (width / height) the game has to fit. */
const DEVICES: { name: string; aspect: number }[] = [
  { name: 'iPhone SE', aspect: 375 / 667 },
  { name: 'iPhone 15', aspect: 393 / 852 },
  { name: 'iPhone 15 Pro Max', aspect: 430 / 932 },
  { name: 'iPad 10.9"', aspect: 820 / 1180 },
  { name: 'iPad landscape-ish', aspect: 1024 / 768 },
];

suite('screen · camera framing', () => {
  test('the whole battlefield fits every device shape', () => {
    for (const device of DEVICES) {
      const camera = new THREE.PerspectiveCamera(50, device.aspect, 0.1, 200);
      fitCamera(camera, device.aspect);

      // Everything a player must see: the playfield, the jail they are
      // emptying, and the retreat their rescued figures run to.
      const mustSee: THREE.Vector3[] = [
        ...JAIL_SLOTS.map((s) => new THREE.Vector3(s.x, s.y + 0.9, s.z)),
        ...RETREAT_SLOTS.map((s) => new THREE.Vector3(s.x, s.y + 0.9, s.z)),
        ...WALL_SLOTS.map((s) => new THREE.Vector3(s.x, s.y + 0.6, s.z)),
        new THREE.Vector3(-TUNING.tray.innerWidth / 2, 0, -TUNING.tray.innerDepth / 2),
        new THREE.Vector3(TUNING.tray.innerWidth / 2, 0, -TUNING.tray.innerDepth / 2),
        new THREE.Vector3(-TUNING.tray.innerWidth / 2, 0, TUNING.tray.innerDepth / 2),
        new THREE.Vector3(TUNING.tray.innerWidth / 2, 0, TUNING.tray.innerDepth / 2),
      ];

      for (const point of mustSee) {
        const ndc = point.clone().project(camera);
        assert(
          Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1,
          `${device.name}: point (${point.x.toFixed(1)}, ${point.z.toFixed(1)}) is off screen at ndc (${ndc.x.toFixed(2)}, ${ndc.y.toFixed(2)})`,
        );
      }
      note(`${device.name}: camera pulls back to ${camera.position.z.toFixed(1)}z`);
    }
  });

  test('a die at full height stays in frame', () => {
    for (const device of DEVICES) {
      const camera = new THREE.PerspectiveCamera(50, device.aspect, 0.1, 200);
      fitCamera(camera, device.aspect);
      // Peak of a thrown die, at the corners where framing is tightest.
      for (const x of [-TUNING.tray.innerWidth / 2, TUNING.tray.innerWidth / 2]) {
        const ndc = new THREE.Vector3(x, 2.2, 2.3).project(camera);
        assert(
          Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1,
          `${device.name}: an airborne die leaves the frame`,
        );
      }
    }
  });

  test('the camera never ends up inside the arena', () => {
    for (const device of DEVICES) {
      const camera = new THREE.PerspectiveCamera(50, device.aspect, 0.1, 200);
      fitCamera(camera, device.aspect);
      assert(camera.position.y > 5, `${device.name}: camera dropped too low`);
      assert(
        cameraBase.distanceTo(camera.position) < 0.001,
        `${device.name}: shake base is out of sync with the camera`,
      );
    }
  });
});

suite('screen · arenas', () => {
  test('every arena is complete and drawable', () => {
    const ids = Object.keys(ARENAS) as ArenaId[];
    assert(ids.length > 0, 'no arenas registered');
    for (const id of ids) {
      const arena = ARENAS[id];
      assert(arena.name.length > 0, `${id} has no name`);
      assert(arena.short.length > 0, `${id} has no short name for the picker`);
      assert(arena.emoji.length > 0, `${id} has no emoji`);
      assert(/^#[0-9a-f]{6}$/i.test(arena.skyColor), `${id} has a bad sky color`);
      assert(typeof arena.Component === 'function', `${id} has no component`);
    }
  });

  test('every arena is reachable through the trophy ladder', () => {
    // An arena with no unlock tier can never be played.
    const source = readFileSync('src/demo/DiceDemoScreen.tsx', 'utf8');
    const tierIds = new Set<UnlockId>(TIERS.map((t) => t.id));
    for (const id of Object.keys(ARENAS) as ArenaId[]) {
      assert(
        source.includes(`${id}:`),
        `arena ${id} is not wired into the picker in DiceDemoScreen`,
      );
    }
    // The unlock ids the picker maps arenas to must all exist as tiers.
    const mapping = source.slice(
      source.indexOf('ARENA_UNLOCKS'),
      source.indexOf('};', source.indexOf('ARENA_UNLOCKS')),
    );
    for (const match of mapping.matchAll(/:\s*'([a-z-]+)'/g)) {
      assert(
        tierIds.has(match[1] as UnlockId),
        `picker maps an arena to unknown unlock '${match[1]}'`,
      );
    }
  });

  test('arenas build their scenery on the shared station coordinates', () => {
    // Each arena hand-places its jail, retreat and posts. If one drifts
    // from src/game/stations.ts the figures float or sink into scenery.
    const arenaFiles = readdirSync('src/arena').filter((f) => f.endsWith('.tsx'));
    const retreatZ = RETREAT_SLOTS[0].z;
    for (const file of arenaFiles) {
      const source = readFileSync(join('src/arena', file), 'utf8');
      const isBattlefield =
        source.includes('JailPen') || source.includes('JAIL') || source.includes('Retreat');
      if (!isBattlefield) continue;

      if (source.includes('Retreat')) {
        assert(
          source.includes(String(retreatZ)),
          `${file} draws a retreat that is not at z=${retreatZ}`,
        );
        RETREAT_POST_XS.forEach((x) =>
          assert(
            source.includes(String(x)),
            `${file} is missing the retreat post at x=${x}`,
          ),
        );
      }
      if (source.includes('platformHeight')) {
        assert(
          source.includes('TUNING.prison'),
          `${file} hardcodes jail geometry instead of using TUNING.prison`,
        );
      }
    }
  });
});

suite('screen · assets', () => {
  test('every sound and voice clip the app loads exists', () => {
    const sources = [
      'src/audio/sounds.ts',
      'src/audio/announcer.ts',
    ];
    for (const file of sources) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/require\('([^']+)'\)/g)) {
        const assetPath = join('src/audio', match[1]);
        assert(existsSync(assetPath), `${file} loads a missing asset: ${match[1]}`);
      }
    }
  });

  test('app icon and splash referenced by app.json exist', () => {
    const config = JSON.parse(readFileSync('app.json', 'utf8'));
    const walk = (value: unknown): void => {
      if (typeof value === 'string' && value.startsWith('./assets/')) {
        assert(existsSync(value.slice(2)), `app.json references missing ${value}`);
      } else if (value && typeof value === 'object') {
        Object.values(value as Record<string, unknown>).forEach(walk);
      }
    };
    walk(config);
  });

  test('licensing credits are recorded for every sound source', () => {
    // Two of the sound packs are CC-BY: shipping without the credit would
    // breach their license, so the file has to exist and name them.
    const credits = readFileSync('assets/sounds/CREDITS.md', 'utf8');
    ['Kenney', 'Kevin MacLeod', 'CC-BY'].forEach((needle) =>
      assert(credits.includes(needle), `CREDITS.md never mentions ${needle}`),
    );
  });

  test('the iOS build config is complete enough to submit', () => {
    const config = JSON.parse(readFileSync('app.json', 'utf8'));
    const ios = config.expo.ios ?? {};
    assert(
      typeof ios.bundleIdentifier === 'string' && ios.bundleIdentifier.includes('.'),
      'app.json has no iOS bundle identifier — TestFlight builds need one',
    );
    assert(existsSync('eas.json'), 'eas.json is missing — no build profile');
    const eas = JSON.parse(readFileSync('eas.json', 'utf8'));
    assert(
      eas.build?.production?.channel === 'main',
      'the production build must follow the same update channel as testers',
    );
  });
});
