# Seasons 3 to 8: the plan

David, 23 Oct 2026: "Think of ideas for another 6 seasons and then give
me full details of the 2 dice and 2 arenas for each of them."

These are the ideas for December 2026 to May 2027, written in enough
detail to build from. Nothing here is built yet. Each month is built
around the 15th of the month before, shown to David, and shipped before
the 1st (see "The season pass turns over on the 1st of every month" in
`AGENTS.md`).

## The rules every season follows

These come from what Seasons 1 and 2 already do, and from the tests
(`tests/seasonRotation.test.ts`, `tests/season2.test.ts`).

- **Four things a season, at the same levels.**

  | Level | Row | What |
  | --- | --- | --- |
  | 6 | Gold | the first battlefield |
  | 12 | Gold | the first die |
  | 20 | Free | the second die, so a player without the pass still gets a die every month |
  | 30 | Gold | the second battlefield, the season's big prize |

- **Dice.**
  - Every die's pattern flows continuously round all six sides, with no
    seams at the edges.
  - The shell never comes close to any of the six face colours: Red
    `#cc2533`, Blue `#043fe0`, Green `#33cc6b`, Yellow `#ffe521`,
    Purple `#cc79fc` and Orange `#fc8403`. The colours below are
    starting points, to be checked by the face-colour test when built.
  - Each die gets an effect while rolling and another where it lands,
    like Fire, Ice, Sun and Moon. Nothing may hide the face colour once
    it has landed.
  - Each item gets a blurb for the preview, 44 characters at most
    (`itemBlurbs.ts`).
- **Battlefields.**
  - Each one has its own look: floor, walls, towers, jail and retreat.
  - Each one has its own props, sky, lighting and a "life" file of
    things moving round it, like `templeLife.tsx`.
  - Each one has two hazards, a pit and a mound, with the message a
    player sees when a die falls in.
  - The strips beside the walls stay clear for the moving life.
- **No new die or arena for a cup.** Cups pay coins and trophies. These
  are season items only, `pass: true`.
- **Family first, ages 5 to grandparents.** Nothing scary, and nothing
  tied to one religion. December is about winter treats and lights, not
  any one holiday.

---

## Season 3 · December 2026 · Gingerbread & Glitter

Winter treats by day and twinkling lights by night. It starts at midnight
on 1 December (New York time). Build it by 15 November.

### Gingerbread Village · battlefield · Gold, level 6

- **id** `gingerbread` · short name **Village** · sky `#cfe4f2`, a pale
  winter morning.
- **The look:**
  - The floor is a big biscuit-brown tray (`#c98a4b` / `#b87a3e`) with
    white icing piped round its edge in loops.
  - The walls are gingerbread slabs (`#9a5a2a`) capped with thick white
    icing (`#fff8f0`) and studded with gumdrops in pastel pink, mint and
    lemon. These colours are softer than the face colours.
  - The towers are gingerbread cottages with icing-snow roofs.
  - The jail is a biscuit platform behind candy-stick bars (`#f4e6d0`
    with brown stripes, not red, to stay clear of the Red face).
  - The retreat is a cocoa-mug hut with a marshmallow canopy.
- **Props:** gingerbread cottages with smoking chimneys, iced pine
  trees, lollipop lamp posts, a snowman made of meringue, and a row of
  gumdrops along the far edge.
- **Life (`gingerbreadLife.tsx`):**
  - A little toy train with three wagons of sweets runs round the
    village on a track outside the walls.
  - Gingerbread people wave from cottage doors.
  - Chimney smoke curls up.
  - Snow falls gently.
- **Hazards:**
  - Pit: the **cocoa pond**, a round pool of hot chocolate with a
    marshmallow floating on it. Message: "Splash! A die fell in the
    cocoa pond!"
  - Mound: the **sugar drift**, a heap of white sugar snow.
- **Lighting:** a soft white morning sun, a cool blue fill from the sky,
  and a warm bounce off the biscuit floor.
- **Blurb:** "A biscuit village with a sweet train." (37)

### Gingerbread dice · Gold, level 12

- **id** `gingerbread` · shell `#a8662f`, warm baked brown.
- **Pattern:** white royal-icing swirls, dots and zig-zag piping that run
  unbroken over every edge, like a biscuit iced in one go. Small sugar
  sprinkles sit between the swirls.
- **While rolling:** a light dusting of sugar crumbs falls behind it.
- **Where it lands:** a puff of icing sugar, and three tiny crumbs that
  bounce away.
