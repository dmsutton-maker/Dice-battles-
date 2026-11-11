# Paper & Ink — the chosen direction

David picked Direction B on 24 Aug 2026 and asked for it in light and
dark. Canvas:
https://claude.ai/code/artifact/5efb4ecf-55b5-45d0-81af-129067b200b7

## Both modes come from ONE drawing

`_build.py` writes each screen once with token names in the markup and
emits it twice against the palettes in `_tokens.md`. The `.dc.html` files
are BUILD OUTPUT — edit the builder, not them.

That is not tidiness for its own sake. Hand-drawing a second set is how a
dark mode drifts: someone nudges a radius in light, forgets the dark
file, and six months later they are two designs that have to be fixed
twice. Here they cannot disagree.

```
python3 _build.py     # rewrites all six .dc.html files
```

## Why this direction inverts cleanly

Its character comes from SHAPE, not light — a 2px outline and a hard
offset shadow, so every card reads as a physical piece on a table. Flip
the ground and the ink and the geometry still works. A glassy,
light-dependent direction would have needed rebuilding from scratch.

## Two things deliberately do not flip

- **The six prisoner colours.** They are the game's signal. If a match
  looked different at night, the one rule of the game would change with
  the time of day.
- **The geometry.** Same radii, same 2px line, same 4px drop, both modes.

## Checked, not assumed

Every text-on-surface pair in both themes clears WCAG AA at 4.5:1 — the
tightest is white on the accent at 4.55:1, and that text is 21px bold, so
the large-text rule applies with room to spare. Inverting a light design
by swapping tokens is exactly where text quietly stops being readable, so
this is measured rather than eyeballed.

## Still open

- Does the theme follow the phone's own light/dark setting, or is it a
  switch in Settings? Following the phone with an override is the usual
  answer and the one I would take.
- The battle screen is not drawn: its chrome is two score pills and a
  hint line, and the screen is almost entirely the 3D board, which does
  not change with the theme.

**Nothing here has shipped.** If we proceed, the order that buys the most
for the least risk is icons first, then typography, then surfaces.
