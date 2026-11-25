#!/usr/bin/env python3
"""
The fixed artwork on the "Share your win" card.

Marc, 5 Nov 2026: "when someone wins, come up with a winning exciting
screenshot from their game and give them the option if they want to
share that screenshot of the game to like Instagram".

The card is composed ON THE PHONE, in the game's own GL context
(src/share/composeCard.ts): the board picture, then these PNGs laid over
it. React Native has no canvas and the game ships no text-rendering
library, so every fixed word is a picture made here, once, and the only
things decided on the phone are which pictures go where (src/share/
shareCard.ts) and which digits spell the score.

What this writes:

  assets/share/victory.png      the banner, gold on ink, baked rotation
  assets/share/panel.png        the paper card the words sit on
  assets/share/title.png        "Dice Battles: Color Rush", white on ink
  assets/share/of.png           "of"         }  white glyphs with alpha,
  assets/share/freed.png        "freed"      }  tinted on the phone
  assets/share/trophies.png     "trophies"   }
  assets/share/digits.png       0-9 and "+", score size  } one sheet, a
  assets/share/digits-small.png 0-9 and "+", small size  } cell per glyph
  assets/share/mode-*.png       the four mode names, tinted on the phone
  src/share/shareArtManifest.ts every picture's size and every digit's
                                cell, so the layout maths is pure and
                                testable and cannot drift from the PNGs

Every glyph picture of one font size keeps the font's full vertical box
(ascent + descent) and is trimmed only sideways, so pictures of the same
size placed at the same y share a baseline. That is what lets "6 of 6
freed" be typeset from five pictures without any metrics on the phone.

THE FONT. Inter Black, from the Inter Project (https://rsms.me/inter/),
licensed under the SIL Open Font License 1.1. The OFL puts no condition
on documents made with the font, which is all these PNGs are; the font
file itself is not shipped. The repo and node_modules hold no font file,
so this reads the system copy (Debian package `fonts-inter`). Inter was
chosen because the game's own type is the system's bold sans at weights
700-900 (src/ui/theme.ts TYPE), and Inter is the closest open face to
that.

Run from the repo root:  python3 tools/share-card/make_art.py
"""

from __future__ import annotations

import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'share')
MANIFEST = os.path.join(ROOT, 'src', 'share', 'shareArtManifest.ts')

FONT_CANDIDATES = [
    '/usr/share/fonts/opentype/inter/Inter-Black.otf',
    '/usr/share/fonts/truetype/inter/Inter-Black.ttf',
    os.path.expanduser('~/.fonts/Inter-Black.otf'),
]

# src/ui/theme.ts — the card is the game's own paper and ink.
INK = (0x1D, 0x1A, 0x2E, 255)
SURFACE = (0xFF, 0xFF, 0xFF, 255)
GOLD = (0xFF, 0xD2, 0x1F, 255)
WHITE = (255, 255, 255, 255)
CLEAR = (0, 0, 0, 0)

# Font sizes, in card pixels (the card is 1080 x 1350).
BANNER_SIZE = 180
SCORE_SIZE = 120
MODE_SIZE = 76
SMALL_SIZE = 52
TITLE_SIZE = 46

DIGIT_CHARS = '0123456789+'
MODE_NAMES = {
    'modeClassic': 'Color Rush',
    'modeUltimate': 'Ultimate',
    'modeSkirmish': 'Skirmish',
    'modeColorwar': 'Color War',
}


def font_path() -> str:
    for p in FONT_CANDIDATES:
        if os.path.exists(p):
            return p
    sys.exit(
        'Inter Black not found. Install the fonts-inter package (Debian/Ubuntu: '
        'apt install fonts-inter) or put Inter-Black.otf at one of: '
        + ', '.join(FONT_CANDIDATES)
    )


def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(font_path(), size)


def glyph_picture(text: str, size: int, fill=WHITE, stroke: int = 0, stroke_fill=INK, pad: int = 2):
    """
    `text` as a picture: the font's full vertical box at `size`, trimmed
    sideways to the ink plus `pad`. Returns (image, advance_width).
    """
    f = font(size)
    ascent, descent = f.getmetrics()
    box_h = ascent + descent + 2 * stroke
    # Measure at a generous width, then trim sideways.
    probe = Image.new('RGBA', (len(text) * size * 2 + 64, box_h), CLEAR)
    d = ImageDraw.Draw(probe)
    d.text((stroke + 8, stroke), text, font=f, fill=fill, stroke_width=stroke, stroke_fill=stroke_fill)
    bbox = probe.getbbox()
    if bbox is None:
        raise SystemExit(f'nothing drawn for {text!r}')
    left, _top, right, _bottom = bbox
    left = max(0, left - pad)
    right = min(probe.width, right + pad)
    return probe.crop((left, 0, right, box_h))


def digit_sheet(size: int):
    """All of DIGIT_CHARS side by side; returns (sheet, cells) with each glyph's x and width."""
    pics = [(c, glyph_picture(c, size, pad=2)) for c in DIGIT_CHARS]
    gap = 4
    width = sum(p.width for _, p in pics) + gap * (len(pics) - 1)
    height = pics[0][1].height
    sheet = Image.new('RGBA', (width, height), CLEAR)
    cells = {}
    x = 0
    for c, p in pics:
        sheet.paste(p, (x, 0))
        cells[c] = {'x': x, 'width': p.width}
        x += p.width + gap
    return sheet, cells


