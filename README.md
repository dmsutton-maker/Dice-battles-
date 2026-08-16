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
3. Multiple AI opponents (2–3 racing at once)
4. Same-device 2-player: portrait split screen, mirrored zones
5. One themed battlefield arena, built beautifully (arena system designed
   for drop-in additions)

**Progression (in):** Clash-Royale-style trophy ladder — win/lose trophies
(stakes scale with difficulty), persisted on device. Unlocks: Golden Dice
(100 🏆), Sunset Castle arena (250 🏆), Courtyard Treasure (450 🏆),
Mystery Arena teaser (700 🏆). Future arenas/obstacles/treasures slot into
`src/game/progress.ts` TIERS + the arena registry.

**v2:** ✅ Ultimate / Skirmish / Color War modes (vs AI; mode picker on the
start screen). Remaining: nearby multi-device play.

**v3:** rewarded ads at natural breaks, remove-ads IAP, cosmetic dice skins
and battlefield themes. No ad SDK before v3.
- **Custom soldier colors (paid):** let players re-color their six
  soldiers/prisoners from a color palette. Constraint: the six colors are
  gameplay signals (dice faces must match soldiers at a glance), so any
  custom set has to stay mutually distinct — enforce a minimum perceptual
  distance between choices rather than free-form pick-anything. Palette
  plumbing already supports this: every color reference flows through
  `src/game/colors.ts`, so a custom palette is a data swap, not a refactor.

**Constraints:** family-friendly (ages 5+), rounds 1–2 minutes, fully
offline, no accounts, no data collection.
