"""Builds every App Store screenshot, for both shapes Apple asks for.

Run: python3 tools/store-shots/build-shots.py → store/screenshots/{iphone,ipad}/NN.png

Reads the renders shoot.js and dice-grid.ts left in $SHOTS_TMP (default
/tmp/store-shots). Writes flat RGB PNGs: App Store Connect refuses a
screenshot with an alpha channel.
"""
from compose import *
from PIL import ImageChops
import compose, json, os, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'store' / 'screenshots'
TMP = pathlib.Path(os.environ.get('SHOTS_TMP', '/tmp/store-shots'))


def art(name):
    return Image.open(TMP / f'{name}.png').convert('RGBA')


def rounded(im, r):
    m = Image.new('L', im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, im.width-1, im.height-1], r, fill=255)
    im = im.convert('RGBA')
    im.putalpha(ImageChops.multiply(im.split()[3], m))
    return im


def fit_box(im, max_w, max_h):
    """Scale to fit BOTH limits.

    The iPad is 1.59x the phone's width but almost exactly its height
    (2732 against 2796), so scaling art by the width ratio overflows the
    bottom — which is what the first iPad pass did to the dice grid and
    the arena tiles. Everything that has to fit whole is fitted to a box,
    not to a scale factor.
    """
    k = min(max_w / im.width, max_h / im.height)
    return im.resize((max(1, int(im.width*k)), max(1, int(im.height*k))), Image.LANCZOS)


def top_fade(im, share=0.20):
    """Melt the top of a board render into the backdrop, so the far end
    of the ground never draws a hard line under the headline."""
    fade = int(im.height * share)
    ramp = Image.new('L', (1, im.height), 255)
    for y in range(fade):
        k = y / fade
        ramp.putpixel((0, y), int(255 * k * k * (3 - 2 * k)))
    ramp = ramp.resize(im.size)
    im.putalpha(ImageChops.multiply(im.split()[3], ramp))
    return im


def frame(top, bottom, glow, seed, dots=26):
    img = compose.backdrop(top, bottom, glow).convert('RGBA')
    compose.confetti(img, seed, dots)
    return img


def caption(img, dev, eyebrow, line2):
    return compose.headline(img, eyebrow, line2, compose.H * dev['head_y'],
                            small=int(64 * dev['text']), big=int(150 * dev['text']))


def save(img, out):
    img.convert('RGB').save(out, optimize=True)


