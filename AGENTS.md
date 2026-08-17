# Dice Battles — agent notes

Read the exact versioned Expo docs at https://docs.expo.dev/versions/v54.0.0/
before writing any code — Expo APIs change between SDK versions.

## Project rules

- Personal side project — never reference or connect to any employer code,
  repos, or infrastructure.
- Native-only (Expo / React Native). No web build target; do not add
  web-specific code paths.
- Physics is **cannon-es** (pure JS — works on Hermes). Do not swap in
  rapier or any WASM-based engine; WASM is not viable on Hermes.
- 3D rendering is `@react-three/fiber/native` on `expo-gl`. Import from
  `@react-three/fiber/native`, not the web entry point.
- All dice-feel constants belong in `src/game/tuning.ts` — never scatter
  magic physics numbers through components.
- Dice faces are COLORS (see `src/game/colors.ts`), never pips/numbers.
- Family-friendly, ages 5+. No ad SDKs, analytics, accounts, or data
  collection in v1.
- Validate changes with `npx tsc --noEmit` and
  `npx expo export --platform ios --output-dir /tmp/export-test`
  (Metro bundle check) — there is no device in CI.

## Releasing

- Every published update gets a version in `CHANGELOG.md`, recording
  **who requested it**, so any change can be traced and rolled back.
- Put the version in the EAS update message too:
  `eas update --message "v1.5.0 — what changed"`.
- Marc (David's son) is directing the work from v1.5.0 onward; David owns
  the game and made every request before that.
