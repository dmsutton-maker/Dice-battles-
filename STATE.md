# Where things stand

A map of the project as it actually is, so a session can get oriented in
one read instead of reconstructing it from conversation history. Keep it
current — a stale map is worse than none. `AGENTS.md` holds the *rules*;
this holds the *facts*.

Last updated: 24 August 2026.

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

## Known-open, as of the last update

- **Resend not connected** — ticket replies cannot email anyone yet
- **The hourly bug-watch routine is unproven** — created, but whether it
  keeps database and email access when it fires automatically is not yet
  confirmed. `/admin/automation` shows nothing under "what has actually
  happened" if it silently failed.
- **The app icon on phones is stale** — `assets/icon.png` holds the
  settled "Perfect Match" design, but an icon is compiled in, not sent
  over the air. It reaches phones in the next native build.
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
- **No legal entity** — Paper Ship Studio is a trading name, not a
  company. Legal pages name David Sutton personally, which is correct
  until that changes.

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
