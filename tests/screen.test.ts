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
import { GAME_VERSION } from '../src/game/version';
import {
  CORNER_TOWERS,
  CORNER_TOWER_RADIUS,
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

  test('the ladder starts close and gets steeper, never the other way', () => {
    // David asked for cheap early rewards scaling up to expensive late
    // ones. A flat cap on the largest gap would have banned exactly that,
    // so what is checked instead is the SHAPE: the first reward is within
    // easy reach, and the climb never gets easier as it goes.
    const paid = TIERS.filter((t) => t.at > 0);
    const gaps = paid.map((t, i) => t.at - (i === 0 ? 0 : paid[i - 1].at));
    note(`trophy gaps between unlocks: ${gaps.join(', ')}`);

    assertAtMost(gaps[0], 60, 'the first reward is too far from the start');
    for (let i = 1; i < gaps.length; i++) {
      assert(
        gaps[i] >= gaps[i - 1],
        `gap ${i} (${gaps[i]}) is smaller than the one before (${gaps[i - 1]}) — the ladder gets easier`,
      );
    }
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

suite('screen · the wall row', () => {
  test('nothing on the wall stands inside a corner tower', () => {
    // Skirmish sends the opponent's rescues up here, and the outer two
    // used to sit at x +/-2.5 with the towers at +/-2.8 — David saw the
    // figures tangled in the stonework.
    for (const slot of WALL_SLOTS) {
      for (const tower of CORNER_TOWERS) {
        const gap =
          Math.hypot(tower.x - slot.x, tower.z - slot.z) -
          CORNER_TOWER_RADIUS -
          FIGURE_RADIUS;
        assert(
          gap > 0,
          `a corner tower overlaps the wall figure at x ${slot.x.toFixed(2)} by ${(-gap).toFixed(2)}`,
        );
      }
    }
  });

  test('captured prisoners never stand inside each other', () => {
    for (let i = 0; i < WALL_SLOTS.length; i++) {
      for (let j = i + 1; j < WALL_SLOTS.length; j++) {
        const d = Math.hypot(
          WALL_SLOTS[i].x - WALL_SLOTS[j].x,
          WALL_SLOTS[i].z - WALL_SLOTS[j].z,
        );
        assert(d > FIGURE_RADIUS * 2, `wall spots ${i} and ${j} overlap`);
      }
    }
  });

  test('the whole wall row stays on the wall', () => {
    const { innerWidth, wallThickness } = TUNING.tray;
    const outerEdge = innerWidth / 2 + wallThickness;
    for (const slot of WALL_SLOTS) {
      assert(
        Math.abs(slot.x) + FIGURE_RADIUS <= outerEdge,
        `the figure at x ${slot.x.toFixed(2)} hangs off the end of the wall`,
      );
    }
  });
});

suite('screen · the title card comes first', () => {
  const app = readFileSync('App.tsx', 'utf8');

  test('the game is not mounted on the first render', () => {
    // It used to render unconditionally with the card drawn over it, so
    // the GL canvas, physics world, audio players and four storage reads
    // all ran before React could paint. The card then appeared AFTER the
    // slow part — a loading screen that shows up once loading is done.
    assert(
      /\{this\.state\.loading && <DiceDemoScreen \/>\}/.test(app),
      'DiceDemoScreen is rendered without waiting for the title card',
    );
    assert(
      !/^\s*<DiceDemoScreen \/>\s*$/m.test(app),
      'DiceDemoScreen is still mounted unconditionally somewhere',
    );
  });

  test('loading starts only after the first frame has settled', () => {
    assert(
      app.includes('InteractionManager.runAfterInteractions'),
      'nothing defers the game mount past the first paint',
    );
  });

  test('a stuck interaction handle cannot strand the title card', () => {
    // runAfterInteractions waits on a handle a stray animation can hold
    // open. A card that never lifts is worse than one that lifts early.
    assert(
      /this\.fallback = setTimeout/.test(app),
      'no fallback if runAfterInteractions never fires',
    );
    assert(
      /if \(this\.state\.loading\) return;/.test(app),
      'the two triggers could both mount the game',
    );
  });

  test('the card never lifts onto an unmounted game', () => {
    assert(
      /this\.cardDone && this\.state\.loading/.test(app),
      'the card can clear before the game exists, showing a blank screen',
    );
  });

  test('the startup sound waits for the saved volume settings', () => {
    // Playing first and checking after would blare once on every launch
    // for a family that muted the game.
    const splash = readFileSync('src/demo/BootSplash.tsx', 'utf8');
    // Compare the CALLS, not the imports — import order says nothing.
    const body = splash.slice(splash.lastIndexOf('\nimport '));
    const load = body.indexOf('loadAudioSettings(');
    const play = body.indexOf('playStartup(');
    assert(load !== -1, 'the volume settings are never read');
    assert(play !== -1, 'the title card plays no sound');
    assert(load < play, 'the sound plays before the volume settings are read');
  });
});

suite('screen · nothing shows through the title card', () => {
  test('the card stacks above every layer in the game', () => {
    // Tree order is not enough in React Native: the stats HUD (30), the
    // bottom bar (35) and the settings gear (5) all carried a zIndex and
    // the card carried none, so trophies, coins, the gear and the menu
    // bar punched straight through it on launch.
    const splash = readFileSync('src/demo/BootSplash.tsx', 'utf8');
    const cardZ = /zIndex:\s*(\d+)/.exec(splash);
    assert(cardZ !== null, 'the title card has no zIndex at all');

    const dir = 'src/demo';
    let highest = 0;
    let owner = '';
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.tsx'))) {
      if (file === 'BootSplash.tsx') continue;
      const source = readFileSync(join(dir, file), 'utf8');
      for (const m of source.matchAll(/zIndex:\s*(\d+)/g)) {
        const z = Number(m[1]);
        if (z > highest) {
          highest = z;
          owner = file;
        }
      }
    }
    note(`highest zIndex in the game: ${highest} (${owner})`);
    assert(
      Number(cardZ![1]) > highest,
      `the title card sits at ${cardZ![1]}, but ${owner} is at ${highest} and will show through it`,
    );
  });
});

suite('screen · the board belongs to the battle screen', () => {
  test('every menu page is fully opaque', () => {
    // They sat at 96%, so the arena showed faintly through all of them.
    // Settings is the deliberate exception — it is a popup, not a page.
    const pages = [
      'StoreScreen',
      'InventoryScreen',
      'LeaderboardScreen',
      'NewsScreen',
      'TournamentScreen',
    ];
    for (const page of pages) {
      const source = readFileSync(join('src/demo', `${page}.tsx`), 'utf8');
      const overlay = source.slice(source.indexOf('overlay: {'));
      const bg = /backgroundColor:\s*'([^']+)'/.exec(overlay);
      assert(bg !== null, `${page} sets no background at all`);
      assert(
        !bg![1].startsWith('rgba'),
        `${page} is see-through (${bg![1]}) — the board shows through it`,
      );
    }
  });

  test('settings is a page like the rest, not a popup', () => {
    // It began as a translucent card over the home screen. David asked
    // for it to be a tab like everything else, so it is solid and full
    // height now — and it must not drift back.
    const source = readFileSync('src/demo/DiceDemoScreen.tsx', 'utf8');
    const overlay = source.slice(source.indexOf('settingsOverlay: {'));
    const bg = /backgroundColor:\s*'([^']+)'/.exec(overlay);
    assert(bg !== null, 'the settings page sets no background');
    assert(
      !bg![1].startsWith('rgba'),
      `settings is see-through (${bg![1]}) — the board shows through it`,
    );
  });

  test('settings is reached the same way as every other page', () => {
    const source = readFileSync('src/demo/DiceDemoScreen.tsx', 'utf8');
    assert(
      !/showSettings/.test(source),
      'settings still has its own open/closed flag instead of being a tab',
    );
    assert(
      /menuTab === 'settings'/.test(source),
      'settings is not driven by the tab bar',
    );
    const nav = readFileSync('src/demo/BottomNav.tsx', 'utf8');
    assert(
      /\|\s*'settings'/.test(nav),
      'settings is not one of the tabs',
    );
  });

  test('Battle sits in the middle of the bar', () => {
    const nav = readFileSync('src/demo/BottomNav.tsx', 'utf8');
    const ids = [...nav.matchAll(/\{ id: '([a-z]+)',/g)].map((m) => m[1]);
    assert(ids.length % 2 === 1, `an even number of tabs (${ids.length}) has no middle`);
    assertEqual(ids[(ids.length - 1) / 2], 'play', `Battle is not centred: ${ids.join(', ')}`);
  });

  test('the board stops rendering while a menu is open', () => {
    const source = readFileSync('src/demo/DiceDemoScreen.tsx', 'utf8');
    assert(
      /frameloop=\{menuTab === null \? 'always' : 'never'\}/.test(source),
      'the 3D scene keeps running behind menus nobody can see',
    );
  });
});

