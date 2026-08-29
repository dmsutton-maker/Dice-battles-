from compose import *
from PIL import ImageChops

def oval_fade(art, grow=0.10, soft=0.11):
    m = art.split()[3]
    g = Image.new('L', art.size, 0)
    ImageDraw.Draw(g).ellipse([-art.width*grow, -art.height*grow,
                               art.width*(1+grow), art.height*(1+grow)], fill=255)
    art.putalpha(ImageChops.multiply(m, g.filter(ImageFilter.GaussianBlur(int(min(art.size)*soft)))))
    return art

def board_shot(out, art_path, eyebrow, line2, top, bottom, glow, seed, art_w=1560, cy=2075):
    img = backdrop(top, bottom, glow).convert('RGBA')
    confetti(img, seed, 26)
    art = oval_fade(fit(art_path, art_w))
    x, y = (W - art.width)//2, cy - art.height//2
    img.alpha_composite(shadowed(art, blur=54, alpha=100), (x, y+46))
    img.alpha_composite(art, (x, y))
    headline(img, eyebrow, line2, 330)
    img.convert('RGB').save(out, quality=95); print(out)

def rounded(im, r):
    m = Image.new('L', im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, im.width-1, im.height-1], r, fill=255)
    im = im.convert('RGBA'); im.putalpha(ImageChops.multiply(im.split()[3], m)); return im

def tiles_shot(out, paths, eyebrow, line2, top, bottom, glow, seed, cols=2, tile=568, gap=44, cy=1900):
    img = backdrop(top, bottom, glow).convert('RGBA')
    confetti(img, seed, 22)
    rows = (len(paths)+cols-1)//cols
    gw, gh = cols*tile+(cols-1)*gap, rows*tile+(rows-1)*gap
    ox, oy = (W-gw)//2, cy-gh//2
    for k, p in enumerate(paths):
        im = Image.open(p).convert('RGBA')
        # The board sits in the middle of a much wider world; crop to it,
        # or every tile is mostly ground with a small tray in the centre.
        s = int(min(im.width, im.height) * 0.66)
        cx, cy2 = im.width // 2, int(im.height * 0.52)
        im = im.crop((cx - s//2, cy2 - s//2, cx + s//2, cy2 + s//2))
        im = rounded(im.resize((tile, tile), Image.LANCZOS), 54)
        x, y = ox+(k % cols)*(tile+gap), oy+(k//cols)*(tile+gap)
        img.alpha_composite(shadowed(im, blur=30, alpha=105), (x, y+16))
        img.alpha_composite(im, (x, y))
    headline(img, eyebrow, line2, 330)
    img.convert('RGB').save(out, quality=95); print(out)

def grid_shot(out, path, eyebrow, line2, top, bottom, glow, seed, art_w=1150, cy=1900):
    img = backdrop(top, bottom, glow).convert('RGBA')
    confetti(img, seed, 20)
    art = fit(path, art_w)
    x, y = (W-art.width)//2, cy-art.height//2
    img.alpha_composite(shadowed(art, blur=40, alpha=110), (x, y+22))
    img.alpha_composite(art, (x, y))
    headline(img, eyebrow, line2, 330)
    img.convert('RGB').save(out, quality=95); print(out)

board_shot('/tmp/store-1.png', '/tmp/hero-sky.png',
    'Two dice. Six colors.', 'MATCH THEM,\nSET ONE FREE',
    '#4a9ee0', '#1a4278', '#8fcdf8', 11)

board_shot('/tmp/store-2.png', '/tmp/hero-candy.png',
    'No numbers. No pips.', 'NOTHING\nTO READ',
    '#e878a8', '#5c1b46', '#ffb8d8', 12)

tiles_shot('/tmp/store-3.png',
    ['/tmp/hero-volcano.png', '/tmp/hero-aurora.png', '/tmp/hero-reef.png', '/tmp/hero-moon.png'],
    'A castle, a reef, the moon', 'TWENTY\nBATTLEFIELDS',
    '#3f7f8f', '#123240', '#7fd4e8', 14)

grid_shot('/tmp/store-4.png', '/tmp/dice-grid.png',
    'Earn them, or buy them', 'FIFTY-THREE\nDICE SETS',
    '#d2451e', '#4d1a0c', '#ffb27a', 15)

board_shot('/tmp/store-5.png', '/tmp/hero-cavern.png',
    'Rush · Ultimate · Skirmish · Color War', 'FOUR WAYS\nTO PLAY',
    '#7d5eb8', '#2a1550', '#c98aff', 13)
