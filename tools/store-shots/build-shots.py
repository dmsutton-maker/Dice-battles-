"""Builds every App Store screenshot, for both shapes Apple asks for.

Run: python3 build-shots.py   → store/screenshots/{iphone,ipad}/NN.png
"""
from compose import *
from PIL import ImageChops
import compose, pathlib

OUT = pathlib.Path('/home/user/Dice-battles-/store/screenshots')


def oval_fade(art, grow=0.10, soft=0.11):
    m = art.split()[3]
    g = Image.new('L', art.size, 0)
    ImageDraw.Draw(g).ellipse([-art.width*grow, -art.height*grow,
                               art.width*(1+grow), art.height*(1+grow)], fill=255)
    art.putalpha(ImageChops.multiply(m, g.filter(ImageFilter.GaussianBlur(int(min(art.size)*soft)))))
    return art


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


def frame(dev, top, bottom, glow, seed, dots=26):
    img = compose.backdrop(top, bottom, glow).convert('RGBA')
    compose.confetti(img, seed, dots)
    return img


def caption(img, dev, eyebrow, line2):
    return compose.headline(img, eyebrow, line2, compose.H * dev['head_y'],
                            small=int(58 * dev['text']), big=int(132 * dev['text']))


def board_shot(out, dev, art_path, eyebrow, line2, top, bottom, glow, seed,
               art_w=1560, cy=0.742):
    img = frame(dev, top, bottom, glow, seed)
    art = oval_fade(fit_box(Image.open(art_path).convert('RGBA'),
                            int(art_w * dev['art']), compose.H * 0.62))
    x, y = (compose.W - art.width)//2, int(compose.H * cy) - art.height//2
    img.alpha_composite(compose.shadowed(art, blur=54, alpha=100), (x, y+46))
    img.alpha_composite(art, (x, y))
    caption(img, dev, eyebrow, line2)
    img.convert('RGB').save(out, quality=95)


