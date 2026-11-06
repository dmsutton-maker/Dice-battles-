import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { assert, assertEqual, note, suite, test } from './harness';
import {
  createGroundSurface,
  createTraySurface,
  QUICK_DENSITY,
  startGroundSurface,
  startTraySurface,
} from '../src/arena/groundTexture';
import {
  cachedTextureCount,
  clearTextureCacheForTests,
  PAINT_BUDGET_MS,
  paintInBackground,
  progressiveTexture,
} from '../src/arena/textureCache';
import { ARENA_THEMES, ThemedArenaId } from '../src/arena/themeData';
import { TUNING } from '../src/game/tuning';

/*
  David, 21 Oct 2026: "I want the arenas to load much faster when you
  click on them to view them." Opening a board painted its floor on the
  tap — 35 to 360ms on a desktop, a second on a phone. The floor is now
  painted a few rows at a time between frames, with a quick stand-in
  shown meanwhile, and the warm-up paints every board that way beside
  the dice from the start.
*/
const root = join(__dirname, '..');
const { innerWidth, innerDepth, wallThickness } = TUNING.tray;
const WORLD: [number, number] = [innerWidth + wallThickness * 2, innerDepth + wallThickness * 2];
const bytes = (t: THREE.Texture) => (t as THREE.DataTexture).image.data as Uint8Array;
const size = (t: THREE.Texture) => {
  const img = (t as THREE.DataTexture).image;
  return `${img.width}x${img.height}`;
};

suite('speed · a floor painted in rows is the floor painted in one go', () => {
  test('every board, floor and ground, byte for byte, bump and glow included', () => {
    for (const id of Object.keys(ARENA_THEMES) as ThemedArenaId[]) {
      const theme = ARENA_THEMES[id];
      const paint = { a: theme.floor.a, b: theme.floor.b, accent: theme.wall.cap };
      const whole = createTraySurface(theme.structure, paint, WORLD);
      const job = startTraySurface(theme.structure, paint, WORLD);
      let steps = 0;
      while (!job.step(7)) steps++;
      assert(steps > 10, `${id}: the floor was painted in ${steps + 1} steps, not in rows`);
      assertEqual(size(job.texture), size(whole), `${id}: floor size`);
      assert(bytes(job.texture).every((v, i) => v === bytes(whole)[i]), `${id}: the floor painted in rows differs`);
      for (const extra of ['bump', 'glow'] as const) {
        const a = whole.userData[extra] as THREE.DataTexture | null;
        const b = job.texture.userData[extra] as THREE.DataTexture | null;
        assertEqual(a === null, b === null, `${id}: ${extra} present on one and not the other`);
        if (a && b) assert(bytes(b).every((v, i) => v === bytes(a)[i]), `${id}: the ${extra} painted in rows differs`);
      }
      assert(job.texture.needsUpdate || (job.texture as THREE.DataTexture).version > 0, `${id}: the GPU is not told the floor is painted`);

      const gp = { a: theme.meadow, b: theme.hill, accent: theme.mountain ?? theme.wall.cap };
      const g = createGroundSurface(theme.structure, gp, 4);
      const gj = startGroundSurface(theme.structure, gp, 4);
      while (!gj.step(5));
      assert(bytes(gj.texture).every((v, i) => v === bytes(g)[i]), `${id}: the ground painted in rows differs`);
    }
  });

  test('the stand-in is a sixteenth of the work and the same shape', () => {
    const theme = ARENA_THEMES.reef;
    const paint = { a: theme.floor.a, b: theme.floor.b, accent: theme.wall.cap };
    const whole = createTraySurface(theme.structure, paint, WORLD);
    const quick = createTraySurface(theme.structure, paint, WORLD, QUICK_DENSITY);
    const w = (whole as THREE.DataTexture).image;
    const q = (quick as THREE.DataTexture).image;
    assert(q.width * q.height * 15 <= w.width * w.height, `the stand-in is ${q.width}x${q.height} against ${w.width}x${w.height}`);
    assert(Math.abs(q.width / q.height - w.width / w.height) < 0.05, 'the stand-in is a different shape');
    assertEqual(quick.wrapS, whole.wrapS, 'the stand-in wraps differently');
    assertEqual(quick.anisotropy, whole.anisotropy, 'the stand-in filters differently');
    // The same colours, roughly: the average of each is close.
    const avg = (t: THREE.Texture) => {
      const d = bytes(t);
      let s = 0;
      for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2];
      return s / (d.length / 4);
    };
    assert(Math.abs(avg(quick) - avg(whole)) < 40, `the stand-in is a different colour: ${avg(quick).toFixed(0)} against ${avg(whole).toFixed(0)}`);
  });
});

