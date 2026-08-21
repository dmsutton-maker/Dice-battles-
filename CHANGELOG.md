# Changelog

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
