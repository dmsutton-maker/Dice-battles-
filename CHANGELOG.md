# Changelog

## v1.63.0 — 2026-08-28 · chosen by Marc

Marc, picking two directions off the design canvas: "I like the
FloorGeode for the floor of the crystal cavern and the CrestCluster for
the wall toppers."

### Changed
- **The Crystal Cavern's floor IS the crystal now**, rather than rock
  with crystal lying on it: the inside of a cracked geode, cut facets
  meeting edge to edge with nothing between them, about a third of them
  gemstone and the rest the cavern's own violet rock.

  The facets come from a jittered Voronoi — for each texel, the nearest
  of nine candidate sites owns it. Voronoi cells are convex polygons that
  tile without gaps, which is exactly what a cut surface is, so every
  edge falls out of the distances rather than being drawn: `d2 - d1`, the
  gap between nearest and second-nearest site, is small only along a
  boundary, and the bright seam is that number ramped.
- **The wall carries crystal clusters**, not single studs. A crystal does
  not grow one to a spot; it grows from a common root, several six-sided
  prisms of different heights splaying outward, tallest in the middle.
  Every rim spot gets one, so the wall is crystal the whole way round.

### Fixed
- **The ground outside the tray stayed rock, and had to be made to.**
  One painter draws both surfaces, so the first build turned the entire
  screen into crystal facets and the board stopped reading as a board in
  the middle of it. A painter is now told which surface it is drawing;
  fifteen of the sixteen ignore it and make both from the same rock, and
  the cavern uses it to keep its scenery quieter than its floor.
- **Most of a wall cluster is coloured crystal**, after the first attempt
  used the wall's own cap stone for four prisms in five. Cap is a dark
  violet a shade off the wall itself, so the clusters came out as dark
  studs on a dark wall and the ring read as gravel from above.

### Added
- **The pixel fingerprint now covers both surfaces**, floor and ground.
  Splitting the painter in two gave every structure a second behaviour,
  and pinning only the floor would have left half of each one unwatched —
  which is the gap that test exists to close.

## v1.62.3 — 2026-08-28 · reported by Marc

Marc: "have both the castle courtyard and ivory dice be highlighted on
the ladder at the beginning."

### Fixed
- **A new player was shown standing on one free rung instead of two.**
  The ladder marks where you are by comparing each rung against your
  league, and a league is a single tier — the last one you have reached.
  Two rungs are free and both sit at 0 trophies, so at the start Ivory
  Dice was marked YOU and Castle Courtyard looked like something still to
  earn, when you own both from the first launch.

  The rung you are on is picked by THRESHOLD now rather than by identity,
  so every rung at the number you are standing on lights up. A test pins
  that the two free rungs really are the only pair sharing a threshold —
  a tie anywhere else on the ladder would light two rungs at once for a
  reason nobody intended.

## v1.62.2 — 2026-08-27 · found by the test suite

### Fixed
- **A floor paints in a fifth of the time, pixel for pixel the same.**
  `noise` is the hottest function in the surface painters by a long way
  — a floor calls it millions of times — and every call was allocating
  two closures (`wrap` and `h`) and then calling `h` SIX times to get
  FOUR corners, so two of them were hashed twice over. Written flat, with
  four wraps and four hashes and no closures, the reef — the slowest
  floor in the set — went from about 226ms to about 33ms. Every floor
  comes out bit-identical; a new test proves it.

### Added
- **A fingerprint of every floor's pixels**, because this nearly shipped
  as something much worse. The obvious way to speed `noise` up is to
  precompute its hashes into a table, since it only ever hashes lattice
  points. That is wrong here: `hash` is a fract-of-a-sine over its
  arguments rather than a lookup, and the painters pass FRACTIONAL
  periods (`SIZE / 3` is 42.667), so the coordinates it hashes are a
  continuum and not a grid. The table version was written, it was three
  times faster, it passed all 512 tests — and it silently repainted five
  of the sixteen floors. Nothing in the suite could see it, because the
  tone-step and distinct-surface tests measure a floor's CHARACTER, which
  survives being redrawn. The new test measures identity.

### Changed
- **The floor-paint budget is measured as the best of five runs**, not
  the mean. Its first version failed on a busy machine — 310ms for a
  floor that really costs 33ms — which is a test failing by weather
  rather than by regression. The 260ms ceiling is unchanged; it now has
  eight times the headroom.

### Corrected
- **v1.62.1's changelog claimed a hash change that is not in the code.**
  It said the fract-of-a-sine hash had been replaced with integer
  bit-mixing, gave measurements for it, and reasoned about why it was
  kept. The shipped file has no such change and never did — the edit was
  written and measured, then lost before the commit, and the paragraph
  went out unchecked against the file it described. That entry is struck
  through and marked below. Nothing about the floors' appearance depended
  on it, and nothing else in that release is affected.

## v1.62.1 — 2026-08-27 · reported by Marc

Marc: "make the crystal cavern floor look less pixelated. Make the glow
glade floor look better. Make the floor of every arena one continuous
picture and design because you can see the line in the middle where it's
cut."

### Fixed
- **Every floor was cut across, in the same place.** The tray floor was a
  square 128×128 picture laid down with `repeat` set to the tray's size
  over 6.4 world units — `[0.875, 1.594]`. Across the tray that is under
  one copy, so nothing showed; DOWN it the picture ran out at 1.0 and
  started again from the top, and the join was a hard horizontal cut
  about six-tenths of the way along, right where the dice land. All
  sixteen had it.

  A square picture cannot cover a 5.6 × 10.2 tray without either
  repeating or being stretched out of shape, so the picture is not square
  any more: the painter is asked for one the tray's own proportions, laid
  down once at `repeat [1, 1]` and clamped rather than wrapped. No join,
  and nothing stretched, because the texels stay square in world space.

  The ground outside the tray still tiles, and should: it reaches 26
  world units, it is mostly behind scenery, and its painters genuinely
  wrap — which is what the tray's could never do at 1.594.
- **The Crystal Cavern's floor was jagged.** The pixels were never the
  problem, the EDGES were: every crystal was drawn by a pair of
  `continue` tests, so a texel was either wholly crystal or wholly rock
  with nothing between, and a hard edge magnified onto a floor about
  three screen pixels to the texel is a staircase. Nothing else on that
  floor had the fault because nothing else on it has an edge — it is all
  noise. Every edge is a ramp now.

  The shape took three goes and both dead ends are worth recording. Long
  tapered blades radiating from a root is what a crystal cluster looks
  like from the SIDE; from above, three of them read as a bird's
  footprint and four as a bird. What reads as crystal looking down is a
  chunk — a flat angular face with a straight edge and a second face
  turned away from the light — so a cluster is three overlapping
  hexagonal shards, each split into a lit facet and a shadowed one, each
  outlined dark so it stays a separate solid.
- **Glow Glade's floor was a flat green with grey lumps.** The moss was
  one blob of noise, so it had colour but nothing at the scale of a leaf.
  The stones were near-circles with a soft rim, which at this size reads
  as mould. And the spores were single texels turned on by a hash — a lit
  pixel with nothing around it is not a glow, it is a dead pixel, and it
  is exactly what "looks pixelated" means. Now: moss in three depths with
  a fibrous grain over it, lumpy stones sitting in their own shadow, and
  spores drawn as soft round lights with a halo.

### Notes on cost, since it is not free
Being one picture makes the floor 40% bigger than the square it replaced,
and the heaviest floors went from about 145ms to about 190ms to paint.
That is the price of not having a seam and there is no way around it.
Painting at higher resolution as well was tried and dropped: it took the
worst floors past 260ms, which is a stall a player would see the first
time an arena opens, and avoiding that stall is the whole reason
`textureCache.ts` exists. Sharpness came from ramping the painters' hard
edges instead — a multiply, rather than half again as many pixels.

~~The hash under all of it was changed from a fract-of-a-sine to integer
bit-mixing…~~ **This paragraph was wrong and is corrected in v1.62.2.**
No such change is in the shipped code: the hash is still the
fract-of-a-sine it always was. The edit was written, measured and
described, and then lost before the commit; nobody checked the file
against the paragraph.

## v1.62.0 — 2026-08-27 · requested by Marc

Marc: "make the emojis on the ladder section just the icons for each
item. Flip the ladder around to go in ascending order down. Change the
trophy amount of some items so that the highest thing is only 10 thousand
trophies."

### Changed
- **The ladder shows the item, not an emoji.** It drew a hand-picked
  emoji for every rung — a cherry for Ruby Dice, a volcano for Volcano
  Rim — while the Store and the Inventory, two taps away, show the real
  painted die and the real picture of the battlefield. Same items, same
  app, and only this screen showed a picture of fruit. A rung now draws
  what it hands over, through the same `DiceSwatch` and the same
  `ARENA_ART` every other screen uses. The league banner above it was the
  last emoji stand-in left on the screen once the list stopped using
  them, so it shows the picture too.

  Courtyard Treasure keeps its 💰: it adds the pile of gold to the Castle
  Courtyard rather than handing over a thing of its own, so there is no
  picture to show. The join between a rung and its item lives in
  `src/game/tierItem.ts`, and a test holds that rung to being the only
  one without a picture.
- **The ladder reads downwards.** It was reversed so the summit sat at
  the top, which is how a leaderboard reads. This is not a leaderboard,
  it is a road, and a road is read from where you are standing towards
  where you are going.
- **The summit is 10,000 trophies exactly**, down from 10,600, with the
  eleven rungs below it moved to suit. The comment in `progress.ts` used
  to argue this could not be done without a kink in the climb, and that
  was true only of gaps that all grow by the same fifty: fourteen of
  those, each wider than the 300 below, come to at least 9,450 and
  overshoot. Four twenty-fives at the bottom of the run buy the
  difference — 325, 375, 425, 475, then ten clean fifties from 500 to 950
  — summing to exactly 8,850. Every rung is still harder than the one
  below it, now checked by a test that demands *harder* rather than *no
  cheaper*.

  Midnight Dice stays on 1,150, and not for tidiness. Its Game Center
  achievement id is `…trophies1150` — the number is IN the id, and those
  ids are live records in App Store Connect, pinned in
  `tests/achievements.test.ts` from the API. Moving the rung would mean
  renaming one there or leaving an achievement that never fires.

### Added
- **`tools/screen-preview/` — the menus can be looked at now.** The
  arenas, the icons and the dice skins could all be rendered and
  inspected before shipping; the menu screens were the last visual thing
  going out on faith. It mounts a real screen through `react-native-web`,
  so the flex, border, radius and image rules a phone applies are the
  ones the browser applies. This ladder was checked in it before it went
  out, top of the screen to bottom.

## v1.61.1 — 2026-08-27 · reported by Marc

Marc: "fix the ocean dice skin to look better. That's not what a soccer
ball looks like, make the soccer ball skin look like a freaking soccer
ball."

### Fixed
- **The Soccer Ball was a honeycomb.** It picked one panel in three with
  a hash, so black cells landed next to each other and ran together into
  blobs; every panel was a hexagon; and the seam was a hairline. It read
  as bathroom tiling. A football is a truncated icosahedron — black
  PENTAGONS, no two touching, in a field of white hexagons — so the black
  panels now go on a proper 3-colouring of the hex lattice,
  `(q + 2r) mod 3`, which is the arrangement where no two are ever
  neighbours. Each one is drawn as a regular pentagon, its boundary found
  the same way `hexCell` finds a hexagon's: the inradius over the cosine
  of the angle folded into one fifth of a turn.
- **The Ocean was teal with white comets on it.** Three separate faults,
  and each had to go.
  - The wave phase was pushed around by 2.6 radians of noise — more than
    half a wavelength — so every swell bent back into itself and there
    were no wave fronts at all, only swirls. The wander is a fifth of a
    wavelength now.
  - The foam was chosen from the sum of the swell and the chop crossing
    it. The chop is what stops a sea looking like corduroy, but adding it
    in before deciding where the foam goes chews the crest line into
    pieces — and those pieces were the flying white blobs.
  - It was one train of waves with foam on every crest, which gives
    evenly spaced parallel stripes. At sixty-four pixels evenly spaced
    parallel stripes are a deck chair, whether the stripe is a thin neon
    line or a broad white band; both were tried on the way here. What
    makes water read as water is foam that is patchy and still lies along
    lines, so there are two scales now: a long roll carries the colour,
    shorter waves ride it at an angle, and foam needs BOTH a small wave
    at its crest and the roll high underneath it.

## v1.61.0 — 2026-08-27 · reported by Marc

Marc: "in volcano rim you didn't put the orange rocks around the entire
wall, just on half of it. All these things have to go around the entire
wall."

Volcano Rim was v1.60.1's fault and was already fixed by it — with the
crest ring listed a wall at a time, the orange columns were `i % 4`, and
every even index was a left-wall spot, so nine went down one side and
none down the other. What "all these things" turned up was that going
round the wall was only ever CHECKED by eye, and three other faults had
got past that.

### Fixed
- **The Snowy Woods' fence was buried.** The palings topped out 0.40
  above the wall and the drift of snow was a slab from 0.355 to 0.485
  across the full width of it, so from a camera that looks down there was
  nothing to see: every wall read as a blank white kerb. The posts had
  been there the whole time. They now stand 0.62–0.82 proud with a cap of
  snow ON each one, and every third is cut from the paler timber.
- **Rooftop City had a bare grey frame.** The coping was one smooth band,
  the handrail was cut from the wall's own width — 0.5 across, wider than
  anything standing under it — and the posts were 0.04-radius pins. From
  above, nothing. The coping is cast in slabs now, alternating shade, one
  per crest spot the whole way round, with a stanchion and a base plate
  on each, under a 0.12 rail that leaves them showing either side.
- **Three crests were laid crossways on two of their four walls.** The
  Dune Fort's bricks, Palm Cove's driftwood and Sunny Farm's pickets all
  had fixed box dimensions, which are right for the near and far walls
  and turned ninety degrees out on the two long ones. They now follow the
  wall they sit on.

### Added
- **`tools/arena-preview/audit.js` — the wall is measured now.** It
  renders each battlefield straight down, walks the middle of all four
  walls in screen space through the camera that drew them, and reports
  the light-to-dark range along each. It fails a wall under 18 of range
  (a bare kerb) and fails walls that do not match the one opposite — the
  long walls to 0.75, the short ones to 0.45, which are looser because
  the jail and the retreat stand behind them.

  Both thresholds were set by testing them against faults that really
  happened: with the crest ring reverted to its pre-v1.60.1 order the
  audit flags Volcano Rim (105 vs 65), Frozen Lights (125 vs 0) and
  Crystal Cavern (166 vs 113), and nothing else. All sixteen pass on the
  code as shipped.

  A per-wall evenness reading is printed as well but deliberately does
  NOT fail: it samples one line at one height, so a piece taller than
  that line shifts off it as it projects and the number dips where
  nothing is missing.

## v1.60.1 — 2026-08-27 · reported by Marc

### Fixed
- **Frozen Lights' ribs were on one wall only.** Marc: "on frozen lights
  the nobs at the top of the wall still don't go around the entire
  wall." v1.60.0 fixed the crest POSITIONS — the ring was continuous and
  every corner filled — and the ribs still came out nine down one long
  wall and none down the other. The positions were never the fault. The
  ORDER was.

  The ring was built a wall at a time, pushing the left-hand spot and the
  right-hand spot of each step into the list together, then the near and
  far ones. So every even index was a left-or-near spot and every odd
  index its opposite number. Nearly every crest picks which pieces to
  draw with `i % 2` or `i % 4` — the polar station's ribs, the rooftop's
  handrail posts, the cavern's lit crystals, the cordwood's two shades —
  and every one of those was really saying "one side of the arena", not
  "every other piece".

  The ring is now built in the order you would walk it: down the left
  wall, across the far one, back up the right, home along the near. It
  comes to 48 pieces, which 2, 3 and 4 all divide, so a repeating crest
  also closes up at the corner it started from instead of showing a seam.
  Frozen Lights now carries nine ribs on each long wall and three on each
  short one; Rooftop City, Crystal Cavern and the Autumn Woods' cordwood
  are evenly dressed for the first time as well.

  The ring moved out of `ThemedArena.tsx` into `src/arena/rim.ts` so it
  can be measured. Five new tests: the ring touches all four corners,
  consecutive entries are neighbours on the wall, every `i % 2`, `i % 3`
  and `i % 4` subset still lands on all four walls in matching numbers,
  a repeating pattern divides the ring, and the renderer uses the
  measured ring rather than building its own.

