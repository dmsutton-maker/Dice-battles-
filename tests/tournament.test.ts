import { store } from './storageMock';
import { assert, assertEqual, note, suite, test } from './harness';
import {
  getProgress,
  hasCheated,
  loadProgress,
  resetProgressForTests,
  setTournamentState,
  tournamentStates,
  TIERS,
} from '../src/game/progress';
import {
  NO_PROGRESS,
  TOURNAMENTS,
  TournamentDef,
  TournamentState,
  advance,
  closingLabel,
  daysLeft,
  isComing,
  isOpen,
  isTournamentDef,
  liveTournaments,
  mergeTournaments,
  scoreBattle,
  stateOf,
  todayStamp,
  tournamentById,
} from '../src/game/tournament';
import { payPrize, resolveItem } from '../src/game/prizes';
import { getWallet, grantItem, owns, resetWalletForTests } from '../src/game/currency';
import { DICE_SKINS, LADDER_SKINS, PRIZE_SKINS, STORE_SKINS } from '../src/game/diceSkins';
import { isSkinUnlocked } from '../src/game/loadout';
import { setsOwned } from '../src/game/achievements';
import { MODE_ORDER } from '../src/game/modes';
import {
  actionLabel,
  isActionPressable,
  previewAction,
} from '../src/game/itemPreview';
import { averageOf } from '../src/game/rewards';

/**
 * Cups, reworked into tournaments.
 *
 * David, 25 Sep 2026: "Rework the entire cups tab to be online
 * tournaments, against AI for now, with unique rewards like some extra
 * gold, trophies, and even a dice or arena. You should have to achieve a
 * certain amount of wins in a row in the specific game mode and
 * difficulty of the tournament."
 *
 * The old suite tested a knockout bracket — rounds, halving fields, entry
 * fees — and none of that exists any more, so none of it is adapted. What
 * is tested here instead is the three things a player can actually be
 * cheated by: a battle counting toward the wrong tournament, a streak
 * that does not survive the app being killed, and a prize that is
 * promised and not handed over.
 */

const EASY_RUSH = { mode: 'classic', difficulty: 'easy', outcome: 'won' } as const;

/** A tournament to try the rules on, with nothing else in play. */
const CUP: TournamentDef = {
  id: 'test-cup',
  name: 'Test Cup',
  blurb: 'Three in a row.',
  mode: 'classic',
  difficulty: 'easy',
  target: 3,
  prize: { coins: { min: 10, max: 10 }, trophies: 5 },
};

