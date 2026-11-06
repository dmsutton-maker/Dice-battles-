## WHERE THIS STANDS — read before doing anything below

The review is FINISHED and sections A, A2 and B are DONE, shipped as
v1.65.0 and v1.66.0 and deployed to the site. Do not work through them
again — every item in those sections is either fixed in the code or, in
the handful of cases where the verifier's suggestion was wrong or
harmful, deliberately not taken with a comment in the code saying why.

What is left is **sections C and D**, which are David's alone: decisions
about the product and things only he can do in App Store Connect, the
AdMob console and Apple's own forms. They were published for him as an
Artifact page on 7 Sep 2026. Nothing in C or D should be built by an
agent without him answering first.

Two things a future session should know:

- **The versions.** `app.json` says 1.60.0, `GAME_VERSION` says the
  current OTA version, and the App Store Connect record says 1.0. Three
  numbers, and which one becomes the public 1.0 is C4/C5/C17 — David's
  call, and permanent. `tests/submission.test.ts` pins the only relation
  that has to hold whichever way he goes: `app.json` never ahead of the
  JavaScript.
- **Ads are OFF** and no built binary contains the SDK, so
  `runtimeVersion` is correctly on the `sdkVersion` policy. Turning them
  on is a single co-ordinated change — see the two-state rule in
  AGENTS.md, which `tests/ads.test.ts` now enforces for every native
  package rather than only AdMob.

The review's own artefacts, if any of this needs re-deriving: the
verdicts live in the workflow journals for runs `wf_82e1508f-191` and
`wf_e779625a-9c7`, and this document is regenerated from them with
`python3 tools/launch-review/extract-verdicts.py <journal> /tmp/v.json &&
python3 tools/launch-review/make-handoff.py /tmp/v.json LAUNCH_REVIEW.md
"<status>"`. The renders the graphics section judged are under
`scratchpad/launch-review/{arenas,dice}/`; `render-all.sh` rebuilds them
and REMOVES the web packages afterwards, which is not optional — Expo
infers a web target from `react-dom` being present and `eas update`
then fails on the platforms array.

**Ship procedure for any further batch** (from AGENTS.md): `npm run
check` — which is typecheck, tests and the Metro bundle in one, and now
really does include the bundle — then `grep -c RNGoogleMobileAds` on the
exported `.hbc` must print 0, then a CHANGELOG entry, bump
`src/game/version.ts`, commit, `EXPO_TOKEN=… npx eas update --branch
main --message "vX.Y.Z — …"`, a row in the Supabase `changes` table in
plain words, and push. Site changes also need `cd hq && VERCEL_TOKEN=…
npx vercel deploy --prod --yes --scope suttonsteam`. Tokens live in the
conversation only, never on disk — this repository is public.

The bug-board routine (`trig_01TtJdRSGx9JjmoeFt991K3F`, 7am and 7pm ET)
fires into the session that created it; answer it by querying
`public.ideas where kind='bug'` on Supabase project
`eqdbvpnckriscvzalwix`.
