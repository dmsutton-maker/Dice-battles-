import './storageMock';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, assertEqual, suite, test } from './harness';
import {
  leaveWords,
  menuNote,
  menuShowsIn,
  menuTitle,
  pausesBattle,
  runsALossEnds,
  trophyCost,
  trophyLine,
  whereLine,
} from '../src/game/battleMenu';
import { applyMatchResult, resetProgressForTests, TROPHY_STAKES } from '../src/game/progress';
import type { TournamentDef } from '../src/game/tournament';

/*
  The battle menu. Marc, 2 Nov 2026: "when you're in a battle and want to
  exit a game it should be a button that's three lines and it should take
  you to a small menu overlayed on the game playing. the menu should have
  the ability to leave the game and when you click leave it should warn
  you that forfeiting counts as a loss, and it should have the volume
  lines and other things you think".

  The words and decisions are run for real (src/game/battleMenu.ts). The
  screen cannot run in node, so what it does with them is checked the way
  friends.test.ts and auditFixes.test.ts check it: by reading the code
  with its comments taken out.
*/

const root = join(__dirname, '..');
const code = (path: string) =>
  readFileSync(join(root, path), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
const screen = code('src/demo/DiceDemoScreen.tsx');
const panel = code('src/demo/BattleMenu.tsx');
const between = (from: string, to: string) => {
  const a = screen.indexOf(from);
  const b = screen.indexOf(to, a + from.length);
  assert(a >= 0 && b > a, `could not find ${from} .. ${to} in DiceDemoScreen`);
  return screen.slice(a, b);
};

const cup = (over: Partial<TournamentDef>): TournamentDef => ({
  id: 'gauntlet-w45',
  name: 'The Gauntlet',
  blurb: '',
  mode: 'classic',
  difficulty: 'easy',
  target: 5,
  prize: { coins: { min: 100, max: 200 }, trophies: 20 },
  ...over,
});

suite('battle menu · what it says', () => {
  test('paused against the computer, not against a friend', () => {
    assertEqual(pausesBattle('computer'), true, 'computer battle pauses');
    assertEqual(pausesBattle('tutorial'), true, 'tutorial pauses');
    assertEqual(pausesBattle('friend'), false, 'a friend battle cannot pause');
    assertEqual(menuTitle('computer'), 'Paused', 'computer title');
    assertEqual(menuTitle('friend'), 'Battle menu', 'friend title');
    assertEqual(menuNote('computer'), null, 'no note when paused');
    assertEqual(menuNote('friend'), 'Your friend is still playing', 'friend note');
  });

  test('the button is there in the countdown and the battle, and nowhere else', () => {
    for (const phase of ['arm', 'go', 'battle']) assert(menuShowsIn(phase), `${phase} should show it`);
    for (const phase of ['pick', 'matching', 'timeup', 'won', 'lost', 'tie']) {
      assert(!menuShowsIn(phase), `${phase} should not show it`);
    }
  });

  test('the trophy cost is the loss band applyMatchResult rolls from, never more than you hold', () => {
    const band = TROPHY_STAKES.easy.loss;
    assertEqual(JSON.stringify(trophyCost(500, 'easy')), JSON.stringify(band), 'full band');
    assertEqual(trophyLine(trophyCost(500, 'easy')), `You will lose ${band.min} to ${band.max} trophies`, 'line');
    assertEqual(JSON.stringify(trophyCost(5, 'hard')), JSON.stringify({ min: 5, max: 5 }), 'only what you have');
    assertEqual(trophyLine(trophyCost(1, 'medium')), 'You will lose 1 trophy', 'one trophy');
    assertEqual(trophyCost(0, 'hard'), null, 'nothing to lose');
    // And the real loss lands inside what was promised, at every difficulty.
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      for (const held of [0, 3, 30, 900]) {
        for (const roll of [0, 0.5, 0.999]) {
          resetProgressForTests({ trophies: held });
          const lost = -applyMatchResult(false, difficulty, 'classic', () => roll).delta;
          const cost = trophyCost(held, difficulty);
          if (!cost) assertEqual(lost, 0, `${difficulty} ${held}: lost trophies it said it would not`);
          else assert(lost >= cost.min && lost <= cost.max, `${difficulty} ${held}: lost ${lost}, warned ${cost.min}-${cost.max}`);
        }
      }
    }
    resetProgressForTests();
  });

  test('a computer leave says it is a loss, with the trophies', () => {
    const w = leaveWords({ kind: 'computer', trophies: 300, difficulty: 'medium', runs: [] });
    assertEqual(w.title, 'Leave the battle?', 'title');
    assertEqual(w.lines[0], 'Leaving now counts as a loss.', 'the loss line');
    assertEqual(w.lines[1], 'You will lose 9 to 18 trophies.', 'the trophy line');
    assertEqual(w.stayLabel, 'Keep playing', 'stay');
    assertEqual(w.leaveLabel, 'Leave (counts as a loss)', 'leave');
    const broke = leaveWords({ kind: 'computer', trophies: 0, difficulty: 'easy', runs: [] });
    assertEqual(broke.lines.length, 1, 'no trophy line with no trophies');
  });

  test('a cup run a loss would end is named, and only one the cups themselves would end', () => {
    const cups = [cup({}), cup({ id: 'other', name: 'Hard Cup', difficulty: 'hard' })];
    const states = {
      'gauntlet-w45': { streak: 3, best: 3, won: false },
      other: { streak: 2, best: 2, won: false },
    };
    const runs = runsALossEnds(cups, states, { mode: 'classic', difficulty: 'easy' });
    assertEqual(JSON.stringify(runs), JSON.stringify([{ name: 'The Gauntlet', streak: 3 }]), 'only the matching cup');
    assertEqual(runsALossEnds(cups, {}, { mode: 'classic', difficulty: 'easy' }).length, 0, 'no run, nothing to end');
    assertEqual(runsALossEnds(cups, states, { mode: 'skirmish', difficulty: 'easy' }).length, 0, 'other mode');
    const w = leaveWords({ kind: 'computer', trophies: 100, difficulty: 'easy', runs });
    assertEqual(w.lines[1], 'You will lose 3 to 8 trophies, and your run of 3 in The Gauntlet ends.', 'both');
    const noTrophies = leaveWords({ kind: 'computer', trophies: 0, difficulty: 'easy', runs });
    assertEqual(noTrophies.lines[1], 'Your run of 3 in The Gauntlet ends.', 'run alone');
  });

  test('a friend leave gives the friend the win and moves no trophies', () => {
    const w = leaveWords({ kind: 'friend', friendName: 'Marc' });
    assertEqual(w.lines[0], 'Leaving gives Marc the win.', 'friend line');
    assert(!w.lines.some((l) => /You will lose/.test(l)), 'a friendly never costs trophies');
    assertEqual(w.leaveLabel, 'Leave (Marc wins)', 'leave label');
  });

  test('a tutorial leave costs nothing and says nothing about losing', () => {
    const w = leaveWords({ kind: 'tutorial', trophies: 900, difficulty: 'hard', runs: [{ name: 'X', streak: 4 }] });
    assertEqual(w.title, 'Leave the tutorial?', 'title');
    assertEqual(w.lines.length, 0, 'no loss line');
    assert(!/loss/.test(w.leaveLabel), 'no loss on the button');
  });

  test('the small print names the mode', () => {
    assertEqual(whereLine('computer', 'classic', 'hard'), 'Color Rush · Hard', 'computer');
    assertEqual(whereLine('friend', 'skirmish', 'easy', 'Marc'), 'Skirmish · with Marc', 'friend');
  });
});

