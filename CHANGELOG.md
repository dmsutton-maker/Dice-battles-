# Changelog

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
