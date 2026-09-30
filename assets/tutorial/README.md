# The How to Play demo's artwork

## `finger.png`

The finger that flicks the dice on the "Throw the dice" page.

**Why this is an image when the rest of the interface is drawn in Views.**
Everything else the game draws — the icon set, the coin, the colourblind
shapes — is built from `View`s with border radii, because Views cost
nothing and ship over the air. This is the one thing that does not
survive that treatment, and it took three tries to admit it:

1. A fingertip built from two rounded rectangles. David, 26 Aug 2026:
   "does not look anything like a hand." It was a circle on a stick.
2. A drawn cartoon hand — palm, curled fingers, thumb, ink outline. Real
   enough as a drawing, but David asked instead for "a real looking
   finger", and he was right that it is the better object: what you see
   of your own hand on the glass IS a fingertip, and a whole hand at this
   size was mostly knuckles taking up the arena.
3. This one, shaded rather than outlined.

`react-native-svg`, the obvious answer, is a NATIVE module and cannot be
added without a new build. An image has none of those problems: assets
are uploaded with an `eas update` and downloaded by the app like any
other, so this ships over the air exactly as the JavaScript does.

**It is generated, not painted.** `make-finger.py` builds it numerically,
and what makes it read as real rather than drawn is entirely shading:

- cylindrical shading across the width, with the highlight band slightly
  off the centre line — a finger is a cylinder, lit from one side
- **no outline at all.** The edge is a darker skin tone. A black keyline
  is the single thing that makes something look drawn
- the tip flushed redder, the way a pressed fingertip is
- a real nail: pink bed, white free edge, pale lunula at the base, and
  one specular streak, which is the most recognisable thing about a
  finger at a glance
- a soft contact shadow, so it sits ON the glass rather than over it
- a **true semicircular dome** for the tip. The first version tapered the
  width to zero and drew a pencil point, which was the biggest single
  thing stopping it reading as a finger
- the base fades out over the last stretch of the canvas, so the finger
  RECEDES instead of ending in a hard horizontal cut across the arena

To change it:

```
python3 assets/tutorial/make-finger.py     # writes finger.png, preview in /tmp
```

Judge it at the size it is actually used — about 104pt tall inside a
168pt arena — and on the arena floor colour, not on white. The preview
sheet does both. Checking artwork only at full resolution is how the
first two versions got shipped.

## The arena is NOT here

The mini battlefield on that page is drawn in Views, in
`src/demo/ThrowDemo.tsx`, from colours sampled out of a real screenshot
of the game (`hq/public/images/game-screenshot-1.jpeg`). It stays code so
it can hold the live prisoner colours and animate one of them out of the
jail — and so it cannot quietly disagree with the game about what a
prisoner colour looks like.
