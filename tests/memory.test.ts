import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import './storageMock';
import { assert, assertEqual, note, suite, test } from './harness';
import { cachedTextureCount, clearTextureCacheForTests } from '../src/arena/textureCache';
import { dieJobs, equippedDieJobs } from '../src/dice/warmPreviews';
import { DICE_SKINS } from '../src/game/diceSkins';

/*
  Memory, from the pre-submission audit of 9 Nov 2026.

  What the phone cannot afford over a long session is anything that is
  built again every round and never let go of. The 3D scene is remounted
  for every battle (DiceDemoScreen keys it on the round), so a texture a
  board builds inside a bare `useMemo` is built again each battle, and
  three.js frees a texture's GPU copy ONLY on `dispose()`: dropping the
  JavaScript object leaves the GPU memory behind for the life of the
  context. The Twinkle Market's string-light glow did exactly that.

  A GL context cannot run in node, so the rule is checked the way the rest
  of this suite checks the screens: by reading the components with their
  comments removed. What CAN run — the painters and the cache they write
  into — is run for real: every die is painted and painted again, and the
  second pass must add nothing, which is what "the cache is bounded" means.
*/

const root = join(__dirname, '..');

/** Source with its comments taken out, so a phrase in an explanation cannot pass for code. */
const code = (path: string) =>
  readFileSync(join(root, path), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');

/** Every .tsx file under `dir`, recursively, as repo-relative paths. */
function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...tsxFiles(path));
    else if (entry.name.endsWith('.tsx')) out.push(path);
  }
  return out;
}

/**
 * The file cut at its top-level function boundaries, so a rule can read
 * one component or one helper at a time rather than the whole file.
 */
function functionChunks(source: string): { name: string; body: string }[] {
  const starts: { name: string; at: number }[] = [];
  const re = /^(?:export )?(?:async )?function\s+([A-Za-z0-9_]+)|^(?:export )?const\s+([A-Za-z0-9_]+)\s*=\s*(?:React\.)?(?:forwardRef|memo)?\(?\s*(?:function|\()/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) starts.push({ name: m[1] ?? m[2], at: m.index });
  return starts.map((s, i) => ({
    name: s.name,
    body: source.slice(s.at, i + 1 < starts.length ? starts[i + 1].at : source.length),
  }));
}

suite('memory · a component never builds a texture it will not free', () => {
  test("the Twinkle Market's string-light glow goes through the app-wide cache", () => {
    const market = code('src/arena/marketLife.tsx');
    const chase = functionChunks(market).find((c) => c.name === 'Chase');
    assert(chase !== undefined, 'marketLife.tsx has no Chase component');
    const cache = chase!.body.indexOf("cachedTexture('market:chase-glow'");
    const texture = chase!.body.indexOf('new THREE.DataTexture(');
    assert(cache >= 0, 'the chase glow is not cached under market:chase-glow');
    assert(texture > cache, 'the chase glow texture is built outside the cachedTexture call');
  });

  test('every DataTexture a component builds is cached app-wide or disposed on unmount', () => {
    /*
      For each .tsx under src: a function that writes `new THREE.DataTexture(`
      must itself call cachedTexture or .dispose, or be the builder a
      cachedTexture call in the same file names (hazeTexture, lavaTexture).
      A texture that is none of those is built per mount and leaked per
      battle, which is the bug this suite exists for.
    */
    const offenders: string[] = [];
    for (const file of tsxFiles('src')) {
      const source = code(file);
      if (!source.includes('new THREE.DataTexture(')) continue;
      for (const chunk of functionChunks(source)) {
        if (!chunk.body.includes('new THREE.DataTexture(')) continue;
        const frees = /cachedTexture\(/.test(chunk.body) || /\.dispose\(/.test(chunk.body);
        const cachedByCaller = new RegExp(`cachedTexture\\([\\s\\S]{0,200}?\\b${chunk.name}\\b`).test(source);
        if (!frees && !cachedByCaller) offenders.push(`${file} › ${chunk.name}`);
      }
    }
    assertEqual(offenders.length, 0, `textures built per mount and never freed:\n      ${offenders.join('\n      ')}`);
  });
});

suite('memory · what a scene remount builds, it frees', () => {
  const scene = code('src/demo/DiceScene.tsx');

  test("the die effect is disposed when the skin changes and when the scene goes", () => {
    assert(/useEffect\(\(\) => \(\) => fire\?\.dispose\(\), \[fire\]\)/.test(scene), 'DiceScene does not dispose the die effect');
  });

  test('collision listeners come off the dice bodies', () => {
    assert(
      /removeEventListener\('collide', onCollide\)/.test(scene),
      'the collide listener is added but never removed',
    );
  });

  test('every die effect frees its geometry, materials and textures', () => {
    for (const name of ['diceFire', 'diceIce', 'diceNeon', 'diceSun', 'diceMoon', 'diceOcean', 'diceGingerbread', 'diceSnowGlobe']) {
      const effect = code(`src/dice/${name}.ts`);
      assert(/dispose\(\): void \{/.test(effect), `${name} has no dispose()`);
      const body = effect.slice(effect.indexOf('dispose(): void {'));
      // Everything with its own GPU memory: the particle pool, and any
      // glow geometry, texture or material the effect built for itself.
      for (const owned of ['Geometry', 'Texture', 'Materials']) {
        const builds = new RegExp(`this\\.(\\w*${owned.toLowerCase()}\\w*|\\w*${owned}\\w*) = new THREE\\.`).exec(effect);
        if (!builds) continue;
        const field = builds[1];
        assert(body.includes(`this.${field}`), `${name} builds this.${field} and never disposes it`);
      }
    }
  });

  test('water surfaces leave the live set and are disposed', () => {
    const water = code('src/arena/water.tsx');
    assert(/LIVE\.delete\(material\);\s*material\.dispose\(\);/.test(water), 'a water material is not freed on unmount');
    const clock = code('src/arena/sceneryClock.ts');
    assert(/SCENERY_LIFE\.delete\(tick\)/.test(clock), 'a scenery tick is never unregistered');
  });
});

suite('memory · the painted texture cache is bounded', () => {
  test('painting every die a second time adds nothing to the cache', () => {
    clearTextureCacheForTests();
    const paintAll = () => {
      for (const job of equippedDieJobs(undefined)) while (!job.step());
      for (const skin of DICE_SKINS) for (const job of dieJobs(skin)) while (!job.step());
    };
    const t0 = Date.now();
    paintAll();
    const once = cachedTextureCount();
    const t1 = Date.now();
    paintAll();
    const twice = cachedTextureCount();
    assertEqual(twice, once, 'painting every die again grew the texture cache');
    let left = 0;
    for (const skin of DICE_SKINS) left += dieJobs(skin).length;
    assertEqual(left, 0, 'a die still has sides to paint after every die was painted');
    // Six sides a die at most, plus the shade map, the stickers and the
    // moving dice's extra maps: a few hundred, never thousands.
    assert(once < 1000, `the texture cache holds ${once} textures for ${DICE_SKINS.length} dice`);
    note(`texture cache: ${once} textures after painting every die (${t1 - t0} ms); second pass added 0 (${Date.now() - t1} ms)`);
    clearTextureCacheForTests();
  });
});
