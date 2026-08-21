import { store } from './storageMock';
import {
  activeArena,
  activeDieBody,
  equipArena,
  equipSkin,
  getLoadout,
  loadLoadout,
} from '../src/game/loadout';
import { skinById } from '../src/game/diceSkins';
import {
  applyMatchResult,
  getProgress,
  isUnlocked,
  parseCoinCode,
  parseTrophyCode,
  setTrophies,
  COIN_CODE_MAX,
  TROPHY_CODE_MAX,
} from '../src/game/progress';
import { assert, assertEqual, suite, test } from './harness';

/**
 * What the game remembers between launches. The device is the only storage
 * this game has — no accounts, no server — so a broken round trip silently
 * resets a player's choices every time they open the app.
 */
suite('persistence · loadout', () => {
  test('the battlefield you picked is still there next launch', async () => {
    equipArena('jungle');
    // A fresh launch reads from storage rather than memory.
    const reloaded = await loadLoadout();
    assertEqual(reloaded.arenaId, 'jungle', 'battlefield was forgotten');
    assertEqual(activeArena(9999), 'jungle', 'a remembered battlefield is not used');
  });

  test('the dice you equipped are still there next launch', async () => {
    equipSkin('midnight');
    const reloaded = await loadLoadout();
    assertEqual(reloaded.skinId, 'midnight', 'dice skin was forgotten');
    assertEqual(
      activeDieBody(9999),
      skinById('midnight').body,
      'a remembered dice colour is not used',
    );
  });

  test('choices survive independently of each other', async () => {
    equipArena('space');
    equipSkin('mint');
    equipArena('castleSunset');
    const reloaded = await loadLoadout();
    assertEqual(reloaded.arenaId, 'castleSunset', 'battlefield');
    assertEqual(reloaded.skinId, 'mint', 'changing battlefield reset the dice');
  });

  test('junk in storage falls back instead of crashing the game', async () => {
    store.set('dice-battles:loadout', '{"arenaId":"atlantis","skinId":"rainbow"}');
    const reloaded = await loadLoadout();
    assertEqual(reloaded.arenaId, 'castle', 'unknown battlefield should fall back');
    assertEqual(reloaded.skinId, 'ivory', 'unknown dice should fall back');

    store.set('dice-battles:loadout', 'not json at all');
    const survived = await loadLoadout();
    assert(survived.arenaId.length > 0, 'corrupt storage broke the loadout');
  });

  test('an item that is no longer unlocked is not equipped', () => {
    // Family tester mode unlocks everything; turning it off must not leave
    // a player standing in an arena they cannot use.
    store.clear();
    equipArena('space');
    equipSkin('midnight');
    assertEqual(activeArena(0), 'castle', 'a locked battlefield stayed equipped');
    assertEqual(
      activeDieBody(0),
      skinById('ivory').body,
      'locked dice stayed equipped',
    );
    // The choice is remembered, just not used until it is earned again.
    assertEqual(getLoadout().arenaId, 'space', 'the choice itself was discarded');
    assertEqual(activeArena(9999), 'space', 'earning it back does not restore it');
  });
});

