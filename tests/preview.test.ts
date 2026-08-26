import { readFileSync } from 'node:fs';
import { assert, assertEqual, note, suite, test } from './harness';
import { recallScroll, rememberScroll, resetScrollForTests } from '../src/demo/menuScroll';
import { DICE_SKINS, STORE_SKINS } from '../src/game/diceSkins';
import { shellPreviewUri } from '../src/dice/preview';
import { PATTERN_SIZE, patternPixels, STICKER_FRACTION } from '../src/dice/patterns';

/**
 * The Store and Inventory pictures are generated, not drawn by hand, so
 * the encoder has to be right — a corrupt PNG shows as a blank card, not
 * an error. It silently produced one for real: the pattern blend returns
 * fractional values and PNG bytes must be whole numbers.
 */
const decode = (uri: string): Buffer =>
  Buffer.from(uri.split(',')[1], 'base64');

suite('preview · the picture is a real PNG', () => {
  test('every patterned skin produces a decodable PNG', () => {
    for (const skin of DICE_SKINS.filter((s) => s.pattern !== 'plain')) {
      const uri = shellPreviewUri(skin);
      assert(uri !== null, `${skin.name} has no preview`);
      assert(uri!.startsWith('data:image/png;base64,'), `${skin.name} bad prefix`);

      const png = decode(uri!);
      // Signature, then IHDR, and IEND at the very end.
      assertEqual(
        png.subarray(0, 8).toString('hex'),
        '89504e470d0a1a0a',
        `${skin.name} is not a PNG`,
      );
      assertEqual(png.subarray(12, 16).toString('ascii'), 'IHDR', `${skin.name} IHDR`);
      assertEqual(
        png.subarray(png.length - 8, png.length - 4).toString('ascii'),
        'IEND',
        `${skin.name} IEND`,
      );
      assertEqual(png.readUInt32BE(16), PATTERN_SIZE, `${skin.name} width`);
      assertEqual(png.readUInt32BE(20), PATTERN_SIZE, `${skin.name} height`);
    }
  });

  test('every chunk carries a correct CRC', () => {
    // A wrong CRC is exactly the kind of thing that decodes fine in one
    // reader and shows blank in another.
    const table = Array.from({ length: 256 }, (_v, n) => {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      return c >>> 0;
    });
    const crc = (b: Buffer) => {
      let c = 0xffffffff;
      for (const byte of b) c = table[(c ^ byte) & 0xff] ^ (c >>> 8);
      return (c ^ 0xffffffff) >>> 0;
    };

    const png = decode(shellPreviewUri(STORE_SKINS.find((s) => s.pattern !== 'plain')!)!);
    let at = 8;
    let chunks = 0;
    while (at < png.length) {
      const length = png.readUInt32BE(at);
      const body = png.subarray(at + 4, at + 8 + length);
      assertEqual(png.readUInt32BE(at + 8 + length), crc(body), 'chunk CRC');
      at += 12 + length;
      chunks++;
    }
    assertEqual(chunks, 3, 'expected IHDR, IDAT and IEND');
    assertEqual(at, png.length, 'trailing bytes after IEND');
  });

  test('the pixels are whole bytes', () => {
    // The bug: `base + (ink - base) * mask` is fractional, which a
    // Uint8Array truncated for free but a plain array did not.
    for (const skin of DICE_SKINS.filter((s) => s.pattern !== 'plain' && s.ink)) {
      const px = patternPixels(skin.pattern as never, skin.body, skin.ink!);
      assertEqual(px.length, PATTERN_SIZE * PATTERN_SIZE * 3, `${skin.name} size`);
      for (const v of px) {
        assert(
          Number.isInteger(v) && v >= 0 && v <= 255,
          `${skin.name} produced ${v}, which is not a byte`,
        );
      }
    }
  });

  test('a plain skin needs no picture at all', () => {
    for (const skin of DICE_SKINS.filter((s) => s.pattern === 'plain')) {
      assertEqual(shellPreviewUri(skin), null, `${skin.name} built a needless PNG`);
    }
  });

  test('the picture matches the dice you actually roll', () => {
    // Both come from patternPixels, so the shelf cannot drift from the
    // table — which is the whole point of the change.
    const skin = DICE_SKINS.find((s) => s.id === 'zebra')!;
    const a = patternPixels(skin.pattern as never, skin.body, skin.ink!);
    const b = patternPixels(skin.pattern as never, skin.body, skin.ink!);
    assert(a.every((v, i) => v === b[i]), 'the painter is not deterministic');
  });

  test('previews are built once and reused', () => {
    const skin = DICE_SKINS.find((s) => s.pattern !== 'plain')!;
    assert(shellPreviewUri(skin) === shellPreviewUri(skin), 'not cached');
  });
});