## v1.60.0 — 2026-08-27 · reported by David

### Fixed
- **The wall decorations stopped short of every corner.** David: "the
  pegs and decorations on the top of the walls on a lot of maps only go
  halfway around when they should be all the way around." Measured, the
  crest ran across only 77% of the near and far walls — it started and
  stopped 0.15 inside the INNER width, leaving 0.65 of bare wall at each
  of the eight places an end wall meets a side. The sides reached 95%, so
  the two short walls looked stripped next to them and every corner had a
  hole in it. It is one continuous ring at one pitch now: the sides run
  corner centre to corner centre and own the corners, and the ends fill
  in between them.

### Changed
- **The Autumn Woods floor has real leaves** — shaped, with a midrib, in
  the reds and golds a wood actually turns, overlapping in two passes.
  They were small dark dashes, which reads as grit.
- **The Crystal Cavern has crystals in it.** The floor was a scribble of
  mineral veining that read as noise; it is calm rock now with faceted
  blades breaking through. The rim was a row of smooth cones — a
  portcullis — and is now stubby hexagonal prisms with blunt pyramid
  caps, some of them lit.
- **The Coral Reef is a reef.** More colour and far more coral, as asked:
  the seabed carries coral heads in six colours, and the wall pieces are
  brain corals, staghorn and fans instead of spikes.
- **The Moon Base floor is regolith** — grey dust pocked with craters in
  three sizes, each a dark bowl inside a lit rim. It was a hexagonal
  wireframe, which reads as graph paper.
- **Sunny Farm is a farm.** Ploughed furrows with clods turned up along
  the ridges, straw lying along them, and three times the hay bales,
  trees and flowers.
- **Glow Glade** has damp patches, brighter moss where the light gets in,
  glowing spores, and stepping stones that are now PALER than the moss —
  they had been mixed a quarter of the way into the theme's accent, which
  for the glade is another green, so they came out darker than what they
  were meant to sit on.
- **Rooftop City** has a roof on it: a hatch cover, a run of galvanised
  duct and the painted safety lines, over lifted decking.
- **More clouds in the Sky Kingdom** — nineteen props against six.

### Changed — dice
- **Ruby is Gold in red**, as asked: the same sweep of light, the same
  polishing marks, a bright core and near-black in the shade.
- **Bubbles are bubbles** — round, overlapping, with the iridescence a
  soap film shows, a shaded far side and a glint on each.
- **The Cow is a cow.** Six hand-placed patches at sizes and angles no
  lattice would produce, edges chewed by noise. It was one blob per cell
  of a staggered grid, and however much each was jittered the grid showed
  through: "less like an algorithm picking a pattern."
- **The Soccer Ball is black and white hexagons**, as asked.
- **The Bumblebee has no spots.** The pale speckle over its bands read as
  spots, which a bee has none of.
- **Also better:** the golf ball's dimples, the turtle's shell, the
  snake's markings, the basketball's seams and pebble, and the ocean's
  waves. The denim's copper rivet is gone — at a die's size it did not
  read as a rivet, it read as a stray yellow dot.
- Three of those had the same root cause, worth naming: the hex patterns
  were identifying which cell a pixel was in by rounding three axial
  stripe families separately. That does not name a cell, so hashing it
  scattered colour per PIXEL — the soccer ball came out as black
  splatter and the golf ball as diagonal streaks. There is one correct
  hex helper now, with cube-coordinate rounding and a real hexagonal
  boundary, and the soccer ball, golf ball, turtle and basketball all use
  it.

## v1.59.0 — 2026-08-26 · reported by David

### Fixed
- **The Ultimate mode icon, third attempt — and this one was looked at.**
  David: "the icon for ultimate still doesn't look good. You seem to keep
  messing up with the triangle part of the arrows." He is right on both
  counts, and the two failures were different mistakes with the same
  cause.
  - The first version made the loop's gaps by clearing the left and right
    border colours of a rounded box, not knowing that each of a rounded
    box's four border sides owns one 90-degree quadrant and is mitred at
    the diagonals — so clearing the sides leaves the top and bottom
    quadrants behind as stubs rather than opening the sides.
  - The second fixed that and then drew the heads 0.27 of the icon tall
    against 0.19 long — **wider than they were long** — pinned out at
    x 0.97 and 0.03, floating clear of a closed loop. Rendered, that is a
    rounded box with two fins stuck on it.
  - The heads are now 0.26 long against 0.28 across, with their points at
    0.66 and 0.34 — exactly where the loop stops being straight and
    starts curving, so each head grows out of the bar and narrows into
    the turn instead of being laid over the curve where it thickens into
    a blob.
  - Both earlier versions were signed off against a hand-drawn picture of
    what the code was hoped to produce. This one was chosen by rendering
    four designs side by side and then sweeping the three numbers.

### Added
- **`tools/icon-preview/` — a way to look at the icons.** It draws every
  icon in the app at 96pt and 22pt through the real components, with
  `react-native` aliased to `react-native-web`, so the styles a phone
  applies are the styles the browser applies rather than a guess at
  them. Same reason `tools/arena-preview/` exists: the checks that can be
  automated cannot see a picture, and somebody has to look.
- `npm test` now checks the two things that actually went wrong: an
  Ultimate arrowhead must be longer than it is wide, and its point must
  land on the straight part of the loop rather than out on the corner
  radius. Both are arithmetic, so both can be pinned.

## v1.58.0 — 2026-08-26 · reported by David

### Fixed
- **Copper rendered as a plain brown cube — and so did three others.**
  David: "the copper skin doesn't show when previewing it, it's just
  brown." Copper, Ruby, Ocean and Slate are painted by full-colour
  painters, which mix their own paint and carry no ink — and DieMesh
  used `!patternInk` to mean "this skin has no picture", so all four fell
  through to a flat body colour, in the hand as well as on the shelf.
  - The Store's copy of that mistake was found and fixed a version ago.
    The die's copy was not, and fixing one of two places is exactly how
    the other survived. Both are checked against the same list now.
  - The test that should have caught it was excluding them: it built its
    list of skins by filtering on `!!skin.ink`, so the four skins that
    mix their own paint were the four left out of the "no pattern comes
    out as a flat square" check.

### Changed
- **Copper is a metal like Gold and Silver.** David: "make it look like
  the gold and silver texture." It was a hammered surface of dimples,
  accurate and completely invisible at the size a die is seen. It is a
  polished sweep of light now, in the same family as the other two —
  what separates the three is the width of the sweep and what the shadow
  is made of. Gold's shadow is warm brown, Silver's is cold grey,
  Copper's is the first breath of verdigris.
- **The thirteen skins David named are remade.** Golf Ball, Cow,
  Bumblebee, Turtle, Soccer Ball, Denim, Snake, Basketball, Football,
  Honeycomb, Tiger, Bowling Ball and Volleyball. Ten of them moved off
  the single-ink painter for the same reason as the batch before: a mask
  travels from the shell colour toward ONE other, so it can darken or
  lighten but never both, and none of these can be drawn that way. A
  golf ball is white on white, so all of it is shading. A basketball's
  whole surface is pebble. A tiger is hairy. A honeycomb cell is a hole.
  A bowling ball is gloss. The Bowling Ball was the least visible pattern
  in the set at a local contrast of seventeen; it now has a swirl through
  the resin, a hard highlight and three holes with depth.
- **Every arena's retreat and jail belong to it.** David: "not every
  arena needs to have the same castle toppers on the bottom corners of
  the screen, make everything about every arena unique." The toppers
  were the retreat canopies — one cone on one post in all sixteen,
  repainted, standing at the two bottom corners of the frame where they
  are the closest and nearly the largest things on screen. A cone on a
  post is a turret roof, so every battlefield had a castle turret in each
  bottom corner however it was built.
  - There are sixteen shelters now: a snow-laden lean-to, a reed
    sunshade, a brazier of embers, a log A-frame, a floodlight, a hung
    crystal, the castle's parasol (which belongs to the Sky Kingdom and
    only there), a landing beacon, a stretched sail, a lollipop, a cage
    of fireflies, a ship's lantern, a birdhouse, a sea fan, a street
    lamp and a pinwheel.
  - The jail was nine identical iron bars behind the far wall of a coral
    reef and a rooftop alike. It is timber stakes, mud pillars, grown
    spires, machined rod, candy canes, saplings, rope and stacked bricks
    depending on where you are.
  - This is the third round of one fault — one crest for sixteen, then
    four, then one canopy for sixteen — so the new test checks the
    PATTERN rather than the piece: anything every battlefield must carry
    has to have a branch for every battlefield.

## v1.57.0 — 2026-08-26 · reported by David

### Fixed
- **The giant blob is gone.** David, on a screenshot with the top third
  of it filled by a featureless brown dome: "what is this giant blob."
  It was the "horizon bank" added in v1.56.0 — a squashed sphere of
  radius 7.5 at z -10.4, meant to give the world an edge to end at. The
  arithmetic nobody did: a sphere of radius 7.5 centred at z -10.4
  reaches FORWARD to z -2.9, past the tray's own far wall at -5.1, and
  stands 3.3 high against a wall 1.4 high. It was never a distant
  horizon. It was a dome sitting on top of the jail. My mistake, shipped
  because I could not see it.
- **The night battlefields were two stops under.** Rendered and measured,
  Rooftop City came out at 0.26 mean brightness with 54% of the board in
  deep shadow, and Volcano Rim at 0.28 with 78%. The palettes had already
  been lifted for exactly this complaint two versions ago; it was the
  lighting rig undoing them — a third dimmer than daylight, then
  compressed further by the scene's filmic tone mapping. Night is now
  carried by the COLOUR of the light rather than by how little of it
  there is, which is what it should always have been: a volcano at night
  is not dark, it is orange. City and Volcano now sit at 0.37.
- **Smaller blobs, same fault.** The Glow Glade's corner toadstools were
  pale domes most of a world unit across, and its mushrooms were bright
  enough to blow out to near-white circles. Trees were single spheres,
  which from a near-overhead camera project to flat coloured discs — they
  are clumps of foliage now. The city towers were near-black bricks.
- **The floors were too busy under the dice.** Wall-to-wall leaf litter
  reads as grit, not leaves; the tiles are larger and calmer, and about
  half the cells carry a leaf rather than all of them. The Pirate Cove's
  caulking was strong enough that the sand outside the tray read as
  blue-grey brick.

### Added
- **`tools/arena-preview/` — a way to actually look at an arena.** It
  renders any battlefield in a real browser through the real component
  and the real camera, at phone dimensions, and writes a PNG.
  - It exists because of this afternoon. Three rounds of arena work
    shipped without anyone being able to see the result: two hundred
    props placed outside the camera, then a dome on top of the jail, then
    a set of night arenas nobody could read. Every one of those passed a
    typecheck, a full suite and a Metro bundle check, because none of
    those can see a picture.
  - Metro is told to ignore `tools/`, and `react-dom` is installed on
    demand rather than added to package.json. Nothing in there can reach
    a phone build.

## v1.56.0 — 2026-08-26 · reported by David

### Fixed
- **The new battlefields were being dressed outside the camera.** David,
  looking at three of them on his phone: "every new map, not just these,
  look either unfinished, off centered, or only half done." He was right,
  and measuring the camera said why.
  - The board is framed almost straight down, and the visible world is a
    narrow box: x from -3.9 to 3.9 and z from -10.5 to 7.8 on a modern
    iPhone, of which the tray itself takes x ±2.8 and z ±5.1. **Every
    prop in all sixteen themed arenas sat at |x| between 7 and 10.** Not
    one had ever been on screen, on any phone, since the day it was
    written — and nor had the five hills at |x| 12, the three mountains
    at z -19, the clouds at z -13, the sun, the sixty stars, or the moon
    and the Earth and the aurora. Sixteen battlefields were a bare tray
    in a wash of flat colour, and everything meant to dress them was
    being rendered into the dark.
  - All two hundred props are re-placed inside the frame: a row down each
    side just outside the wall, and a bank of three behind the jail. The
    sky and the far landscape are gone from the 3D scene entirely, since
    height cannot rescue them — a distant object hung higher moves further
    UP the frame and out of it, not into view. The theme data still
    describes a sky and still should: the Inventory thumbnails are drawn
    wide and do show it.
  - `npm test` now projects every prop through the real fitted camera at
    the two extreme phone shapes and fails if it lands outside. Nothing
    could have caught this before: a prop off screen throws nothing, and
    reads in the source exactly like a prop that works.
- **All sixteen rolled on the same floor.** The renderer passed
  `theme.floor.a` to the shared flagstone painter and never read
  `theme.floor.b` at all, so every themed arena had the same grey
  eight-by-eight grid — the largest single thing on screen, identical
  sixteen times. There is a painter per battlefield now: packed snow,
  wind-rippled sand, cracked lava with the heat still in the seams,
  fallen leaves, riveted deck plate, mineral cave rock, flagstone,
  regolith, wet beach sand, iced squares, moss with stepping stones,
  ship's planking, straw on bare earth, rippled seabed under caustics,
  gravelled roofing felt and a printed play mat. The ground outside the
  tray is painted from the same family a shade duller.
- **The rim looked like scattered rubble.** It stepped 1.1 across the
  ends and 1.15 down the sides from inset starts — four pieces on each
  end against eight on each side, with gaps wider than the pieces. One
  pitch, measured from the wall's own corners, gives eight on the ends
  and seventeen down the sides, evenly.
- The ground plane was 70 by 70 and is now 26 — the other 44 units were
  a very large quad drawn for nobody.

## v1.55.0 — 2026-08-26 · requested by David

### Changed
- **Every dice design now matches its name.** David: "make sure every
  dice design still makes sense according to the dice name. Like the
  fish should have fish on it." He picked the clearest case — Fish was a
  scale texture, which is what a fish is COVERED in rather than what a
  fish looks like, and at a die's size it read as roof tiles. It has
  actual fish on it now, swimming in rows that alternate direction.
  - The audit turned up two more. Chicken & Waffles drew its chicken as
    two round lumps in the waffle's own brown — two burnt patches; they
    are drumsticks with bones now. Peacock drew its feather eye in one
    ink, which cannot work: an ocelle is navy, then blue, then gold, and
    that is the whole of what makes it a peacock.
- **The skins are textured properly.** Ten of them moved from the
  single-ink painter to full colour, because a mask can only travel from
  the shell colour toward ONE ink — it can darken or it can lighten,
  never both — and nothing with real relief can be drawn that way. The
  turtle's scutes are domed with growth rings; the chocolate bar is
  moulded and bevelled; the strawberry's seeds sit lit inside their
  dimples; Denim went from the faintest pattern in the set to real
  indigo twill with orange topstitching. Bubbles got a shaded side, so
  each one is a sphere rather than a hoop. Camo's four tones were pushed
  apart — camouflage is meant to break up a shape, not be invisible.
- **Ruby, Ocean, Slate and Copper have their materials.** They were flat
  colours, and all four are named after a MATERIAL. Ruby is a cut gem
  with facets, Ocean is swells with foam on the crests, Slate splits
  along its bedding, Copper is hammered with verdigris in the hollows.
  The rest of the trophy ladder stays flat colour, which is what tells
  it apart from the Store shelf.
- **All sixteen battlefields are built of something different.** David:
  "you just used the same like 4 different templates for the arenas now,
  make them all unique." Right, and for the same reason four was not
  enough that one was not: a skyline is what you recognise a place by.
  There are sixteen now — snow palings, adobe brick, basalt columns,
  stacked cordwood, a polar station, dripstone, the Sky Kingdom's
  merlons, moon-base hull plating, driftwood, piped icing, mossy stones,
  a ship's gunwale, a picket fence, coral heads, a rooftop parapet and
  wooden bricks — each with its own corner piece. The tray the dice
  bounce in is identical under all of them.