suite('cups · the four that ship with the game', () => {
  test('there is one for every way to play', () => {
    /*
      The old three cups were three difficulties of the same game, so two
      of the four modes had nothing at all to play for. Every mode now
      has a reason to be opened.
    */
    const modes = TOURNAMENTS.map((t) => t.mode);
    assertEqual(
      new Set(modes).size,
      MODE_ORDER.length,
      `the bundled cups only cover ${new Set(modes).size} of the ${MODE_ORDER.length} modes`,
    );
    assertEqual(new Set(TOURNAMENTS.map((t) => t.id)).size, TOURNAMENTS.length,
      'two bundled cups share an id');
  });

  test('none of them has a closing day', () => {
    /*
      THE ONE THING A BUNDLED CUP MUST NOT HAVE.

      A tournament past its closing day is dropped from the list. A
      bundled one carries a date baked into the binary, so a phone that
      never gets another update would reach that date and find the Cups
      tab permanently empty, with no way for anyone to fix it. Dates
      belong to the fetched ones, which can be replaced.
    */
    for (const t of TOURNAMENTS) {
      assert(!t.closes, `${t.name} ships with a closing day and will expire offline`);
      assert(!t.opens, `${t.name} ships unopened and may never open`);
    }
  });

  test('asking more pays more', () => {
    const order = ['easy', 'medium', 'hard'];
    const effort = (t: TournamentDef) =>
      order.indexOf(t.difficulty) * 10 + t.target;
    const worth = (t: TournamentDef) =>
      averageOf(t.prize.coins) + t.prize.trophies * 10;
    const sorted = [...TOURNAMENTS].sort((a, b) => effort(a) - effort(b));
    for (let i = 1; i < sorted.length; i++) {
      assert(
        worth(sorted[i]) > worth(sorted[i - 1]),
        `${sorted[i].name} is harder than ${sorted[i - 1].name} and pays no better`,
      );
    }
  });

  test('every prize is something this game actually has', () => {
    /*
      A prize naming a die or battlefield that does not exist would be
      promised on the card and skipped at the moment of winning, which is
      the worst possible time to find out.
    */
    for (const t of TOURNAMENTS) {
      if (!t.prize.item) continue;
      const resolved = resolveItem(t.prize.item);
      assert(
        resolved !== null,
        `${t.name} promises a ${t.prize.item.kind} called "${t.prize.item.id}" that does not exist`,
      );
      note(`${t.name} → ${resolved!.name}`);
    }
  });

  test('a die and a battlefield are both given away', () => {
    // "even a dice or arena" — both kinds, so neither route is untested
    // on a real player's phone.
    const kinds = new Set(
      TOURNAMENTS.filter((t) => t.prize.item).map((t) => t.prize.item!.kind),
    );
    assert(kinds.has('dice'), 'no cup gives away a die');
    assert(kinds.has('arena'), 'no cup gives away a battlefield');
  });
});

suite('cups · a battle only counts where it should', () => {
  test('a win in the right mode and difficulty moves the streak', () => {
    const { state, justWon } = advance(CUP, NO_PROGRESS, EASY_RUSH);
    assertEqual(state.streak, 1, 'a matching win did not count');
    assertEqual(state.best, 1, 'the best run was not updated');
    assert(!justWon, 'one win of three took the prize');
  });

  test('the wrong mode and the wrong difficulty both count for nothing', () => {
    /*
      THE TEST THE WHOLE REWORK TURNS ON. David asked for the wins to be
      "in the specific game mode and difficulty of the tournament", and
      every battle in the game is now offered to every tournament — so
      the only thing standing between an Easy Color Rush win and the Hard
      Ultimate cup is this check.
    */
    const wrongMode = advance(CUP, NO_PROGRESS, { ...EASY_RUSH, mode: 'ultimate' });
    assertEqual(wrongMode.state.streak, 0, 'a win in another mode counted');

    const wrongDifficulty = advance(CUP, NO_PROGRESS, {
      ...EASY_RUSH,
      difficulty: 'hard',
    });
    assertEqual(wrongDifficulty.state.streak, 0, 'a win at another difficulty counted');
  });

  test('a loss goes back to nothing, however far in', () => {
    const three: TournamentState = { streak: 2, best: 2, won: false };
    const { state } = advance(CUP, three, { ...EASY_RUSH, outcome: 'lost' });
    assertEqual(state.streak, 0, 'a defeat did not break the run');
    assertEqual(state.best, 2, 'a defeat wiped the best run as well');
  });

  test('a loss in another mode does not break this run', () => {
    const two: TournamentState = { streak: 2, best: 2, won: false };
    const { state } = advance(CUP, two, {
      mode: 'skirmish',
      difficulty: 'easy',
      outcome: 'lost',
    });
    assertEqual(state.streak, 2, 'a defeat somewhere else broke the run');
  });

  test('a draw leaves the run exactly where it was', () => {
    /*
      Skirmish is the reason this rule exists: it is the one mode that
      can end level, and it does so often enough that "four in a row"
      would quietly mean something much harsher there than in the other
      three. A draw is not a win, so it does not advance; it is not a
      defeat either, so it does not wipe four evenings of work.
    */
    const two: TournamentState = { streak: 2, best: 2, won: false };
    const { state } = advance(CUP, two, { ...EASY_RUSH, outcome: 'tie' });
    assertEqual(state.streak, 2, 'a draw moved the run');
    assert(state === two, 'a draw wrote a new state for no reason');
  });

  test('reaching the target wins it once and only once', () => {
    let state = NO_PROGRESS;
    let wins = 0;
    for (let i = 0; i < CUP.target; i++) {
      const out = advance(CUP, state, EASY_RUSH);
      state = out.state;
      if (out.justWon) wins += 1;
    }
    assertEqual(wins, 1, 'the prize was not won exactly once');
    assert(state.won, 'the cup is not marked as won');

    // Break the run and do it all again: no second prize.
    state = advance(CUP, state, { ...EASY_RUSH, outcome: 'lost' }).state;
    for (let i = 0; i < CUP.target; i++) {
      const out = advance(CUP, state, EASY_RUSH);
      state = out.state;
      if (out.justWon) wins += 1;
    }
    assertEqual(wins, 1, 'a second run paid the prize a second time');
    assertEqual(state.best, CUP.target, 'the best run was lost along the way');
  });

  test('a defeat with no run going writes nothing at all', () => {
    // The screen and the save both use identity to decide whether
    // anything changed. Losing an Easy battle must not write six rows.
    const { state } = advance(CUP, NO_PROGRESS, { ...EASY_RUSH, outcome: 'lost' });
    assert(state === NO_PROGRESS, 'a loss with no streak still produced a new state');
  });

  test('a player who has never played one reads as a clean slate', () => {
    assertEqual(stateOf({}, 'never-heard-of-it').streak, 0, 'an unknown cup has a streak');
    assertEqual(stateOf({}, 'never-heard-of-it').won, false, 'an unknown cup is won');
  });
});

