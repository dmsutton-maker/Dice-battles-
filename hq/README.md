# Dice Battles HQ

Two things in one small Next.js app:

- **The public site** — what the game is, plus the Privacy Policy, Terms
  and Support pages Apple requires a live URL for.
- **The private HQ** at `/hq` — ideas, approvals, phases and timeline for
  the family. Invitation only.

## How the work actually flows

1. Anyone invited puts an **idea** on the board. It starts as *pending*.
2. **David approves it** (or parks it, or declines it) with a note.
3. Approved ideas get sorted into **phases** — that is the timeline.
4. Claude reads the approved queue through `/api/queue`, builds the top
   item, and marks it *building* and then *shipped* with the version
   number it went out in — the same version that appears in
   `CHANGELOG.md`.

Claude can move an idea from *approved* → *building* → *shipped* and
nothing else. It cannot approve anything, ever: that is David's alone,
from a signed-in browser. A build token that could approve its own work
would make the board pointless.

## It is live

**https://dice-battles-hq.vercel.app**

- Public site at `/`, with `/privacy` and `/support` — the two URLs Apple
  requires for the App Store listing.
- The board at `/hq`, invitation only.

Hosting is David's personal Vercel (`suttonsteam`, Hobby plan) and
personal Supabase (org "Dice Battles"). The setup steps below are kept
for reference, and for anyone rebuilding this from scratch.

**Redeploying:** the Vercel GitHub app is not installed, so pushing does
not redeploy. From `hq/`, run `npx vercel deploy --prod`. To make pushes
deploy automatically, install https://github.com/apps/vercel, connect the
repo in the project's Git settings, and set **Root Directory** to `hq`.

## Setting it up

Everything below happens in **personal** accounts — never an
employer-linked one.

### 1. Supabase

1. Sign up at [supabase.com](https://supabase.com) with a personal email
   and create a project (the free tier is plenty).
2. Open the **SQL Editor**, paste in all of `supabase/schema.sql`, run it.
3. **Project Settings → API** — copy the Project URL, the `anon` key and
   the `service_role` key.
4. **Authentication → URL Configuration** — set the Site URL to wherever
   the site will live, and add `<that URL>/auth/callback` as a redirect
   URL. Do the same for `http://localhost:3000` if you want to work on it
   locally.

### 2. The app

```bash
cd hq
npm install
cp .env.example .env.local     # then fill in the values
npm run dev                    # http://localhost:3000
```

### 3. Vercel

1. Sign up at [vercel.com](https://vercel.com) with a personal email and
   import this repository.
2. Set **Root Directory** to `hq`.
3. Add every variable from `.env.example` under Environment Variables,
   with `NEXT_PUBLIC_SITE_URL` set to the deployed URL.
4. Deploy. The URL it gives you is what goes in App Store Connect as the
   Privacy Policy URL (`/privacy`) and the Support URL (`/support`).

### 4. Let the family in

Sign in as David, go to **People**, add each person's name and email.
They can then sign in with a link emailed to them — no passwords, which
matters when half the team are children.

## Votes

Some questions have no right answer to look up — which app icon, which
name, which colour. Those go in **Vote** instead of on the ideas board:
Claude puts up the options, everybody votes, David settles it.

Everyone sees who voted for what, on purpose — the point is to argue
about it, not to run a secret ballot. You can change your vote until it
is settled.

The token can raise a question and read the result. It cannot vote and it
cannot settle one.

## The queue endpoint

```bash
# What has been approved, in the order to do it
curl -H "x-hq-token: $HQ_API_TOKEN" https://YOUR-SITE/api/queue

# Starting on something
curl -X POST https://YOUR-SITE/api/queue \
  -H "x-hq-token: $HQ_API_TOKEN" -H 'content-type: application/json' \
  -d '{"id":"<idea id>","status":"building"}'

# Finished, and which version it went out in
curl -X POST https://YOUR-SITE/api/queue \
  -H "x-hq-token: $HQ_API_TOKEN" -H 'content-type: application/json' \
  -d '{"id":"<idea id>","status":"shipped","version":"v2.1.0"}'

# Put a question up for a family vote
curl -X POST https://YOUR-SITE/api/proposals \
  -H "x-hq-token: $HQ_API_TOKEN" -H 'content-type: application/json' \
  -d '{"title":"Which colour for the win screen?",
       "question":"Pick one.",
       "options":[{"label":"Gold"},{"label":"Green"}]}'

# Read the tallies and what was chosen
curl -H "x-hq-token: $HQ_API_TOKEN" https://YOUR-SITE/api/proposals
```

## Rules this app follows

- **Nothing secret is committed.** This repository is public. Keys live in
  `.env.local` (git-ignored) and in Vercel's environment variables.
- **No employer infrastructure.** Personal accounts only, same rule as the
  game itself.
- **The database is the lock, not the page.** Row-level security decides
  who can do what; hidden buttons are only tidiness.
- This app is completely separate from the game. The game stays
  native-only Expo — no web target, ever.