- **Prices and trophy thresholds climb properly.** David: they should
  "make sense scaling up higher and higher... just polish it off a bit."
  - Six dice used to cost 500 coins and five cost 450 — a third of the
    shelf was flat plateaus, which also made the display order arbitrary
    since the shelf sorts by price. All forty-two now have their own
    price, 250 up to 1,400, with the step widening the whole way.
  - The battlefields were a flat 200 coins apart and then 400 for the
    last one. They now widen 200, 250, 300 up to 500, from 900 to 3,350
    — deliberately above the dice, because a battlefield is a bigger
    thing to own than a die.
  - The trophy ladder ran 350, 350 at one point: the only rung on the
    whole climb that was no harder than the one below it. The long ladder
    now widens by exactly fifty a rung, 350 through 1,000. That moves the
    summit from a round 10,000 to 10,600 — the round number was what
    forced the kink, and a clean climb is worth more than a tidy number.
  - `npm test` now checks all of it: no two things on a shelf may share a
    price, both shelves must be in price order, the battlefield steps
    must widen, and the top of each shelf is converted into Hard wins so
    a change to prices or to rewards has to stay honest about the other.

## v1.54.0 — 2026-08-26 · requested by David

### Fixed
- **The dice designs are no longer drawn where the colour covers them.**
  David: "a lot of the dice are messed up because the design is in the
  center, which doesn't make sense because the colors are in the center."
  - He is describing a collision the two halves of a die's look were
    always going to have, and which nothing had ever checked. The
    coloured circle on each face — the thing a roll is actually read
    from — covers a third of that face, dead centre. The pattern
    painters draw on a plain square tile and had no idea any of it was
    about to be hidden.
  - Eleven of the forty-three patterned skins had put their whole
    subject in the middle. The **Football's** laces ran down the centre
    line with TEN TIMES as much ink under the sticker as outside it, so
    its faces were blank brown leather. The **Soccer Ball** was one
    pentagon, dead centre, entirely invisible. The **Tennis Ball's** two
    seams both crossed within six pixels of the middle. The
    **Basketball's** seams were a cross whose junction was the exact
    centre. All three of the **Bowling Ball's** finger holes were inside
    the circle. The **Lemon** was a wheel of segments radiating from a
    hidden hub. The **Galaxy's** bright core was the one thing covered
    up. Also affected: Cow, Pizza, Volleyball, Watermelon and Circuit
    Board.
  - Each is redrawn as the SURFACE of the thing rather than a portrait
    of it. The soccer ball is a proper pentagon-and-hexagon lattice; the
    football's laces ride the left third with the ball's long seam
    sweeping the right; the tennis and baseball seams bulge in from the
    edges; the basketball wears four shallow seams, one from each edge;
    the bowling ball's finger holes are up in a corner where a hand
    grips it; the lemon is four cut slices in the corners; the galaxy's
    core burns low in one corner with its disc tilted across.
  - `npm test` now measures the local contrast of every pattern inside
    the sticker's circle against outside it, so a new skin cannot ship
    with its design hidden. DieMesh and the painters read the sticker
    size from one shared number instead of two copies of 0.33.
  - It also checks the colours the full-colour painters mix themselves,
    which no test had ever looked at — they belong to no skin, so the
    existing shell and ink checks could not see them. Moving the galaxy
    off-centre meant giving its disc a colour, and the purple first
    chosen sat ΔLab 8.7 from the PURPLE face sticker: a soft bright
    field of almost exactly the face colour, spread across most of the
    face. It would have swallowed one face in six.

## v1.53.0 — 2026-08-26 · requested by David

### Changed
- **The dark battlefields can be seen now.** David: "a lot of these new
  maps are way too dark and you can't really tell what it is." He was
  right and it was measurable — five of the sixteen had most of their
  picture in the bottom third of the brightness range, and at the size
  the Items shelf draws them that is a smudge, not a mood.
  - Rooftop City is dusk instead of midnight, lit from the streets below.
    The volcano's rock is warm grey rather than near-black, so the lava
    has something to run down. The crystal cavern's stone is lit violet.
    Frozen Lights swapped ground and sky: the ground is SNOW, which is
    what ground under an aurora is, and the dark now lives in the sky
    where it belongs. Glow Glade became a mossy green clearing under a
    moon, which also moved it away from the coral reef — the two were the
    closest pair of colours in the set.
  - `npm test` now measures every picture's brightness and how much of it
    sits in shadow, so this cannot quietly creep back. The Space Station
    is the one exception, and only it: it is deep space, it is one of the
    four originals, and not seeing much is the subject there.
- **The battlefields are not all castles any more.** David: "the arenas
  all don't have to look like castles. They can be something that makes
  sense for the arena name, like how the space station doesn't look like
  a castle." The shared renderer had been putting notched battlements and
  cone-roofed corner turrets on every one of them, so a coral reef, a
  rooftop and a moon base were the same fortress in different paint.
  - There are four kinds of building now. The moon base, the polar
    station, the rooftop and the beached pirate hull have panelled walls
    with a lit strip and masts at the corners. The desert, the volcano,
    the cavern, the glade and the reef are heaped boulders with cairns.
    The snowy hollow, the autumn woods, the farm and the beach are timber
    fences with gateposts. Only the Sky Kingdom, the candy meadow's
    gingerbread and the toy room's building blocks kept their merlons —
    those three are castles on purpose.
  - The tray the dice bounce in is byte-for-byte identical in all four.
    Nothing about which battlefield you pick can change how the game
    plays, and a test now checks that the wall geometry never learns
    about the structure.
- **Extra decoration everywhere.** David: "add some extra decorations on
  them to make them look better." Five new kinds of scenery — flowers,
  bushes, pebbles, torches and banners — are placed around all sixteen
  battlefields, and every thumbnail gained detail: gulls over the beach,
  sparks over the volcano, a treasure chest at the cove, a lander and a
  flag on the moon, a fence and flowers on the farm, sprinkles in the
  candy meadow.

### Fixed
- **Leaving a preview drops you back where you were.** David: "after you
  exit a preview it should keep you where you were on the screen and not
  put you back to the top of the screen." Opening a preview takes the
  shelf off the screen entirely so you can see the item behind it, and
  the shelf that comes back is a brand new one, which starts at the top.
  With fifty-three dice and twenty battlefields on those shelves, that
  was a long scroll back to the thing you had just tapped. Where you were
  is now remembered outside the shelf and put back the instant it
  returns, with no animation, so there is nothing to watch.

## v1.52.0 — 2026-08-26 · reported by David

### Fixed
- **The arrows on the Ultimate mode icon.** The loop was meant to be a
  circle with a gap on each side for the two chasing arrows; what it
  actually drew was two short stubby arcs at the top and bottom with the
  arrowheads floating loose beside them.
  - The cause is a rule about how phones draw borders: a rounded box's
    four border sides each own one quarter of the shape and are cut off
    at the diagonals, so making the left and right sides see-through does
    not open the left and right of a circle — it leaves the top and
    bottom quarters behind.
  - It is a closed rounded-rectangle loop now with an arrowhead on the
    top-right pointing right and one on the bottom-left pointing left,
    which is what the repeat symbol actually is. Both heads are placed
    from the loop's own line thickness rather than by eye, so they sit on
    the bars instead of near them.
  - **This one is my fault twice over.** I checked the last version by
    drawing a picture of it — but the picture put the arcs on the left
    and right, so I approved something the code never made. A check only
    counts if it follows the same rules the phone does.

## v1.51.0 — 2026-08-26 · requested by David

### Changed
- **The game mode icons are the emoji shapes again, drawn — and bigger.**
  David: "the game mode icons need to be bigger and look very similar to
  the original emojis so they're easily identifiable for each mode." The
  previous drawn set depicted each mode's rule (a matching pair, a
  returning arrow, and so on), which was tidy and wrong: the family had
  weeks of knowing ⚔️ meant Color Rush, and an icon that throws away
  learned recognition makes the picker harder to use, not cleverer.
  - Color Rush is two crossed swords with steel blades and leather grips;
    Ultimate is the two chasing arrows of the repeat loop; Skirmish is
    two little figures leaning into a grapple, one green and one purple;
    Color War is a red-and-white bullseye.
  - They grew from 16pt to 21pt in the mode picker and from 30pt to 36pt
    in How to Play, and all four were rendered at both sizes — and on the
    gold selected chip — before shipping.

## v1.50.0 — 2026-08-26 · requested by David

### Added
- **Sixteen new battlefields**, taking the game from four arenas to
  twenty. Eight are earned on the trophy ladder, which now climbs to
  10,000 trophies — Snowy Hollow, Desert Dunes, Autumn Woods, Frozen
  Lights, Volcano Rim, Crystal Cavern, Sky Kingdom and Moon Base. Eight
  are bought in the Store with coins, 800 to 2,400 — Sunny Farm, Treasure
  Beach, Candy Meadow, Glow Glade, Pirate Cove, Coral Reef, Rooftop City
  and Toy Room. Battlefields now follow the same one-route rule dice
  always had: a trophy tier or a coin price, never both, and a test
  enforces it.
  - All sixteen share one renderer driven by pure data
    (src/arena/themeData.ts), so every arena keeps the jail, the retreat
    and the hazards exactly on the shared station coordinates — the
    figures can never stand inside the scenery. Each theme dresses its
    own hazards and names them ("Sssss! A die fell in the lava!"), so
    the grass-hill-on-a-space-station bug cannot come back with the set.
  - Every new arena has a drawn Inventory picture, generated FROM the
    theme data so the two cannot drift, and the distinctness test now
    measures the full colour cube across all twenty — the hue-only ruler
    scored the desert and the toy room nearly identical while any pair of
    eyes tells them apart instantly.
- **Forty new dice skins**, taking the set from thirteen to fifty-three.
  Six flat colours continue the trophy ladder (Ruby, Ocean, Lavender,
  Slate, Blossom, Copper); thirty-four patterned sets join the Store —
  ten animals (leopard, tiger, cow, giraffe, bumblebee, peacock, fish,
  turtle, snake, paw prints), eight sports balls (golf, tennis, baseball,
  soccer, basketball, football, bowling, volleyball), ten foods
  including David's own **Chicken & Waffles**, plus watermelon, pizza,
  donut and friends, and six oddities (denim, camo, tartan, circuit
  board, rainbow, galaxy).
  - Eight of them are painted in full colour — a watermelon is red,
    white, green AND black, which the two-colour mask system could never
    say — through a new colour-painter path in the texture builder.
  - Every shell and every pattern ink was solved against the six face
    colours before it was chosen (the ΔLab > 28 rule): the tiger is burnt
    umber because real tiger orange would swallow the orange face, the
    tennis ball is olive because optic yellow would swallow the yellow
    one, and the baseball's stitches are wine-dark for the same reason.
    Every pattern was rendered and looked at before shipping; the cow
    started as one blob, the camouflage as another, the basketball's
    seams met in an ellipse and three of the soccer ball's corner panels
    were missing — none of which the code showed.

## v1.49.0 — 2026-08-26 · requested by David

### Changed
- **The four game modes have drawn icons now**, in place of ⚔️ 🔁 🤼 🎯.
  They show up on the mode picker and on the How to Play page.
  - Each one draws its RULE rather than a mood, because that is what you
    are choosing between: Color Rush is two dice landing on the SAME
    colour, Ultimate is an arrow turning back on itself with a prisoner
    being sent in, Skirmish is two sides reaching for the ONE prisoner
    between them, and Color War is a field split down the middle with a
    colour each. 🤼 — two people wrestling — said nothing at all about a
    shared jail.
  - The four are deliberately different KINDS of picture: a pair, a ring,
    two arrows meeting, a divided box. That is the lesson from the Cups
    tab, where a trophy and a medal both came out as "round outlined
    thing" at menu size and had to be redone twice.
  - **The selected mode's chip is gold, and that decided one colour.**
    Yellow is 1.14:1 against it and the same hue, so a yellow prisoner in
    the Skirmish icon would have read as a hole punched in the chip at
    the exact moment the icon matters most. It is purple instead. Blue is
    out of all four for a different reason: the ink outline reads 2.25:1
    on it and the drawing dissolves into its own fill.
  - The `emoji` field is deleted from the mode definitions rather than
    left unused, so nothing can quietly start rendering one again.

## v1.48.0 — 2026-08-26 · reported by David

### Fixed
- **Opening a battlefield no longer flashes the last one you looked at.**
  David: "the arena preview doesn't load fast enough when you click on an
  arena, you can still see the previous arena you clicked on for a split
  second."
  - It was not a loading problem, which matters — making the arena
    cheaper would not have fixed it. The board **stops rendering
    entirely** while a menu is open, deliberately, because a phone should
    not run a 3D scene nobody can see. A screen that has stopped
    rendering keeps showing its last picture. So opening a preview
    uncovered a board still holding the arena you looked at before.
  - The board is now covered until it has genuinely drawn the new place —
    counted in real frames, not guessed at with a timer — and the cover
    is that arena's own sky, so it reads as walking out into it rather
    than as a panel being taken away.
  - **It was also doing far more work than it needed to.** Looking at a
    different battlefield was rebuilding the entire physics world and both
    dice from scratch, for a change that is only scenery. It does not any
    more, which makes the swap quicker as well as invisible.

## v1.47.0 — 2026-08-26 · requested by David

### Changed
- **The battlefields in Items are drawn pictures now, not emoji.** They
  were 🏰 🌅 🌴 🚀 — the last four emoji left in the game after the Paper
  & Ink pass took them out of everywhere else — and they failed in two
  ways at once. 🏰 and 🌅 are the *same building* in this game, so the
  Castle and the Sunset Castle told you nothing about which was which;
  and an emoji is drawn differently on every phone, so the menu could not
  be sure what its own battlefields looked like.
  - Each one is a little scene of the place it opens: the castle under a
    blue sky with its coral roofs, the same castle at dusk with a low sun
    and long shadows, the jungle clearing with its palm and its pool, and
    the space station with a ringed planet and a moon.
  - **Every colour is lifted from the arena itself**, not invented. The
    roofs are the roofs' colour, the jungle water is the jungle's water,
    the neon on the station is the station's neon. A test fails if those
    ever drift apart from the game.
  - **The two castles are the hard part**, and this project has been
    caught by it before — the Sunset Castle was once reported as not
    looking any different from the regular one. They share a building, so
    the difference is carried by what actually differs when you stand in
    them: a low huge sun instead of a high small one, warm masonry, lit
    windows, and long shadows thrown toward you. Measured rather than
    eyeballed — a test compares every pair and the two castles come out
    well clear of the bar.
  - The first jungle had to be redrawn: its palm fronds were flat
    four-sided shapes and the tree read as a windmill at the size the
    menu actually draws it. They are leaf-shaped now, with a spine and
    notched edges.

## v1.46.0 — 2026-08-26

### Fixed
- **The News tab had fallen four versions behind the game.** v1.42 to
  v1.45 all shipped without a word in it, so anyone opening News saw
  nothing about the see-through result screen or the new How to Play
  demonstration — the two changes they are most likely to notice. There
  is a post covering both now.
  - This is exactly what the "news keeps up with what has shipped" test
    exists for, and it did its job: it allows the News tab to run up to
    three minor versions behind and failed the moment the fourth landed.
    The tab had gone eighteen releases stale once before, which is why
    the rule is there at all.

## v1.45.0 — 2026-08-26 · requested by David

### Changed
- **A real finger flicks the dice in How to Play now**, instead of the
  drawn cartoon hand. David asked for it, and he was right that a finger
  is the better object anyway: what you see of your own hand on the glass
  IS a fingertip, and a whole hand at that size was mostly knuckles
  taking up the arena.
  - It is rendered rather than drawn, and everything that makes it look
    real is shading: the finger is lit as a cylinder with the highlight
    off the centre line, the tip is flushed redder the way a pressed
    fingertip is, the nail has a pale half-moon at its base and one bright
    streak across it, and there is a soft shadow beneath so it sits ON the
    glass. Most importantly it has **no outline at all** — a black keyline
    is the one thing that makes anything look drawn.
  - Two faults found by looking at it rather than at the code: the tip
    came to a **pencil point** instead of a rounded dome, and the base
    ended in a **hard horizontal cut** across the middle of the arena.
    The tip is a proper dome now and the finger fades out as it recedes,
    so it reaches in from off the edge rather than stopping in mid-air.
  - It also flicked clean over the jail and out of the arena at first.
    Fixed by tuning against the rendered frames — the numbers that look
    right on paper are not the ones that look right on screen, because
    the fingertip is a long way from the point the animation actually
    moves.
  - The picture is 39 kB. It was 81 kB until it was sized for the screen
    it is drawn on rather than for the maths that made it, which matters
    when it is an over-the-air update the family downloads on a phone.