suite('cups · one battle, every cup', () => {
  /*
    The rule that replaced entering a cup: a finished battle is offered
    to ALL of them and each decides for itself whether it counts. That
    lives out here rather than inside finishRound for the reason
    friendsLoad does — it is the interesting part, and a grep through a
    React component cannot check it.
  */
  const easyRush: TournamentDef = { ...CUP, id: 'easy-rush' };
  const alsoEasyRush: TournamentDef = { ...CUP, id: 'also-easy-rush', target: 2 };
  const hardWar: TournamentDef = {
    ...CUP,
    id: 'hard-war',
    mode: 'colorwar',
    difficulty: 'hard',
  };
  const all = [easyRush, alsoEasyRush, hardWar];

  test('two cups asking for the same thing both move at once', () => {
    /*
      Impossible under the old rules, where you were IN one cup. It is
      the reason a seasonal cup can share a mode and difficulty with a
      permanent one and both count — which is exactly what the Autumn
      Rush on the server does.
    */
    const { changed } = scoreBattle(all, {}, EASY_RUSH);
    assertEqual(
      Object.keys(changed).sort().join(','),
      'also-easy-rush,easy-rush',
      'a win did not reach both cups that wanted it',
    );
    assertEqual(changed['hard-war'], undefined, 'a cup in another mode moved');
  });

  test('a battle nobody is running writes nothing at all', () => {
    // Every finished battle passes through here, so the common case has
    // to be free: no rows written, no state set, no re-render.
    const { changed, won } = scoreBattle(all, {}, {
      mode: 'skirmish',
      difficulty: 'hard',
      outcome: 'won',
    });
    assertEqual(Object.keys(changed).length, 0, 'an unrelated win wrote state');
    assertEqual(won.length, 0, 'an unrelated win won something');
  });

  test('one battle can finish two cups, in the order they are shown', () => {
    const states = {
      'easy-rush': { streak: 2, best: 2, won: false },
      'also-easy-rush': { streak: 1, best: 1, won: false },
    };
    const { won } = scoreBattle(all, states, EASY_RUSH);
    assertEqual(
      won.map((t) => t.id).join(','),
      'easy-rush,also-easy-rush',
      'two cups finished by one win came back in the wrong order, or not at all',
    );
  });

  test('a cup already won is never won again', () => {
    const states = { 'easy-rush': { streak: 9, best: 9, won: true } };
    const { won } = scoreBattle(all, states, EASY_RUSH);
    assert(
      !won.some((t) => t.id === 'easy-rush'),
      'a cup already won paid out a second time',
    );
  });

  test('a defeat breaks only the runs it was actually in', () => {
    const states = {
      'easy-rush': { streak: 2, best: 2, won: false },
      'hard-war': { streak: 3, best: 3, won: false },
    };
    const { changed } = scoreBattle(all, states, { ...EASY_RUSH, outcome: 'lost' });
    assertEqual(changed['easy-rush'].streak, 0, 'the run in this mode survived a defeat');
    assertEqual(changed['hard-war'], undefined, 'a defeat broke a run in another mode');
  });
});

