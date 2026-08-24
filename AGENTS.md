# Dice Battles — agent notes

**Read `STATE.md` first.** It maps where the project actually stands —
live URLs, accounts, what is built, what is known-broken — so a session
gets oriented in one read instead of reconstructing it from conversation
history. This file holds the *rules*; that one holds the *facts*, and it
is the one to update when something ships or changes.

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
- Family-friendly, ages 5+. No analytics, no accounts, no data collection
  beyond what advertising requires.
- **Advertising, as of 24 Aug 2026.** David asked for ads in 1.0 rather
  than a later release, and accepted delaying the App Store launch to get
  them. One interstitial after every third FINISHED game, and nothing
  else — no banners, no rewarded video, no ads mid-round.
  - Every request is tagged `tagForChildDirectedTreatment` and
    `requestNonPersonalizedAdsOnly`, capped at `MaxAdContentRating.G`.
    This is not a preference: the App Store Connect privacy filing says
    "not used for tracking" and the app asks for no App Tracking
    Transparency permission, and both of those are only TRUE because of
    those flags. Turning personalised ads on means re-filing App Privacy
    and adding an ATT prompt, in the same change or not at all.
  - `src/game/ads.ts` is the ONLY file that may import the ad SDK, the
    way `gameCenter.ts` is for Game Center. Nothing in it may throw,
    reject, or block, and an ad that is not loaded is skipped rather
    than waited for.
  - The SDK is required lazily, never imported at module scope: ads are
    native code, but JS ships over the air to binaries built before the
    SDK existed, and a top-level import crashes every one of them.
  - Never put the app in App Store **Kids Category** while ads are in
    it — Apple forbids third-party ad SDKs there. Games → Family/Board
    is where it belongs.
- Validate changes with `npx tsc --noEmit` and
  `npx expo export --platform ios --output-dir /tmp/export-test`
  (Metro bundle check) — there is no device in CI.

## Every change gets written down, in plain words

**After anything ships — game, website or admin — add a row to the
`changes` table.** One or two sentences, no jargon: David and the boys
read this to see what happened without reading code or a git log.

```sql
insert into public.changes (summary, area, version) values
  ('Fixed the contact form: what you typed was white on white.', 'website', '');
```

`area` is one of `game`, `website`, `admin`, `behind the scenes`;
`version` only when the game shipped one. It shows on
`/admin/automation` under "What changed, in plain words".

Write it the way you would tell someone at the kitchen table — "the dice
sometimes got stuck in the moat, that's fixed" — not "resolved a race
condition in the settle handler". This is separate from `CHANGELOG.md`,
which stays versioned and technical for the game's own releases.

## The gate in front of every App Store submission

**David asked on 24 Aug 2026: before ANY App Store submission, run a full
test of everything, on Fable, and make it the LAST thing before
submitting.**

Read that literally — both halves are the point.

- **On Fable.** Switch the session with `/model claude-fable-5` and run
  the pass there. Not on whatever model happens to be serving.
- **LAST.** After the pass, nothing else changes. No "one small fix"
  afterwards, no version bump, no OTA publish, no copy edit. If anything
  at all changes, the pass is void and gets run again on the new state —
  otherwise the thing that was tested is not the thing being submitted.
- **Everything**, not just the diff: `npx tsc --noEmit`, the full suite
  (`npm test`), the Metro bundle check, the ad rules, the store copy and
  its character limits, the screenshot dimensions, `app.json` version
  against `CHANGELOG.md` and `GAME_VERSION`, and the App Store Connect
  fields against what the app actually does — particularly the App
  Privacy answers, which are only true while the child-directed ad flags
  are on.

Report what actually ran and what it said. A submission is the one thing
here that cannot be rolled back in seconds, so an unverified claim of
"all green" is worse than saying a check was skipped.

## Releasing

**Shipping is automatic now.** David asked on 20 Aug 2026 for changes to
reach Expo and TestFlight without him having to ask each time.

