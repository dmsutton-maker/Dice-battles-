# Looking at the arenas

Renders any themed battlefield in a real browser, through the real
`ThemedArena` component and the real `fitCamera`, at iPhone dimensions,
and writes a PNG.

```sh
npm i --no-save --legacy-peer-deps react-dom@19.1.0 playwright@1.49.0
npx esbuild tools/arena-preview/entry.tsx --bundle \
  --outfile=tools/arena-preview/bundle.js --loader:.tsx=tsx \
  --define:process.env.NODE_ENV='"production"'
node tools/arena-preview/shoot.js autumn volcano city   # → /tmp/arena-<id>.png
TOP=1 node tools/arena-preview/shoot.js volcano        # straight down
node tools/arena-preview/audit.js                      # measure all sixteen
npm uninstall --no-save react-dom playwright           # ← REQUIRED, see below
```

## Take the two packages back out when you are done

Not optional, and not tidiness. Expo infers that a project supports WEB
from `react-dom` being present in node_modules, and this game is
native-only on purpose (see AGENTS.md). Leave it installed and
`eas update` starts exporting a web bundle, fails to find
`react-native-web`, and the publish dies with a message about the
platforms array that has nothing to do with what you changed. That
happened the first time this tool was used.

`--no-save` keeps package.json and the lockfile clean either way; it is
the contents of node_modules that Expo sniffs.

## Why this exists

Everything in this folder is here because of one afternoon, 26 Aug 2026,
when three separate rounds of arena work shipped without anyone being
able to see the result.

The first shipped two hundred props that were outside the camera and had
never once been on screen. The second replaced them with a "horizon
bank" — a squashed sphere of radius 7.5 at z -10.4 — which, had anybody
done the arithmetic, reaches forward to z -2.9 and stands 3.3 high
against a 1.4 wall. David's entire review of it was "what is this giant
blob". Both changes passed a typecheck, a full test suite and a Metro
bundle check, because none of those can see a picture.

The tests measure what can be measured — that a prop projects inside the
frame, that no two floors are alike, that nothing is the size of a
landscape. They cannot tell you a toadstool reads as a pale dome or that
a night rig is two stops under. Somebody has to look, and until this
existed nobody could.

## What it is NOT

It is not the game. It renders the arena component and a light rig; it
has no dice, no prisoners, no physics and no HUD. Metro is told to
ignore this folder (see metro.config.js) and `react-dom` is installed
on demand rather than added to package.json, both for the same reason:
nothing in here may ever end up in the phone build.

## audit.js — measuring whether a wall is decorated

**Run this after touching anything on the top of a tray wall.**

Marc, 27 Aug 2026: "in volcano rim you didn't put the orange rocks
around the entire wall, just on half of it. All these things have to go
around the entire wall."

He was right three times over, and the reason it kept happening is that
"does the crest go all the way round" had never been measured. The unit
tests can check where a piece is *placed*; they cannot see that the piece
was buried under a slab of snow (the Snowy Woods), laid crossways (the
Dune Fort, Sunny Farm, Palm Cove), or drawn in a colour two shades off
the wall behind it (Rooftop City). All of those were shipping, and all of
them passed `npm test`.

So `audit.js` reads the render. It draws each battlefield from straight
down, walks the middle of each of the four walls in screen space using
the very camera that drew it, and reports the light-to-dark range along
each one:

```
✓ volcano  left 105  right 105  near 87  far 92
✗ volcano  left 105  right 65   near 104 far 64     ← the bug Marc found
```

Two things fail it, and both were chosen by testing them against faults
that really happened rather than by taste:

- **A bare wall** — under 18 of range, which is what a plain kerb reads
  as. The Snowy Woods' buried fence measured 8.
- **Walls that do not match the one opposite** — the long walls to 0.75,
  the short ones to 0.45. Opposite walls of a tray are mirror images, so
  a gap between them means one side got dressed and the other did not.
  Every "it only goes round half of it" fault this project has had shows
  up here.

Reverting the crest ring to the order it had before v1.60.1 makes it flag
Volcano Rim, Frozen Lights and Crystal Cavern, and nothing else — that
check is worth repeating if the thresholds are ever moved.

It also prints an evenness reading per wall under "worth looking at".
That one is **not** a pass/fail: it samples a single line at one height,
and a piece taller than that line shifts off the line as it projects, so
the number dips where nothing is missing. Look at the render when it
dips; do not quote it as proof.
