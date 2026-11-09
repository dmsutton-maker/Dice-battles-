import './storageMock';
import { assert, assertEqual, suite, test } from './harness';
import { ARENA_PRICES, ARENA_UNLOCKS, isArenaUnlocked, PAID_ARENAS, STORE_ARENAS } from '../src/game/loadout';
import { paidSkinWhere, productById, sellable } from '../src/game/products';
import { inventoryArenas, obtainableArenaCount } from '../src/game/inventoryRules';
import { isSoldForMoney, resetPurchasesForTest } from '../src/game/purchases';
import { resetProgressForTests, setUnlockAll } from '../src/game/progress';
import { ARENA_JAILS } from '../src/arena/jailKinds';
import { ARENA_THEMES } from '../src/arena/themeData';

/*
  David, 20 Oct 2026: "give me a cool arena worth 3 dollars", then of
  Dino Valley, "Yes, do those things. Also make the dinosaurs move
  around the surroundings." Those things: its own jail, its own picture,
  and a $2.99 product.
*/

suite('dino valley · $2.99 on the money shelf', () => {
  test('the product is still $2.99 and grants the battlefield, but is off the shelf', () => {
    const product = productById('dino_valley');
    assert(product !== undefined, 'there is no dino_valley product');
    assertEqual(product!.usd, 2.99, 'Dino Valley is not $2.99');
    assertEqual(product!.kind, 'once', 'Dino Valley is not a one-off purchase');
    assert((product!.grants ?? []).includes('dino'), 'buying it does not grant the battlefield');
    // Marc, 4 Nov 2026: "take the dino valley out of the store and put it away for now".
    assertEqual(product!.hidden, true, 'Dino Valley is not hidden');
    assert(!sellable(null, Date.now()).some((p) => p.id === 'dino_valley'), 'the shelf lists it');
    assert(!sellable(Date.now(), Date.now(), true).some((p) => p.id === 'dino_valley'), 'the tester shelf lists it');
    assertEqual(paidSkinWhere('dino'), 'Not on sale', 'its locked card shows the wrong tag');
  });

  test('owners keep it, Restore can grant it, admin mode lends it, the count is honest', () => {
    resetProgressForTests();
    resetPurchasesForTest({ owned: ['dino'] });
    assert(inventoryArenas(0, Date.now()).includes('dino'), 'an owner lost Dino Valley from Items');
    assert(productById('dino_valley') !== undefined, 'restore cannot find dino_valley');
    assert(isSoldForMoney('dino'), 'admin mode no longer lends Dino Valley');
    assert(isSoldForMoney('dino_valley'), 'admin mode no longer lends the product');
    const owner = obtainableArenaCount(0);
    resetPurchasesForTest();
    assertEqual(obtainableArenaCount(0), owner - 1, 'a non-owner is counted Dino Valley');
    resetProgressForTests();
  });

  test('money is the only way in: no tier, no coin price, not on the coin shelf', () => {
    assert(PAID_ARENAS.includes('dino'), 'Dino Valley is not listed as money-only');
    assertEqual(ARENA_UNLOCKS.dino, undefined, 'trophies unlock Dino Valley');
    assertEqual(ARENA_PRICES.dino, undefined, 'Dino Valley can be bought with coins');
    assert(!STORE_ARENAS.includes('dino'), 'Dino Valley is on the coin shelf');
  });

  test('locked until bought, and open in family tester mode', () => {
    resetProgressForTests();
    resetPurchasesForTest();
    assertEqual(isArenaUnlocked('dino', 100000), false, 'trophies open Dino Valley');
    setUnlockAll(true);
    assertEqual(isArenaUnlocked('dino', 0), true, 'family tester mode does not open Dino Valley');
    setUnlockAll(false);
    resetPurchasesForTest({ owned: ['dino'] });
    assertEqual(isArenaUnlocked('dino', 0), true, 'buying Dino Valley does not open it');
    resetPurchasesForTest();
    resetProgressForTests();
  });

  test('it has its own jail, bump and pit', () => {
    assertEqual(ARENA_JAILS.dino, 'boneCage', 'Dino Valley borrows another board\'s jail');
    assertEqual(ARENA_THEMES.dino.look.mound.kind, 'eggNest', 'Dino Valley lost its egg nest');
    assertEqual(ARENA_THEMES.dino.look.pit.kind, 'tarPit', 'Dino Valley lost its tar pit');
  });
});

