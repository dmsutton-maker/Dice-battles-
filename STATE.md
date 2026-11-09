# Where things stand

A map of the project as it actually is, so a session can get oriented in
one read instead of reconstructing it from conversation history. Keep it
current — a stale map is worse than none. `AGENTS.md` holds the *rules*;
this holds the *facts*.

Last updated: 4 November 2026.

## The two things being built

| | The game | The website + admin |
|---|---|---|
| Where | repo root (`src/`, `assets/`) | `hq/` |
| What | Expo / React Native, iOS-first | Next.js 16 on Vercel |
| Ships via | EAS Build + EAS Update (OTA) | `npx vercel deploy --prod` from `hq/` |
| Live at | TestFlight (build 5, approved) | https://papershipstudio.com |

Metro is told to ignore `hq/`. The game never imports from it.

### Deploying the website — read this before changing Vercel's Git settings

**`main` does not contain `hq/`.** The whole website — public site and
admin — lives only on `claude/game-development-51x4zl`, which is ~84
commits ahead of `main`. PR #1 has never been merged.

So if the Vercel GitHub app is ever connected, its **Production Branch
must be set to `claude/game-development-51x4zl`**, not `main`, and Root
Directory to `hq`. Pointing it at `main` builds a repo with no Next.js
app in it and takes the live site down.

The cleaner long-term fix is to merge PR #1 so `main` is the truth
again — that is David's call, not something to do unasked.

**A fresh container has no `hq/.vercel/` link** (it is gitignored). A
plain `npx vercel deploy --prod` from `hq/` then does NOT fail: it
quietly creates a NEW Vercel project named `hq` and deploys there,
leaving the live site untouched. That happened on 18 Oct 2026 (project
`hq`, `prj_OBirL7Po9…`, created by mistake). Link first, every time:
`npx vercel link --yes --project dice-battles-hq --scope suttonsteam`,
then deploy. `link` also writes `hq/.env.local`; it is gitignored, but
delete it after the deploy. Production is aliased to
https://papershipstudio.com.

As of 19 Aug 2026 the Vercel personal token in use had expired (`404
User not found`) and the Vercel MCP connector could see the team but no
projects, so neither could deploy.

## Live URLs

- **papershipstudio.com** — public site (Home, Apps, the Dice Battles app
  page, Support, Privacy, Terms)
- **papershipstudio.com/admin** — private board. Login-gated, unlinked
  from public navigation. Was `/hq` until 18 Aug 2026.
- **dice-battles-hq.vercel.app** — the same deployment, original domain,
  still works

## Accounts and who owns what

All on David's personal accounts. Never employer-linked.

- **Vercel** — team `suttonsteam` ("Paper Ship Studio"), project
  `dice-battles-hq` (`prj_1i6PYVBjBnspKmWTLBsISG56LwRd`)
- **Supabase** — project `eqdbvpnckriscvzalwix`
- **Cloudflare** — owns `papershipstudio.com` DNS and inbound email
  routing. Account `57184310defde48386d397cef060b993`, zone
  `f2da252289d9e70c3e3380ac8fbe72d8`
- **Apple** — App Store Connect app `6802287913`, SKU `DICEBATTLES001`,
  bundle `com.dmsutton.dicebattles`, team `K3N9FG8NKD`
- **GitHub** — `dmsutton-maker/Dice-battles-`, branch
  `claude/game-development-51x4zl`. **Public repo — no secrets, ever.**

## Email

- **Inbound works.** `hello@`, `support@` → dmsutton@gmail.com via
  Cloudflare Email Routing. `aj@` is configured but blocked until AJ
  confirms his destination address.
- **Outbound does not exist yet.** Cloudflare only forwards; it cannot
  send. Support ticket replies save and display but are not emailed until
  a `RESEND_API_KEY` is set in the Vercel project. The code already
  handles both cases and says honestly which happened.

## The admin, page by page

`/admin` · Ideas board — bugs and features, per app, with priority and dates
`/admin/vote` · Family votes on open questions
`/admin/content` · Every editable word on the public site
`/admin/schedule`, `/admin/timeline` · Dated and phased work
`/admin/people` · Who can sign in; change passwords and email addresses
`/admin/support` · Support tickets, with draft-and-approve replies
`/admin/automation` · What runs on its own, and what it has actually done
`/admin/activity` · Full history

## The game's look — Paper & Ink (since v1.32.0, 24 Aug 2026)

David chose "Paper & Ink", **light mode only, no dark mode**, from
side-by-side mockups (`design-concept/`). Everything the interface is
made of lives in `src/ui/`: `theme.ts` (the only place colours, shapes
and type sizes are decided), `Icon.tsx` (icons drawn with Views — no
react-native-svg, it would need a native build), `Card.tsx` (outline +
drawn hard shadow). White cards, 2px ink outlines, warm paper ground;
emoji stay only where they are content (arenas, cups, tiers, tutorial
art, news). The launch title card is deliberately still ink-dark — the
bundled paper-ship mark is the light-on-dark variant. A custom typeface
is the one part not shipped: font files ride in the binary, so it waits
for the next native build.

## The App Store listing, as of 30 Aug 2026

`tools/appstoreconnect/asc.py` talks to the live App Store Connect
record — David supplied the issuer id on 30 Aug 2026 (it stays in the
environment, never in this repo). First live run confirmed the record,
and the same day the listing was brought up to date:

