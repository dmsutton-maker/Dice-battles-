# The website trailer

Renders `hq/public/videos/dice-battles-trailer.mp4`, the video on the
Dice Battles page, out of the game itself: the real battlefields, the
real dice skins, the real cannon-es physics and the real Fire and Ice
effects, with a scripted camera, slow motion and title cards on top.

David, 13 Oct 2026: "make a video to showcase the game on the website.
But make it with big action sequences. Not just game play."

The shots, their cameras, their captions and their slow-motion curves
are all in `entry.tsx` (`SHOTS` and `ORDER`). Change one there and
render again.

```sh
# 1. Tools, temporarily (see "take them back out" below)
npm i --no-save --legacy-peer-deps react-dom@19.1.0 playwright@1.49.0
python3 -m venv /tmp/tv && /tmp/tv/bin/pip install imageio-ffmpeg

# 2. Bundle
npx esbuild tools/trailer/entry.tsx --bundle --jsx=automatic \
  --outfile=tools/trailer/bundle.js --loader:.tsx=tsx --loader:.png=dataurl \
  --define:process.env.NODE_ENV='"production"'

# 3. A quick look first: one frame a second, small
OUT=/tmp/probe EVERY=30 SCALE=1 node tools/trailer/shoot.js
#    (SHOT=fire,ice renders only those shots)

# 4. The real thing: every frame at 1920x1080 (about 10 minutes)
OUT=/tmp/trailer-frames node tools/trailer/shoot.js

# 5. Encode — H.264, yuv420p, faststart: plays on every iPhone and iPad
FF=$(/tmp/tv/bin/python -c 'import imageio_ffmpeg as f; print(f.get_ffmpeg_exe())')
$FF -y -framerate 30 -i /tmp/trailer-frames/f%05d.png -c:v libx264 \
  -profile:v high -level 4.1 -pix_fmt yuv420p -crf 24 -preset slow \
  -movflags +faststart hq/public/videos/dice-battles-trailer.mp4
$FF -y -i /tmp/trailer-frames/f00900.png -q:v 3 hq/public/videos/dice-battles-trailer.jpg

# 6. Take the packages back out
npm uninstall --no-save react-dom playwright
```

## Take the packages back out

Not optional: Expo decides a project supports the web from `react-dom`
being in node_modules, and `eas update` then fails. Same trap as
`tools/arena-preview`.

## Why the frames are rendered one at a time

`frameloop="never"`, and `shoot.js` asks for frame 0, 1, 2… in turn,
stepping the physics by exactly one frame's worth of (slowed-down) time
each. However slow the machine, the video comes out at a perfect 30
frames a second.

## Why it is self-hosted

A YouTube or Vimeo embed would load a third party's scripts and cookies
for every visitor, and this site loads nothing from anybody else — which
is why it needs no cookie banner. `tests/website.test.ts` checks both.

## Not in it

No sound: the page autoplays it muted, which is the only way iOS lets a
video play by itself. The game's music is CC-BY and would need crediting
on the page if it were ever added.