/*
  David, 1 Nov 2026: "Make the dinosaurs in Dino valley look much
  better." They are built from shared parts in src/arena/dinoParts.ts:
  painted hides, low-segment geometries shared between the two raptors
  and the two pterodactyls, and a gait that is a function of distance
  walked. What a renderer would show cannot be tested here; what can
  be is pinned below.
*/

import { readFileSync } from 'node:fs';
import { assertAtMost, assertClose, note } from './harness';
import { rgb } from '../src/arena/paint';
import {
  DINO_SKINS,
  DinoKind,
  dinoGeometries,
  dinoMaterials,
  gait,
  listDinoGeometries,
  LONG_NECK_GAIT,
  newPose,
  RAPTOR_GAIT,
  SKIN_SIZE,
  skinPixels,
  TRICERATOPS_GAIT,
} from '../src/arena/dinoParts';
import { TUNING } from '../src/game/tuning';

/** How many of each kind the board has (DinoLife in dinoLife.tsx). */
const HERD: Record<DinoKind, number> = { longNeck: 1, triceratops: 1, raptor: 2, pterodactyl: 2 };

/** The texel at hide coordinates (u round the body, v along it). */
function texel(kind: DinoKind, u: number, v: number): [number, number, number] {
  const data = skinPixels(DINO_SKINS[kind]);
  const i = Math.floor(u * SKIN_SIZE);
  const j = Math.floor(v * SKIN_SIZE);
  const k = (j * SKIN_SIZE + i) * 4;
  return [data[k], data[k + 1], data[k + 2]];
}
const lum = (c: [number, number, number]) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];

suite('dino valley · the dinosaurs have painted hides, not one flat colour', () => {
  test('every hide is paler underneath than along the back', () => {
    for (const kind of Object.keys(DINO_SKINS) as DinoKind[]) {
      // v = 0.1 is between stripes and clear of every spot.
      const belly = lum(texel(kind, 0.25, 0.1));
      const back = lum(texel(kind, 0.75, 0.1));
      assert(belly > back + 20, `${kind}: the underside (${belly.toFixed(0)}) is not paler than the back (${back.toFixed(0)})`);
    }
  });

  test('the flank is exactly the hide colour, in screen bytes', () => {
    /*
      The first version fed THREE.Color's channels into the picture,
      and those are linear: stored in an sRGB texture they came out a
      stop too dark, and the raptors were brown instead of orange.
    */
    for (const kind of Object.keys(DINO_SKINS) as DinoKind[]) {
      const flank = texel(kind, 0.0, 0.1);
      const want = rgb(DINO_SKINS[kind].base);
      assert(
        flank.every((c, k) => Math.abs(c - want[k]) <= 1),
        `${kind}: the flank is ${flank.join(',')}, not the hide colour ${want.join(',')}`,
      );
    }
  });

  test('stripes cross the back and spots sit on it, darker than the hide', () => {
    const plain = lum(texel('triceratops', 0.75, 0.1));
    assert(lum(texel('triceratops', 0.75, 0.2)) < plain - 20, 'the triceratops has no stripe at v 0.2');
    assert(lum(texel('raptor', 0.75, 0.2)) < lum(texel('raptor', 0.75, 0.1)) - 20, 'the raptor has no stripe at v 0.2');
    assert(lum(texel('longNeck', 0.75, 0.55)) < lum(texel('longNeck', 0.75, 0.1)) - 20, 'the long-neck has no spot at v 0.55');
    // Marks stay on the back: the underside carries none.
    assertClose(lum(texel('triceratops', 0.25, 0.2)), lum(texel('triceratops', 0.25, 0.1)), 2, 'a stripe reaches the triceratops\'s belly');
    // The pterodactyl is plain.
    assertClose(lum(texel('pterodactyl', 0.75, 0.2)), lum(texel('pterodactyl', 0.75, 0.1)), 1, 'the pterodactyl grew marks');
  });
});