- **Screenshots: uploaded and live.** The six designed shots in
  `store/screenshots/`, both device sets — 6.7" iPhone (1290×2796) and
  12.9" iPad (2048×2732) — all `COMPLETE`. They replaced twelve raw
  phone captures, seven of which had been stuck in `AWAITING_UPLOAD`
  since a manual attempt.
- **Text: verified matching.** Description, keywords, subtitle and
  promotional text on the listing are character-for-character the
  `store/*.txt` files. `set-listing` diffs and pushes them if they ever
  drift.
- **Right already:** category Games → Board + Family (not Kids),
  age rating 4+, privacy policy at papershipstudio.com/privacy (live),
  support and marketing URLs live, copyright "2026 Paper Ship Studio".
- **App Review contact: set** (30 Aug 2026, details from David in
  chat). `demoAccountRequired` false — the app has no accounts.
- **Still missing before any submission:** a build attached to
  version 1.0.
- **In-app purchases: the family decided (31 Aug 2026).** David, with
  Marc and AJ, settled the product list. Prices are Apple tiers.
  - **Remove Ads** — David picked it at **$3.99**, the price on the
    options page. An earlier note here said $5.99 "so Dice Club's maths
    works"; that was never asked for, and is flagged to David as a
    suggestion rather than recorded as his decision. The tension is
    real — a $4.99/month club that includes no-ads is undercut by a
    $3.99 forever version — but which way to resolve it is his call.
    Interstitials off forever.
  - **Premium dice sets** — $1.99 each, money-only, cosmetic.
  - **Premium arenas** — $2.99 each, money-only.
  - **Starter Pack** — $4.99, offered ONLY in the first 48 hours after
    install (a client-side window; the product itself always exists).
    Contents to be confirmed — proposed: an exclusive golden die plus a
    pile of coins.
  - **Coin packs** — Pouch $0.99, Chest $4.99, Vault $9.99.
  - **Dice Club** — REMOVED 5 Oct 2026. David: "take Dice Club out for
    now, I don't think we can keep up with that yet" (a monthly charge
    is a promise of new content every month). Was: $4.99/month subscription, the everything tier: no
    ads while subscribed, Season Pass included, daily coin bonus, and a
    members-only die that changes monthly.
  - **Season Pass** — $2.99 per season, implemented as an XP reward
    track of ~30 tiers: everyone earns XP and climbs the FREE track
    (coins, occasional dice); pass holders also unlock the PAID track
    alongside (exclusive arenas and dice). Resets each season. This is
    a second progression next to trophies, so the design must keep the
    two from confusing each other.
  - Paid Applications agreement: ACTIVE (David confirmed 31 Aug).
  - Still needed: product IDs chosen (permanent, never reusable —
    name them carefully), products created on the App Store record,
    StoreKit code (native — must ride the same binary as the ads SDK to
    avoid a second build), and the XP/season system itself (pure JS,
    can ship and iterate over the air).
  - The submission itself still sits behind the full-test-on-Fable gate
    in AGENTS.md.

## App Store page assets (6 Nov 2026)

- The 12 screenshots in `store/screenshots/` (rebuilt 5 Nov: closer
  boards; order battle, online, collecting, season, cups, two players;
  no retired dice) replaced the old ones on version 1.60.0 through the
  API, all COMPLETE. Screenshot 04 shows Fire & Ice: rebuild it with the
  running season's items for any submission after 30 Nov.
- `store/videos/header-3840x1646.mp4` (21:9 looping header, iOS 27+) was
  uploaded 6 Nov 2026 by hand through App Store Connect (the API has no
  header endpoint). It replaced the 16:9 header picture in the one header
  slot; the Search Results tab keeps the 16:9 picture (5244x2950).
- The two rendered app previews in `store/videos/` are NOT for upload:
  they use cinematic cameras, and guideline 2.3.4 allows only screen
  captures of the app. `preview-real-iphone-886x1920.mp4` (8 Nov 2026) is
  David's own screen recording of a battle, scaled to 886x1920 at 30 fps,
  status bar blurred, game sound kept, 24.7 s. Uploaded 8 Nov 2026 as
  the iPhone 6.7" preview (set `IPHONE_67`, poster frame at 6 s), state COMPLETE.

## Ads: why none were ever requested, and the fix (5 Nov 2026)

- AdMob's reports showed ZERO ad requests in 30 days. v1.167.0's status
  line (hold the version line in Settings) gave the reason: the consent
  SDK (UMP) failed with "Failed to read publisher's account
  configuration; no form(s) configured for the input app ID", and
  `ads.ts` treats any consent failure as no ads.
- Fixed in AdMob, not in code: a European regulations (GDPR) message was
  published under Privacy & messaging for Dice Battles: Color Rush (iOS),
  with "Do not consent" on. David's phone then showed "Ads: ready".
- Confirmed on David's phone 6 Nov 2026 (v1.171.1): "asked Google 4 times
  since opening", every answer "[googleMobileAds/no-fill] No ad to show".
  The game requests correctly; Google serves nothing to an app that is
  "Requires review" / "Limited ad serving". Expected to fill once the app
  is live and its App Store page is linked in AdMob (launch-day step).
  Child-directed, non-personalised, G-rated requests fill below average.

## Build 20, runtime 4.0.0 (5 Nov 2026): iCloud for a new iPhone

