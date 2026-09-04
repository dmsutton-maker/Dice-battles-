"""
Inventory pictures for the sixteen THEMED battlefields.

The four originals have bespoke scenes in make-arenas.py. These sixteen
are painted from the same source their arenas are: the script parses
src/arena/themeData.ts and uses each theme's own meadow, hill, mountain
and sky colours, so the thumbnail literally cannot disagree with the
place it opens. Only the landmark glyph in front — the snowman, the
cactus, the lava pool — is drawn here, in that theme's prop colours.

Judge the output at 58pt (the sheet shows both sizes). Each picture is
ONE bold landmark plus small decoration around it. The landmark has to
survive being 58 pixels wide, so it stays big and central; the extras —
birds, sparks, shells, a chest, a lander — are what David asked for on
26 Aug 2026 to "make them look better", and they are sized to read as
texture at thumbnail size and as detail when the arena tile is large.

Brightness matters as much as detail. David, same day: "a lot of these
new maps are way too dark and you can't really tell what it is." The
worst five (city, volcano, cavern, aurora, glade) were repainted in
themeData.ts and their glyphs lightened here; the check is mean HSV
value and the share of pixels below a third brightness.
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


# ── small shared decorations ──────────────────────────────────────────
#
# David, 26 Aug 2026: "add some extra decorations on them to make them
# look better." These are the extras. They are deliberately SMALL and
# high-contrast: the landmark still has to be the thing you see at 58pt,
# so the decoration is a bird, a spark, a shell — read as texture at
# thumbnail size and as detail at full size.

def sparkles(d, spots, col=(255, 255, 255)):
    for x, y, r in spots:
        d.ellipse([x - r, y - r, x + r, y + r], fill=col)


def birds(d, spots, col=(60, 60, 70)):
    """Little flying Vs. Two strokes each — anything more is a smudge."""
    for x, y, s in spots:
        w = int(4 * s)
        d.line([(x - 13 * s, y + 5 * s), (x, y - 4 * s)], fill=col, width=w, joint='curve')
        d.line([(x, y - 4 * s), (x + 13 * s, y + 5 * s)], fill=col, width=w, joint='curve')


def tufts(d, spots, col):
    """Clumps of grass/weed along the ground line."""
    for x, y, h in spots:
        for k in (-1, 0, 1):
            d.line([(x + k * h * 0.32, y), (x + k * h * 0.55, y - h)], fill=col, width=4)


def star(d, cx, cy, r, col, points=5):
    pts = []
    for k in range(points * 2):
        rad = r if k % 2 == 0 else r * 0.44
        a = math.radians(-90 + k * 180 / points)
        pts.append((cx + math.cos(a) * rad, cy + math.sin(a) * rad))
    d.polygon(pts, fill=col)


def stones(d, spots, col):
    for x, y, r in spots:
        d.ellipse([x - r, y - r * 0.72, x + r, y + r * 0.72], fill=col)


# ── landmark glyphs, one per theme ────────────────────────────────────

def g_snow(d, c):
    # A snowman beside snowy pines, with a scarf and falling snow.
    for x, s in ((70, 1.0), (300, 0.8), (240, 0.5)):
        apex = 210 - 96 * s
        d.polygon([(x, apex + 6 * s), (x - 44 * s, 240), (x + 44 * s, 240)], fill=(47, 90, 66))
        d.polygon([(x, apex), (x - 26 * s, apex + 44 * s), (x + 26 * s, apex + 44 * s)],
                  fill=(238, 245, 250))
    for r, y in ((46, 288), (32, 226), (24, 182)):
        d.ellipse([180 - r, y - r, 180 + r, y + r], fill=(250, 252, 254))
        d.ellipse([180 - r, y - r, 180 + r, y + r], outline=(184, 202, 216), width=3)
    d.rectangle([150, 197, 210, 210], fill=(216, 64, 64))
    d.polygon([(196, 206), (212, 250), (192, 250), (186, 206)], fill=(216, 64, 64))
    d.ellipse([166, 172, 176, 182], fill=(41, 38, 56))
    d.ellipse([186, 172, 196, 182], fill=(41, 38, 56))
    d.polygon([(180, 186), (216, 192), (180, 200)], fill=(252, 132, 3))
    stones(d, ((60, 306, 16), (306, 300, 13)), (199, 214, 226))
    sparkles(d, ((44, 62, 6), (104, 110, 5), (158, 44, 6), (232, 86, 5),
                 (306, 40, 6), (322, 142, 5), (74, 158, 5), (262, 152, 6)))

def g_desert(d, c):
    x = 180
    d.rounded_rectangle([x - 16, 130, x + 16, 300], radius=16, fill=(74, 143, 79))
    d.rounded_rectangle([x - 70, 170, x - 40, 240], radius=14, fill=(74, 143, 79))
    d.rounded_rectangle([x - 70, 165, x - 40, 200], radius=14, fill=(74, 143, 79))
    d.rounded_rectangle([x + 40, 190, x + 70, 260], radius=14, fill=(66, 128, 70))
    # A flower on the crown, the way a saguaro actually blooms.
    d.ellipse([x - 13, 118, x + 13, 144], fill=(232, 92, 122))
    d.ellipse([x - 5, 126, x + 5, 136], fill=(255, 241, 184))
    d.ellipse([270, 40, 330, 100], fill=(255, 241, 184))
    # Tumbleweed, scattered stones, a pair of birds.
    d.ellipse([52, 262, 108, 318], outline=(150, 108, 56), width=6)
    d.arc([44, 272, 116, 308], 300, 120, fill=(168, 126, 68), width=5)
    d.arc([62, 254, 98, 326], 200, 20, fill=(168, 126, 68), width=5)
    d.arc([50, 260, 110, 320], 40, 220, fill=(168, 126, 68), width=5)
    stones(d, ((252, 302, 15), (282, 314, 10), (312, 298, 12)), darken(c['meadow'], 0.24))
    birds(d, ((92, 84, 1.0), (136, 58, 0.8)), (150, 108, 56))

def g_volcano(d, c):
    # A rim of cones with lava running down one, lit from below. Repainted
    # 26 Aug 2026: it was 53% below a third brightness AND the single wide
    # stream down the middle of a narrow cone read as a lit tower.
    d.rectangle([0, 148, S, 202], fill=(140, 66, 74))
    d.polygon([(196, 306), (288, 126), (348, 306)], fill=(92, 62, 66))
    d.polygon([(-10, 306), (58, 152), (150, 306)], fill=(92, 62, 66))
    d.polygon([(26, 324), (174, 88), (322, 324)], fill=(74, 54, 58))
    d.polygon([(174, 88), (322, 324), (248, 324)], fill=(99, 70, 70))
    d.ellipse([142, 74, 206, 106], fill=(255, 140, 46))
    d.polygon([(158, 96), (132, 236), (158, 240), (172, 96)], fill=(255, 140, 46))
    d.polygon([(186, 98), (212, 196), (196, 200), (178, 98)], fill=(255, 92, 30))
    d.polygon([(196, 132), (238, 214), (222, 218), (188, 138)], fill=(255, 92, 30))
    d.ellipse([138, 22, 192, 60], fill=(150, 84, 88))
    d.ellipse([178, 6, 248, 52], fill=(122, 72, 78))
    sparkles(d, ((150, 42, 6), (216, 28, 5), (196, 56, 7), (124, 64, 5), (240, 64, 6)),
             (255, 196, 80))
    d.ellipse([18, 290, 152, 334], fill=(60, 42, 46))
    d.ellipse([30, 298, 140, 328], fill=(255, 122, 47))
    d.ellipse([54, 304, 116, 320], fill=(255, 196, 80))
    stones(d, ((266, 308, 24), (312, 320, 17)), (99, 70, 70))

def g_beach(d, c):
    d.rectangle([0, 200, S, 250], fill=(63, 201, 194))
    for wy in (214, 234):
        for wx in range(0, S, 70):
            d.arc([wx, wy - 8, wx + 46, wy + 8], 200, 340, fill=(190, 240, 236), width=5)
    d.polygon([(250, 300), (262, 140), (280, 300)], fill=(138, 99, 56))
    for i in range(5):
        a = math.radians(-25 + i * 45)
        d.polygon([(266, 142), (266 + math.cos(a) * 84, 130 + math.sin(a) * 52),
                   (272 + math.cos(a) * 74, 146 + math.sin(a) * 56)], fill=(58, 138, 74))
    d.ellipse([248, 176, 268, 192], fill=(150, 96, 44))
    d.rounded_rectangle([84, 250, 168, 300], radius=12, fill=(138, 99, 56))
    d.rectangle([84, 262, 168, 270], fill=(230, 200, 120))
    d.ellipse([110, 232, 142, 258], fill=(255, 210, 31))
    # A starfish, a shell and gulls.
    star(d, 52, 296, 30, (255, 122, 122))
    d.pieslice([186, 288, 232, 326], 180, 360, fill=(255, 236, 214))
    for k in range(4):
        d.line([(209, 326), (186 + k * 15, 292)], fill=(226, 190, 168), width=3)
    birds(d, ((80, 74, 1.1), (128, 48, 0.85), (312, 122, 0.8)), (90, 96, 112))

def g_candy(d, c):
    # A real spiral on each lollipop, plus a candy cane and sprinkles.
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
    d.line([(38, 320), (38, 210)], fill=(255, 255, 255), width=18)
    d.arc([26, 176, 86, 236], 150, 350, fill=(255, 255, 255), width=18)
    for k, y in enumerate(range(212, 320, 26)):
        d.line([(30, y + 8), (46, y)], fill=(226, 74, 96), width=7)
    for sx, sy, ang, col in ((120, 296, 20, (255, 110, 110)), (150, 316, -30, (138, 224, 192)),
                             (206, 300, 40, (176, 110, 232)), (238, 322, -15, (255, 210, 31)),
                             (300, 306, 55, (255, 110, 110)), (330, 288, -40, (138, 224, 192))):
        a = math.radians(ang)
        d.line([(sx - math.cos(a) * 12, sy - math.sin(a) * 12),
                (sx + math.cos(a) * 12, sy + math.sin(a) * 12)], fill=col, width=7)

def g_glade(d, c):
    # DOME caps on fat stems, a glowing pool at their feet, fireflies.
    d.ellipse([96, 288, 264, 330], fill=(52, 168, 148))
    d.ellipse([116, 294, 244, 322], fill=(126, 232, 214))
    for x, s, col in ((96, 1.25, (79, 208, 201)), (252, 1.0, (87, 232, 169)), (178, 0.72, (138, 212, 232))):
        top = 250 - 95 * s
        d.rounded_rectangle([x - 15 * s, top + 52 * s, x + 15 * s, 302], radius=12, fill=(224, 216, 200))
        d.pieslice([x - 62 * s, top, x + 62 * s, top + 110 * s], 180, 360, fill=col)
        for ox, oy, r in ((-30, 34, 9), (6, 16, 11), (34, 38, 8)):
            d.ellipse([x + ox * s - r, top + oy * s - r, x + ox * s + r, top + oy * s + r],
                      fill=(240, 250, 250))
    tufts(d, ((44, 316, 26), (318, 312, 22), (150, 326, 18)), (46, 122, 84))
    sparkles(d, ((60, 120, 6), (300, 90, 6), (200, 50, 5), (132, 152, 6), (330, 170, 5),
                 (86, 62, 5), (248, 128, 6), (24, 196, 5)), (255, 255, 210))

def g_autumn(d, c):
    for x, col, s in ((90, (208, 100, 46), 1.1), (230, (201, 144, 58), 1.3), (330, (179, 73, 46), 0.8)):
        d.rectangle([x - 9 * s, 200, x + 9 * s, 280], fill=(110, 74, 40))
        d.ellipse([x - 60 * s, 90, x + 60 * s, 220], fill=col)
        sparkles(d, ((x - 22 * s, 130, 8), (x + 26 * s, 168, 7)), lighten(col, 0.35))
    # Leaves on the ground and a few still falling.
    for lx, ly, col in ((60, 300, (208, 100, 46)), (150, 316, (201, 144, 58)),
                        (260, 296, (179, 73, 46)), (320, 320, (208, 100, 46)),
                        (108, 328, (201, 144, 58)), (206, 308, (208, 100, 46))):
        d.ellipse([lx, ly, lx + 24, ly + 15], fill=col)
    for lx, ly, col in ((44, 232, (208, 100, 46)), (176, 250, (201, 144, 58)),
                        (300, 240, (179, 73, 46))):
        d.ellipse([lx, ly, lx + 20, ly + 13], fill=col)
    birds(d, ((70, 60, 0.9), (300, 46, 0.7)), (110, 74, 40))

def g_cove(d, c):
    d.rectangle([0, 210, S, 268], fill=(42, 122, 158))
    for wx in range(0, S, 64):
        d.arc([wx, 222, wx + 44, 238], 200, 340, fill=(140, 196, 214), width=4)
    d.polygon([(90, 250), (270, 250), (240, 296), (120, 296)], fill=(107, 74, 44))
    d.rectangle([176, 110, 186, 252], fill=(74, 56, 35))
    d.polygon([(186, 118), (186, 210), (262, 196)], fill=(233, 228, 216))
    d.polygon([(176, 130), (176, 190), (118, 182)], fill=(216, 208, 190))
    d.polygon([(178, 96), (178, 116), (214, 106)], fill=(29, 26, 46))
    # A treasure chest spilling gold, and a barrel.
    d.rounded_rectangle([32, 282, 116, 330], radius=6, fill=(122, 82, 46))
    d.pieslice([32, 258, 116, 306], 180, 360, fill=(150, 104, 58))
    d.rectangle([32, 296, 116, 304], fill=(232, 190, 84))
    d.rectangle([66, 292, 82, 314], fill=(232, 190, 84))
    for gx, gy in ((122, 320), (138, 310), (154, 322), (108, 316)):
        d.ellipse([gx, gy, gx + 14, gy + 12], fill=(255, 210, 31))
    d.rounded_rectangle([282, 278, 336, 330], radius=10, fill=(126, 88, 50))
    for by in (292, 310):
        d.rectangle([282, by, 336, by + 7], fill=(84, 60, 36))
    birds(d, ((66, 66, 1.0), (270, 44, 0.8)), (60, 74, 88))

def g_farm(d, c):
    d.rectangle([90, 190, 250, 290], fill=(194, 59, 59))
    d.polygon([(78, 190), (170, 128), (262, 190)], fill=(138, 142, 153))
    d.rounded_rectangle([148, 230, 194, 290], radius=8, fill=(240, 230, 196))
    d.line([148, 260, 194, 260], fill=(194, 59, 59), width=5)
    d.line([171, 230, 171, 290], fill=(194, 59, 59), width=5)
    d.ellipse([154, 156, 186, 188], fill=(240, 230, 196))
    for x in (290, 322):
        d.ellipse([x - 20, 262, x + 20, 298], fill=(223, 192, 96))
    # A rail fence along the front and flowers in the grass.
    d.rectangle([0, 300, S, 308], fill=(214, 196, 158))
    d.rectangle([0, 318, S, 326], fill=(214, 196, 158))
    for fx in range(16, S, 58):
        d.rectangle([fx, 292, fx + 10, 336], fill=(184, 162, 122))
    for fx, col in ((44, (255, 210, 31)), (128, (255, 110, 110)), (216, (255, 255, 255)),
                    (300, (255, 210, 31))):
        d.line([(fx, 314), (fx, 300)], fill=(92, 158, 61), width=4)
        d.ellipse([fx - 8, 290, fx + 8, 304], fill=col)
    birds(d, ((60, 70, 1.0), (300, 52, 0.8)), (110, 118, 130))

def g_aurora(d, c):
    # CURTAINS of light over SNOW. Ground and sky swapped roles on 26 Aug
    # 2026: the dark now lives in the sky where it belongs, and the
    # curtains have something pale to be seen against.
    for sx, sy, r in ((40, 40, 5), (108, 22, 4), (196, 34, 5), (268, 18, 4), (324, 52, 5)):
        d.ellipse([sx - r, sy - r, sx + r, sy + r], fill=(220, 236, 246))
    for x0, w, col in ((30, 56, (46, 168, 116)), (120, 72, (79, 232, 154)),
                       (230, 60, (46, 168, 116)), (310, 48, (79, 232, 154))):
        d.polygon([(x0 + w * 0.3, 206), (x0 + 26, 10), (x0 + 26 + w, 10),
                   (x0 + w * 0.74, 206)], fill=col)
    for x0, w in ((132, 40), (242, 32)):
        d.polygon([(x0 + w * 0.3, 196), (x0 + 22, 14), (x0 + 22 + w, 14),
                   (x0 + w * 0.72, 196)], fill=(190, 255, 220))
    d.rectangle([0, 200, S, S], fill=c['meadow'])
    d.ellipse([-70, 180, 170, 260], fill=c['hill'])
    d.ellipse([180, 186, 420, 262], fill=c['hill'])
    for x, s in ((80, 1.0), (280, 1.2)):
        d.polygon([(x, 210 - 80 * s), (x - 36 * s, 250), (x + 36 * s, 250)], fill=(16, 66, 56))
        d.polygon([(x, 214 - 80 * s), (x - 20 * s, 224), (x + 20 * s, 224)], fill=(226, 240, 246))
    # Ice floes and a glow on the snow under the curtains.
    d.ellipse([120, 286, 246, 326], fill=(146, 216, 214))
    d.ellipse([140, 292, 226, 318], fill=(196, 240, 236))
    stones(d, ((44, 306, 22), (312, 300, 18)), (168, 200, 212))

def g_reef(d, c):
    for x, col in ((80, (255, 138, 92)), (170, (255, 110, 158)), (270, (255, 201, 92))):
        for k in (-1, 0, 1):
            d.line([x, 300, x + k * 26, 210 + abs(k) * 26], fill=col, width=13)
            d.ellipse([x + k * 26 - 9, 202 + abs(k) * 26, x + k * 26 + 9, 220 + abs(k) * 26], fill=col)
    d.ellipse([236, 110, 288, 146], fill=(255, 210, 31))
    d.polygon([(236, 128), (214, 112), (214, 144)], fill=(255, 210, 31))
    d.ellipse([264, 120, 272, 128], fill=(10, 30, 40))
    # A second, smaller fish the other way, a starfish, more bubbles.
    d.ellipse([60, 88, 100, 116], fill=(126, 232, 214))
    d.polygon([(100, 102), (120, 88), (120, 116)], fill=(126, 232, 214))
    d.ellipse([70, 96, 78, 104], fill=(10, 30, 40))
    star(d, 312, 300, 28, (255, 138, 92))
    for bx, by, r in ((120, 100, 7), (150, 70, 9), (130, 40, 6), (296, 74, 8), (312, 44, 6)):
        d.ellipse([bx - r, by - r, bx + r, by + r], outline=(191, 226, 242), width=3)
    tufts(d, ((36, 318, 30), (206, 326, 22)), (46, 154, 128))

def g_cavern(d, c):
    # Gold spires among the amethyst, on rock light enough to read. The
    # near-black version was 55% below a third brightness and looked
    # like a smudge at 58pt.
    d.ellipse([20, 244, 336, 334], fill=(94, 80, 117))
    d.ellipse([44, 252, 312, 316], fill=(110, 95, 136))
    for x, h, col in ((60, 100, (240, 214, 138)), (120, 140, (201, 138, 255)), (180, 180, (163, 122, 232)),
                      (250, 110, (220, 174, 255)), (315, 140, (240, 214, 138))):
        d.polygon([(x - 26, 320), (x, 320 - h), (x + 26, 320)], fill=col)
        d.polygon([(x, 320 - h), (x + 26, 320), (x, 320)], fill=darken(col, 0.25))
        sparkles(d, ((x - 6, 328 - h, 6),), (255, 255, 255))
    # Stalactites hanging from the roof, and a glowing pool.
    for x, h, w in ((36, 70, 22), (96, 44, 16), (208, 58, 18), (300, 82, 24)):
        d.polygon([(x - w, 0), (x + w, 0), (x, h)], fill=(88, 74, 110))
    d.ellipse([126, 302, 248, 334], fill=(127, 212, 232))
    d.ellipse([146, 308, 228, 326], fill=(198, 238, 248))
    sparkles(d, ((70, 122, 5), (270, 96, 6), (166, 60, 5)), (240, 214, 138))

def g_city(d, c):
    # DUSK, not midnight. This was the darkest picture in the set — 88%
    # of its pixels below a third brightness — which is exactly why
    # David could not tell what it was. The concrete is now lit from the
    # streets and the windows are brighter than the walls by a mile.
    for x, w, h, col in ((14, 52, 128, (68, 74, 102)), (40, 56, 168, (56, 62, 88)),
                         (110, 66, 224, (74, 80, 108)), (190, 56, 182, (60, 66, 94)),
                         (256, 70, 244, (80, 86, 116)), (312, 40, 150, (62, 68, 96))):
        d.rectangle([x, 320 - h, x + w, 320], fill=col)
        d.rectangle([x, 320 - h, x + w, 320 - h + 7], fill=lighten(col, 0.22))
        for wy in range(320 - h + 18, 312, 26):
            for wx in range(x + 10, x + w - 12, 20):
                lit = (wx * 7 + wy * 13) % 3 != 0
                d.rectangle([wx, wy, wx + 9, wy + 13],
                            fill=(255, 214, 122) if lit else (120, 128, 150))
    # A water tank and an aerial on the tallest roof, and a red beacon.
    d.rectangle([272, 56, 314, 76], fill=(96, 84, 74))
    for lx in (278, 306):
        d.line([(lx, 76), (lx, 90)], fill=(96, 84, 74), width=5)
    d.line([(140, 96), (140, 46)], fill=(150, 158, 180), width=5)
    d.line([(128, 60), (152, 60)], fill=(150, 158, 180), width=4)
    d.ellipse([132, 34, 148, 50], fill=(255, 110, 110))
    d.ellipse([282, 22, 330, 70], fill=(248, 242, 222))
    sparkles(d, ((40, 40, 5), (96, 26, 4), (186, 34, 5), (232, 18, 4)), (222, 228, 244))

def g_sky(d, c):
    bands = [(255, 110, 110), (252, 132, 3), (255, 229, 33), (51, 204, 107), (63, 127, 208), (176, 110, 232)]
    for i, col in enumerate(bands):
        d.arc([30 + i * 9, 120 + i * 9, 318 - i * 9, 408 - i * 9], 180, 360, fill=col, width=10)
    for x, y, s in ((80, 250, 1.2), (250, 230, 1.0)):
        for dx, r in ((-30, 26), (0, 36), (30, 24)):
            d.ellipse([x + dx * s - r * s, y - r * s, x + dx * s + r * s, y + r * s], fill=(255, 255, 255))
    # A little turret on the far cloud, and birds crossing the arch.
    d.rectangle([236, 176, 268, 218], fill=(226, 238, 248))
    for mx in (236, 250, 264):
        d.rectangle([mx, 168, mx + 9, 180], fill=(226, 238, 248))
    d.polygon([(228, 172), (252, 138), (276, 172)], fill=(255, 210, 31))
    d.ellipse([246, 190, 258, 202], fill=(140, 172, 196))
    birds(d, ((116, 132, 1.1), (160, 100, 0.85), (306, 148, 0.9)), (92, 122, 150))
    sparkles(d, ((44, 88, 6), (330, 100, 5)), (255, 255, 255))

def g_moon(d, c):
    for x, y, r in ((90, 250, 26), (220, 290, 20), (290, 240, 15), (160, 310, 13), (44, 296, 18)):
        d.ellipse([x - r, y - r, x + r, y + r], fill=darken(c['meadow'], 0.18))
        d.ellipse([x - r, y - r, x + r, y + r], outline=lighten(c['meadow'], 0.2), width=3)
    d.ellipse([60, 40, 150, 130], fill=(63, 127, 208))
    d.ellipse([80, 60, 116, 88], fill=(51, 160, 96))
    d.ellipse([96, 90, 126, 112], fill=(255, 255, 255))
    # A flag, and a lander standing on three legs.
    d.line([(196, 300), (196, 196)], fill=(226, 230, 238), width=6)
    d.polygon([(199, 198), (256, 212), (199, 238)], fill=(216, 64, 64))
    d.rectangle([264, 246, 330, 286], fill=(198, 202, 212))
    d.polygon([(264, 246), (297, 220), (330, 246)], fill=(226, 230, 238))
    d.ellipse([286, 256, 308, 276], fill=(87, 201, 232))
    for lx, ex in ((268, 250), (297, 297), (326, 344)):
        d.line([(lx, 286), (ex, 314)], fill=(150, 156, 170), width=5)
    for sx, sy, r in ((230, 60, 5), (280, 100, 4), (320, 50, 5), (200, 120, 4), (36, 150, 5)):
        d.ellipse([sx - r, sy - r, sx + r, sy + r], fill=(255, 255, 255))

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
    # A beach ball and a spinning top on the floor.
    d.ellipse([278, 288, 336, 334], fill=(255, 255, 255))
    for k, col in enumerate(((194, 59, 59), (63, 127, 208), (63, 163, 92))):
        d.pieslice([278, 288, 336, 334], -90 + k * 60, -90 + (k + 1) * 60, fill=col)
    d.rounded_rectangle([44, 288, 148, 322], radius=8, fill=(176, 110, 232))
    d.rounded_rectangle([100, 262, 148, 292], radius=6, fill=(87, 201, 232))
    for wx in (66, 126):
        d.ellipse([wx - 16, 310, wx + 16, 342], fill=(60, 56, 74))
        d.ellipse([wx - 7, 319, wx + 7, 333], fill=(226, 220, 208))
    sparkles(d, ((214, 96, 7), (312, 138, 6), (26, 244, 6)), (255, 246, 216))

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
