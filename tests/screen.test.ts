import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { ARENAS, ArenaId } from '../src/arena/arenas';
import { DICE_SKINS, DEFAULT_SKIN_ID, skinById } from '../src/game/diceSkins';
import {
  ARENA_ORDER,
  ARENA_UNLOCKS,
  activeArena,
  activeDieBody,
  isArenaUnlocked,
  isSkinUnlocked,
} from '../src/game/loadout';
import { PRISONER_COLORS } from '../src/game/colors';
import { TIERS, UnlockId } from '../src/game/progress';
import {
  FIGURE_RADIUS,
  JAIL_SLOTS,
  RETREAT_POOL,
  RETREAT_POOL_RADIUS,
  RETREAT_POST_RADIUS,
  RETREAT_POST_XS,
  RETREAT_POST_Z,
  RETREAT_PROP_RADIUS,
  RETREAT_PROPS,
  RETREAT_SLOTS,
  WALL_SLOTS,
} from '../src/game/stations';
import { TUNING } from '../src/game/tuning';
import { cameraBase, fitCamera } from '../src/demo/cameraFit';
import { assert, assertAtMost, assertEqual, note, suite, test } from './harness';

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
        // Both EDGES of every freed figure, not just its centre: the
        // outermost ones used to hang off the sides of the screen.
        ...RETREAT_SLOTS.flatMap((s) => [
          new THREE.Vector3(s.x - FIGURE_RADIUS, s.y + 0.9, s.z),
          new THREE.Vector3(s.x + FIGURE_RADIUS, s.y + 0.9, s.z),
        ]),
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
    // An arena missing an unlock tier, or missing from the Inventory's
    // display order, can never be played.
    const tierIds = new Set<UnlockId>(TIERS.map((t) => t.id));
    for (const id of Object.keys(ARENAS) as ArenaId[]) {
      const unlock = ARENA_UNLOCKS[id];
      assert(unlock !== undefined, `arena ${id} has no unlock tier`);
      assert(tierIds.has(unlock), `arena ${id} maps to unknown unlock '${unlock}'`);
      assert(ARENA_ORDER.includes(id), `arena ${id} is missing from the Inventory`);
    }
    assertEqual(
      ARENA_ORDER.length,
      Object.keys(ARENAS).length,
      'Inventory lists a different number of arenas than exist',
    );
  });

  test('the starting battlefield is free', () => {
    assert(isArenaUnlocked(ARENA_ORDER[0], 0), 'a new player has nowhere to battle');
  });

  test('nothing in the retreat overlaps a freed prisoner', () => {
    // Freed figures celebrate on the retreat row. Scenery placed on top of
    // them looks broken — the parasols used to stand directly over the
    // figures at x ±2.4 with a canopy wide enough to swallow them.
    const scenery: { name: string; x: number; z: number; radius: number }[] = [
      ...RETREAT_POST_XS.map((x) => ({
        name: 'parasol/beacon post',
        x,
        z: RETREAT_POST_Z,
        radius: RETREAT_POST_RADIUS,
      })),
      {
        name: 'pool',
        x: RETREAT_POOL[0],
        z: RETREAT_POOL[1],
        radius: RETREAT_POOL_RADIUS,
      },
      ...RETREAT_PROPS.map(([x, z]) => ({
        name: 'planting/crates',
        x,
        z,
        radius: RETREAT_PROP_RADIUS,
      })),
    ];

    for (const slot of RETREAT_SLOTS) {
      for (const prop of scenery) {
        const gap =
          Math.hypot(prop.x - slot.x, prop.z - slot.z) - prop.radius - FIGURE_RADIUS;
        assert(
          gap > 0,
          `the ${prop.name} overlaps the freed prisoner at x ${slot.x} by ${(-gap).toFixed(2)}`,
        );
      }
    }
  });

  test('freed prisoners never stand inside each other', () => {
    for (let i = 0; i < RETREAT_SLOTS.length; i++) {
      for (let j = i + 1; j < RETREAT_SLOTS.length; j++) {
        const d = Math.hypot(
          RETREAT_SLOTS[i].x - RETREAT_SLOTS[j].x,
          RETREAT_SLOTS[i].z - RETREAT_SLOTS[j].z,
        );
        assert(d > FIGURE_RADIUS * 2, `retreat spots ${i} and ${j} overlap`);
      }
    }
  });

  test('arenas build their scenery on the shared station coordinates', () => {
    // Each arena hand-places its jail, retreat and posts. If one drifts
    // from src/game/stations.ts the figures float or sink into scenery.
    const arenaFiles = readdirSync('src/arena').filter((f) => f.endsWith('.tsx'));
    for (const file of arenaFiles) {
      const source = readFileSync(join('src/arena', file), 'utf8');
      if (!source.includes('Retreat')) continue;

      // Repeating the numbers is how the arenas drifted out of alignment
      // with the figures; they must read them from the shared source.
      for (const name of ['RETREAT_XS', 'RETREAT_Z', 'RETREAT_POST_XS']) {
        assert(
          source.includes(name),
          `${file} does not use ${name} — it is hardcoding retreat positions`,
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

const toLab = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.9505;
    const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
    const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.089;
    const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
};

suite('screen · inventory', () => {
  test('no dice colour swallows a face colour', () => {
    // The shell surrounds the six face stickers. A shell too close to one
    // of them hides that face, which breaks reading a roll at a glance.
    for (const skin of DICE_SKINS) {
      let worst = Infinity;
      let nearest = '';
      for (const face of PRISONER_COLORS) {
        const a = toLab(skin.body);
        const b = toLab(face.hex);
        const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
        if (d < worst) {
          worst = d;
          nearest = face.label;
        }
      }
      note(`dice ${skin.name}: nearest face ${nearest} at ΔLab ${worst.toFixed(0)}`);
      assert(
        worst > 28,
        `${skin.name} dice are too close to the ${nearest} face (ΔLab ${worst.toFixed(1)})`,
      );
    }
  });

  test('every dice skin is obtainable exactly one way', () => {
    // A skin is earned on the trophy ladder OR bought with coins, never
    // both — two routes to the same item makes its price meaningless.
    const tierIds = new Set<UnlockId>(TIERS.map((t) => t.id));
    assertEqual(
      new Set(DICE_SKINS.map((s) => s.id)).size,
      DICE_SKINS.length,
      'duplicate dice skin ids',
    );
    for (const skin of DICE_SKINS) {
      assert(/^#[0-9a-f]{6}$/i.test(skin.body), `${skin.name} has a malformed colour`);
      const onLadder = skin.unlock !== undefined && skin.unlock !== null;
      const inStore = skin.price !== undefined;
      assert(
        !(onLadder && inStore),
        `${skin.name} is both earnable and purchasable`,
      );
      if (onLadder) {
        assert(
          tierIds.has(skin.unlock as UnlockId),
          `${skin.name} maps to unknown unlock '${skin.unlock}'`,
        );
      }
      if (inStore) {
        assert(skin.price! > 0, `${skin.name} is in the Store but free`);
      }
      if (skin.pattern !== 'plain') {
        assert(
          skin.ink !== undefined,
          `${skin.name} has a pattern but no pattern colour`,
        );
      }
    }
  });

  test('patterned dice still show their faces clearly', () => {
    // The pattern paints the shell that surrounds the six face stickers.
    // Pattern ink too close to a face colour crowds that face.
    for (const skin of DICE_SKINS.filter((s) => s.ink)) {
      let worst = Infinity;
      let nearest = '';
      for (const face of PRISONER_COLORS) {
        const a = toLab(skin.ink!);
        const b = toLab(face.hex);
        const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
        if (d < worst) {
          worst = d;
          nearest = face.label;
        }
      }
      note(`${skin.name} ink: nearest face ${nearest} at ΔLab ${worst.toFixed(0)}`);
      assert(
        worst > 28,
        `${skin.name}'s pattern is too close to the ${nearest} face (ΔLab ${worst.toFixed(1)})`,
      );
    }
  });

  test('a new player starts with dice and can never be left with none', () => {
    assert(isSkinUnlocked(DEFAULT_SKIN_ID, 0), 'the starter dice are not free');
    assertEqual(skinById(DEFAULT_SKIN_ID).price, undefined, 'starter dice cost coins');
    // Equipping is validated on read, so losing an unlock (tester mode off)
    // falls back instead of leaving an item the player does not own.
    assertEqual(activeDieBody(0), skinById(DEFAULT_SKIN_ID).body, 'fallback dice colour');
    assert(isArenaUnlocked(activeArena(0), 0), 'fallback battlefield is locked');
  });

  test('the ladder alternates so something is always close to earn', () => {
    const gaps = TIERS.slice(1).map((t, i) => t.at - TIERS[i].at);
    const biggest = Math.max(...gaps);
    note(`largest trophy gap between unlocks: ${biggest}`);
    assertAtMost(biggest, 200, 'largest gap between unlocks');
  });
});

suite('screen · round flow', () => {
  test('every round ends with both play-again and home offered', () => {
    for (const file of ['src/demo/DiceDemoScreen.tsx', 'src/demo/TwoPlayerScreen.tsx']) {
      const source = readFileSync(file, 'utf8');
      assert(source.includes('PLAY AGAIN'), `${file} offers no rematch button`);
      assert(source.includes('HOME'), `${file} offers no way back to the menu`);
    }
  });

  test('a stray tap on the result screen cannot start a new round', () => {
    // Restarting on any tap once cost a Hard round's trophies to a
    // misplaced finger; the result screen must require a real button.
    const source = readFileSync('src/demo/DiceDemoScreen.tsx', 'utf8');
    const grant = source.slice(
      source.indexOf('onPanResponderGrant'),
      source.indexOf('onPanResponderRelease'),
    );
    for (const phase of ['won', 'lost', 'tie']) {
      assert(
        !grant.includes(`'${phase}'`),
        `tapping anywhere restarts the round from the ${phase} screen`,
      );
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