- Build 20 (EAS `a5ee8874-9b6e-4794-a2b7-1c67832f7ac4`, ASC build
  `8c20ad92-ecc5-4b09-8936-9195a7246626`) adds the local module
  `modules/icloud-store`. It is the build on App Store version 1.60.0
  (it replaced 18), and the Family TestFlight group gets it on its own.
- What uses it: v1.164.0's "Is this you?" (`icloudAccount.ts`), which
  carries the ACCOUNT to a new iPhone; Marc's server backup
  (`cloudSave.ts`, v1.162.0) then restores the progress. The full iCloud
  save first built into build 20's own bundle was replaced by this before
  it was ever published: an over-the-air update newer than the build
  replaces the built-in JavaScript on first launch.
- Runtime stays 4.0.0: the JavaScript finds the module with
  `requireOptionalNativeModule`, so build 18 just lacks the feature.
- iCloud (ICLOUD, Xcode 6) was switched on for bundle ID `YP486623YL`
  through the API; that invalidated the old App Store profile, and EAS
  made a new one, `4H9976625H`. Build 19 was cancelled because it was
  still signed with the old profile.
- How builds and submits run from a session now: `eas build` with
  `EXPO_ASC_API_KEY_PATH`, `EXPO_ASC_KEY_ID`, `EXPO_ASC_ISSUER_ID`,
  `EXPO_APPLE_TEAM_ID=K3N9FG8NKD` and `EXPO_APPLE_TEAM_TYPE=INDIVIDUAL`
  set (EAS can then fix the profile itself); `eas submit` still needs the
  three `ascApiKey*` fields added to eas.json for the run, then removed.
- Tried on a phone 5 Nov 2026: David deleted and reinstalled build 20 and
  was welcomed back with his progress. The new-iPhone question ("Is this
  you?") has not been tried on a second device yet.

## Build 18, runtime 4.0.0 (2 Nov 2026)

v1.156.0 adds Apple's star prompt (`expo-store-review`, behind
`src/game/storeReviewSdk.ts`) and Google's 50 SKAdNetwork IDs, so
`runtimeVersion` went 3.0.0 -> 4.0.0. EAS build
`62a8cdc9-3590-46b0-996b-0cd2faf77d40` (1.60.0, build 18) was built and
submitted from a session, processed VALID, and **is now the build on App
Store version 1.60.0** (build 17 is no longer attached).

- From v1.156.0 on, every `eas update` reaches build 18 only. Builds 16
  and 17 stay on the last 3.0.0 update. Marc was emailed on 2 Nov to
  merge PR #2 before publishing again; his next version is v1.157.0.
- TestFlight: the internal "Family" group has every build (18 included).
  The external "Family & Friends" group only has builds 3 and 5; adding
  18 needs Beta App Review.
- Neon dice is $0.99 in the game since v1.154.0; App Store Connect still
  said $1.99 on 2 Nov and is being changed by hand.

## Credentials a session can use (set 1 Nov 2026)

David saved these in the Claude Code cloud environment's variables, so
every new session has them. NAMES ONLY here; this repo is public.

- `EXPO_TOKEN`: Expo access token (EAS builds, submits, OTA updates).
- `VERCEL_TOKEN`: Vercel token, no expiry, scope suttonsteam
  (`npx vercel deploy --prod` from `hq/`, after `vercel link`).
- `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_PRIVATE_KEY_B64`: the App Store
  Connect API key (Admin). The private key is the `.p8` file
  base64-encoded onto one line; decode it to a file outside the repo
  before use, e.g.
  `echo "$ASC_PRIVATE_KEY_B64" | base64 -d > ~/.appstoreconnect/private_keys/AuthKey_$ASC_KEY_ID.p8`.
  This key cannot set in-app purchase prices (403); prices are set on
  screen.

## App Store Connect, as seen live on 1 Nov 2026

Read and written through the API with a new Admin key David made that
day. Neither its ids nor its `.p8` are in this repo; they were only ever
in the conversation and the session's upload folder.

- **Version record is now `1.60.0`** (was `1.0`), still
  `PREPARE_FOR_SUBMISSION`. David chose this over renumbering the build.
- **Builds in App Store Connect (morning): 16, 9, 6, 5, 3, 2.** Build 16 (1.60.0,
  13 Oct) is VALID and attachable. **Build 17 was never uploaded**: it
  exists only on EAS (`aa12c880-…`) and needs `eas submit` or the
  expo.dev Submit button, which needs an Expo login.
- **All eight in-app purchases now exist**, each with an en-US name,
  description, review note and review screenshot: `remove_ads`,
  `coins_pouch`, `coins_chest`, `coins_vault`, `starter_pack`,
  `neon_dice`, `dino_valley` (all as in `products.ts`) and `gold_pass`
  (NON_RENEWING_SUBSCRIPTION). All show `MISSING_METADATA`, because
  two steps were refused:
  - **Price:** `POST /v1/inAppPurchasePriceSchedules` returns 403 "The
    API key in use does not allow this request", with Apple's
    documented body, even though the same key can list users.
  - **Countries:** `POST /v1/inAppPurchaseAvailabilities` returns 500
    from Apple every time.
  Both still need setting, by hand on each product or by the API once
  the cause is found. Not yet attached to the version.
- **Build 16 is attached to version 1.60.0** (swap to 17 is possible
  until submission). Its export-compliance answer is already "no
  non-exempt encryption".
- **App Review notes written** (no login; child-directed,
  non-personalised ads; what each purchase is; Game Center only, no
  free text). Contact details were already set.
