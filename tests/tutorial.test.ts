import { existsSync, readFileSync } from 'node:fs';
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

/**
 * The throw page, which is a DEMONSTRATION rather than a picture.
 *
 * David asked on 26 Aug 2026 for "a little video showing real game play
 * with a hand on the screen flicking the dice". It is animated rather
 * than filmed — see the note at the top of src/demo/ThrowDemo.tsx — and
 * these guard the two ways an animation like this goes wrong without
 * anybody noticing: it stops agreeing with the game, or its timeline
 * drifts until the story stops making sense.
 */
suite('tutorial · the throw demo', () => {
  const demo = readFileSync('src/demo/ThrowDemo.tsx', 'utf8');
  const screen = readFileSync('src/demo/TutorialScreen.tsx', 'utf8');

  /** The named marks, read out of the source rather than duplicated here. */
  function marks(): Record<string, number> {
    const block = demo.slice(demo.indexOf('const T = {'), demo.indexOf('};', demo.indexOf('const T = {')));
    const out: Record<string, number> = {};
    for (const [, k, v] of block.matchAll(/(\w+): ([0-9.]+),/g)) out[k] = Number(v);
    return out;
  }

  test('the page shows the demo, not three emoji', () => {
    /*
      It was 👆 💨 🎲 — emoji used as a picture, which is the single thing
      the Paper & Ink pass set out to remove everywhere else in the game.
      It also could not show the one thing the page is about: "swipe, and
      the dice go the way you swiped" is a MOVEMENT.
    */
    const at = screen.indexOf("art.kind === 'throw'");
    assert(at > 0, 'the throw page is gone');
    const body = screen.slice(at, at + 400);
    assert(body.includes('<ThrowDemo'), 'the throw page is not showing the demo');
    assert(
      !/bigEmoji/.test(body),
      'the throw page is back on emoji',
    );
  });

  test('it looks like the battlefield, not a blank rectangle', () => {
    /*
      David, 26 Aug 2026, on the first version: "it doesn't look like a
      mini arena and does not look anything like a hand."

      He was right. It played out on an empty cream rounded rectangle. The
      frames had been rendered and checked — but only for whether the
      TIMELINE made sense, never against what the game actually looks
      like, which is the whole point of a page that says "this is how it
      goes".

      So the furniture is named here. Every one of these is something in
      the real arena (hq/public/images/game-screenshot-1.jpeg): grass, a
      stone tray with battlements, a tiled floor, red corner towers, and
      the barred jail with the six prisoners behind it.
    */
    for (const piece of ['jail', 'bar', 'tray', 'floor', 'tileLine', 'merlon', 'tower', 'peg']) {
      assert(
        new RegExp(`^  ${piece}:? ?[:{]`, 'm').test(demo) || demo.includes(`${piece}: {`),
        `the demo has lost its ${piece} — it is drifting back to a blank box`,
      );
    }
    // The colours are the game's, sampled from that screenshot.
    for (const [name, hex] of [
      ['grass', '#82b16d'],
      ['stone', '#917f67'],
      ['floor', '#c1b295'],
      ['tower', '#e16355'],
    ] as const) {
      assert(demo.includes(hex), `the ${name} is no longer the colour the game uses (${hex})`);
    }
  });

  test('the dice are white with a colour spot, like the real ones', () => {
    /*
      The first version drew them as solid blocks of colour, which is not
      a thing a player ever sees — a die in this game is white with a big
      coloured circle on the face. Getting that wrong in the one place
      that teaches the rules is teaching the wrong picture.
    */
    const die = demo.slice(demo.indexOf('  die: {'), demo.indexOf('  spot: {'));
    assert(
      /backgroundColor: '#f[0-9a-f]{5}'/.test(die),
      'the die is no longer white — it has gone back to being a block of colour',
    );
    assert(demo.includes('  spot: {'), 'the die has lost its colour spot');
  });

  test('the finger is a rendered finger, not a shape', () => {
    /*
      Three versions of this. Two rounded rectangles — a circle on a
      stick, and David said so. Then a drawn cartoon hand. Then, at his
      asking, "a real looking finger", which is the better object anyway:
      what a player sees of their own hand on the glass IS a fingertip.

      What makes it real is shading and having no outline, and neither is
      something a View can do — react-native-svg is native code we cannot
      add. So it is an image, which ships over the air with the update
      like every other asset.
    */
    assert(
      /require\('\.\.\/\.\.\/assets\/tutorial\/finger\.png'\)/.test(demo),
      'the finger is not the rendered one any more',
    );
    assert(
      existsSync('assets/tutorial/finger.png'),
      'the finger image is missing, so the demo would render an empty box',
    );
    assert(
      existsSync('assets/tutorial/make-finger.py'),
      'the generator is gone, so nobody can regenerate or adjust the finger',
    );
    assert(
      !existsSync('assets/tutorial/hand.png'),
      'the old cartoon hand is still being shipped as a dead asset',
    );
    assert(
      !/fingertip:|finger:/.test(demo),
      'the finger is back to being assembled from rounded rectangles',
    );
  });

  test('the dice land square, exactly as the real ones must', () => {
    /*
      The one that matters most, because it is the demo CONTRADICTING the
      game rather than merely looking odd.

      The spin was `lane * 560 + 380`, which lands the right-hand die at
      940° — 220° once you take the whole turns off — so it came to rest
      sitting on the table as a diamond. The game refuses to do that: a
      roll ends only when the dice have landed flat, and a die that stops
      cocked is turned square before its colour is read (src/dice/settle.ts
      and snapDieToNearestFace). A tutorial demonstrating the opposite of
      the rule teaches the wrong thing.
    */
    const turns = /const turns = lane === 1 \? (\d+) : (\d+);/.exec(demo);
    assert(turns !== null, 'the demo no longer states its rotation');
    for (const total of [Number(turns![1]), Number(turns![2])]) {
      note(`a die turns ${total}° — ${total / 360} whole turns`);
      assertEqual(
        total % 360,
        0,
        `a die stops ${total % 360}° off square — it would settle as a diamond`,
      );
      assert(total >= 360, `${total}° is less than one turn — that is a nudge, not a throw`);
    }
    assert(
      Number(turns![1]) !== Number(turns![2]),
      'both dice spin the same amount, so they read as one object thrown twice',
    );
  });

  test('the story happens in an order that makes sense', () => {
    /*
      Every one of these was wrong at some point while building it, and
      each was visible only once the frames were actually drawn:
      the dice sat on the table before the hand had touched it, and the
      prisoner started leaving while the second die was still bouncing.
    */
    const T = marks();
    const RIGHT_DIE_DELAY = 0.045; // the stagger, so the two do not overlap
    const LANDING_SQUASH = 0.03;
    const lastLanding = T.diceLand + RIGHT_DIE_DELAY + LANDING_SQUASH;

    assert(T.handIn < T.swipeStart, 'the hand flicks before it arrives');
    assert(T.swipeStart < T.swipeEnd, 'the swipe ends before it starts');
    assert(T.diceFly >= T.swipeStart, 'the dice leave before the finger moves');
    assert(T.diceFly < T.diceLand, 'the dice land before they are thrown');
    assert(
      T.settled >= lastLanding,
      `the prisoner is freed at ${T.settled} but the second die is still ` +
        `bouncing until ${lastLanding.toFixed(3)} — the match has to come first`,
    );
    assert(T.settled < T.freed && T.freed < T.gone, 'the prisoner leaves out of order');
    assert(T.gone < T.reset, 'the loop restarts before the prisoner is away');
    assert(T.reset < 1, 'the loop never resets, so it jump-cuts');
    note(
      `throw ${T.diceFly} → land ${lastLanding.toFixed(3)} → freed ${T.settled} → gone ${T.gone}`,
    );
  });

  test('it can be stopped by somebody who needs it stopped', () => {
    /*
      A loop that never ends, on a page a person may sit on for a while,
      is exactly what the reduce-motion setting exists for. Holding the
      FINISHED frame loses nothing — matched dice and an empty cell is the
      frame that carries the meaning.
    */
    assert(
      /AccessibilityInfo\.isReduceMotionEnabled/.test(demo),
      'the demo never asks whether motion should be reduced',
    );
    assert(
      /reduceMotionChanged/.test(demo),
      'the demo does not notice the setting being turned on while it is open',
    );
    assert(
      /if \(reduceMotion\) \{\s*\n\s*t\.setValue\(T\.freed\);/.test(demo),
      'reduce motion no longer holds the finished frame',
    );
    assert(
      /return \(\) => loop\.stop\(\);/.test(demo),
      'the loop is never stopped, so it runs on after the tutorial closes',
    );
  });

  test('it runs off the JS thread', () => {
    // A tutorial that stutters while React re-renders is worse than a
    // still picture. Everything animated here is transform or opacity,
    // which is what makes the native driver possible.
    assert(
      /useNativeDriver: true/.test(demo),
      'the demo animates on the JS thread',
    );
    assert(
      !/useNativeDriver: false/.test(demo),
      'something in the demo dropped off the native driver',
    );
  });

  test('it shows the game’s real colours and shapes', () => {
    // Same rule as the die icon: a second copy of the palette drifts.
    assert(
      /from '\.\.\/game\/colors'/.test(demo),
      'the demo no longer reads the real palette',
    );
    assert(
      /COLOR_SYMBOLS/.test(demo) && /symbols &&/.test(demo),
      'the demo ignores colourblind mode, so it teaches a game the player will not see',
    );
  });
});

/**
 * The battlefield pictures in the Inventory.
 *
 * They were emoji — 🏰 🌅 🌴 🚀 — the last four in the interface after
 * the Paper & Ink pass took them out of everywhere else. David asked on
 * 26 Aug 2026 for hand-drawn pictures, "detailed enough to be distinct
 * and accurate", and the emoji failed both halves at once: 🏰 and 🌅 are
 * the same building in this game, and every emoji renders differently on
 * every phone, so the menu could not even be sure what it looked like.
 *
 * These read the PNGs and measure them, because the two things asked for
 * are properties of the pictures rather than of the code.
 */
suite('inventory · the battlefield pictures', () => {
  const { execSync } = require('node:child_process') as typeof import('node:child_process');
  const IDS = [
    'castle', 'castle-sunset', 'jungle', 'space',
    // The sixteen themed battlefields, added 26 Aug 2026.
    'snow', 'desert', 'volcano', 'beach', 'candy', 'glade', 'autumn', 'cove',
    'farm', 'aurora', 'reef', 'cavern', 'city', 'sky', 'moon', 'toybox',
  ];

  /**
   * A coarse colour histogram of one picture, via Python's PIL.
   *
   * `rgb` is a 4x4x4 histogram over the WHOLE colour cube, flattened to
   * 64 bins. It replaced a hue-only histogram when the set grew from
   * four arenas to twenty: hue alone scored the desert and the toy room
   * 0.09 apart — both sandy-yellow at heart — while any pair of eyes
   * tells them apart instantly, because eyes also use lightness and the
   * secondary colours. Twelve hue bins cannot hold twenty biomes; the
   * full cube can.
   */
  function stats(id: string): { colours: number; sat: number; rgb: number[] } {
    const out = execSync(
      `python3 -c "
from PIL import Image
import colorsys
im = Image.open('assets/arenas/${id}.png').convert('RGB').resize((64,64))
px = list(im.getdata())
q = set((r//24, g//24, b//24) for r,g,b in px)
hsv = [colorsys.rgb_to_hsv(r/255,g/255,b/255) for r,g,b in px]
sat = sum(s for _,s,_ in hsv)/len(hsv)
bins = [0]*64
for r,g,b in px:
    bins[(r//64)*16 + (g//64)*4 + (b//64)] += 1
print(len(q), round(sat,4), ' '.join(str(b) for b in bins))
"`,
      { encoding: 'utf8' },
    ).trim().split(' ');
    return {
      colours: Number(out[0]),
      sat: Number(out[1]),
      rgb: out.slice(2).map(Number),
    };
  }

  test('every battlefield has a picture, and the emoji are gone', () => {
    const art = readFileSync('src/arena/arenaArt.ts', 'utf8');
    const inv = readFileSync('src/demo/InventoryScreen.tsx', 'utf8');
    for (const id of IDS) {
      assert(existsSync(`assets/arenas/${id}.png`), `${id} has no picture`);
      assert(art.includes(`assets/arenas/${id}.png`), `${id} is not wired up`);
    }
    assert(
      !/swatchEmoji/.test(inv),
      'the Inventory is drawing an emoji for a battlefield again',
    );
    assert(
      inv.includes('ARENA_ART[id]'),
      'the Inventory no longer shows the drawn pictures',
    );
    assert(
      existsSync('assets/arenas/make-arenas.py'),
      'the generator is gone, so nobody can adjust or redraw these',
    );
  });

  test('they have real colour in them, not a flat wash', () => {
    // "Make sure they have color and are detailed enough" — David. A
    // two-tone gradient would pass a "does a file exist" check and fail
    // the actual request.
    for (const id of IDS) {
      const s = stats(id);
      note(`${id}: ${s.colours} colour buckets, saturation ${s.sat.toFixed(2)}`);
      assert(
        s.colours >= 18,
        `${id} has only ${s.colours} distinct colour buckets — it is a flat wash, not a picture`,
      );
      /*
        0.08, down from 0.2 — deliberately, and not to make a failure go
        away. The old floor was written when all four arenas were
        saturated biomes; a SNOWFIELD and a MOON BASE are desaturated on
        purpose, and demanding jungle-level saturation of snow would just
        ban winter. What "not a flat wash" actually needs is carried by
        the bucket count above and the pairwise-distance test below;
        this floor now only catches a picture that lost its colour
        entirely.
      */
      assert(
        s.sat > 0.08,
        `${id} is nearly grey (saturation ${s.sat.toFixed(2)})`,
      );
    }
  });

  test('no two battlefields could be mistaken for each other', () => {
    /*
      The half that has already gone wrong here once: the Sunset Castle
      was reported as "doesn't really look any different from the regular
      castle" and had to be rebuilt. With twenty arenas this is the test
      most worth having, because every new biome is a chance to quietly
      repaint an old one.

      Measured over the full colour cube (see stats), total variation
      distance: 0 is the same picture, 1 shares nothing. The bar is 0.28;
      the set was tuned until its worst pair — the Space Station and the
      Crystal Cavern, both dark worlds with glowing accents — sat at 0.30,
      which took giving the cavern its gold spires. Only the worst few
      pairs are printed; 190 lines of notes helped nobody.
    */
    const norm = (h: number[]) => {
      const total = h.reduce((a, b) => a + b, 0) || 1;
      return h.map((v) => v / total);
    };
    const all = Object.fromEntries(IDS.map((id) => [id, norm(stats(id).rgb)]));
    const pairs: { d: number; label: string }[] = [];
    for (let i = 0; i < IDS.length; i++) {
      for (let j = i + 1; j < IDS.length; j++) {
        const a = all[IDS[i]];
        const b = all[IDS[j]];
        const d = a.reduce((sum, v, k) => sum + Math.abs(v - b[k]), 0) / 2;
        pairs.push({ d, label: `${IDS[i]} vs ${IDS[j]}` });
      }
    }
    pairs.sort((a, b) => a.d - b.d);
    for (const p of pairs.slice(0, 5)) note(`${p.label}: ${p.d.toFixed(2)} apart`);
    assert(
      pairs[0].d >= 0.28,
      `${pairs[0].label} are only ${pairs[0].d.toFixed(2)} apart in colour — too alike to tell at 58pt`,
    );
  });

  test('the themed pictures are painted from the themes themselves', () => {
    /*
      The sixteen themed thumbnails cannot drift from their arenas by
      construction: the generator PARSES themeData.ts for each theme's
      ground, hill, mountain and sky colours instead of keeping copies.
      This pins that construction, because a future rewrite that inlines
      the colours would quietly re-open the drift the design closed.
    */
    const gen = readFileSync('assets/arenas/make-themed-art.py', 'utf8');
    assert(
      gen.includes('src/arena/themeData.ts'),
      'make-themed-art.py no longer reads themeData.ts — the thumbnails can drift from the arenas',
    );
    for (const id of IDS) {
      assert(existsSync(`assets/arenas/${id}.png`), `${id} has no picture`);
    }
  });

  test('each original is made of its own arena’s paint', () => {
    /*
      ACCURATE, the third thing asked for. A pretty picture of a castle
      that is not THIS castle would still be wrong. The generator names
      the source colours; this checks the ones that carry each place.
    */
    const gen = readFileSync('assets/arenas/make-arenas.py', 'utf8');
    for (const [what, hex] of [
      ['the castle sky', '#8ec8f7'],
      ['the castle roofs', '#ff7f66'],
      ['the castle grass', '#48a457'],
      ['the jungle canopy', '#3a7a3e'],
      ['the jungle water', '#7fceb0'],
      ['the space sky', '#0a0e2a'],
      ['the space neon', '#3ff2ff'],
    ] as const) {
      assert(
        gen.includes(hex),
        `${what} (${hex}) is no longer the colour the arena actually uses`,
      );
    }
  });
});
