# Dice Battles

A digital version of **Dice Battles** — a real-time dice-rolling race game.
Players frantically roll dice to free their prisoners before their opponents
do. Speed, chaos, and simultaneous play — not turn-based.

Personal project. Original tabletop game IP owned by the author.

## Current milestone: dice-feel demo

The repo currently contains **milestone 1 only**: a tray and two 3D
physics dice that tumble, bounce, and settle. Everything else depends on the
rolling feeling great, so this is the iteration target before any game logic
is built.

What's in the demo:

- Real 3D dice physics (gravity, tumbling, wall bounces, die-vs-die
  collisions) via **cannon-es**, rendered with **react-three-fiber + three.js**
  on **expo-gl**.
- Colored faces (six prisoner colors), not pips — readable on settle.
- **Tap anywhere** to throw (throws fire on touch-down, so rapid tapping is a
  rolling frenzy). **Flick** to steer a directional throw.
- Haptics: light ticks on hard dice impacts, a medium thump on settle, and a
  success buzz on a color match.
- Cheap blob shadows under the dice (real shadow maps are overkill for two
  cubes and cost frame budget on phones).
- HUD shows the two rolled colors and a **MATCH!** banner when both dice
  agree — the moment that will free a prisoner in the real game.

### Run it on your iPhone

```bash
npm install
npx expo start
```

Scan the QR code with the iPhone camera and open in **Expo Go**.

### Testing

There is no device and no CI here, so correctness is checked headlessly:

```bash
npm test        # ~3s: physics simulation, rules, camera fit, assets
npm run typecheck
npm run bundle  # Metro/Hermes bundle check (slow; catches device-only import breaks)
npm run check   # typecheck + tests
```

`tests/` runs the **real** modules, not copies: rolls are simulated through
`src/dice/settle.ts` and `src/physics/world.ts`, so a tuning change that
makes rolls slow, lets dice escape the tray, or calls a roll mid-tumble
fails here. Assertions are phrased as the player-facing rule they protect,
and measured values (roll times, camera pull-back) print after each run.

Two things run this automatically:

- **`.claude/hooks/verify.sh`** — a Stop hook that runs the typecheck and
  suite whenever Claude finishes writing code, and blocks with the failure
  output if anything broke.
- **the `game-tester` agent** (`.claude/agents/game-tester.md`) — runs the
  full ladder including the bundle check, then reviews the diff for the
  regressions the suite can't catch (dead input, invisible scenery,
  unlicensed audio) and adds tests for gaps it finds.

### Tuning the feel

Every knob that affects dice feel lives in one file:
[`src/game/tuning.ts`](src/game/tuning.ts) — gravity, bounce restitution,
throw power, spin ranges, settle thresholds, haptic thresholds. Edit, save,
and Expo hot-reloads on the phone. This is the iteration loop for milestone 1.

## Stack decision

**Expo + react-three-fiber + cannon-es** (no web version, no Unity).

- **Why not rapier:** rapier is Rust compiled to WebAssembly, and React
  Native's Hermes engine has no practical WASM support. cannon-es is pure
  JavaScript, runs directly on Hermes, and for 2–4 dice plus static tray
  walls it comfortably holds 60fps — this workload is tiny by physics-engine
  standards.
- **Why not Unity:** the Expo stack keeps the no-Mac pipeline (Expo Go for
  instant device testing, EAS Build for the App Store binary later). Unity
  would only be justified if JS physics couldn't deliver the dice feel; for
  two rigid cubes in a box, it can.

## Project structure

```
App.tsx                     entry — renders the current screen
src/
  game/
    colors.ts               the six prisoner colors (shared by dice/UI/game)
    tuning.ts               ALL feel knobs in one place
  physics/
    world.ts                cannon-es world + static tray collision bodies
  dice/
    die.ts                  die body/materials, throw impulses, top-face read
  demo/
    DiceScene.tsx           3D scene: tray, dice, shadows, settle detection
    DiceDemoScreen.tsx      screen: Canvas + gesture overlay + HUD
```

The split is deliberate so later milestones drop in without rewrites:
game-mode logic consumes settle events (`onSettled(faces)`), arenas replace
the tray visuals while reusing the same collision bodies, and a second
battle zone is a second `DiceScene` with its own physics world.

## Roadmap

