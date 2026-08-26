"""
Inventory pictures for the sixteen THEMED battlefields.

The four originals have bespoke scenes in make-arenas.py. These sixteen
are painted from the same source their arenas are: the script parses
src/arena/themeData.ts and uses each theme's own meadow, hill, mountain
and sky colours, so the thumbnail literally cannot disagree with the
place it opens. Only the landmark glyph in front — the snowman, the
cactus, the lava pool — is drawn here, in that theme's prop colours.

Judge the output at 58pt (the sheet shows both sizes). The landmark is
ONE bold thing per picture on purpose: at that size a second object is
clutter, and the sky+ground palette is already carrying the biome.
"""
import math
import re
from PIL import Image, ImageDraw

S = 348
OUT = 174
ROOT = '/home/user/Dice-battles-'

SRC = open(f'{ROOT}/src/arena/themeData.ts').read()

IDS = ['snow', 'desert', 'volcano', 'beach', 'candy', 'glade', 'autumn', 'cove',
       'farm', 'aurora', 'reef', 'cavern', 'city', 'sky', 'moon', 'toybox']


def hx(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def theme_block(tid):
    at = SRC.index(f'\n  {tid}: {{')
    end = SRC.index('\n  },', at)
    return SRC[at:end]


def field(block, name):
    m = re.search(rf"{name}: '(#[0-9a-f]{{6}})'", block)
    return m.group(1) if m else None


def sky_color(tid):
    at = SRC.index(f'\n  {tid}: {{ name:')
    line = SRC[at:SRC.index('\n', at + 2)]
    return re.search(r"skyColor: '(#[0-9a-f]{6})'", line).group(1)


def lighten(rgb, f):
    return tuple(min(255, int(c + (255 - c) * f)) for c in rgb)


def darken(rgb, f):
    return tuple(int(c * (1 - f)) for c in rgb)


def canvas(top, bottom):
    img = Image.new('RGB', (S, S))
    d = ImageDraw.Draw(img)
    for y in range(S):
        t = y / S
        d.line([(0, y), (S, y)], fill=tuple(int(top[i] * (1 - t) + bottom[i] * t) for i in range(3)))
    return img


def rounded(img):
    m = Image.new('L', (S, S), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.16), fill=255)
    out = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    out.paste(img, (0, 0), m)
    return out


def base_scene(tid):
    """Sky gradient + ground + hills, straight from the theme."""
    block = theme_block(tid)
    sky = hx(sky_color(tid))
    meadow = hx(field(block, 'meadow'))
    hill = hx(field(block, 'hill'))
    mountain = field(block, 'mountain')

    img = canvas(lighten(sky, 0.18), sky)
    d = ImageDraw.Draw(img)
    if mountain:
        mrgb = hx(mountain)
        d.polygon([(30, 210), (110, 110), (190, 210)], fill=mrgb)
        d.polygon([(150, 210), (250, 90), (348, 210)], fill=darken(mrgb, 0.12))
    d.rectangle([0, 200, S, S], fill=meadow)
    d.ellipse([-70, 180, 170, 260], fill=hill)
    d.ellipse([180, 186, 420, 262], fill=hill)
    return img, d, {'meadow': meadow, 'hill': hill, 'sky': sky}


# ── landmark glyphs, one per theme ────────────────────────────────────

def g_snow(d, c):
    # A snowman beside two snowy pines.
    for x, s in ((70, 1.0), (300, 0.8)):
        d.polygon([(x, 210 - 90 * s), (x - 44 * s, 240), (x + 44 * s, 240)], fill=(47, 90, 66))
        d.polygon([(x, 210 - 96 * s), (x - 26 * s, 170), (x + 26 * s, 170)], fill=(238, 245, 250))
    for r, y in ((46, 288), (32, 226), (24, 182)):
        d.ellipse([180 - r, y - r, 180 + r, y + r], fill=(250, 252, 254))
        d.ellipse([180 - r, y - r, 180 + r, y + r], outline=(184, 202, 216), width=3)
    d.polygon([(180, 176), (216, 184), (180, 192)], fill=(252, 132, 3))

