# Redesign concept — working files

David asked on 24 Aug 2026 for mockups of a more modern interface,
saying the game "looks like a very old game from when the iPhone store
first came out". These are the source artboards behind the canvas at
https://claude.ai/code/artifact/5efb4ecf-55b5-45d0-81af-129067b200b7

| file | what it shows |
|---|---|
| `Today.dc.html` | The home screen AS IT IS, recreated honestly from the real styles |
| `Main.dc.html` | Direction A — "Deep Table". The leading candidate |
| `DirectionB.dc.html` | Direction B — "Paper & Ink" |
| `Store.dc.html` · `Result.dc.html` · `Battle.dc.html` | Direction A carried through three more screens |
| `canvas.json` | How they are laid out, and the notes beside them |

`Today.dc.html` is deliberately unflattering. A comparison against a
softened version of the present would be worthless — the point is to see
what is actually there. The five things dating it, in order of how loudly
they say 2010: emoji used as icons, saturated slab buttons at weight 900,
ALL CAPS with no hierarchy, no typeface at all, and flat panels with hard
borders.

**Nothing here has shipped.** These are mockups for deciding whether to
proceed, not a design system. If a direction is chosen, the order that
gets the most improvement for the least risk is icons first, then
typography, then surfaces.

The published canvas itself is not committed: it is 2.3MB of editor code
wrapped around these files, and is rebuilt from them whenever it changes.