/**
 * Where the shelf was when you opened a preview.
 *
 * David, 26 Aug 2026: "after you exit a preview it should keep you where
 * you were on the screen and not put you back to the top of the screen."
 *
 * The cause is structural rather than a mistake: opening a preview
 * UNMOUNTS the menu page, because the Store and the Inventory only render
 * while nothing is being previewed, so the board behind is visible. A
 * ScrollView that is unmounted and mounted again is a NEW ScrollView, and
 * a new one starts at the top. That was survivable with a dozen items; it
 * is not with fifty-three dice and twenty battlefields, where the thing
 * you just tapped can be most of a screen's worth of scrolling away.
 *
 * So the offset is kept in a module, outside the component that goes
 * away. These tests are about that module and the two screens using it.
 */
suite('preview · the shelf stays where you left it', () => {
  test('a page opens again where it was scrolled to', () => {
    resetScrollForTests();
    assertEqual(recallScroll('inventory'), 0, 'a page never scrolled starts at the top');
    rememberScroll('inventory', 1840);
    assertEqual(recallScroll('inventory'), 1840, 'the offset came back changed');
  });

  test('the Store and the Inventory remember separately', () => {
    // One shared number would scroll the Store to wherever the Inventory
    // happened to be, which is worse than starting at the top.
    resetScrollForTests();
    rememberScroll('inventory', 900);
    rememberScroll('store', 120);
    assertEqual(recallScroll('inventory'), 900, 'the Inventory lost its place');
    assertEqual(recallScroll('store'), 120, 'the Store lost its place');
  });

  test('a bounce past the top does not become a negative offset', () => {
    /*
      iOS reports a negative contentOffset while the list is rubber-banded
      past its own top. Restoring to one leaves the page hanging below its
      header with a gap above it, which reads as a broken screen.
    */
    resetScrollForTests();
    rememberScroll('store', -64);
    assertEqual(recallScroll('store'), 0, 'a rubber-band offset was stored as-is');
  });

  test('both shelves are actually wired to it', () => {
    /*
      The module can be perfect and the screens can still not use it.
      This checks the three parts each screen needs: it reports where it
      is as it scrolls, it asks where it was on the way back, and it has
      a ref to scroll with.
    */
    for (const [file, page] of [
      ['src/demo/InventoryScreen.tsx', 'inventory'],
      ['src/demo/StoreScreen.tsx', 'store'],
    ] as const) {
      const source = readFileSync(file, 'utf8');
      assert(
        source.includes(`rememberScroll('${page}'`),
        `${file} never records where it is scrolled to`,
      );
      assert(
        source.includes(`recallScroll('${page}')`),
        `${file} never asks where it was`,
      );
      assert(
        /ref=\{scrollRef\}/.test(source) && /scrollEventThrottle/.test(source),
        `${file} has no way to scroll itself back`,
      );
      assert(
        /animated: false/.test(source),
        `${file} animates back to where it was — the jump is the point of not having one`,
      );
    }
  });
});

/**
 * No skin hides its design under the colour sticker.
 *
 * David, 26 Aug 2026: "a lot of the dice are messed up because the design
 * is in the center, which doesn't make sense because the colors are in
 * the center."
 *
 * He is describing a collision the two halves of a die's look were always
 * going to have, and which nobody had checked for. DieMesh draws a
 * coloured circle of radius `STICKER_FRACTION` of the face at the dead
 * centre of all six faces — that circle is the game signal, the thing a
 * roll is actually read from, and it covers a third of every face. A
 * pattern painter, meanwhile, works on a square tile with no idea any of
 * it is about to be covered. Eleven of the forty-three patterned skins
 * had put their whole subject in the middle:
 *
 *   - the Football's laces ran down the centre line, with TEN TIMES as
 *     much ink under the sticker as outside it — the faces were blank;
 *   - the Soccer Ball was one pentagon, dead centre, entirely hidden;
 *   - the Tennis Ball's two seams both crossed within six pixels of the
 *     middle, so only their tips showed;
 *   - the Basketball's seams were a cross whose junction was the centre;
 *   - the Bowling Ball's three finger holes were all inside the circle;
 *   - the Lemon was a wheel of segments radiating from a hidden hub.
 *
 * The measure is LOCAL CONTRAST — how much each pixel differs from its
 * neighbours — rather than how far each pixel is from the shell colour.
 * That distinction matters: a smooth gradient across a face is not a
 * design and scores near zero either way, while a seam, a spot or a lace
 * scores high wherever it is. Comparing "distance from the base colour"
 * instead flagged the Watermelon (whose flesh simply pales toward the
 * rind) and missed the Basketball entirely.
 */