- **Colours:** brown sits well below Orange in brightness and away from
  Red in hue. The icing is white, not any face colour.
- **Blurb:** "Iced gingerbread, with a puff of sugar." (39)

### Bauble dice · Free, level 20

- **id** `bauble` · shell `#1f5a4a`, deep pine-green glass. It is darker
  and bluer than the Green face by a long way.
- **Pattern:** a glass ornament seen close up. Gold glitter bands curve
  round the die in two crossing loops, with frosted snowflake etchings
  between them. A soft white highlight slides over the glass as the die
  turns, which is a material sheen, not paint.
- **While rolling:** a trail of tiny gold glitter sparks that twinkle
  out.
- **Where it lands:** a ring of glitter that rises and fades, and one
  bright twinkle on the top corner.
- **Blurb:** "Glass and gold glitter that twinkles." (37)

### Twinkle Market · battlefield · Gold, level 30

- **id** `twinklemarket` · short name **Market** · sky `#1a2448`, a
  clear winter night.
- **The look:**
  - A town square at night. The floor is cobbles (`#5d6474` /
    `#4e5566`) with a light frosting of snow.
  - The walls are low stone (`#3f4656`) strung with warm string lights
    that glow and twinkle.
  - The towers are wooden market stalls with striped awnings (cream and
    teal) and lanterns hanging under them.
  - The jail is a stall with a lantern and wooden bars.
  - The retreat is a bandstand with a lit roof.
- **Props:** market stalls, a tall decorated tree at the far end with a
  star on top, lantern posts, stacked parcels, and benches with snow on
  them.
- **Life (`marketLife.tsx`):**
  - Skaters glide in loops on a frozen pond beyond the far wall.
  - Shoppers in bobble hats stroll round the outside strips.
  - The string lights chase in slow waves.
  - A few snowflakes drift down.
- **Hazards:**
  - Pit: the **skating pond**, a hole in the ice. Message: "Whoosh! A
    die slid into the skating pond!"
  - Mound: the **parcel pile**, a heap of wrapped presents.
- **Lighting:** a dark blue night sky, with warm orange-white light
  pooled under the stalls and lanterns. Keep the tray bright enough that
  the face colours read true, as Moon Garden does.
- **Blurb:** "A night market of lights and skaters." (37)

---

## Season 4 · January 2027 · Thunder & Rain

A stormy month: lightning out at sea, rain in the jungle. It starts on
1 January. Build it by 15 December.

### Lighthouse Point · battlefield · Gold, level 6

- **id** `lighthouse` · short name **Lighthouse** · sky `#4a5a6e`, a
  grey storm sky.
- **The look:**
  - A clifftop over a rough sea. The floor is weathered planks
    (`#b8a68a` / `#a39276`) like a pier deck.
  - The walls are whitewashed stone (`#d8dcdc`) with a navy cap.
  - The towers are small red-and-white lighthouses. Use a muted brick
    `#9a4a3a`, not the Red face.
  - The jail is a lobster-pot cage on a rock.
  - The retreat is a lifeboat shed.
- **Props:** a tall lighthouse at the far end whose beam sweeps round,
  coils of rope, lobster pots, buoys, sea-grass tufts and rocks.
- **Life (`lighthouseLife.tsx`):**
  - Waves roll in and break white against the cliff below the far wall.
  - Gulls hang in the wind.
  - The lighthouse beam sweeps the board every few seconds.
  - Now and then a distant flash of lightning lights the clouds, without
    a loud bang, because some of the players are five.
- **Hazards:**
  - Pit: the **rock pool**, a pool of swirling sea water. Message:
    "Splash! A die washed into the rock pool!"
  - Mound: the **rope pile**, a coil of thick rope.
- **Lighting:** a cool grey key light from above, and a warm pulse each
  time the beam passes.
- **Blurb:** "A stormy cliff with a sweeping light." (37)

### Thunder dice · Gold, level 12

- **id** `thunder` · shell `#2e3448`, dark storm-cloud slate.
- **Pattern:** billowing cloud shapes in two greys that roll round all
  six sides. Thin forked lightning lines are painted across them.
- **While rolling:** lightning crackles along the painted forks, using
  the same pulse-along-a-path trick as the Circuit Board dice
  (`circuitPulse.ts`), in white-blue `#d8e8ff`. Not yellow, so it never
  reads as the Yellow face.
- **Where it lands:** one bright flash runs round every fork at once,
  then a small grey cloud puff.
