import { readFileSync } from 'node:fs';
import { assert, assertEqual, note, suite, test } from './harness';
import { ICON, THEME } from '../src/ui/theme';
import { PRISONER_COLORS } from '../src/game/colors';

/**
 * The drawn icon set.
 *
 * Two things David asked for on 24 Aug 2026 are guarded here, because
 * both are the kind of thing that looks fine in a diff and wrong on a
 * phone: the Cups tab and the trophy count must not be one picture, and
 * a coloured icon must still read as a drawing rather than a blob.
 */

const SOURCE = readFileSync('src/ui/Icon.tsx', 'utf8');
const NAV = readFileSync('src/demo/BottomNav.tsx', 'utf8');

/**
 * The file with every comment stripped.
 *
 * Slicing "the trophy" as the text between two `export function` lines
 * swallows the NEXT icon's doc comment, which is how the first version of
 * the test below decided the trophy had grown a ribbon: the word was in
 * the medal's prose, four lines above `export function MedalIcon`. These
 * tests are about what is DRAWN, so they read code and nothing else.
 */
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

/**
 * The body of one icon, comments already gone. `next` is the icon that
 * follows it in the file, or null for the last one.
 */
function drawingOf(icon: string, next: string | null): string {
  const start = CODE.indexOf(`export function ${icon}`);
  assert(start >= 0, `${icon} is gone`);
  if (next === null) return CODE.slice(start);
  const end = CODE.indexOf(`export function ${next}`);
  assert(end > start, `${next} no longer follows ${icon}`);
  return CODE.slice(start, end);
}

/** WCAG relative luminance, for contrast between two solid colours. */
function lum(hex: string): number {
  const h = hex.replace('#', '');
  const part = (i: number) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * part(0) + 0.7152 * part(2) + 0.0722 * part(4);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [lum(a) + 0.05, lum(b) + 0.05].sort((x, y) => y - x);
  return hi / lo;
}

suite('icons · Cups and trophies are different pictures', () => {
  test('the Cups tab does not use the trophy', () => {
    /*
      Both were TrophyIcon. A player seeing a trophy could not tell
      whether it meant "your trophies" or "the Cups tab" — one drawing
      answering two different questions.
    */
    const cups = /\{ id: 'cups'[^}]*Icon: (\w+) \}/.exec(NAV);
    assert(cups !== null, 'the Cups tab is gone from the bar');
    assertEqual(cups![1], 'BracketIcon', 'Cups is back on an award drawing');
    assert(
      !/Icon: TrophyIcon/.test(NAV),
      'the trophy is being used as a tab icon again',
    );
  });

  test('the bracket and the trophy share no geometry at all', () => {
    /*
      Not just different names. Cups was a trophy, then a MEDAL, and both
      times David said it still looked the same — because a cup and a
      medal are both "round object, outlined, centred" once they are 21
      pixels wide. The rule now is stronger than "a different award": the
      Cups icon must be made of LINES where the trophy is made of filled
      masses, so the two cannot converge again.
    */
    const trophy = drawingOf('TrophyIcon', 'BracketIcon');
    const bracket = drawingOf('BracketIcon', 'RanksIcon');

    // The trophy is a body: a bowl, a stem and a foot, all filled.
    const fills = (body: string) => (body.match(/backgroundColor: fill/g) ?? []).length;
    assert(fills(trophy) >= 3, 'the trophy is no longer a filled gold cup');
    assert(
      /borderBottomLeftRadius/.test(trophy),
      'the trophy lost the rounded underside of its bowl',
    );

    // The bracket is a diagram: thin bars, and only ONE filled thing —
    // the champion at the end of it.
    assert(fills(bracket) <= 1, 'the bracket has grown filled masses like a cup');
    assert(
      !/borderBottomLeftRadius/.test(bracket),
      'the bracket has grown a bowl',
    );
    // Its lines run the full width; a cup never does.
    assert(
      /xJoin/.test(bracket) && /xOut/.test(bracket),
      'the bracket no longer runs across the box',
    );
  });

  test('the bracket is drawn in ink only', () => {
    /*
      David asked on 25 Aug 2026 for the Cups icon to be black and white
      like the rest of the bar. Its champion dot was gold, which made it
      the one diagram on screen pretending to be an object — and a third
      gold spot beside the coin and the trophy.

      Guarded as "no colour token anywhere in the drawing" rather than
      "not gold": the failure mode is somebody reaching for ICON.bronze
      to make the winner feel like a prize, which is the same mistake
      wearing a different hex.
    */
    const bracket = drawingOf('BracketIcon', 'RanksIcon');
    assert(
      !/THEME\.gold|ICON\./.test(bracket),
      'the Cups icon has been given a colour again — a bracket is a diagram, not an object',
    );
    assert(
      /fill = color/.test(bracket),
      'the bracket fill no longer follows its ink, so it can drift to a colour of its own',
    );
  });

  test('Cups is not drawn as any kind of award', () => {
    // The medal was the second failed attempt. Naming it here means the
    // next person reaching for "just use a different trophy" is stopped
    // by a test rather than by David noticing on his phone.
    assert(
      !/export function MedalIcon/.test(SOURCE),
      'a medal is back — Cups needs a different KIND of picture, not a different award',
    );
    const bracket = drawingOf('BracketIcon', 'RanksIcon');
    assert(!/ribbon/i.test(bracket), 'the Cups icon has grown a ribbon again');
  });

  test('the trophy does not collide with the coin either', () => {
    // Two gold things share the interface: the coin and the trophy. (The
    // bracket's champion was a third until David asked for it to go back
    // to ink.) The coin is a plain disc with a four-point sparkle struck
    // into it; the trophy has to stay a cup with handles or it becomes a
    // second gold circle.
    const coin = readFileSync('src/demo/GoldCoin.tsx', 'utf8');
    assert(/emboss/.test(coin), 'the coin lost its struck mark');
    const trophy = drawingOf('TrophyIcon', 'BracketIcon');
    assert(!/emboss/.test(trophy), 'the trophy is now struck like the coin');
    assert(
      (trophy.match(/borderRadius: size \* 0\.13/g) ?? []).length >= 2,
      'the trophy lost the handles that keep it from reading as a coin',
    );
  });
});

