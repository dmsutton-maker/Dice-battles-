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