- **Blurb:** "Storm clouds with crackling lightning." (38)

### Raindrop dice · Free, level 20

- **id** `raindrop` · shell `#5f8fa8`, rain-grey blue. This is lighter
  and greyer than the Blue face, and well apart from it in lightness.
- **Pattern:** clear water droplets of different sizes all over, with
  little trickles joining some of them across the edges. They look like
  rain on a window.
- **While rolling:** a fine spray of drops flicks off it.
- **Where it lands:** a ring of ripples spreads out on the floor round
  it, and two droplets bounce up.
- **Blurb:** "Raindrops on glass, with a splash." (34)

### Rainforest Falls · battlefield · Gold, level 30

- **id** `rainforest` · short name **Rainforest** · sky `#7ea88a`, a
  misty green.
- **The look:**
  - A clearing in a rainforest. The floor is mossy flagstones (`#7a8a5a`
    / `#6b7a4e`) wet with rain.
  - The walls are mossy logs.
  - The towers are tree stumps with giant leaves for roofs.
  - The jail is a vine cage.
  - The retreat is a hut on stilts with a palm-leaf roof.
- **Props:** a waterfall pouring down the far end into a pool, giant
  ferns, big tropical leaves, mushrooms on logs, and hanging vines.
- **Life (`rainforestLife.tsx`):**
  - Rain falls steadily and splashes on the leaves.
  - A toucan hops along a branch.
  - Frogs hop between lily pads.
  - Butterflies shelter under leaves, then fly off when the rain eases
    (it eases and returns on a slow cycle).
  - Mist drifts across the waterfall.
- **Hazards:**
  - Pit: the **plunge pool** at the foot of the falls. Message: "Splash!
    A die went over the waterfall!"
  - Mound: the **mossy log**.
- **Lighting:** soft green-filtered daylight with patchy sun.
- **Blurb:** "Rain, a waterfall and hopping frogs." (36)

---

## Season 5 · February 2027 · Dragon & Knight

A storybook month: a tournament field and a dragon's mountain. The dragon
is friendly and sleepy, not fierce. It starts on 1 February. Build it by
15 January.

### Jousting Field · battlefield · Gold, level 6

- **id** `joust` · short name **Joust** · sky `#a8d0f0`, a bright
  spring day.
- **The look:**
  - A tournament ground. The floor is green turf (`#8fbf6a` /
    `#7fae5c`) with a chalk-white tilting line down the middle.
  - The walls are wooden fences painted in alternating cream and navy.
  - The towers are striped pavilion tents with pennants on top, in navy
    and cream with gold trim.
  - The jail is a wooden stocks frame, kept comic and gentle.
  - The retreat is a royal viewing stand with a canopy.
- **Props:** pavilion tents, banners on poles, hay bales, a rack of
  lances, shields hanging on the fence, and a castle on the hill behind.
- **Life (`joustLife.tsx`):**
  - Two knights on hobby horses trot round the outside strips and wave
    their lances.
  - Pennants flutter in the wind.
  - A herald with a trumpet stands at the far end.
  - The crowd in the stand bobs up and down when a die lands.
- **Hazards:**
  - Pit: the **horse trough**. Message: "Splash! A die fell in the horse
    trough!"
  - Mound: the **hay pile**.
- **Lighting:** clear, bright midday sun.
- **Blurb:** "Knights on hobby horses at a joust." (35)

### Knight dice · Gold, level 12

- **id** `knight` · shell `#7d8794`, brushed steel. It uses the polished
  `sheen` finish, as Silver does, but darker and with a pattern.
- **Pattern:** riveted plate armour. Panel lines and rivets run round all
  sides, and a gold heraldic band with a repeating fleur pattern wraps
  diagonally round the die.
- **While rolling:** the steel catches the light in flashes.
- **Where it lands:** a small spark of gold, and the band shines once
  round its whole length.
- **Colours:** grey steel is far from every face colour. The gold band is
  a dark antique gold (`#b08a3a`), not Yellow.
- **Blurb:** "Shining armour with a golden crest." (35)

### Dragon dice · Free, level 20

- **id** `dragon` · shell `#1f4a3a`, deep emerald. It is much darker
  than the Green face.
- **Pattern:** overlapping scales that shift between emerald and teal as
  the die turns (an iridescent sheen), flowing round every edge.
- **While rolling:** two thin wisps of smoke trail behind it, not fire,
  so it is clearly different from the Fire dice.
- **Where it lands:** a puff of smoke ring, and the scales ripple with a
  shimmer once from corner to corner.
