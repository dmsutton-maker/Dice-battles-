import './storageMock';
import { readFileSync } from 'node:fs';
import { assert, assertEqual, note, suite, test } from './harness';
import {
  addXp,
  asPrize,
  BATTLE_XP,
  battleXp,
  LEVELS,
  levelFor,
  progressIn,
  rewardFor,
  SEASON,
  SEASON_ITEM_WORTH,
  SEASON_ITEMS,
  xpForLevel,
  xpToReach,
} from '../src/game/seasonPass';
import { payPrize } from '../src/game/prizes';
import { getProgress, resetProgressForTests, TIERS } from '../src/game/progress';
import { getWallet, owns, resetWalletForTests } from '../src/game/currency';
import { DICE_SKINS, LADDER_SKINS, skinById, STORE_SKINS } from '../src/game/diceSkins';
import {
  ARENA_PRICES,
  ARENA_UNLOCKS,
  arenaKey,
  isArenaUnlocked,
  isSkinUnlocked,
  keepPassArenas,
} from '../src/game/loadout';
import { AI_DIFFICULTIES } from '../src/game/ai';

/**
 * The season pass.
 *
 * David, 30 Sep 2026: "Add a season pass with levels and exp you earn are
 * counted towards the season pass. Make the rewards be small amounts of
 * coins or trophies that slowly increase in amounts the higher level you
 * go. Make this season pass have the fire and ice dice as the way to
 * obtain them and also make the volcano rim and snowy hollow arenas
 * unlocked through the season pass only."
 */

const DIFFICULTIES = Object.keys(AI_DIFFICULTIES) as (keyof typeof AI_DIFFICULTIES)[];

suite('season pass · experience', () => {
  test('every battle earns some, a win more, Hard most', () => {
    for (const d of DIFFICULTIES) {
      const xp = BATTLE_XP[d];
      assert(xp.lost > 0, `a ${d} loss earns nothing — a pass only winners see move`);
      assert(xp.won > xp.tie && xp.tie > xp.lost, `${d}: a win is not worth more than a draw, and a draw more than a loss`);
    }
    for (const outcome of ['won', 'tie', 'lost'] as const) {
      assert(
        battleXp(outcome, 'hard') > battleXp(outcome, 'medium') &&
          battleXp(outcome, 'medium') > battleXp(outcome, 'easy'),
        `a ${outcome} is not worth more the harder the computer`,
      );
    }
  });

  test('each level needs a little more than the one before', () => {
    for (let n = 2; n <= LEVELS; n++) {
      assert(xpForLevel(n) > xpForLevel(n - 1), `level ${n} is no harder than ${n - 1}`);
    }
    const total = xpToReach(LEVELS);
    const medWins = Math.ceil(total / BATTLE_XP.medium.won);
    const hardWins = Math.ceil(total / BATTLE_XP.hard.won);
    note(`${LEVELS} levels, ${total} XP: about ${medWins} Medium wins or ${hardWins} Hard wins`);
    // A season's worth, not a weekend's, and not a year's.
    assert(medWins >= 80 && medWins <= 300, `the whole pass is ${medWins} Medium wins`);
    assert(Math.ceil(xpForLevel(1) / BATTLE_XP.easy.won) <= 3, 'level 1 takes more than three easy wins');
  });

  test('the level and the bar agree with the table', () => {
    assertEqual(levelFor(0), 0, 'a new player is not on level 0');
    for (let n = 1; n <= LEVELS; n++) {
      assertEqual(levelFor(xpToReach(n)), n, `exactly enough XP for level ${n} is not level ${n}`);
      assertEqual(levelFor(xpToReach(n) - 1), n - 1, `one short of level ${n} already counts`);
    }
    assertEqual(levelFor(xpToReach(LEVELS) * 5), LEVELS, 'the pass goes past its last level');
    const mid = progressIn(xpToReach(3) + 10);
    assertEqual(mid.level, 3, 'wrong level');
    assertEqual(mid.into, 10, 'wrong progress into the level');
    assertEqual(mid.need, xpForLevel(4), 'wrong XP needed for the next level');
  });
});