def g_desert(d, c):
    x = 180
    d.rounded_rectangle([x - 16, 130, x + 16, 300], radius=16, fill=(74, 143, 79))
    d.rounded_rectangle([x - 70, 170, x - 40, 240], radius=14, fill=(74, 143, 79))
    d.rounded_rectangle([x - 70, 165, x - 40, 200], radius=14, fill=(74, 143, 79))
    d.rounded_rectangle([x + 40, 190, x + 70, 260], radius=14, fill=(66, 128, 70))
    d.ellipse([270, 40, 330, 100], fill=(255, 241, 184))

def g_volcano(d, c):
    # The cone silhouettes against a lit sky band, and the lava RUNS —
    # two streams down the slopes, not droplets floating on the face.
    d.rectangle([0, 150, S, 200], fill=(102, 48, 58))
    d.polygon([(50, 320), (180, 84), (310, 320)], fill=(34, 27, 34))
    d.ellipse([146, 70, 214, 102], fill=(255, 140, 46))
    d.polygon([(164, 86), (150, 320), (186, 320), (180, 86)], fill=(255, 140, 46))
    d.polygon([(198, 90), (238, 250), (214, 250), (188, 90)], fill=(255, 92, 30))
    d.ellipse([140, 26, 190, 60], fill=(92, 64, 72))
    d.ellipse([180, 10, 246, 52], fill=(74, 52, 60))

def g_beach(d, c):
    d.rectangle([0, 200, S, 250], fill=(63, 201, 194))
    d.polygon([(250, 300), (262, 140), (280, 300)], fill=(138, 99, 56))
    for i in range(5):
        a = math.radians(-25 + i * 45)
        d.polygon([(266, 142), (266 + math.cos(a) * 84, 130 + math.sin(a) * 52),
                   (272 + math.cos(a) * 74, 146 + math.sin(a) * 56)], fill=(58, 138, 74))
    d.rounded_rectangle([84, 250, 168, 300], radius=12, fill=(138, 99, 56))
    d.rectangle([84, 262, 168, 270], fill=(230, 200, 120))
    d.ellipse([110, 232, 142, 258], fill=(255, 210, 31))

def g_candy(d, c):
    # A real spiral on each lollipop. The first pass drew one open arc,
    # and three of them in a row spelled "CCC" across the picture.
    for x, col in ((90, (255, 110, 110)), (180, (138, 224, 192)), (270, (255, 210, 31))):
        d.rectangle([x - 5, 180, x + 5, 310], fill=(247, 240, 224))
        d.ellipse([x - 44, 96, x + 44, 184], fill=col)
        cy = 140
        pts = []
        for t in range(0, 260, 6):
            a = math.radians(t * 2.1)
            r = 4 + t * 0.115
            pts.append((x + math.cos(a) * r, cy + math.sin(a) * r * 0.95))
        d.line(pts, fill=(255, 255, 255), width=8, joint='curve')

def g_glade(d, c):
    # DOME caps sitting straight on fat stems, with pale spots — the
    # round-canopy version read as three teal trees, not mushrooms.
    for x, s, col in ((96, 1.25, (79, 208, 201)), (252, 1.0, (87, 232, 169)), (178, 0.72, (138, 212, 232))):
        top = 250 - 95 * s
        d.rounded_rectangle([x - 15 * s, top + 52 * s, x + 15 * s, 302], radius=12, fill=(224, 216, 200))
        d.pieslice([x - 62 * s, top, x + 62 * s, top + 110 * s], 180, 360, fill=col)
        for k, (ox, oy, r) in enumerate(((-30, 34, 9), (6, 16, 11), (34, 38, 8))):
            d.ellipse([x + ox * s - r, top + oy * s - r, x + ox * s + r, top + oy * s + r],
                      fill=(240, 250, 250))
    for fx, fy in ((60, 120), (300, 90), (200, 50), (132, 152), (330, 170)):
        d.ellipse([fx - 5, fy - 5, fx + 5, fy + 5], fill=(255, 255, 210))

def g_autumn(d, c):
    for x, col, s in ((90, (208, 100, 46), 1.1), (230, (201, 144, 58), 1.3), (330, (179, 73, 46), 0.8)):
        d.rectangle([x - 9 * s, 200, x + 9 * s, 280], fill=(110, 74, 40))
        d.ellipse([x - 60 * s, 90, x + 60 * s, 220], fill=col)
    for lx, ly in ((60, 300), (150, 316), (260, 296), (320, 320)):
        d.ellipse([lx, ly, lx + 22, ly + 14], fill=(208, 100, 46))