- **Blurb:** "Shimmering scales and a puff of smoke." (38)

### Dragon's Peak · battlefield · Gold, level 30

- **id** `dragonpeak` · short name **Peak** · sky `#e8a878`, a sunset
  over mountains.
- **The look:**
  - A ledge high on a mountain. The floor is dark slate (`#5a5560` /
    `#4e4954`).
  - The walls are rough rock with gold coins wedged in the cracks.
  - The towers are stone spires.
  - The jail is a cage of crystal.
  - The retreat is a cave mouth with a lantern.
- **Props:** heaps of gold coins and goblets, a treasure chest, crystals,
  and rocks.
- **Life (`dragonLife.tsx`):**
  - A big friendly green dragon lies curled round the far end of the
    board, asleep.
  - Its tail swishes slowly and its belly rises and falls.
  - Little smoke rings puff from its nose, and it opens one eye when a
    die lands near it.
  - Bats are NOT used. Small birds circle instead.
- **Hazards:**
  - Pit: the **treasure hole**, a pit full of coins. Message: "Clink! A
    die fell in the dragon's treasure!"
  - Mound: the **gold heap**.
- **Lighting:** a warm sunset key light and a cool purple fill, with the
  gold catching the light.
- **Blurb:** "A sleepy dragon guards its gold." (32)

---

## Season 6 · March 2027 · Wind & Wings

A breezy spring month: kites on a hill and butterflies in a glasshouse.
It starts on 1 March. Build it by 15 February.

### Kite Hill · battlefield · Gold, level 6

- **id** `kitehill` · short name **Kites** · sky `#8fcff5`, a breezy
  blue.
- **The look:**
  - A grassy hilltop. The floor is short grass (`#a8d07a` / `#98c06c`)
    with daisies.
  - The walls are dry-stone walls.
  - The towers are little windmills whose sails turn.
  - The jail is a picnic basket with the lid as bars.
  - The retreat is a picnic blanket under a tree.
- **Props:** windmills, wind socks, a big oak tree, picnic blankets and
  dandelions.
- **Life (`kiteLife.tsx`):**
  - Six kites of different shapes swoop and dip on long strings held by
    children on the outside strips.
  - Windmill sails turn.
  - Dandelion seeds drift across.
  - The grass ripples in the wind.
- **Hazards:**
  - Pit: the **rabbit hole**. Message: "Whoops! A die fell down a rabbit
    hole!"
  - Mound: the **molehill**.
- **Lighting:** bright spring sun, with cloud shadows sliding over the
  board.
- **Blurb:** "Kites swooping over a windy hill." (33)

### Kite dice · Gold, level 12

- **id** `kite` · shell `#f2eee4`, kite-paper white.
- **Pattern:** diamond kite panels in soft teal, coral and sky with
  dark stitched seams, and a ribbon tail that winds round all six sides.
- **While rolling:** three short ribbon tails stream out behind it and
  flutter.
- **Where it lands:** the ribbons settle with a little flick, and a gust
  of air ruffles the floor round it.
- **Colours:** the panels are pastel and greyed, so none of them can be
  mistaken for a face colour. Check coral against Red and Orange when it
  is built.
- **Blurb:** "Kite panels with fluttering ribbons." (36)

### Butterfly dice · Free, level 20

- **id** `butterfly` · shell `#3a2a4a`, a dusky plum, darker than the
  Purple face.
- **Pattern:** butterfly-wing scales. Eyespots and veins sweep across
  the faces, so each wing crosses an edge.
- **While rolling:** a soft shimmer of wing dust.
- **Where it lands:** two small butterflies lift off the die, flutter
  up and away, and fade.
- **Blurb:** "Butterfly wings, and two fly away." (34)

### Butterfly House · battlefield · Gold, level 30

- **id** `butterflyhouse` · short name **Butterflies** · sky
  `#d8eee0`, light through glass.
- **The look:**
  - A Victorian glasshouse. The floor is terracotta tiles (`#c88a6a` /
    `#b87a5c`).
  - The walls are white-painted iron frames with glass panes.
  - The towers are tall potted palms.
  - The jail is a bird-cage-shaped flower stand.
  - The retreat is a fountain with a bench.
- **Props:** flower beds, hanging baskets, a watering can, and orchids.
- **Life (`butterflyLife.tsx`):**
  - Butterflies of many colours flutter everywhere and land on flowers.
  - A gardener waters the beds along the outside strips.
  - Light falls in through the glass panes in moving bands.
