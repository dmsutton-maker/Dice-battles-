"""
A realistic fingertip, pressing on the glass.

Not a cartoon hand with an ink outline — David asked on 26 Aug 2026 for
"a real looking finger". What makes it read as real rather than drawn is
shading, so this is built numerically:

  - cylindrical shading across the finger's width, with a soft highlight
    band slightly off the centre line, because a finger is a cylinder
  - NO black outline; the edge is a darker skin tone, which is what an
    edge actually looks like
  - the tip flushed slightly redder, as a pressed fingertip is
  - a real nail: pink bed, white free edge, pale lunula, and a specular
    streak, which is the single most recognisable thing about a finger
  - a soft contact shadow beneath, so it sits ON the glass
"""
import math
import numpy as np
from PIL import Image, ImageFilter

W, H = 320, 940

# Skin, mid-tone. Everything else is derived from it by shading.
SKIN      = np.array([232, 184, 152], float)
SKIN_EDGE = np.array([170, 118,  92], float)
SKIN_LIT  = np.array([255, 228, 206], float)
FLUSH     = np.array([224, 150, 132], float)

NAIL_BED  = np.array([236, 178, 168], float)
NAIL_TIP  = np.array([250, 240, 236], float)
LUNULA    = np.array([246, 224, 220], float)


def finger():
    ys, xs = np.mgrid[0:H, 0:W].astype(float)
    cx = W / 2

    # ── the finger's outline
    #
    # The tip is a true semicircular DOME. The first attempt tapered the
    # width to zero over the last 78 pixels, which draws a pencil point —
    # the single thing that most stopped it reading as a finger.
    R = 88.0
    tip_y = 84.0                     # where the dome meets the shaft
    shaft = np.interp(ys, [tip_y, 260.0, 440.0, H], [R, 97.0, 104.0, 116.0])
    dome = np.sqrt(np.clip(R ** 2 - (tip_y - ys) ** 2, 0, None))
    half = np.where(ys < tip_y, dome, shaft)

    dist = np.abs(xs - cx) / np.maximum(half, 1e-6)
    inside = (dist <= 1) & (ys > tip_y - R)

    # ── cylindrical shading: bright along a ridge left of centre
    ridge = np.clip((xs - cx + 26) / np.maximum(half, 1e-6), -1, 1)
    lam = np.clip(1 - ridge ** 2, 0, 1) ** 0.7           # 1 on the ridge, 0 at edges
    edge = np.clip(dist, 0, 1) ** 1.9                     # 1 right at the outline

    rgb = (SKIN[None, None, :] * (1 - lam[..., None]) +
           SKIN_LIT[None, None, :] * lam[..., None])
    rgb = rgb * (1 - edge[..., None]) + SKIN_EDGE[None, None, :] * edge[..., None]

    # blood in the pressed tip
    flush = np.clip(1 - (ys - tip_y) / 150.0, 0, 1) ** 1.6
    rgb = rgb * (1 - 0.42 * flush[..., None]) + FLUSH[None, None, :] * 0.42 * flush[..., None]

    # ── the nail
    #
    # Narrower and taller than the first try, which was very nearly a
    # circle and read as an eye. A nail is about two thirds the width of
    # the finger and a little taller than it is wide.
    ncx, ncy, nrx, nry = cx - 3, tip_y + 34, 47.0, 70.0
    nd = ((xs - ncx) / nrx) ** 2 + ((ys - ncy) / nry) ** 2
    nail = nd <= 1
    ncurve = np.clip(1 - nd, 0, 1) ** 0.5

    nail_rgb = (NAIL_BED[None, None, :] * (1 - ncurve[..., None] * 0.35) +
                LUNULA[None, None, :] * ncurve[..., None] * 0.35)
    # white free edge along the top of the nail
    free = np.clip((ncy - 46 - ys) / 26.0, 0, 1) * nail
    nail_rgb = nail_rgb * (1 - free[..., None]) + NAIL_TIP[None, None, :] * free[..., None]
    # lunula: the pale half-moon at the base
    lun = np.clip(1 - (((xs - ncx) / 30.0) ** 2 + ((ys - (ncy + 44)) / 20.0) ** 2), 0, 1)
    nail_rgb = nail_rgb * (1 - 0.55 * lun[..., None]) + LUNULA[None, None, :] * 0.55 * lun[..., None]
    # specular streak, the thing that makes it read as keratin
    spec = np.clip(1 - (((xs - (ncx - 20)) / 11.0) ** 2 + ((ys - (ncy - 6)) / 40.0) ** 2), 0, 1) ** 1.6
    nail_rgb = nail_rgb + 46 * spec[..., None]

    nail_soft = np.clip((1 - nd) * 6, 0, 1) * 0.88
    rgb = rgb * (1 - nail_soft[..., None]) + nail_rgb * nail_soft[..., None]
    # the skin fold rising around the nail
    fold = np.clip(1 - np.abs(nd - 1.16) * 7, 0, 1) * 0.30
    rgb = rgb * (1 - fold[..., None]) + SKIN_EDGE[None, None, :] * fold[..., None]

    # ── a knuckle crease low down
    for kx, ky, kh in [(0, 400, 14), (0, 436, 9)]:
        cr = np.clip(1 - np.abs(ys - ky) / kh, 0, 1) * np.clip(1 - dist * 1.15, 0, 1)
        rgb = rgb * (1 - 0.22 * cr[..., None]) + SKIN_EDGE[None, None, :] * 0.22 * cr[..., None]

    alpha = np.zeros((H, W))
    alpha[inside] = 255
    # The finger has to run OFF the picture, not stop.
    #
    # At 86pt tall the base ended in mid-air over the arena floor with a
    # hard horizontal cut across it — the giveaway that it is an image
    # pasted on rather than a finger reaching in. The canvas is longer now
    # and the last stretch fades out, so wherever the flick carries it the
    # finger simply recedes.
    fade = np.clip((H - 210 - ys) / 150.0, 0, 1)
    alpha = alpha * np.where(ys > H - 360, fade, 1.0)
    img = Image.fromarray(
        np.dstack([np.clip(rgb, 0, 255), alpha]).astype(np.uint8), 'RGBA'
    )
    # soften the silhouette edge — a hard cut is the other thing that
    # makes an image look pasted on
    a = img.split()[3].filter(ImageFilter.GaussianBlur(1.4))
    img.putalpha(a)
    return img