suite('season pass · rewards', () => {
  test('small amounts of coins or trophies, slowly growing', () => {
    let lastCoins = 0;
    let lastTrophies = 0;
    for (let n = 1; n <= LEVELS; n++) {
      const r = rewardFor(n);
      if (r.item) continue;
      assert((r.coins > 0) !== (r.trophies > 0), `level ${n} pays both, or neither`);
      if (r.coins > 0) {
        assert(r.coins > lastCoins, `level ${n}'s ${r.coins} coins is not more than before`);
        assert(r.coins <= 200, `level ${n}'s ${r.coins} coins is not a small amount`);
        lastCoins = r.coins;
      } else {
        assert(r.trophies >= lastTrophies, `level ${n}'s trophies went down`);
        assert(r.trophies <= 25, `level ${n}'s ${r.trophies} trophies is not a small amount`);
        lastTrophies = r.trophies;
      }
    }
    note(`coins run ${rewardFor(1).coins}–${lastCoins}, trophies ${rewardFor(2).trophies}–${lastTrophies}`);
  });

  test('the Fire and Ice dice, Snowy Hollow and Volcano Rim are on it', () => {
    const items = SEASON_ITEMS.map((s) => `${s.item.kind}:${s.item.id}`).sort();
    assertEqual(items.join(','), 'arena:snow,arena:volcano,dice:fire,dice:ice', 'the wrong things are on the pass');
    for (const { level, item } of SEASON_ITEMS) {
      assert(level >= 1 && level <= LEVELS, `${item.id} is on a level that does not exist`);
      assertEqual(rewardFor(level).item?.id, item.id, `level ${level} does not pay the ${item.id}`);
    }
    assertEqual(new Set(SEASON_ITEMS.map((s) => s.level)).size, SEASON_ITEMS.length, 'two items on one level');
  });

  test('each level is paid exactly once', () => {
    let state = addXp(undefined, 0).state;
    const paid: number[] = [];
    for (let battle = 0; battle < 400; battle++) {
      const step = addXp(state, BATTLE_XP.medium.won);
      paid.push(...step.reached);
      state = step.state;
    }
    assertEqual(paid.join(','), Array.from({ length: LEVELS }, (_, i) => i + 1).join(','), 'a level was paid twice, or skipped');
    // Loading the same save again pays nothing new.
    assertEqual(addXp(state, 0).reached.length, 0, 'a level was paid again for no experience');
  });

  test('a big jump pays every level it passes, in order', () => {
    const step = addXp(undefined, xpToReach(3));
    assertEqual(step.reached.join(','), '1,2,3', 'levels were skipped');
  });

  test('a save from another season starts this one fresh', () => {
    const step = addXp({ season: 'season-0', xp: 99999, paid: 30 }, 50);
    assertEqual(step.state.season, SEASON.id, 'the old season was kept');
    assertEqual(step.state.xp, 50, 'the old season\'s XP carried over');
  });

  test('nonsense experience is ignored', () => {
    assertEqual(addXp(undefined, -500).state.xp, 0, 'negative XP was counted');
    assertEqual(addXp(undefined, Number.NaN).state.xp, 0, 'NaN XP was counted');
  });

  test('an item already owned pays coins instead', () => {
    // The Fire and Ice dice were on sale for a day before the pass.
    resetWalletForTests({ coins: 0, owned: ['fire'] });
    resetProgressForTests({ trophies: 0 });
    const level = SEASON_ITEMS.find((s) => s.item.id === 'fire')!.level;
    const paid = payPrize(asPrize(rewardFor(level)));
    assertEqual(paid.item, null, 'a second Fire die was handed over');
    assertEqual(paid.coins, SEASON_ITEM_WORTH, 'owning it already paid nothing at its level');
    assertEqual(getWallet().coins, SEASON_ITEM_WORTH, 'the coins never reached the wallet');
  });

  test('a new item goes into the cupboard', () => {
    resetWalletForTests({ coins: 0, owned: [] });
    resetProgressForTests({ trophies: 0 });
    const level = SEASON_ITEMS.find((s) => s.item.id === 'snow')!.level;
    const paid = payPrize(asPrize(rewardFor(level)));
    assert(paid.item !== null, 'nothing was handed over');
    assert(owns(arenaKey('snow')), 'Snowy Hollow is not in the cupboard');
    assert(isArenaUnlocked('snow', 0), 'Snowy Hollow cannot be used after winning it');
  });
});

