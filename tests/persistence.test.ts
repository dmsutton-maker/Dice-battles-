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
  loadProgress,
  parseCoinCode,
  parseTrophyCode,
  resetProgressForTests,
  setTrophies,
  COIN_CODE_MAX,
  TIERS,
  TROPHY_CODE_MAX,
  TROPHY_STAKES,
} from '../src/game/progress';
import type { AiDifficultyId } from '../src/game/ai';
import { MODE_ORDER } from '../src/game/modes';
import { assert, assertEqual, note, suite, test } from './harness';

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
    // 'not-a-skin', where this used to say 'rainbow' — which was a fine
    // fake id right up until 26 Aug 2026, when a real Rainbow skin
    // shipped and the fixture started loading it successfully.
    store.set('dice-battles:loadout', '{"arenaId":"atlantis","skinId":"not-a-skin"}');
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

suite('progress · what a battle does to the record', () => {
  /*
    applyMatchResult is the function that decides trophies, wins and
    unlocks after every single battle, and until 7 Sep 2026 it was called
    in exactly one test — which asserted only that a cheat code left the
    win counters alone. Nothing pinned the bands, the floor, the unlocks
    or the counters.

    It takes its `rng` as a parameter, so all of this is deterministic
    without touching the source, the same way currency.test.ts pins the
    coin bands.
  */
  const LOW = () => 0;
  const HIGH = () => 0.999999999;
  const DIFFICULTIES: AiDifficultyId[] = ['easy', 'medium', 'hard'];

  test('a win pays inside its difficulty band, every time', () => {
    for (const d of DIFFICULTIES) {
      const band = TROPHY_STAKES[d].win;
      resetProgressForTests({ trophies: 5000 });
      assertEqual(applyMatchResult(true, d, 'classic', LOW).delta, band.min,
        `${d}: the bottom of the win band`);
      resetProgressForTests({ trophies: 5000 });
      assertEqual(applyMatchResult(true, d, 'classic', HIGH).delta, band.max,
        `${d}: the top of the win band`);
      // And nothing outside it, across the whole range of the roll.
      for (let i = 0; i < 200; i++) {
        resetProgressForTests({ trophies: 5000 });
        const { delta } = applyMatchResult(true, d, 'classic', () => i / 200);
        assert(
          delta >= band.min && delta <= band.max,
          `${d}: a win paid ${delta}, outside ${band.min}-${band.max}`,
        );
      }
      note(`${d} win: ${band.min}-${band.max} trophies`);
    }
  });

  test('a loss costs inside its band, and never below zero', () => {
    for (const d of DIFFICULTIES) {
      const band = TROPHY_STAKES[d].loss;
      resetProgressForTests({ trophies: 5000 });
      assertEqual(applyMatchResult(false, d, 'classic', LOW).delta, -band.min,
        `${d}: the gentlest loss`);
      resetProgressForTests({ trophies: 5000 });
      assertEqual(applyMatchResult(false, d, 'classic', HIGH).delta, -band.max,
        `${d}: the worst loss`);
      note(`${d} loss: ${band.min}-${band.max} trophies`);
    }
  });

  test('losing on zero trophies takes nothing, and says so', () => {
    /*
      The floor and the honesty of the reported delta are one rule, not
      two. `after` clamps at zero and the returned delta is after-before
      rather than the roll — so a player on 2 trophies who loses 8 is
      told they lost 2, which is what actually happened. Reporting the
      roll would show "-8" beside a counter that only moved by two.
    */
    resetProgressForTests({ trophies: 0 });
    const flat = applyMatchResult(false, 'hard', 'classic', HIGH);
    assertEqual(flat.trophies, 0, 'trophies went negative');
    assertEqual(flat.delta, 0, 'a loss on zero reported a cost it did not take');

    resetProgressForTests({ trophies: 2 });
    const partial = applyMatchResult(false, 'hard', 'classic', HIGH);
    assertEqual(partial.trophies, 0, 'the floor did not hold');
    assertEqual(partial.delta, -2, 'the reported loss is not what was taken');
  });

  test('new unlocks are exactly the tiers crossed, and only on a win', () => {
    resetProgressForTests({ trophies: 0 });
    const { trophies, newUnlocks } = applyMatchResult(true, 'hard', 'classic', HIGH);
    const crossed = TIERS.filter((t) => t.at > 0 && t.at <= trophies);
    assertEqual(
      newUnlocks.map((t) => t.id).join(','),
      crossed.map((t) => t.id).join(','),
      'the unlocks reported are not the tiers actually crossed',
    );
    // A tier exactly ON the old count is NOT crossed again.
    const tier = TIERS.find((t) => t.at > 0)!;
    resetProgressForTests({ trophies: tier.at });
    const again = applyMatchResult(true, 'easy', 'classic', LOW);
    assert(
      !again.newUnlocks.some((t) => t.id === tier.id),
      `${tier.id} was awarded twice for standing on its own threshold`,
    );
    // And a loss never unlocks anything, however far it moves you.
    resetProgressForTests({ trophies: 5000 });
    assertEqual(
      applyMatchResult(false, 'hard', 'classic', HIGH).newUnlocks.length,
      0,
      'a loss handed out an unlock',
    );
  });

  test('the counters move on a win and stand still on a loss', () => {
    resetProgressForTests({ trophies: 100 });
    applyMatchResult(true, 'medium', 'skirmish', LOW);
    assertEqual(getProgress().wins.medium, 1, 'the medium win was not counted');
    assertEqual(getProgress().wins.easy, 0, 'a win counted against the wrong difficulty');
    assertEqual(getProgress().modeWins.skirmish, 1, 'the Skirmish win was not counted');
    assertEqual(getProgress().modeWins.classic, 0, 'a win counted against the wrong mode');

    applyMatchResult(false, 'medium', 'skirmish', LOW);
    assertEqual(getProgress().wins.medium, 1, 'a loss counted as a win');
    assertEqual(getProgress().modeWins.skirmish, 1, 'a loss counted as a mode win');
  });

  test('the smallest win always beats the biggest loss', () => {
    // The rule the stakes table states in its own comment: an unlucky
    // win followed by a lucky loss must never cost you rank for playing
    // well. Stated there, never checked until now.
    for (const d of DIFFICULTIES) {
      const { win, loss } = TROPHY_STAKES[d];
      assert(
        win.min > loss.max,
        `${d}: a ${win.min}-trophy win does not survive a ${loss.max}-trophy loss`,
      );
    }
  });
});

