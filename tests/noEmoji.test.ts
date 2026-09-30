import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { assertEqual, note, suite, test } from './harness';

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
 * The dice, battlefields and ladder rungs still CARRY an `emoji` field
 * in their data. Nothing draws it; the rule is about what reaches a
 * screen.
 */

// Pictographic ranges. The plain ✓ tick and ✕ close mark are ordinary
// text glyphs drawn in the game's ink, not colour emoji, and are allowed.
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}\u{FE0F}]/u;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : path.endsWith('.tsx') ? [path] : [];
  });
}

/** Source with its comments removed — the prose may quote an emoji. */
const live = (path: string) =>
  readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''))
    .replace(/\/\/[^\n]*/g, '');

suite('no emoji on any screen', () => {
  // The folders that draw screens. src/arena and src/game hold data —
  // the arena list carries an `emoji` field the same way the dice do —
  // and draw no text of their own.
  const screens = ['src/demo', 'src/ui', 'src/debug'].flatMap(files);

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
