import './storageMock';
import { suite, test, assert, assertEqual } from './harness';
import {
  ACHIEVEMENTS,
  achievementReports,
  currentAchievementState,
  LEADERBOARD_TROPHIES,
  LEADERBOARD_WINS,
  mayPost,
  setsOwned,
} from '../src/game/achievements';
import { DICE_SKINS } from '../src/game/diceSkins';
import { MODE_ORDER } from '../src/game/modes';
import {
  hasCheated,
  Progress,
  resetProgressForTests,
  setTrophies,
  setUnlockAll,
  TIERS,
} from '../src/game/progress';
import { buyWithCoins, grantCoins, resetWalletForTests, setCoins } from '../src/game/currency';
import { setNativeForTests, sync } from '../src/game/gameCenter';

/**
 * The IDs recorded in App Store Connect on 23 Aug 2026, read back from
 * Apple's own API rather than retyped from the setup document.
 *
 * This is the one thing in the whole feature that CANNOT be fixed later:
 * Apple will not let an achievement identifier be renamed or deleted once
 * it has shipped, so a typo is a dead achievement for the life of the app.
 * A test that only checked the constants against themselves would pass on
 * a typo, so the expected values are pinned here by hand from the API.
 */
const LIVE_ACHIEVEMENT_IDS = [
  'papershipstudio.dicebattles.firstwin',
  'papershipstudio.dicebattles.wins10',
  'papershipstudio.dicebattles.wins50',
  'papershipstudio.dicebattles.hardwin',
  'papershipstudio.dicebattles.allmodes',
  'papershipstudio.dicebattles.trophies100',
  'papershipstudio.dicebattles.trophies290',
  'papershipstudio.dicebattles.trophies850',
  'papershipstudio.dicebattles.trophies1150',
  'papershipstudio.dicebattles.collector',
];

function emptyProgress(over: Partial<Progress> = {}): Progress {
  return {
    trophies: 0,
    wins: { easy: 0, medium: 0, hard: 0 },
    modeWins: { classic: 0, ultimate: 0, skirmish: 0, colorwar: 0 },
    ...over,
  };
}

suite('game center ids', () => {
  test('every achievement id matches the one live in App Store Connect', () => {
    const mine = ACHIEVEMENTS.map((a) => a.id).sort();
    assertEqual(
      mine.join('\n'),
      [...LIVE_ACHIEVEMENT_IDS].sort().join('\n'),
      'achievement ids have drifted from App Store Connect',
    );
  });

  test('leaderboard ids match', () => {
    assertEqual(LEADERBOARD_TROPHIES, 'papershipstudio.dicebattles.trophies', 'trophy board');
    assertEqual(LEADERBOARD_WINS, 'papershipstudio.dicebattles.wins', 'wins board');
  });

  test('no id carries a personal name', () => {
    // David asked for this specifically: the studio's name, not the family's.
    const all = [...ACHIEVEMENTS.map((a) => a.id), LEADERBOARD_TROPHIES, LEADERBOARD_WINS];
    for (const id of all) {
      assert(!/sutton|dmsutton/i.test(id), `${id} carries a personal name`);
      assert(id.startsWith('papershipstudio.dicebattles.'), `${id} is not under the studio prefix`);
    }
  });
});