- **Hazards:**
  - Pit: the **lily pool**. Message: "Splash! A die fell in the lily
    pool!"
  - Mound: the **flower bed**.
- **Lighting:** soft, bright, diffused glasshouse light.
- **Blurb:** "A glasshouse full of butterflies." (33)

---

## Season 7 · April 2027 · Bamboo & Lotus

A calm, green month: pandas in a bamboo grove and koi in a lotus pond.
It starts on 1 April. Build it by 15 March.

### Panda Grove · battlefield · Gold, level 6

- **id** `pandagrove` · short name **Pandas** · sky `#cfe8d8`, a
  morning mist.
- **The look:**
  - A bamboo forest clearing. The floor is raked gravel (`#d8d0b8` /
    `#c8c0a8`).
  - The walls are bamboo fences tied with rope.
  - The towers are bamboo watchtowers with thatched roofs.
  - The jail is a bamboo cage.
  - The retreat is a little pavilion with a curved roof.
- **Props:** tall bamboo clumps, smooth river stones, stone lanterns
  (already a prop), and a small wooden bridge.
- **Life (`pandaLife.tsx`):**
  - Two pandas sit munching bamboo on the outside strips.
  - A baby panda rolls over and over between them.
  - The bamboo sways.
  - Leaves drift down.
- **Hazards:**
  - Pit: the **stream**, a little brook. Message: "Splash! A die fell in
    the stream!"
  - Mound: the **leaf pile**.
- **Lighting:** soft misty morning light.
- **Blurb:** "Pandas munching bamboo in the mist." (35)

### Bamboo dice · Gold, level 12

- **id** `bamboo` · shell `#8a9a4a`, bamboo green-gold. Check it
  against Green and Yellow when it is built, and go darker if it is too
  close.
- **Pattern:** bamboo stalks with their joints. The stalks wrap round the
  die so each one continues over the edge, and slim leaves lie across
  them.
- **While rolling:** a couple of bamboo leaves spin off behind it.
- **Where it lands:** a soft "tok" knock (a new sound, short and woody),
  and a ring of leaves settles round it.
- **Blurb:** "Bamboo stalks and spinning leaves." (34)

### Lotus dice · Free, level 20

- **id** `lotus` · shell `#f4e0e4`, the palest petal pink. It is far
  lighter than the Purple and Red faces.
- **Pattern:** layered lotus petals in blush and white with fine veins,
  opening from one corner and folding round the die to the opposite
  corner.
- **While rolling:** a few petals drift off.
- **Where it lands:** a lotus flower blooms open on the floor beside it
  and fades.
- **Blurb:** "Lotus petals that bloom where it lands." (39)

### Lotus Pond · battlefield · Gold, level 30

- **id** `lotuspond` · short name **Lotus** · sky `#f0d8c8`, a peach
  dusk.
- **The look:**
  - A wooden deck over a pond. The floor is wide boards (`#b89a78` /
    `#a88a6a`).
  - The walls are low red-lacquer rails. Use a deep lacquer `#7a2a2a`,
    darker than the Red face.
  - The towers are small pagodas.
  - The jail is a lantern cage.
  - The retreat is a moon gate with a bench.
- **Props:** paper lanterns, lotus flowers and pads around the edges,
  stone lanterns, and a willow tree.
- **Life (`lotusLife.tsx`):**
  - Koi swim in slow loops under the water beside the deck.
  - Frogs sit on lily pads and hop.
  - Paper lanterns glow brighter as the light fades.
  - Dragonflies dart.
- **Hazards:**
  - Pit: the **koi pond**. Message: "Splash! A die fell in with the
    koi!"
  - Mound: the **stepping stones**.
- **Lighting:** a warm dusk key light, and lantern glow on the deck.
- **Blurb:** "Koi, lanterns and a pond at dusk." (33)

---

## Season 8 · May 2027 · Circus & Fair

A loud, happy month: a big top and a seaside fairground. It starts on
1 May. Build it by 15 April.

### Big Top · battlefield · Gold, level 6

- **id** `bigtop` · short name **Circus** · sky `#2a1e3a`, the inside
  of the tent.
- **The look:**
  - The circus ring. The floor is sawdust (`#e0c890` / `#d0b880`)
    with a painted ring.
  - The walls are the ring kerb, painted cream with navy stars.
  - The towers are podiums with drums.
  - The jail is a lion cart, empty, with its door open: no animals in
    cages.
  - The retreat is the ringmaster's stand.
