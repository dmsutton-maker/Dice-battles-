"""
The four battlefield pictures for the Inventory.

They were emoji — 🏰 🌅 🌴 🚀 — which is the last emoji left standing in
the interface after the Paper & Ink pass, and which cannot tell the
Castle apart from the Sunset Castle at all. David asked on 26 Aug 2026
for hand-drawn pictures instead: coloured, detailed, distinct, accurate.

ACCURATE matters most and is the easy half to get wrong. Every colour
below is lifted from the arena that it draws (src/arena/*.tsx), so the
picture in the menu is made of the same paint as the place it opens.

DISTINCT is the hard half, and it has bitten this project before: the
Sunset Castle was once reported as not looking any different from the
Castle. They share a building, so the difference has to be carried by
the sky, the light and the shadow — which is what actually differs when
you stand in them.

Drawn at 6x and shipped at 3x, because the Inventory swatch is 58pt.
Anything finer than about three chunky shapes disappears at that size,
which is why these are scenes rather than diagrams.
"""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

S = 348                    # 6x the 58pt swatch
OUT = 174                  # 3x, which is the densest screen Apple ships


def canvas(top, bottom):
    """A sky, as a vertical gradient."""
    ys = np.linspace(0, 1, S)[:, None]
    top, bottom = np.array(top, float), np.array(bottom, float)
    grad = top[None, None, :] * (1 - ys[..., None]) + bottom[None, None, :] * ys[..., None]
    return Image.fromarray(np.repeat(grad, S, axis=1).astype(np.uint8), 'RGB')


def rounded(img, r=0.16):
    m = Image.new('L', (S, S), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * r), fill=255)
    out = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    out.paste(img, (0, 0), m)
    return out


def cone(d, cx, cy, w, h, fill, shade):
    """A conical tower roof: lit on the left, shaded on the right."""
    d.polygon([(cx, cy - h), (cx - w, cy), (cx + w, cy)], fill=fill)
    d.polygon([(cx, cy - h), (cx, cy), (cx + w, cy)], fill=shade)


def keep(cx, top, w, h, d, stone, dark, merlon=True):
    """A stretch of castle wall with battlements."""
    d.rectangle([cx - w / 2, top, cx + w / 2, top + h], fill=stone)
    d.rectangle([cx, top, cx + w / 2, top + h], fill=dark)
    if merlon:
        n = max(3, int(w / 26))
        step = w / n
        for i in range(n):
            x = cx - w / 2 + i * step
            d.rectangle([x + 2, top - 14, x + step - 6, top + 2], fill=stone if i % 2 == 0 else dark)


# ── Castle Courtyard ───────────────────────────────────────────────────
def castle(sunset=False):
    if sunset:
        sky = canvas((255, 196, 122), (255, 129, 96))     # dusk, sampled warm
        grass, grass_dk = (110, 132, 84), (86, 106, 66)   # grass in low light
        stone, stone_dk = (176, 138, 122), (120, 88, 84)  # warm-lit masonry
        roof, roof_dk = (214, 88, 78), (150, 52, 58)
    else:
        sky = canvas((142, 200, 247), (196, 228, 250))    # #8ec8f7, the real sky
        grass, grass_dk = (72, 164, 87), (62, 148, 80)    # #48a457 / #3e9450
        stone, stone_dk = (145, 127, 103), (122, 107, 86)  # #917f67 / #7a6b56
        roof, roof_dk = (255, 127, 102), (201, 79, 67)    # #ff7f66

    img = sky.copy()
    d = ImageDraw.Draw(img)

    # sun: high and small by day, low and huge at dusk
    if sunset:
        d.ellipse([120, 128, 232, 240], fill=(255, 238, 176))
        d.ellipse([132, 140, 220, 228], fill=(255, 249, 214))
    else:
        d.ellipse([258, 34, 314, 90], fill=(255, 245, 170))

    # ground
    d.rectangle([0, 236, S, S], fill=grass)
    d.ellipse([-60, 210, 200, 300], fill=grass_dk)
    d.ellipse([180, 218, 420, 300], fill=grass_dk)

    # the keep, and two round towers with conical roofs
    keep(174, 150, 132, 96, d, stone, stone_dk)
    for cx in (108, 240):
        d.rectangle([cx - 27, 140, cx + 27, 250], fill=stone)
        d.rectangle([cx, 140, cx + 27, 250], fill=stone_dk)
        cone(d, cx, 142, 40, 62, roof, roof_dk)
    # gate
    d.rounded_rectangle([154, 196, 194, 250], radius=20, fill=(74, 56, 44))
    # a window in each tower, warm at dusk
    lit = (255, 214, 122) if sunset else (58, 48, 64)
    for cx in (108, 240):
        d.rounded_rectangle([cx - 8, 176, cx + 8, 200], radius=8, fill=lit)

    if sunset:
        # long shadows thrown toward the viewer — the thing you actually
        # notice standing in it, and the thing a warm tint alone misses
        sh = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        sd = ImageDraw.Draw(sh)
        sd.polygon([(96, 250), (120, 250), (46, S), (-30, S)], fill=(64, 40, 60, 120))
        sd.polygon([(228, 250), (252, 250), (300, S), (206, S)], fill=(64, 40, 60, 120))
        sd.polygon([(150, 250), (198, 250), (232, S), (110, S)], fill=(64, 40, 60, 100))
        img.paste(sh.filter(ImageFilter.GaussianBlur(4)), (0, 0), sh.filter(ImageFilter.GaussianBlur(4)))
    return img


