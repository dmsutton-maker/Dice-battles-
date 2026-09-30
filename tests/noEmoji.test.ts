import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { assert, assertEqual, note, suite, test } from './harness';
import { hasEmoji, stripEmoji, stripEmojiDeep } from '../src/game/noEmoji';

/**
 * No emoji on any screen.
 *
 * David, 30 Sep 2026: "Get rid of any emojis and use the proper icons for
 * each item." Every item is drawn as itself instead — the painted die,
 * the battlefield's picture, the game's own coin and trophy — through
 * src/demo/ItemIcon.tsx. The ladder went first in August; this is the
 * rest of the game catching up, and this suite is what keeps it caught
 * up.
 *
 * Since the same day there is no emoji in the game's DATA either, and
 * text from outside the game — Game Center nicknames, the HQ board's
 * news and cups — has its emoji stripped on the way in (noEmoji.ts).
 */

// Pictographic ranges. The plain ✓ tick and ✕ close mark are ordinary
// text glyphs drawn in the game's ink, not colour emoji, and are allowed.
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}\u{FE0F}]/u;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory()
      ? files(path)
      : /\.tsx?$/.test(path)
        ? [path]
        : [];
  });
}

/** Source with its comments removed — the prose may quote an emoji. */
const live = (path: string) =>
  readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''))
    .replace(/\/\/[^\n]*/g, '');

suite('no emoji on any screen', () => {
  // ALL of the game, data included. Until 30 Sep 2026 the dice, arenas,
  // ladder rungs and rivals carried an `emoji` field that no screen drew;
  // David: "I DONT WANT ANY EMOJIS IN THE GAME!" — so the data went too.
  const screens = files('src');

  test('no screen has an emoji written into it', () => {
    const found: string[] = [];
    for (const path of screens) {
      live(path).split('\n').forEach((line, i) => {
        if (EMOJI.test(line)) found.push(`${path}:${i + 1}`);
      });
    }
    note(`${screens.length} screen files checked`);
    assertEqual(found.join(', '), '', 'an emoji is drawn on a screen');
  });

  test('no screen draws an item\'s emoji field', () => {
    // `skin.emoji`, `tier.emoji`, `ARENAS[id].emoji` inside JSX or a
    // string the player reads. The data may keep the field; a screen
    // may not show it.
    const found: string[] = [];
    for (const path of screens) {
      live(path).split('\n').forEach((line, i) => {
        if (/\{[^}]*\.emoji\b[^}]*\}|\$\{[^}]*\.emoji\b/.test(line)) found.push(`${path}:${i + 1}`);
      });
    }
    assertEqual(found.join(', '), '', 'a screen draws an emoji field');
  });

  test('the reward popup is given a picture, not an emoji', () => {
    const popup = live('src/demo/RewardPopup.tsx');
    assertEqual(/emoji/.test(popup), false, 'the reward popup still knows about emoji');
  });
});

suite('no emoji arrives from outside the game', () => {
  test('a nickname keeps its letters and loses its emoji', () => {
    assertEqual(stripEmoji('AJ 🏆'), 'AJ', 'the emoji survived');
    assertEqual(stripEmoji('Marc 👨‍👩‍👧 the Great'), 'Marc the Great', 'a joined family emoji survived');
    assertEqual(stripEmoji('🇬🇧 Flag'), 'Flag', 'a flag survived');
    assertEqual(stripEmoji('Plain name'), 'Plain name', 'an ordinary name was changed');
    assert(!hasEmoji(stripEmoji('❤️ 🔥 ⭐ 🎲')), 'something pictographic got through');
  });

  test('a news post keeps its paragraphs', () => {
    assertEqual(
      stripEmoji('New dice! 🎉\n\nGo and see.'),
      'New dice!\n\nGo and see.',
      'the paragraph break was lost with the emoji',
    );
  });

  test('every string inside an answer is cleaned', () => {
    const cleaned = stripEmojiDeep({ friends: [{ name: 'Sam 😎', trophies: 3 }], note: '🚀 go' });
    assertEqual(cleaned.friends[0].name, 'Sam', 'a nested name kept its emoji');
    assertEqual(cleaned.friends[0].trophies, 3, 'a number was changed');
    assertEqual(cleaned.note, 'go', 'a top-level string kept its emoji');
  });

  test('every answer from the network passes through the filter', () => {
    for (const file of ['friendsApi', 'battlesApi', 'news', 'tournament']) {
      const code = live(`src/game/${file}.ts`);
      assert(
        /stripEmojiDeep\(\s*\(?await response\.json\(\)/.test(code),
        `${file}.ts reads the network without stripping emoji`,
      );
    }
    const id = live('src/game/playerIdentity.ts');
    assert((id.match(/stripEmoji\(apple/g) ?? []).length >= 2, 'the Game Center name is not stripped');
  });
});