## v1.44.0 — 2026-08-26 · requested by David

### Fixed
- **The How to Play demo now looks like the actual game.** David saw the
  first version and said it "doesn't look like a mini arena and does not
  look anything like a hand". Both were fair.
  - It played out on a **blank cream rectangle**. It is a real mini
    battlefield now — green grass, the stone tray with battlements along
    its walls, the tiled floor, the four red corner towers, and the
    barred jail across the top with the six prisoners standing behind it.
    The colours are sampled out of a real screenshot of the game rather
    than picked, so the demo cannot quietly disagree with the thing it is
    demonstrating.
  - The **hand was a grey circle on a stick**. It is a proper drawn hand
    now — palm, curled fingers, thumb, one finger pointing. It had to
    become an image to do that: a hand is curves and overlapping masses,
    which the rounded rectangles everything else is drawn from cannot
    make. Images ship over the air the same as the code, so this still
    reaches phones without a new build.
  - **The dice were solid blocks of colour**, which is not something a
    player ever sees. A die in this game is white with a big coloured
    spot, and now so are these.
  - Two more, found by rendering it out again: the dice began the throw
    sitting **on top of the wall, out on the grass**, and the freed
    prisoner **floated up and perched on the bars** instead of simply
    leaving. Everything happens inside the tray now, and the empty slot
    in the jail is what tells you somebody got out.
  - The lesson, written down because it has now cost two attempts: the
    first version WAS rendered and checked — but only for whether the
    timeline made sense, never against what the game actually looks like.
    A demo of the game is wrong if it does not resemble the game, and
    that is not something the code can tell you.

## v1.43.0 — 2026-08-26 · requested by David

### Added
- **"Throw the dice" in How to Play is a moving demonstration now.** A
  hand comes in, presses, flicks up the screen; two dice fly off the way
  it flicked, tumbling through the colours; they land square, both on
  blue; and the blue prisoner lifts out of the jail and is gone. Then it
  loops. David asked for "a little video showing real game play with a
  hand on the screen flicking the dice", and this is that — drawn rather
  than filmed.
  - **Why not a real recording.** Nothing here can record a phone, so the
    footage would have to come off David's handset every time the game
    changed. Playing a video also needs a native video player, which
    means a new build — and builds are exactly what is stuck — so a real
    video could not have shipped at all right now. A recording would also
    go stale silently, still showing old dice and an old jail long after
    they changed, with nothing to say so.
  - It reads the game's real six colours, and it wears the colourblind
    shapes when that setting is on, so it cannot end up teaching a game
    the player is not going to see.
  - It holds still, on the finished frame, for anyone who has asked their
    phone to reduce motion.
  - The page it replaces was three emoji in a row — 👆 💨 🎲 — which is the
    one thing the whole Paper & Ink pass set out to get rid of.
  - Two things were caught by drawing the frames out and looking at them
    rather than by reading the code: the dice appeared on the table
    before the hand had touched it, and the right-hand die came to rest
    tilted at 220°, sitting there as a diamond. That second one mattered
    more than it looks — the game itself refuses to end a roll until the
    dice have landed flat, so the tutorial was demonstrating the opposite
    of the rule it teaches.

## v1.42.0 — 2026-08-25 · requested by David

### Changed
- **The screen after a game is see-through now.** David: "make the screen
  after each game transparent, it should only be solid on the Home
  Screen." That is the right split — the home screen is a page you are
  ON, and the result screen is a note laid over the battle you just
  played, so hiding the final board behind solid paper threw away the
  thing you actually want to look at. The home screen stays solid, which
  is what it was changed to on 24 August and for the same reason.
  - The wash is 62% paper, solved rather than picked. The Space arena is
    the one that decides it: its sky is nearly black, so text there has
    far less to work with than on the blue, dusk or jungle boards. Below
    about 55% the small "next unlock" line stops being readable there.
  - The result screen's body text is full ink rather than the softer grey
    used elsewhere. That grey is ink at 70%, so on a see-through panel it
    fades twice over and lands at 3.7:1 on Space — under the readable
    bar. Full ink measures 6.4:1 on the same board.
- **No more names in the News tab.** It read "AJ spotted that..." and
  thanked him by name. The News tab ships inside the app to everyone who
  installs it, so that was publishing a child's name on the App Store.
  Bug reporters are thanked without being named, and a test now fails on
  any family name in a post.

## v1.41.0 — 2026-08-25 · requested by David (a crash he reported)

### Fixed — spamming, properly this time
- **The dice now have to actually land before their colour counts.**
  David reported this twice: "you're able to just spam as fast as you can
  and get every color in only a matter of seconds", and then, after the
  first fix, "you're still able to just spam and get the dice. They
  should have to fully land for it to count as getting the color."
  - The first fix put a 650ms floor under a spammed roll. It was not
    enough, and this project's own test suite had said so in one line the
    whole time: spammed rolls measured **median 650ms and p95 650ms** —
    the same number on every single roll, which is what a clock looks
    like, not what dice look like. The floor was not a floor, it was the
    duration. Dice that need about 1500ms to come to rest were being read
    at 650ms and turned onto a face in mid-air.
  - So the shortcut is gone rather than tightened. A roll ends when the
    dice are asleep or have measured still for several frames, and there
    is no longer any way for tapping to end one — the settle rule is not
    told whether the player tapped at all. A number can be tuned back
    down by anyone who finds the game slow; a missing argument cannot.
  - Spamming Classic now takes about **134 seconds** rather than 60, and
    it is the dice setting that pace instead of a thumb.
  - **Tapping early still gets you out faster.** That was never the roll's
    job: a tap during a roll is remembered and the next throw goes out
    34ms after the dice land instead of 130ms.
- **A die that stopped leaning on an obstacle could show one colour and
  count another.** Found while checking the above, and it had been hidden
  by the bug: the old code turned every die square, including ones in
  mid-air, so nothing downstream could tell the difference. With that
  removed, 720 test rolls turned up a die sitting **dead still at 54
  degrees** off flat on Hard. It is turned square now before the result
  is shown — which never changes which colour is counted, only whether
  you can see it.

### Changed
- **The Cups icon is black and white now**, at David's request. Its
  champion was a gold dot, which made it the only diagram on the bar
  pretending to be an object — the bag is leather and the crate is wood
  because those are things, and a knockout bracket is a drawing of a
  fixture list. It was also a third gold spot on a screen that already
  has the coin and the trophy. The dot came down from 0.24 of the box to
  0.21 in the same change: a ring's weight is its outline, so a solid
  disc of the same diameter read a step heavier and turned into a blob
  on the end of the line at the 21pt the bar actually draws it. Checked
  by rendering it at that size rather than by reading the numbers.

### Fixed
- **The game crashed on launch after the last update, and it was my
  mistake.** v1.40.0 went out over the air to a binary built before the
  advertising code existed. Ads are native — they have to be compiled
  into the app — so the phone ran JavaScript asking for something that
  was not in it, and died on the red error screen before the menu drew.
  - The update has been rolled back. Force-close the app and reopen it
    twice and it comes back on the last good version.
  - There WAS a guard for this, and it did not work. The code politely
    asked for the ad module inside a "if this fails, carry on" wrapper.
    React Native's own module loader catches that failure first, treats
    it as fatal, and never hands it back for the wrapper to ignore. So
    the protection was real in the source and absent on the phone.
  - The tests could never have caught it: they run in plain node, where
    a missing module throws an ordinary error that IS catchable. Only
    Metro, on a device, behaves differently. That is now written down in
    AGENTS.md so the next person does not trust the same pattern.

### Ads are switched off for now, so everything else can go out
- **The advertising code is out of the update, and ads wait for the next
  App Store build.** Pinning the app's native version was the correct fix
  for the crash, but it had a cost nobody would have chosen: it meant
  NOTHING could reach the family's phones until a new build existed, and
  that build is stuck on a signing problem. Five versions of work —
  including the dice fix above — would have sat on a shelf.
  - So the ad code is behind a single switch, `src/game/adSdk.ts`, which
    is currently off. With it off the advertising library is not in the
    update at all, which is checked by building the bundle and searching
    it rather than by reasoning about it: zero occurrences.
  - Turning ads back on is two lines that must move together — restore
    the switch, and pin the native version again — and a test now fails
    if only one of them is done. That pairing is the thing that was
    missing when the app crashed.
  - Nothing about the ad rules changed: still one interstitial after
    every third finished game, still tagged as a child's request, still
    G-rated only. It is a delivery decision, not a policy one.

## v1.40.0 — 2026-08-25 · requested by David

### Added
- **A light, a dark and a tinted app icon**, so the iPhone Customize
  screen has all three instead of iOS inventing the missing ones by
  machine. All three are the Paper & Ink drawing David picked: two dice
  showing the same colour, on cream, with the six colours beneath.
  - There was an oddity worth recording: the OLD icon was already the
    dark one — a purple gradient left from before the game was redrawn —
    so it was the light version that had been missing all along, and the
    app it opened was cream.
  - Each variant is built differently on purpose, because Expo treats
    them differently: light is opaque and carries its own paper ground,
    dark is TRANSPARENT so iOS supplies the backdrop rather than doubling
    it, and tinted is greyscale on a light ground.
- **The Android icon matches now too.** It was still the old artwork on
  a pale blue ground, so the two platforms were shipping visibly
  different icons.
- The layers Apple's Icon Composer needs are kept in `assets/icon/layers`
  with a note on how to build the Liquid Glass version. A flat PNG cannot
  have Liquid Glass — the depth is rendered from layered artwork in a
  `.icon` bundle, and those are made in Icon Composer on a Mac.

### Fixed
- **Opening the app flashed white before anything else.** The native
  splash screen — the one iOS shows before a single line of the game has
  run — had no configuration at all, and `expo-splash-screen` was not
  even installed. So launching went white, then the near-black title
  card, then the cream game: two jarring jumps, and nobody chose the
  first one. The splash is now the same ink as the title card, carrying
  the Paper Ship mark, so the launch has one deliberate transition
  instead of two accidental ones.
- The splash also stops pointing at Expo's stock placeholder artwork —
  the grid-and-circles image every new project ships with, which was
  never replaced.

### Under the hood
- Two tests hold the native splash to the same colour as the title card
  and off the placeholder art, so the two cannot drift apart again.
- This is native configuration, so it arrives with the next build rather
  than over the air.


## v1.39.0 — 2026-08-24 · requested by David

### Changed
- **The Cups tab is a bracket now.** David said twice that Cups and the
  trophy count still looked identical, and he was right twice — because
  this was the first time either was actually RENDERED at the 21pt it is
  used at. A trophy and a medal are both "round object, outlined,
  centred" at that size, and both came out as a dark ink lozenge with a
  gold speck in it. So Cups is no longer another award: it is two
  contenders feeding into one line with a champion at the end — wide
  where a cup is tall, lines where a cup is a mass.
- **The trophy is a trophy again.** It was outlined in ink on every part
  and filled only in the bowl, which is why it read as a blob. The cup,
  stem and foot are all gold under one thin outline now.
- **Timber looks like wood.** Its rings came from a single sine, so they
  were all the same width and evenly spaced — a striped jumper. Ring
  spacing now varies across the face the way a real board's does, each
  ring is soft on one side and sharp on the other, and there is a knot
  with the grain bending round it.
- **Marble looks like stone.** Its veins were evenly spaced parallel
  curves and read as a contour map. They are now a fracture network that
  forks and wanders, running with the stone's bedding, and each vein
  swells and thins along its length instead of being one weight.

### Under the hood
- Both painters, and the icons, were rendered to an image and looked at
  before being changed. The icon was wrong twice for exactly the want of
  that.
- The die's shell texture clamps to the edge of each face instead of
  repeat-wrapping. A cube's faces show it once and never tile it, so
  repeat was bleeding the far edge of the pattern into every rim.
- A first attempt at guarding this asserted every pattern tiles, which
  three other skins failed — on a wrong premise, since nothing tiles
  them. Replaced rather than satisfied.


## v1.38.0 — 2026-08-24 · requested by David

### Fixed
- **You could swipe as fast as your thumb moved and free every colour in
  seconds.** David found it; it was mine, from v1.29.0. Rolling again
  without waiting was built so that a new swipe called the previous roll
  immediately — and "immediately" turned out to mean the very next frame.
  The test suite has been printing "hurried median 17ms" ever since,
  because it only ever checked that hurrying was FASTER than waiting, not
  that a roll still took long enough to be a roll. So one swipe both
  ended a roll and started the next, and the number of scoring rolls per
  second was set by how fast a person can tap.
- Dice must now genuinely roll for 650ms before a result can be read off
  them. Spamming a Classic game to a win takes about a minute instead of
  about three seconds.
- **Rolling again is still fast.** 650ms is well under the ~1450ms a roll
  takes to stop on its own, and a swipe inside that window is not thrown
  away — it is remembered and fires the instant the roll lands, exactly
  as before. Nothing about the dead-input feel David asked twice to be
  rid of has come back.

### Under the hood
- The floor applies to every path, not just the hurried one, so a
  feather-light tap that happened to settle in 200ms cannot become the
  new way to spam.
- The hurried-roll test is two-sided now. Three new tests state the bug
  in David's own terms — how many seconds it takes to clear the board by
  spamming — so the next regression is caught by the symptom rather than
  by the internals that happened to cause it this time.
- Two new tests run the ad code with no ad SDK present, which is the real
  shape of the builds already on the family's phones, proving it stays
  silent rather than only asserting it was written to.


## v1.37.0 — 2026-08-24 · requested by David

### Changed
- **The Cups tab is a medal now, not a trophy.** It was the same drawing
  as the trophy count, so one picture was answering two questions — a
  trophy on screen could mean "your trophies" or "go to Cups", and there
  was no way to tell which. A medal on a ribbon is the furthest thing
  from a cup that still means you won something, and the two silhouettes
  cannot be confused at tab size. Its face is a ring rather than the
  coin's sparkle, so it does not collide with the coin either.
- **The icons are coloured.** A leather Store bag, a wooden crate, a
  steel gear, a blue How-to-play, a white newspaper with a colour
  headline, and Ranks bars in bronze, silver and gold by height — which
  is what a ranking actually is. Every one keeps its ink outline, so
  they stay drawings rather than becoming flat blobs.
- **The Battle die shows the game's own colours.** Its three pips are
  real prisoner colours read from the palette itself, not copies, so the
  tab that starts a battle says what the game is about and cannot drift
  from what the dice show.
- The tab bar no longer tints its icons grey when unselected — the gold
  pill and the label weight already say which tab you are on, and the
  icons stay themselves.

### Under the hood
- Colours live in one new `ICON` block in the theme rather than being
  scattered through the drawings.
- The first blue chosen for How-to-play left the ink outline at 2.77:1
  against it and the mark unreadable; it was solved for rather than
  nudged, and eight new tests hold every fill to 3:1 for its outline and
  4.5:1 for anything reversed out of it.


## v1.36.0 — 2026-08-24 · requested by David

### Added
- **Advertising, for the 1.0 App Store release.** David asked for ads
  from launch rather than a later update, and accepted delaying the
  release to get them. One interstitial after every third finished
  game — no banners, no rewarded video, nothing mid-round.
  - Counted at the end of a game but shown on the way OUT of the result
    screen, so an ad can never land on top of the victory fanfare or an
    unlock reward.
  - Quitting a battle early does not count toward an ad, and a brand-new
    player gets three clean games before the first one.
  - An ad that has not loaded is skipped, never waited for.
