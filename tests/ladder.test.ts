import './storageMock';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, assertEqual, suite, test } from './harness';
import { ACHIEVEMENTS } from '../src/game/achievements';
import { getWallet, resetWalletForTests } from '../src/game/currency';
import { isSkinUnlocked, keepRaisedRungs, RAISED_RUNGS } from '../src/game/loadout';
import { getProgress, resetProgressForTests, TIERS } from '../src/game/progress';

/*
  David, 21 Oct 2026, of Courtyard Treasure: "Get rid of it and just
  adjust some trophy unlock amounts near it to make it better." The chest
  it added was drawn off the bottom corner of every current iPhone.
*/
const root = join(__dirname, '..');

suite('ladder · Courtyard Treasure is gone, and the gap it left is closed', () => {
  test('no rung is the treasure, and the chest is not drawn anywhere', () => {
    assert(!TIERS.some((t) => (t.id as string) === 'treasure'), 'the treasure rung is still on the ladder');
    assert(!existsSync(join(root, 'src/arena/TreasureChest.tsx')), 'the chest is still in the game');
    const scene = readFileSync(join(root, 'src/demo/DiceScene.tsx'), 'utf8');
    assert(!/TreasureChest|showTreasure/.test(scene), 'the board still draws the chest');
  });

  test('every step up the ladder is bigger than the one below it', () => {
    for (let i = 3; i < TIERS.length; i++) {
      const step = TIERS[i].at - TIERS[i - 1].at;
      const below = TIERS[i - 1].at - TIERS[i - 2].at;
      assert(step > below, `${TIERS[i].name}: a step of ${step} after a step of ${below}`);
    }
  });

  test('every Game Center trophy achievement still matches its rung', () => {
    for (const a of ACHIEVEMENTS) {
      const m = /trophies(\d+)$/.exec(a.id);
      if (!m) continue;
      const n = Number(m[1]);
      assert(TIERS.some((t) => t.at === n), `${a.id} no longer has a rung at ${n}`);
    }
  });
});

suite('ladder · nobody loses Bubblegum Dice when its rung moved up', () => {
  test('somebody already past the old rung keeps it, below the new one', () => {
    resetWalletForTests({ coins: 0, owned: [] });
    resetProgressForTests({ trophies: 480 });
    assertEqual(keepRaisedRungs().join(), 'bubblegum', 'it was not handed over');
    assert(isSkinUnlocked('bubblegum', 480), 'Bubblegum is locked at 480 after the move');
    assert(getProgress().raisedRungsKept === true, 'the hand-over is not recorded');
  });

  test('it happens once, so the old number is not a back door', () => {
    resetWalletForTests({ coins: 0, owned: [] });
    resetProgressForTests({ trophies: 200 });
    assertEqual(keepRaisedRungs().length, 0, 'handed over below the old rung');
    resetProgressForTests({ trophies: 450, raisedRungsKept: true });
    assertEqual(keepRaisedRungs().length, 0, 'handed over a second time');
    assert(!getWallet().owned.includes('bubblegum'), 'reaching 430 later still gives it');
    assert(!isSkinUnlocked('bubblegum', 450), 'Bubblegum opens below its new rung');
    assert(isSkinUnlocked('bubblegum', 560), 'Bubblegum does not open at its new rung');
  });

  test('the old number is where the rung really was', () => {
    assertEqual(RAISED_RUNGS.bubblegum, 430, 'old rung');
    assertEqual(TIERS.find((t) => t.id === 'bubblegum-dice')!.at, 560, 'new rung');
  });
});

suite('ladder · respaced on 4 Nov 2026, so the top gaps are smaller', () => {
  // The v1.158.0 ladder. Marc: "lessen the highest amount ... around 8500 or 8000".
  const OLD: Record<string, number> = {
    'ruby-dice': 1500, 'desert-arena': 1900, 'ocean-dice': 2350, 'autumn-arena': 2850,
    'lavender-dice': 3400, 'aurora-arena': 4050, 'slate-dice': 4750, 'blossom-dice': 5600,
    'cavern-arena': 6550, 'copper-dice': 7600, 'sky-arena': 8750, 'moon-arena': 10000,
  };

  test('nothing moved up', () => {
    for (const [id, was] of Object.entries(OLD)) {
      const t = TIERS.find((r) => r.id === id);
      assert(!!t, `${id} left the ladder`);
      assert(t!.at <= was, `${id} moved up from ${was} to ${t!.at}`);
    }
  });

  test('the order is unchanged', () => {
    const ids = TIERS.map((t) => t.id as string).filter((id) => id in OLD);
    assertEqual(ids.join(), Object.keys(OLD).join(), 'the rungs are in a different order');
  });

  test('the top is 8,000 and no step is bigger than 800', () => {
    assertEqual(TIERS[TIERS.length - 1].at, 8000, 'the summit is not 8,000');
    for (let i = 1; i < TIERS.length; i++) {
      const step = TIERS[i].at - TIERS[i - 1].at;
      assert(step <= 800, `${TIERS[i].name}: a step of ${step}`);
    }
  });
});