- **Checked and already right:** age rating 4+ with advertising yes,
  user-generated content no, messaging no; Game Center enabled on the
  version; app price Free; available in new territories; content rights
  "does not use third-party content"; release set to automatic after
  approval.
- **Still only on David's screen:** App Privacy (no API), Business →
  Agreements, AdMob.
- **Later the same day (via Claude in Chrome, on David's screen):**
  - **Paid Apps Agreement: Active**, effective 1 Nov 2026, nothing pending.
  - **All eight purchases priced and in all 175 countries**, US base:
    remove_ads $3.99, coins_pouch $0.99, coins_chest $4.99, coins_vault
    $9.99, starter_pack $4.99, neon_dice $1.99, dino_valley $2.99,
    gold_pass $2.99. The API reads every one as `READY_TO_SUBMIT`
    (the website labels that "Prepare for Submission"). The key is
    still refused on prices even with the agreement active.
  - **App Privacy PUBLISHED**: data collected, 11 types, NONE used for
    tracking. Name, User ID, Gameplay Content, Other User Content,
    Other Diagnostic Data, Device ID (App Functionality; Device ID also
    Third-Party Advertising and Analytics), and from Google's AdMob
    disclosure page Coarse Location, Product Interaction, Advertising
    Data, Performance Data, Crash Data. All linked to the user except
    Crash Data. These answers stay true only while the child-directed,
    non-personalised ad flags are on (AGENTS.md).
  - The version page has no "In-App Purchases and Subscriptions"
    section; the purchases have not yet been put in a submission.
- **Build 17 uploaded** from the session (EAS Submit, Apple key in a
  temporary `eas.json` edit that was reverted), processed `VALID`, and
  is now the build on version 1.60.0, with encryption answered "no".
- **The eight purchases are in a DRAFT review submission** (Apple's
  newer flow: "Add for Review" on each purchase; the version page has no
  purchases section). Not sent. Version 1.60.0 is not in it yet; adding
  it and pressing Submit to App Review is the last step, after the gate.
- **AdMob, checked 1 Nov:** iOS app and interstitial `…/5594525845` (the
  one `ads.ts` uses) present; a second unused unit with the same name,
  `…/2079998267`. "Requires review / Limited ad serving" until the App
  Store page is linked after launch. app-ads.txt: no requests yet
  (expected before launch). Payments: W-9 and address on file, no payment
  method yet (Google asks at the threshold). **Account max ad content
  rating changed from MA to G**, matching the per-request G cap in code.
- **Push notifications WORK (1 Nov).** APNs key `TH96G837ND` (team
  K3N9FG8NKD) made and uploaded to EAS for com.dmsutton.dicebattles. A
  test through `/api/push/announce` reached David's phone; two phones
  were registered. The game only asks when someone taps "Tell me about
  updates" in its Settings (builds 16 and 17), never at launch.
- **Support emails WORK (1 Nov).** Resend account with
  papershipstudio.com verified; `RESEND_API_KEY` saved in Vercel as
  Sensitive (Production). A test reply from /admin/support reached
  David's Gmail from support@papershipstudio.com.
- **Website deployed twice on 1 Nov** from this branch (privacy wording,
  then the Resend key). Before deploying, the live source was compared
  file by file: identical apart from the privacy sentence. Earlier
  deploys titled "Add software factory" came from commits that are not
  on GitHub. Vercel flags `HQ_API_TOKEN` and `SUPABASE_SERVICE_ROLE_KEY`
  "Needs Attention" (not yet Sensitive); lock them after launch, saving
  the HQ token first.

## iOS builds can run from a session again (9 Oct 2026)

Build 16 (1.60.0, runtime 3.0.0 — purchases and push on) was built from
a session. EAS now holds the iOS credentials itself: a new distribution
certificate (serial B252B6FD…, expires 9 Oct 2027) and an App Store
provisioning profile (2AC398XUY6) carrying Game Center, In-App Purchase,
Associated Domains and Push Notifications. So
`eas build --platform ios --profile production --non-interactive` works
from any session with EXPO_TOKEN set — no Apple login, no Node on
David's side. The older certificate 53S59K9KFQ was left untouched.

Build 17 (1.60.0, runtime 3.0.0, JS v1.151.0) was built the same way on
23 Oct 2026: EAS build `aa12c880-c77c-4339-bcda-631342fa903d`. It carries
the "Perfect Match" icon set and the smaller sound. Uploading it to App
Store Connect (`eas submit`) was NOT done from the session; it needs
running by a person.

Still missing: an APNs push key on EAS. Pushes cannot be delivered until
one is added; it does not need a new build.

## Known-open, as of the last update

- **9 Nov 2026 (v1.177.0, iOS update 01a1bdeb, group 3a534b4c): the final
  pass before the App Store submission, on Fable**, David: "Run final test
  ... Memory and leaks. File size and bloating. Security ... Fix everything
  you can in the game and on App Store Connect. Then when all is done submit
  it for launch." Five audits ran in parallel worktrees (website links,
  pages and security; game copy and purchases; dead code; rendering, iPhone
  Duo layouts and music; memory and leaks) and everything they fixed is in
  v1.177.0: the Twinkle Market's string-light glow texture leaked one GPU
  texture per battle (now cached; `tests/memory.test.ts`), Gold Pass card
  says "This season's", restore wording and American spellings, dead code
  (`flagstoneTexture.ts`, nine exports, `assets/icon.png`), website security
  headers + `/hq` redirect + no database text in API errors + one
  `hqToken.ts` + canonical/link cards/favicon/AA contrast/44 px taps + Next
  and sharp patched + poll indexes. Checks on commit 760786e: tsc 0 errors,
  1645 tests passed, Metro export exit 0 (6.4 MB Hermes bundle), hq tsc and
  `next build` exit 0. **The website deploy of these changes was blocked by
  the session's permission classifier** (production deploy): live is still
  dpl_BTU3aFwB4yT28WuhdfnZ5a6D5g8s at 431469c; David runs
  `cd hq && npx vercel deploy --prod` (or says "deploy" in a session).
  Reported, not fixed: `fanfare-brass.m4a` true peak +3.3 dBTP (the mono
  downmix in `tools/music` happens after the limiter; fix is downmix before
  `loudnorm`, re-render — a new take for Marc to hear), `music-brass-hot`
  +2.1 dBTP (inaudible under MIX.music 0.4), Pixel fanfare 2 LU louder than
  Brass; per-mount materials in DieMesh/Jungle/Space/ThemedArena never
  disposed (bounded, programs shared). Contact sheets of every die, board,
  screen and Duo layout were rendered for the audit (scratchpad only). Two
  "AUDIT TEST, ignore" rows the website audit left (`messages`
  27f3f9f6…, `ideas` 64f6ac0f…) could not be deleted (the delete needed a
  confirmation); harmless, David or Marc can delete them from the board.
  Instruments on a real phone after launch: GPU memory over 30 Twinkle
  Market battles, effect skins ×20 battles, audio after 10 lobby↔battle
  hot fades, background/foreground ×10, Share ×10 (Caches/GLView ≤ 2).

