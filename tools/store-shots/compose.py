"""Builds the App Store screenshots from the real game renders.

The board, the dice and the figures in every frame are the game itself,
rendered by tools/store-shots at a camera angle the game cannot use (it
looks almost straight down, because that is the only way a 5.6 x 10.2
tray fits a phone). Everything else here is the frame around it: the lit
background, the headline and the colour confetti, all built from the
game's own palette — cream #fdf6ec, ink #1d1a2e, accent #d2451e, and the
six face colours that ARE the game.
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math, random

W, H = 1290, 2796                      # iPhone 6.9", App Store's current size
CREAM, INK, ACCENT, GOLD = '#fdf6ec', '#1d1a2e', '#d2451e', '#ffd21f'
FACES = ['#cc2533', '#043fe0', '#33cc6b', '#ffe521', '#cc79fc', '#fc8403']
BIG = '/tmp/fonts/baloo-800.ttf'
SMALL = '/tmp/fonts/nunito-900.ttf'

def hx(c):
    c = c.lstrip('#'); return tuple(int(c[i:i+2], 16) for i in (0, 2, 4))

def font(path, size):
    return ImageFont.truetype(path, size)

def backdrop(top, bottom, glow):
    """A lit stage: a vertical wash, a soft light behind where the board
    will sit, and a vignette so the edges hold the eye in."""
    bg = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(bg)
    t, b = hx(top), hx(bottom)
    for y in range(H):
        k = y / H
        k = k * k * (3 - 2 * k)
        d.line([(0, y), (W, y)], fill=tuple(int(t[i] + (b[i] - t[i]) * k) for i in range(3)))
    lamp = Image.new('L', (W, H), 0)
    ImageDraw.Draw(lamp).ellipse([-W * 0.3, H * 0.20, W * 1.3, H * 0.80], fill=190)
    bg = Image.composite(Image.new('RGB', (W, H), hx(glow)), bg, lamp.filter(ImageFilter.GaussianBlur(210)))
    vig = Image.new('L', (W, H), 0)
    ImageDraw.Draw(vig).ellipse([-W * 0.45, -H * 0.12, W * 1.45, H * 1.12], fill=255)
    return Image.composite(bg, Image.new('RGB', (W, H), hx(bottom)), vig.filter(ImageFilter.GaussianBlur(190)))

def confetti(img, seed, n=34):
    """The six face colours, drifting. They are the game's whole signal,
    so they double as its decoration."""
    rnd = random.Random(seed)
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for _ in range(n):
        r = rnd.randint(9, 30)
        x, y = rnd.randint(-20, W + 20), rnd.randint(int(H * 0.03), int(H * 0.92))
        c = hx(rnd.choice(FACES))
        d.ellipse([x - r, y - r, x + r, y + r], fill=c + (rnd.randint(40, 115),))
    img.alpha_composite(layer.filter(ImageFilter.GaussianBlur(1.2)))
    return img

def shadowed(art, blur=46, spread=1.02, alpha=120):
    """A soft contact shadow, so the board sits on the light instead of
    floating in front of it."""
    a = art.split()[3]
    sh = Image.new('RGBA', art.size, (0, 0, 0, 0))
    sh.putalpha(a.point(lambda v: int(v * alpha / 255)))
    sh = sh.resize((int(art.width * spread), int(art.height * spread)))
    return sh.filter(ImageFilter.GaussianBlur(blur))

def headline(img, line1, line2, y, small=58, big=132, colour=CREAM, hi=None):
    """Two lines: a quiet eyebrow, then the thing itself. Uppercase and
    tight, which is what makes a phone-sized thumbnail readable.

    Both lines shrink to fit rather than running off the edge — the mode
    list ('COLOR RUSH · ULTIMATE · SKIRMISH · COLOR WAR') did exactly
    that on the first build, losing a word off each side."""
    d = ImageDraw.Draw(img)
    MARGIN = 96

    def fitted(path, size, text):
        f = font(path, size)
        while size > 18 and d.textlength(text, font=f) > W - MARGIN * 2:
            size -= 2
            f = font(path, size)
        return f

    f1 = fitted(SMALL, small, line1.upper())
    f2 = font(BIG, big)
    for w in line2.upper().split('\n'):
        f2 = fitted(BIG, min(big, f2.size), w)
    big = f2.size
    d.text((W / 2, y), line1.upper(), font=f1, fill=hx(hi or GOLD), anchor='mm')
    words = line2.upper().split('\n')
    yy = y + small * 0.55 + big * 0.62
    for w in words:
        # A soft ink halo, so the headline holds up over the brightest art.
        halo = Image.new('RGBA', img.size, (0, 0, 0, 0))
        ImageDraw.Draw(halo).text((W / 2, yy), w, font=f2, fill=hx(INK) + (150,), anchor='mm')
        img.alpha_composite(halo.filter(ImageFilter.GaussianBlur(16)))
        d.text((W / 2, yy), w, font=f2, fill=hx(colour), anchor='mm')
        yy += big * 1.02
    return yy

def fit(path, width):
    im = Image.open(path).convert('RGBA')
    return im.resize((width, int(im.height * width / im.width)), Image.LANCZOS)

def crop_art(im, pad=0.02):
    """Trim the transparent margin so the board can be placed by its own
    bounds rather than by the size of the canvas it was rendered on."""
    b = im.getbbox()
    if not b: return im
    x0, y0, x1, y1 = b
    dx, dy = int((x1 - x0) * pad), int((y1 - y0) * pad)
    return im.crop((max(0, x0 - dx), max(0, y0 - dy), min(im.width, x1 + dx), min(im.height, y1 + dy)))
