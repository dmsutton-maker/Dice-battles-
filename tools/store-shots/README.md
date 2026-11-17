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
# CHROME_PATH=/path/to/chrome  # only if Playwright's own Chromium is not wanted
npm i --no-save --legacy-peer-deps react-dom@19.1.0 playwright@1.49.0
mkdir -p /tmp/fonts && cd /tmp/fonts \
  && curl -s -o baloo-800.ttf  "https://fonts.gstatic.com/s/baloo2/v23/wXK0E3kTposypRydzVT08TS3JnAmtdj9yqpv.ttf" \
  && curl -s -o nunito-900.ttf "https://fonts.gstatic.com/s/nunito/v32/XRXI3I6Li01BKofiOc5wtlZ2di8HDDsmRTM.ttf"
cd - && npx esbuild tools/store-shots/entry.tsx --bundle \
  --outfile=tools/store-shots/bundle.js --loader:.tsx=tsx \
  --loader:.png=dataurl --loader:.jpg=dataurl \
  --alias:@react-three/fiber/native=@react-three/fiber \
  --define:process.env.NODE_ENV='"production"'
node tools/store-shots/shoot.js              # every render in shots.json → $SHOTS_TMP
npx tsx tools/store-shots/dice-grid.ts        # the dice-set cards → $SHOTS_TMP/cards
python3 tools/store-shots/build-shots.py      # → store/screenshots/{iphone,ipad}
npm uninstall --no-save react-dom playwright   # ← REQUIRED, see arena-preview/README.md
```

`$SHOTS_TMP` defaults to `/tmp/store-shots`. `shoot.js hero cup` renders
only those; `SHOTS_JSON=other.json` tries a camera out without touching
`shots.json`. If Playwright cannot find its browser, set `CHROME_PATH`.

## The set (rebuilt 5 Nov 2026)

David approved a rebuild against Apple's asset best practices on
5 Nov 2026. The boards now fill everything from the headline down
instead of sitting under half a screen of empty sky: each one is rendered
at the size of that box (1290 × 2240 for the phone, 2048 × 2040 for the
iPad, the iPad renders named with a `W`) with a closer, wider camera, and
its top melts into the backdrop.

| # | kicker | headline | picture |
|---|---|---|---|
| 01 | Two dice. Six colors. | MATCH THEM, SET ONE FREE | Crystal Cavern, Ivory dice mid-roll |
| 02 | Play online | BATTLE REAL PLAYERS | Pirate Cove, Neon against Galaxy |
| 03 | Earn them or buy them | COLLECT DICE AND BATTLEFIELDS | dice-set cards, then Candy Meadow, Toy Room, Dino Valley |
| 04 | New dice. New battlefields. | A NEW SEASON EVERY MONTH | Volcano Rim with the Fire die, Snowy Hollow with the Ice die, one board split |
| 05 | Win coins and trophies | A NEW CUP EVERY WEEK | Sky Kingdom, Gold dice |
| 06 | Two players, one screen | PUT THE PHONE BETWEEN YOU | Sunny Farm, the top half turned round |

Dropped in that rebuild: NOTHING TO READ (01 already says six colours),
FOUR WAYS TO PLAY and BATTLEFIELDS TO UNLOCK (folded into 03). Online
play (`matchSearch.ts`, from 100 trophies), the monthly season
(`seasonPass.ts`) and the weekly cup (`cupRotation.ts`) were the biggest
things the old set did not show.

**The dice grid is only dice a player can get today** (`GRID_DICE` in
`dice-grid.ts`, which refuses anything else): never a `retired` die — the
ball dice Marc took off the shelf in November 2026 — never the cup-only
Amethyst, and no season pass dice, because those leave the pass when
their season ends and a screenshot outlives a season.

**04 shows Season 1's items** (Fire & Ice, October–November 2026). Its
words name no season, so they stay true, but from December the picture
is last season's: rebuild it with the running season's dice and
battlefields when the screenshots are next submitted.

Fire and Ice are drawn with their real effects (`dieEffect.ts`), run for
a moment of flight in `entry.tsx` so the flames and mist are in the air.

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
COLLECT DICE AND BATTLEFIELDS. That stays true whether the next release
adds four arenas or none. The same goes for the online shot: it says
REAL PLAYERS, not a trophy count, because the threshold is one constant
in `matchSearch.ts` that could move any day.

(FOUR WAYS TO PLAY was the one number kept on purpose, the modes being
the game's structure rather than a collection that grows. That shot was
dropped in the November 2026 rebuild to make room for online play.)

Apple's rules on top of Marc's: no ™, © or prices, no awards, no URLs,
no other platforms, and nothing that is not 4+.

## What these deliberately do not do

No fake iPhone status bar, no invented five-star reviews, no
before-and-after, no screenshot of a screen that does not exist in the
app. Everything claimed here is something the game does.