suite('icons · the four game modes', () => {
  /**
   * They were emoji — ⚔️ 🔁 🤼 🎯 — and David asked on 26 Aug 2026 for
   * drawn icons "in the same style as everything else".
   *
   * Two things are guarded, and they are the two that went wrong when
   * Cups and the trophy were both a cup: the drawings must be different
   * KINDS of shape rather than four variations on one, and each must
   * still be legible on the SELECTED chip, which is gold.
   */
  const MODE_ICONS = ['RushIcon', 'UltimateIcon', 'SkirmishIcon', 'ColorWarIcon'];

  test('every mode has a drawing, and no mode has an emoji', () => {
    const modes = readFileSync('src/game/modes.ts', 'utf8');
    const map = readFileSync('src/ui/modeIcons.ts', 'utf8');
    const screen = readFileSync('src/demo/DiceDemoScreen.tsx', 'utf8');
    const tutorial = readFileSync('src/demo/TutorialScreen.tsx', 'utf8');

    assert(
      !/^\s*emoji:/m.test(modes),
      'a mode carries an emoji again — a string on the definition is an invitation to render it',
    );
    for (const icon of MODE_ICONS) {
      assert(map.includes(icon), `${icon} is not in the mode map`);
      assert(SOURCE.includes(`export function ${icon}`), `${icon} is gone`);
    }
    // Both places modes are shown draw from the same map.
    assert(screen.includes('MODE_ICONS[id]'), 'the mode picker is not using the drawings');
    assert(tutorial.includes('MODE_ICONS[id]'), 'the tutorial is not using the drawings');
  });

  test('the four are different KINDS of picture, not four of one', () => {
    /*
      The lesson from Cups: a trophy and a medal are both "round object,
      outlined, centred" once they are 14 pixels wide, and David said so
      twice. So each mode draws its RULE, and the shapes are checked to be
      built from different primitives — a pair of tiles, a ring, two
      triangles, a divided box.
    */
    const rush = drawingOf('RushIcon', 'UltimateIcon');
    const ultimate = drawingOf('UltimateIcon', 'SkirmishIcon');
    const skirmish = drawingOf('SkirmishIcon', 'ColorWarIcon');
    const war = drawingOf('ColorWarIcon', 'CloseIcon');

    // Color Rush: two identical tiles. The match IS the game.
    assertEqual(
      (rush.match(/tile\(/g) ?? []).length,
      2,
      'Color Rush no longer shows a matching PAIR',
    );
    /*
      Ultimate: a RING, which nothing else here has. Checked by its radius
      rather than by a transparent border side — the first version of this
      looked for `borderTopColor: 'transparent'` and failed on Skirmish,
      because that is simply how every CSS triangle is built. A radius of
      about a third of the box is a circle; every other mode icon here is
      a rounded rectangle at 0.09 to 0.11.
    */
    assert(
      /borderRadius: size \* 0\.3\d/.test(ultimate),
      'Ultimate is no longer built on a ring — a returning arrow needs something to travel round',
    );
    assert(
      /borderTopColor: 'transparent'/.test(ultimate),
      'Ultimate lost the opening in its ring — a closed circle is not a returning arrow',
    );
    // Skirmish: two arrows closing on ONE thing.
    assertEqual(
      (skirmish.match(/arrow\(/g) ?? []).length,
      2,
      'Skirmish no longer shows two sides reaching for the same prisoner',
    );
    // Color War: a field split in two.
    assertEqual(
      (war.match(/half\(/g) ?? []).length,
      2,
      'Color War is no longer a board split between two colours',
    );
    // And none of the others has quietly become a ring too.
    for (const [name, body] of [['rush', rush], ['skirmish', skirmish], ['war', war]] as const) {
      assert(
        !/borderRadius: size \* 0\.3\d/.test(body),
        `${name} has grown a ring — it is converging on Ultimate`,
      );
    }
  });

  test('nothing vanishes on the selected chip, which is gold', () => {
    /*
      The one that is invisible in a diff. The picked mode's chip is
      THEME.gold, and yellow is 1.14:1 against it AND the same hue, so a
      yellow fill would read as a hole punched in the chip at exactly the
      moment the icon matters most.

      Every prisoner colour is low-contrast on gold — the ink outline is
      what carries the silhouette there, as everywhere. This forbids only
      the one that is also the same COLOUR.
    */
    const bodies = [
      drawingOf('RushIcon', 'UltimateIcon'),
      drawingOf('UltimateIcon', 'SkirmishIcon'),
      drawingOf('SkirmishIcon', 'ColorWarIcon'),
      drawingOf('ColorWarIcon', 'CloseIcon'),
    ].join('\n');

    const yellow = PRISONER_COLORS.find((c) => c.id === 'yellow')!;
    const ratio = contrast(yellow.hex, THEME.gold);
    note(`yellow on the selected chip: ${ratio.toFixed(2)}:1`);
    assert(
      !/hex\('yellow'\)/.test(bodies),
      `a mode icon is filled yellow, which is ${ratio.toFixed(2)}:1 on the gold chip it sits on`,
    );
    assert(
      !/hex\('blue'\)/.test(bodies),
      'a mode icon is filled blue — the ink outline is only 2.25:1 on it and the drawing dissolves',
    );
    /*
      Every fill they DO use has to hold the ink outline.

      Matched by looking for each colour's NAME as a quoted string, not by
      hunting for `hex('…')`. Color War passes its two colours as
      arguments to a local helper — `half(0, 'orange')` — so a regex tied
      to the hex() call site found nothing in it and the check silently
      passed on an empty set, which is worse than not having it.
    */
    let checked = 0;
    for (const c of PRISONER_COLORS) {
      if (!new RegExp(`'${c.id}'`).test(bodies)) continue;
      checked += 1;
      const r = contrast(THEME.ink, c.hex);
      note(`${c.id}: ink outline ${r.toFixed(2)}:1`);
      assert(r >= 3, `the ink outline is only ${r.toFixed(2)}:1 on ${c.id}`);
    }
    assert(
      checked >= 4,
      `only ${checked} colours were found in the mode icons — the check is looking in the wrong place again`,
    );
  });
});

suite('icons · colour that still reads as a drawing', () => {
  /**
   * Every fill an icon can carry, and what has to stay legible on it.
   * `mark` is a shape drawn ON the fill; where none is listed, only the
   * ink outline sits on that colour.
   */
  const FILLS: { name: string; hex: string; mark?: string }[] = [
    { name: 'leather (Store bag)', hex: ICON.leather },
    { name: 'wood (Items crate)', hex: ICON.wood },
    { name: 'bronze (Ranks)', hex: ICON.bronze },
    { name: 'silver (Ranks)', hex: ICON.silver },
    { name: 'gold (Ranks, trophy)', hex: THEME.gold },
    { name: 'steel (Settings gear)', hex: ICON.steel },
    { name: 'info (How to play)', hex: ICON.info, mark: ICON.onFill },
  ];

  test('the ink outline survives every fill', () => {
    /*
      The outline is what keeps these drawings rather than blobs, and it
      is the only thing holding a gold trophy apart from a paper card.
      3:1 is WCAG's bar for a graphical object; the blue disc was picked
      first at 2.77:1 and had to be solved for.
    */
    for (const { name, hex } of FILLS) {
      const ratio = contrast(THEME.ink, hex);
      note(`${name}: ink outline ${ratio.toFixed(2)}:1`);
      assert(
        ratio >= 3,
        `the ink outline is only ${ratio.toFixed(2)}:1 on ${name} — the drawing dissolves into the fill`,
      );
    }
  });

  test('a mark reversed out of a fill is readable on it', () => {
    for (const { name, hex, mark } of FILLS) {
      if (!mark) continue;
      const ratio = contrast(mark, hex);
      note(`${name}: reversed mark ${ratio.toFixed(2)}:1`);
      assert(
        ratio >= 4.5,
        `the mark on ${name} is only ${ratio.toFixed(2)}:1 — it is the one thing that icon exists to show`,
      );
    }
  });

  test('the die shows the game’s real colours, not a copy of them', () => {
    /*
      A second copy of the palette would drift away from the dice on the
      board, and the whole point of the icon is that it shows what the
      game is about.
    */
    assert(
      /from '\.\.\/game\/colors'/.test(SOURCE),
      'the die icon no longer reads the real palette',
    );
    const die = drawingOf('DieIcon', 'TrophyIcon');
    for (const id of ['red', 'green', 'blue']) {
      assert(die.includes(`hex('${id}')`), `the die lost its ${id} pip`);
      assert(
        PRISONER_COLORS.some((c) => c.id === id),
        `${id} is not a prisoner colour any more — the die icon asks for one that does not exist`,
      );
    }
  });

  test('every icon still accepts a fill, so it can be drawn on ink', () => {
    // The launch card draws the die on a near-black ground. An icon that
    // could not be told what to fill with would be a white-on-white hole.
    for (const icon of ['BagIcon', 'CrateIcon', 'DieIcon', 'TrophyIcon', 'BracketIcon']) {
      const start = SOURCE.indexOf(`export function ${icon}`);
      assert(start > 0, `${icon} is gone`);
      const signature = SOURCE.slice(start, start + 260);
      assert(
        /fill = /.test(signature),
        `${icon} takes no fill, so it cannot be drawn on a dark background`,
      );
    }
  });

  test('close and chevron stay ink — they are controls, not objects', () => {
    // A red X or a blue chevron would read as a state rather than a
    // button. Colour is for the things the game is made of.
    // ChevronIcon is last in the file, so it has no following icon to
    // slice against. Passing itself as the boundary would make the slice
    // empty and the check pass on nothing.
    for (const [icon, next] of [
      ['CloseIcon', 'ChevronIcon'],
      ['ChevronIcon', null],
    ] as const) {
      const body = drawingOf(icon, next);
      assert(body.length > 0, `${icon} sliced to nothing`);
      assert(
        !/ICON\./.test(body),
        `${icon} has been given an object colour — controls stay ink`,
      );
    }
  });
});
