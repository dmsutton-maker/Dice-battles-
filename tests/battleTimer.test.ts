import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, assertEqual, note, suite, test } from './harness';
import { BATTLE_FINAL_MS, BATTLE_TIME_MS } from '../src/game/tuning';
import {
  battleScores,
  clockLeft,
  clockWords,
  formatClock,
  friendlyVerdict,
  inFinalSeconds,
  newClock,
  pauseClock,
  runClock,
  shownSeconds,
  syncClock,
  TIE_WINNER,
  timeUpOutcome,
} from '../src/game/battleTimer';
import * as server from '../hq/src/lib/battleClock';
import { makeUnits, type PrisonerUnit } from '../src/game/modes';
import { PRISONER_COLORS } from '../src/game/colors';
import { MATCH_TOTAL_MS } from '../src/game/matchmaking';

/**
 * The battle clock.
 *
 * David, 1 Nov 2026: "Add a two minute thirty second timer and if the
 * game doesn't finish by then it is a tie if the score is tied, or a win
 * for whoever is winning at that moment."
 */

const root = join(__dirname, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

/** Put the first `n` prisoners of a board at a station. */
function moved(units: PrisonerUnit[], n: number, kind: 'retreat' | 'wall', skip = 0) {
  return units.map((u, i) =>
    i >= skip && i < skip + n ? { ...u, station: { kind, index: u.jailIndex } } : u,
  );
}

suite('battle timer · the rule at 0:00', () => {
  test('the battle lasts two and a half minutes', () => {
    assertEqual(BATTLE_TIME_MS, 150_000, 'BATTLE_TIME_MS');
    assertEqual(BATTLE_FINAL_MS, 10_000, 'the red, ticking stretch is the last ten seconds');
  });

  test('whoever is ahead when time runs out wins', () => {
    assertEqual(timeUpOutcome(3, 2), 'won', 'ahead 3–2');
    assertEqual(timeUpOutcome(1, 4), 'lost', 'behind 1–4');
    assertEqual(timeUpOutcome(5, 0), 'won', 'ahead 5–0');
  });

  test('level when time runs out is a tie', () => {
    assertEqual(timeUpOutcome(2, 2), 'tie', '2–2');
    assertEqual(timeUpOutcome(0, 0), 'tie', 'nobody scored');
  });

  test('the score decided at 0:00 is the score on the scoreboard, in every mode', () => {
    const six = makeUnits('classic', PRISONER_COLORS, null, null);
    // Color Rush and Ultimate: my rescues against the opponent's own six.
    const rush = battleScores('classic', moved(six, 3, 'retreat'), ['red', 'blue'], null);
    assertEqual(rush.player, 3, 'Color Rush: mine');
    assertEqual(rush.ai, 2, 'Color Rush: theirs');
    assertEqual(timeUpOutcome(rush.player, rush.ai), 'won', 'Color Rush: 3–2 is a win');
    const ult = battleScores('ultimate', moved(six, 1, 'retreat'), ['red'], null);
    assertEqual(timeUpOutcome(ult.player, ult.ai), 'tie', 'Ultimate: 1–1 is a tie');

    // Skirmish: one shared jail, mine in the retreat, theirs on the wall.
    const sk = battleScores('skirmish', moved(moved(six, 2, 'retreat'), 3, 'wall', 2), [], null);
    assertEqual(sk.player, 2, 'Skirmish: mine');
    assertEqual(sk.ai, 3, 'Skirmish: theirs');
    assertEqual(timeUpOutcome(sk.player, sk.ai), 'lost', 'Skirmish: 2–3 is a loss');

    // Color War: only each side's own colour counts, both in one row.
    const [mine, theirs] = PRISONER_COLORS;
    const war = makeUnits('colorwar', PRISONER_COLORS, mine, theirs);
    // Two of mine (cells 0–1) and one of theirs (cell 3) out.
    const board = war.map((u, i) =>
      i === 0 || i === 1 || i === 3 ? { ...u, station: { kind: 'retreat' as const, index: i } } : u,
    );
    const cw = battleScores('colorwar', board, [], { player: mine, ai: theirs });
    assertEqual(cw.player, 2, 'Color War: mine');
    assertEqual(cw.ai, 1, 'Color War: theirs');
    assertEqual(battleScores('colorwar', board, [], null).player, 0, 'no colours drawn yet is 0–0');
  });

  test('the scoreboard and the decision share one function', () => {
    // So the result can never disagree with the numbers on screen.
    const screen = read('src/demo/DiceDemoScreen.tsx');
    assert(
      /const \{ player: playerScore, ai: aiScore \} = battleScores\(/.test(screen),
      'the scoreboard no longer draws its numbers with battleScores',
    );
    assert(/const score = battleScores\(/.test(screen), 'time-up no longer decides with battleScores');
    assert(
      /finishAfterTimeUp\(timeUpOutcome\(score\.player, score\.ai\)\)/.test(screen),
      'time-up no longer goes through finishRound with the scoreboard\'s score',
    );
  });

  test('a battle finished before time is untouched by the clock', () => {
    /*
      Two guards make this true. Every finish moves the phase off
      'battle', and both the scheduled time-up and the clock itself only
      act during 'battle': a battle won at 1:10 left never reaches the
      time-up, and its result is whatever the finish said.
    */
    const screen = read('src/demo/DiceDemoScreen.tsx');
    const endOnTime = screen.slice(
      screen.indexOf('const endOnTime = useCallback'),
      screen.indexOf('const endOnTime = useCallback') + 400,
    );
    assert(
      /if \(phaseRef\.current !== 'battle'\) return;/.test(endOnTime),
      'time-up can fire after the battle has already finished',
    );
    const later = screen.slice(screen.indexOf('const finishAfterTimeUp'));
    assert(
      /if \(phaseRef\.current === 'timeup'\) finishRound\(outcome\)/.test(later),
      'the result after "Time\'s up!" can land on a battle that has already ended',
    );
    // And the clock, paused at the finish, still reads what was left.
    let clock = runClock(newClock(), 0);
    clock = pauseClock(clock, 80_000);
    assertEqual(clockLeft(clock, 500_000), 70_000, 'a finished battle\'s clock stays where it stopped');
  });

  test('the tutorial has no clock', () => {
    const tutorial = read('src/demo/TutorialScreen.tsx');
    assert(!/battleTimer|BattleClock/.test(tutorial), 'the tutorial should not be timed');
  });
});

suite('battle timer · what the clock shows', () => {
  test('M:SS, counting down', () => {
    assertEqual(formatClock(150_000), '2:30', 'the start');
    assertEqual(formatClock(149_001), '2:30', 'a sliver under is still 2:30');
    assertEqual(formatClock(149_000), '2:29', 'a whole second gone');
    assertEqual(formatClock(60_000), '1:00', 'one minute');
    assertEqual(formatClock(59_999), '1:00', 'just under a minute rounds up');
    assertEqual(formatClock(9_000), '0:09', 'two-digit seconds');
    assertEqual(formatClock(500), '0:01', 'half a second left is still a second');
    assertEqual(formatClock(0), '0:00', 'time up');
    assertEqual(formatClock(-40), '0:00', 'never negative');
    assertEqual(formatClock(Number.NaN), '0:00', 'nonsense is time up');
  });

  test('0:00 appears exactly when time runs out', () => {
    assertEqual(shownSeconds(1), 1, 'a millisecond left is not 0:00');
    assertEqual(shownSeconds(0), 0, 'and none left is');
  });

  test('the last ten seconds stand out, and only those', () => {
    assert(!inFinalSeconds(10_001), 'eleven seconds is not the end yet');
    assert(inFinalSeconds(10_000), 'ten seconds is');
    assert(inFinalSeconds(1), 'one is');
    assert(!inFinalSeconds(0), '0:00 is over, not counting');
  });

  test('said out loud for VoiceOver', () => {
    assertEqual(clockWords(150_000), '2 minutes 30 seconds left', 'the start');
    assertEqual(clockWords(61_000), '1 minute 1 second left', 'singulars');
    assertEqual(clockWords(60_000), '1 minute left', 'no "0 seconds"');
    assertEqual(clockWords(0), "Time's up", 'the end');
  });

  test('the clock is on the scoreboard, and nothing flashes', () => {
    const screen = read('src/demo/DiceDemoScreen.tsx');
    assert(/<BattleClock read=\{readClock\} \/>/.test(screen), 'the clock is not on the scoreboard');
    const clock = read('src/demo/BattleClock.tsx');
    assert(!/Animated|opacity/.test(clock), 'the clock should change colour, never flash');
    assert(/playClick\(\)/.test(clock), 'the last ten seconds should tick');
  });
});

suite('battle timer · a pocket stops it the way it stops the opponent', () => {
  test('the clock does not run while paused', () => {
    let clock = newClock();
    assertEqual(clockLeft(clock, 0), BATTLE_TIME_MS, 'a new clock is full and not running');
    clock = runClock(clock, 1_000);
    assertEqual(clockLeft(clock, 31_000), 120_000, 'thirty seconds of play');
    clock = pauseClock(clock, 31_000);
    // Ten minutes in a pocket.
    assertEqual(clockLeft(clock, 631_000), 120_000, 'nothing passes in the pocket');
    clock = runClock(clock, 631_000);
    assertEqual(clockLeft(clock, 641_000), 110_000, 'and it carries on where it was');
    assertEqual(clockLeft(clock, 10_000_000), 0, 'and runs out, never below zero');
  });

  test('pausing or running twice changes nothing', () => {
    const a = runClock(newClock(), 0);
    assertEqual(runClock(a, 5_000), a, 'running a running clock');
    const p = pauseClock(a, 5_000);
    assertEqual(pauseClock(p, 9_000), p, 'pausing a paused clock');
  });

  test('the screen pauses the clock exactly when it pauses the opponent', () => {
    const screen = read('src/demo/DiceDemoScreen.tsx');
    assert(
      /if \(phase !== 'battle' \|\| !appActive\) return;\s*clockRef\.current = runClock/.test(screen),
      'the clock should run only during the battle with the game on screen',
    );
    // The computer's own roll timer, for comparison.
    assert(
      /if \(phase !== 'battle'\) return;[\s\S]{0,700}if \(!appActive\) return;/.test(screen),
      'the opponent\'s roll timer no longer stops with the phone',
    );
  });

  test('the split screen has the same clock', () => {
    const two = read('src/demo/TwoPlayerScreen.tsx');
    assert(/timeUpOutcome\(scoreOf\(unitsRefA\.current\), scoreOf\(unitsRefB\.current\)\)/.test(two),
      'two players at one phone should be decided by the score at 0:00 too');
    assert(/<BattleClock read=\{readClock\}/.test(two), 'and see the clock');
  });
});

suite('battle timer · a friendly battle, ended by the server', () => {
  const start = 1_000_000;
  const end = start + server.BATTLE_LEAD_MS + server.BATTLE_TIME_MS;

  test('the server and the game agree on the numbers', () => {
    assertEqual(server.BATTLE_TIME_MS, BATTLE_TIME_MS, 'the server clock is not two and a half minutes');
    assertEqual(server.TIE_WINNER, TIE_WINNER, 'the game and the server spell a tie differently');
    /*
      The lead is the reveal plus the countdown, so the clock the phones
      show starts at the same moment the dice go live.
    */
    const screen = read('src/demo/DiceDemoScreen.tsx');
    assert(/setPhaseBoth\('battle'\);\s*\}, 1800\)/.test(screen), 'the countdown is no longer 1.8s');
    assertEqual(server.BATTLE_LEAD_MS, MATCH_TOTAL_MS + 1800, 'BATTLE_LEAD_MS');
    assert(server.BATTLE_GRACE_MS > 0 && server.BATTLE_GRACE_MS <= 5_000, 'a small grace, not a long one');
    note(`grace ${server.BATTLE_GRACE_MS}ms`);
  });

  test('the clock both phones are sent', () => {
    assertEqual(server.battleMsLeft(start, start), BATTLE_TIME_MS, 'full during the reveal');
    assertEqual(server.battleMsLeft(start, start + server.BATTLE_LEAD_MS + 30_000), 120_000, 'thirty seconds in');
    assertEqual(server.battleMsLeft(start, end + 60_000), 0, 'never below zero');
  });

  test('nothing is decided before the clock and its grace are up', () => {
    const at = (nowMs: number) =>
      server.timeoutWinner({ startedAtMs: start, nowMs, aId: 'local-a', bId: 'local-b', aFreed: ['red'], bFreed: [] });
    assertEqual(at(end - 1), null, 'still on with time left');
    assertEqual(at(end + server.BATTLE_GRACE_MS - 1), null, 'still on inside the grace');
    assertEqual(at(end + server.BATTLE_GRACE_MS), 'local-a', 'over once the grace is gone');
  });

  test('after time, whoever freed more wins, and level is a tie', () => {
    const after = end + server.BATTLE_GRACE_MS + 10;
    const decide = (aFreed: unknown, bFreed: unknown) =>
      server.timeoutWinner({ startedAtMs: start, nowMs: after, aId: 'local-a', bId: 'local-b', aFreed, bFreed });
    assertEqual(decide(['red', 'blue'], ['red']), 'local-a', 'a ahead');
    assertEqual(decide(['red'], ['red', 'blue', 'green']), 'local-b', 'b ahead');
    assertEqual(decide(['red'], ['blue']), server.TIE_WINNER, 'level');
    assertEqual(decide([], []), server.TIE_WINNER, 'nobody scored');
    assertEqual(decide(['red', 'red', 'red'], ['blue', 'green']), 'local-b', 'a repeated colour is one rescue');
    assertEqual(decide(null, ['blue']), 'local-b', 'a missing list is nothing freed');
    assertEqual(
      server.timeoutWinner({ startedAtMs: Number.NaN, nowMs: after, aId: 'a', bId: 'b', aFreed: [], bFreed: [] }),
      null,
      'a battle with no start time is never ended by the clock',
    );
  });

  test('each phone reads the same verdict', () => {
    assertEqual(friendlyVerdict('local-a', 'local-a'), 'won', 'my id is my win');
    assertEqual(friendlyVerdict('local-b', 'local-a'), 'lost', 'theirs is my loss');
    assertEqual(friendlyVerdict(TIE_WINNER, 'local-a'), 'tie', 'and a tie for both');
    assertEqual(friendlyVerdict(TIE_WINNER, 'local-b'), 'tie', 'and a tie for both');
  });

  test('a phone takes the server\'s clock, without the seconds stuttering', () => {
    const clock = runClock(newClock(), 0);
    // 30 s in by this phone; the server says 119.6 s left — close enough.
    assertEqual(syncClock(clock, 119_600, 30_000), clock, 'small differences are left alone');
    // The server says 100 s left: this phone was paused or started late.
    const fixed = syncClock(clock, 100_000, 30_000);
    assertEqual(clockLeft(fixed, 30_000), 100_000, 'a real difference is put right');
    assertEqual(clockLeft(fixed, 40_000), 90_000, 'and the clock runs on from there');
    assertEqual(clockLeft(syncClock(clock, 0, 30_000), 30_000), 0, 'the server saying time is up is time up');
  });

  test('the live route checks the clock before any claim or leave', () => {
    const route = read('hq/src/app/api/battles/live/route.ts');
    const onTime = route.indexOf('if (onTime)');
    const leave = route.indexOf('body.leave === true');
    const claim = route.indexOf('body.claimWin === true');
    assert(onTime > 0, 'the live route no longer ends a battle on time');
    assert(onTime < leave && onTime < claim, 'a claim or leave is looked at before the clock');
    /*
      Loosened from `msLeft: battleMsLeft(` on purpose. David, 1 Nov 2026:
      "Fix the versus against friends because it doesn't connect" — a
      battle now waits for both phones first, and while it waits the full
      clock is sent instead (tests/friendlyServer.test.ts checks that
      half). Once it is playing, the clock is still battleMsLeft.
    */
    assert(/msLeft:[^\n]*battleMsLeft\(/.test(route), 'the phones are no longer sent the clock');
    const sweep = read('hq/src/app/api/battles/route.ts');
    assert(/timeoutWinner\(/.test(sweep), 'a battle nobody is beating is not ended on time');
  });

  test('the database allows a tie', () => {
    const schema = read('hq/supabase/schema.sql');
    assert(
      /winner is null or winner = 'tie' or winner = a_id or winner = b_id/.test(schema),
      'schema.sql does not record what `winner` may hold',
    );
  });
});