suite('achievement rules', () => {
  test('a brand new save has earned nothing', () => {
    const reports = achievementReports(currentAchievementState(emptyProgress()));
    for (const r of reports) {
      // Ivory is free, so Collector starts above zero — but not earned.
      assert(r.percent < 100, `${r.id} earned on a fresh save at ${r.percent}%`);
    }
  });

  test('percent never leaves 0..100 even far past the target', () => {
    const state = currentAchievementState(
      emptyProgress({ trophies: 99_999, wins: { easy: 900, medium: 900, hard: 900 } }),
    );
    for (const r of achievementReports(state)) {
      assert(r.percent >= 0 && r.percent <= 100, `${r.id} reported ${r.percent}%`);
    }
  });

  test('the first win earns First Victory and only that', () => {
    const state = currentAchievementState(
      emptyProgress({ wins: { easy: 1, medium: 0, hard: 0 } }),
    );
    const earned = achievementReports(state).filter((r) => r.percent >= 100);
    assertEqual(earned.length, 1, 'exactly one achievement from one easy win');
    assertEqual(earned[0].id, 'papershipstudio.dicebattles.firstwin', 'which one');
  });

  test('a win on Hard earns The Hard Way as well as First Victory', () => {
    const state = currentAchievementState(
      emptyProgress({ wins: { easy: 0, medium: 0, hard: 1 } }),
    );
    const earned = achievementReports(state)
      .filter((r) => r.percent >= 100)
      .map((r) => r.id)
      .sort();
    assertEqual(
      earned.join(','),
      'papershipstudio.dicebattles.firstwin,papershipstudio.dicebattles.hardwin',
      'hard win earns both',
    );
  });

  test('Every Way to Play needs all four modes, not four wins', () => {
    const oneMode = currentAchievementState(
      emptyProgress({ modeWins: { classic: 40, ultimate: 0, skirmish: 0, colorwar: 0 } }),
    );
    const allModes = currentAchievementState(
      emptyProgress({ modeWins: { classic: 1, ultimate: 1, skirmish: 1, colorwar: 1 } }),
    );
    const pct = (s: typeof oneMode) =>
      achievementReports(s).find((r) => r.id === 'papershipstudio.dicebattles.allmodes')!.percent;
    assertEqual(pct(oneMode), 25, 'forty wins in one mode is still one mode');
    assertEqual(pct(allModes), 100, 'one win in each mode earns it');
  });

  test('every trophy achievement lines up with a real rung of the ladder', () => {
    // A trophy achievement at a number no tier uses would be a milestone
    // the game never celebrates anywhere else.
    for (const a of ACHIEVEMENTS) {
      const match = /trophies(\d+)$/.exec(a.id);
      if (!match) continue;
      assertEqual(a.need, Number(match[1]), `${a.id} target disagrees with its own id`);
      assert(
        TIERS.some((t) => t.at === a.need),
        `${a.id} sits at ${a.need} trophies, which is not a rung of the ladder`,
      );
    }
  });
});

suite('collector counting', () => {
  test('a fresh save owns only the free dice', () => {
    resetWalletForTests();
    assertEqual(setsOwned(0), 1, 'just Ivory');
  });

  test('climbing the ladder earns the ladder dice without buying them', () => {
    resetWalletForTests();
    const ladder = DICE_SKINS.filter((s) => s.price === undefined).length;
    assertEqual(setsOwned(99_999), ladder, 'every ladder die at the top');
  });

  test('bought dice count', () => {
    resetWalletForTests();
    grantCoins(5_000);
    const cheapest = DICE_SKINS.filter((s) => s.price !== undefined).sort(
      (a, b) => a.price! - b.price!,
    )[0];
    buyWithCoins(cheapest.id, cheapest.price!);
    assertEqual(setsOwned(0), 2, 'Ivory plus the one bought');
  });

  test('tester mode does NOT hand over the collection', () => {
    // The whole point: borrowing every die for an afternoon is not owning
    // them, and an achievement a code gives away is worth nothing.
    resetWalletForTests();
    setUnlockAll(true);
    const withTester = setsOwned(0);
    setUnlockAll(false);
    assertEqual(withTester, 1, 'tester mode still counts one owned set');
  });

  test('the target is reachable — there are more sets than it needs', () => {
    const collector = ACHIEVEMENTS.find((a) => a.id.endsWith('.collector'))!;
    assert(
      DICE_SKINS.length >= collector.need,
      `Collector needs ${collector.need} sets but the game only has ${DICE_SKINS.length}`,
    );
  });
});

suite('cheat codes and the shared board', () => {
  test('a save that has only ever been played may post', () => {
    resetProgressForTests();
    resetWalletForTests();
    assert(mayPost(), 'an untouched save is on the board');
  });

  test('tester mode alone does not take you off the board', () => {
    resetProgressForTests();
    setUnlockAll(true);
    assert(!hasCheated(), 'FAMILY unlocks cosmetics and fabricates no count');
    assert(mayPost(), 'so it stays on the board');
    setUnlockAll(false);
  });

  test('the trophy code takes you off the board', () => {
    resetProgressForTests();
    setTrophies(5_000);
    assert(hasCheated(), 'a typed trophy count flags the save');
    assert(!mayPost(), 'and stops it posting');
  });

  test('the coin code does too — typed coins buy real dice', () => {
    resetProgressForTests();
    resetWalletForTests();
    setCoins(50_000);
    assert(hasCheated(), 'a typed coin balance flags the save');
    assert(!mayPost(), 'and stops it posting');
  });

  test('the flag survives turning tester mode back off', () => {
    // Otherwise FAMILY-on, code, FAMILY-off would be a two-step laundry
    // for a typed number that is still sitting in the save.
    resetProgressForTests();
    setTrophies(9_000);
    setUnlockAll(true);
    setUnlockAll(false);
    assert(!mayPost(), 'still off the board');
  });
});

