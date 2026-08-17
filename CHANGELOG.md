# Changelog

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
