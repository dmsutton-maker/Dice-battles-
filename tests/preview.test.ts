import { assert, assertEqual, suite, test } from './harness';
import { DICE_SKINS, STORE_SKINS } from '../src/game/diceSkins';
import { shellPreviewUri } from '../src/dice/preview';
import { PATTERN_SIZE, patternPixels } from '../src/dice/patterns';

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
