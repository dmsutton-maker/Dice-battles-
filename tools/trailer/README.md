# The website trailer (and the App Store videos)

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

## The App Store videos

Approved by David on 5 Nov 2026, after a review against Apple's asset
guidance. The same tool renders them; `REEL` picks the shot list
(`REELS` in `entry.tsx`) and the size. With no `REEL` it is the website
trailer above, untouched.

| reel | file | size | length | sound |
|---|---|---|---|---|
| `header` | `store/videos/header-3840x1646.mp4` (+ `.png` still) | 3840 × 1646 (21:9) | 10 s, seamless loop | none |
| `iphone` | `store/videos/preview-iphone-886x1920.mp4` | 886 × 1920 | 27.3 s, loops | the game's own music |
| `ipad` | `store/videos/preview-ipad-1200x1600.mp4` | 1200 × 1600 | 27.3 s, loops | the game's own music |

```sh
# 1. Tools, as above, plus the caption font (Baloo 2, SIL OFL, the
#    screenshots' font; fetched, not committed — see tools/store-shots)
npm i --no-save --legacy-peer-deps react-dom@19.1.0 playwright@1.49.0
mkdir -p /tmp/fonts && curl -s -o /tmp/fonts/baloo-800.ttf \
  "https://fonts.gstatic.com/s/baloo2/v23/wXK0E3kTposypRydzVT08TS3JnAmtdj9yqpv.ttf"

# 2. Bundle — the reels show the prisoners, which import the native
#    fiber entry, so it is aliased to the web one here
npx esbuild tools/trailer/entry.tsx --bundle --jsx=automatic \
  --outfile=tools/trailer/bundle.js --loader:.tsx=tsx --loader:.png=dataurl \
  --alias:@react-three/fiber/native=@react-three/fiber \
  --define:process.env.NODE_ENV='"production"'

# 3. Render (CHROME_PATH=... if Playwright's own Chromium is missing;
#    EVERY=30 SCALE=0.5 for a quick look; UPTO=1 ARENA=sky to try a shot elsewhere)
REEL=header OUT=/tmp/header node tools/trailer/shoot.js     # ~10 min
REEL=iphone OUT=/tmp/iphone node tools/trailer/shoot.js
REEL=ipad   OUT=/tmp/ipad   node tools/trailer/shoot.js

# 4. Crossfade, loop, encode (and the header's still)
mkdir -p store/videos
python3 tools/trailer/compose.py /tmp/header store/videos/header-3840x1646.mp4 \
  --still store/videos/header-3840x1646.png --still-at 4.5
python3 tools/trailer/compose.py /tmp/iphone store/videos/preview-iphone-886x1920.mp4 \
  --audio assets/sounds/music-brass.m4a
python3 tools/trailer/compose.py /tmp/ipad store/videos/preview-ipad-1200x1600.mp4 \
  --audio assets/sounds/music-brass.m4a

# 5. Take the packages back out (REQUIRED, below)
npm uninstall --no-save react-dom playwright
```

What is in them, and why:

- **Only what a player can get today.** No retired dice (the ball dice,
  v1.158.0/v1.161.0), no Dino Valley (hidden), nothing from a season that
  has not started (Sun & Moon is June 2027). Fire & Ice is the season
  running. Check `SHOWCASE`-style skin lists against `diceSkins.ts`
  before re-rendering in a later month.
- **The header** is one idea in one shot: Fire dice crossing one way and
  Ice dice the other, in slow motion, over Sunset Castle. The dice fly
  on paths (`floaters`) and the camera drifts (`loopCamera`), both
  repeating exactly every 10 seconds, so the loop has no seam; the
  1.5-second crossfade in `compose.py` hides the embers and mist, which
  are not periodic. No text. Everything that matters crosses the middle,
  which is the part every screen width keeps.
- **The previews open on the rule.** Gold dice in slow motion, landing
  on the same colour, and that prisoner leaping out of jail. The landing
  is real physics: `roll` re-spins the throw (a seeded nudge to its spin,
  nothing else) until the game's own settle rule calls two of the same
  colour, and only then is it filmed. Then Fire, Ice, a race on Candy
  Meadow, two more battlefields, a sunset downpour, and the name.
- **No quick cuts.** Shots crossfade (0.4 s); the tail of the reel
  crossfades into its head (0.5 s), so the preview loops without a jump.
- **The music is ours** (`assets/sounds/CREDITS.md`): Brass Chase, cut at
  15 bars of 132 BPM, faded out over the last 0.8 s.
- **Captions are Baloo 2** on the game's paper card, like the screenshots.
  No prices, no ™ or ©, nothing a preview is not allowed to say.

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
video play by itself. The game's music is the studio's own (tools/music),
so it could be added without crediting anybody — only the muted autoplay
stands in the way.