suite('cups · the days one runs', () => {
  const dated = (opens?: string, closes?: string): TournamentDef => ({
    ...CUP,
    opens,
    closes,
  });

  test('a cup with no dates is always on', () => {
    assert(isOpen(CUP, '2026-09-25'), 'an undated cup was closed');
    assertEqual(daysLeft(CUP, '2026-09-25'), null, 'an undated cup is counting down');
    assertEqual(closingLabel(CUP, '2026-09-25'), null, 'an undated cup shows a deadline');
  });

  test('both ends of the window are included', () => {
    const t = dated('2026-10-01', '2026-10-07');
    assert(!isOpen(t, '2026-09-30'), 'it opened a day early');
    assert(isOpen(t, '2026-10-01'), 'it was shut on its opening day');
    assert(isOpen(t, '2026-10-07'), 'it shut on its closing day');
    assert(!isOpen(t, '2026-10-08'), 'it was still open the day after it closed');
  });

  test('not started yet and already finished are different answers', () => {
    const t = dated('2026-10-01', '2026-10-07');
    assert(isComing(t, '2026-09-20'), 'a cup that has not opened is not shown as coming');
    assert(!isComing(t, '2026-10-20'), 'a finished cup is shown as coming back');
  });

  test('the countdown reads the way a person would say it', () => {
    const t = dated(undefined, '2026-10-07');
    assertEqual(closingLabel(t, '2026-10-07'), 'Last day', 'the last day');
    assertEqual(closingLabel(t, '2026-10-06'), '1 day left', 'one day');
    assertEqual(closingLabel(t, '2026-10-04'), '3 days left', 'three days');
  });

  test('the list drops what is over and shows the easiest first', () => {
    const hard: TournamentDef = { ...CUP, id: 'hard', difficulty: 'hard' };
    const medium: TournamentDef = { ...CUP, id: 'medium', difficulty: 'medium' };
    const gone: TournamentDef = { ...CUP, id: 'gone', closes: '2026-01-01' };
    const soon: TournamentDef = { ...CUP, id: 'soon', opens: '2026-12-01' };
    const shown = liveTournaments([hard, gone, soon, medium, CUP], '2026-09-25');
    assertEqual(
      shown.map((t) => t.id).join(','),
      'test-cup,medium,hard,soon',
      'the list is in the wrong order or kept a finished cup',
    );
  });

  test('today is read in the phone’s own time zone', () => {
    /*
      LOCAL, not UTC. A cup closing "on the 30th" has to close at the end
      of the 30th where the player is — reading UTC would end it at four
      in the afternoon in California, on a day the phone still calls the
      30th.
    */
    const noon = new Date(2026, 8, 25, 12, 0, 0);
    assertEqual(todayStamp(noon), '2026-09-25', 'midday came out as the wrong day');
    // Late evening is the case UTC gets wrong for anyone west of London.
    const lateEvening = new Date(2026, 8, 25, 23, 30, 0);
    assertEqual(todayStamp(lateEvening), '2026-09-25', 'a late evening rolled over early');
  });
});