suite('preview · the design goes where the colour is not', () => {
  const SLACK = 12;
  const RATIO = 1.35;

  /** Mean 3x3 local contrast inside the sticker's circle, and outside it. */
  function detail(px: number[], size: number): { inside: number; outside: number } {
    const grey: number[][] = [];
    for (let y = 0; y < size; y++) {
      const row: number[] = [];
      for (let x = 0; x < size; x++) {
        const k = (y * size + x) * 3;
        row.push(px[k] + px[k + 1] + px[k + 2]);
      }
      grey.push(row);
    }
    let inSum = 0;
    let outSum = 0;
    let inN = 0;
    let outN = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let lo = grey[y][x];
        let hi = lo;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const v = grey[(y + dy + size) % size][(x + dx + size) % size];
            if (v < lo) lo = v;
            if (v > hi) hi = v;
          }
        }
        const u = (x + 0.5) / size - 0.5;
        const v = (y + 0.5) / size - 0.5;
        if (Math.hypot(u, v) < STICKER_FRACTION) {
          inSum += hi - lo;
          inN++;
        } else {
          outSum += hi - lo;
          outN++;
        }
      }
    }
    return { inside: inSum / inN, outside: outSum / outN };
  }

  test('no skin puts more of its design under the sticker than around it', () => {
    const worst: { over: number; label: string }[] = [];
    for (const skin of DICE_SKINS) {
      if (skin.pattern === 'plain') continue;
      const px = patternPixels(skin.pattern, skin.body, skin.ink ?? skin.body);
      const { inside, outside } = detail(px, PATTERN_SIZE);
      /*
        The allowance is a ratio PLUS a flat slack, not a ratio alone.
        Denim's twill has a local contrast of about 12 against a shell of
        almost the same colour; on a field that faint the ratio is mostly
        noise, and a bare ratio would have banned a perfectly good
        pattern for having its speckle land one way rather than another.
      */
      const allowed = outside * RATIO + SLACK;
      worst.push({ over: inside - allowed, label: `${skin.id} ${inside.toFixed(0)} in / ${outside.toFixed(0)} out` });
      assert(
        inside <= allowed,
        `${skin.id} draws its design where the colour sticker covers it ` +
          `(${inside.toFixed(0)} of detail inside the circle against ${outside.toFixed(0)} outside)`,
      );
    }
    worst.sort((a, b) => b.over - a.over);
    for (const w of worst.slice(0, 3)) note(`closest to the line: ${w.label}`);
  });

  test('every patterned skin still has a design to see at all', () => {
    // The other way to pass the test above is to draw nothing anywhere.
    for (const skin of DICE_SKINS) {
      if (skin.pattern === 'plain') continue;
      const px = patternPixels(skin.pattern, skin.body, skin.ink ?? skin.body);
      const { outside } = detail(px, PATTERN_SIZE);
      assert(
        outside > 4,
        `${skin.id} has almost no visible pattern (local contrast ${outside.toFixed(1)})`,
      );
    }
  });

  test('the die and the patterns agree on how big the sticker is', () => {
    /*
      Two copies of 0.33 is how this comes back. If DieMesh grew the
      sticker and patterns.ts did not hear about it, every painter would
      go on carefully avoiding a circle smaller than the one actually
      being drawn, and the designs would start disappearing again with
      nothing failing.
    */
    const mesh = readFileSync('src/dice/DieMesh.tsx', 'utf8');
    assert(
      mesh.includes('size * STICKER_FRACTION'),
      'DieMesh sizes the colour sticker with its own number again',
    );
    assert(
      !/CircleGeometry\(size \* 0\.\d+/.test(mesh),
      'DieMesh has a hard-coded sticker radius',
    );
  });
});