suite('achievement coverage', () => {
  test('every mode and difficulty the game has is reachable in the list', () => {
    assertEqual(MODE_ORDER.length, 4, 'four modes');
    const allmodes = ACHIEVEMENTS.find((a) => a.id.endsWith('.allmodes'))!;
    assertEqual(allmodes.need, MODE_ORDER.length, 'Every Way to Play tracks the real mode count');
  });

  test('no two achievements share an id', () => {
    const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
    assertEqual(ids.size, ACHIEVEMENTS.length, 'duplicate achievement id');
  });

  test('every achievement needs at least one of something', () => {
    for (const a of ACHIEVEMENTS) {
      assert(a.need > 0, `${a.title} needs ${a.need}, which everyone has already`);
    }
  });
});

/**
 * The wrapper's own behaviour, against a fake Apple.
 *
 * `sync` is the one part of this feature that cannot be checked by reading
 * it — the interesting cases are a refused report and a dropped
 * connection, neither of which happens on a desk.
 */
suite('game center sync', () => {
  interface Call {
    kind: 'score' | 'achievement';
    id: string;
    value: number;
  }

  /** A stand-in for the native module, with a switch for failing. */
  function fakeApple(succeed: () => boolean) {
    const calls: Call[] = [];
    return {
      calls,
      isGameCenterAvailable: async () => true,
      authenticateLocalPlayer: async () => true,
      submitScore: async (score: number, id: string) => {
        calls.push({ kind: 'score', id, value: score });
        return succeed();
      },
      reportAchievement: async (id: string, percent: number) => {
        calls.push({ kind: 'achievement', id, value: percent });
        return succeed();
      },
      presentLeaderboard: async () => {},
      presentAchievements: async () => {},
    };
  }

  test('an accepted report is not sent twice', async () => {
    resetProgressForTests({ trophies: 120, wins: { easy: 3, medium: 0, hard: 0 } });
    resetWalletForTests();
    const apple = fakeApple(() => true);
    setNativeForTests(apple);

    await sync();
    const first = apple.calls.length;
    assert(first > 0, 'the first sync sends something');
    await sync();
    assertEqual(apple.calls.length, first, 'a second sync with no change sends nothing');
  });

  test('a REFUSED report is sent again next time', async () => {
    resetProgressForTests({ trophies: 120, wins: { easy: 3, medium: 0, hard: 0 } });
    resetWalletForTests();
    let working = false;
    const apple = fakeApple(() => working);
    setNativeForTests(apple);

    await sync();
    const whileBroken = apple.calls.length;
    assert(whileBroken > 0, 'it tried');

    working = true;
    await sync();
    assertEqual(
      apple.calls.length,
      whileBroken * 2,
      'every refused report is retried once the connection is back',
    );
  });

  test('a save with a typed-in number sends nothing at all', async () => {
    resetProgressForTests({ trophies: 120, wins: { easy: 3, medium: 0, hard: 0 } });
    resetWalletForTests();
    setTrophies(9_999);
    const apple = fakeApple(() => true);
    setNativeForTests(apple);

    await sync();
    assertEqual(apple.calls.length, 0, 'nothing reaches the shared board');
  });

  test('with no native module, sync is a silent no-op', async () => {
    resetProgressForTests({ trophies: 500, wins: { easy: 9, medium: 0, hard: 0 } });
    setNativeForTests(null);
    // The assertion is that this resolves rather than throwing: on Android
    // and in Expo Go this runs after every single battle.
    await sync();
    assert(true, 'sync resolved without a native module');
  });

  test('an achievement nobody has started is not reported', async () => {
    resetProgressForTests({ trophies: 0, wins: { easy: 1, medium: 0, hard: 0 } });
    resetWalletForTests();
    const apple = fakeApple(() => true);
    setNativeForTests(apple);

    await sync();
    const reported = apple.calls.filter((c) => c.kind === 'achievement').map((c) => c.id);
    assert(
      !reported.includes('papershipstudio.dicebattles.trophies1150'),
      'a 0% achievement should not cost a network call',
    );
    assert(
      reported.includes('papershipstudio.dicebattles.firstwin'),
      'the one that WAS earned is reported',
    );
  });
});