suite('cups · what arrives from the server', () => {
  const good = {
    id: 'live-one',
    name: 'Live One',
    blurb: 'From the board.',
    mode: 'skirmish',
    difficulty: 'hard',
    target: 6,
    prize: { coins: { min: 10, max: 20 }, trophies: 5 },
  };

  test('a well-formed row is accepted', () => {
    assert(isTournamentDef(good), 'a good row was rejected');
    assert(
      isTournamentDef({ ...good, opens: '2026-10-01', closes: '2026-10-31' }),
      'dates were rejected',
    );
    assert(
      isTournamentDef({ ...good, prize: { ...good.prize, item: { kind: 'dice', id: 'gold' } } }),
      'an item prize was rejected',
    );
  });

  test('anything the game could not actually run is dropped', () => {
    /*
      Stricter than the news feed on purpose. A malformed post costs a
      post; a malformed tournament could ask for a mode that does not
      exist and never advance at all, or promise a prize with no number
      in it. Each of these is one field away from valid.
    */
    const bad: [string, unknown][] = [
      ['no id', { ...good, id: '' }],
      ['no name', { ...good, name: '' }],
      ['a mode this game has never had', { ...good, mode: 'chess' }],
      ['a difficulty this game has never had', { ...good, difficulty: 'nightmare' }],
      ['a target of zero', { ...good, target: 0 }],
      ['half a win', { ...good, target: 2.5 }],
      ['no prize at all', { ...good, prize: undefined }],
      ['coins that are not a band', { ...good, prize: { coins: 50, trophies: 5 } }],
      ['negative trophies', { ...good, prize: { ...good.prize, trophies: -1 } }],
      ['a date that is not a date', { ...good, closes: 'next Tuesday' }],
      ['an item with no kind', { ...good, prize: { ...good.prize, item: { id: 'gold' } } }],
      ['not an object at all', 'a tournament'],
      ['nothing', null],
    ];
    for (const [what, row] of bad) {
      assert(!isTournamentDef(row), `a row with ${what} was accepted`);
    }
  });

  test('the server can retune a cup the game already ships with', () => {
    /*
      The useful half of merging by id: a target that turned out too hard
      or a prize that turned out too thin can be fixed for every
      installed copy without shipping anything.
    */
    const retuned = { ...TOURNAMENTS[0], target: 2 };
    const merged = mergeTournaments(TOURNAMENTS, [retuned]);
    assertEqual(merged.length, TOURNAMENTS.length, 'the override added a second copy');
    assertEqual(
      tournamentById(TOURNAMENTS[0].id, merged)!.target,
      2,
      'the server’s version did not win',
    );
  });

  test('a server with nothing to say leaves the bundled four', () => {
    assertEqual(
      mergeTournaments(TOURNAMENTS, []).length,
      TOURNAMENTS.length,
      'an empty feed emptied the tab',
    );
  });
});