- Every request is child-directed, non-personalised and capped at
  G-rated creative. The game asks for no tracking permission and touches
  no advertising identifier — which is what makes the App Store privacy
  answers true rather than merely filed.
- EU users get Google's own consent form before any ad is requested, and
  a consent failure means no ads at all rather than ads anyway.
- The real AdMob interstitial unit is configured, so this build serves
  live ads rather than Google's test ones.

### Under the hood
- `src/game/ads.ts` is the only file that touches the ad SDK, the way
  `gameCenter.ts` is for Game Center — so swapping networks, or removing
  ads, stays a one-file job.
- The SDK is required lazily rather than imported. Ads are native code
  but JavaScript ships over the air to binaries built before the SDK
  existed; a top-level import would crash every one of those installs.
  13 new tests cover the interval, the child-directed flags, and that
  nothing else in the game imports the SDK.


## v1.35.0 — 2026-08-24 · requested by David

### Changed
- **The golden trophy now sits beside the Trophies count on the Ranks
  screen**, matching the coin that already sits beside the Coins count
  two cards over.


## v1.34.0 — 2026-08-24 · requested by David

### Changed
- **The trophy symbol is golden.** The drawn trophy that counts your
  trophies — in the HUD, the Inventory, the ladder prices and the Cups
  tab — was a plain ink outline; its cup is now filled gold under the
  same outline, so the game's prize looks like one.
- **The coin looks like a struck coin.** The drawn coin gained a milled
  inset ring and an embossed sparkle stamped in its face, on top of the
  raised rim and highlight it already had — a coin now, not a gold dot.


## v1.33.0 — 2026-08-24 · requested by David

### Changed
- **The home screen background is solid now.** The new paper look shipped
  with the 3D board ghosting through a translucent wash behind the home
  and round-over screens; David asked for solid. They are full paper
  pages now — the board appears only during a round and in item
  previews.
- Because nothing shows it any more, the 3D scene also stops rendering
  behind those screens instead of burning battery invisibly, the same
  rule the menu pages have always had.


## v1.32.0 — 2026-08-24 · requested by David

### Changed
- **The whole interface is redrawn in "Paper & Ink".** David picked the
  direction from mockups (light mode only, no dark mode): white cards
  with clean ink outlines and hard offset shadows on a warm paper table,
  in place of the dark purple glass the game launched with. Every screen
  is converted — home, Store, Items, Cups, Ranks, News, Settings, the
  tutorial, the battle scoreboard and callouts, the round-over screens,
  the reward popup, the opponent-finding screen, the item preview and the
  2-player split screen.
- **The emoji icons are gone.** The tab bar's 🛒 🎒 ⚔️ 🏆 🏅, the top
  buttons and the price tags are now drawn icons, so navigation looks the
  same on every phone and stops reading as a 2010 game. Emoji stay only
  where they are content: arena and cup pictures, ladder tiers, tutorial
  art and news posts.
- **Everything readable was measured, not eyeballed.** All text on the new
  paper surfaces holds at least the 4.5:1 WCAG contrast floor — including
  the two grey ink tones, which were re-derived against the darkest paper
  they sit on rather than against white.
- The title card on launch stays ink-dark on purpose: it is the one brand
  moment, and the paper-ship mark is the light-on-dark variant.
- The colours of the game itself — the six prisoner colours, the dice
  faces, the battlefields — are untouched. This is a new outfit, not a
  new game.


## v1.31.0 — 2026-08-24 · requested by AJ (bug board)

### Fixed
- **In Ultimate, two soldiers could end up standing on the same spot.**
  Rescued figures line up along the bottom of the board, and each new
  rescue stood at position "number already rescued". Ultimate is the one
  mode where a figure can LEAVE that line — matching a rescued color sends
  it back to jail — and after that the line had a gap, the count pointed
  at a spot someone was already standing on, and the next rescue landed on
  top of them. A rescue now takes the first empty spot, so the gap gets
  filled and nobody shares. Fixed in single player and in 2-player split
  screen, which had the same flaw.

## v1.30.0 — 2026-08-24 · requested by David

### Fixed
- **The News tab was eighteen releases out of date.** Its newest post was
  v1.11.0, from 19 August, while the game was on v1.29.0 — so it was
  quietly telling players nothing had changed in five days, during which
  the game changed more than in the fortnight before. Ten catch-up posts
  written: the dice materials, the snowflakes, the tutorial, rolling again
  without waiting, the rebuilt battlefields, the themed hazards, and Game
  Center on its way.

### Added
- **News can now be written on the HQ board and appears in the game.**
  A new page at `/admin/news`: write a post, tick "Show in the game", and
  it is there the next time anyone opens the tab. No release needed.
- The bundled posts are the FLOOR, not the ceiling. The tab opens
  instantly on the posts the app shipped with — no spinner, no empty state
  — and fills in from the board afterwards. Offline, on a plane, on a
  fresh install, or if the site is down, a player sees the news the game
  came with and cannot tell anything was attempted.
- A fetched post replaces a bundled one with the same id, which is what
  makes a correction possible: fix the wording on the board and the fixed
  version reaches players without shipping anything.
- The last feed successfully read is kept on the device, so a cold start
  with no network still shows what the board said yesterday.

### Under the hood
- **No key of any kind is in the app.** The game reads a plain public URL
  on the website, and the website holds the database credentials. A token
  shipped inside an app is not a token — it is a string anybody can pull
  out of the binary. Drafts are filtered out server-side for the same
  reason: an unpublished post is not reachable by guessing a query string.
- Every failure path was written as a test first: no network, a 500, a
  reply that is not JSON, JSON of the wrong shape, an empty feed, and a
  single malformed post among good ones. That last one costs only itself.
  `fetchNews` never rejects — the screen calls it without a catch, and an
  unhandled rejection inside a popup is a red screen on a device.
- A test now checks the News tab has not fallen more than three minor
  versions behind the game, so this cannot silently happen again.
- Posts are ordered by the board's own order, then the bundle. Deliberately
  not sorted by date: the dates are free text so they read properly on
  every phone, and parsing them back to sort would invent a contract the
  person writing them never agreed to.

## v1.29.0 — 2026-08-24 · requested by David

### Changed
- **The hazards belong to their battlefield now.** Both were drawn
  identically everywhere: a green grassy sphere, and a blue pool inside a
  square of cut kerbstone. That is a castle lawn and a castle moat, and it
  was being placed in a rainforest and on an orbiting station alike — a
  grass hill on a space station, as David put it. They are the most
  looked-at things on the board after the dice, because they are what you
  are trying to roll around, so drawing them the same everywhere undid a
  good deal of the work of making the arenas different.
  - **Jungle** — a lake rather than a swimming pool. The giveaway was the
    square of cut stone running round the water; nothing in a rainforest
    has that. A low soft bank of earth instead, and the water is the
    green-brown of standing water under a canopy. The bump is a mossy
    hillock.
  - **Space Station** — no grass and no water anywhere. The bump is a
    metal bulkhead dome in the deck plating, and the pit is an open hatch
    onto the drop with a lit warning strip round it.
  - **Sunset Castle** — the same castle later in the day: grass gone
    blue-green as the light leaves it, water picking up the sky instead of
    staying noon-blue.
- **The words follow the picture.** The Hard hint and the splash callout
  said "pond" on every battlefield. They now name what is actually there —
  and on the station a die does not sink at all, it falls out: "Gone! A die
  fell through the hatch!"

### Under the hood
- The PHYSICS is untouched. Same sphere in the same place, same square
  hole in the floor, on every battlefield — Hard is Hard wherever you play
  it. A test enforces that the dressing carries no dimensions at all, only
  colours and finishes, because a hazard that behaved differently by arena
  would make choosing a battlefield a way of secretly choosing a
  difficulty. The Store sells battlefields.
- The splash callout reads the arena from a ref. It fires from a callback
  created on the first render, so reading the value directly would have
  announced every lake as the castle's pond.

## v1.28.0 — 2026-08-24 · requested by David

David sent a screenshot, which changed the diagnosis completely. Three
rounds of tuning the jungle had been spent on parts of it the camera
cannot see.

### Fixed
- **The boundary is logs lying DOWN now, not standing up.** The camera
  looks down at the arena, so an upright post presents its top and almost
  nothing else — eighty-eight of them read as a ring of sawn tree stumps,
  which is exactly what the screenshot showed. Heights, lean, overlap,
  timber shades: every property tuned over the last two releases was on
  the side of the log nobody can see from up there. It is a log-cabin wall
  now — four courses of long rails stacked along each run, with a stout
  post at each corner — because what a horizontal log shows a camera above
  is its LENGTH.
- **The bright green frame around the arena is gone.** The clearing was
  drawn with a green tint multiplied over an already-green texture, so it
  came out far more saturated than the tray floor beside it and the two
  met in a hard band. Same pixels, same colour, no seam.
- **The dark smudges are gone.** The worn-earth patches reached full
  brown against green, which on a screen reads as stains rather than as
  ground wearing thin. Rarer, softer, and capped at half strength, so a
  patch is always still recognisably the ground it is part of.

### Fixed — the arena preview lag
- **Switching battlefields showed you the previous one for a moment.** Every
  procedural texture is painted pixel by pixel in JavaScript, because React
  Native has no canvas — and the jungle floor alone takes 65 to 120ms on a
  desktop, several hundred on a phone. Each arena built its own inside
  `useMemo`, which caches only for the life of one component instance: every
  switch blocked the JavaScript thread long enough for the old frame to sit
  there, and returning to an arena already viewed paid the whole cost again.
- They are cached at module level now, built once per app run. Measured in
  the suite: **75ms to paint, 0.08ms for the next twenty**. The first view
  of an arena pays once; every view after it is free.
- The jungle asks for two textures from the same painting (the tray floor
  and the clearing, at different repeats), so the painted bytes are cached
  as well as the textures.

### Under the hood
- A test now checks each log actually points the way it is meant to. A
  cylinder's axis is +Y, so a rail has to be turned onto its side, and the
  Euler order that does it is easy to get wrong in a way that lays rails
  across the middle of the arena — nothing else here looked at rotation at
  all. It fails when the rotation is swapped.
- Four more guards on the new boundary: most of it lies down and exactly
  four posts stand, the courses stack without daylight, every rail reaches
  its corner posts, and the timber stands proud of the wall the dice
  actually bounce off.

## v1.27.0 — 2026-08-24 · requested by David

### Fixed
- **The jungle is green again.** The forest floor shipped in v1.25.0 had it
  backwards: brown earth everywhere, moss in patches, and leaf litter
  scattered thickly over the lot. David's word for it was garbage dump, and
  he was right — a rainforest clearing is overwhelmingly green, and a floor
  that is mostly dirt and debris reads as mud with rubbish on it at the
  size a phone draws it. Green ground is the base now, with bare earth
  showing through only where growth has worn thin, and about a fifth as
  many leaves, blended into the grass rather than stamped on top of it.
- **The arena border was being painted in stone.** The palisade logs were
  drawn with `MOSS_STONE` and `MOSS_STONE_DARK` — the two greens the temple
  ruins are built from — so eighty-eight posts of varying height stood
  around the arena in grey-green and never read as timber at all. They are
  wood now, five shades of it, picked per log.
- **And it was built like a heap rather than a wall.** Three things at
  once: heights ran from 0.86 to 1.36 of the wall, so the top edge was
  jagged; each post chose its lean independently, up to five degrees either
  way, so neighbours fell against each other; and the logs were narrower
  than half their spacing, so there was daylight between them. Now they
  overlap into a solid run, the whole rank leans together in a slow wave
  under two and a half degrees, and the tops vary by a quarter of the wall
  height instead of half. Every log also stands at least as tall as the
  invisible wall the dice bounce off — some used to be shorter, which made
  a die look like it had stopped against nothing.

### Under the hood
- The test guarding the palisade had only a LOWER bound on how much the
  tops vary, so "more ragged" always passed and the boundary drifted into a
  pile of sticks with the suite green. It is bounded at both ends now, and
  joined by four more: every log clears the wall, no two neighbours leave
  daylight, no post leans more than four degrees, and the logs are not
  painted with the temple's stone. All five fail on the old palisade.
- One of those tests was written wrong first and caught in the writing: it
  filed each log onto a wall by whichever coordinate was larger, which
  misfiles every log near a corner and silently compares posts on different
  walls. It keys off the coordinate pinned to the boundary instead.

## v1.26.0 — 2026-08-24 · requested by David

### Changed
- **Rolling again no longer waits at all.** This was asked for twice and
  the first version only half did it: a swipe mid-roll was remembered, but
  the roll was still not called until BOTH dice happened to be moving
  slowly and lying within about 20 degrees of flat. That wait is most of
  the wait. Median time from swiping to the roll being called has gone from
  **1483ms to 17ms** — one frame.
  - The wait existed for a real reason: reading a colour off a die balanced
    on an edge is picking one of two faces at random. That is solved now by
    SNAPPING the die onto the face it was already nearest instead of
    waiting for it to get there, so the colour counted is the colour shown.
  - A roll is still binding. It is counted, never cancelled — in Ultimate a
    matched colour sends a rescued prisoner back to jail, so a roll you can
    throw away mid-air is a rule you can opt out of. Hurrying reads the
    roll sooner; it cannot dodge it.
- **Frost is classic snowflakes.** The last attempt grew branches but still
  read as stars, and rendering it at ten times size showed exactly why: the
  one flake that happened to sit axis-aligned looked fine, and every
  rotated one had been shredded into disconnected stair-steps. A one-pixel
  arm cannot survive rotation on a 64-pixel grid when each pixel is either
  ink or not. The shape is supersampled now — sampled on a 4x4 grid inside
  every pixel — which holds the thin diagonal arms together. Six arms,
  three pairs of dendrites, a bar across each tip, a hexagonal heart.
- **The tab bar is gone after a game.** It was hidden for the battle and
  the countdown but left up over the victory, defeat and tie screens, so
  the tabs sat under a result and invited you into the Store from a match
  that had just finished. It is the home screen's bar now, and only the
  home screen's. Those screens keep their own PLAY AGAIN and HOME.

### Under the hood
- `isReadable` is deleted rather than left behind. It answered "has this
  die landed flat enough to read?", which is the question snapping makes
  moot, and a safety check that no longer guards anything is worse than no
  check at all.
- Two tests went with it and were replaced by the invariant that is now
  load-bearing: after a hurried call every die is lying flat, and snapping
  never changes which colour is up — checked over 400 orientations,
  including the awkward ones balanced on an edge and on a corner. If
  snapping could turn a die onto a different face, hurrying would be
  changing results rather than reading them sooner.
- One screen test matched an exact source line rather than behaviour and
  failed the moment the guard in front of the tab bar grew a second clause.
  It reads the guard now.

## v1.25.0 — 2026-08-24 · requested by David

### Changed
- **Frost is snowflakes now.** It was three needles crossed through a
  point — a six-armed asterisk, which is a star with nothing on it, and at
  a glance it read as a sparkle rather than as snow. A snowflake is
  six-fold symmetric with DENDRITES: shorter arms angled forward off each
  spine, longest near the middle and shortest near the tip. Those branches
  are the whole silhouette. Every flake gets its own size and its own spin
  so no two in view are the same one.
- **The jungle rolls on ground instead of on the castle's floor.** Jungle
  Clearing was using the castle's flagstone texture tinted green — laid
  slabs, grout and all. That is the surface the camera is centred on and
  the dice come to rest on, so of everything in the arena it was doing the
  most to make the jungle look like the castle repainted. It is a forest
  floor now: damp earth mottled at two scales, moss in patches with soft
  edges, and fallen leaves scattered where they fell, each one turned to
  its own angle with a darker midrib. The clearing around the tray gets it
  too — that was one flat green plane, 34 by 40, the biggest unbroken
  surface in the arena.

### Tutorial
- Slide 2 says **swipe** rather than flick. (The physics code still calls
  it a flick internally; this is the word a player reads.)
- Slide 3's heading is **"Match two colours to free a prisoner"**. It read
  "Two the same frees one", which needs you to already know what "two" and
  "one" refer to — on the page that teaches the only rule in the game.
- Slide 4 is **"It's a race"**.