suite('season pass · the only way in', () => {
  test('the Fire and Ice dice cannot be bought or climbed to', () => {
    for (const id of ['fire', 'ice']) {
      const skin = skinById(id);
      assert(skin.pass === true, `${id} is not a pass die`);
      assert(!STORE_SKINS.includes(skin), `${id} is on the Store shelf`);
      assert(!LADDER_SKINS.includes(skin), `${id} is on the trophy ladder`);
      resetWalletForTests({ coins: 999999, owned: [] });
      assert(!isSkinUnlocked(id, 99999), `${id} is usable without the pass`);
    }
    assertEqual(DICE_SKINS.filter((s) => s.pass).length, 2, 'the pass has the wrong number of dice');
  });

  test('Snowy Hollow and Volcano Rim cannot be bought or climbed to', () => {
    resetWalletForTests({ coins: 999999, owned: [] });
    resetProgressForTests({ trophies: 99999 });
    for (const id of ['snow', 'volcano'] as const) {
      assertEqual(ARENA_UNLOCKS[id], undefined, `${id} is still on the trophy ladder`);
      assertEqual(ARENA_PRICES[id], undefined, `${id} is for sale`);
      assert(!isArenaUnlocked(id, 99999), `${id} is usable without the pass`);
    }
    assert(!TIERS.some((t) => /snow|volcano/.test(t.id)), 'a ladder rung still names them');
  });

  test('whoever had already earned them on the ladder keeps them — once', () => {
    resetWalletForTests({ coins: 0, owned: [] });
    resetProgressForTests({ trophies: 2000 });
    const kept = keepPassArenas();
    assertEqual(kept.join(','), 'snow', 'the wrong battlefields were kept');
    assert(owns(arenaKey('snow')), 'Snowy Hollow was taken away from somebody who had earned it');
    assert(!owns(arenaKey('volcano')), 'Volcano Rim was handed to somebody who had not');
    assert(getProgress().passArenasKept === true, 'the hand-over is not recorded');

    // Crossing Volcano Rim's old number later does NOT hand it over:
    // the old ladder must not stay open through the back door.
    resetProgressForTests({ ...getProgress(), trophies: 9000 });
    assertEqual(keepPassArenas().length, 0, 'the old ladder is still handing out battlefields');
    assert(!owns(arenaKey('volcano')), 'Volcano Rim came through the back door');
  });

  test('somebody below both old rungs keeps nothing, and loses nothing', () => {
    resetWalletForTests({ coins: 0, owned: [arenaKey('farm'), 'zebra'] });
    resetProgressForTests({ trophies: 500 });
    assertEqual(keepPassArenas().length, 0, 'a battlefield was handed out');
    assertEqual(getWallet().owned.join(','), `${arenaKey('farm')},zebra`, 'the cupboard was changed');
  });
});

suite('season pass · the ladder it came out of', () => {
  test('no rung moved UP when the two left', () => {
    /*
      Taking Snowy Hollow and Volcano Rim off the ladder left two holes,
      and closing them moved rungs. Moving one UP would lock it again for
      anybody between its old number and its new one. These are the
      numbers from before 30 Sep 2026.
    */
    const before: Record<string, number> = {
      'ruby-dice': 1850, 'desert-arena': 2275, 'ocean-dice': 2750, 'autumn-arena': 3250,
      'lavender-dice': 3800, 'aurora-arena': 4400, 'slate-dice': 5050, 'blossom-dice': 6500,
      'cavern-arena': 7300, 'copper-dice': 8150, 'sky-arena': 9050, 'moon-arena': 10000,
    };
    for (const [id, was] of Object.entries(before)) {
      const now = TIERS.find((t) => t.id === id)!.at;
      assert(now <= was, `${id} moved up from ${was} to ${now} — somebody just lost it`);
    }
  });
});

suite('season pass · the battle screen', () => {
  const screen = readFileSync('src/demo/DiceDemoScreen.tsx', 'utf8');

  test('experience is earned inside the paid path, never by a friendly', () => {
    const friendlyReturn = screen.indexOf('setLastXp(0);\n        return;');
    const earned = screen.indexOf('const xp = battleXp(outcome, difficultyRef.current);');
    assert(friendlyReturn > 0 && earned > 0, 'the season payout has moved');
    assert(earned > friendlyReturn, 'a friendly battle earns experience');
    // And before the tie's early return, so a draw counts.
    const tie = screen.indexOf("if (outcome === 'tie') {\n        showCallout");
    assert(tie > earned, 'a draw earns no experience');
  });

  test('every level reached is paid and announced', () => {
    assert(/for \(const level of climbed\.reached\)/.test(screen), 'levels reached are not paid');
    assert(/payPrize\(asPrize\(reward\)\)/.test(screen), 'a level is paid some other way than payPrize');
    assert(/kicker: 'SEASON PASS'/.test(screen), 'a level reached is never announced');
  });

  test('the pass is on the Cups tab', () => {
    const cups = readFileSync('src/demo/TournamentScreen.tsx', 'utf8');
    assert(/<SeasonPassCard state=\{season\}/.test(cups), 'the season pass is not drawn');
    assert(/season=\{season\}/.test(screen), 'the Cups tab is not told where the player stands');
  });
});