suite('battle menu · the screen', () => {
  test('the ↺ is gone and the three-line button opens the menu', () => {
    assert(!screen.includes('↺'), 'the old ↺ is still drawn');
    const button = between('menuShowsIn(phase) && (', '</Pressable>');
    assert(/<MenuIcon/.test(button), 'the button does not draw the three lines');
    assert(/accessibilityLabel="Battle menu"/.test(button), 'no accessible label');
    assert(/setBattleMenu\(true\)/.test(button), 'the button does not open the menu');
    assert(!/quitToMenu/.test(button), 'the button still leaves straight away');
    assert(/hitSlop/.test(button), 'a 40pt button needs hitSlop to reach 44pt');
  });

  test('Leave goes through the confirm before any loss', () => {
    // The panel's Leave battle only opens the question; only the question's answer leaves.
    const leaveButton = panel.slice(panel.indexOf('Leave battle') - 200, panel.indexOf('Leave battle'));
    assert(/setAsking\(true\)/.test(leaveButton), 'Leave battle does not ask first');
    assertEqual((panel.match(/onLeave\)/g) ?? []).length, 1, 'onLeave is called from more than the confirm');
    const asked = panel.slice(panel.indexOf('{asking ?'), panel.indexOf(') : ('));
    assert(/onLeave/.test(asked), 'the confirm does not leave');
    // The screen's leave is the ordinary loss, or quitToMenu for a friend.
    const leave = between('const leaveBattle', '}, [quitToMenu, finishRound]);');
    assert(/finishRound\('lost'\)/.test(leave), 'leaving is not the ordinary loss');
    assert(/friendlyRef\.current[\s\S]*quitToMenu\(\)/.test(leave), 'a friend leave is not quitToMenu');
    assert(/countdownTimers\.current\.forEach\(clearTimeout\)/.test(leave), 'the countdown could start a battle on the result');
    assert(/onLeave=\{leaveBattle\}/.test(screen), 'the menu is not given leaveBattle');
  });

  test('the rival and the clock pause while the menu is open, against the computer only', () => {
    assert(
      /const battleLive = appActive && !\(battleMenu && pausesBattle\(menuKind\)\)/.test(screen),
      'battleLive is not appActive plus the menu',
    );
    assert(/const menuKind: BattleMenuKind = friendly \? 'friend' : 'computer'/.test(screen), 'menu kind');
    assert(
      /if \(phase !== 'battle'\) return;\s*if \(!battleLive\) return;\s*if \(friendlyRef\.current\) return;\s*const \{ rollIntervalMs \}/.test(screen),
      'the rival keeps rolling under the menu',
    );
    assert(/\}, \[phase, battleLive, difficulty, finishRound, moveUnit, showCallout\]\);/.test(screen), 'the rival is not restarted on Resume');
    assert(/if \(phase !== 'battle' \|\| !battleLive\) return;\s*clockRef\.current = runClock/.test(screen), 'the clock runs under the menu');
    const release = screen.slice(screen.indexOf('onPanResponderRelease'), screen.indexOf('throwAll'));
    assert(/battleMenuRef\.current/.test(release), 'a throw can go through the menu');
  });

  test('the menu closes when the battle ends under it', () => {
    assert(
      /if \(menuShowsIn\(phase\) \|\| !battleMenuRef\.current\) return;\s*setBattleMenu\(false\)/.test(screen),
      'the menu stays up over a finished battle',
    );
    assert(/battleMenu && menuShowsIn\(phase\) && \(\s*<BattleMenu/.test(screen), 'the menu can draw outside a battle');
  });

  test('the volume is the same four sliders Settings has', () => {
    assert(/<VolumeSliders/.test(panel), 'the menu has no volume');
    assertEqual((screen.match(/<VolumeSliders value=\{audioPrefs\} onChange=\{setAudioPrefs\} \/>/g) ?? []).length, 1, 'Settings');
    assert(/audio=\{audioPrefs\}\s*onAudio=\{setAudioPrefs\}/.test(screen), 'the menu reads other settings');
  });

  test('no Alert box anywhere in it', () => {
    assert(!/Alert\.alert/.test(panel), 'BattleMenu uses Alert');
    assert(!/Alert\.alert/.test(screen), 'the screen uses Alert');
  });
});
