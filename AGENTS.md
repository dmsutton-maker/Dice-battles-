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

## Where the work comes from

**Live at https://dice-battles-hq.vercel.app** — public site at `/`, the
private board at `/hq`. Hosted on David's personal accounts: Vercel team
`suttonsteam` (project `dice-battles-hq`, Hobby) and Supabase project
`eqdbvpnckriscvzalwix` in his personal "Dice Battles" org.

Deploys are run from a session with `npx vercel deploy --prod` inside
`hq/` — the Vercel GitHub app is not installed, so a push does NOT
redeploy the site on its own. Installing it (and setting Root Directory
to `hq`) would switch that on.

The `HQ_API_TOKEN` needed to read the queue lives in the project's Vercel
environment variables. It is never in this repo, which is public.

`hq/` is a separate Next.js app (public website + private planning HQ).
It is NOT part of the game and never gets imported by it — Metro is told
to ignore the folder, and the game stays native-only.

From now on the family puts ideas on the HQ board, David approves them,
and approved items are the work queue:

- `GET /api/queue` with the `x-hq-token` header returns what is approved,
  in priority order, plus anything already being built.
- Mark an item `building` when starting it and `shipped` with the version
  number when it goes out — the same version written in `CHANGELOG.md`.
- Approval is David's alone. The token deliberately cannot approve
  anything; if something needed is not approved, ask rather than build it.

A direct request in chat still outranks the board — the board is for work
queued up in advance, not a gate on David or Marc asking for something.

Questions with no right answer — which icon, which name, which colour —
go up as a **proposal** via `POST /api/proposals` for the family to vote
on, rather than being decided alone. Read the outcome from
`GET /api/proposals`. The token can raise a question and read the result;
it can neither vote nor settle a vote.

## The App Store record

- Listing name is **Dice Battles: Color Rush** — plain "Dice Battles" was
  already taken by another app. The name under the icon on the phone is
  separate and still reads **Dice Battles** (`expo.name` in `app.json`);
  keep them apart on purpose.
- App Store Connect app ID `6802287913`, SKU `DICEBATTLES001`, bundle
  `com.dmsutton.dicebattles`, Apple team `K3N9FG8NKD`.
- Submitting a build:
  `eas submit --platform ios --id <buildId> --profile production`.

## This repository is PUBLIC

Anyone can read every file and every commit here.

- Never commit credentials of any kind — not the App Store Connect `.p8`,
  its Key ID or Issuer ID, not the Expo token, not the signing `.p12` or
  its password. The `.p8` lives at
  `~/.appstoreconnect/private_keys/` and the signing files in
  `~/.dice-battles-credentials/`, both outside the repo.
- `eas.json` therefore holds only public identifiers (team ID, ASC app
  ID). API-key fields are added to it temporarily for a submission and
  taken out again before committing — or passed on the command line.
- A secret that does reach a commit is public the moment it is pushed:
  rotate it in App Store Connect or Expo rather than just deleting it.
