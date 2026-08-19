# Where things stand

A map of the project as it actually is, so a session can get oriented in
one read instead of reconstructing it from conversation history. Keep it
current — a stale map is worse than none. `AGENTS.md` holds the *rules*;
this holds the *facts*.

Last updated: 19 August 2026.

## The two things being built

| | The game | The website + admin |
|---|---|---|
| Where | repo root (`src/`, `assets/`) | `hq/` |
| What | Expo / React Native, iOS-first | Next.js 16 on Vercel |
| Ships via | EAS Build + EAS Update (OTA) | `npx vercel deploy --prod` from `hq/` |
| Live at | TestFlight (build 5, approved) | https://papershipstudio.com |

Metro is told to ignore `hq/`. The game never imports from it.

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

## Known-open, as of the last update

- **Resend not connected** — ticket replies cannot email anyone yet
- **The hourly bug-watch routine is unproven** — created, but whether it
  keeps database and email access when it fires automatically is not yet
  confirmed. `/admin/automation` shows nothing under "what has actually
  happened" if it silently failed.
- **The app icon on phones is stale** — `assets/icon.png` holds the
  settled "Perfect Match" design, but an icon is compiled in, not sent
  over the air. It reaches phones in the next native build.
- **Android has never shipped** — the code is cross-platform and
  `app.json` carries Android config, but there is no Play Console
  account and no Android build has been made.
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
