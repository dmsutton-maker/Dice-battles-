# The How to Play demo's artwork

## `hand.png`

The hand that flicks the dice on the "Throw the dice" page.

**Why this is a PNG when the rest of the interface is drawn in Views.**
Everything else the game draws — the icon set, the coin, the colourblind
shapes — is built from `View`s with border radii, because Views cost
nothing and ship over the air. A hand is the one thing that does not
survive that treatment. It is curves and overlapping masses, and the
first attempt at one from rounded rectangles was, in David's words on
26 Aug 2026, something that "does not look anything like a hand" — a
circle on a stick. `react-native-svg`, which would be the obvious answer,
is a NATIVE module and cannot be added without a new build.

A PNG has none of those problems: image assets are uploaded with an
`eas update` and downloaded by the app like any other asset, so this
ships over the air exactly as the JavaScript does.

**It is generated, not drawn by hand.** `make-hand.py` builds it, and the
important part of that script is how the outline is produced: every mass
of the hand — palm, extended finger, three curled fingers, thumb — goes
into ONE mask, and the ink line is taken by dilating that mask and
subtracting it. The first version outlined each mass separately, so the
lines ran straight through each other and the result read as a heap of
lozenges rather than a hand. Interior creases are drawn back in
afterwards, clipped to the inside of the silhouette.

To change it:

```
python3 assets/tutorial/make-hand.py
```

Check it at the size it is actually used — about 70pt tall inside a 165pt
stage — and not only at full resolution. That was the other half of the
same mistake.

## The arena is NOT here

The mini battlefield on that page is drawn in Views, in
`src/demo/ThrowDemo.tsx`, from colours sampled out of a real screenshot
of the game (`hq/public/images/game-screenshot-1.jpeg`). It stays code so
it can hold the live prisoner colours and animate one of them out of the
jail — and so it cannot quietly disagree with the game about what a
prisoner colour looks like.