- **9 Nov 2026 (v1.176.0, update 01a1bdaa, group d8b721bc): the Snow Globe dice is Season 1's free-row die at
  level 20**, David's pick ("Do the village globe but put the houses and trees
  on the design at the corners of the dice"). `snowglobe` in diceSkins.ts /
  patterns.ts, effect `diceSnowGlobe.ts` (snow swirls while rolling, flurry on
  landing, settles at rest, bubbles in the moat). Not seen on a phone: Marc
  should roll it once. Four Twinkle Market FLOOR trials (snow with sleigh
  tracks, woven brick, frozen lake, boardwalk) were rendered for David from
  the scratch worktree; he picked the brick ("I like the brick one, do that"),
  so `marketBrick` replaced `marketCobbles` in the same update and the
  `stringLights` floor fingerprint is re-pinned. Marc should look at the
  market floor on a phone once.
- **8 Nov 2026 (v1.175.0, update 01a1bd9b, group 6e040bb9): the Bauble dice is DELETED and Season 1's level 20
  (free row) is EMPTY** until David picks its replacement. He likes the Snow
  Globe idea; three versions were painted for real and rendered for him
  (Village, Midnight, Blizzard: scratch worktree, not in the tree). The one
  he picks is built as a proper pass die with its own effect, goes into
  `SEASONS` at level 20, and the table-change rule pays it to everyone already
  past 20. The Twinkle Market shoppers now walk round the stalls, parcels and
  lantern posts (`src/arena/marketPath.ts`); the two props nearest the camera
  became lantern posts so the detour fits an iPhone 15's frame.
- **8 Nov 2026 (v1.174.0, update 01a1bc89, group 1713b033): the News tab is
  EMPTY**, at David's request, after the v1.173.0 season-swap post popped up
  on his phone. A post now disappears by itself a month after its date
  (`recentNews` in news.ts, bundled and board alike), and any new or changed
  post is put in chat and waits for a yes from David or Marc before it ships
  (AGENTS.md, Releasing). Phones that already saw the swap popup keep nothing
  of it: the post is gone from the tab.
- **8 Nov 2026 (v1.173.0, update 01a1bbca, group 938375e1): the seasons SWAPPED.**
  David: "swap around season one and season two, so season 2 is the current
  season, but obviously call it season 1 ... go until the end of December, and
  for fire and ice to start on January first." Season 1 is Sugar & Snow,
  Oct–Dec 2026 (`months: 3`); Season 2 is Fire & Ice, Jan 2027 (`earnedFrom:
  '2026-10'`, so Fire/Ice items won in October stay visible and counted); Sun &
  Moon is Season 7 by the numbering rule, so **Feb–May holds only four of the
  five planned seasons — David has to pick which one drops or moves** (see
  docs/seasons-3-to-8.md). Saves from before the swap keep their XP and are
  paid the Sugar & Snow items at the levels already climbed, once per row
  (`SeasonState.table`/`goldTable`). Not yet seen on a phone: Marc should open
  the game, check the pass shows "Season 1 · Sugar & Snow" to 31 Dec, that the
  owed items arrive after one battle, and that his Fire dice are still there.
  Season 3 (February) now has to be built by 15 January.