suite('dino valley · the parts are few, shared and no bigger than the wall', () => {
  test('the whole herd is a few thousand vertices, and no part is heavy', () => {
    let total = 0;
    for (const { kind, part, geometry } of listDinoGeometries()) {
      const n = geometry.getAttribute('position').count;
      assertAtMost(n, 400, `${kind}.${part} is too detailed for a walker seen from above`);
      total += n * HERD[kind];
    }
    note(`the herd on the board is ${total} vertices`);
    assertAtMost(total, 7000, 'the dinosaurs cost more vertices than the rest of the scenery');
  });

  test('the dinosaurs draw in a sensible number of calls', () => {
    /*
      Every <mesh> in a creature's component is one draw call, and an
      <Eyes> is two (whites and pupils). Counted from the source, since
      the components need a renderer to mount.
    */
    const source = readFileSync('src/arena/dinoLife.tsx', 'utf8');
    const meshes = (text: string) => (text.match(/<mesh /g) ?? []).length;
    const calls = (name: string) => {
      const start = source.indexOf(`function ${name}(`);
      const end = source.indexOf('\nfunction ', start + 1);
      const body = source.slice(start, end < 0 ? undefined : end);
      // Legs are mapped, over four hips or two sides, and draw that many times.
      const mapped = /\{(hips\([^)]*\)|\(\[\[legL[\s\S]*?\]\] as const\))\.map\(([\s\S]*?)\)\)\}/g;
      let n = 0;
      for (const m of body.matchAll(mapped)) n += (m[1].startsWith('hips') ? 4 : 2) * meshes(m[2]);
      const rest = body.replace(mapped, '');
      return n + meshes(rest) + 2 * (rest.match(/<Eyes /g) ?? []).length;
    };
    const perKind = {
      longNeck: calls('LongNeck'),
      triceratops: calls('Triceratops'),
      raptor: calls('Raptor'),
      pterodactyl: calls('Pterodactyl'),
    };
    let total = 0;
    for (const kind of Object.keys(perKind) as DinoKind[]) {
      assert(perKind[kind] >= 9, `${kind} draws in ${perKind[kind]} calls: that is a blob again`);
      total += perKind[kind] * HERD[kind];
    }
    note(`draw calls: long-neck ${perKind.longNeck}, triceratops ${perKind.triceratops}, raptor ${perKind.raptor} x2, pterodactyl ${perKind.pterodactyl} x2 = ${total}`);
    assertAtMost(total, 80, 'the herd draws in too many calls');
  });

  test('geometries and materials are built once and shared by the twins', () => {
    assert(dinoGeometries() === dinoGeometries(), 'the kit is rebuilt on every call');
    assert(dinoMaterials() === dinoMaterials(), 'the materials are rebuilt on every call');
    const m = dinoMaterials();
    assert(m.skin.raptor.map === m.skin.raptor.map && m.skin.raptor.map !== null, 'the raptor hide has no picture');
    assert(m.wing.map !== null, 'the wing has no picture');
    assert(m.eye !== m.pupil, 'eyes and pupils share a material');
  });

  test('no part is bigger than the tray wall is tall, at its creature\'s scale', () => {
    const scale: Record<DinoKind, number> = { longNeck: 0.62, triceratops: 1.1, raptor: 1.15, pterodactyl: 1.3 };
    const limit = TUNING.tray.wallHeight * 2;
    for (const { kind, part, geometry } of listDinoGeometries()) {
      geometry.computeBoundingBox();
      const b = geometry.boundingBox!;
      const size = Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z) * scale[kind];
      assertAtMost(size, limit, `${kind}.${part} looms over the board`);
    }
  });

  test('the lanes are the ones the dinosaurs have roamed since 20 Oct 2026', () => {
    const source = readFileSync('src/arena/dinoLife.tsx', 'utf8');
    assert(/OUTER = \{ half: 3\.56, far: -9\.3, near: 5\.6, r: 0\.7 \}/.test(source), 'the outer lane moved');
    assert(/INNER = \{ half: 3\.3, far: -8\.95, near: 5\.3, r: 0\.6 \}/.test(source), 'the inner lane moved');
    assert(/height=\{2\.2\}/.test(source) && /height=\{2\.6\}/.test(source), 'the pterodactyls no longer fly high');
  });
});