**v1**
1. ✅ Dice-feel demo (iterated on device until rolling felt right)
2. ✅ Classic mode vs 1 AI opponent (Sir Rollsalot — fair virtual rolls on
   a timer, difficulty = roll speed), with the "Arm your dice! … Battle!"
   countdown, win/defeat overlays, instant rematch, Easy/Medium/Hard
3. ✅ AI opponent roster (8 named rivals, fresh one drawn each round;
   copy says "other players" ahead of eventual online play)
4. ✅ Same-device 2-player: portrait split screen, mirrored zones, each
   with its own physics world (Classic, no trophies at stake)
5. One themed battlefield arena, built beautifully (arena system designed
   for drop-in additions)

**Progression (in):** Clash-Royale-style trophy ladder — win/lose trophies
(stakes scale with difficulty), persisted on device. The ladder alternates
battlefields and dice so a reward is always close: Gold Dice (100 🏆),
Sunset Castle (250), Mint Dice (325), Jungle Clearing (400), Bubblegum Dice
(475), Courtyard Treasure (550), the Mystery Arena (700 — revealed as the
Space Station only once earned), Midnight Dice (850).

Everything cosmetic is equipped in the **🎒 Inventory**
(`src/demo/InventoryScreen.tsx`): battlefields and dice colours, with
locked items shown alongside their price. Dice skins colour the die SHELL
only — the six face colours are the game signal and never change, and the
suite asserts every shell stays perceptually clear of all six faces.

What is earned (`src/game/progress.ts`) and what is equipped
(`src/game/loadout.ts`) are stored separately; equipping is validated on
read, so a selection can never strand the player in an item they no longer
own. New arenas/dice slot into TIERS + the arena registry
(`src/arena/arenas.tsx`) or `src/game/diceSkins.ts`.

**Family tester mode:** entering the secret code in Settings unlocks
everything for playtesting (a second code re-locks it); trophies still
count normally underneath. Codes live in `src/game/progress.ts`.

**v2:** ✅ Ultimate / Skirmish / Color War modes (vs AI; mode picker on the
start screen). Remaining: nearby multi-device play.

**Post-TestFlight plan (in order):**
1. First TestFlight build ships (kids install via public link; JS updates
   keep flowing to them instantly over the same `main` EAS Update channel —
   a new build is only needed when native modules change).
2. iPad polish pass: the build already installs natively on iPad
   (`supportsTablet`), and the camera auto-fit was validated on iPad
   aspect; the pass is UI scale (bigger touch targets/text on big screens)
   and making the 2-player face-to-face split feel great on a table.
3. Multi-device multiplayer: each kid on their own iPhone/iPad. Requires
   native networking (Game Center matchmaking or local peer-to-peer), which
   is exactly what TestFlight builds unlock — bundled with the Game Center
   leaderboards milestone below. Local split-screen 2-player stays as the
   no-setup option on every device.

**v3:** rewarded ads at natural breaks, remove-ads IAP, cosmetic dice skins
and battlefield themes. No ad SDK before v3.
- **Custom soldier colors (paid):** let players re-color their six
  soldiers/prisoners from a color palette. Constraint: the six colors are
  gameplay signals (dice faces must match soldiers at a glance), so any
  custom set has to stay mutually distinct — enforce a minimum perceptual
  distance between choices rather than free-form pick-anything. Palette
  plumbing already supports this: every color reference flows through
  `src/game/colors.ts`, so a custom palette is a data swap, not a refactor.

**Planned for when the game is near-final (user-requested, deliberately
deferred so quick exits stay easy during testing):**
- Quitting mid-round counts as a forfeit (trophy loss applies)
- In-round pause menu: sound/music/announcer toggles + confirm-exit button

**Apple milestone (Apple Developer membership active; custom EAS build —
not possible inside Expo Go):**
- TestFlight distribution (one-tap installs for testers) — in progress:
  `eas.json` production profile + iOS bundle id `com.dmsutton.dicebattles`
  are configured; the EAS build/submit pipeline needs an App Store Connect
  API key. The build pulls OTA updates from the same `main` channel, so
  testers keep getting every update automatically.
- Game Center: trophy leaderboards + achievements across devices

**Constraints:** family-friendly (ages 5+), rounds 1–2 minutes, fully
offline, no accounts, no data collection.