suite('persistence · old saves and broken ones', () => {
  /*
    loadProgress fills in fields that did not exist when a save was
    written — modeWins arrived after the game had shipped, and every
    phone in the family has a save from before it. None of that was
    tested, and a `undefined` where a count is expected is the kind of
    thing that renders as "NaN" on a Records page rather than crashing.
  */
  test('a save from before per-mode counting still opens', async () => {
    resetProgressForTests();
    store.set(
      'dice-battles:progress',
      JSON.stringify({ trophies: 420, wins: { easy: 3, medium: 1, hard: 0 } }),
    );
    const p = await loadProgress();
    assertEqual(p.trophies, 420, 'the trophies were lost');
    assertEqual(p.wins.easy, 3, 'the easy wins were lost');
    assertEqual(p.wins.medium, 1, 'the medium wins were lost');
    for (const mode of MODE_ORDER) {
      assertEqual(
        p.modeWins[mode],
        0,
        `${mode} came back as ${p.modeWins[mode]} rather than 0`,
      );
    }
  });

  test('a save with a field missing gets a zero, not an undefined', async () => {
    resetProgressForTests();
    store.set('dice-battles:progress', JSON.stringify({ trophies: 7 }));
    const p = await loadProgress();
    assertEqual(p.trophies, 7, 'the trophies were lost');
    for (const d of ['easy', 'medium', 'hard'] as const) {
      assertEqual(p.wins[d], 0, `wins.${d} is not a number`);
    }
  });

  test('a corrupt save is a fresh start, never a crash', async () => {
    // A half-written file after a kill, or a hand-edited backup. The
    // player loses their record, which is sad; the app not opening at
    // all is worse.
    for (const junk of ['{', 'null', '[]', 'not json at all', '']) {
      resetProgressForTests();
      store.set('dice-battles:progress', junk);
      const p = await loadProgress();
      assert(
        typeof p.trophies === 'number' && Number.isFinite(p.trophies),
        `a save of ${JSON.stringify(junk)} produced trophies of ${p.trophies}`,
      );
      assert(typeof p.wins?.easy === 'number', `a save of ${JSON.stringify(junk)} lost wins`);
    }
  });

  test('a battle result survives a round trip through storage', async () => {
    resetProgressForTests({ trophies: 100 });
    const after = applyMatchResult(true, 'hard', 'ultimate', () => 0.5);
    const reloaded = await loadProgress();
    assertEqual(reloaded.trophies, after.trophies, 'the trophies changed on the way back');
    assertEqual(reloaded.wins.hard, 1, 'the win was not written');
    assertEqual(reloaded.modeWins.ultimate, 1, 'the mode win was not written');
  });
});
