# The battlefield pictures

One per arena, shown in the Inventory. They replaced emoji — 🏰 🌅 🌴 🚀 —
the last four left in the interface after the Paper & Ink pass took them
out of everywhere else.

David asked on 26 Aug 2026 for hand-drawn pictures, "detailed enough to
be distinct and accurate". The emoji failed both halves at once:

- **Not distinct.** 🏰 and 🌅 are the same building in this game, so the
  Castle and the Sunset Castle told a player nothing about which was
  which. That exact complaint has already been raised once about the
  arenas themselves ("the sunset castle doesn't really look any different
  from the regular castle"), so it was a repeat, not a nitpick.
- **Not accurate, or even fixed.** An emoji renders differently on every
  phone and every iOS version, so the menu could not be sure what its own
  battlefields looked like.

## Accurate

Every colour is lifted out of the arena it draws — `src/arena/*.tsx` and
a real screenshot of the game. The castle's roofs are `#ff7f66` because
that is what the roofs are; the jungle's water is `#7fceb0`; space is
`#0a0e2a` with `#3ff2ff` neon. A test fails if those drift apart.

## Distinct

Measured, not eyeballed: the test compares the hue distribution of every
pair and requires them a third of the way apart or better. The closest
pair is the Castle and the Jungle at 0.59; the two castles, which share a
building, come out 0.77 apart because the difference is carried by what
actually differs when you stand in them — a low huge sun instead of a
high small one, warm masonry, lit windows, and long shadows thrown toward
the viewer.

## Drawing them

```
python3 assets/arenas/make-arenas.py     # writes the four PNGs, preview in /tmp
```

The preview sheet shows each one big AND at **58pt**, which is the size
the Inventory actually draws them. Judge them small. Anything finer than
about three chunky shapes disappears at that size, which is why these are
scenes rather than diagrams — and why the first jungle, whose palm fronds
were flat quadrilaterals, read as a windmill and had to be redrawn with
real leaf shapes.

Drawn at 6× and shipped at 3×, which is the densest screen Apple ships.
