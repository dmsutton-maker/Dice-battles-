# Board redesign — October 2026

Request (18 Oct 2026): "relook at all the boards and dice and make them
better looking with better graphics. Make sure each board looks totally
different don't just make different color castles. And make sure each
trap matches its board name and board matches its name."

The brief arrived written for Swift / SpriteKit. This game is Expo +
React Native + @react-three/fiber + cannon-es and stays that way
(AGENTS.md). Its four principles are applied in this stack:

| Brief                       | Here                                                                 |
|-----------------------------|----------------------------------------------------------------------|
| Retina grid (8/16/24 pt)    | World units snap to a 0.125 grid for trim, posts and props; UI keeps the existing 4/8/16/24 spacing in `src/ui/theme.ts`. |
| Cinematic colour            | Every board has a 5-role palette: `base` (floor), `surface` (walls), `accent` (trim / signature), `glow` (emissive), `shadow` (depths). No pure primaries (#ff0000, #00ff00, #0000ff, #ffff00). |
| Haptics + micro-animation   | A trap event (die into the pit, die off the bump) gets an `expo-haptics` tap and a short spring on the trap itself. |
| Parallax + layering         | Far backdrop (sky / horizon band) → midground scenery outside the tray → play tray (floor, walls, jail, traps) → HUD. |

## What was wrong

Seen side by side (renders in `/tmp/claude-0/arenas-before/`):

1. **Every board is the same object.** Same rectangular tray, same thin
   black railing for the jail at the top, same corner posts, same row of
   pads. Mostly the colour changes.
2. **Two boards literally borrow another's look.** Sky Kingdom uses castle
   `battlement` walls; Frozen Lights uses the Space Station's `station`
   walls.
3. **Every trap is the same two shapes.** The bump is a plain sphere and
   the pit a flat square; only the colour changes. "Lava" on Volcano Rim
   is an orange square, the Moon Base "boulder" is a grey ball.

## The rule for every board

From the camera, with the colour turned off, you can still tell which
board it is. That means each board owns a different **shape language**
for its four big pieces:

- **Floor** — what you are standing on (pattern AND relief, not a tint).
- **Walls** — the tray's sides: their silhouette, not their colour.
- **Jail** — the pen at the top where prisoners wait. Never the shared
  black railing again.
- **Traps** — the bump and the pit, named and drawn as the board's own
  hazards.

## Physics that must not change

The bump is a cannon sphere of radius `MOUND.radius` buried
`MOUND.buried` (visible dome 0.47 high, 1.05 radius); the pit is a
`MOAT.size` (2.0) square hole. Dressing may sit ON the dome or AROUND the
hole, but anything a die can touch must stay inside the dome's
silhouette, and nothing may hang over the pit opening below die height
(0.3). Decoration above the dome top is fine — dice never get there.

## Board by board

| Board | Floor | Walls | Jail | Bump | Pit |
|---|---|---|---|---|---|
| Castle Courtyard | worn flagstones | crenellated grey stone, pennants | iron portcullis gatehouse | grassy hill with a little pennant | moat pond: stone kerb, lily pads |
| Sunset Castle | cobbles in lantern pools, long shadows | broken ivy-covered ruin wall, lit braziers | timber stockade gate with two torches | ivy-covered rubble heap | reflecting pool with floating candles, sunset-orange sheen |
| Jungle Clearing | leaf-litter earth with roots | lashed bamboo poles with vines | bamboo cage with vine knots | mossy fallen log stump | muddy lake, lily pads, reeds at the bank |
| Space Station | lit deck plates, hazard chevrons | hull plating with light strips | glowing force-field cell | bulkhead dome with a blinking beacon | open airlock hatch: yellow/black stripes, stars below |
| Desert Dunes | rippled sand | sandstone adobe, rounded tops | adobe hut with timber bars | sand dune with a small cactus | quicksand: slow tan swirl |
| Autumn Woods | leaf carpet (reds, ambers) | split-rail log fence | log-cabin pen | leaf pile | rain puddle with floating leaves |
| Frozen Lights | cracked blue ice, aurora reflection | stacked translucent ice blocks | icicle cage | snow-capped ice boulder | ice-fishing hole, dark water, crack ring |
| Crystal Cavern | dark rock with glowing crystal veins | stalagmite rows | crystal-shard cage | crystal cluster | glowing chasm, violet light rising |
| Sky Kingdom | cloud floor with gilded paving stones | gold balustrade on cloud puffs | golden birdcage | big puffy cloud | gap in the clouds: tiny fields far below |
| Moon Base | grey regolith, footprints, small craters | habitat modules / regolith berms | airlock pod | moon boulder | impact crater with a raised rim |
| Snowy Hollow | fresh snow with sled tracks | snowbank with a wooden snow-fence | igloo | snowman (body on the dome) | frozen pond, cracked ice |
| Volcano Rim | black basalt with glowing lava seams | basalt columns | obsidian cage with ember glow | smoking rock | lava pool: glowing, slow bubbling |
| Sunny Farm | ploughed rows / straw | white picket fence | red chicken coop | haystack | mud puddle |
| Treasure Beach | sand with shells and footprints | driftwood stakes and rope | wooden treasure chest, lid open | sandcastle | tide pool with a starfish |
| Candy Meadow | chocolate-bar squares | candy canes and gumdrops | gingerbread house | big gumdrop | chocolate fondue pool |
| Glow Glade | dark moss with glowing spores | mossy stones with glow mushrooms | woven willow-root cage | giant glowing mushroom | glowing spring |
| Pirate Cove | ship's deck planks with nails | ship's rail and rigging | brig with iron bars | barrels and a treasure pile | open cargo hatch onto the sea |
| Coral Reef | sea-floor sand with light ripples | coral heads | giant clam | anemone rock | whirlpool |
| Rooftop City | roof tar with gravel and vents | parapet with AC units | fire-escape cage | air-conditioning unit | open skylight, light glowing up |
| Toy Room | carpet / playmat | building-block wall | toy chest | beach ball | open toy box |

## Dice

Dice stay ivory rounded cubes with a colour sticker per face (faces are
COLOURS, never pips — AGENTS.md). Better looks within that:

- The body is **unlit on purpose** (repeated on-device reports of one die
  turning beige under identical lit materials — see `DieMesh.tsx`). So
  shading is BAKED, not lit: a subtle edge-darkening / top-light gradient
  in the body texture gives form without turning lighting back on.
- Stickers get a thin bevel ring and a soft inner highlight so they read
  as inset, not painted.
- Pattern skins (`patterns.ts`) get crisper edges at the shelf/preview
  sizes.