def banner():
    """VICTORY! — gold, an ink outline, a hard ink drop, tilted a little. Depth from shape."""
    f = font(BANNER_SIZE)
    text = 'VICTORY!'
    stroke = 12
    drop = 14
    ascent, descent = f.getmetrics()
    w = int(f.getlength(text)) + stroke * 2 + 40
    h = ascent + descent + stroke * 2 + drop + 8
    im = Image.new('RGBA', (w, h), CLEAR)
    d = ImageDraw.Draw(im)
    x, y = 20 + stroke, stroke
    # The drop: the same word in ink, shifted down. A hard edge, never a blur.
    d.text((x, y + drop), text, font=f, fill=INK, stroke_width=stroke, stroke_fill=INK)
    d.text((x, y), text, font=f, fill=GOLD, stroke_width=stroke, stroke_fill=INK)
    im = im.rotate(4, resample=Image.BICUBIC, expand=True)
    bbox = im.getbbox()
    return im.crop((bbox[0] - 2, bbox[1] - 2, bbox[2] + 2, bbox[3] + 2))


def panel(width: int = 1000, height: int = 380, radius: int = 36, line: int = 4, drop: int = 8):
    """A piece of card: white, an ink outline, a hard offset shadow (src/ui/theme.ts SHAPE)."""
    im = Image.new('RGBA', (width, height + drop), CLEAR)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, drop, width - 1, height + drop - 1), radius=radius, fill=INK)
    d.rounded_rectangle((0, 0, width - 1, height - 1), radius=radius, fill=SURFACE, outline=INK, width=line)
    return im


def title():
    return glyph_picture('Dice Battles: Color Rush', TITLE_SIZE, fill=WHITE, stroke=4, stroke_fill=INK, pad=4)


def write_manifest(sizes: dict, cells: dict, cells_small: dict) -> None:
    def record(d):
        return '{ ' + ', '.join(f'{k}: {v}' for k, v in d.items()) + ' }'

    lines = [
        '/*',
        ' * GENERATED by tools/share-card/make_art.py — do not edit by hand.',
        ' *',
        ' * The size of every picture in assets/share and the cell of every',
        ' * digit in the two sheets. The layout (shareCard.ts) reads these so',
        ' * it stays pure maths a test can run; tests/shareWin.test.ts checks',
        ' * them against the PNG headers so they cannot drift.',
        ' */',
        '',
        'export type ArtId =',
    ]
    ids = list(sizes.keys())
    for i, k in enumerate(ids):
        lines.append(f"  | '{k}'" + (';' if i == len(ids) - 1 else ''))
    lines += [
        '',
        'export interface ArtSize {',
        '  width: number;',
        '  height: number;',
        '}',
        '',
        '/** A glyph in a digit sheet: where it starts and how wide it is, in sheet pixels. */',
        'export interface GlyphCell {',
        '  x: number;',
        '  width: number;',
        '}',
        '',
        'export const SHARE_ART_SIZES: Record<ArtId, ArtSize> = {',
    ]
    for k, v in sizes.items():
        lines.append(f'  {k}: {record(v)},')
    lines += ['};', '', "/** The score-sized digits, 0-9 and '+', in 'digits'. */", 'export const DIGIT_CELLS: Record<string, GlyphCell> = {']
    for c, v in cells.items():
        lines.append(f"  '{c}': {record(v)},")
    lines += ['};', '', "/** The small digits for the trophies line, in 'digitsSmall'. */", 'export const DIGIT_CELLS_SMALL: Record<string, GlyphCell> = {']
    for c, v in cells_small.items():
        lines.append(f"  '{c}': {record(v)},")
    lines += [
        '};',
        '',
        '/** The face every word was set in, and its licence. */',
        "export const SHARE_FONT = 'Inter Black, SIL Open Font License 1.1';",
        '',
    ]
    with open(MANIFEST, 'w') as fh:
        fh.write('\n'.join(lines))


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    pictures = {}
    pictures['victory'] = banner()
    pictures['panel'] = panel()
    pictures['title'] = title()
    for word in ('of', 'freed'):
        pictures[word] = glyph_picture(word, SCORE_SIZE)
    pictures['trophies'] = glyph_picture('trophies', SMALL_SIZE)
    digits, cells = digit_sheet(SCORE_SIZE)
    digits_small, cells_small = digit_sheet(SMALL_SIZE)
    pictures['digits'] = digits
    pictures['digitsSmall'] = digits_small
    for key, name in MODE_NAMES.items():
        pictures[key] = glyph_picture(name, MODE_SIZE)

    sizes = {}
    for key, im in pictures.items():
        # File names are kebab-case; the manifest keys are the TypeScript ids.
        file = {'digitsSmall': 'digits-small'}.get(key, key)
        if key.startswith('mode'):
            file = 'mode-' + key[4:].lower()
        path = os.path.join(OUT, f'{file}.png')
        im.save(path, optimize=True)
        sizes[key] = {'width': im.width, 'height': im.height}
        print(f'{path}: {im.width} x {im.height}, {os.path.getsize(path)} bytes')

    write_manifest(sizes, cells, cells_small)
    print(f'wrote {MANIFEST}')


if __name__ == '__main__':
    main()