def tiles_shot(out, dev, paths, eyebrow, line2, top, bottom, glow, seed,
               cols=2, tile=568, gap=44, cy=0.680):
    img = frame(dev, top, bottom, glow, seed, 22)
    rows = (len(paths)+cols-1)//cols
    # Fit the whole grid inside the art box, then work back to a tile size.
    box_w, box_h = compose.W * 0.86, compose.H * 0.58
    tile = int(min((box_w - (cols-1)*gap) / cols, (box_h - (rows-1)*gap) / rows))
    gap = int(gap * dev['art'])
    gw, gh = cols*tile+(cols-1)*gap, rows*tile+(rows-1)*gap
    ox, oy = (compose.W-gw)//2, int(compose.H*cy)-gh//2
    for k, p in enumerate(paths):
        im = Image.open(p).convert('RGBA')
        s = int(min(im.width, im.height) * 0.66)
        cx, cy2 = im.width//2, int(im.height*0.52)
        im = rounded(im.crop((cx-s//2, cy2-s//2, cx+s//2, cy2+s//2))
                       .resize((tile, tile), Image.LANCZOS), int(54*dev['art']))
        x, y = ox+(k % cols)*(tile+gap), oy+(k//cols)*(tile+gap)
        img.alpha_composite(compose.shadowed(im, blur=30, alpha=105), (x, y+16))
        img.alpha_composite(im, (x, y))
    caption(img, dev, eyebrow, line2)
    img.convert('RGB').save(out, quality=95)


def grid_shot(out, dev, path, eyebrow, line2, top, bottom, glow, seed,
              art_w=1150, cy=0.680):
    img = frame(dev, top, bottom, glow, seed, 20)
    art = fit_box(Image.open(path).convert('RGBA'),
                  compose.W * 0.80, compose.H * 0.58)
    x, y = (compose.W-art.width)//2, int(compose.H*cy)-art.height//2
    img.alpha_composite(compose.shadowed(art, blur=40, alpha=110), (x, y+22))
    img.alpha_composite(art, (x, y))
    caption(img, dev, eyebrow, line2)
    img.convert('RGB').save(out, quality=95)


def duo_shot(out, dev, lower, upper, eyebrow, line2, top, bottom, glow, seed,
             art_w=1180, cy=0.700):
    """The phone flat on the table between two players.

    The top half really is rotated 180 degrees in the game — the player
    across the table is looking at it upside down from where you sit
    (TwoPlayerScreen.tsx). Turning it here is not a flourish; it is the
    feature, and it is the thing that explains the picture at a glance.
    """
    img = frame(dev, top, bottom, glow, seed, 22)
    # Both halves plus the seam have to fit the art box together.
    probe = Image.open(lower).convert('RGBA')
    gap = int(10 * dev['art'])
    k = min(compose.W * 0.90 / probe.width,
            (compose.H * 0.60 - gap) / (probe.height * 2))
    w = int(probe.width * k)
    a = rounded(compose.fit(lower, w), int(34*dev['art']))
    b = rounded(compose.fit(upper, w), int(34*dev['art'])).rotate(180)
    total = a.height + b.height + gap
    x, y = (compose.W - w)//2, int(compose.H*cy) - total//2
    pair = Image.new('RGBA', (w, total), (0, 0, 0, 0))
    pair.alpha_composite(b, (0, 0))
    pair.alpha_composite(a, (0, b.height + gap))
    img.alpha_composite(compose.shadowed(pair, blur=48, alpha=110), (x, y+40))
    img.alpha_composite(pair, (x, y))
    # The seam the two players share.
    d = ImageDraw.Draw(img)
    sy = y + b.height + gap//2
    d.line([(x+int(40*dev['art']), sy), (x+w-int(40*dev['art']), sy)],
           fill=compose.hx(compose.GOLD) + (0,), width=1)
    caption(img, dev, eyebrow, line2)
    img.convert('RGB').save(out, quality=95)


SHOTS = {
    1: dict(kind='board', art={'iphone': '/tmp/hero-sky.png', 'ipad': '/tmp/hero-skyW.png'},
            eyebrow='Two dice. Six colors.', line2='MATCH THEM,\nSET ONE FREE',
            top='#4a9ee0', bottom='#1a4278', glow='#8fcdf8', seed=11),
    2: dict(kind='board', art={'iphone': '/tmp/hero-candy.png', 'ipad': '/tmp/hero-candyW.png'},
            eyebrow='No numbers. No pips.', line2='NOTHING\nTO READ',
            top='#e878a8', bottom='#5c1b46', glow='#ffb8d8', seed=12),
    3: dict(kind='tiles', art=['/tmp/hero-volcano.png', '/tmp/hero-aurora.png',
                               '/tmp/hero-reef.png', '/tmp/hero-moon.png'],
            eyebrow='A castle, a reef, the moon', line2='BATTLEFIELDS\nTO UNLOCK',
            top='#3f7f8f', bottom='#123240', glow='#7fd4e8', seed=14),
    4: dict(kind='grid', art='/tmp/dice-grid.png',
            eyebrow='Earn them, or buy them', line2='DICE SETS\nTO COLLECT',
            top='#d2451e', bottom='#4d1a0c', glow='#ffb27a', seed=15),
    5: dict(kind='board', art={'iphone': '/tmp/hero-cavern.png', 'ipad': '/tmp/hero-cavernW.png'},
            eyebrow='Rush · Ultimate · Skirmish · Color War', line2='FOUR WAYS\nTO PLAY',
            top='#7d5eb8', bottom='#2a1550', glow='#c98aff', seed=13),
    6: dict(kind='duo', art=('/tmp/hero-duoA.png', '/tmp/hero-duoB.png'),
            eyebrow='Two players, one screen', line2='PUT THE PHONE\nBETWEEN YOU',
            top='#5aa860', bottom='#153a1c', glow='#a8e2a4', seed=16),
}

for device in ('iphone', 'ipad'):
    dev = compose.use(device)
    folder = OUT / device
    folder.mkdir(parents=True, exist_ok=True)
    for n, s in SHOTS.items():
        out = folder / f'{n:02d}.png'
        common = (s['eyebrow'], s['line2'], s['top'], s['bottom'], s['glow'], s['seed'])
        if s['kind'] == 'board':
            board_shot(out, dev, s['art'][device], *common)
        elif s['kind'] == 'tiles':
            tiles_shot(out, dev, s['art'], *common)
        elif s['kind'] == 'grid':
            grid_shot(out, dev, s['art'], *common)
        elif s['kind'] == 'duo':
            duo_shot(out, dev, s['art'][0], s['art'][1], *common)
    print(device, compose.W, 'x', compose.H, '→', folder)