### Under the hood
- The new floor is deterministic, unlike the flagstone it replaces, which
  used `Math.random` and so was different on every launch and could not be
  checked at all. It is measured instead: no row is dark enough to be a
  grout line, it meets itself no worse at the wrap than anywhere inside
  the tile, and it is identical between builds.
- The moss needed three octaves of noise. One octave is interpolated
  across an 8x8 grid, and the blend between cells leaves diamond and
  square corners on every patch — the moss came out looking like
  camouflage.
- Two frost tests were written that passed on nothing: they thresholded
  ink at a fixed brightness, and frost's shell is a very pale blue that
  fell on the ink side of it, so the whole texture counted as ink. The
  threshold comes from the painter's own tone range now. Both fail on the
  old asterisk.

## v1.24.0 — 2026-08-24 · requested by David

### Changed
- **Timber, Marble and Granite are smooth now.** All three picked their
  tone from a ladder of thresholds, so a whole 64x64 face was painted in
  five tones and every threshold crossing was a hard cliff — the blocky,
  staircased edges that made the wood read as corduroy and the marble as
  cut paper. They ramp between the same tones instead. Wood went from 5
  distinct tones to 63, marble 5 to 95, granite 7 to 69.
  - **Timber**: one continuous fade from pale early wood into the dark
    late-wood ring, and the fine grain fibres halved — at their old
    strength they chewed a ragged edge into every ring, which was most of
    what made the plank look coarse.
  - **Marble**: the vein and the halo it bleeds into the stone are one
    falloff rather than a sharp line inside a second hard band. That pair
    of edges was what made the veins look drawn on with a pen and a
    highlighter.
  - **Granite**: the flecks were jumping most of the full range per pixel,
    which at this size is television static rather than stone. They are a
    third of that now, over two smooth scales of mottling.
- **Silver is the silver version of Gold.** It was brushed — thousands of
  fine scratches running one way — deliberately a different SHAPE from
  gold so the two could never be one picture in two tints. David asked for
  them to match, so silver is a polished sweep of light now. It is still
  not gold repainted: silver is a harder, cooler mirror, so the bar of
  light is tighter and brighter and the catch off the far edge is
  stronger. Gold spreads its highlight; silver snaps it.

### Under the hood
- The rule that no two skins may share a pattern is deliberately overruled
  for these two, and the test that enforced it now says so. It still
  passes — they are separate painters with separate ids — but it passes on
  a technicality, and anyone tightening it to compare pixels needs to know
  gold and silver are meant to match.
- The granite test used to require 200 pixel-to-pixel jumps of more than
  25 tone, and granite obligingly produced 1258 of them. A guard written
  to protect one quality had quietly mandated the fault David was looking
  at. It now checks both ends: enough gentle flecks that granite is not
  fog, few enough harsh ones that it cannot go back to static.
- A new test counts how many distinct tones each material paints, which is
  the one number that separates a ramp from a staircase. It fails on the
  old painters.

## v1.23.0 — 2026-08-23 · requested by David

### Added
- **Game Center.** The Ranks page has had a "Not live yet" note on it since
  the beginning; it is live now. Trophies and battles won go onto two real
  leaderboards, ten achievements are reported as you earn them, and two
  buttons open Apple's own world-ranking and achievement screens. It uses
  the phone's Apple account, so there is still no login, no password and
  nothing personal stored by this game.
- The ten achievements: First Victory, Ten Battles, Fifty Battles, The Hard
  Way, Every Way to Play, one for each of the four arena unlocks (Sunset
  Castle, Jungle Clearing, Space Station, Midnight), and Collector for
  owning ten sets of dice. 500 points of Apple's 1000, leaving room for new
  achievements when new dice and arenas ship.

### Changed
- **Collector is ten sets, not every set.** It was going to be "own every
  set of dice", which quietly changes meaning every time a die is added —
  a moving finish line, worth less to whoever got there first. A fixed
  number means the same thing in five years. New dice get their own
  achievement out of the spare 500 points instead of stretching this one.
- **A save with a typed-in number stays off the shared board.** The trophy
  and coin codes set a count to whatever you type, which is right for
  looking at a locked arena on your own phone and wrong for a ranking that
  puts you above people who actually played. Such a save keeps every local
  reward, every unlock and every record, and simply does not post. Family
  tester mode does NOT count: it unlocks cosmetics and invents no number,
  so testing an arena never costs you your place.

### Under the hood
- Everything Game Center is told is a QUESTION ABOUT THE CURRENT SAVE
  ("does this player have ten sets?"), never an event ("a set was just
  bought"). Event-shaped reporting loses an achievement for good if the one
  moment it could fire happens offline; asking again after the next battle
  heals itself.
- A report is only remembered as sent once Apple has accepted it. Marking
  it at the point of sending looks equivalent and silently destroys the
  retry — a report lost to a dropped connection would be remembered as
  delivered and never tried again. That bug was written and then caught by
  a test that fails when it is reintroduced.
- Nothing outside `src/game/gameCenter.ts` imports the Game Center package,
  which still reports scores through `GKScore` — soft-deprecated by Apple
  in iOS 14. Replacing it is a one-file job.
- The achievement identifiers are checked in the test suite against the
  ones read back from Apple's own API. They are the one part of this that
  can never be fixed later: an identifier cannot be renamed or deleted once
  it has shipped, so a typo would be a dead achievement for the life of the
  app.
- The Game Center entitlement is set directly in `app.json` rather than
  through the package's config plugin, which Expo cannot resolve (no
  `app.plugin.js` at its root). All the plugin did was set that one key.

### Needs a new build
- This is the first change in a long while that an over-the-air update
  cannot deliver. Apple bakes entitlements into the binary, so Game Center
  does nothing until a new build reaches TestFlight. On the current build
  the code detects there is no Game Center and quietly does nothing.

## v1.22.0 — 2026-08-23 · requested by David

### Changed
- **The battlefields stop being the same building.** David said the themes
  all just looked like the castle in different colours, and he was right:
  every arena was four full-height box walls at the tray edge with a
  different ornament on top — merlons on one, light strips on another,
  cracked slabs on a third — and four round corner towers. The props
  differed (palms, solar panels, tiki parasols) but the SKYLINE did not,
  and a skyline is what you recognise a place by.
  - **Jungle Clearing** is now ringed by a log palisade driven into a low
    earth bank: 88 logs, every one a different height and lean, cut to a
    point, bound with vine lashings. The corners are buttress trees that
    flare into roots and carry a canopy well above the wall, instead of
    round towers with a cap.
  - **Space Station** is mostly open. The hull is knee-high now, and what
    stops the dice above it is a see-through containment field hung
    between emitter studs — so you look out across the deck rather than
    standing in a grey keep. The corner pylons are thin masts on small
    bases rather than towers.
- The physics boundary has not moved on either. The tray walls are the
  same invisible full-height boxes they always were; only what is drawn in
  front of them changed. The field panel spans the full height on purpose,
  so a die still visibly stops where it always did.
- The jungle's palisade lives in `src/arena/palisade.ts` as data rather
  than inside the component, so its shape can be measured. Nothing in this
  project can render a 3D scene to look at, which is exactly how a
  palisade could quietly become an even picket fence with every test still
  green. The suite now checks it has enough logs to be a palisade, that
  the tops are ragged rather than level, that some clear the wall the dice
  actually bounce off, and that it is identical between builds.

## v1.21.0 — 2026-08-23 · requested by David

### Added
- **How to play.** Six short pages: the six prisoners, how to throw, the
  one rule the whole game is built on (both dice the same frees that
  prisoner), that it is a race, the four modes, and what trophies and
  coins are for. It opens by itself the first time the game is ever
  launched, and after that it lives behind a ❓ next to the gear — because
  the person who most needs it is whoever gets handed the phone in six
  months.
- Each page has a picture, which for a game whose signal is COLOUR does
  more work than the words. If colourblind mode is on, those pictures wear
  the shapes too — teaching somebody the colours-only game when they have
  asked for shapes would be teaching a game they are not going to see.
- The words live in `src/game/tutorial.ts` rather than inside the screen,
  so the test suite can check them against the rules the game actually
  implements. A tutorial is the one part of a game that can be WRONG
  rather than broken: nothing crashes when it describes a rule that has
  changed, it just quietly misleads the one person who cannot tell. The
  suite now fails if a mode exists that the tutorial never mentions, if
  the matching rule stops being stated, or if the palette stops having six
  colours in it while a page says "six".
- Measured on an iPhone SE with the real layout engine: the page gets
  389pt and the Back / Let's play buttons keep their full height. A
  first-time player who could not reach the button that closes the
  tutorial would be stuck in it.

## v1.20.0 — 2026-08-23 · requested by David

### Added
- **Dice made of real materials.** Three new sets in the Store — Marble
  (500), Granite (550) and Silver (650) — and two existing sets rebuilt:
  - **Gold** was a flat yellow cube. It now has a sweep of light rolling
    across it like polished metal.
  - **Silver** is brushed rather than polished: thousands of fine
    scratches running one way, each catching the light differently.
  - **Marble** has veins that wander, each with the soft halo where the
    mineral bled into the stone — leaving that off is what makes marble
    look drawn on with a pen.
  - **Granite** is mottled rock under a scatter of quartz and mica flecks.
  - **Timber** has growth rings that bend and vary in spacing, instead of
    the even wavy bands it had, which read as a painted pattern.

### Changed
- Shell textures can now darken as well as tint. The dice are drawn unlit
  on purpose (two dice under real lights once rendered as different whites
  on a phone), so nothing on a shell gets a highlight or a shadow from the
  scene — it has to be painted in. Being able to go both ways from one ink
  colour is what lets gold have a bright band and the dark trough beside
  it. Every pattern written before this is untouched.
- Silver deliberately does not share gold's pattern. Two skins that are
  one picture in two tints is what made Frost and Starry indistinguishable,
  and the suite refuses it — so silver is a different SURFACE, not a
  different metal.

## v1.19.0 — 2026-08-23 · requested by David

### Changed
- **Tapping again while the dice are still rolling now speeds the roll up
  instead of just queueing behind it.** The moment both dice are down and
  lying flat, the roll is called and the next throw goes out — measured
  over 240 rolls per difficulty, tap-to-tap drops from about 1.5s to about
  1.25s, and the slow rolls (95th percentile) from 2.0s to 1.8s. The pause
  after a result is 60ms rather than 130ms when you have already tapped,
  because you have seen the result and are waiting.
- The roll is still binding. Hurrying it changes WHEN it is counted, never
  whether — a roll you could throw away mid-air would make Ultimate's
  "matching a rescued colour sends that prisoner back to jail" a rule you
  could opt out of by tapping.
- The safety is that a roll is only ever called early on dice that are
  down, slow, AND lying within about 20° of flat. A die balanced on an
  edge has two faces it could fall onto, and picking one would be a rigged
  roll rather than a fast one. Tested by throwing a die and checking it
  reads as unsettled one physics step in, while airborne.
- **"Moat" is now "pond"** in the splash message on Hard. The difficulty
  hint already said pond; this was the last place using the other word.

## v1.18.0 — 2026-08-23 · requested by David

### Changed
- **Coins are spent in the Store and nowhere else.** Previewing a Store
  die from your Inventory now says "In the Store for 300" and cannot be
  pressed, instead of quietly selling it to you. The Inventory is the
  cupboard: it should show what a die costs without putting a child one
  tap away from having spent 450 coins they meant to look at.
- Whether you can afford it is checked *after* where you are standing, not
  before — otherwise a rich player could buy from the cupboard and a poor
  one could not, which is the version of this bug that would have looked
  like it worked.
- **Buying closes the preview and shows the PURCHASED popup.** The button
  used to flip from "Buy for 300" to "Use this one" in place, so the
  biggest thing that happens in this game — spending coins you played for
  — passed with nothing to mark it. It gets the same moment as earning an
  unlock now, and the popup says to tap the die again to put it on.

## v1.17.1 — 2026-08-23 · requested by David

### Fixed
- **A preview now shows the item and nothing else.** The tab bar and the
  trophy and coin pills were already stepping aside for it, but the home
  screen itself was not — so the mode picker, the difficulty picker, the
  next-unlock line and the START button all stayed sitting across the very
  thing the preview existed to show. All of it goes away now; you get the
  battlefield, the item on it, its name, and the one button.
- The test for this asks the general question rather than listing the
  pieces that happened to be wrong: every part of the screen drawn on the
  home screen must be hidden during a preview. Adding a new control to the
  home screen and forgetting it now fails before it ships.

## v1.17.0 — 2026-08-21 · requested by David

### Changed
- **Every item opens as a preview now, and that is where you buy and equip
  it.** Tapping a card in the Store or the Inventory no longer changes
  anything — it puts that item out on the real battlefield at full size,
  with the buy or use button underneath. A 58pt thumbnail was never enough
  to choose from, and it was certainly not enough to tell Frost from
  Starry.
- The preview is not a picture of the game, it IS the game: the board is
  already on screen, so opening a preview steps the menu aside and swaps
  the previewed dice or battlefield into the scene you were already
  looking at. Nothing is drawn twice, so nothing can disagree with the
  table. Locked items open too — seeing the battlefield you are saving for
  is the reason a locked card is shown at all.
- The button says one of five things and only two of them can be pressed:
  use it, buy it, or how many coins or trophies you still need. Coins and
  trophies stay separate on purpose — one means keep saving, the other
  means keep playing, and telling a five-year-old the wrong one is worse
  than saying nothing.
- **New wording for the dice in the Store**, which used to talk only about
  how coins are earned and never about the dice themselves.
- **The colourblind setting keeps its shape icon when it is off.** It used
  to swap to a blank white square, which read as a second empty checkbox
  beside the real one — and a setting about shapes losing its shape is the
  one state where the icon has nothing to say.

### Fixed
- A dice skin that was locked again (after family tester mode went off)
  drew as ivory wearing the locked skin's pattern. The board took the
  shell colour from a resolver that falls back and the pattern straight
  from the stored id, which does not. One resolved skin now feeds both.

### Caught before release
Both of these were found by testing the preview rather than by playing it,
and neither would have been obvious until somebody hit it:
- **A tap on the see-through middle of a preview started a real battle.**
  The menu pages used to be opaque and swallowed every touch; a preview
  takes that away on purpose, and the throw gesture underneath had no idea
  a preview was open. It now refuses the touch outright, and a preview is
  closed by anything that moves the game off the home screen — otherwise
  its buy button would have stayed live on top of the match.
- **"3 more trophies to go" could not be read.** That button was a white
  wash over the live board with white text on it, which on the sunlit
  castle floor came out at 1.65:1. It is dark-backed now, like the title
  and the hint, and reads at better than 15:1 on every battlefield.

## v1.16.1 — 2026-08-21 · requested by David

### Fixed
- **Every price now shows the drawn gold coin.** The HUD had been drawing
  its own coin for a while — three circles, guaranteed gold — while every
  price tag in the Store and the Inventory still printed the coin emoji,
  which renders silver on some phones and a flat disc on others. The same
  currency wore two different faces one tab apart. Prices, Your Records and
  the Settings message all use the drawn one now, through a single
  `CoinLabel` so there is only one way to show coins.
- **The Inventory lists dice cheapest first.** It was reading the raw list
  in the order the dice were written down, and the Store prices were typed
  out of sequence — 250, 300, 450, 400, 350 — so a 450-coin die sat above a
  350-coin one. Trophy dice come first, cheapest up, then the coin dice,
  cheapest up. The Store already sorted its own shelf; the Inventory never
  did. The tests now pin both, and that every die is still listed exactly
  once after sorting.

## v1.16.0 — 2026-08-21 · requested by David

### Changed
- **MONEY is gone; the coin code is now "X COIN".** Type `500 COIN` and
  you have exactly 500 coins — the same way `500 TROPHY` sets the trophy
  count. The word can go either side of the number (`COIN 500` works too),
  and case and spacing do not matter.
- Setting rather than adding is the point: the old code only ever handed
  over another 10,000, so once you were rich there was no way back down to
  see how the Store looks to a player who is not. Now there is.
- Coins stop at 999,999 — past that the number stops fitting the pill in
  the corner. Anything you already bought stays bought, even if you set
  yourself to zero.

