# Changelog

## v1.41.0 — 2026-08-25 · requested by David (a crash he reported)

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
  - The actual fix is a version stamp on the app's native side
    (`runtimeVersion`, now an explicit "1.1.0" instead of one derived
    automatically from the Expo SDK). Updates are only offered to phones
    whose native side matches, so JavaScript that needs ads can no
    longer land on a build without them. The old builds simply stay on
    the last update they can run, which is what should have happened.
  - The tests could never have caught it: they run in plain node, where
    a missing module throws an ordinary error that IS catchable. Only
    Metro, on a device, behaves differently. That is now written down in
    AGENTS.md so the next person does not trust the same pattern.

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
