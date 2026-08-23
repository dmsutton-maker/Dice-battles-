import { readFileSync } from 'node:fs';
import { store } from './storageMock';
import { MODES, MODE_ORDER } from '../src/game/modes';
import { PRISONER_COLORS } from '../src/game/colors';
import {
  hasSeenTutorial,
  loadTutorialSeen,
  markTutorialSeen,
  resetTutorialForTests,
  TUTORIAL_PAGES,
} from '../src/game/tutorial';
import { assert, assertEqual, note, suite, test } from './harness';

/**
 * A tutorial is the one part of a game that can be WRONG rather than
 * broken. Nothing crashes when it describes a rule the game no longer has
 * — it just quietly teaches somebody the wrong thing, and the person it
 * misleads is by definition the one who cannot tell.
 *
 * So these check it against the rules the game actually implements, not
 * just that it renders.
 */
suite('tutorial · it says what the game does', () => {
  test('every mode the game has is explained, by its real name', () => {
    const modesPage = TUTORIAL_PAGES.find((p) => p.art.kind === 'modes');
    assert(modesPage !== undefined, 'no page explains the modes');
    const text = modesPage!.lines.join(' ');
    for (const id of MODE_ORDER) {
      assert(
        text.includes(MODES[id].name),
        `${MODES[id].name} is a mode you can pick and the tutorial never mentions it`,
      );
    }
  });

  test('it teaches the rule the game is built on', () => {
    // Two dice showing the same colour frees that prisoner. If this
    // sentence ever stops being in here, the tutorial has stopped
    // teaching the game.
    const all = TUTORIAL_PAGES.flatMap((p) => p.lines).join(' ').toLowerCase();
    assert(all.includes('same colour'), 'the matching rule is never stated');
    assert(
      all.includes('six'),
      'it never says how many prisoners there are',
    );
  });

  test('six prisoners is still six', () => {
    // The "six prisoners, one of every colour" line is only true while the
    // palette has six colours in it.
    assertEqual(PRISONER_COLORS.length, 6, 'the palette changed size under the tutorial');
  });

  test('every page has a picture and something to read', () => {
    for (const page of TUTORIAL_PAGES) {
      assert(page.title.length > 0, 'a page has no title');
      assert(page.lines.length > 0, `${page.title} has no words`);
      assert(page.lines.length <= 4, `${page.title} has ${page.lines.length} lines — too long`);
      for (const line of page.lines) {
        assert(line.length < 130, `${page.title} has a line nobody will read: "${line}"`);
      }
    }
    note(`${TUTORIAL_PAGES.length} pages, ${TUTORIAL_PAGES.flatMap((p) => p.lines).length} lines`);
  });

  test('every art kind the pages ask for is one the screen can draw', () => {
    // A page asking for art the screen has no branch for would render an
    // empty box, and nothing would fail.
    const source = readFileSync('src/demo/TutorialScreen.tsx', 'utf8');
    for (const page of TUTORIAL_PAGES) {
      assert(
        source.includes(`'${page.art.kind}'`),
        `the screen cannot draw '${page.art.kind}', asked for by "${page.title}"`,
      );
    }
  });

  test('the colourblind shapes are drawn here too', () => {
    // Somebody who has turned shapes on must be taught the game they are
    // going to see, not the colours-only one.
    const source = readFileSync('src/demo/TutorialScreen.tsx', 'utf8');
    assert(source.includes('COLOR_SYMBOLS'), 'the tutorial ignores colourblind mode');
    assert(/symbols\s*&&/.test(source) || /symbols\s*\?/.test(source),
      'the shapes are not actually conditional on the setting');
  });
});

suite('tutorial · it opens once and stays reachable', () => {
  test('a brand new player has not seen it', async () => {
    store.clear();
    resetTutorialForTests(true);
    assertEqual(await loadTutorialSeen(), false, 'a fresh install thinks it was seen');
  });

  test('once shown, it stays shown across launches', async () => {
    store.clear();
    resetTutorialForTests(false);
    markTutorialSeen();
    assertEqual(hasSeenTutorial(), true, 'not marked in memory');
    resetTutorialForTests(false);
    assertEqual(await loadTutorialSeen(), true, 'not remembered across a launch');
  });

  test('it is still one tap away after that', () => {
    // The automatic showing is a one-off; the button is forever. Losing
    // the button would leave the rules unreachable for anyone handed the
    // phone later.
    const top = readFileSync('src/demo/TopButtons.tsx', 'utf8');
    assert(top.includes('onHowToPlay'), 'the how-to-play button is gone');
    assert(top.includes('How to play'), 'the button has no accessible name');
  });
});
