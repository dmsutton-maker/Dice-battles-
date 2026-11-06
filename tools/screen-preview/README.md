# Looking at a menu screen

Renders a real screen through `react-native-web`, at iPhone width, and
writes a PNG.

```sh
# CHROME_PATH=/path/to/chrome  # only if Playwright's own Chromium is not wanted
npm i --no-save --legacy-peer-deps \
  react-dom@19.1.0 react-native-web@0.19.13 playwright@1.49.0
npx esbuild tools/screen-preview/entry.tsx --bundle \
  --outfile=tools/screen-preview/bundle.js --loader:.tsx=tsx \
  --loader:.png=dataurl --loader:.jpg=dataurl --loader:.wav=dataurl \
  --loader:.mp3=dataurl --loader:.m4a=dataurl --loader:.ttf=dataurl \
  --alias:react-native=react-native-web \
  --define:process.env.NODE_ENV='"production"' --define:__DEV__=false
node tools/screen-preview/shoot.js /tmp/ladder.png
npm uninstall --no-save react-dom react-native-web playwright   # ← REQUIRED
```

## Take the three packages back out when you are done

Not optional, and not tidiness — the same trap as `tools/arena-preview`.
Expo infers that a project supports WEB from `react-dom` and
`react-native-web` being present in node_modules, and this game is
native-only on purpose (see AGENTS.md). Leave them installed and
`eas update` starts exporting a web bundle and the publish dies with a
message about the platforms array that has nothing to do with what you
changed.

## Why this exists

Built 27 Aug 2026, for the trophy ladder. By then the arenas could be
looked at (`tools/arena-preview`), the icons could be looked at
(`tools/icon-preview`), and a dice skin comes straight out of its painter
as pixels — the menus were the last visual thing in the project still
shipping on faith.

`react-native` is aliased to `react-native-web` at bundle time, so the
flex, border, radius and image rules a phone applies are the ones the
browser applies. It is not a mock-up of the screen; it is the screen's
own components with the real data behind them.

## What it renders

`entry.tsx` mounts one screen with plausible props. Change the import and
the props there to look at a different one. `?trophies=N` sets how far up
the ladder the player is, which is what decides the highlighted rung:

```sh
node tools/screen-preview/shoot.js /tmp/ladder-new.png     # a new player
```

## What it cannot tell you

It is a browser, not a phone. Fonts fall back to whatever the machine
has, the safe-area insets are not the device's, and anything driven by
native modules (Game Center, sound, haptics) reports itself unavailable.
Layout, colour, spacing and images are trustworthy; exact text metrics
are not. For the ones that matter, `tests/layout.test.ts` and
`tests/popupLayout.test.ts` measure the arithmetic directly.

## The App Store review screenshot for in-app purchases

`?screen=shop` draws the real money shelf. It needs two stand-ins that a
browser does not have — the purchase library and the audio module — and
two globals the Expo modules expect. Shoot at the iPhone's 3x, which is
the 1179 x 2556 App Store Connect asks for:

```sh
npx esbuild tools/screen-preview/entry.tsx --bundle \
  --outfile=tools/screen-preview/bundle.js --loader:.tsx=tsx \
  --loader:.png=dataurl --loader:.jpg=dataurl --loader:.wav=dataurl \
  --loader:.mp3=dataurl --loader:.m4a=dataurl --loader:.ttf=dataurl \
  --alias:react-native=react-native-web \
  --alias:expo-iap=./tools/screen-preview/stubs/expo-iap.js \
  --alias:expo-audio=./tools/screen-preview/stubs/expo-audio.js \
  --define:process.env.NODE_ENV='"production"' --define:__DEV__=false \
  "--banner:js=globalThis.process=globalThis.process||{env:{NODE_ENV:'production'}};globalThis.expo=globalThis.expo||{EventEmitter:class{addListener(){return{remove(){}}}removeAllListeners(){}emit(){}listenerCount(){return 0}},NativeModule:class{},SharedObject:class{},SharedRef:class{},modules:{}};"
```

then a Playwright page at 393 x 852 with `deviceScaleFactor: 3` on
`index.html?screen=shop`, saved to `store/iap-review-screenshot.png`.
A fresh browser has no install date stored, so the Starter pack shows,
as it does for a new player. Prices come from the stub, not Apple.