# ── Jungle Clearing ────────────────────────────────────────────────────
def leaf(img, x, y, length, width, angle, fill, rib):
    """One palm frond: a long leaf with a midrib, rotated into place.

    Fronds were flat quadrilaterals fanning off the trunk, and at 58pt
    that is a windmill, not a palm. A leaf shape with a spine is what the
    eye actually recognises.
    """
    pad = int(length * 1.4)
    lay = Image.new('RGBA', (pad * 2, pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    cx, cy = pad, pad
    d.ellipse([cx, cy - width / 2, cx + length, cy + width / 2], fill=fill)
    d.line([cx, cy, cx + length, cy], fill=rib, width=max(2, int(width * 0.16)))
    # notches down the trailing edge, which is what makes it read as a frond
    for k in range(1, 7):
        nx = cx + length * k / 7
        d.polygon([(nx, cy), (nx + length * 0.06, cy - width / 2),
                   (nx + length * 0.12, cy)], fill=(0, 0, 0, 0))
        d.polygon([(nx, cy), (nx + length * 0.06, cy + width / 2),
                   (nx + length * 0.12, cy)], fill=(0, 0, 0, 0))
    lay = lay.rotate(-angle, resample=Image.BICUBIC, center=(cx, cy))
    img.paste(lay, (int(x - pad), int(y - pad)), lay)


def jungle():
    img = canvas((168, 216, 184), (127, 206, 176))        # #a8d8b8 -> #7fceb0
    d = ImageDraw.Draw(img)

    # Layered canopy, dark at the back and lighter forward, so the picture
    # has depth instead of being one green mass.
    for cy, r, col in [(96, 86, (42, 97, 48)), (118, 74, (47, 107, 52))]:
        for cx in (24, 116, 208, 300, 356):
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)
    # The clearing itself — the thing the arena is named for, so it gets
    # room rather than being a strip under a wall of canopy.
    d.rectangle([0, 176, S, S], fill=(88, 152, 76))
    d.ellipse([-60, 150, 180, 226], fill=(58, 122, 62))   # #3a7a3e
    d.ellipse([190, 156, 420, 226], fill=(58, 122, 62))

    # The pool, with its sandy bank.
    d.ellipse([-46, 236, 224, 356], fill=(224, 208, 122))     # #e0d07a
    d.ellipse([-10, 254, 186, 340], fill=(127, 206, 176))     # #7fceb0
    d.ellipse([16, 266, 142, 322], fill=(143, 214, 168))      # #8fd6a8

    # The palm, front and centre-right: a leaning trunk with ringed bark.
    trunk = [(248, 348), (276, 348), (270, 152), (250, 150)]
    d.polygon(trunk, fill=(138, 99, 56))                      # #8a6338
    for k in range(8):
        ty = 176 + k * 22
        d.line([250 + k * 0.6, ty, 272 - k * 0.4, ty - 3], fill=(107, 74, 44), width=5)

    LIGHT, MID, RIB = (108, 176, 84), (58, 122, 62), (42, 97, 48)
    for angle, ln, wd, col in [
        (168, 116, 52, MID), (12, 116, 52, MID),
        (140, 104, 46, LIGHT), (40, 104, 46, LIGHT),
        (108, 92, 42, MID), (72, 92, 42, LIGHT),
    ]:
        leaf(img, 260, 152, ln, wd, angle, col, RIB)
    for cx, cy in [(247, 160), (269, 162), (258, 174)]:
        d.ellipse([cx - 11, cy - 11, cx + 11, cy + 11], fill=(107, 74, 44))

    # Ferns along the very front, framing the clearing.
    for fx, fy in ((44, 344), (330, 340), (168, 352)):
        for k in range(5):
            a = -160 + k * 35
            leaf(img, fx, fy, 58, 22, a, RIB, (34, 78, 40))
    return img


# ── Space Station ──────────────────────────────────────────────────────
def space():
    img = canvas((10, 14, 42), (26, 20, 62))                                # #0a0e2a
    d = ImageDraw.Draw(img)
    rng = np.random.default_rng(7)
    for _ in range(90):
        x, y = rng.integers(0, S), rng.integers(0, S)
        r = rng.choice([1.5, 2, 3.5])
        c = (255, 255, 255) if rng.random() > 0.3 else (127, 242, 255)
        d.ellipse([x - r, y - r, x + r, y + r], fill=c)
    # a ringed planet, top-left, the thing you cannot mistake for anywhere else
    d.ellipse([18, 26, 130, 138], fill=(42, 74, 138))                       # #2a4a8a
    d.ellipse([34, 38, 112, 116], fill=(201, 138, 255))                     # #c98aff
    ring = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(ring).ellipse([-14, 58, 164, 118], outline=(255, 95, 208), width=9)
    img.paste(ring.rotate(-16, resample=Image.BICUBIC, center=(74, 88)), (0, 0),
              ring.rotate(-16, resample=Image.BICUBIC, center=(74, 88)))
    # the station: a metal module with a docking ring and lit windows
    d.rounded_rectangle([96, 190, 300, 268], radius=38, fill=(138, 147, 168))   # #8a93a8
    d.rounded_rectangle([96, 232, 300, 268], radius=30, fill=(92, 100, 120))    # #5c6478
    for wx in (134, 176, 218, 260):
        d.ellipse([wx - 13, 210, wx + 13, 236], fill=(63, 242, 255))            # #3ff2ff
    # solar wings
    for sx in (52, 300):
        d.rounded_rectangle([sx, 200, sx + 48, 258], radius=6, fill=(42, 74, 138))
        for k in range(3):
            d.line([sx, 212 + k * 16, sx + 48, 212 + k * 16], fill=(63, 242, 255), width=3)
    d.line([100, 229, 52, 229], fill=(138, 147, 168), width=8)
    d.line([296, 229, 348, 229], fill=(138, 147, 168), width=8)
    # A small moon low and right, to give the scene a foreground and a
    # sense of scale. It was a lone yellow dot in the middle, which read
    # as a smudge on the lens rather than as anything in the sky.
    d.ellipse([238, 286, 314, 362], fill=(255, 217, 63))                       # #ffd93f
    d.ellipse([252, 292, 314, 354], fill=(255, 238, 150))
    for mx, my, mr in [(272, 312, 9), (292, 334, 6), (266, 340, 5)]:
        d.ellipse([mx - mr, my - mr, mx + mr, my + mr], fill=(232, 190, 60)) 
    return img


SCENES = {
    'castle': castle(False),
    'castle-sunset': castle(True),
    'jungle': jungle(),
    'space': space(),
}

for name, img in SCENES.items():
    rounded(img).resize((OUT, OUT), Image.LANCZOS).save(
        f'/home/user/Dice-battles-/assets/arenas/{name}.png')

# Contact sheet: big, and at the 58pt they are really drawn at.
pad = 16
sheet = Image.new('RGB', (4 * (S + pad) + pad, S + 58 + pad * 4), (253, 246, 236))
sd = ImageDraw.Draw(sheet)
for i, (name, img) in enumerate(SCENES.items()):
    r = rounded(img)
    x = pad + i * (S + pad)
    sheet.paste(r, (x, pad), r)
    small = r.resize((58, 58), Image.LANCZOS)
    sheet.paste(small, (x + S // 2 - 29, pad * 2 + S), small)
    sd.text((x + 4, pad * 3 + S + 58 - 12), name, fill=(29, 26, 46))
sheet.save('/tmp/arenas-preview.png')
print('wrote', ', '.join(SCENES))