- **8 Nov 2026 (v1.172.0, update d8394194): Sugar & Snow is BUILT**
  (`SEASONS` in seasonPass.ts; Season 1 since v1.173.0): Gingerbread Village (`gingerbread`,
  structure `icedBiscuit`), the Gingerbread dice, the Bauble dice (free row) and
  the Twinkle Market (`twinklemarket`, `stringLights`), with their own kits,
  jails, hazards, floors, card art and life (gingerbreadLife.tsx,
  marketLife.tsx, snowfall.tsx). Looked at in the browser renderer only, not
  on a phone: Marc should play a battle on each board (they are the running
  season's now) and check the train, the skaters and the dice effects.
- **5 Nov 2026 (v1.170.0, update 74235d88):** share card's board was white on
  iPhone: the capture now has three redraw the scene into a render target
  (`drawBoard`, isXRRenderTarget + RGBA8) instead of blitting the view's MSAA
  buffer. v1.168.0's three-drawn card art is confirmed working on Marc's phone;
  the board half is still to be seen there. Play no longer pays the ad wait
  again after one came up empty (one 6 s deadline, once a session).
- **5 Nov 2026 (v1.169.0, update 2270020c):** friend-code invite on iOS no
  longer puts the link in the text as well as in `url` (Messages drew two cards).
- **5 Nov 2026 (v1.168.0, update 7436920f):** the share card is drawn by three
  (render target + planes, pictures via `{ data: { localUri } }` like fiber's
  native TextureLoader), after the raw-GL card came out blank on Marc's
  iPhone. Confirmed on Marc's phone: the art draws. Ads: tester mode (the admin code) counts as ads removed, so a
  tester never sees one; real ads also need the app live and approved in AdMob.
- **5 Nov 2026 (v1.167.0, update 88bfca8b):** fixed the battle after a win
  drawing with no floor, walls, gatehouse, water or dice (Marc's screenshot).
  three's `resetState()` threw on a phone, because expo-gl's context has no
  `gl.canvas`, and left the depth test off for the session. `src/share/glReset.ts`
  gives the context a canvas. The same throw meant "Share your win" never once
  appeared on a phone, so v1.167.0 is its first real run: check the picture.
- **5 Nov 2026 (v1.166.0, update 543f7baf):** "Share your win" on the victory screen
  (`src/share/`): board captured at the win via expo-gl (MSAA blit first),
  card composed in GL on the tap, shared with React Native's Share. Never run
  on a device before shipping: first check on a phone that the picture is
  upright and not black. `BOARD_ANCHOR` in shareCard.ts tunes which band of the
  board shows. iOS only (Android's Share ignores `url`).
- **5 Nov 2026 (v1.165.0, update 2228ab4b):** all music and jingles are our own (`tools/music/`,
  `assets/sounds/CREDITS.md`): battle tracks pixel/brass/neon in rotation
  (`musicRotation.ts`), each crossfading into its `-hot` version when either
  side is one rescue from winning (`musicIntensity.ts`), a lobby theme on the
  menus, our fanfares, sting, purchase sound, cheer and equip bloop. No credit
  is owed to anyone now; Settings has no credits block. Only judged by
  measurement and on node: Marc should listen on a phone to the build-up
  switch and the lobby level (`MIX.lobby` 0.35). Still pending: the announcer
  voices (Kenney CC0 today), and the share-your-win picture (branch
  feature/share-win).
- **4 Nov 2026 (v1.159.0, update 58345c1d, website deployed):** online
  battles, Practice in Settings, seven dice redrawn, Store renamed Shop,
  the trophy ladder topped at 8,000, Dino Valley hidden (`hidden` in
  products.ts), the Gold Pass mark. Shipped before the App Store
  submission at Marc's request, so the pre-submission pass is re-run on
  this state. **Online battles are ON**: the database half,
  `hq/supabase/migrations/20261104_matchmaking.sql`, was applied on
  4 Nov 2026 through the Supabase connector (`match_queue`,
  `battles.kind`, `claim_match()` service-role only). Below
  100 trophies it is always a rival (`BOT_ONLY_BELOW_TROPHIES`). Done
  in App Store Connect on 4 Nov 2026: `dino_valley` is out of the draft
  submission and removed from sale (the product still exists), the
  draft holds the other 7 purchases, and the coin packs say "Shop".
  The privacy policy, terms and App Review notes describe online play
  since 4 Nov 2026 (website deployed 14:25 UTC, `dpl_8Q2GCdByL4UFJXeb8Ksm26bbzSG4`).
  Still open: online wins are paid on the phone's own word.
- **5 Nov 2026 (v1.163.0, update 67f8d5a3):** the real-player search shows from the first
  frame (`showsSearch` includes `asking`); no computer rival's name before
  the 15 seconds are up (Marc).
- **5 Nov 2026 (v1.162.0, update 8a9c042b, website deployed `dpl_EhzpwSMePjwnYmhWUqH37LDc7r8J`):** Marc's second batch. A reinstall restores
  everything (`src/game/cloudSave.ts`, `POST /api/players/save`, table
  `player_saves`; the keychain keys had a slash and had NEVER been written
  since 7 Sep: fixed, so only a phone that opens v1.162.0 once before being
  deleted keeps its identity). "Play again" after a live battle is a rematch
  invite both must accept (`battle_invites.rematch_of`). News posts
  collapse and expand; a `major` post pops up once after an update
  (`src/game/whatsNew.ts`). Matchmaking no longer latches off for the
  session; a graze during a roll is not a throw; painting pauses behind a
  popup. Migrations `20261105_rematch.sql` and `20261105_player_saves.sql`
  applied through the Supabase connector before the website deploy and the
  OTA update. To test on a phone: open v1.162.0 once, delete, reinstall:
  "Welcome back" card, same friend code. Open: no confirm dialog when both
  the phone and the server have progress (the phone wins); board posts
  cannot be `major` (the feed does not send it).
- **5 Nov 2026 (v1.161.0, update f22413b5, website deployed `dpl_EEcqcXLBsfpwPKjTX1yiud5YjWJ3`):** Marc's four requests of the day. Shop and
  Inventory cards show a sweep of light until their picture lands and the
  open tab's cards paint first (`src/dice/previewLoad.ts`,
  `PreviewLoading.tsx`, `SHELF_SLICE_MS`); a preview never paints on the
  render path. The Tiger, Chicken and Waffles and Watermelon cards are
  composed for the card (`CARD_SAMPLERS` in patterns.ts). Leopard and
  Tiger paint 8x and 6x faster, and `wrappedNoise` reads a lattice table
  (same pixels). Tennis Ball retired like the six ball dice (395 coins
  refunded once). Paper Ship Studio LLC in the About text, the site
  footer and the legal pages (website deployed). Measured only in node:
  Marc should open the Shop with everything unlocked right after an
  update and tap Leopard, Pizza and an arena to see the loading states.
- **4 Nov 2026 (v1.160.0, update f9099fe4):** the Ocean dice flow on
  one 1.8 s clock (`src/dice/oceanFlow.ts`) and splash when they land
  (`src/dice/diceOcean.ts`, effect `ocean`). Marc may want the flow
  slower or faster: `TUNING.ocean.flowSeconds`, an OTA update.
- **4 Nov 2026 (v1.158.0):** the title card is a LOADING screen
  (`src/game/launchReady.ts`: min 0.8 s, cap 12 s) and every picture is
  painted in slices. Shelf pictures and the equipped die are kept
  between launches per `GAME_VERSION`, so every update MUST bump
  `GAME_VERSION` (the release rule already) or players see stale
  pictures. Measured only in node: Marc should try a cold launch twice,
  with everything unlocked and the Pizza or Fish die, and backgrounding
  during loading. The six ball dice are retired (admin mode only; old
  price refunded once). Shipped before the App Store submission at
  Marc's request: the pre-submission pass is re-run on this state.
- **3 Nov 2026 (v1.157.0):** shipped to build 18 BEFORE the App Store
  submission, at Marc's request, so the pre-submission pass on 87adf8e
  no longer counts; it is re-run on the final state. The secret codes
  are fourteen characters from this version; the ten-character ones are
  dead. A speed/loading-screen change (branch feature/fast-start) follows.
- **1 Nov 2026 (v1.155.0):** friend battles were rebuilt (waiting
  room, the friend kept as the opponent, live progress callouts, "On
  now" in the Friends list). Verified against the live API with two
  test players by script, not on two phones: the first family
  two-phone run is the real test. If something is off, the server
  side is `hq/src/app/api/battles/*` and the game side
  `FriendlyWaitOverlay.tsx` and the live beat in DiceDemoScreen.tsx.
- **1 Nov 2026 (v1.154.0):** the migration
  `hq/supabase/migrations/20261101_battle_clock.sql` (a check that a
  battle's winner is a player or 'tie') was applied on 4 Nov 2026,
  once the Supabase connector reached the Dice Battles org again.
  The `changes` table was caught up the same day (v1.142.0 to v1.160.0).
- Neon dice are $0.99 in the game and in App Store Connect (Claude in
  Chrome set the price on 2 Nov 2026).

- **Audit of 17-18 Oct 2026 (v1.110.0).** Game, website and admin
  fixes are live. Still open from it:
  - The database half was applied on 18 Oct 2026 once Supabase was
    reconnected: approvals can only come from David, history rows carry
    the real author, votes are tied to their question and only accepted
    while it is open, a raised question with votes can no longer be
    deleted by whoever raised it, and `/api/bug-report` now files through
    the atomic `report_bug()`. `schema.sql` now also lists `battles`,
    `battle_invites`, `game_news` and `player_profiles.last_seen`.
  - **The Supabase connector holds DROP, UPDATE and DELETE statements
    for a person's approval** and the call times out after 60 s if
    nobody answers; inserts, `create`, `alter policy` and reads go
    straight through. Plan writes around that, or ask David to approve.
  - Auth's leaked-password protection is off (Supabase dashboard →
    Authentication → Passwords). A `wicked` schema shares this database;
    it is not Dice Battles and was left alone.
  - Privacy policy and Terms were rewritten on 23 Oct 2026 at David's
    request to cover purchases, the Gold Pass, friend battles, update
    notifications and Game Center. The copy lives in
    `hq/src/lib/legalCopy.ts`; a `site_content` save only wins if it is
    newer than that copy's `written` date.
  - `schema.sql` is missing `game_news`, `battles`, `battle_invites`
    and `player_profiles.last_seen`, which exist live.
  - Music (6 MB, 96 kHz AAC) and the WAV voice lines could be
    re-encoded for about 3 MB less; needs a listen test first.

- **Invite links need a BUILD before they open the game** (v1.92.0,
  17 Sep 2026). Sharing a friend code works over the air today: the
  share sheet, the written message, and the preview card with the
  game's logo on it. The last step does not, and cannot until Apple
  bakes it in — `app.json` now carries `scheme: "dicebattles"` and
  `ios.associatedDomains`, and neither reaches a phone through
  `eas update`. Until a new build ships, a tapped link opens
  `papershipstudio.com/add/<code>`, which shows the code big enough to
  type into the game by hand.

  The website half is already live: the page, its Open Graph tags, the
  1200×630 card at `hq/public/images/dice-battles-card.png`, and
  `/.well-known/apple-app-site-association` (served as
  `application/json` by a rule in `hq/next.config.ts` — Apple refuses
  any other content type, silently).

  **The build cannot be run from a fresh session, and it is worse than
  a missing file.** Checked properly on 18 Sep 2026 rather than assumed:

  - `eas.json`'s production profile is `credentialsSource: "local"`, and
    `credentials.json` is not in a fresh container — nor are
    `~/.dice-battles-credentials/` or `~/.appstoreconnect/private_keys/`,
    which live outside the repo on purpose.
  - Switching that profile to `remote` does NOT help. Tried it:
    *"Distribution Certificate is not validated for non-interactive
    builds. Credentials are not set up."* EAS holds no iOS credentials
    for this project on its servers — every build so far has used local
    ones.
  - **And the old credentials would not be enough anyway.** Universal
    links need the **Associated Domains** capability enabled on the App
    ID *and* a provisioning profile that carries it (Apple's own
    requirement — see "Supporting associated domains"). The profile
    build 9 used predates the entitlement, so restoring the old files
    and rebuilding would produce a binary whose links silently do
    nothing. The capability has to be enabled and the profile
    regenerated, which needs an Apple login.

  **Done on 20 Sep 2026, with an App Store Connect API key David
  supplied** (key `6RT224Y3XP`; the issuer id is unchanged and the key
  has Admin access, both verified against the live API):

  - **`ASSOCIATED_DOMAINS` is now enabled on the App ID.** It was not
    before — the App ID carried only `GAME_CENTER` and
    `IN_APP_PURCHASE`. This was the one step that genuinely required
    Apple account access, and it is the step that makes a universal
    link possible at all.
  - **Both existing provisioning profiles went `INVALID` as a result**,
    which is what Apple does to every profile for an App ID whose
    capabilities change. They were `IOS_APP_STORE` profiles expiring
    2027-08-17. A new profile has to be issued; this is expected, not a
    fault.
  - `eas.json`'s production profile is now `credentialsSource:
    "remote"`, so EAS will generate the certificate and profile itself.

  **What is still not done: the build.** `eas build --non-interactive`
  only VALIDATES credentials, it never creates them — *"Distribution
  Certificate is not validated for non-interactive builds. Run this
  command again in interactive mode."* Creating them by hand through
  the API instead (generate a key, POST /v1/certificates, POST
  /v1/profiles) is blocked in this environment as a secret-store write,
  which is a fair guard: it mints a new signing identity on a personal
  Apple account.

  There is exactly one distribution certificate on the account
  (`53S59K9KFQ`, expires 2027-08-17) and this repo does not have its
  private key.

  So the build needs one interactive run, from any computer with Node —
  **not a Mac; EAS builds iOS in the cloud**:

  ```
  npx eas-cli login
  npx eas-cli build --platform ios --profile production
  ```

  EAS then offers to make the certificate and profile, and the profile
  it makes will carry the Associated Domains entitlement because the
  capability is already on the App ID.

  Side note: probing this incremented EAS's stored `buildNumber` from 9
  to 11 without producing a build. Harmless — it only has to increase.
- **Resend not connected** — ticket replies cannot email anyone yet
- **The hourly bug-watch routine is unproven** — created, but whether it
  keeps database and email access when it fires automatically is not yet
  confirmed. `/admin/automation` shows nothing under "what has actually
  happened" if it silently failed.
- **The icon set is settled, and reaches phones in the next build.** The
  three files `app.json` actually points at are
  `assets/icon/light.png`, `dark.png` and `tinted.png` — the "Perfect
  Match" design in the three appearances iOS 18 asks for.
  The old single `assets/icon.png` was a superseded orphan that nothing
  referenced; it was deleted in the 9 Nov 2026 audit. An icon is compiled in rather than sent
  over the air, so what is on a phone today is whatever build 5 carried.
- **Android now has a build, but has never shipped to a store.** The
  first Android APK was built 20 Aug 2026 (`eas build --platform android
  --profile adhoc`), on the `main` channel, so it receives every
  `eas update` exactly as the TestFlight build does. There is still no
  Play Console account (that is $25 once, against Apple's $99 a year).

  The APK matters beyond Android itself: it installs from a link with no
  developer account, no device registration and **no age check**, which
  is the wall that stops under-13s using TestFlight. If testers under 13
  need the real app, Android is the only route that does not require
  Apple's permission.

  Nobody has yet played it on Android. Expect rough edges; the app has
  only ever been exercised on iOS.

  Note for whoever builds next: the first attempt failed with
  `Connection reset` while EAS downloaded Gradle itself. That is Expo's
  network, not this repo — retry rather than change anything.
- **Paper Ship Studio LLC** since 5 Nov 2026 (Marc). The game's
  copyright line, the site footer and the legal pages name the LLC; the
  Apple developer account is still Individual until David converts it.

## Conventions worth not rediscovering

- Every OTA update gets a `CHANGELOG.md` version recording **who asked
  for it**, and the same version goes in the `eas update --message`.
- The game's test suite is headless (`tests/`, tsx-based, no jest).
  Logic that needs testing gets split out of React Native-touching files
  — see `settle.ts`, `slider.ts`, `bugReportValidation.ts`.
- Public site pages are `force-dynamic` because they read editable copy
  from `site_content` on every request. Each has a code-level fallback so
  a missing row can never blank a page.
- The public pages read content through the **service role**, not an
  anonymous browser key — a visitor is never signed in.