def g_cove(d, c):
    d.rectangle([0, 210, S, 268], fill=(42, 122, 158))
    d.polygon([(90, 250), (270, 250), (240, 296), (120, 296)], fill=(107, 74, 44))
    d.rectangle([176, 110, 186, 252], fill=(74, 56, 35))
    d.polygon([(186, 118), (186, 210), (262, 196)], fill=(233, 228, 216))
    d.polygon([(176, 130), (176, 190), (118, 182)], fill=(216, 208, 190))
    d.polygon([(178, 96), (178, 116), (214, 106)], fill=(29, 26, 46))

def g_farm(d, c):
    d.rectangle([90, 190, 250, 290], fill=(194, 59, 59))
    d.polygon([(78, 190), (170, 128), (262, 190)], fill=(138, 142, 153))
    d.rounded_rectangle([148, 230, 194, 290], radius=8, fill=(240, 230, 196))
    d.line([148, 260, 194, 260], fill=(194, 59, 59), width=5)
    d.line([171, 230, 171, 290], fill=(194, 59, 59), width=5)
    for x in (290, 322):
        d.ellipse([x - 20, 262, x + 20, 298], fill=(223, 192, 96))

def g_aurora(d, c):
    # CURTAINS of light: broad tapering bands leaning one way, layered in
    # two greens. The dotted-worm version read as the reef's seaweed.
    for x0, w, col in ((30, 56, (46, 168, 116)), (120, 72, (79, 232, 154)),
                       (230, 60, (46, 168, 116)), (310, 48, (79, 232, 154))):
        d.polygon([(x0, 200), (x0 + 26, 10), (x0 + 26 + w, 10), (x0 + w * 0.55, 200)], fill=col)
    for x0, w in ((132, 40), (242, 32)):
        d.polygon([(x0, 190), (x0 + 22, 14), (x0 + 22 + w, 14), (x0 + w * 0.5, 190)],
                  fill=(190, 255, 220))
    d.rectangle([0, 200, S, S], fill=c['meadow'])
    d.ellipse([-70, 180, 170, 260], fill=c['hill'])
    d.ellipse([180, 186, 420, 262], fill=c['hill'])
    for x, s in ((80, 1.0), (280, 1.2)):
        d.polygon([(x, 210 - 80 * s), (x - 36 * s, 250), (x + 36 * s, 250)], fill=(16, 49, 41))

def g_reef(d, c):
    for x, col in ((80, (255, 138, 92)), (170, (255, 110, 158)), (270, (255, 201, 92))):
        for k in (-1, 0, 1):
            d.line([x, 300, x + k * 26, 210 + abs(k) * 26], fill=col, width=13)
            d.ellipse([x + k * 26 - 9, 202 + abs(k) * 26, x + k * 26 + 9, 220 + abs(k) * 26], fill=col)
    d.ellipse([236, 110, 288, 146], fill=(255, 210, 31))
    d.polygon([(236, 128), (214, 112), (214, 144)], fill=(255, 210, 31))
    d.ellipse([264, 120, 272, 128], fill=(10, 30, 40))
    for bx, by in ((120, 100), (150, 70), (130, 40)):
        d.ellipse([bx, by, bx + 14, by + 14], outline=(191, 226, 242), width=3)

def g_cavern(d, c):
    # Two GOLD spires among the amethyst, and a warm vein in the rock —
    # measured against the Space Station's near-black navy, the all-purple
    # version sat only 0.26 apart on the colour histogram.
    d.ellipse([40, 250, 320, 330], fill=(58, 44, 78))
    for x, h, col in ((60, 100, (232, 199, 110)), (120, 140, (176, 110, 232)), (180, 180, (138, 90, 224)),
                      (250, 110, (208, 147, 255)), (315, 140, (232, 199, 110))):
        d.polygon([(x - 26, 320), (x, 320 - h), (x + 26, 320)], fill=col)
        d.polygon([(x, 320 - h), (x + 26, 320), (x, 320)], fill=darken(col, 0.25))

def g_city(d, c):
    for x, w, h in ((40, 56, 150), (110, 66, 210), (190, 56, 170), (256, 70, 230)):
        d.rectangle([x, 320 - h, x + w, 320], fill=(29, 31, 43))
        for wy in range(320 - h + 16, 312, 26):
            for wx in range(x + 10, x + w - 12, 20):
                lit = (wx * 7 + wy * 13) % 3 != 0
                d.rectangle([wx, wy, wx + 9, wy + 12], fill=(255, 201, 92) if lit else (92, 100, 120))
    d.ellipse([282, 30, 330, 78], fill=(242, 236, 216))