## v1.15.1 — 2026-08-21 · requested by David

### Fixed
- **The Settings rows no longer run to the edges of the panel.** They had
  no horizontal inset at all, so every slider, toggle and button pressed
  against the rounded border while the title sat neatly inside it. All of
  it now shares the title's inset, including the version line — which sits
  outside the scrolling area and so needed telling separately.
- Narrowing the sliders is safe because each reads its live width and
  screen position when it lays out, rather than assuming either, so the
  touch maths follows the new size. The test suite now asserts those two
  reads still exist: losing them is what would make this break quietly
  later rather than loudly now.

## v1.15.0 — 2026-08-20 · requested by David

### Changed
- **Settings and News have left the bottom bar.** They are two small icon
  buttons at the top right of the home screen now, level with the trophy
  and coin pills. Neither is somewhere you go during play, so neither was
  earning its place among the things you move between constantly.
- **The bar is five tabs**: Store, Items, Battle, Cups, Ranks — Battle dead
  centre. Five cells leave about 75pt each on a small phone where seven
  left 53, so the labels go back up to a readable size.
- **Settings and News open as popups over the game**, dimmed but still
  visible behind, so it is obvious you have not gone anywhere. Two ways
  out: the ✕, and tapping the dim.

### Fixed before release
Two bugs were caught by the test agent before this shipped, both flexbox
arithmetic that the typechecker and 247 existing tests all passed happily:
- **The Settings popup rendered its whole body at zero height** — every
  slider, the toggle, the code box and the Report a Bug button, gone. A
  `flex: 1` scrolling area means "grow into space my parent proves it
  has", and a panel capped by `maxHeight` with no height of its own can
  never prove any.
- **The News popup clipped its older entries** with no way to scroll to
  them, and would have quietly lost one more with every entry added.
- Notably this is the OPPOSITE of the right answer three releases ago,
  when the same two properties were swapped the other way. What changed is
  whether the parent's height is known.

### Added
- **A test suite that runs the real layout engine.** Everything else here
  reads the source as text, which is why neither bug above was caught —
  a regex can see that a style exists, never what it resolves to. The new
  suite builds the actual popup trees in Yoga (the same algorithm React
  Native ships) and asserts the scrolling area comes out with real height,
  in the same spirit as the physics suite running real cannon-es.

## v1.14.2 — 2026-08-20 · requested by David

### Changed
- **The scroll bar in Settings is hidden again.** It draws over the
  right-hand edge of whatever it passes, and on a page of sliders and
  toggles that means sitting on top of the controls.
- The rubber-band bounce stays, which is the part that actually tells you
  the page can move. It was the missing bounce, not the missing bar, that
  made this page feel like a dead end back in v1.13.5 — and the page no
  longer runs underneath the tab bar, so there is nothing hidden down
  there for an indicator to hint at.

## v1.14.1 — 2026-08-20 · requested by David

### Fixed
- **The bottom of Ranks, Items and Settings is reachable again.** The tab
  bar was drawn ON TOP of every page, which left each page responsible for
  remembering to pad around it. Store, Inventory and Leaderboard used a
  flat 24pt with no allowance at all, so the bar sat over the last stretch
  of those pages and you could not scroll past it.
- **The bar is now its own section of the screen.** Every menu page ends
  where the bar begins, rather than running underneath it and hoping. That
  turns "remember to leave room" into something that cannot go wrong: there
  is no room down there for a page to lose. A page's own bottom padding is
  breathing room again, not clearance.
- Settings, News and Cups had been padding by the bar's height themselves;
  that allowance is gone, since keeping it would now leave a dead strip the
  size of the bar at the bottom of each.

## v1.14.0 — 2026-08-20 · requested by David

All three of David's reports from a real iPhone 15 turned out to share one
cause: nothing in the app knew that modern iPhones reserve a strip at the
bottom of the screen for the home indicator — the bar you swipe up on.

### Fixed
- **The bottom row of tabs now fits.** It was drawn with a flat 18pt of
  padding against the 34pt an iPhone 15 needs, so the labels sat inside
  the home indicator strip. The bar reserves the real inset now, and each
  label holds one line regardless of the phone's text-size setting — seven
  cells across the narrowest iPhone is about 53pt each, and a player who
  has turned iOS text up should not be the one who breaks the row.
- **The version number in Settings is always visible.** It only appeared
  if you tapped the secret-code box: it was still inside the flex layout,
  the scrolling area was taking the space, and opening the keyboard
  squeezed the panel just enough to reveal it. It is now positioned
  absolutely, outside both the flex flow and the keyboard-avoiding view,
  anchored above the tab bar where nothing can move it.
- **A bug report can be abandoned without sending it.** The Cancel button
  existed but sat under the keyboard, because the box takes focus as the
  screen opens and the panel is centred. The panel lifts clear now, and
  tapping the dimmed area behind it closes it too. Taps inside the panel
  are ignored, so missing a button by a few points does not throw away
  what you typed.

### Fixed (found by the smoke test, not reported)
- **The Done button on Store, Inventory and Leaderboard never worked.**
  All three drew it underneath the tab bar, which is opaque and sits on
  top — so it was invisible, and a tap there hit whichever tab was over
  it. It has been removed rather than moved: the tab bar is the way out of
  these pages, as it already is on Settings and Cups. The unused `onClose`
  wiring went with it.
- The in-battle HUD's distance from the bottom edge was a hardcoded 34 —
  right on a Face ID iPhone only because that happens to be the inset, and
  34pt of wasted board on a phone with a home button. It is derived now.
- The report panel's keyboard lift is deterministic rather than settling
  over several layout passes; centring moved inside the keyboard-avoiding
  view, which is where it belongs when the view grows its own box.

## v1.13.5 — 2026-08-20 · requested by David

### Fixed
- **The Settings page now behaves like the scrolling page it is.** It has
  always scrolled, but two flags hid every sign of it: `bounces={false}`
  meant pulling at the page did nothing, and the scroll indicator was
  hidden, so there was no bar to say anything sat below the fold. A page
  taller than the phone read as a dead end — which is the real reason the
  version line at the bottom read as missing rather than as further down.
- Both cues are on now. The indicator fades away by itself when you stop,
  so it costs nothing at rest.

## v1.13.4 — 2026-08-20 · requested by David

### Fixed
- **The version number is back, and now actually visible.** v1.13.3 pinned
  it below the scrolling area, which was the right move but made it vanish
  outright.

  The cause was a flexbox default. `settingsScroll` carried
  `flexGrow: 1, flexShrink: 1` and no `flexBasis`, which leaves flexBasis
  at `auto` — and for a ScrollView, `auto` means it starts out as tall as
  ALL of its content, hundreds of points of sliders and sections. With
  nothing beneath it that never showed. The moment the version line became
  a sibling underneath, the scroll started from that enormous basis,
  claimed the whole panel, and pushed the line off the bottom.

  `flex: 1` sets flexBasis to 0, so the scroll takes only what is left
  after the pinned footer — which is the entire point of pinning one.
- A test now fails if that basis is ever lost again, verified by
  reintroducing the exact bug and watching it go red.

## v1.13.3 — 2026-08-20 · requested by David

### Fixed
- **The version number in Settings is now pinned in place**, below the
  scrolling area instead of inside it. v1.13.2 gave it more breathing room,
  which did not help: the real problem was that it was the last thing in a
  scrolling list, so it only appeared once you had scrolled all the way
  down — and `bounces={false}` gives no hint there is anything below the
  fold, so it read as cut off.
- As a fixed footer it is on screen at every phone height, rather than at
  whichever height it happened to be measured against. `flexShrink: 0`
  keeps a short screen from squeezing it away.

## v1.13.2 — 2026-08-20 · requested by David

### Fixed
- **The version number at the bottom of Settings was clipped.** The scroll
  area ended exactly where its last row did, so the final line sat flush
  against the edge — and `bounces={false}` meant you could not even drag it
  into view to see what was cut. There is room under it now.
- The padding sits on the scroll container rather than on the version line,
  so anything added below it later gets the same clearance instead of
  inheriting the same fault.

## v1.13.1 — 2026-08-20 · requested by David

### Fixed
- **The keyboard no longer covers the secret-code box.** Tapping it opened
  the keyboard straight over the thing you were typing into. The Settings
  page now shrinks by the keyboard's height and scrolls the box up into
  what is left, so you can see what you type.
- Two details that matter for it working on a real phone: the scroll waits
  for the keyboard to finish appearing rather than firing on tap — at tap
  time its height is not known yet, so the scroll lands short, and by a
  different amount depending on whether the autocorrect bar is showing. And
  the position is measured rather than assumed, so it keeps working if
  anything is ever added below the box.

## v1.13.0 — 2026-08-20 · requested by David

### Added
- **A new secret code: "500 TROPHY".** Any number followed by the word
  sets the trophy count to exactly that — `137 TROPHY` gives you 137. The
  word can go either side of the number, so `TROPHY 137` works too; a
  child typing a cheat code should not have to remember the order.
- It **sets** rather than adds, so it goes down as readily as up. Standing
  at a chosen rung of the ladder and seeing what is unlocked there is the
  point, and that needs both directions. Going down relocks things; the
  equipped dice and arena already fall back on their own when they are no
  longer owned.
- Crossing a tier shows the usual unlock popup, so the reward moment can be
  tested without grinding for it.
- Wins are deliberately left untouched. They are a record of what was
  actually played, and a cheat that rewrote history would make Your
  Records lie.
- Numbers past 99,999 are capped, and it says so rather than pretending.

## v1.12.2 — 2026-08-20 · requested by David

### Fixed
- **Difficulty now applies in 2-player split screen.** It never did: the
  split screen passed an empty courtyard regardless, so picking Hard and
  handing the phone over quietly put both players back on Easy. Difficulty
  in this game IS the obstacles you roll on rather than how the opponent
  plays, which is exactly why it carries to a human opponent unchanged.
  The chosen difficulty now rides across from the start screen the same
  way the mode already did, and both the button and each zone's scoreline
  name it.
- Both players roll on **one shared layout**. Obstacle positions are rolled
  at random, so generating them per zone would have put the hill — and on
  Hard the pond — somewhere different for each player. In a head-to-head on
  one table that is not variety, it is one player getting the easier
  courtyard.
- A rematch rebuilds each zone's physics world around the new obstacles.
  The scene builds its world once per mount, so without this the dice would
  have collided with the previous match's hill while the new one was drawn
  somewhere else.

### Changed
- **"Shapes on the dice" is now "Colorblind mode"** in Settings, and in the
  news entry that introduced it. It stopped being only about the dice when
  the shapes went onto the prisoners too, and naming the setting after what
  it is for makes it findable by someone who needs it.

## v1.12.1 — 2026-08-20 · requested by David (reported on the ideas board)

### Fixed
- **Sunset Castle now actually looks like sunset.** It was the day castle
  with seven colours swapped — roof, grass, hills, water, clouds and two
  umbrellas — and nothing else. It cost 100 trophies and then looked like
  the arena you already had.

  The reason it could never work: **lighting was global to the scene and
  identical for every arena.** A high white sun stayed overhead no matter
  which battlefield you picked, and no amount of repainting says "evening"
  underneath a midday sun.

  Lighting now belongs to the arena (`ArenaLighting` in
  `src/arena/arenas.tsx`). Sunset Castle gets a low amber sun raking in
  from one side, cool blue skylight filling the other, and less light
  overall — evening is darker as well as warmer. Because the lights are
  global they fall on the dice and the prisoners too, so the whole table
  changes hour, not just the scenery.

  On top of that: a real gradient sky dome (gold at the horizon through
  pink to deep indigo overhead), the sun itself sitting low behind the
  hills on the same side the light comes from, lit windows in the corner
  towers, and a dusk landscape — trees near silhouette, hills and meadow
  gone deep, mountains a dusty violet.

### Fixed (found while building the above)
- The sky gradient was writing linear-light values into a texture declared
  as sRGB, so the GPU decoded them a second time and the whole sky came out
  far too dark. Caught by a test comparing the stored bytes against the
  colours asked for.

## v1.12.0 — 2026-08-20 · requested by David

### Added
- **The version number now shows in Settings**, under Report a Bug — so
  when someone reports something, the release it came from is one look
  away rather than a guess.

### Fixed
- **Bug reports were stamped with the wrong version, and had been for
  eleven releases.** They sent `app.json`'s native version, which sat at
  1.0.0 since the first build — an over-the-air update cannot change it,
  and almost every release has been over-the-air. Reports now carry the
  game version from the bundle (right the moment an update lands) as
  well as the native build number.
- The version lives in `src/game/version.ts`, and `npm test` fails if it
  does not match the newest heading in this file — a release that forgets
  to move it cannot go out.

## v1.11.8 — 2026-08-20 · requested by David

### Fixed
- **The menu no longer moves when you pick a difficulty.** Easy's hint
  wraps to two lines where Medium's and Hard's fit on one, so the stakes
  line and everything under it shifted between taps — the same fault the
  mode rules had. Both now reserve their height.
- The next-unlock line is held to one line as well, since arena names
  differ in length and it sits above the whole picker.

## v1.11.7 — 2026-08-20 · requested by David

### Added
- **The studio mark, from the design handoff**, in all three places it
  belongs: the game's title card (reversed variant, since that card is
  near-black), the website header and footer, and the admin header —
  which was a 🛠️ emoji. The site also gets a favicon, which it never had.
- **Colourblind shapes now sit on the prisoners as well as the dice.**
  The move is matching a rolled colour to a PRISONER, so shapes on one
  side left the other half of that judgement on colour. Split screen
  gets them too.

### Changed
- The mark's geometry is the handoff's: a short front sail and a tall
  main sail, where the old one drew both the same height.
- **No Done button in Settings** — it is a tab now, so you leave by
  tapping another one.

## v1.11.6 — 2026-08-20 · requested by David

### Changed
- **Settings is a page of its own**, like every other tab. It was still
  opening as a translucent card over the home screen; it is now solid,
  full height, and matches Store, Cups, Items, Ranks and News. Done
  returns you to Battle.

## v1.11.5 — 2026-08-20 · requested by David

### Changed
- **Color War stands both sides along the bottom row** — yours on the
  left three spots, your opponent's on the right three. Theirs used to be
  paraded on the far battlement instead. Scores are now counted by colour
  rather than by where a figure stands, since the two share a row.
- **The Store and Inventory show the real dice.** They showed a flat
  colour square with an emoji on it — 🦓 on white for Zebra — which told
  you nothing about what you were buying. The picture is generated by the
  same painter that builds the 3D shell, so the shelf and the table
  cannot disagree.
- **Settings is a tab on the bottom bar**, and Battle sits dead centre of
  the seven. Settings still opens as a popup over the game rather than
  becoming a page of its own; the floating gear is gone, since the bar
  reaches the same place.

## v1.11.4 — 2026-08-20 · requested by David

### Added
- **RESET code** in Settings: forgets everything bought with coins so the
  Store can be walked through from scratch. Coins are deliberately NOT
  refunded — the point is to buy the items again. If the wiped skin was
  the equipped one, the loadout goes back to Ivory.

### Fixed
- **Family tester mode now covers the Store.** It opened the trophy
  ladder and the arenas but stopped at anything with a coin price, so a
  playtester still had to grind for half the dice. Nothing is bought by
  the code — the items simply become usable while it is on, and cost
  coins again the moment it goes off.

## v1.11.3 — 2026-08-20 · requested by David

### Fixed
- **The game-name bar across the top is gone.** It spanned the full width
  at y58 while the trophy and coin pills sit at y52 on the left, so the
  two ran into each other. The name was already on the launch card and
  again in the heading below it, so nothing is lost.
- The trophy and coin pills now show only on the home screen and the
  menus. They also appeared on the result screen, where the centred
  scoreboard would have collided with them the same way — that screen
  reports what you won in its own text.

## v1.11.2 — 2026-08-20 · requested by David

### Fixed
- **The trophies, coins, settings gear and bottom menu no longer show
  through the title card.** They carried a zIndex (30, 5 and 35) and the
  card carried none, so tree order counted for nothing and all four
  punched through it on launch.