def place_board(img, im):
    """The board fills the canvas from under the headline to the bottom
    edge and bleeds off both sides: the render is already the size of
    that box (shots.json), so nothing is scaled."""
    im = fit_box(im, compose.W, compose.H) if im.width > compose.W else im
    im = top_fade(im)
    img.alpha_composite(im, ((compose.W - im.width)//2, compose.H - im.height))


def board_shot(out, dev, s):
    img = frame(s['top'], s['bottom'], s['glow'], s['seed'])
    place_board(img, art(s['art'] + dev['suffix']))
    caption(img, dev, s['eyebrow'], s['line2'])
    save(img, out)


def split_shot(out, dev, s):
    """Fire on one side, ice on the other, on the same board.

    Both renders share a camera, and every battlefield's tray is the same
    size, so cut on a diagonal they meet as one board: Volcano Rim with
    the Fire die on the left, Snowy Hollow with the Ice die on the right.
    The backdrop is split along the same line, warm and cold.
    """
    a, b = art(s['art'][0] + dev['suffix']), art(s['art'][1] + dev['suffix'])
    W, H = compose.W, compose.H
    # The seam, in canvas coordinates: leaning from upper right to lower left.
    x_top, x_bot = W * 0.64, W * 0.30
    mask = Image.new('L', (W, H), 0)
    ImageDraw.Draw(mask).polygon([(0, 0), (x_top, 0), (x_bot, H), (0, H)], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(3))
    warm = frame(*s['warm'], s['seed'])
    cold = frame(*s['cold'], s['seed'] + 1)
    img = Image.composite(warm, cold, mask)
    left, right = Image.new('RGBA', (W, H)), Image.new('RGBA', (W, H))
    place_board(left, a)
    place_board(right, b)
    img.alpha_composite(Image.composite(left, right, mask))
    # A thin bright seam where the two seasons meet.
    seam = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(seam).line([(x_top, 0), (x_bot, H)], fill=(255, 250, 235, 210), width=int(6 * dev['art']))
    glow = seam.filter(ImageFilter.GaussianBlur(14 * dev['art']))
    img.alpha_composite(glow)
    img.alpha_composite(glow)
    img.alpha_composite(seam.filter(ImageFilter.GaussianBlur(1.5)))
    caption(img, dev, s['eyebrow'], s['line2'])
    save(img, out)


def card(path, size, r):
    """One dice set as the Store shows it, with a soft sheen down the top
    left so it reads as the face of a die rather than a swatch."""
    im = Image.open(path).convert('RGB').resize((size, size), Image.LANCZOS)
    sheen = Image.new('L', (size, size), 0)
    px = sheen.load()
    for y in range(size):
        for x in range(size):
            px[x, y] = int(max(0.0, 1 - (x + y) / (size * 1.1)) * 70)
    im = Image.composite(Image.new('RGB', im.size, (255, 255, 255)), im, sheen)
    return rounded(im, r)


def collection_shot(out, dev, s):
    """The dice sets, then the battlefields, as one block fitted to the
    space under the headline."""
    img = frame(s['top'], s['bottom'], s['glow'], s['seed'], 20)
    order = json.loads((TMP / 'cards' / 'order.json').read_text())
    cols = dev['grid_cols']
    rows = (len(order) + cols - 1) // cols
    # Laid out at a nominal size, then fitted as a whole.
    tile, gap = 300, 34
    gw = cols * tile + (cols - 1) * gap
    tiles = s['tiles']
    tgap = 44
    tt = (gw - (len(tiles) - 1) * tgap) // len(tiles)
    block_h = rows * tile + (rows - 1) * gap + 90 + tt
    block = Image.new('RGBA', (gw, block_h), (0, 0, 0, 0))
    for k, die in enumerate(order):
        c = card(TMP / 'cards' / f'{die}.png', tile, 62)
        x, y = (k % cols) * (tile + gap), (k // cols) * (tile + gap)
        block.alpha_composite(compose.shadowed(c, blur=18, alpha=120), (x, y + 12))
        block.alpha_composite(c, (x, y))
    ty = rows * tile + (rows - 1) * gap + 90
    for k, name in enumerate(tiles):
        im = art(name)
        sq = int(min(im.width, im.height) * 0.70)
        cx, cy = im.width // 2, int(im.height * 0.52)
        im = rounded(im.crop((cx - sq//2, cy - sq//2, cx + sq//2, cy + sq//2))
                       .resize((tt, tt), Image.LANCZOS), 62)
        x = k * (tt + tgap)
        block.alpha_composite(compose.shadowed(im, blur=26, alpha=120), (x, ty + 16))
        block.alpha_composite(im, (x, ty))
    top = compose.H * dev['art_top']
    block = fit_box(block, compose.W * 0.88, (compose.H * 0.975 - top))
    img.alpha_composite(block, ((compose.W - block.width)//2, int(top + (compose.H * 0.975 - top - block.height) / 2)))
    caption(img, dev, s['eyebrow'], s['line2'])
    save(img, out)


def duo_shot(out, dev, s):
    """The phone flat on the table between two players.

    The top half really is rotated 180 degrees in the game — the player
    across the table is looking at it upside down from where you sit
    (TwoPlayerScreen.tsx). Turning it here is not a flourish; it is the
    feature, and it is the thing that explains the picture at a glance.
    """
    img = frame(s['top'], s['bottom'], s['glow'], s['seed'], 22)
    lower, upper = art(s['art'][0]), art(s['art'][1])
    gap = int(12 * dev['art'])
    top = compose.H * dev['art_top']
    room = compose.H * 0.975 - top
    k = min(compose.W * 0.94 / lower.width, (room - gap) / (lower.height * 2))
    w, h = int(lower.width * k), int(lower.height * k)
    r = int(40 * dev['art'])
    a = rounded(lower.resize((w, h), Image.LANCZOS), r)
    b = rounded(upper.resize((w, h), Image.LANCZOS), r).rotate(180)
    total = a.height + b.height + gap
    x, y = (compose.W - w)//2, int(top + (room - total) / 2)
    pair = Image.new('RGBA', (w, total), (0, 0, 0, 0))
    pair.alpha_composite(b, (0, 0))
    pair.alpha_composite(a, (0, b.height + gap))
    img.alpha_composite(compose.shadowed(pair, blur=48, alpha=110), (x, y+40))
    img.alpha_composite(pair, (x, y))
    caption(img, dev, s['eyebrow'], s['line2'])
    save(img, out)


# The order Apple shows them in, and what each one says. The copy names
# the KIND of thing and never the quantity of it (README, "No countable
# claims").
SHOTS = {
    1: dict(kind='board', art='hero',
            eyebrow='Two dice. Six colors.', line2='MATCH THEM,\nSET ONE FREE',
            top='#6b4fb0', bottom='#1e1040', glow='#b98aff', seed=11),
    2: dict(kind='board', art='online',
            eyebrow='Play online', line2='BATTLE REAL\nPLAYERS',
            top='#3f8fc0', bottom='#122c44', glow='#93d4f2', seed=12),
    3: dict(kind='collection', tiles=['tile-candy', 'tile-toybox', 'tile-dino'],
            eyebrow='Earn them or buy them', line2='COLLECT DICE\nAND BATTLEFIELDS',
            top='#d2451e', bottom='#4d1a0c', glow='#ffb27a', seed=15),
    4: dict(kind='split', art=('fire', 'ice'),
            eyebrow='New dice. New battlefields.', line2='A NEW SEASON\nEVERY MONTH',
            warm=('#b8481e', '#3a0e08', '#ff9a52'), cold=('#4f9ccc', '#0f2f4c', '#bfe8ff'), seed=14),
    5: dict(kind='board', art='cup',
            eyebrow='Win coins and trophies', line2='A NEW CUP\nEVERY WEEK',
            top='#4a9ee0', bottom='#1a4278', glow='#8fcdf8', seed=13),
    6: dict(kind='duo', art=('duoA', 'duoB'),
            eyebrow='Two players, one screen', line2='PUT THE PHONE\nBETWEEN YOU',
            top='#5aa860', bottom='#153a1c', glow='#a8e2a4', seed=16),
}

BUILD = {'board': board_shot, 'split': split_shot, 'collection': collection_shot, 'duo': duo_shot}

for device in ('iphone', 'ipad'):
    dev = compose.use(device)
    folder = OUT / device
    folder.mkdir(parents=True, exist_ok=True)
    for n, s in SHOTS.items():
        BUILD[s['kind']](folder / f'{n:02d}.png', dev, s)
    print(device, compose.W, 'x', compose.H, '→', folder)
