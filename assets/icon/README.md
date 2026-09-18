# The app icon

`light.png`, `dark.png` and `tinted.png` are the three variants iOS asks
for on the Customize screen, wired up in `app.json` under `ios.icon`.

They are GENERATED, not hand-drawn — the script that makes them lives in
the commit that added them. Redrawing by hand and re-exporting is how the
three drift apart.

## Why each one is built the way it is

Expo's prebuild decides this, not us
(`@expo/prebuild-config/build/plugins/icons/withIosIcons.js`):

| variant | what Expo does | so the file must be |
|---|---|---|
| light  | strips transparency, flattens on white | opaque, carrying its own cream ground |
| dark   | **preserves** transparency | artwork only — iOS draws the dark backdrop itself |
| tinted | strips transparency, flattens on white | greyscale on a light ground |

Shipping an opaque dark icon would double up the backdrop; shipping a
transparent light one would put the dice on white instead of paper.

## Liquid Glass

`layers/` holds the same drawing split into background, dice and colour
bar as separate transparent PNGs. That is the input Apple's **Icon
Composer** takes.

Liquid Glass is NOT something a flat PNG can have. iOS gives every icon
the system shape, but the depth — the specular highlight and the
refraction as the icon tilts — is rendered from LAYERED artwork in a
`.icon` bundle, and `.icon` bundles are produced by Icon Composer, which
is a macOS app that ships with Xcode. It cannot be generated here.

To upgrade:

1. Open Icon Composer on a Mac (Xcode → Open Developer Tool).
2. New icon, then drag in `layers/1-background.png`,
   `2-dice.png`, `3-colour-bar.png` — bottom layer first.
3. Let it generate the dark and tinted appearances from those layers.
4. Export `DiceBattles.icon` into this folder.
5. Point `app.json` at it: `"ios": { "icon": "./assets/icon/DiceBattles.icon" }`,
   replacing the three-variant object. SDK 54 accepts a `.icon` directory.

Until then the three PNGs are correct and complete — they just do not
glass.
