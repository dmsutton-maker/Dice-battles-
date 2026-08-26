"""
A pointing hand as ONE silhouette.

v1 drew palm, finger, thumb and knuckles as separate outlined shapes, so
their outlines ran straight through each other and the result read as a
pile of lozenges. A hand is one mass. So: every part goes into a single
mask, the union is filled, and the outline is taken from the union by
dilating it — which is the only way to get a line that goes round the
OUTSIDE of a hand and nowhere else. Interior lines are then drawn back in
deliberately, short, where a knuckle crease belongs.
"""
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import math

SS = 4
W, H = 300, 400
SKIN   = (247, 214, 190)
CREASE = (214, 166, 138)
INK    = (29, 26, 46)

def parts(d, S):
    """Every mass of the hand, drawn solid white into a mask."""
    F = 255
    # palm — rounded, wider across the knuckles than at the wrist
    d.rounded_rectangle([72*S, 196*S, 214*S, 386*S], radius=46*S, fill=F)
    # index finger, extended
    d.rounded_rectangle([122*S, 92*S, 178*S, 250*S], radius=28*S, fill=F)
    # the three curled fingers bulge out of the left edge
    for yy, ln in [(210, 58), (256, 56), (300, 50)]:
        d.rounded_rectangle([(72-14)*S, yy*S, (72+ln)*S, (yy+42)*S],
                            radius=21*S, fill=F)
    return d

def rotated_thumb(size, S):
    m = Image.new('L', size, 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([146*S, 300*S, 242*S, 356*S], radius=28*S, fill=255)
    return m.rotate(-22, resample=Image.BICUBIC, center=(165*S, 337*S))

def hand():
    S = SS
    size = (W*S, H*S)
    mask = Image.new('L', size, 0)
    parts(ImageDraw.Draw(mask), S)
    mask = ImageChops.lighter(mask, rotated_thumb(size, S))
    # clean the antialiased edge into a hard one before dilating
    mask = mask.point(lambda v: 255 if v > 128 else 0)

    LW = 5 * S
    grown = mask.filter(ImageFilter.MaxFilter(int(LW) * 2 + 1))
    ring = ImageChops.subtract(grown, mask)

    img = Image.new('RGBA', size, (0, 0, 0, 0))
    img.paste(Image.new('RGBA', size, SKIN + (255,)), (0, 0), mask)

    # Interior creases: short strokes INSIDE the silhouette, clipped to it,
    # so a knuckle reads without a second outline appearing.
    inner = Image.new('RGBA', size, (0, 0, 0, 0))
    di = ImageDraw.Draw(inner)
    for yy in [252, 298, 342]:
        di.line([66*S, yy*S, 126*S, yy*S], fill=CREASE + (255,), width=int(3.4*S))
    # where the extended finger meets the palm
    di.arc([122*S, 216*S, 178*S, 260*S], 200, 340, fill=CREASE + (255,), width=int(3.4*S))
    shrunk = mask.filter(ImageFilter.MinFilter(int(LW) * 2 + 1))
    img.paste(inner, (0, 0), ImageChops.multiply(inner.split()[3], shrunk))

    img.paste(Image.new('RGBA', size, INK + (255,)), (0, 0), ring)
    return img.resize((W, H), Image.LANCZOS)

img = hand()
sheet = Image.new('RGB', (W + 200, H + 40), (245, 236, 224))
sheet.paste(img, (20, 20), img)
for i, s in enumerate([(72, 103), (48, 69)]):
    r = img.resize(s, Image.LANCZOS)
    sheet.paste(r, (W + 60, 20 + i * 130), r)
sheet.save('hand-v3.png')
img.save('/home/user/Dice-battles-/assets/tutorial/hand.png')
print('wrote hand-v2.png')