- **Every change goes out over the air as soon as it is verified** —
  typecheck, tests, bundle check, CHANGELOG entry, then
  `eas update --branch main --message "vX.Y.Z — what changed"`. No
  waiting to be told. An OTA update is reversible in seconds, so the cost
  of shipping one is close to nothing and the cost of sitting on it is
  that nobody can play it.
- **A new BUILD is only needed for what Apple bakes into the binary** —
  the app name, the icon, anything in `app.json` outside JS, a new
  dependency with native code, or an SDK bump. Run the build when a
  change requires one, because otherwise that change simply never
  arrives. Say so in chat when you do.
- The Expo access token is on David's account (`dmsutton`). It is NEVER
  written to disk in this repo — pass it as `EXPO_TOKEN` in the
  environment only. This repo is public.
- Roll back a bad update with `eas update:republish`, don't ship a
  panicked fix on top of it.


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
- **Respect the dates.** The queue returns `approved` (work whose time has
  come) and `scheduled` (approved, but dated for later). Only ever take
  from `approved`. Something dated for November is not "ready early" — it
  is deliberately parked, and building it in August ships months of dead
  code and misses the moment. `deadline` is the other end: work that must
  be finished by a date, and being past it is a problem to raise.
- Approval is David's alone. The token deliberately cannot approve
  anything; if something needed is not approved, ask rather than build it.
- **Bugs versus features.** An item has a `kind`. A `bug` is something
  already broken and arrives already approved — fix it without waiting,
  because an approval queue in front of a repair only leaves it broken
  longer. A `feature` changes what the game is and waits for David. Never
  quietly reclassify a feature as a bug to skip the approval.

A direct request in chat still outranks the board — the board is for work
queued up in advance, not a gate on David or Marc asking for something.

## What runs without being asked

Standing policy, agreed with David:

- **A bug at priority 1 ("Drop everything") is fixed immediately**, with no
  approval and no waiting — email David when starting and again when it
  ships. Bugs are pre-approved anyway; priority 1 also means don't queue it.
- **Every other bug** gets an email describing it and the direct question
  "can I start on this now?" — and then WAITS for an answer. Priority is
  the whole distinction; do not read urgency into a bug that is not marked 1.
- **Support replies are drafted, never sent.** Write a suggested reply into
  `message_replies` with `is_draft = true`, and a person reads, edits and
  sends it. Nothing reaches a player without a human pressing Send. This is
  deliberate while the tone is still being judged, not a technical limit.
- Automation is visible at `/admin/automation` — what is configured, and
  what it has actually done. If something claims to run and nothing shows
  up there, say so plainly rather than assuming it worked.

## Who the game is for

Ages 5+ means **nobody is excluded at the bottom end** — not that this is
a children's game. David wants it played by grandparents as readily as by
five-year-olds. The colours-not-numbers design serves pre-readers and
anyone who would rather not squint at pips. Copy that frames the game as
kid-first undersells it; when writing anything public-facing, write for a
family, not for children.

Questions with no right answer — which icon, which name, which colour —
go up as a **proposal** via `POST /api/proposals` for the family to vote
on, rather than being decided alone. Read the outcome from
`GET /api/proposals`. The token can raise a question and read the result;
it can neither vote nor settle a vote.

## The company

The family voted and settled on **Paper Ship Studio** as the name to
carry more than just this one game — David Sutton's studio, not
incorporated yet. Use it wherever the game's website names who makes it
(it already does, in the footer and the legal pages), and use it as the
Organization name whenever the Apple account is converted from Individual
and whenever a legal entity is formed. `papershipstudio.com` was free
when checked (17 Aug 2026) but has not been purchased.

## The App Store record

- The name is **Dice Battles: Color Rush** everywhere — the App Store
  listing, `expo.name` in `app.json`, and the launch title card. Plain
  "Dice Battles" was already taken by another app.
- These used to be deliberately different, with the phone showing the
  short name. David asked on 19 Aug 2026 for one name throughout, so the
  split is gone; do not reintroduce it.
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