def with_shadow(f):
    """A soft contact shadow, so the finger sits ON the glass."""
    pad = 40
    out = Image.new('RGBA', (W + pad * 2, H + pad), (0, 0, 0, 0))
    sh = Image.new('RGBA', out.size, (0, 0, 0, 0))
    m = f.split()[3].point(lambda v: int(v * 0.42))
    sh.paste(Image.new('RGBA', f.size, (24, 18, 14, 255)), (pad + 16, 26), m)
    sh = sh.filter(ImageFilter.GaussianBlur(16))
    out.alpha_composite(sh)
    out.alpha_composite(f, (pad, 0))
    return out


img = with_shadow(finger())

# Down to something honest for the size it is drawn at.
#
# It is generated big because the shading maths is easier on a large
# grid, but the demo draws it 43pt wide — 129px on the densest screen
# Apple ships. At full size the file was 81 kB of mostly empty alpha, in
# an over-the-air update the family downloads on a phone. 200px across is
# still four and a half times what any screen asks for.
img = img.resize((200, round(200 * img.height / img.width)), Image.LANCZOS)
img.save('/home/user/Dice-battles-/assets/tutorial/finger.png')

bg = (193, 178, 149)  # the arena floor, so it is judged where it will live
sheet = Image.new('RGB', (img.width + 320, img.height + 40), bg)
sheet.paste(img, (20, 20), img)
for i, h in enumerate([150, 96, 70]):
    r = img.resize((int(img.width * h / img.height), h), Image.LANCZOS)
    sheet.paste(r, (img.width + 60, 20 + i * 180), r)
sheet.save('/tmp/finger-preview.png')
print('wrote finger-v4.png')