suite('speed · painting between frames', () => {
  test('a picture is painted in slices under a budget, cached once done, and shared while painting', async () => {
    clearTextureCacheForTests();
    const theme = ARENA_THEMES.dino;
    const paint = { a: theme.floor.a, b: theme.floor.b, accent: theme.wall.cap };
    let slices = 0;
    let longest = 0;
    // Between frames, as in the app: a timer, not a synchronous call.
    const schedule = (run: () => void) => {
      slices++;
      setTimeout(() => {
        const t0 = Date.now();
        run();
        longest = Math.max(longest, Date.now() - t0);
      }, 0);
    };
    let starts = 0;
    const start = () => {
      starts++;
      return startTraySurface(theme.structure, paint, WORLD);
    };
    const a = paintInBackground('speed-test-floor', start, schedule);
    const b = paintInBackground('speed-test-floor', start, schedule);
    assert(a === b, 'two askers started two paintings');
    const texture = await a;
    assertEqual(starts, 1, 'the floor was started twice');
    assert(slices > 5, `painted in ${slices} slices — not between frames`);
    assert(longest < PAINT_BUDGET_MS * 4, `a slice held the thread for ${longest}ms`);
    assertEqual(cachedTextureCount(), 1, 'the finished floor is not cached');
    note(`painted in ${slices} slices, the longest ${longest}ms, against a budget of ${PAINT_BUDGET_MS}ms`);
    // Asked again: straight from the cache.
    const again = await paintInBackground('speed-test-floor', start, schedule);
    assert(again === texture, 'a cached picture was painted again');
    assertEqual(starts, 1, 'a cached picture was started again');
  });

  test('a board gets a stand-in now and the real floor when it is painted', async () => {
    clearTextureCacheForTests();
    const theme = ARENA_THEMES.glade;
    const paint = { a: theme.floor.a, b: theme.floor.b, accent: theme.wall.cap };
    const quick = () => createTraySurface(theme.structure, paint, WORLD, QUICK_DENSITY);
    const start = () => startTraySurface(theme.structure, paint, WORLD);
    const first = progressiveTexture('speed-test-glade', quick, start);
    assert(first.ready !== null, 'a cold board had nothing to wait for');
    assert(size(first.texture) !== size(await first.ready!), 'the stand-in is the real floor');
    const real = await first.ready!;
    const second = progressiveTexture('speed-test-glade', quick, start);
    assertEqual(second.ready, null, 'a warm board still waits');
    assert(second.texture === real, 'a warm board does not get the real floor');
  });
});

suite('speed · the boards use it', () => {
  test('a themed board draws the progressive floor and ground', () => {
    const arena = readFileSync(join(root, 'src/arena/ThemedArena.tsx'), 'utf8');
    assert(/const floorTexture = useProgressiveSurface\(/.test(arena), 'the floor is still painted on the tap');
    assert(/const groundTexture = useProgressiveSurface\(/.test(arena), 'the ground is still painted on the tap');
    assert(/QUICK_DENSITY/.test(arena), 'no stand-in');
  });

  test('the warm-up paints the battlefields beside the dice, in slices', () => {
    const screen = readFileSync(join(root, 'src/demo/DiceDemoScreen.tsx'), 'utf8');
    const launch = screen.slice(screen.indexOf('facesWarmableRef.current = true;'), screen.indexOf('return () => handle.cancel();'));
    assert(/warmArenas\(\);\s*warmAllDieFaces\(/.test(launch), 'the battlefields still wait for every die');
    const warm = readFileSync(join(root, 'src/arena/warmArenas.ts'), 'utf8');
    assert(/paintThemedSurfaces\(/.test(warm), 'the warm-up paints floors in one block');
    for (const key of ['space-floor', 'space-field', 'castle-sunset-floor', 'jungle-tray-floor']) {
      assert(warm.includes(`'${key}'`), `the warm-up skips ${key}`);
    }
  });
});
