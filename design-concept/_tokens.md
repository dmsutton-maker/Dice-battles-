# Paper & Ink — the token pair

The direction's character comes from SHAPE, not light: a 2px outline and
a hard offset shadow, so every card reads as a physical piece sitting on
a table. That is why it inverts cleanly — flip the ground and the ink,
keep the geometry, and it is the same design at night.

| token | light | dark | note |
|---|---|---|---|
| `ground` | `#fdf6ec` | `#15131c` | warm cream / warm near-black, never blue-grey |
| `surface` | `#ffffff` | `#262231` | the card |
| `sunk` | `#efe4d4` | `#1c1926` | inset tracks, segmented controls |
| `ink` | `#1d1a2e` | `#f6efe4` | text, and the outline in light mode |
| `ink-soft` | 60% ink | 55% ink | secondary text |
| `line` | `#1d1a2e` | `#413b52` | the 2px outline |
| `line-loud` | `#1d1a2e` | `#f6efe4` | the outline on things that matter |
| `drop` | `#1d1a2e` | `#08070c` | the hard offset shadow |
| `accent` | `#d2451e` | `#ff6a3d` | the one primary action |
| `gold` | `#ffd21f` | `#ffcf2e` | selected state, coins |

Two things deliberately do NOT flip:

- **The six prisoner colours.** They are the game's signal. Shifting them
  by theme would mean a match looks different at night, which is the one
  thing that must never be true.
- **The geometry.** Same radii, same 2px line, same 4px drop. A dark mode
  that also restyles the shapes is a second design to maintain.