suite('screen · the menu does not jump', () => {
  /**
   * Three times now, a line of text that changes with what you tapped has
   * shifted everything below it: the mode rules (Color War's fit on one
   * line where the others take two), the difficulty hint (Easy's takes
   * two where Medium's and Hard's take one), and the next-unlock line.
   *
   * Any text whose CONTENT depends on a selection has to reserve its
   * height, or the menu moves under your thumb between taps.
   */
  const source = readFileSync('src/demo/DiceDemoScreen.tsx', 'utf8');

  const styleBlock = (name: string): string => {
    const at = source.indexOf(`  ${name}: {`);
    assert(at !== -1, `no style called ${name}`);
    return source.slice(at, source.indexOf('},', at));
  };

  for (const name of ['modeRules', 'difficultyHint', 'trophyNext']) {
    test(`${name} reserves its height`, () => {
      const block = styleBlock(name);
      const height = /height:\s*(\d+)/.exec(block);
      const lineHeight = /lineHeight:\s*(\d+)/.exec(block);
      assert(height !== null, `${name} has no fixed height — it will shift the menu`);
      assert(lineHeight !== null, `${name} has no lineHeight, so its height is a guess`);
      const lines = Number(height![1]) / Number(lineHeight![1]);
      assert(
        Number.isInteger(lines) && lines >= 1 && lines <= 3,
        `${name} reserves ${height![1]}px at ${lineHeight![1]}px a line — not a whole number of lines`,
      );
    });
  }

  test('every reserved line also caps how many lines it may take', () => {
    // A fixed height without numberOfLines clips mid-wrap instead of
    // ellipsising, which looks broken rather than tidy.
    for (const name of ['modeRules', 'difficultyHint', 'trophyNext']) {
      // Read the WHOLE opening tag, not just the style attribute — the
      // first version of this test matched `style={styles.x}` as a prefix
      // of `style={styles.x} numberOfLines={2}` and failed on correct code.
      const tags = [
        ...source.matchAll(new RegExp(`<Text style=\\{styles\\.${name}\\}[^>]*>`, 'g')),
      ];
      assert(tags.length > 0, `${name} is not used anywhere`);
      for (const [tag] of tags) {
        assert(
          /numberOfLines=\{\d+\}/.test(tag),
          `${name} is used without numberOfLines: ${tag.trim()}`,
        );
      }
    }
  });
});

