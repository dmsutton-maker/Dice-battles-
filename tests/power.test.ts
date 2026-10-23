import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, note, suite, test } from './harness';
import { FLIGHT_SECONDS } from '../src/game/flight';

const root = join(__dirname, '..');
const source = (path: string) => readFileSync(join(root, path), 'utf8');
/** The file with its prose removed, so a comment can never satisfy a check. */
const code = (path: string) =>
  source(path)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');

/**
 * What the game does to a battery.
 *
 * A 3D scene redrawn sixty times a second is the most expensive thing
 * this app can do to a phone, and it is invisible: nothing on screen
 * looks wrong while a board nobody is watching burns through an
 * afternoon's charge. So the rules about when the loop may run are
 * tested rather than remembered.
 *
 * WHAT THESE CAN AND CANNOT PROVE. There is no renderer in this suite
 * and no device in CI, so none of this measures a frame or a milliamp.
 * What it pins is the reasoning: every path that starts motion tells the
 * loop, the window outlasts the animation it covers, and the one screen
 * that waits on real frames is never the one that stops. The actual
 * saving has to be seen on a phone.
 */

suite('power · the board only draws when there is something to see', () => {
  test('the single-player board stops outside a round', () => {
    const screen = code('src/demo/DiceDemoScreen.tsx');
    assert(/frameloop=\{/.test(screen), 'the board no longer controls its frameloop');
    const expr = screen.slice(screen.indexOf('frameloop={'), screen.indexOf('camera={{ position'));
    assert(
      /'never'/.test(expr),
      'the board never stops — a 3D scene runs behind every menu',
    );
    for (const live of ['preview', "'matching'", "'arm'", "'go'", "'battle'"]) {
      assert(
        expr.includes(live),
        `${live} is not in the frameloop rule — the board may be frozen when it should be moving`,
      );
    }
  });

  test('BOTH split-screen boards stop outside a round', () => {
    /*
      Two canvases are on screen at once here, one per player, and they
      ran flat out whenever the split screen was open — including behind
      the solid card that says to lay the phone on the table. Twice the
      cost, on the screen most likely to be left face-up between two
      people.
    */
    const screen = code('src/demo/TwoPlayerScreen.tsx');
    assert(
      /frameloop=\{/.test(screen),
      'the split-screen boards have no frameloop rule and run continuously',
    );
    const expr = screen.slice(screen.indexOf('frameloop={'), screen.indexOf('camera={{ position'));
    assert(/'never'/.test(expr), 'the split-screen boards never stop');
    assert(
      /'battle'/.test(expr) && /'arm'/.test(expr) && /'go'/.test(expr),
      'a live phase is missing from the split-screen rule',
    );
  });

  test('nothing renders while the phone is in a pocket', () => {
    // JavaScript timers keep firing through a lock screen even where the
    // GL context is suspended, so this is checked on both screens.
    for (const file of ['src/demo/DiceDemoScreen.tsx', 'src/demo/TwoPlayerScreen.tsx']) {
      const screen = code(file);
      const expr = screen.slice(screen.indexOf('frameloop={'), screen.indexOf('camera={{ position'));
      assert(
        /appActive/.test(expr),
        `${file} keeps drawing when the game is not the app on screen`,
      );
    }
  });

  test('the opponent stops rolling when the game is not on screen', () => {
    /*
      The one that actually ran wrong rather than merely wastefully: a
      setInterval keeps firing while a phone is locked, so the opponent
      carried on rolling — with haptics and sound — through a battle
      nobody was in, and a player came back having lost.
    */
    const screen = code('src/demo/DiceDemoScreen.tsx');
    const effect = screen.slice(screen.indexOf("if (phase !== 'battle') return;"));
    const interval = effect.indexOf('setInterval');
    const guard = effect.indexOf('if (!appActive) return;');
    assert(guard >= 0, 'the opponent’s timer has no app-state guard');
    assert(guard < interval, 'the guard is after the timer is created, so it never stops it');
    assert(
      /\[phase, appActive,/.test(screen),
      'appActive is not a dependency, so the timer is never restarted or torn down',
    );
  });
});

suite('power · the board stops between rolls', () => {
  /*
    A battle is mostly waiting. The dice sit on the tray while somebody
    decides whether to tap, and every one of those seconds was being
    redrawn sixty times to show an unchanged picture.

    The danger of stopping is the opposite failure: a board frozen
    mid-animation. These pin the three things that make that impossible.
  */

  test('every path that starts motion tells the loop', () => {
    const screen = code('src/demo/DiceDemoScreen.tsx');
    // moveUnit is the single funnel for every prisoner leap — the
    // player's AND the opponent's, which move figures too in Skirmish.
    const move = screen.slice(screen.indexOf('const moveUnit = useCallback'));
    assert(
      move.indexOf('markBoardBusy()') < move.indexOf('unitsRef.current = next'),
      'moveUnit moves a prisoner without waking the render loop',
    );
    const thrown = screen.slice(screen.indexOf('const handleThrow = useCallback'));
    assert(
      thrown.indexOf('markBoardBusy()') < thrown.indexOf('setRolling(true)'),
      'a throw does not wake the render loop',
    );
    const settled = screen.slice(screen.indexOf('const handleSettled = useCallback'));
    assert(
      /markBoardBusy\(\)/.test(settled.slice(0, 800)),
      'a settle does not extend the window, so a sinking die or a ' +
        'celebration shake could be frozen half way through',
    );
  });

  test('a tap always restarts the loop, because the throw says so', () => {
    /*
      THE path that must never fail. With the loop stopped, a tap applies
      impulses to bodies that are not being stepped — so if the scene did
      not tell the screen synchronously, the dice would hang in the air.
    */
    const scene = code('src/demo/DiceScene.tsx');
    const launch = scene.slice(scene.indexOf('const launch = ('), scene.indexOf('controlsRef.current = {'));
    assert(
      launch.includes('onThrow()'),
      'launch does not call onThrow, so a tap cannot restart a stopped loop',
    );
    assert(
      launch.indexOf('throwDie(body') < launch.indexOf('onThrow()'),
      'onThrow fires before the dice are thrown — the ordering this relies on has changed',
    );
  });

  test('the window outlasts the animation it covers', () => {
    const screen = source('src/demo/DiceDemoScreen.tsx');
    const match = /FLIGHT_SECONDS \* 1000 \+ (\d+)/.exec(screen);
    assert(match !== null, 'the busy window is no longer measured against the leap');
    const margin = Number(match![1]);
    assert(margin > 0, 'the window is exactly the leap, with no margin for a slow frame');
    const total = FLIGHT_SECONDS * 1000 + margin;
    // The camera shake decays by 0.88 a frame from 1, so it is spent in
    // about 36 frames — under a second. The window has to clear that too.
    assert(total > 1000, `the window is ${total}ms, which is shorter than a camera shake`);
    note(`board stays awake ${total}ms after motion; a leap takes ${FLIGHT_SECONDS * 1000}ms`);
  });

  test('the screen that waits on real frames is never the one that stops', () => {
    /*
      FirstFrame counts real frames to know a scene is truly drawn, and
      the item preview waits on that to avoid showing the previously
      previewed arena for a moment. If the loop could stop with a preview
      open, that wait would never end.
    */
    const screen = code('src/demo/DiceDemoScreen.tsx');
    const expr = screen.slice(screen.indexOf('frameloop={'), screen.indexOf('camera={{ position'));
    assert(
      /preview !== null \|\|/.test(expr),
      'the preview is no longer the first condition, so a preview could open ' +
        'on a stopped loop and never finish waiting for its first frame',
    );
  });

  test('the window always ends on its own', () => {
    // A timer rather than a flag the animation clears: the worst case of
    // an over-long window is a second of wasted drawing; the worst case
    // of a missed clear is a board frozen for ever.
    const screen = code('src/demo/DiceDemoScreen.tsx');
    const busy = screen.slice(screen.indexOf('const markBoardBusy'));
    assert(
      /setTimeout\(\s*\(\) => setBoardBusy\(false\)/.test(busy),
      'nothing switches the busy window off, so the loop would never stop',
    );
    assert(
      /clearTimeout\(boardBusyTimer\.current\)/.test(busy),
      'repeated motion stacks timers instead of extending one window',
    );
  });
});

suite('power · nothing else runs when it should not', () => {
  test('the app never holds the screen awake', () => {
    /*
      An app that disables the idle timer keeps a bright screen lit for
      as long as it is open, which costs more than everything else here
      put together. A board game has no reason to.
    */
    const pkg = JSON.parse(source('package.json'));
    assert(
      !('expo-keep-awake' in (pkg.dependencies ?? {})),
      'expo-keep-awake is a dependency — the screen would never sleep',
    );
    const { execSync } = require('node:child_process') as typeof import('node:child_process');
    const hits = execSync(
      "grep -rl 'KeepAwake\\|activateKeepAwake' src || true",
      { encoding: 'utf8' },
    ).trim();
    assert(hits === '', `something keeps the screen awake: ${hits}`);
  });

  test('sound does not keep playing in the background', () => {
    // staysActiveInBackground would leave the music loop running — and
    // the audio session open — with the phone in a pocket.
    const audio = code('src/audio/sounds.ts');
    assert(
      !/staysActiveInBackground:\s*true/.test(audio),
      'audio is set to stay active in the background',
    );
  });

  test('nothing polls the network on a timer', () => {
    /*
      A repeating fetch is a radio wake-up, which costs far more power
      than the request itself. Everything here is fetched when a screen
      opens, and not again.
    */
    const { execSync } = require('node:child_process') as typeof import('node:child_process');
    const files = execSync("find src -name '*.ts' -o -name '*.tsx'", { encoding: 'utf8' })
      .split('\n')
      .filter((f) => f.trim());
    const pollers: string[] = [];
    for (const file of files) {
      const body = code(file);
      // setInterval near a fetch in the same file is the shape to catch.
      if (/setInterval/.test(body) && /fetch\(/.test(body)) pollers.push(file);
    }
    assert(
      pollers.length === 0,
      `these poll the network on a timer: ${pollers.join(', ')}`,
    );
  });
});