- **Props:** juggling pins, big balls (already a prop), a unicycle,
  hoops, and the tent poles going up into the dark.
- **Life (`circusLife.tsx`):**
  - Acrobats swing on trapezes overhead.
  - A clown juggles on the outside strip.
  - Spotlights sweep the ring.
  - The ringmaster bows when a round is won.
  - No real animals.
- **Hazards:**
  - Pit: the **trap door**, with a puff of confetti. Message: "Ta-da! A
    die vanished through the trap door!"
  - Mound: the **cannon**, the human-cannonball cannon, as a mound.
- **Lighting:** dark tent, with bright warm spotlights on the ring.
  Keep the ring as bright as a day board so the faces read.
- **Blurb:** "Acrobats and clowns under the big top." (38)

### Big Top dice · Gold, level 12

- **id** `circus` · shell `#f4ece0`, tent cream.
- **Pattern:** broad tent stripes in deep navy `#22305a` (far darker
  than Blue) on cream, sweeping round the die. Little gold stars sit
  along the stripes.
- **While rolling:** a trail of confetti in soft pastels.
- **Where it lands:** a confetti pop. A drum-roll is optional, and the
  sounds must stay short.
- **Colours:** use navy rather than red. Red and cream would read as the
  Red face and as Candy Cane.
- **Blurb:** "Circus stripes and a confetti pop." (34)

### Carousel dice · Free, level 20

- **id** `carousel` · shell `#5a3a5a`, painted mulberry.
- **Pattern:** a carousel canopy. Gold scrollwork and a ring of little
  light bulbs run round the die, with painted mirror panels between
  them.
- **While rolling:** the bulbs chase round the ring, like the Circuit
  pulses but as dots.
- **Where it lands:** all the bulbs light at once and twinkle.
- **Blurb:** "Carousel lights that chase as it rolls." (39)

### Seaside Fair · battlefield · Gold, level 30

- **id** `seasidefair` · short name **Fair** · sky `#9ad4f5`, a summer
  afternoon.
- **The look:**
  - A fairground on a pier. The floor is pier boards (`#c8b090` /
    `#b8a080`).
  - The walls are pier railings with bunting.
  - The towers are helter-skelter slides.
  - The jail is a coconut-shy stall.
  - The retreat is an ice-cream kiosk.
- **Props:** a big Ferris wheel at the far end, a carousel, candyfloss
  stalls, balloons (already a prop) and deckchairs.
- **Life (`fairLife.tsx`):**
  - The Ferris wheel turns slowly.
  - The carousel horses rise and fall.
  - Gulls glide over.
  - People with balloons and ice creams walk the outside strips.
  - Waves glitter under the pier.
- **Hazards:**
  - Pit: the **gap in the boards**, with the sea below. Message:
    "Splash! A die fell through the pier!"
  - Mound: the **sandcastle**, which is already a prop.
- **Lighting:** bright warm summer sun.
- **Blurb:** "A Ferris wheel and a carousel on a pier." (40)

---

## At a glance

| Season | Month | Name | Lvl 6 (Gold) | Lvl 12 (Gold) | Lvl 20 (Free) | Lvl 30 (Gold) |
| --- | --- | --- | --- | --- | --- | --- |
| 3 | Dec 2026 | Gingerbread & Glitter | Gingerbread Village | Gingerbread dice | Bauble dice | Twinkle Market |
| 4 | Jan 2027 | Thunder & Rain | Lighthouse Point | Thunder dice | Raindrop dice | Rainforest Falls |
| 5 | Feb 2027 | Dragon & Knight | Jousting Field | Knight dice | Dragon dice | Dragon's Peak |
| 6 | Mar 2027 | Wind & Wings | Kite Hill | Kite dice | Butterfly dice | Butterfly House |
| 7 | Apr 2027 | Bamboo & Lotus | Panda Grove | Bamboo dice | Lotus dice | Lotus Pond |
| 8 | May 2027 | Circus & Fair | Big Top | Big Top dice | Carousel dice | Seaside Fair |

### What to decide before building

- **Which season's battlefield is level 30.** The one at level 30 should
  be the bigger showpiece. Each season above puts the busier, more
  animated one there.
- **New sounds.** The Bamboo "tok" and an optional circus drum-roll
  would be the first sounds made for one die. Everything else uses the
  existing sounds.
- **The order of the months can change.** Each season stands alone.
  Seasons can be swapped round, for example Wind & Wings for April, as
  long as each one is built before its month starts.
