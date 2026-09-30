---
name: site-check
description: Drive a real Chromium browser with Playwright to look at the Paper Ship Studio website or admin and measure what a person would complain about — text spilling outside its box, text too faint to read, buttons too small to tap. Use when changing anything visual in hq/, before deploying the site, or when someone reports that something "looks wrong", "goes outside the border", or is "hard to see".
---

# Looking at the website with a real browser

Playwright and Chromium are already installed in this container. Nothing
needs downloading, and `playwright install` must never be run — the browser
is at `/opt/pw-browsers` and `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` is set.

Playwright is NOT in the repo's `node_modules`. It is global:

```js
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
```

## What this is for

Every layout complaint on this project has been one of three things:

- text spilling outside its box ("website text goes outside the border")
- text you cannot read against what is behind it ("white on white")
- something too small or too faint to use ("hard to see")

All three are measurable. Measure them instead of hoping to spot them.

```bash
node .claude/skills/site-check/check.mjs --live https://papershipstudio.com/
node .claude/skills/site-check/check.mjs http://localhost:3000/admin
```

It reports, at phone / tablet / desktop widths, and writes a full-page
screenshot of each: whether the page scrolls sideways, which elements
overflow, which text fails WCAG AA contrast, and which tap targets are
under Apple's 44×44. Exit code is non-zero when it finds something.

**Read the screenshot before believing a contrast finding.** The script
already skips text sitting on a gradient or an image rather than guessing,
but shipping a "fix" for a false alarm is worse than the alarm.

## The two hard limits in this container

**Chromium cannot reach the internet.** The outbound proxy accepts CONNECT
from curl and from node, but resets Chromium's TLS through the tunnel —
every external URL fails with `net::ERR_CONNECTION_RESET`, whatever proxy
flags are passed. Do not try to fix this by disabling TLS verification or
unsetting `HTTPS_PROXY`; both are forbidden, and neither works anyway.

`--live` is the way around it: curl fetches the HTML and its stylesheets
(curl *does* go through the proxy) and hands them to the browser inline.
Layout, colour and overflow are faithful. Anything that only appears once
client-side JavaScript runs is not, so prefer a local server for anything
interactive.

**The local site needs secrets this container does not have.** `hq` reads
`SUPABASE_SERVICE_ROLE_KEY`, and without it every database-backed page
returns 500. The publishable key can be fetched through the Supabase MCP
(`get_publishable_keys`), but the service-role key is David's and must
never be written into this repo — it is public. Pass any key through the
environment on the command line, never into a file:

```bash
cd hq && NEXT_PUBLIC_SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_ANON_KEY=… \
  SUPABASE_SERVICE_ROLE_KEY=… npx next dev -p 3000
```

Start it with `setsid … < /dev/null &` — a plain background job gets
killed when the tool call returns.

## Driving the browser for anything else

```js
const browser = await chromium.launch();          // headless; no display here
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto('http://localhost:3000/admin');   // localhost only
await page.fill('input[name="password"]', '…');
await page.click('text=Sign in');
await page.screenshot({ path: 'admin.png', fullPage: true });
await browser.close();
```

Screenshots are worth taking and actually reading — several bugs on this
project were only caught by rendering the thing and looking at it, after
the numbers said it was fine.

## The game is out of scope

Dice Battles is native-only. It has no web build and never will, so a
browser cannot open it. Verify the game with `npx tsc --noEmit`,
`npm test`, and `npx expo export`.