suite('release · the version number is real', () => {
  const root = join(__dirname, '..');
  const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');

  /** The newest version heading in the changelog, e.g. "v1.12.0". */
  const newest = changelog.match(/^## (v\d+\.\d+\.\d+)/m)?.[1] ?? null;

  test('the changelog has a newest version to compare against', () => {
    assert(newest !== null, 'CHANGELOG.md has no "## vX.Y.Z" heading');
  });

  test('GAME_VERSION matches the newest changelog entry', () => {
    // The whole point of showing a version in Settings is that a bug
    // report can be traced to the exact build it came from. A version
    // that lags the release is worse than none, because it sends the
    // reader looking in the wrong code. app.json's version sat at 1.0.0
    // through eleven releases precisely because nothing checked it.
    assertEqual(
      GAME_VERSION,
      newest!,
      'GAME_VERSION has drifted from CHANGELOG.md — bump it with the release',
    );
  });

  test('Settings shows the version under Report a Bug', () => {
    const screen = readFileSync(
      join(root, 'src/demo/DiceDemoScreen.tsx'),
      'utf8',
    );
    assert(
      screen.includes('{GAME_VERSION}'),
      'the Settings tab never renders GAME_VERSION',
    );
  });

  test('a bug report carries the version a player is actually running', () => {
    const report = readFileSync(join(root, 'src/debug/bugReport.ts'), 'utf8');
    assert(
      report.includes('GAME_VERSION'),
      'bug reports still stamp the native app.json version, which OTA updates cannot move',
    );
  });
});
