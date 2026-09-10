# Looking at the menus on a folding phone

Renders the real menu screens and the real bottom navigation through
`react-native-web`, at the iPhone Duo's exact point sizes, and writes a
PNG per screen per shape.

```sh
CHROME_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome  # container only
npm i --no-save --legacy-peer-deps \
  react-dom@19.1.0 react-native-web@0.19.13 playwright@1.49.0
npx esbuild tools/duo-preview/entry.tsx --bundle \
  --outfile=tools/duo-preview/bundle.js --loader:.tsx=tsx \
  --loader:.png=dataurl --loader:.jpg=dataurl --loader:.wav=dataurl \
  --loader:.mp3=dataurl --loader:.m4a=dataurl --loader:.ttf=dataurl \
  --alias:react-native=./tools/duo-preview/rn.ts \
  --define:process.env.NODE_ENV='"production"' --define:__DEV__=false
mkdir -p /tmp/duo
node tools/duo-preview/shoot.js inventory,store,leaderboard folded,unfolded,iphone /tmp/duo
npm uninstall --no-save react-dom react-native-web playwright   # ← REQUIRED
```

## Take the three packages back out when you are done

Not optional, and not tidiness — the same trap as `tools/screen-preview`
and `tools/arena-preview`. Expo infers that a project supports WEB from
`react-dom` and `react-native-web` being present in `node_modules`, and
this game is native-only on purpose (see AGENTS.md). Leave them installed
and `eas update` starts exporting a web bundle and the publish dies with
a message about the platforms array that has nothing to do with what you
changed.

## Why this exists

v1.72.0 adapted the whole layout to Apple's folding iPhone the day it was
announced, entirely by reasoning, and said so plainly: *"there is no
folding phone in CI and no renderer in this suite... whether it LOOKS
right has to be seen."* Nobody has a Duo, and the container this work
happens in is Linux, so there is no Xcode simulator either.

The first pictures it produced earned their keep immediately. Every card
grid was `width: '31%'`, which on a 640pt unfolded screen is a 190pt card
with a 58pt thumbnail marooned in the middle of it — twelve items on a
screen with room for twenty. That is now `gridRules.ts`, and it is the
kind of fault no amount of reasoning finds, because the code was doing
exactly what it said.

## The viewport IS the phone

`shoot.js` sets the browser viewport to 474x696 or 640x904 and screenshots
without `fullPage`. Both halves matter. The viewport size is what
`useWindowDimensions` reports, which is what every layout rule in the game
keys off — so the page is not scaled to look like a Duo, it is laid out as
one. And a full-page shot would grow to fit the content, hiding the one
thing being checked: what does and does not fit on a screen.

`rn.ts` forces `Platform.OS` to `'ios'`. Under react-native-web the honest
answer is `'web'`, which sends `bottomInsetFor` down the 12pt Android
gesture-bar branch instead of the 34pt iPhone indicator — a preview that
drew the tab row 22pt lower than the phone will is worse than no preview.

## What it cannot show

The battlefield. That is a GL canvas and there is no `expo-gl` in a
browser; the camera framing at these aspect ratios is pinned by
`tests/foldable.test.ts` instead. The shared HUD is not mounted either,
so the space above each title is emptier here than on the phone. Fonts
are the browser's rather than the phone's, so read text as roughly, not
exactly, the width it will be.