suite('codes · "500 TROPHY" sets the trophy count', () => {
  test('reads the number, either side of the word', () => {
    assertEqual(parseTrophyCode('500 TROPHY')?.trophies, 500, '500 TROPHY');
    assertEqual(parseTrophyCode('137 TROPHY')?.trophies, 137, '137 TROPHY');
    assertEqual(parseTrophyCode('TROPHY 42')?.trophies, 42, 'word first');
    assertEqual(parseTrophyCode('0 TROPHY')?.trophies, 0, 'zero is a real answer');
    // Typed by a child, so be forgiving about spacing and case.
    assertEqual(parseTrophyCode('  250trophy  ')?.trophies, 250, 'no space, padded');
    assertEqual(parseTrophyCode('250 trophy')?.trophies, 250, 'lower case');
  });

  test('anything that is not a trophy code returns null', () => {
    // Must be null rather than 0, or the caller cannot fall through to the
    // other codes and every wrong entry would wipe the player's trophies.
    for (const input of ['TROPHY', 'COIN', '500 COIN', 'RESET', '', 'FIVE TROPHY', 'TROPHY TROPHY', '-5 TROPHY', '1.5 TROPHY', '500 TROPHIES']) {
      assertEqual(parseTrophyCode(input), null, `"${input}" should not parse`);
    }
  });

  test('an absurd number is capped rather than accepted', () => {
    const huge = parseTrophyCode('999999999999 TROPHY');
    assertEqual(huge?.trophies, TROPHY_CODE_MAX, 'capped value');
    assertEqual(huge?.clamped, true, 'reports that it capped');
    assertEqual(parseTrophyCode('500 TROPHY')?.clamped, false, 'a sane number is not capped');
  });

  test('setting the count reports the tiers it crosses', () => {
    store.clear();
    setTrophies(0);
    const up = setTrophies(500);
    assertEqual(up.trophies, 500, 'trophies after');
    assert(up.newUnlocks.length > 0, 'jumping to 500 should unlock several tiers');
    assert(
      up.newUnlocks.every((t) => t.at <= 500),
      'nothing above the new count should be reported as unlocked',
    );
  });

  test('going down relocks, and does not re-announce on the way back', () => {
    store.clear();
    setTrophies(0);
    setTrophies(500);
    const down = setTrophies(50);
    assertEqual(down.trophies, 50, 'trophies after going down');
    assertEqual(down.newUnlocks.length, 0, 'going down unlocks nothing');
    assert(down.delta < 0, 'delta should be negative');
    // Relocking is the point of being able to go down — it is how the
    // ladder gets tested from the bottom again.
    assertEqual(isUnlocked('sunset-castle', getProgress().trophies), false, 'sunset relocked');
  });

  test('wins are left alone — a cheat must not rewrite the record', () => {
    store.clear();
    setTrophies(0);
    applyMatchResult(true, 'easy', 'classic', () => 0.5);
    const winsBefore = getProgress().wins.easy;
    setTrophies(900);
    assertEqual(getProgress().wins.easy, winsBefore, 'easy wins unchanged');
  });
});

suite('codes · "500 COIN" sets the coin balance', () => {
  test('reads the number, either side of the word', () => {
    assertEqual(parseCoinCode('500 COIN')?.coins, 500, '500 COIN');
    assertEqual(parseCoinCode('137 COIN')?.coins, 137, '137 COIN');
    assertEqual(parseCoinCode('COIN 42')?.coins, 42, 'word first');
    assertEqual(parseCoinCode('0 COIN')?.coins, 0, 'zero is a real answer');
    // Typed by a child, so be forgiving about spacing and case.
    assertEqual(parseCoinCode('  250coin  ')?.coins, 250, 'no space, padded');
    assertEqual(parseCoinCode('250 coin')?.coins, 250, 'lower case');
  });

  test('anything that is not a coin code returns null', () => {
    // Must be null rather than 0, or the caller cannot fall through to the
    // other codes and every wrong entry would empty the player's wallet.
    for (const input of ['COIN', 'TROPHY', '500 TROPHY', 'RESET', '', 'FIVE COIN', 'COIN COIN', '-5 COIN', '1.5 COIN', '500 COINS']) {
      assertEqual(parseCoinCode(input), null, `"${input}" should not parse`);
    }
  });

  test('MONEY is no longer a code at all', () => {
    // It was replaced by "X COIN"; nothing should quietly still answer to it.
    assertEqual(parseCoinCode('MONEY'), null, 'MONEY does not parse');
    assertEqual(parseTrophyCode('MONEY'), null, 'MONEY is not a trophy code either');
  });

  test('an absurd number is capped rather than accepted', () => {
    const huge = parseCoinCode('999999999999 COIN');
    assertEqual(huge?.coins, COIN_CODE_MAX, 'capped value');
    assertEqual(huge?.clamped, true, 'reports that it capped');
    assertEqual(parseCoinCode('500 COIN')?.clamped, false, 'a sane number is not capped');
  });
});
