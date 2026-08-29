# App Store screenshots

Builds six screenshots in two device shapes, into
`store/screenshots/iphone/` and `store/screenshots/ipad/`.

| folder | size | what it is |
|---|---|---|
| `iphone/` | 1290 × 2796 | iPhone 6.9" |
| `ipad/` | 2048 × 2732 | iPad 12.9"/13" |

Both are sizes App Store Connect accepts, but Apple moves the goalposts —
1320 × 2868 and 2064 × 2752 are also current — so **check the sizes
App Store Connect asks for on the day you upload** rather than trusting
this table. Changing them is one edit to `DEVICES` in `compose.py`; the
layout is written against the canvas, not against fixed numbers.

## The two shapes are not one picture scaled

An iPad is 1.59× the phone's width and almost exactly its height (2732
against 2796). Scaling the art by the width ratio therefore overflows the
bottom, which is what the first iPad pass did to the dice grid and the
arena tiles. Anything that has to fit whole is fitted to a BOX — width and
height both — rather than to a scale factor. The board shots still bleed
off the sides on purpose.

```sh
npm i --no-save --legacy-peer-deps react-dom@19.1.0 playwright@1.49.0
mkdir -p /tmp/fonts && cd /tmp/fonts \
  && curl -s -o baloo-800.ttf  "https://fonts.gstatic.com/s/baloo2/v23/wXK0E3kTposypRydzVT08TS3JnAmtdj9yqpv.ttf" \
  && curl -s -o nunito-900.ttf "https://fonts.gstatic.com/s/nunito/v32/XRXI3I6Li01BKofiOc5wtlZ2di8HDDsmRTM.ttf"
cd - && npx esbuild tools/store-shots/entry.tsx --bundle \
  --outfile=tools/store-shots/bundle.js --loader:.tsx=tsx \
  --loader:.png=dataurl --loader:.jpg=dataurl \
  --alias:@react-three/fiber/native=@react-three/fiber \
  --define:process.env.NODE_ENV='"production"'
node tools/store-shots/shoot.js '[{"name":"sky","w":1600,"h":1500,"arena":"sky","skin":"ivory","dist":16,"pitch":0.72,"yaw":0.30}, ...]'
# the iPad board shots want wider renders (…W) — see SHOTS in build-shots.py
npx tsx tools/store-shots/dice-grid.ts
python3 tools/store-shots/build-shots.py
npm uninstall --no-save react-dom playwright   # ← REQUIRED, see arena-preview/README.md
```

Baloo 2 and Nunito are SIL Open Font License, which permits commercial
use. They are fetched rather than committed.

## What is real and what is not

**Everything inside the frame is the game.** The board is the same
`ThemedArena` the player stands on, the figures are the same `Prisoners`,
the dice are `DieMesh` wearing a real skin from `diceSkins.ts`, and the
dice-set grid is painted by the same `patterns.ts` painter that paints
them in play. Nothing is drawn to look like the game.

The two-player shot is the exception that proves the rule: its LAYOUT is
literally the feature. `TwoPlayerScreen.tsx` puts the phone flat on the
table and rotates the top half 180° so it faces the player sitting
opposite, and the screenshot shows exactly that — two boards, the far one
upside down. Turning it is not a flourish.

**The camera is not.** The game looks almost straight down, because that
is the only way a 5.6 × 10.2 tray fits a phone (see `cameraFit.ts`) — and
straight down is the least flattering angle there is. `entry.tsx` takes
the same scene from a low raking three-quarter view, which is the whole
trick: the walls get height, the dice get solidity, and the board stops
reading as a diagram.

The frame around it — the lit backdrop, the headline, the drifting
colour dots — is `compose.py`, built from the game's own palette: cream
`#fdf6ec`, ink `#1d1a2e`, accent `#d2451e`, and the six face colours that
ARE the game.

## Rules for the copy

**No countable claims.** Marc, 29 Aug 2026, on a first pass that said
TWENTY BATTLEFIELDS and FIFTY-THREE DICE SETS: "don't say exactly how
many arenas or dice we have so we can keep expanding."

He is right, and it is worth writing down why, because a specific number
is genuinely tempting — it is concrete, it sounds impressive, and it was
true on the day. It is also a promise that goes stale the moment the
game grows, and a screenshot cannot be corrected without a new
submission. Apple treats a screenshot that overstates the app as grounds
for rejection, and one that UNDERSTATES it just sells the game short for
however many months pass before the next release.

So the copy names the KIND of thing and not the quantity of it:
BATTLEFIELDS TO UNLOCK, DICE SETS TO COLLECT. Both stay true whether the
next release adds four arenas or none.

FOUR WAYS TO PLAY stays a number on purpose. The modes are the game's
structure rather than a collection that grows — they are named in the
description, the tutorial and the mode picker — so if a fifth ever ships
it is a change big enough that the screenshots would be rebuilt anyway.

## What these deliberately do not do

No fake iPhone status bar, no invented five-star reviews, no
before-and-after, no screenshot of a screen that does not exist in the
app. Everything claimed here is something the game does.