- **Menu pages are solid.** They sat at 96% opacity, so the arena showed
  faintly behind the Store, Cups, Items, Ranks and News. Settings stays
  translucent on purpose — it is a popup over the game, not its own page.
- **The board stops rendering behind a menu** rather than running unseen.

### Changed
- **The coin icon is a drawn gold coin** instead of 🪙, which renders
  silver or flat depending on the phone.
- The studio name sits a little higher on the title card.

## v1.11.1 — 2026-08-20 · requested by David

### Fixed
- **The title card now comes before the loading, not after it.** The game
  was rendered on the very first render with the card drawn on top, so the
  GL canvas, physics world, audio players and four storage reads all ran
  before React could paint anything — the card arrived once the slow part
  was already over. The card renders alone now and the game mounts a beat
  later, underneath it.

### Added
- **A sound on the title card** — a rising note, once per launch. It waits
  for the saved volume settings first, so a muted phone stays muted.

## v1.11.0 — 2026-08-19 · requested by Marc and David

A bottom menu bar, tournaments, news, and a long list of fixes.

### Added
- **Bottom navigation.** Store, Leaderboard and Inventory were buttons on
  the home screen that opened modals. They are tabs now, alongside two new
  ones, on a fixed bar — the Clash Royale shape Marc asked for.
- **Cups.** Three knockout brackets against the AI roster: Courtyard Cup
  (free, 4 players), Castle Classic (50 coins, 4) and Grand Championship
  (150 coins, 8). Win every round to take the prize; one loss ends the run.
  Offline by design — real bracket play needs accounts and a server.
- **News tab.** What changed, in plain words, bundled with each update.
- **Title card on launch** with the game's name and Paper Ship Studio.
- **Opponent reveal** before each round — names shuffle, then the rival you
  actually face is shown.
- **Colourblind mode** (Settings): every colour also gets a shape.
- **All four modes in split screen**, not just Color Rush.
- **Sounds** for button presses and equipping an item.
- **Unlock and purchase popups**, both saying where to go to equip.
- **MONEY** code in Settings adds 10,000 coins for testing.

### Changed
- The app is **Dice Battles: Color Rush** everywhere now; the phone used to
  show the short name deliberately, and no longer does.
- **Classic → Color Rush**, **Standings → Leaderboard**, "wandering moat" →
  "pond".
- The **"❓ Mystery Arena"** placeholder is gone — every tier shows its real
  name from the start.
- **Rewards vary** within a band instead of paying a fixed number. An easy
  win is 10–20 coins. Losing still never costs coins.
- **The ladder starts closer**: the first reward cost 100 trophies, now 40,
  with gaps widening the whole way up. Ivory Dice joins it at 0.
- **Color War** splits the jail into sides — your three on the left.
- Your Records gained the trophy count and wins by mode.

### Fixed
- **The dice now follow your finger.** A flick that ended with a moment's
  hesitation was read as a tap, because the throw used a whole-gesture
  average; it measures the last 90ms now.
- **Skirmish figures no longer stand inside the corner towers.**
- **The volume sliders** stopped jumping about and no longer hang off the
  edge of the panel.
- **The scoreboard** no longer sits on top of the prisoners.
- **The mode picker** stopped jumping when Color War is selected.
- **Starry and Frost** were the same picture in two colours; Frost is ice
  crystals now, and Starry's stars were blobs rather than stars.
- **Bubbles** looks like bubbles rather than polka dots.
- Coins and trophies no longer collide with the settings gear in the menus.
- Website: passwords have a Show button, and long words wrap instead of
  running out through the side of their card.


Every published update gets a version here, with **who asked for it**, so
any change can be traced back and rolled back on request.

Versions are for the over-the-air updates players actually receive. The
native build they run is listed separately — a new native build is only
needed when native code changes (ads SDK, in-app purchases, networking).

**Who's who:** David Sutton owns the game and made every request up to
v1.4.0. From **v1.5.0 onward, Marc (David's son)** is directing the work.

To roll back: every version below maps to a git commit on
`claude/game-development-51x4zl`. Ask for a version number and it can be
restored.

---

## v1.10.1 — 2026-08-19 · *requested by David*

Native build: 1.0.0 (build 5)

- **A prisoner sent back to jail mid-rescue no longer rockets off the
  top of the screen.** In Ultimate mode a rescued prisoner can be
  matched again and sent straight back while still in the air. Each leap
  arcs 3.4 above wherever the figure IS, so the second one stacked on top
  of the first and threw the figure to y 6.2 — brushing the invisible
  ceiling at 6.5 and well outside the camera's framing. A leap now only
  gets whatever headroom is left below an apex of 4.6, so interrupting
  one can never send a figure higher than an ordinary leap does. Ordinary
  leaps are untouched: still 4.0.
- A leap can no longer be handed a nonsense time by the render clock. If
  a backgrounded app or a re-mounted canvas produced a negative or wild
  value, the smoothstep turned it into a figure flung far outside the
  arena; the position is now clamped to the two ends of the leap.
- 103 tests now (9 new), including one that walks the whole flight path
  and asserts a figure never dips into the dice while crossing the tray —
  interrupted at any of twenty moments, in either direction.
- What the screenshot showed is most likely the animation working
  normally: an ordinary leap clears the dice by 2.5 units, but from the
  near-top-down camera a figure passing overhead sits right on top of
  them on screen. That is not a collision, and this release does not
  claim to have fixed it — see the note on the board.

## v1.10.0 — 2026-08-19 · *requested by David*

Native build: 1.0.0 (build 5)

- **🐞 Report a Bug**, in Settings. One box, one Send button — your
  device, OS, and app version are attached automatically so nobody has
  to type them. A report lands straight on the work board as an
  already-approved bug, the same way a repair reported in the HQ does,
  so it can be looked at without waiting on anyone's approval.
- This is the game's first network call outside its own update
  mechanism — the privacy policy was rewritten in this same update to
  say exactly that, before it shipped rather than after: what a bug
  report sends, that it only sends when you tap Send, and that nothing
  in one can be tied back to a person unless you put your name in the
  message yourself.
- 94 tests now (6 new) covering what a report is allowed to say — too
  short is rejected, too long is capped rather than dropped, and the
  title shown on the board never cuts a message off mid-word.

## The family settled two votes — 2026-08-17 · *requested by David*

- **Company name: Paper Ship Studio.** Settled by family vote over Sutton
  & Sons Studio, Good Noise Studio, Three Suttons Studio and Wild Table
  Studio. The website now names it as who makes the game, alongside
  David Sutton as the actual legal party — no company is incorporated
  yet, so the legal pages still name him, with Paper Ship Studio
  introduced as the name he makes it under.
- **App icon: Perfect Match** — two dice, both landed on red, the six
  game colours along the bottom. Settled over Colour Cube, Crossed
  Swords and Colour Rush. `assets/icon.png` is updated and committed,
  but an app icon is baked into the compiled app rather than delivered
  over the air, so it will not reach a phone until the next native
  build. That build is deliberately being held: Apple only reviews one
  TestFlight build per version at a time, and build 5 — the one Marc and
  AJ are waiting on — is still in that queue. Shipping the icon now
  would mean expiring build 5 and restarting their wait from zero, so
  the icon goes out in whichever build follows once build 5 clears.

## HQ voting — 2026-08-17 · *requested by David*

Not a game change.

- **🗳️ Vote** in the HQ. Where the ideas board is one person wanting
  something and David saying yes or no, this is for questions with more
  than one good answer — everybody votes, David settles it. Votes are
  open, not secret: you can see who picked what, which is the point.
- Claude raises the questions and reads the result, and deliberately
  cannot vote or settle one.
- **First vote up: four app icons** — Perfect Match, Colour Cube, Crossed
  Swords, Colour Rush. Each is shown large and again at 56px, because the
  small one is the honest test for an icon.

## Website and HQ — 2026-08-17 · *requested by David*

Not a game change — the game itself is untouched, and still has no web
build target.

- **A public website** in `hq/`: what the game is, plus the Privacy
  Policy, Terms of Use and Support pages Apple requires live URLs for.
  The privacy policy says the true thing — the game collects nothing —
  and commits to being rewritten *before* anything like ads ships.
- **A private HQ** at `/hq` for the family: put up ideas, David approves
  or parks them, approved ones get sorted into phases, and that is the
  timeline. Sign-in is a link emailed to invited addresses only — no
  passwords, which matters when half the team are children.
- **The approved list is the work queue.** Claude reads it, builds the
  top item, and marks it shipped with the version it went out in, so the
  board and this changelog always agree. Claude cannot approve anything.
- Deliberately built on personal accounts, never the employer-linked
  Supabase or Vercel accounts that were already connected.

## App Store setup — 2026-08-17 · *requested by David*

Not a game change — nothing players have installed is different.

- The game is registered with Apple as **Dice Battles: Color Rush**.
  Plain "Dice Battles" was already taken by another app, and David picked
  the new name from a list of options.
- The name under the icon on the phone is unchanged: **Dice Battles**.
  Apple only requires the *listing* name to be unique, so the two are
  deliberately different.
- App Store Connect ID `6802287913`, SKU `DICEBATTLES001`. The bundle ID
  did not change, so no signing or code changes were needed.
- Build 1.0.0 (2) was uploaded to TestFlight — the first time the game has
  reached Apple rather than Expo Go.

## v1.9.0 — 2026-08-17 · *requested by Marc*

Native build: 1.0.0 (build 1)

- **🔊 Volume sliders.** Settings had three ON/OFF switches; it now has four
  sliders — Everything, Sound effects, Music and Announcer — each from OFF
  to 100%. "Everything" scales the other three, so one drag quietens the
  whole game without losing the balance you set underneath it.
- All the way down is genuinely off: a muted channel loads nothing, plays
  nothing, and the music loop is paused rather than played silently.
- Move the music slider mid-battle and the loop follows it immediately —
  it does not wait for the next track or restart the one playing.
- Anyone who had a sound switched off before this update keeps it off; the
  old switches become the two ends of the new sliders.
- The sliders are drawn in the game's own code rather than pulled from a
  package with native code in it, so they reach players as an ordinary
  update instead of waiting for a new App Store build.
- Settings scrolls if the panel is taller than the phone, with Done pinned
  so it is always reachable.

## v1.8.0 — 2026-08-17 · *requested by Marc*

Native build: 1.0.0 (build 1)

- **🪙 Coins.** Earned every battle — 20/40/75 for a win on
  Easy/Medium/Hard, and 5/10/15 even for a loss, so a losing streak still
  builds toward something. Coins only ever go up; trophies remain the
  thing that rises and falls with your rank.
- **🛒 Store.** Spend coins on five new PATTERNED dice: Zebra, Bubbles,
  Starry, Timber and Frost, drawn with generated stripe/spot/star/grain
  textures. Patterns paint the shell only — the six face colours are
  untouched, and the suite checks each pattern colour stays clear of all
  six so a face can never be crowded.
- **🏅 Standings.** Your league on the trophy ladder, your record per
  difficulty, coins, and the full ladder with your position marked.
- Real-money purchases and world rankings are shown as not-yet-available
  rather than faked. Both need the app installed properly (not through
  Expo Go) plus, for money, the App Store payment setup.

## v1.7.1 — 2026-08-17 · *requested by Marc*

Native build: 1.0.0 (build 1)

- Skirmish rules said "before Sir Rollsalot", who is only one of eight
  opponents. Now reads "before your opponent".
- The Battlefields section of the Inventory has a description, like the
  Dice section does: it explains that every battlefield plays the same and
  that hazards come from the difficulty, not the arena.

## v1.7.0 — 2026-08-17 · *requested by Marc*

Native build: 1.0.0 (build 1)

- **Freed prisoners no longer run off the sides of the screen.** The
  retreat row was 6.6 units wide and framed by the figures' centres, so
  the outermost two hung over the edge. The row is narrower now and the
  camera frames the figures by their EDGES.
- **Nothing stands on top of the freed prisoners any more.** The parasols
  sat directly over the figures at x ±2.4 with a canopy wide enough to
  swallow them, and the pool rim clipped the outermost one. Posts now
  flank the row from further out and back, and the pool moved clear.
- All three battlefields (Castle, Jungle, Space) now read the retreat
  positions from one shared source instead of repeating the numbers,
  which is what let them drift out of alignment in the first place.

## v1.6.0 — 2026-08-17 · *requested by Marc*

Native build: 1.0.0 (build 1)

- **No gendered language.** Opponents are "your opponent" or "them"
  everywhere — the Color War callout, the Color War rules, and the Easy
  battlefield hint all referred to the opponent as "he"/"him".
- **Difficulty is the battlefield now, not the opponent's speed.** Every
  opponent rolls at the same human pace (2s per roll). Easy is a clear
  courtyard, Medium adds the hill, Hard adds the moat as well. Speed-based
  difficulty could not survive online play — a real opponent rolls at
  whatever pace they roll, so a difficulty built on their speed would mean
  nothing. Trophy stakes still scale with difficulty.

## v1.5.2 — 2026-08-17 · *requested by Marc*

Native build: 1.0.0 (build 1)

- Home screen no longer scrolls when everything already fits — it used to
  rubber-band with nothing to scroll to. Scrolling still switches on
  automatically on smaller screens where the content genuinely overflows,
  so the START button stays reachable.
- Title reads **⚔️ DICE BATTLES ⚔️**, swords on both sides.

## v1.5.1 — 2026-08-17 · *requested by Marc*

Native build: 1.0.0 (build 1)

- Home screen button now reads just **🎒 INVENTORY**; the equipped
  battlefield name no longer trails after it.

## v1.5.0 — 2026-08-17 · *requested by Marc*

Native build: 1.0.0 (build 1)

- Versioning started. Each update from here carries a version number and
  a note of who requested it, so changes can be rolled back individually.
- Two-player button renamed from "Pass & Play" to **"Split Screen"** — it
  was never turn-based; both players roll simultaneously on one phone.

## v1.4.0 — 2026-08-17 · *requested by David*

Native build: 1.0.0 (build 1)

- **Dice feel restored to the original.** Physics had drifted a long way
  while chasing shorter rolls: 2.5× the linear damping, 4× the angular
  damping, more friction, less bounce, plus a "settle assist" that bled
  speed off dice mid-roll and a throw that teleported them to a fixed
  spot. Reverted to the original values and the original throw — dice are
  thrown from wherever they lie, and nothing touches them while they roll.
- Kept from the rework: flick throws fire on release so they carry your
  hand's speed and direction, and a roll is called the moment the dice are
  still.
- Trade-off, deliberate: median roll ~1.5s rather than ~1.0s.
- **Moat fixes.** A drowned die no longer gets frozen mid-bounce after
  being fished out, is placed back gently instead of dropped, and can only
  be swallowed once per roll (it used to be knocked back in repeatedly,
  stretching rolls past nine seconds).

## v1.3.0 — 2026-08-17 · *requested by David*

- **🎒 Inventory** menu: equip battlefields and dice colours in one place,
  with locked items shown alongside their trophy price.
- **Dice skins**: Ivory, Gold, Mint, Bubblegum, Midnight. Skins colour the
  die shell only — the six face colours never change, so nothing bought
  can affect how a roll reads.
- Trophy ladder now alternates arenas and dice: Gold 100, Sunset 250,
  Mint 325, Jungle 400, Bubblegum 475, Treasure 550, Mystery 700,
  Midnight 850.
- The battlefield you last used is remembered between launches.

## v1.2.0 — 2026-08-16 · *requested by David*

- **Play Again / Home buttons** after every round, in both solo and
  split screen. A stray tap can no longer start a fresh round.
- Hill and moat can never overlap on Hard.

## v1.1.0 — 2026-08-16 · *requested by David*

- **Jungle Clearing** and **Space Station** arenas; the Mystery Arena at
  700 🏆 is real and keeps its identity secret until earned.
- **Family tester code** in Settings unlocks everything for playtesting.
- Test suite added (57 tests) plus an automatic check after every change.

## v1.0.0 — 2026-08-16 · *requested by David*

First TestFlight build. Four game modes, two-player split screen, trophy
ladder, AI roster, recorded audio and announcer, obstacles per difficulty.