suite('cups · the prize is actually handed over', () => {
  test('coins and trophies both arrive, and the save is not flagged', () => {
    /*
      The trophies are EARNED, so they must not go through setTrophies,
      which is the cheat code and shuts the save out of Game Center. A
      player locked off the shared board for winning a tournament would
      be punished for playing the game properly.
    */
    resetProgressForTests({ trophies: 100 });
    resetWalletForTests({ coins: 0, owned: [] });
    const paid = payPrize({ coins: { min: 50, max: 50 }, trophies: 25 });
    assertEqual(paid.coins, 50, 'the coins were not rolled');
    assertEqual(getWallet().coins, 50, 'the coins never reached the wallet');
    assertEqual(getProgress().trophies, 125, 'the trophies never reached the save');
    assert(!hasCheated(), 'winning a cup flagged the save as cheated');
  });

  test('a trophy tier crossed by the prize unlocks there and then', () => {
    const rung = TIERS.find((t) => t.at > 0)!;
    resetProgressForTests({ trophies: rung.at - 1 });
    resetWalletForTests({ coins: 0, owned: [] });
    const paid = payPrize({ coins: { min: 0, max: 0 }, trophies: 1 });
    assertEqual(
      paid.unlocked.map((u) => u.id).join(','),
      rung.id,
      'crossing a rung on a prize unlocked nothing',
    );
  });

  test('the die is put in the cupboard', () => {
    resetProgressForTests();
    resetWalletForTests({ coins: 0, owned: [] });
    const paid = payPrize({
      coins: { min: 0, max: 0 },
      trophies: 0,
      item: { kind: 'dice', id: 'champion' },
    });
    assert(paid.item !== null, 'nothing was handed over');
    assert(owns('champion'), 'the die was promised and never given');
  });

  test('the battlefield is put in the cupboard under its own key', () => {
    resetProgressForTests();
    resetWalletForTests({ coins: 0, owned: [] });
    payPrize({
      coins: { min: 0, max: 0 },
      trophies: 0,
      item: { kind: 'arena', id: 'beach' },
    });
    /*
      `arena:beach`, not `beach`. Battlefields and dice share one list in
      the wallet and nothing stops a future skin being called beach — a
      collision there would hand over two things for one prize.
    */
    assert(owns('arena:beach'), 'the battlefield went in under the wrong key');
    assert(!owns('beach'), 'the battlefield went in unprefixed');
  });

  test('already owning it pays its price in coins instead', () => {
    /*
      A prize that silently evaporates because you bought the
      battlefield last week is worse than no item prize at all, and a
      second copy of something is not a prize either.
    */
    resetProgressForTests();
    resetWalletForTests({ coins: 0, owned: [] });
    grantItem('arena:beach');
    const paid = payPrize({
      coins: { min: 100, max: 100 },
      trophies: 0,
      item: { kind: 'arena', id: 'beach' },
    });
    assertEqual(paid.item, null, 'a second copy was handed over');
    assert(paid.insteadOf !== null, 'nothing said why the item was skipped');
    assertEqual(paid.coins, 100 + 1100, 'the battlefield’s price was not paid instead');
    assertEqual(getWallet().coins, 1200, 'the coins never reached the wallet');
  });

  test('a prize naming something that does not exist still pays the rest', () => {
    resetProgressForTests();
    resetWalletForTests({ coins: 0, owned: [] });
    const paid = payPrize({
      coins: { min: 40, max: 40 },
      trophies: 3,
      item: { kind: 'dice', id: 'a-die-from-a-later-version' },
    });
    assertEqual(paid.item, null, 'a die this game has never heard of was handed over');
    assertEqual(paid.coins, 40, 'the coins were withheld over a bad item');
    assertEqual(getProgress().trophies, 3, 'the trophies were withheld over a bad item');
  });
});

