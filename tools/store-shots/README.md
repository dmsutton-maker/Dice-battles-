# App Store screenshots

Builds the five 1290 × 2796 screenshots in `store/screenshots/`, which is
the size Apple currently asks for (iPhone 6.9").

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

Every number on these has to be true on the day they are uploaded, and
they are checked against the code rather than remembered:

- **20 battlefields** — `Object.keys(ARENAS).length`
- **53 dice sets** — `DICE_SKINS.length`
- **4 ways to play** — `MODE_ORDER.length`

If a release changes any of those, the screenshot is wrong and has to be
rebuilt before the next submission. Apple treats a misleading screenshot
as grounds for rejection, and it would be true even if they did not.

## What these deliberately do not do

No fake iPhone status bar, no invented five-star reviews, no
before-and-after, no screenshot of a screen that does not exist in the
app. Everything claimed here is something the game does.