def g_sky(d, c):
    bands = [(255, 110, 110), (252, 132, 3), (255, 229, 33), (51, 204, 107), (63, 127, 208), (176, 110, 232)]
    for i, col in enumerate(bands):
        d.arc([30 + i * 9, 120 + i * 9, 318 - i * 9, 408 - i * 9], 180, 360, fill=col, width=10)
    for x, y, s in ((80, 250, 1.2), (250, 230, 1.0)):
        for dx, r in ((-30, 26), (0, 36), (30, 24)):
            d.ellipse([x + dx * s - r * s, y - r * s, x + dx * s + r * s, y + r * s], fill=(255, 255, 255))

def g_moon(d, c):
    for x, y, r in ((90, 250, 26), (220, 290, 20), (290, 240, 15), (160, 310, 13)):
        d.ellipse([x - r, y - r, x + r, y + r], fill=darken(c['meadow'], 0.18))
        d.ellipse([x - r, y - r, x + r, y + r], outline=lighten(c['meadow'], 0.2), width=3)
    d.ellipse([60, 40, 150, 130], fill=(63, 127, 208))
    d.ellipse([80, 60, 116, 88], fill=(51, 160, 96))
    d.ellipse([96, 90, 126, 112], fill=(255, 255, 255))
    for sx, sy in ((230, 60), (280, 100), (320, 50), (200, 120)):
        d.ellipse([sx, sy, sx + 5, sy + 5], fill=(255, 255, 255))

def g_toybox(d, c):
    blocks = [((90, 250), (194, 59, 59)), ((170, 250), (63, 127, 208)),
              ((130, 180), (63, 163, 92)), ((260, 250), (255, 210, 31))]
    for (x, y), col in blocks:
        d.rectangle([x - 36, y - 36, x + 36, y + 36], fill=col)
        d.rectangle([x - 36, y - 36, x + 36, y + 36], outline=darken(col, 0.3), width=4)
        d.ellipse([x - 12, y - 12, x + 12, y + 12], fill=lighten(col, 0.3))
    d.rectangle([40, 90, 62, 200], fill=(255, 210, 31))
    d.polygon([(40, 90), (62, 90), (51, 62)], fill=(230, 200, 120))
    d.polygon([(46, 74), (56, 74), (51, 62)], fill=(29, 26, 46))


GLYPHS = {
    'snow': g_snow, 'desert': g_desert, 'volcano': g_volcano, 'beach': g_beach,
    'candy': g_candy, 'glade': g_glade, 'autumn': g_autumn, 'cove': g_cove,
    'farm': g_farm, 'aurora': g_aurora, 'reef': g_reef, 'cavern': g_cavern,
    'city': g_city, 'sky': g_sky, 'moon': g_moon, 'toybox': g_toybox,
}

for tid in IDS:
    img, d, c = base_scene(tid)
    GLYPHS[tid](d, c)
    rounded(img).resize((OUT, OUT), Image.LANCZOS).save(f'{ROOT}/assets/arenas/{tid}.png')

# Contact sheet: all sixteen, big and at 58pt.
pad = 12
cols = 8
rows = 2
sheet = Image.new('RGB', (cols * (S // 2 + pad) + pad, rows * (S // 2 + 70) + pad), (253, 246, 236))
sd = ImageDraw.Draw(sheet)
for i, tid in enumerate(IDS):
    r, cidx = divmod(i, cols)
    x = pad + cidx * (S // 2 + pad)
    y = pad + r * (S // 2 + 70)
    art = Image.open(f'{ROOT}/assets/arenas/{tid}.png')
    half = art.resize((S // 2, S // 2), Image.LANCZOS)
    sheet.paste(half, (x, y), half)
    small = art.resize((58, 58), Image.LANCZOS)
    sheet.paste(small, (x + S // 4 - 29, y + S // 2 + 4), small)
    sd.text((x + 2, y + S // 2 + 48), tid, fill=(29, 26, 46))
sheet.save('/tmp/themed-arenas-sheet.png')
print('wrote 16 thumbnails + sheet')