suite('cups · the Champion die is won and nothing else', () => {
  test('it is not free, not on the shelf and not on the ladder', () => {
    resetProgressForTests();
    resetWalletForTests({ coins: 999_999, owned: [] });
    const champion = DICE_SKINS.find((s) => s.id === 'champion')!;
    assert(champion.prize === true, 'the Champion die is not marked as a prize');
    assert(
      !STORE_SKINS.some((s) => s.id === 'champion'),
      'the Champion die is on the Store shelf',
    );
    assert(
      !LADDER_SKINS.some((s) => s.id === 'champion'),
      'the Champion die is on the trophy ladder',
    );
    assert(
      !isSkinUnlocked('champion', 999_999),
      'every trophy in the game unlocked a die that is only ever won',
    );
  });

  test('winning it is the way in', () => {
    resetProgressForTests();
    resetWalletForTests({ coins: 0, owned: [] });
    assert(!isSkinUnlocked('champion', 0), 'it started out owned');
    payPrize({
      coins: { min: 0, max: 0 },
      trophies: 0,
      item: { kind: 'dice', id: 'champion' },
    });
    assert(isSkinUnlocked('champion', 0), 'winning it did not make it usable');
  });

  test('it is not handed to every player on install', () => {
    /*
      The trap the `prize` flag exists to avoid. A skin with no price and
      no unlock already MEANS free-to-everyone — that is how Ivory works
      — so a prize die without the flag would arrive in every cupboard
      and count toward the Collector achievement for nothing.
    */
    resetProgressForTests();
    resetWalletForTests({ coins: 0, owned: [] });
    assertEqual(setsOwned(0), 1, 'a fresh save owns more than Ivory');
    assertEqual(
      setsOwned(999_999),
      LADDER_SKINS.length,
      'every trophy in the game counted a die that can only be won',
    );
  });

  test('the cupboard says how to get it, not "0 more trophies"', () => {
    /*
      The trap a fourth button state exists for. A prize die has no price
      and no trophy tier, so it fell through to the ladder's dead end and
      the preview button read "0 more trophies to go" — which does not
      merely fail to help, it says the die is already earned. "Keep
      saving", "keep playing" and "go and win it" are three different
      pieces of advice.
    */
    const action = previewAction({
      trophies: 999_999,
      coins: 999_999,
      owned: false,
      unlocked: false,
      equipped: false,
      prize: true,
      canBuy: true,
    });
    assertEqual(action.kind, 'prize', 'a cup prize was treated as a ladder item');
    assertEqual(actionLabel(action), 'Win it in a cup', 'the button says the wrong thing');
    assert(!isActionPressable(action), 'the button offered to hand it over');
  });

  test('winning it still gets you the ordinary equip button', () => {
    const action = previewAction({
      trophies: 0,
      coins: 0,
      owned: true,
      unlocked: true,
      equipped: false,
      prize: true,
      canBuy: false,
    });
    assertEqual(action.kind, 'equip', 'a die you have won cannot be put on');
  });

  test('there is at least one prize die to be had', () => {
    assert(PRIZE_SKINS.length > 0, 'nothing is won any more');
  });
});

suite('cups · a streak survives the app being killed', () => {
  test('what was saved comes back', async () => {
    store.clear();
    resetProgressForTests();
    setTournamentState('courtyard-streak', { streak: 2, best: 4, won: false });
    assertEqual(tournamentStates()['courtyard-streak'].streak, 2, 'not held in memory');

    resetProgressForTests();
    const loaded = await loadProgress();
    assertEqual(
      loaded.tournaments?.['courtyard-streak']?.streak,
      2,
      'the streak did not survive a relaunch',
    );
    assertEqual(
      loaded.tournaments?.['courtyard-streak']?.best,
      4,
      'the best run did not survive a relaunch',
    );
  });

  test('a cup already won stays won', async () => {
    /*
      The expensive failure. A `won` flag that did not survive being
      force-quit would pay the Champion die out a second time, and a
      unique prize that turns up twice is not unique.
    */
    store.clear();
    resetProgressForTests();
    setTournamentState('ultimate-gauntlet', { streak: 5, best: 5, won: true });
    resetProgressForTests();
    const loaded = await loadProgress();
    assert(
      !!loaded.tournaments?.["ultimate-gauntlet"]?.won,
      'a cup that was won came back unwon, and would pay out again',
    );
  });

  test('a save from before cups existed reads as nothing played', async () => {
    store.clear();
    store.set(
      'dice-battles:progress',
      JSON.stringify({ trophies: 300, wins: { easy: 1, medium: 0, hard: 0 } }),
    );
    resetProgressForTests();
    const loaded = await loadProgress();
    assertEqual(
      stateOf(loaded.tournaments ?? {}, 'courtyard-streak').streak,
      0,
      'an old save came back part-way through a cup it never played',
    );
  });
});
