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
```

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