suite('dino valley · the walk cycle moves the legs in step with the pace', () => {
  for (const [name, g] of [['long-neck', LONG_NECK_GAIT], ['triceratops', TRICERATOPS_GAIT], ['raptor', RAPTOR_GAIT]] as const) {
    test(`${name}: diagonal legs swing together, and both ways over a stride`, () => {
      const pose = newPose();
      gait(g, g.stride / 4, pose);
      assertClose(pose.legs[0], g.swing, 1e-9, 'front-left is not at full reach a quarter stride in');
      assertClose(pose.legs[1], -g.swing, 1e-9, 'front-right does not swing opposite front-left');
      assertClose(pose.legs[2], -g.swing, 1e-9, 'back-left does not swing with front-right');
      assertClose(pose.legs[3], g.swing, 1e-9, 'back-right does not swing with front-left');
      let lo = 0;
      let hi = 0;
      for (let k = 0; k <= 20; k++) {
        gait(g, (g.stride * k) / 20, pose);
        lo = Math.min(lo, pose.legs[0]);
        hi = Math.max(hi, pose.legs[0]);
        assert(pose.bob >= 0, 'the body sinks below the ground');
      }
      assert(lo < -g.swing * 0.99 && hi > g.swing * 0.99, 'a leg does not swing fully both ways in a stride');
    });

    test(`${name}: standing still, nothing moves; the tail tip follows the tail`, () => {
      const a = newPose();
      const b = newPose();
      gait(g, 3.21, a);
      gait(g, 3.21, b);
      assert(a.legs.every((v, k) => v === b.legs[k]) && a.tail === b.tail && a.nod === b.nod, 'the same distance gives a different pose');
      // The tip reaches its swing after the base does.
      let peakTail = 0;
      let peakTip = 0;
      for (let k = 0; k < 200; k++) {
        gait(g, (g.stride * k) / 200, a);
        if (a.tail > peakTail) peakTail = a.tail;
        if (a.tailTip > peakTip) peakTip = a.tailTip;
      }
      assert(peakTip > peakTail, 'the tail tip swings less than its base');
    });
  }

  test('the triceratops walks ten seconds in fourteen, and its gait stops when it grazes', () => {
    // The same arithmetic Triceratops uses: the legs are a function of
    // distance, so a stop is a stop.
    const walkedAt = (t: number) => {
      const cycle = Math.floor(t / 14);
      const within = t - cycle * 14;
      return (cycle * 10 + Math.min(within, 10)) * TRICERATOPS_GAIT.pace;
    };
    assertClose(walkedAt(14), 10 * TRICERATOPS_GAIT.pace, 1e-9, 'a cycle does not walk ten seconds');
    assertEqual(walkedAt(11), walkedAt(13), 'it keeps walking while it grazes');
    const a = newPose();
    const b = newPose();
    gait(TRICERATOPS_GAIT, walkedAt(11), a);
    gait(TRICERATOPS_GAIT, walkedAt(13), b);
    assert(a.legs.every((v, k) => v === b.legs[k]), 'the legs keep swinging while it grazes');
  });
});
