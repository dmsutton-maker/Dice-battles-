# Changelog

## v1.89.0 — 2026-09-11 · requested by David

"Make the ruby, copper, silver, and gold all have the exact same skin and
texture just different colours. Make sure they're all shiny."

### Changed
- **One polished surface, four colours.** Gold, Silver, Copper and Ruby
  all use `sheen` and differ only in `body` (the material) and `ink` (the
  colour the hotspot reaches). Ruby and Copper were still on the old
  sheet-positioned highlight that v1.86.0 fixed for the other two, so
  **only two of their six faces caught the light** — and since you see
  three faces at once, they mostly read as a flat brown and a flat dark
  red.
- **Three painters deleted, not left unused.** `brushed`, `ruby` and
  `copper` are gone. The note in `tests/currency.test.ts` had already
  been uneasy about the first of them — Silver was rewritten into gold's
  polished sweep back in August and the two only passed the
  no-two-skins-alike rule "on a technicality", being two painters with
  two ids. Three more copies of one look, each free to drift, is not a
  better answer than one.
- **Ruby and Copper lifted.** Ruby's `#8e2f4a` went nearly black once the
  polished shadow came off it; Copper's `#b56a3d` was the colour of a
  dull penny.

### The suite refused the first ruby, and was right
`#c0304f` came back at **ΔLab 19 from the RED face colour**, against a
bar of 28. The shell surrounds the six face stickers and the six colours
are the entire game signal, so a shell that close hides a face. Ruby
leans magenta instead of brighter — `#b02a5c`, ΔLab 32.7 — which is also
what separates a garnet from a fire engine.

### Two tests that had to change their minds
- **"No two dice skins are the same picture"** now exempts `sheen`
  alongside `plain` and `satin`, because four dice sharing one picture is
  exactly what was asked for. The exemption is not free: those four fall
  under "every shapeless skin is a clearly different colour", which is
  the rule that makes sharing a picture safe.
- **The metals' exemption from the smooth-join rule** checked that each
  face reached 235 on the red channel, which is really asking "is this
  skin pale" — ruby is a dark stone and failed at 231 with a perfectly
  good highlight on every side. It measures each face's own brightest
  point against its own darkest now, in luminance, which is what a
  highlight actually is and works whatever colour the skin is. Verified
  by putting the old sheet-positioned sweep back and watching gold fail
  at a range of 23.

## v1.88.0 — 2026-09-11 · requested by David

"I played 4 games and still haven't gotten any ads. Make sure the ad
happens when you press play again or start battle."

### Fixed — and the instruction was also the diagnosis
This file carried the opposite rule, in as many words: *"Due, but nothing
ready: SKIP it. Never make a child wait on a network fetch to get back to
their game — the next one comes around in three more games anyway."*
Good instinct, and exactly why there were no adverts.

An interstitial has to be FETCHED. The fetch only ever ran in the
background, and it needs the SDK to have finished starting up — which on
a cold launch it usually has not, because that start-up races the phone's
connection within a second of the app opening. So when the third game
ended there was nothing in hand, the advert was thrown away, `adDue` was
cleared, and the counter moved on to three games' time to do the same
thing again. Four games, no ads, exactly as reported.

- **A due ad is now waited for, with a cap.** Six seconds: long enough
  for a normal fetch, short enough that a phone in a tunnel is a pause
  rather than a hang. The SDK is started at that moment too if it never
  managed it at launch — by then there is demonstrably a player, a
  finished game and a working session.
- **A due ad is never silently thrown away.** `adDue` survives until an
  advert has actually been on screen, so a slow fetch costs a moment
  rather than three free games. The only exception is a binary with no
  ad SDK compiled in, where it truly can never happen.
- **The two ways out of the result screen are no longer the same call.**
  Start battle / Play again waits — that is what David asked for, and a
  few seconds before a battle starts is a pause before a game rather than
  an interruption of one. Going back to the MENU does not: that player is
  already looking at the menu, and an advert arriving six seconds later
  over it would be worse than none. A due ad it could not show stays
  owed, and the next Start battle pays it.

### A test that passed against broken code, twice
The new guard — "a due ad is never silently thrown away" — was written,
then verified by putting the bug back. It passed. Twice.

First it looked for a reason anywhere in the 700 characters before each
`adDue = false`, and `await waitForAd(` counted; moving the clear INTO
the give-up branch put it a few lines under exactly that phrase. Tightened
to read the branch on its own, it passed again — because the branch's
comment contains the words "`adDue` is deliberately LEFT SET", so
grepping for `adDue` found the documentation saying it was not there.

It now strips comments and pins the number of places that may clear the
flag at three. That is the third time today a test in this repo has read
its own prose and reported the opposite of the truth; every one was found
by breaking the code on purpose, and none by reading.

## v1.87.0 — 2026-09-11 · requested by David

"Add the ability to play someone on your friends list in a trophyless
friendly battle. When you click to initiate the battle it should give you
the option to choose the game mode and difficulty. The battle request
should show up on the other player's screen as a short couple second pop
up on the top of your screen where you can choose to accept or decline
and you can also see the battle request at the top of the friends tab."
And then: "you challenge someone who's on right now. It should be live
only."

### Added — the first real online play in this game
- **Challenge a friend, and battle them live.** Their prisoners move
  because their dice landed, not because a timer went off. Both phones
  send "these are the colours I have freed" about once a second and read
  the other's.
- **The picker sits in the friend's row**, not in a dialog: the list can
  be long and a modal over it loses which friend you were looking at.
  Mode and battlefield, then Ask them.
- **A banner slides across the top of whatever you were doing**, with a
  real countdown on it, and slides away after six seconds. Across the
  top and not over the middle on purpose — a challenge is an offer, and
  it has to be possible to ignore one without interrupting a battle
  already in progress. The same challenge also waits at the top of the
  Friends tab for as long as it is alive, for somebody who was mid-roll
  when the banner went past.
- **Trophyless, as asked** — and no coins, no cup progress, nothing to
  Game Center, and no step toward the advert every third game. Charging
  somebody an interstitial for playing with their brother is the wrong
  thing to monetise, and an ad between two people waiting to play again
  breaks the one thing this mode is for.

### Live only, which is the design
A challenge goes to somebody whose phone spoke to the server seconds
ago, and expires on its own after forty-five. There is no inbox and
nothing waits. A battle both people have to be present for cannot be
arranged an hour in advance, and a challenge that arrives while the
other phone is in a drawer is a disappointment with extra steps.

Presence is honest about what it can know: `last_seen` is stamped by
every authenticated call, and the friends screen makes one every few
seconds while it is open, so "on right now" means "spoke to us within
thirty seconds".

### Color Rush and Ultimate only, and why
Those two are INDEPENDENT races — each player works through their own set
of six, so a list of freed colours is the complete truth about the game
and two phones a second apart still agree about everything.

Skirmish shares ONE jail: both players reach into the same set, so a
second of lag means both can free the same prisoner. Color War puts both
sets of prisoners on ONE board, where the opponent's three are figures
whose positions are part of the round rather than a number. Either could
be done with the server holding the board; neither can be done by
exchanging a score. Offering them anyway would mean two children watching
two different games and disagreeing about who won.

The game says so on screen rather than leaving a gap.

### How it is built, and the one trade
- **Polling, not push.** The friends API is serverless functions, so
  nothing can hold a socket, and real push needs a native module, an
  Apple certificate, a permission prompt this 4+ game does not ask for,
  and a new binary. A roll takes about a second and a half from throw to
  settle, so a second of lag on the rival's score is about what watching
  somebody across a table looks like.
- **The first phone to say "I finished" wins.** Both run the same rules
  over their own board, so in an honest game that is whoever got there
  first; the server's only job is making sure the second claim cannot
  overwrite the first, which it does with `update … where winner is
  null`. Verified against the live server with two simultaneous claims:
  both phones came back agreeing on the same winner.
- **Leaving is a move, not a disconnection** — back out of a friendly
  battle and it is handed to the other player rather than leaving them
  racing a board that has stopped. A phone that simply goes quiet for
  twenty seconds shows up as `theyDropped`.
- That is trusting the client, deliberately. A friendly battle is worth
  nothing by David's own design, so there is nothing to win by cheating
  except lying to your own family — and arbitrating four game modes
  server-side for a game with nothing at stake would be a great deal of
  machinery defending an empty room.

### New, on the server
`battle_invites` and `battles` tables, `player_profiles.last_seen`, and
`/api/battles` + `/api/battles/live`. Deployed and smoke-tested end to
end against production before any of the app was written: challenge a
stranger (refused), become friends, challenge, see it, accept, both
sides pulse and see each other's colours, both claim the win at once and
agree who won.

`hq/src/lib/playerAuth.ts` lifts the device-secret check out of the two
routes that each had a copy, at the point where the battle routes would
have made a third. Those two are left alone: they work, they are covered
by tests that read their source, and rewriting a working authentication
path to tidy it is a poor trade.

## v1.86.0 — 2026-09-11 · requested by David

"Make the gold dice shinier." And: "there's no ads in the game."

### Changed — the metals
- **Every side of the gold die catches the light now.** The real fault
  was not the brightness. Rendering all six sides side by side showed
  **four of them completely flat**: the highlight was positioned across
  the unwrapped net, so it landed on two faces and missed the rest. You
  only ever see three faces at once, so most of the time the gold die
  was a plain yellow cube — which is what David was looking at. The
  highlight is measured per FACE now, shifted a little on each, the way
  a real cube's faces sit at different angles to one light.
- **Shiny is a narrow highlight, not a bright one.** The old sweep
  peaked at 1.5 against a mask that clamps at 1.0, so a third of the
  face sat at exactly the ink colour: a wide flat stripe with no shape
  in it. The same light is spent differently now — a small hard core
  inside a broad soft glow, deeper shadow either side, and a warm bounce
  so the dark parts read as metal rather than paint.
- **The brush lines stopped aliasing.** They ran at 1.1 radians per
  pixel — the Nyquist limit — so they rendered as visible stair-steps
  rather than fine lines, and were the loudest thing on the face.
- **Silver got the identical fix, and that is scope David did not ask
  for.** Done anyway and said out loud: it is the same fault in the other
  half of a two-skin family, and a gleaming gold beside a flat silver
  reads as a mistake rather than a decision.
- `tests/textures.test.ts` exempts the two metals from the smooth-join
  rule, with the reason written down: a highlight is a reflection of the
  light source, and a reflection stops at an edge rather than carrying
  round it. **The exemption is earned** — each exempt skin must have a
  highlight on all six sides, which is the thing that costs it the
  smooth join. Verified by reverting the fix and watching that check
  fail.

### Added
- **`tools/die-preview`** — one command to write a skin's shelf picture,
  or all six of its sides, straight to a PNG. It paid for itself on its
  first run: the shelf thumbnail showed a perfectly good highlight while
  four of the real faces were flat, and no amount of looking at the
  thumbnail would have shown that.

### Ads — what was actually wrong, and what is now findable
Nothing here is a confirmed fix, because none of it can be reproduced
without the phone. What can be said:
- **The code is ON and the SDK is in the bundle** — checked by building
  it and grepping, not by reading. `grep -c RNGoogleMobileAds` on the
  export returns 4.
- **The comments said the opposite.** `adSdk.ts` announced "CURRENT
  STATE: OFF" and `ads.ts` described the OFF arrangement, months after
  ads were switched on. That is the first thing anybody would read when
  asking why there are no ads, and it answered wrongly and with
  certainty. Both corrected.
- **A failed start-up was permanent for the session, and now is not.**
  `initAds()` ran once, at launch, within a second of the app opening —
  before the phone necessarily has a usable connection. The consent
  fetch then fails, `canRequestAds` is false, and there are no ads until
  the app is killed and reopened at a luckier moment. It can be tried
  again now, and `showAdIfDue` asks for another go when an ad is
  genuinely due — a moment when there is demonstrably a player, a
  finished game and a working session.
- **Settings now says where it got to, in family tester mode.** Every
  failure in `ads.ts` is swallowed on purpose, which is right for a
  player and useless for finding this out, and there is no Mac here to
  read a device log with. Type FAMILY and Settings prints one line:
  which step stopped, how many games are counted, when the next ad is
  due, whether one is waiting, and whether it would be a test advert or
  a real one.

## v1.85.0 — 2026-09-11 · requested by David

"The game is very slow and laggy when you click to open an item to view
it." And: "when a dice lands too close to the wall and doesn't land flat,
it teleports down to be flat, but don't make it do that, just make it
count whatever's on top like what it used to do."

### Fixed
- **Opening a die to look at it no longer stalls.** Measured, not
  guessed: one die's six sides is **192ms on a desktop** and several
  times that on a phone, and all of it was painted in the frame the
  preview was trying to appear in. That is the exact cost v1.76.0 added
  when a die stopped being one picture six times and became six that join
  up — the equipped die was warmed then, and every other die was left to
  pay at the moment of the tap.
  - All fifty-three are now painted in the background, one die per tick,
    **after** the shelf pictures and after the two heavy pages are built.
    It is the biggest of the warm-up jobs (4.4s of desktop painting), and
    nobody can open a preview before the shelf it is opened from exists.
  - It stops when the app goes into a pocket, like every other warm-up
    here.
- **A die that lands leaning is left exactly where it lands.** There was
  a righting step at settle: anything below `flatEnough` was turned
  square and dropped flat before the result was shown. Watching a die you
  just threw jump to a new position is worse than reading it at an angle,
  because it looks like the game moved your dice — and it did.
  - **The result does not change.** `topFaceColor` reports the nearest-up
    face, which is the same face the snap used to turn upward. The colour
    counted is the colour on top, before and after. The only difference
    is that the die is no longer moved to make it obvious.

### What that costs, measured
With the righting gone, the test harness now reports the REAL resting
angles rather than the angles of dice the game had already straightened:
roughly **5% of dice come to rest more than 18° off flat, 1.5% more than
37°**, and — the one that matters — about **0.5% rest close enough to a
tie that the counted colour is not readable off the die at all**. The old
`worstMargin > 0.05` assertion failed on its first run at 0.0258, which
is how that number was found rather than assumed.

So the suite now measures the tie RATE and fails if it goes above 2%,
instead of promising something the game no longer does. Putting the
righting back — for genuine ties only, or at all — is one line in
`DiceScene.tsx`, and `snapDieToNearestFace` and `TUNING.settle.flatEnough`
are both kept for exactly that.

### Added
- `topFaceMargin` — how far the winning face beats the runner-up. Once a
  die is not straightened before it is read, "is it flat" stops being the
  useful question and "is it obvious which face won" starts.

## v1.84.0 — 2026-09-10 · requested by David

"When I send a friend request, it should update on my phone in the
friends tab immediately when the other person accepts it and so I don't
have to close the friends tab and reopen it." And: "the colorblind mode
icon should be a shape."

### Added
- **The friends list keeps itself up to date while it is open.** It was
  fetched once, on open, and nothing ever changed it again — so an
  accepted request appeared only if you left the screen and came back.
  - **Polling, not push, and that is a real limit rather than laziness.**
    The friends API is a handful of serverless functions on Vercel, so
    there is nothing holding a socket. Real push notifications need a
    native module, an Apple push certificate, a permission prompt this
    4+ game does not ask for, and a new build through Apple. Asking again
    every four seconds while somebody is actually looking at the screen
    is the honest version of the same thing.
  - **It stops when nobody is looking** — the panel closing or the phone
    going in a pocket both end it. That is the rule v1.69.0 set for every
    repeating timer in this game, and a friends list polling from inside
    a pocket is exactly what that release was about.
  - **It backs off when the server is not answering**, doubling to a
    minute, and one success puts it straight back to four seconds. A
    failed poll is silent: the list on screen is still the last true
    answer, and replacing it with an error because one background check
    missed would be a worse screen than a slightly stale one.
  - **An unchanged answer is left alone.** Replacing the list object
    re-renders every row and every dice swatch on it; doing that every
    four seconds is a visible flicker on a long list.
  - **A poll cannot overtake a refresh.** Both write the same state, so
    a poll that started first and answered second would put the older
    list back on screen — long enough to watch a friend you just accepted
    turn back into a request.

### Changed
- **The colourblind icon is a circle and a triangle.** It was two colour
  discs, which drew the PROBLEM. The setting changes no colour at all —
  the palette is already CIEDE2000-checked and separated by lightness —
  it stamps a shape on each one, and the shapes are the answer. The two
  drawn are the ones the mode really gives those colours (red → circle,
  green → triangle, straight from `COLOR_SYMBOLS`), so the icon is a true
  sample of what it switches on. A test fails if that mapping changes and
  the icon does not.

## v1.83.0 — 2026-09-10 · requested by David

"On the Home Screen where it says 'next unlock: x at y trophies' it has
an emoji to represent the item but it should be the drawn icons instead."

### Changed
- **The "Next unlock" line shows the item itself.** Not a drawn icon
  standing for it — the actual painted die, or the battlefield's own
  picture, the same one the Store and the Inventory show. A cherry for
  Ruby Dice was the last place in the game where a picture of fruit stood
  in for a thing the player can see two taps away.
  - It appears twice, on the home screen and after a victory. Both.
- **`TierIcon` moved out of `LeaderboardScreen.tsx` into its own file.**
  Marc asked for exactly this on the ladder on 27 Aug and it was written
  inside that screen. Copying it into the home screen would have been two
  pictures of the same rung in two files, and two copies drift — then the
  ladder and the home screen disagree about what Ruby Dice looks like.
- **Courtyard Treasure gets a drawn gold coin.** It is the one rung that
  hands over no item of its own — it adds the pile of gold to the Castle
  Courtyard — so it kept its emoji for want of anything better. The pile
  is made of coins and the game already draws one.

### Another test that stopped testing
`tests/screen.test.ts` matched `<Text style={styles.trophyNext}` with a
literal space. Wrapping that tag over several lines, as adding a picture
beside it did, meant it matched nothing at all — and "no matches" was
being read as "not used anywhere", which is how it failed. It reads
`\s+` now. The file already carried a comment about a formatting change
failing a behaviour test; this is the same fault, on the same line, from
the other direction.

### Still emoji, and not touched
The unlock popup ("UNLOCKED: 🍒 Ruby Dice!"), the tournament cards and
the matchmaking overlay all still use them. They are a bigger job than
this one — those build a string rather than a row — so they are named
here rather than quietly swept in.

## v1.82.0 — 2026-09-10 · requested by David

"When I went to add another person as a friend with their friend code, it
showed their name as 'New Player' when it should show their Game Center
username probably. And when I clicked 'ask to be friends' it said 'that
did not go through' and 'no such player'."

Both halves are the same bug, and the chain is worth writing down.

### The fault
The player id used to become Apple's the moment Game Center answered
(`apple?.playerId ?? localId`), on the reasoning that somebody who
signed in later should "become their real self". The friend code
deliberately does NOT move — it belongs to the device, because a code a
child has written down cannot change — and on the server `friend_code`
is a UNIQUE index.

So the first launch where Game Center won the race, publishing the
profile tried to INSERT a second row carrying a friend code the first row
already held. The unique index refused it, the player now had no profile
under the id they were using, and every friends call answered "no such
player" — truthfully, uselessly, and blaming the wrong step. Confirmed
against the live table: both profiles on it are `local-` ids named
"New Player", and `player_profiles_friend_code_key` is the index that
would have refused the second write.

It bought nothing, either. Keying on the Apple id was meant to make a
profile portable between phones. It could not: the server authenticates
with a secret kept on the device, so the same Apple account on a second
phone is refused as "wrong secret" whatever the id says. A promise that
never worked, in exchange for a breakage that always would.

### Fixed
- **The player id is the device's, for ever.** Game Center supplies the
  NAME and nothing else. Signing in or out changes what a friend sees
  you called, and nothing else at all.
- **A late name is picked up.** Game Center's sign-in is not instant, so
  a cold start could settle on "New Player" and then PUBLISH it, where it
  sat on everybody else's friends list. `refreshName()` asks again, and
  the Friends screen calls it before publishing.
- **A failed publish is the error now.** `pushProfile` returned a bare
  boolean and the caller ignored even that, so a failure fell straight
  through to a friend-list request for a profile that had never been
  created. It returns the reason, and the screen stops there and says it.
- **A taken friend code is redrawn rather than reported.** The server has
  always named that one collision specifically so the game could draw a
  new code; nothing ever did. Now it does, and republishes. Losing a code
  you wrote down is bad; having no profile at all is worse.
- **The Friends screen holds its own copy of your identity**, so a name
  that arrives late or a code that had to be redrawn is what the card
  shows — not a stale prop.
- **The friend-code note stops claiming something untrue.** It said the
  code "goes with your Game Center account". It never did.

### Healing
No server change and no migration. A phone stranded under an Apple id
drops back to its local id on the next launch, where its profile — and
its friendships — have been waiting all along.

### Still true, and worth knowing
A friend's name on your screen is the one THEY last published, so
somebody who has never opened their own Friends tab since signing in will
still read "New Player" until they do. The profile is pushed when Friends
is opened and not on every launch, which is a deliberate trade against
making a network call for every player who never uses the feature.

## v1.81.0 — 2026-09-10 · requested by David

Four things at once: "make the volume icons and colorblind mode icon
drawn images in the same style as everything else, rather than emojis",
the same for the News tab, "get rid of the 'coins come from…' line in the
store", and "when you click on an item in the store or inventory, for a
second it just shows the main color of the arena you have selected or are
viewing".

### Changed
- **The volume controls and the colourblind setting are drawn.** They
  were 🔇 🔈 🔉 🔊 and 🔷 — five glyphs from the phone's emoji font
  pretending to be part of a set. `volumeIcon` is now `volumeLevel`,
  returning how many waves the drawn speaker should have, and there is a
  `SpeakerIcon` and a `ColorsIcon` in the icon set.
  - Not only taste: the four speaker emoji are different WIDTHS from each
    other on iOS, so the label beside the slider shifted sideways as you
    dragged it. The drawn one is a fixed box at every level.
  - The colourblind icon is two overlapping discs in the game's own red
    and green — the pair the setting exists to separate — read from
    `PRISONER_COLORS` rather than copied.
- **The News tab is drawn too, by KIND rather than by post.** Fifty-five
  posts carried forty-eight different emoji between them, which is not a
  set. Drawing forty-eight would have been the wrong answer: what the
  list needs is to say what kind of change a post is about. A post now
  picks one of twelve kinds and `src/ui/newsIcons.tsx` decides what it
  looks like — so the picture beside a post about the Store is the same
  bag that is on the Store button.
  - Six new drawings: a speaker, two colour discs, a stopwatch, a
    sticking plaster, a paintbrush, a phone and a little landscape. The
    other six kinds reuse icons the game already had.
  - Posts fetched from the board may carry no kind at all, or one this
    version has never heard of. `newsIconId` turns anything into a real
    drawing, and `isNewsItem` no longer requires the field — losing a
    post over its picture would be far worse than showing a plain one.
- **The "coins come from playing" paragraph is out of the Store.** Three
  blocks of text above the shelf pushed the dice off the bottom of the
  screen. One more row is visible now.

### Fixed
- **Tapping an item no longer flashes a slab of the arena's colour.**
  That colour was ours: the cover added on 26 Aug to hide the canvas's
  stale last frame is painted in the arena's own sky colour, on the
  reasoning that the arena then fades out into that place. It does, when
  you are already standing in the arena. Coming from a shelf full of
  white cards it is a blank coloured screen. The shelf now stays up for
  the two frames the board needs, so there is no transition to see at
  all. The sky cover stays for the paths that have no shelf behind them.

### A test that had quietly stopped testing anything
`drawingOf(icon, null)` in `tests/icons.test.ts` meant "this icon is last
in the file" and sliced to the end of it. Adding six icons after
ChevronIcon made that slice swallow their drawings, and the rule that
controls stay ink started failing against icons it was never about. It
now means "up to the next export, whatever it is", which is what every
caller wanted.

## v1.80.0 — 2026-09-10 · requested by David

"Now when you click on the store and inventory tabs, it shows the Home
Screen for a split second before loading in."

A fault introduced by v1.75.0, and worth stating plainly rather than
tidying away.

### Fixed
- **No more flash of the board on the way into Store or Inventory.**
  Keeping those pages alive between visits meant their existence was
  decided by a `useState`, and that state was set from a `useEffect` —
  which runs AFTER the render it belongs to has been painted. So the
  first tap painted one frame in which the tab had changed and the page
  did not exist yet: the board showing through the hole where the Store
  should be, then the page arriving on the next frame. Exactly one frame,
  exactly as described.
  - The page is now asked for during render — "draw it if it is the
    current tab, or if it has been built before" — so it is in the very
    first frame that knows about the tap. The effect stays, because it is
    what keeps the page alive after you leave, which is what made the
    second visit free in the first place.
- **And no pause in its place.** Removing the empty frame on its own
  would have swapped a flash for a stutter: mounting seventy cards is not
  free even when every picture is already painted. Both pages are now
  built the moment the background painting finishes, so the first tap has
  nothing left to do but reveal them.
  - Order matters and is now enforced by a test. Mounting either page
    asks for all 53 pictures in a single commit, so building them BEFORE
    the queue drains would have moved the 846ms stall rather than removed
    it. `warmDicePreviews` gained an `onDone` that fires once, only after
    the last picture is cached, and never when the warming was stopped
    partway by the app going into a pocket.

### A test that passed against broken code
The first version of the regression test grepped `DiceDemoScreen.tsx`
for `menuTab === id` — and passed with the fix deleted, because the
comment explaining the fix contained that phrase. It now reads the file
with comments stripped, and was checked by removing the fix and watching
it fail. Any test in this suite that greps source has the same trap in
it; this one at least no longer does.

## v1.79.0 — 2026-09-10 · requested by David

"I don't know what you are asking me — can you do all this?"

The Mac-and-Xcode instructions in v1.78.0 were a set of chores handed
back rather than an answer. This does the looking here instead, with no
Mac involved, and the first thing it found was a real fault.

### Added
- **`tools/duo-preview`** — renders the real menu screens and the real
  bottom navigation through `react-native-web` at the Duo's exact point
  sizes, and writes a PNG of each. The browser viewport IS the phone, so
  `useWindowDimensions` reports 474x696 or 640x904 and the page is laid
  out as a Duo rather than scaled to look like one. `Platform.OS` is
  forced to `ios` at the module boundary, because react-native-web
  honestly answers `web` and would send the inset down the 12pt Android
  branch instead of the 34pt iPhone one — a preview drawing the tab row
  22pt low is worse than none.

### Fixed
- **The card grids use the width they are given.** Every grid in
  Inventory and the Store was `width: '31%'`, which is three columns at
  any size. Three is a fact about a 390pt phone, not about the game: at
  640pt across it made a 190pt card with a 58pt thumbnail adrift in the
  middle, and showed twelve items where twenty fit. The column count now
  follows the screen (`src/demo/gridRules.ts`), aiming at a 160pt card.
  - **Nothing changes on any iPhone.** 320pt through 440pt all still get
    exactly three columns, and a 393pt screen moves from a 112pt card to
    a 113pt one. A test asserts that for every one of those widths, so
    the change cannot quietly reach the hardware the family holds.
  - The unfolded Duo gets four columns at 144pt. An iPad — which has had
    this problem since the day `supportsTablet` was switched on, and
    which nobody had looked at — gets five at 190pt.
  - Card widths are POINTS now, not a percentage. A percentage cannot
    know about the 10pt gaps between cards, which is why the old number
    was a hand-tuned 31% rather than 33%; a test walks every width from
    320pt to 1366pt and checks a row plus its gaps still fits.

### Worth writing down
This is the fault that reasoning does not find. `width: '31%'` was not a
bug, a typo, or a shortcut — it did exactly what it said, correctly, on
every screen that existed when it was written. It only became wrong when
the hardware changed, and the only way to notice was to look at a
picture. v1.72.0 said as much and had no way to act on it. Now there is
one.

## v1.78.0 — 2026-09-10 · requested by David

"This session is now on a Mac with Xcode — how can we load the app in
there and see how it will look on the iPhone Duo screen?"

Nothing here changes the game for a player. It is the missing half of
v1.72.0, which adapted the layout to Apple's folding phone entirely by
reasoning and said so plainly: *"there is no folding phone in CI and no
renderer in this suite... whether it LOOKS right has to be seen."* A Mac
with Xcode is the first chance to actually look.

### Added
- **A screen ruler, mounted only when `__DEV__` is true**
  (`src/debug/ScreenRuler.tsx`). It prints the live window size in
  points, names the shape when it recognises one, and shows the bottom
  inset the game has worked out for it. Dragging a resizable simulator to
  the Duo's exact 474x696pt stops being guesswork: you drag until the
  corner reads "iPhone Duo (folded)".
  - `__DEV__` is false in every release bundle and every over-the-air
    update, so it can never appear for a player. A test reads `App.tsx`
    and fails if that guard is ever removed.
  - It reads `useWindowDimensions()`, never `Dimensions.get()` — a ruler
    frozen at launch would report the old size all the way through a
    fold, which is precisely the bug `safeArea.ts` had to unlearn.
- **`tools/duo-sim/run.sh`** — one command on a Mac. It finds a folding
  simulator if this Xcode has shipped one, falls back to the resizable
  iPhone if not, creates and boots it, and prints the exact
  `npx expo run:ios --device ...` line plus what to look at once the game
  is up. It touches nothing in the repo and nothing in Xcode.

### Still open, and still David's call
`app.json` keeps `orientation: "portrait"` and
`ios.requireFullScreen: true`. Both were deliberately left alone in
v1.72.0 and are left alone again here, because both are decisions about
what the game should be on a folding phone rather than bugs to fix — and
now there is a way to see each one before deciding.

## v1.77.0 — 2026-09-10 · requested by David

"Have the friends tab be a pop up like the settings and news."

### Changed
- **Friends is a Popup**, not a full page. Settings and News stopped
  being pages for a reason worth repeating: as panels they read as
  things you glance at and dismiss, and the game stays visible behind
  them so it is obvious you have not gone anywhere. Friends is the same
  kind of thing.
- **Its own back button is gone from the list.** That existed because
  the tab bar was drawn over the page and would swallow a tap near the
  bottom, so the exit had to be at the top. A popup is drawn above the
  bar and dims it, and already guarantees two ways out — the ✕ and a tap
  on the dim — so a third was clutter.
- **A friend's page keeps its "‹ Friends"**, because that one is not a
  way out of Friends: it is the way back to the list, while the ✕ leaves
  altogether. The panel title becomes the friend's name so it is obvious
  whose page it is.

### The bug this would have shipped with
`Confirm` fills its PARENT, not the screen, and `Popup`'s panel clips
with `overflow: hidden`. Wrapping Friends in a popup from the outside
would have squeezed "Remove this friend?" and "Block this person?" into
the panel and cut them off instead of covering the screen. That is why
the popup is built INSIDE `FriendsScreen` rather than around it by the
caller — it lets the ask dialogs be siblings of the panel. There is now
a test that reads the file and fails if any `{overlays}` ever ends up
between a `<Popup>` and its close; verified by moving them inside and
watching it fail.

### Also
- A `KeyboardAvoidingView` around the panel's scroll. The friend-code
  box sits partway down it, and without this the keyboard covered the
  very thing being typed into — the same fault the Settings code box had,
  fixed the same way.

## v1.76.0 — 2026-09-10 · requested by David

"Make all the dice have unique sides that make the entire dice a
continuous pattern rather than the same image on every side."

### Changed
- **A die is six materials now, not one.** A single 64x64 texture was
  handed to the whole box, so every side showed the identical picture and
  a zebra die read as a cube with wallpaper on it. Each side now takes
  its own square of one continuous design, laid out as the paper cube
  every child cuts out — up above front, left/front/right/back round the
  middle — so the pattern runs over the edges instead of restarting at
  every corner. Rendered the nets and looked at them: the zebra stripes
  and the marble veins flow straight through.

### What the measuring corrected
The obvious test is "all six sides must differ", and it is **wrong**.
Nine skins (zebra, marble, bee, fish, tiger, candycane, chocolate,
waffles, tartan) repeat exactly every 64 pixels, so the square to the
right of the front IS the front. For those, identical sides are what a
perfectly continuous die looks like — forcing them to differ would break
the continuity this was for. 44 skins get six different sides; 9 tile and
do not need to.

The seam check needed the same correction. Measured as a raw pixel jump,
galaxy looked catastrophic at 221 — but galaxy is a star field, where any
two neighbouring columns differ hugely. Compared against each skin's own
within-face variation, almost everything sits at 1.0–1.4x. Only tartan
(6.7x) and volleyball (6.2x) stand out, and both are skins whose sides
are identical anyway, so their joins are exactly what they always were.

A cube cannot be unwrapped flat without cutting some edges, so perfect
continuity everywhere is not available. Every join lands on a physical
edge of the die, where the surface turns ninety degrees — the least
visible place a seam can be, and the same reason this texture has always
been clamped rather than wrapped.

### Speed, because this costs six times the painting
- The six sides go through the **app-wide texture cache**, not DieMesh's
  `useMemo` — that only lasts as long as one component, and the dice
  remount whenever the scene rebuilds, so the cost would have landed
  again on every roll.
- The equipped die is **painted during the same idle warm-up** added in
  v1.75.0, so its 157ms does not land in the middle of somebody's first
  roll. Only the equipped skin: warming all 53 would be six times the
  work for 52 dice nobody is about to throw.
- The shelf pictures still paint **one** square, so the Store and the
  Inventory keep the speed they gained in v1.75.0. A test fails if
  `preview.ts` ever reaches for the whole net.

## v1.75.0 — 2026-09-10 · requested by David

"Are you able to make the items tab and store tab open faster... about
2-3 seconds at first and then about 1 second every time after."

Measured before touching anything: painting all 53 dice previews takes
**846ms on a desktop**, and a phone is several times slower — so 2-3
seconds is exactly right. Encoding the PNGs is nearly free by comparison;
it is the per-pixel painting that costs.

### Fixed
- **The 2-3 seconds on first open.** React Native has no canvas, so each
  dice picture is painted pixel by pixel in JavaScript, and the Store and
  the Inventory are plain ScrollViews — every one of the ~70 cards mounts
  at once and asks for its picture in the same frame the tab is trying to
  appear in. Nothing was wrong with the cache; the second open was
  already free. The cost is now MOVED rather than shrunk: the pictures
  are painted one at a time in the background once the game is idle, so
  the tab opens at the speed it always had on the second try. Measured
  after warming: **0ms**. Nothing about how they look changes.
- **The ~1 second on every open after that.** That part was not painting
  at all — it was rebuilding about seventy cards from scratch each time
  the tab was opened. The two heavy screens are now built once and hidden
  with `display: 'none'` (out of layout as well as out of sight) rather
  than thrown away.

### Deliberately not done
- Painting at launch. Launch is when a player wants their first battle,
  and a second of blocked JavaScript there is worse than a second in a
  menu they may never open. The warming waits for the game to settle.
- One skin per background tick, not several. A single die is already a
  whole frame's worth of work; painting two to "get it over with" would
  drop one and make the warming visible, which defeats the point.
- The warming stops while the app is backgrounded — nothing to be warm
  for, and it is the same thread the battery work quietened — and can
  start again on return.

### Added
- `src/dice/warmPreviews.ts` and `tests/warmup.test.ts`, including a test
  that measures the tab-open cost after warming rather than trusting it.

## v1.74.0 — 2026-09-10 · requested by David

Three small things, one of which turned out to be a trap.

### Changed
- **Friends took How to play's slot** in the top-right corner of the home
  screen, and **How to play moved into Settings**. The swap is the right
  way round: How to play opens itself on a first launch and most people
  never need it again, so it was holding a permanent button for a
  one-off, while Friends is somewhere you go back to and was two taps
  deep behind the Ranks tab. Friends is no longer a button on Ranks —
  it moved rather than being duplicated.
- **The dash types itself** into the friend-code box after the first four
  characters. The code is printed with a dash everywhere else in the
  game, so a box without one looked like the wrong box.

### The trap, caught by an existing test
Friends was closed by `if (menuTab !== 'leaderboard') setShowFriends(false)`,
which was correct while the only door in was a button on the Ranks page.
The home screen has no menu tab at all, so with Friends moved to the
corner that rule would have opened the page and shut it in the same
breath — one tap, nothing happens, no way to tell why. It now compares
against the PREVIOUS tab: standing still keeps Friends open, navigating
away closes it, so the tab highlight and the screen still cannot
disagree. Its back button says "‹ Back" rather than "‹ Ranks", since it
can now be opened from anywhere.

### Why the dash waits for the fifth character
Adding a trailing dash the moment the fourth lands breaks the delete key:
the field reads `K7M2-`, the delete removes the dash, and the formatter
puts it straight back — the caret sticks and the only way out is to clear
the whole box. Grouping only BETWEEN characters means every delete
removes something. Same rule a card-number field follows, for the same
reason, and there is a test that fails on the naive version.

### Added
- `typedFriendCode()` in `friendCodes.ts`, and six tests covering the
  dash, backspace, paste, the eight-character cap, and confusable letters
  (O→0, I→1) being fixed as they are typed rather than silently at lookup
  time — so what the box shows is always what gets searched for.
- `FriendsIcon` in `Icon.tsx`, drawn rather than an emoji like every
  other icon here.

## v1.73.0 — 2026-09-09 · requested by David

Three things: a trophy floor for bot-only games, a fifteen-second search
before falling back to a bot, and the golf ball redrawn.

### Added
- **Every game below 100 trophies is against a bot**, with no search at
  all — a beginner presses Start and is in a battle. The floor is about
  the first hour: losing your first games to somebody who already owns
  the ladder is how a player stops playing, and 100 is where the first
  trophy reward already sits.
- **A fifteen-second search above the floor**, counting up, with the bar
  filling once over the wait and a fallback to a rival when it expires.
  The reveal has its own clock, started when the pairing settles, so a
  long search cannot eat the "here is who you are playing" beat.
- `src/game/matchSearch.ts` (the rule), `src/game/onlineMatch.ts` (the
  switch), and `tests/matchSearch.test.ts`. The floor and the no-service
  honesty were both verified by breaking them and watching the right
  test fail.

### The part that has to be said plainly
**There is no online play in this game, so there is nobody for the
search to find.** No matchmaking server, no shared round; the opponent's
rolls come from a timer in `ai.ts`. `matchmaking.ts` has said so in its
own header since it was written, and deliberately never used the words
"searching for players online" because that is a promise the game cannot
keep to an audience that includes five-year-olds.

So the rule is written in full and tested, and the one step it cannot
take is behind the same kind of switch the adverts and purchases use.
**While it is off nobody waits fifteen seconds for an answer that was
never coming** — the lookup returns "there is nowhere to ask" on its
first call and the round begins as it always has. A made-up wait ending
in a made-up disappointment would be worse than not building it.

`onlineMatch.ts` writes down what turning it on actually needs: a queue
two players can be paired out of (small — the Supabase project already
holds profiles), a shared round both phones agree on including what
happens when one walks into a lift (large), and a rethink of what the
opponent's rolls are when they arrive over a network instead of from a
timer. Unlike the adverts, this is a feature, not a flag.

### Fixed
- **The golf ball looks like a golf ball.** The navy diagonal band is
  gone — rendered, it was a hard-aliased slash across every face rather
  than a stripe on a ball, and its justification (that a plain white cube
  would be mistaken for the baseball) never held, since the baseball is
  cream with bold red stitching. The dimples now carry it alone: shaded
  from the real normal of a shallow bowl, held to unit length by building
  it from an angle, on a shell dropped off pure white so the lit wall of
  each pit has somewhere brighter to go. Three earlier approaches are
  recorded in the file with what each got wrong.

## v1.72.0 — 2026-09-09 · requested by David

Apple announced the iPhone Duo, a book-style folding iPhone, this
morning. David asked what it would take for the game to show well on it.
Two assumptions in this codebase expired that morning, and both were
written down in comments as though they were permanent.

### Fixed
- **A folded screen was mistaken for a phone with a home button.**
  `safeAreaRules.ts` decided on height: "every iPhone with a home
  indicator is at least 812pt tall... nothing lives in the gap". The
  Duo's folded screen is reported at 1422×2088px, which at @3x is
  474×696pt — shorter than the 736pt iPhone 8 Plus, and with no home
  button, because no iPhone has had one since 2022. The rule would have
  returned an inset of **zero** and drawn the navigation labels into the
  strip the system takes the swipe from: exactly the fault that file was
  written to fix, reappearing because its premise quietly expired.
  Home-button iPhones are now named exactly — a closed set of four that
  will never grow — matched on **both** sides so a folded screen that
  happens to be 667pt tall is not mistaken for an SE, and everything
  else is assumed to have an indicator. Unknown hardware now fails in
  the safe direction by design rather than by luck.
- **The screen was measured once, at launch.** `safeArea.ts` said so:
  "Read once: the game is portrait-locked and the home indicator does
  not come and go." Unfolding swaps a 474×696pt screen for a 640×904pt
  one without relaunching the app, so every constant derived from it —
  the bar's height, its padding, and the page area six screens use —
  kept the old answer for ever. All of it is now measured during render.
  **This was already wrong on iPad Split View and Stage Manager**; the
  fold only makes it impossible to miss.

### Not changed, because it needs no changing
The 3D board already adapts: `CameraRig` re-fits the camera on every
canvas resize, and `fitCamera` frames the whole battlefield at all four
new shapes — folded (0.681), unfolded portrait (0.708), unfolded
landscape (1.413) and half an unfolded screen (0.354). There is now a
test saying so rather than an assumption.

### Added
- `tests/foldable.test.ts` — the inset rule at both fold states, the
  four real home-button iPhones still getting nothing, unknown shapes
  erring towards keeping the inset, no layout value derived at import
  time, and the camera framing every fold state. Verified by restoring
  the old height rule and watching three of them fail.

### Not measured
There is no folding phone in CI and no renderer in this suite, and the
dimensions above are day-one press figures that may be wrong in detail.
What is pinned is the reasoning. Whether it LOOKS right has to be seen
on the hardware.

### Still open, and David's call
`app.json` sets `orientation: "portrait"` and
`ios.requireFullScreen: true`. Neither is obviously right on a screen
that unfolds into something close to square, and both change what iOS is
allowed to do with the window. Left exactly as they are rather than
guessed at.

## v1.71.0 — 2026-09-07 · requested by David

David went looking for the music credits in Settings, where this project's
notes say they are, and could not find them.

### Fixed
- **The Creative Commons credits are now findable, not merely present.**
  They were the last two lines of a long scroll — 11pt, the faintest ink
  in the theme, centred, and sitting directly above the 11pt faint centred
  version stamp. Three near-identical whispers in a row with nothing
  saying which was which. They now have a divider and a `SOUNDS & MUSIC`
  heading like every other section of that panel, are left-aligned at
  12.5pt in the same ink as the rest of the text, and read as credits
  rather than as part of the version number.
- Kenney is credited too — the dice recordings, the fanfare and the
  announcer are all his. CC0, so it is a courtesy rather than a
  condition, but he is the single largest contributor of sound in the
  game and was the only one unnamed.

### Added
- Two tests in `tests/audio.test.ts` that read `assets/sounds/CREDITS.md`
  for the rows marked **attribution required** and check each named
  person appears on the Settings screen — so adding a CC-BY sound and
  forgetting to credit it fails rather than shipping. A third refuses to
  let the credits go back to being centred, faint, or under 12pt.

### Why this mattered more than it looks
CC-BY is a condition of the licence, not a courtesy: without the names
somewhere a player can reach, the game has no licence to the music. It
was arguably satisfied before. But the person who commissioned the
credits, who knew they existed and had been told where to look, could
not find them — which is the strongest possible evidence that nobody
else would either.

## v1.70.0 — 2026-09-07 · requested by David

Two decisions off the launch list: number 6, one word per place, and
number 9, option B — signing in should get your profile back after a
reinstall.

### Fixed
- **Deleting the game no longer loses your friends.** iOS deletes an
  app's own folder along with the app, and the device secret lived in
  it. That secret is the only thing proving to the server that a phone
  owns a profile, so after a reinstall every write came back "wrong
  secret" — permanently, with no way back. The friend code on the card
  in a child's pocket was dead. The secret is now kept in the keychain
  as well, which the delete does not reach, so a reinstall finds the
  profile it had. The game says "Welcome back" once when that happens,
  because otherwise eight letters look exactly like eight new ones.
- **The dead end, when there is one, is now a sentence rather than a
  raw server error.** Apple does not promise keychain survival, so the
  recovery can miss. When it does the screen explains it and drops the
  "Try again" button, which could never have fixed that one.

### Changed
- **One word per place.** The tab said "Items", the page it opened said
  "Inventory", and a hint called it "your bag"; the tab said "Ranks" and
  its page said "Leaderboard". David picked Inventory and Ranks, and
  both now match end to end.
- "Inventory" is the longest label the bottom bar has ever carried — at
  the largest text setting it is about 72pt of a 75pt cell — so the nav
  labels now shrink slightly before they truncate, rather than two tabs
  running together.

### Added
- `src/game/deviceVault.ts`, the only file allowed to touch the
  keychain, in the same shape as `ads.ts` and `gameCenter.ts`: required
  lazily, and nothing in it can throw.
- `tests/reinstall.test.ts` — the recovery, the upgrade path for phones
  that already have a profile, the keychain that keeps nothing, and the
  rule that a friend code without its secret is not a recovery.
- The native-package gate in `tests/ads.test.ts` now FINDS native
  packages instead of reading a hand-written list. It had gone stale the
  moment expo-secure-store was added, which is precisely the failure it
  exists to catch; it now reads node_modules and checks it found at
  least everything the old list named.

### Why Game Center does not do the verifying
Decision 9B said "let signing in to Game Center reclaim the old
profile". The airtight version of that is Apple's identity signature,
which the server can check against Apple's public key —
`expo-game-center@1.0.1` does not expose it. Without it the server
cannot tell a returning player from anyone who has typed their id, and
ids are handed out by the friend-code lookup, so a server-side "reclaim
by id" would give a child's profile to anybody holding the code they had
shared. The keychain gets the same outcome and needs no such trust: the
phone still has the secret it always had. It also covers players who are
not signed into Game Center at all.

### runtimeVersion stays at 2.0.0
expo-secure-store is new native code, which normally means raising it.
Checked against EAS rather than assumed: every FINISHED iOS build
reports `exposdk:54.0.0`, and the only build at 2.0.0 is the one that
errored today. Nothing is installed on 2.0.0, so the pin already
excludes every phone a raise would exclude — and raising would orphan
v1.69.0 for nothing. It moves when a build finally exists.

## v1.69.0 — 2026-09-07 · requested by David

David asked to make sure the game does not kill the battery on people's
phones. It was killing it, in three separate ways.

### Fixed
- **The board no longer draws when there is nothing to see.** The 3D
  scene ran flat out — sixty frames a second, the most expensive thing
  the app can do to a phone — behind every menu, on every screen, for as
  long as the game was open. It now runs during a roll, a prisoner's
  leap and the moments after one settles, and stops the rest of the
  time. A tap restarts it in the same frame it is handled, because the
  throw itself tells the loop to wake.
- **Both split-screen boards, which was twice the cost.** Two canvases
  are on screen at once there, and both ran continuously — including
  behind the solid card that asks you to lay the phone on the table.
- **Nothing renders while the phone is in your pocket.** iOS suspends
  the 3D surface on its own, but not everything else, and Android is
  looser about both.
- **The opponent kept rolling while your phone was locked.** This one
  was a real bug rather than only waste: JavaScript timers keep firing
  through a lock screen, so the computer went on rolling — with haptics
  and sound — through a battle nobody was in. A player could come back
  to a game they had lost without playing it.

### Added
- `tests/power.test.ts`, which pins the reasoning rather than the
  saving: every path that starts motion wakes the loop, the awake window
  outlasts the animation it covers, the one screen that waits on real
  frames is never the one that stops, nothing holds the screen awake,
  audio does not run in the background, and nothing polls the network on
  a timer. Both fixes were checked by breaking them again and watching
  the tests fail.

### Not measured
There is no phone in CI. These tests prove the rules hold; the actual
saving has to be seen on a device.

## v1.68.0 — 2026-09-07 · requested by David

David asked for every payment option in the first public release. This
is the machinery for all of it, and it is deliberately switched OFF —
the same two-state switch the adverts use, for the same reason.

### Added
- **The whole purchase system**: a catalogue of what is sold, a purchase
  and restore layer that can never throw or block, entitlements
  remembered on the device, and a real shelf in the Store.
- **On sale once it is switched on**: No more adverts ($3.99), and coin
  packs at $0.99 / $4.99 / $9.99 for 500 / 3,000 / 7,000 coins. Sized
  against the real economy — the whole shop is 46,695 coins, so even the
  biggest pack is about a seventh of it and playing stays the way things
  are got.
- **Buying adverts away actually works everywhere**: the advert SDK is
  never started, no advert is ever fetched, and none is ever shown.
- **"Bought before? Put it back"**, which Apple requires of any app
  selling one-off unlocks, and which is what a new phone needs.
- **Every purchase asks in the game's own words first**, with the price
  in it, before Apple's payment sheet — so a stray tap cannot reach a
  payment sheet at all.
- **The fairness promise is printed on the shelf**: nothing sold changes
  how the dice land. A test proves it of everything on sale.

### Parked, with the reason written down
Five products the family chose are in the catalogue and switched off,
because each needs something that does not exist:
- The starter pack needs the Supporter die drawn.
- Money-only dice and battlefields need exclusive ones made — every one
  in the game today can be earned.
- Dice Club is a monthly charge, and Apple requires continuing value for
  those. That is a promise to ship new content every month, for as long
  as anybody subscribes, and it is David's to make deliberately.
- The season pass needs an XP and levels system, which is a piece of
  game design rather than a product id.

### Not yet switched on
`expo-iap` is not installed and not named in any live file, so this
ships safely to every phone and the Store says "not on this phone yet"
rather than showing buttons that cannot work. Turning it on needs the
library installed, the require restored, `runtimeVersion` raised again,
a build — and every product id created in App Store Connect first.


## v1.67.0 — 2026-09-07 · requested by David

**Adverts are on.** David asked for advertising in the first public
release. This is the change that does it, and it is the first one in
this project that needs a new build before anybody can receive it.

### Added
- **One full-screen advert after every third finished game**, and
  nothing else — never during a battle, never a banner, never a video.
  Every request is marked child-directed and non-personalised and capped
  at a G rating, which is what makes the App Store privacy answers true.
  The advert waits for the moment you leave a result screen, so it can
  never cover a trophy or an unlock you just earned, and the next battle
  now waits behind it rather than starting underneath.

### Native — this needs the new build
- `runtimeVersion` is pinned to **2.0.0**, in the same change as the SDK
  going into the bundle, because that pairing is the only thing that
  stops old installs being handed JavaScript they cannot run.
  **Builds 5 and 6 will stop receiving over-the-air updates**: they
  report `exposdk:54.0.0`, contain no advert SDK, and correctly stay on
  v1.66.1 until the new build is installed. That is the pin working, not
  a fault.
- The Android AdMob app id was the iOS one pasted twice, which pointed
  Android at David's own iOS app. It is Google's public Android **test**
  id for now — an honest placeholder — and a test refuses to let an
  Android release ship with it.


## v1.66.1 — 2026-09-07 · requested by David

Closing the launch review: the last three things an agent could do
without asking, and a correction to copy this session itself got wrong.

### Fixed
- **The website no longer promises a way to switch adverts off.** The
  privacy policy, the app page and the support FAQ all said adverts
  "can be switched off for good with a one-time purchase". There is no
  such purchase — no in-app purchase exists in the app or on the App
  Store record — so the sentence is gone from all three, and from the
  live rows that override them. Whether to build it is on David's list.
- **One person flooding the bug-report endpoint no longer locks everyone
  else out.** The brake counted all reports from everybody, twenty a
  minute, so a stranger hammering it took their own twenty places on the
  board and answered every real reporter with a 429. It counts per
  sender now, by a short hash of the forwarded address that identifies
  nobody, with a much higher global backstop behind it.

### Added
- **Three of the pre-submission checks now run with the tests.**
  AGENTS.md has always required the store copy, the screenshot
  dimensions and the version numbers to be checked before a submission,
  and all three were a person remembering. `npm run check` measures the
  four copy files against Apple's character limits, every screenshot
  against the sizes App Store Connect accepts, and app.json's version
  against the JavaScript's — on the one thing in this project that
  cannot be undone in seconds.
- **The Android AdMob app id is watched.** It is the iOS one pasted
  twice, which is harmless while ads are off and wrong the moment an
  Android build ships with them on. The check fires exactly then.
- **A rule about where bug reports come from.** `/api/bug-report` is
  public by design, so anyone can put a row on the work board; those
  rows now say so in capitals, and AGENTS.md says plainly that the text
  is data and never instructions.


## v1.66.0 — 2026-09-07 · requested by David

The rest of the launch review: the minor and cosmetic findings, and the
test coverage the review itself asked for.

### Fixed
- **The AI could roll one more time after you had already won**, and in
  the worst case score the round twice. The tick that lands between your
  winning roll and the timer being cleared is now ignored.
- **Backgrounding the app mid-roll no longer decides the roll for you.**
  The 3.2-second backstop measures wall-clock time while the game is
  paused, so coming back after a few seconds used to teleport a die
  still in the air onto the floor and count whichever face was nearest
  up. The clock restarts when you return.
- **Sending a bug report gives up rather than hanging for ever.** On a
  hotel or airport wifi the Send button could sit at "Sending…" until
  the app was killed.
- **Signing out of Game Center gives you your own name back.** The Apple
  alias was written into the device's own profile, so it stayed for ever.
- **Friends stopped reloading itself.** Every render of the game while
  the page was open re-published your profile, re-fetched the list and
  flipped the page back to its spinner.
- **"Ask to be friends" says it worked.** The card just disappeared,
  which is also what a failure looked like.
- **The battlefield pictures rebuild when a battlefield is repainted.**
  They were cached under the arena's name alone, so a repaint handed
  back the old picture.

### Changed
- **Every result screen shows the coins you earned**, next to the
  trophies. They were counted and paid and never once shown, while the
  tutorial promises "you earn coins too".
- **The home screen carries the whole name**, Dice Battles: Color Rush.
- **"Lose −3–8 trophies" is now "Lose 3–8 trophies".** The minus in
  front of a range read as arithmetic.
- **News points at Report a bug**, which is the channel that exists.
- **Items shows the trophy count once**, not twice.
- The pick screen's title clears the coin and trophy pills.

### Website and admin
- **The admin, the sign-in page and the password page get their security
  headers back.** They were still aimed at /hq, which the board left on
  18 August, so for three weeks the pages they protect had none of them.
- **A missing database key no longer takes the whole public site down**
  — it falls back to the copy in the code, which is what the fallbacks
  were built for.
- **A failed sign-in link says why.** It redirected with the reason and
  the page ignored it.
- **A 404 that belongs to us**, plus a robots file and a sitemap.
- **The legal pages date themselves from when their text was last
  edited**, rather than claiming August for ever.
- Section labels are real headings, the pages have a main landmark, and
  the current nav item says so — for anyone using a screen reader.
- The contact form no longer claims "nothing is passed on to anyone",
  which stopped being true when replies started being drafted.
- Anonymous contact messages are rate-limited like signed ones were.
- A child's real email address is no longer the example in the admin.

### Tests
- **`npm run check` now includes the bundle check.** It was typecheck
  plus tests only — leaving out the one step that exercises Metro, which
  is the step whose absence red-screened a phone on 25 August.
- The function that decides trophies, wins and unlocks after every
  battle now has a real test: the bands, the floor at zero, the unlocks
  crossed, and the counters.
- The friends network client is tested against a dead network, a captive
  portal, a server error and an empty answer, and the device secret is
  proved to stay out of every URL.
- The crash guard — the thing that keeps a fatal on screen instead of
  letting the app vanish — is tested for the first time.
- Old and corrupt saves are tested: a save from before per-mode counting
  opens, and a half-written one is a fresh start rather than a crash.
- The runtime-version gate covers every native package in the project
  rather than only the ad SDK, with an exemption list that has to carry
  a reason.


## v1.65.0 — 2026-09-07 · requested by David

David asked for a full front-to-back review of the game and everything
around it — "see where it needs improvement in features, graphics, and
use" — with minor bugs and small cosmetic changes fixed without asking.
This is the first batch of that work: everything a review agent
confirmed twice, that needed no decision from anyone.

### Fixed
- **A normal battle no longer knocks you out of a cup you paid for.** A
  cup run was global: any battle started while one was open counted as
  the next bracket round, so a casual Easy loss ended a 150-coin Grand
  Championship. Only rounds started from Cups count now, they always run
  at the cup's advertised difficulty, and a finished run clears itself
  instead of offering rounds that change nothing.
- **A cup run survives the app being killed.** It lived only in memory,
  so force-quitting mid-run threw away the run and the entry fee with it.
- **Entering a cup, giving up a run, removing a friend and blocking
  somebody all ask first.** Every one of them used to happen on the first
  tap that landed on it, and a mis-tap cost 150 coins or a friendship.
- **There is somewhere to unblock somebody.** Blocking was the only move
  in the game with no way back, even though the rules always allowed one.
- **The bottom bar says what really happened.** Two matching faces used
  to shout "RED RESCUED!" even when nobody got out — when Ultimate sent
  one back, when the other side had already taken it, when it was not
  your colour in Color War.
- **Both players can see which colour is theirs in two-player Color
  War.** Neither was ever told, and a matched pair in the wrong colour
  did nothing at all, silently. The ready card also read "first to
  rescue all six" in every mode, which is wrong in three of the four.
- **Friends closes when you leave the Ranks tab.** Tapping Store moved
  the highlight and left Friends covering the screen.
- **An advert no longer runs the next battle underneath itself.** The
  countdown, the dice and the rival all kept going behind a full-screen
  ad, so you closed it to find the battle already lost ground.

### Changed
- **Eight battlefields repainted where they hid the dice.** Coral Reef's
  board is open sand instead of coral the same size and colour as a die,
  and its surround is water rather than a carpet of blobs. Glow Glade's
  striped lawn went pale so a green die shows. Autumn Woods thinned its
  leaves on the board. The Crystal Cavern's lilac slabs sank into the
  rock. Pirate Cove is a deck beached on a shore instead of a crate on a
  warehouse floor. Rooftop City lost the zebra crossing across its
  middle. Frozen Lights actually has lights now. Moon Base's hazard
  stripe reaches the corners, and Toy Room's rim is no longer a row of
  things that look like dice.
- **Eighteen dice repainted.** The four metals lost a zigzag staircase
  down the light band, Zebra bends and tapers like an animal instead of
  a barber pole, Mint, Bubblegum and Midnight gained a sheen so an
  earned die is not blanker than the one you start with, and Circuit,
  Volleyball, Golf, Bowling, Paws, Marble, Granite, Starry, Strawberry
  and Donut each look like the thing they are named after.
- **Every shelf picture is painted from its own battlefield.** Sky
  Kingdom's had been painted in Snowy Hollow's colours since the day the
  generator was written, and three others were weeks out of date.
- **The Store's coin section is written for a player.** It used to
  explain our App Store payment paperwork.
- **The tab labels grow with the system text size.** The navigation was
  the one place in the game that ignored it.
- **The credits for the music and the crowd are in Settings**, which
  their licence requires.

### Security
- **The device secret moved out of the web address** into a header, so it
  stops being written into request logs on every open of Friends.
- **The advert consent form is told it is talking to a child** before it
  can draw itself, rather than afterwards.

### Native (needs a new build to take effect)
- iPad is portrait-locked, matching the rest of the game.
- The advert SDK no longer starts measuring before it has been told the
  child-directed rules.
- The game no longer asks for microphone permission it never uses.


## v1.64.0 — 2026-09-04 · requested by David

David asked for "an account system and a friends system … view your
friend's profiles and stuff". He chose "Game Center now, accounts
later" once the trade-offs were laid out.

### Added
- **Friends, and a profile for each of them.** Find someone by their
  friend code, ask to be friends, and once they say yes you can see
  their trophies, their wins by difficulty and by game mode, how many
  dice sets and battlefields they have, and their favourite of each.
  It lives on the Ranks page rather than in the tab bar — five tabs is
  a deliberate size, and a sixth would squeeze every label.
- **A friend code instead of a search box.** Eight characters in
  Crockford base32, so there is no 1/I and no 0/O and a five-year-old
  can read one down the phone. O, I, L and U are accepted and corrected
  when typed. There is NO directory and no "people you may know": a
  child cannot be found by anybody who was not handed their code.

### Why there is no sign-up
- **No email, no password, no age, no free text anywhere.** This game
  is rated 4+ and AGENTS.md says it collects nothing; the App Privacy
  answers already filed with Apple are true only while that holds. A
  sign-up would need a verifiable parental consent flow under COPPA,
  a re-filing, and probably a higher age rating — against a studio that
  is not yet a company, so the liability would be David's personally.
- **Identity comes from Game Center**, which already holds it, already
  has the parent's consent, and moderates the alias — which is why
  there is no username for a child to invent and nobody to moderate it.
  A player with no Game Center (Android, signed out, an older build)
  still gets a profile and a code, kept on the device, and the screen
  says so rather than hiding it.
- **A block is quiet.** The blocked player is told nothing, sees no
  change, and a further request is answered as though it succeeded —
  because any other answer is a way to detect a block, which is the
  confrontation a block exists to avoid.
- **A stranger sees a name and a trophy count.** Never the collection,
  never the friend code. The trimming happens on the SERVER, because
  the app runs on somebody else's phone.

### Behind the scenes
- The rules exist twice on purpose — in the app so a button can grey out
  without a round trip, and on the server, which is the copy that
  decides. A test reads both files and fails if they drift, and it was
  checked to actually fail rather than trusted.
- Each device holds a secret the player never sees, sent with every
  write so nobody can edit another player's profile. Only its SHA-256 is
  stored. It is also the credential a real account upgrades from.


## v1.63.7 — 2026-09-02 · requested by David

David asked for everything — icons, loading screens, all of it — to be
in Paper & Ink. A sweep found three places that never got converted,
all of them out of sight in normal play, which is why they survived.

### Changed
- **The crash screen is on paper.** It was still the old dark purple
  with white text, which meant the one screen you see when something has
  gone badly wrong was also the only screen that looked like a different
  app. Warm paper, ink text, and the machine detail in a sunk well.
- **Its 🎲💥 emoji is now a drawn mark** — a die with a crack through
  it, built from Views, since rule one of the direction is that emoji
  are content and never chrome. It deliberately does NOT import
  `Icon.tsx`: this screen runs when module loading has already failed,
  and `theme.ts` is a plain object with no imports of its own while
  `Icon.tsx` is not.
- **The bug report box is on paper**, using the real Card and button
  kit rather than a hand-rolled panel. Its Send button had been in
  PRISONER YELLOW — one of the six colours the game plays with, which
  `theme.ts` says in as many words must never be reused in the
  interface, because those colours are the game's signal.
- **Launch no longer shows a third colour.** `app.json`'s root
  background sat at #1b1430, left over from the theme before this one,
  matching neither the ink splash in front of it nor the paper that
  follows.

### Fixed
- **A tap inside the bug report could throw away what you typed.** The
  panel lost its tap-swallowing wrapper during the conversion, so a near
  miss on Send fell through to the backdrop and closed the report. Found
  by a test, and the test was checked to genuinely fail without the fix
  rather than trusted.

Three of these were caught by looking rather than by reading: the first
cracked die rendered as "/\", two separate strokes instead of one break,
and an early version made the whole report panel depress like a giant
button whenever you touched it — including while typing.


## v1.63.6 — 2026-08-31 · requested by David

### Changed
- **The Inventory leads with the dice now**, with battlefields
  underneath. The two sections simply swapped over. A test holds the
  order, because the two blocks look almost identical in the file — a
  title, a note, a grid of cards — so a later edit could quietly put
  them back and the only person who would notice is the one who asked.


## v1.63.5 — 2026-08-31 · requested by David

A sweep across every arena and every dice skin, looking for the ones
that were a flat colour pretending to be a design. Each was rebuilt
through the real painters and looked at on a render, not judged on
paper.

### Changed
- **Ivory, the starting die, is a material instead of white.** Warm
  cream with a faint wandering grain and one soft diagonal sheen. Kept
  deliberately quiet — it is the die every new player holds, and it must
  never compete with the colour on its face.
- **Blossom has actual cherry blossom.** Six five-petal flowers with
  white tips blushing into pink and a gold heart, plus loose petals
  drifting. It was a flat pink square before.
- **Lavender has actual lavender.** Bowed green stems with leaf pairs
  and staggered purple bud spikes, over a soft lilac sheen. Also a flat
  square before.
- **Glow Glade reads in three bands now.** The tray floor is a calm mown
  lawn with nothing on it to compete with a die; the outside ground is
  dusk-dark and carries the stepping stones and the glowing spores the
  arena is named for; the walls are warm brown boulders with moss caps.
  The toadstools were raised to lamp brightness so they light rather
  than sit there.
- **Frozen Lights puts the aurora on the snow.** The floor was a
  riveted metal grid, which had nothing to do with the name. It is now
  pale snow blocks with drift and ice sparkle, and three broad ribbons
  of green, cyan and magenta sweeping across it. The pines and crystals
  were brightened so they stop rendering as black blobs at night.
- Several more skins tightened in the same pass — fish, golf, honeycomb,
  and the reef, sky and snow arenas.

Every change keeps the guards: no painted colour comes near a face
colour in ΔLab, so a die face is never mistakable for its own pattern.
The two repainted arena floors had their fingerprints re-pinned, which
is what that test asks for on a deliberate repaint.


## v1.63.4 — 2026-08-30 · requested by David

### Changed
- **The family's phones will get FAKE ads, arranged by a word instead of
  a laptop.** Tapping your own real ads is what gets an AdMob account
  suspended for invalid traffic, and David, Marc and AJ play this more
  than anyone. The usual fix — registering each phone's test-device id —
  turned out to be unavailable: those ids exist only on the phone,
  printed to its system log, and reading one needs a Mac with the phone
  plugged in. Nobody in this family has a Mac, so that safety net would
  never have existed.
  - Instead, anyone in **family tester mode** (the `FAMILY` code already
    typed on a fresh install to open every arena) is served Google's TEST
    interstitial rather than the real unit. Test ads always fill, are
    meant to be tapped, and earn nothing — which is the whole point.
    This is Google's own recommended route for development, not a
    workaround. `LOCK` puts real ads back.
  - The check happens when each ad is REQUESTED, not remembered at
    launch, so switching tester mode changes the very next ad.
  - The menu line now reads "Family tester mode — everything unlocked,
    test ads only", so it is visible on the phone rather than taken on
    trust.
  - A test guards both directions: a tester must never load a real ad,
    and a real player must never be handed a test one — a test ad earns
    nothing, so leaking it would quietly zero the income. If progress has
    not loaded yet the fallback is real ads, because guessing "tester"
    for an unknown player gives away free test ads.
  - The banner shrinks rather than ellipsising. Measured against every
    "Next unlock" line the same slot has ever shown, it is about 9%
    wider than the longest of them — and the tail, "test ads only", is
    the half a tester actually came to read, so cutting it would defeat
    the point. Same fallback the two-player label already uses.
  - Ads themselves remain OFF. Nothing here puts the SDK in the bundle,
    which was checked by building it and searching rather than assumed.


## v1.63.3 — 2026-08-30 · requested by David

### Added
- **A place for the family's phones in the ad code**, ready for when ads
  switch on. `AD_TEST_DEVICE_IDS` in `src/game/ads.ts` lists devices that
  get Google's TEST ads instead of real ones — loading and tapping your
  own real ads is what gets an AdMob account suspended for invalid
  traffic, and the family testing the game is exactly that. The list is
  empty for now: each phone's identifier is printed in the device log the
  first time an ad request runs on a build containing the SDK, and gets
  pasted in then. The list rides in the JavaScript, so adding a device is
  an over-the-air update, not a new build. Ads themselves stay OFF —
  nothing about this changes the bundle, which was checked by building it
  and searching for the SDK: zero occurrences.


## v1.63.2 — 2026-08-28 · reported by Marc

Marc: "the floor is too blurry, enhance the quality of it."

### Fixed
- **Every arena floor is drawn at twice the resolution**, 224x408 texels
  instead of 112x204. The tray is the largest thing on screen at about 54
  screen pixels to the world unit, and the painters work at 20 units to
  the world unit — so at the old density each texel was covering nearly
  three screen pixels and the slab seams came out as stair-stepped dashes
  rather than lines.

  It was at the low setting for a reason that had already expired. When
  it was chosen the heaviest floor took 226ms to paint and anything more
  pushed it past a quarter of a second, which is a stall a player sees
  the first time an arena opens. `noise` got 6.8x faster in v1.62.2, so
  that floor is now 37ms and four times the pixels is 147ms — well inside
  the same ceiling, which has not moved.

  Not higher: three times measures 339ms and blows the ceiling, and two
  and a half fits here at 227ms but leaves nothing for a slower phone and
  holds 11.7MB of texture that is deliberately never freed. Two costs
  7.5MB across all sixteen floors.
- **The tray floor is filtered anisotropically.** The camera looks down
  the board at a 17-degree tilt, so the far half is squashed hard along
  one axis and not the other — the case ordinary mipmapping handles worst,
  because it picks one level for both and blurs the far end lengthwise to
  avoid aliasing across it. This is most of why the far end looked softer
  than the near end.

Both changes apply to all sixteen battlefields, not just the Crystal
Cavern. No painter changed, and the pixel fingerprints confirm it.

## v1.63.1 — 2026-08-28 · chosen by Marc

Marc, on the geode floor that shipped yesterday: "actually I don't like
the floor so give me more options for that." Then, from the second set:
"I want the cut slabs."

### Changed
- **The Crystal Cavern's floor is cut in slabs, three times the size.**
  Same idea as the floor it replaces — the inside of a cracked geode,
  convex faces meeting edge to edge — but the cells go from about half a
  world unit across to a unit and a half. A hundred small facets on a
  board is gravel; a handful of big ones is cut crystal, and only the
  second reads as cut at the size a player actually sees it.

### Why the first one was wrong, and how the second was chosen
The first set of options were hand-drawn SVG illustrations on a design
canvas, and an illustration flatters itself: the cell size that looked
like bold faceting in a drawing came out as rubble from the real painter.
Nobody could have told from the canvas.

The second set was rendered by the actual painter, at the actual size,
through `SURFACE_TOOLS` — the primitives a painter is built from, now
exported so a tool can draw a candidate with the real thing rather than a
copy of it. Six floors side by side including the one already shipping,
and the problem with it was obvious at a glance. Three of the six needed
a second pass before they were worth showing at all: the seams came out
as pixel speckle, the agate as a bullseye centred exactly where the dice
land, and the pools a muddy gold.

That is the process now for anything visual: draw it with the code that
will draw it, at the size it will be seen.

## v1.63.0 — 2026-08-28 · chosen by Marc

Marc, picking two directions off the design canvas: "I like the
FloorGeode for the floor of the crystal cavern and the CrestCluster for
the wall toppers."

### Changed
- **The Crystal Cavern's floor IS the crystal now**, rather than rock
  with crystal lying on it: the inside of a cracked geode, cut facets
  meeting edge to edge with nothing between them, about a third of them
  gemstone and the rest the cavern's own violet rock.

  The facets come from a jittered Voronoi — for each texel, the nearest
  of nine candidate sites owns it. Voronoi cells are convex polygons that
  tile without gaps, which is exactly what a cut surface is, so every
  edge falls out of the distances rather than being drawn: `d2 - d1`, the
  gap between nearest and second-nearest site, is small only along a
  boundary, and the bright seam is that number ramped.
- **The wall carries crystal clusters**, not single studs. A crystal does
  not grow one to a spot; it grows from a common root, several six-sided
  prisms of different heights splaying outward, tallest in the middle.
  Every rim spot gets one, so the wall is crystal the whole way round.

### Fixed
- **The ground outside the tray stayed rock, and had to be made to.**
  One painter draws both surfaces, so the first build turned the entire
  screen into crystal facets and the board stopped reading as a board in
  the middle of it. A painter is now told which surface it is drawing;
  fifteen of the sixteen ignore it and make both from the same rock, and
  the cavern uses it to keep its scenery quieter than its floor.
- **Most of a wall cluster is coloured crystal**, after the first attempt
  used the wall's own cap stone for four prisms in five. Cap is a dark
  violet a shade off the wall itself, so the clusters came out as dark
  studs on a dark wall and the ring read as gravel from above.

### Added
- **The pixel fingerprint now covers both surfaces**, floor and ground.
  Splitting the painter in two gave every structure a second behaviour,
  and pinning only the floor would have left half of each one unwatched —
  which is the gap that test exists to close.

## v1.62.3 — 2026-08-28 · reported by Marc

Marc: "have both the castle courtyard and ivory dice be highlighted on
the ladder at the beginning."

### Fixed
- **A new player was shown standing on one free rung instead of two.**
  The ladder marks where you are by comparing each rung against your
  league, and a league is a single tier — the last one you have reached.
  Two rungs are free and both sit at 0 trophies, so at the start Ivory
  Dice was marked YOU and Castle Courtyard looked like something still to
  earn, when you own both from the first launch.

  The rung you are on is picked by THRESHOLD now rather than by identity,
  so every rung at the number you are standing on lights up. A test pins
  that the two free rungs really are the only pair sharing a threshold —
  a tie anywhere else on the ladder would light two rungs at once for a
  reason nobody intended.

## v1.62.2 — 2026-08-27 · found by the test suite

### Fixed
- **A floor paints in a fifth of the time, pixel for pixel the same.**
  `noise` is the hottest function in the surface painters by a long way
  — a floor calls it millions of times — and every call was allocating
  two closures (`wrap` and `h`) and then calling `h` SIX times to get
  FOUR corners, so two of them were hashed twice over. Written flat, with
  four wraps and four hashes and no closures, the reef — the slowest
  floor in the set — went from about 226ms to about 33ms. Every floor
  comes out bit-identical; a new test proves it.

### Added
- **A fingerprint of every floor's pixels**, because this nearly shipped
  as something much worse. The obvious way to speed `noise` up is to
  precompute its hashes into a table, since it only ever hashes lattice
  points. That is wrong here: `hash` is a fract-of-a-sine over its
  arguments rather than a lookup, and the painters pass FRACTIONAL
  periods (`SIZE / 3` is 42.667), so the coordinates it hashes are a
  continuum and not a grid. The table version was written, it was three
  times faster, it passed all 512 tests — and it silently repainted five
  of the sixteen floors. Nothing in the suite could see it, because the
  tone-step and distinct-surface tests measure a floor's CHARACTER, which
  survives being redrawn. The new test measures identity.

### Changed
- **The floor-paint budget is measured as the best of five runs**, not
  the mean. Its first version failed on a busy machine — 310ms for a
  floor that really costs 33ms — which is a test failing by weather
  rather than by regression. The 260ms ceiling is unchanged; it now has
  eight times the headroom.

### Corrected
- **v1.62.1's changelog claimed a hash change that is not in the code.**
  It said the fract-of-a-sine hash had been replaced with integer
  bit-mixing, gave measurements for it, and reasoned about why it was
  kept. The shipped file has no such change and never did — the edit was
  written and measured, then lost before the commit, and the paragraph
  went out unchecked against the file it described. That entry is struck
  through and marked below. Nothing about the floors' appearance depended
  on it, and nothing else in that release is affected.

## v1.62.1 — 2026-08-27 · reported by Marc

Marc: "make the crystal cavern floor look less pixelated. Make the glow
glade floor look better. Make the floor of every arena one continuous
picture and design because you can see the line in the middle where it's
cut."

### Fixed
- **Every floor was cut across, in the same place.** The tray floor was a
  square 128×128 picture laid down with `repeat` set to the tray's size
  over 6.4 world units — `[0.875, 1.594]`. Across the tray that is under
  one copy, so nothing showed; DOWN it the picture ran out at 1.0 and
  started again from the top, and the join was a hard horizontal cut
  about six-tenths of the way along, right where the dice land. All
  sixteen had it.

  A square picture cannot cover a 5.6 × 10.2 tray without either
  repeating or being stretched out of shape, so the picture is not square
  any more: the painter is asked for one the tray's own proportions, laid
  down once at `repeat [1, 1]` and clamped rather than wrapped. No join,
  and nothing stretched, because the texels stay square in world space.

  The ground outside the tray still tiles, and should: it reaches 26
  world units, it is mostly behind scenery, and its painters genuinely
  wrap — which is what the tray's could never do at 1.594.
- **The Crystal Cavern's floor was jagged.** The pixels were never the
  problem, the EDGES were: every crystal was drawn by a pair of
  `continue` tests, so a texel was either wholly crystal or wholly rock
  with nothing between, and a hard edge magnified onto a floor about
  three screen pixels to the texel is a staircase. Nothing else on that
  floor had the fault because nothing else on it has an edge — it is all
  noise. Every edge is a ramp now.

  The shape took three goes and both dead ends are worth recording. Long
  tapered blades radiating from a root is what a crystal cluster looks
  like from the SIDE; from above, three of them read as a bird's
  footprint and four as a bird. What reads as crystal looking down is a
  chunk — a flat angular face with a straight edge and a second face
  turned away from the light — so a cluster is three overlapping
  hexagonal shards, each split into a lit facet and a shadowed one, each
  outlined dark so it stays a separate solid.
- **Glow Glade's floor was a flat green with grey lumps.** The moss was
  one blob of noise, so it had colour but nothing at the scale of a leaf.
  The stones were near-circles with a soft rim, which at this size reads
  as mould. And the spores were single texels turned on by a hash — a lit
  pixel with nothing around it is not a glow, it is a dead pixel, and it
  is exactly what "looks pixelated" means. Now: moss in three depths with
  a fibrous grain over it, lumpy stones sitting in their own shadow, and
  spores drawn as soft round lights with a halo.

### Notes on cost, since it is not free
Being one picture makes the floor 40% bigger than the square it replaced,
and the heaviest floors went from about 145ms to about 190ms to paint.
That is the price of not having a seam and there is no way around it.
Painting at higher resolution as well was tried and dropped: it took the
worst floors past 260ms, which is a stall a player would see the first
time an arena opens, and avoiding that stall is the whole reason
`textureCache.ts` exists. Sharpness came from ramping the painters' hard
edges instead — a multiply, rather than half again as many pixels.

~~The hash under all of it was changed from a fract-of-a-sine to integer
bit-mixing…~~ **This paragraph was wrong and is corrected in v1.62.2.**
No such change is in the shipped code: the hash is still the
fract-of-a-sine it always was. The edit was written, measured and
described, and then lost before the commit; nobody checked the file
against the paragraph.

## v1.62.0 — 2026-08-27 · requested by Marc

Marc: "make the emojis on the ladder section just the icons for each
item. Flip the ladder around to go in ascending order down. Change the
trophy amount of some items so that the highest thing is only 10 thousand
trophies."

### Changed
- **The ladder shows the item, not an emoji.** It drew a hand-picked
  emoji for every rung — a cherry for Ruby Dice, a volcano for Volcano
  Rim — while the Store and the Inventory, two taps away, show the real
  painted die and the real picture of the battlefield. Same items, same
  app, and only this screen showed a picture of fruit. A rung now draws
  what it hands over, through the same `DiceSwatch` and the same
  `ARENA_ART` every other screen uses. The league banner above it was the
  last emoji stand-in left on the screen once the list stopped using
  them, so it shows the picture too.

  Courtyard Treasure keeps its 💰: it adds the pile of gold to the Castle
  Courtyard rather than handing over a thing of its own, so there is no
  picture to show. The join between a rung and its item lives in
  `src/game/tierItem.ts`, and a test holds that rung to being the only
  one without a picture.
- **The ladder reads downwards.** It was reversed so the summit sat at
  the top, which is how a leaderboard reads. This is not a leaderboard,
  it is a road, and a road is read from where you are standing towards
  where you are going.
- **The summit is 10,000 trophies exactly**, down from 10,600, with the
  eleven rungs below it moved to suit. The comment in `progress.ts` used
  to argue this could not be done without a kink in the climb, and that
  was true only of gaps that all grow by the same fifty: fourteen of
  those, each wider than the 300 below, come to at least 9,450 and
  overshoot. Four twenty-fives at the bottom of the run buy the
  difference — 325, 375, 425, 475, then ten clean fifties from 500 to 950
  — summing to exactly 8,850. Every rung is still harder than the one
  below it, now checked by a test that demands *harder* rather than *no
  cheaper*.

  Midnight Dice stays on 1,150, and not for tidiness. Its Game Center
  achievement id is `…trophies1150` — the number is IN the id, and those
  ids are live records in App Store Connect, pinned in
  `tests/achievements.test.ts` from the API. Moving the rung would mean
  renaming one there or leaving an achievement that never fires.

### Added
- **`tools/screen-preview/` — the menus can be looked at now.** The
  arenas, the icons and the dice skins could all be rendered and
  inspected before shipping; the menu screens were the last visual thing
  going out on faith. It mounts a real screen through `react-native-web`,
  so the flex, border, radius and image rules a phone applies are the
  ones the browser applies. This ladder was checked in it before it went
  out, top of the screen to bottom.

## v1.61.1 — 2026-08-27 · reported by Marc

Marc: "fix the ocean dice skin to look better. That's not what a soccer
ball looks like, make the soccer ball skin look like a freaking soccer
ball."

### Fixed
- **The Soccer Ball was a honeycomb.** It picked one panel in three with
  a hash, so black cells landed next to each other and ran together into
  blobs; every panel was a hexagon; and the seam was a hairline. It read
  as bathroom tiling. A football is a truncated icosahedron — black
  PENTAGONS, no two touching, in a field of white hexagons — so the black
  panels now go on a proper 3-colouring of the hex lattice,
  `(q + 2r) mod 3`, which is the arrangement where no two are ever
  neighbours. Each one is drawn as a regular pentagon, its boundary found
  the same way `hexCell` finds a hexagon's: the inradius over the cosine
  of the angle folded into one fifth of a turn.
- **The Ocean was teal with white comets on it.** Three separate faults,
  and each had to go.
  - The wave phase was pushed around by 2.6 radians of noise — more than
    half a wavelength — so every swell bent back into itself and there
    were no wave fronts at all, only swirls. The wander is a fifth of a
    wavelength now.
  - The foam was chosen from the sum of the swell and the chop crossing
    it. The chop is what stops a sea looking like corduroy, but adding it
    in before deciding where the foam goes chews the crest line into
    pieces — and those pieces were the flying white blobs.
  - It was one train of waves with foam on every crest, which gives
    evenly spaced parallel stripes. At sixty-four pixels evenly spaced
    parallel stripes are a deck chair, whether the stripe is a thin neon
    line or a broad white band; both were tried on the way here. What
    makes water read as water is foam that is patchy and still lies along
    lines, so there are two scales now: a long roll carries the colour,
    shorter waves ride it at an angle, and foam needs BOTH a small wave
    at its crest and the roll high underneath it.

## v1.61.0 — 2026-08-27 · reported by Marc

Marc: "in volcano rim you didn't put the orange rocks around the entire
wall, just on half of it. All these things have to go around the entire
wall."

Volcano Rim was v1.60.1's fault and was already fixed by it — with the
crest ring listed a wall at a time, the orange columns were `i % 4`, and
every even index was a left-wall spot, so nine went down one side and
none down the other. What "all these things" turned up was that going
round the wall was only ever CHECKED by eye, and three other faults had
got past that.

### Fixed
- **The Snowy Woods' fence was buried.** The palings topped out 0.40
  above the wall and the drift of snow was a slab from 0.355 to 0.485
  across the full width of it, so from a camera that looks down there was
  nothing to see: every wall read as a blank white kerb. The posts had
  been there the whole time. They now stand 0.62–0.82 proud with a cap of
  snow ON each one, and every third is cut from the paler timber.
- **Rooftop City had a bare grey frame.** The coping was one smooth band,
  the handrail was cut from the wall's own width — 0.5 across, wider than
  anything standing under it — and the posts were 0.04-radius pins. From
  above, nothing. The coping is cast in slabs now, alternating shade, one
  per crest spot the whole way round, with a stanchion and a base plate
  on each, under a 0.12 rail that leaves them showing either side.
- **Three crests were laid crossways on two of their four walls.** The
  Dune Fort's bricks, Palm Cove's driftwood and Sunny Farm's pickets all
  had fixed box dimensions, which are right for the near and far walls
  and turned ninety degrees out on the two long ones. They now follow the
  wall they sit on.

### Added
- **`tools/arena-preview/audit.js` — the wall is measured now.** It
  renders each battlefield straight down, walks the middle of all four
  walls in screen space through the camera that drew them, and reports
  the light-to-dark range along each. It fails a wall under 18 of range
  (a bare kerb) and fails walls that do not match the one opposite — the
  long walls to 0.75, the short ones to 0.45, which are looser because
  the jail and the retreat stand behind them.

  Both thresholds were set by testing them against faults that really
  happened: with the crest ring reverted to its pre-v1.60.1 order the
  audit flags Volcano Rim (105 vs 65), Frozen Lights (125 vs 0) and
  Crystal Cavern (166 vs 113), and nothing else. All sixteen pass on the
  code as shipped.

  A per-wall evenness reading is printed as well but deliberately does
  NOT fail: it samples one line at one height, so a piece taller than
  that line shifts off it as it projects and the number dips where
  nothing is missing.

## v1.60.1 — 2026-08-27 · reported by Marc

### Fixed
- **Frozen Lights' ribs were on one wall only.** Marc: "on frozen lights
  the nobs at the top of the wall still don't go around the entire
  wall." v1.60.0 fixed the crest POSITIONS — the ring was continuous and
  every corner filled — and the ribs still came out nine down one long
  wall and none down the other. The positions were never the fault. The
  ORDER was.

  The ring was built a wall at a time, pushing the left-hand spot and the
  right-hand spot of each step into the list together, then the near and
  far ones. So every even index was a left-or-near spot and every odd
  index its opposite number. Nearly every crest picks which pieces to
  draw with `i % 2` or `i % 4` — the polar station's ribs, the rooftop's
  handrail posts, the cavern's lit crystals, the cordwood's two shades —
  and every one of those was really saying "one side of the arena", not
  "every other piece".

  The ring is now built in the order you would walk it: down the left
  wall, across the far one, back up the right, home along the near. It
  comes to 48 pieces, which 2, 3 and 4 all divide, so a repeating crest
  also closes up at the corner it started from instead of showing a seam.
  Frozen Lights now carries nine ribs on each long wall and three on each
  short one; Rooftop City, Crystal Cavern and the Autumn Woods' cordwood
  are evenly dressed for the first time as well.

  The ring moved out of `ThemedArena.tsx` into `src/arena/rim.ts` so it
  can be measured. Five new tests: the ring touches all four corners,
  consecutive entries are neighbours on the wall, every `i % 2`, `i % 3`
  and `i % 4` subset still lands on all four walls in matching numbers,
  a repeating pattern divides the ring, and the renderer uses the
  measured ring rather than building its own.

## v1.60.0 — 2026-08-27 · reported by David

### Fixed
- **The wall decorations stopped short of every corner.** David: "the
  pegs and decorations on the top of the walls on a lot of maps only go
  halfway around when they should be all the way around." Measured, the
  crest ran across only 77% of the near and far walls — it started and
  stopped 0.15 inside the INNER width, leaving 0.65 of bare wall at each
  of the eight places an end wall meets a side. The sides reached 95%, so
  the two short walls looked stripped next to them and every corner had a
  hole in it. It is one continuous ring at one pitch now: the sides run
  corner centre to corner centre and own the corners, and the ends fill
  in between them.

### Changed
- **The Autumn Woods floor has real leaves** — shaped, with a midrib, in
  the reds and golds a wood actually turns, overlapping in two passes.
  They were small dark dashes, which reads as grit.
- **The Crystal Cavern has crystals in it.** The floor was a scribble of
  mineral veining that read as noise; it is calm rock now with faceted
  blades breaking through. The rim was a row of smooth cones — a
  portcullis — and is now stubby hexagonal prisms with blunt pyramid
  caps, some of them lit.
- **The Coral Reef is a reef.** More colour and far more coral, as asked:
  the seabed carries coral heads in six colours, and the wall pieces are
  brain corals, staghorn and fans instead of spikes.
- **The Moon Base floor is regolith** — grey dust pocked with craters in
  three sizes, each a dark bowl inside a lit rim. It was a hexagonal
  wireframe, which reads as graph paper.
- **Sunny Farm is a farm.** Ploughed furrows with clods turned up along
  the ridges, straw lying along them, and three times the hay bales,
  trees and flowers.
- **Glow Glade** has damp patches, brighter moss where the light gets in,
  glowing spores, and stepping stones that are now PALER than the moss —
  they had been mixed a quarter of the way into the theme's accent, which
  for the glade is another green, so they came out darker than what they
  were meant to sit on.
- **Rooftop City** has a roof on it: a hatch cover, a run of galvanised
  duct and the painted safety lines, over lifted decking.
- **More clouds in the Sky Kingdom** — nineteen props against six.

### Changed — dice
- **Ruby is Gold in red**, as asked: the same sweep of light, the same
  polishing marks, a bright core and near-black in the shade.
- **Bubbles are bubbles** — round, overlapping, with the iridescence a
  soap film shows, a shaded far side and a glint on each.
- **The Cow is a cow.** Six hand-placed patches at sizes and angles no
  lattice would produce, edges chewed by noise. It was one blob per cell
  of a staggered grid, and however much each was jittered the grid showed
  through: "less like an algorithm picking a pattern."
- **The Soccer Ball is black and white hexagons**, as asked.
- **The Bumblebee has no spots.** The pale speckle over its bands read as
  spots, which a bee has none of.
- **Also better:** the golf ball's dimples, the turtle's shell, the
  snake's markings, the basketball's seams and pebble, and the ocean's
  waves. The denim's copper rivet is gone — at a die's size it did not
  read as a rivet, it read as a stray yellow dot.
- Three of those had the same root cause, worth naming: the hex patterns
  were identifying which cell a pixel was in by rounding three axial
  stripe families separately. That does not name a cell, so hashing it
  scattered colour per PIXEL — the soccer ball came out as black
  splatter and the golf ball as diagonal streaks. There is one correct
  hex helper now, with cube-coordinate rounding and a real hexagonal
  boundary, and the soccer ball, golf ball, turtle and basketball all use
  it.

## v1.59.0 — 2026-08-26 · reported by David

### Fixed
- **The Ultimate mode icon, third attempt — and this one was looked at.**
  David: "the icon for ultimate still doesn't look good. You seem to keep
  messing up with the triangle part of the arrows." He is right on both
  counts, and the two failures were different mistakes with the same
  cause.
  - The first version made the loop's gaps by clearing the left and right
    border colours of a rounded box, not knowing that each of a rounded
    box's four border sides owns one 90-degree quadrant and is mitred at
    the diagonals — so clearing the sides leaves the top and bottom
    quadrants behind as stubs rather than opening the sides.
  - The second fixed that and then drew the heads 0.27 of the icon tall
    against 0.19 long — **wider than they were long** — pinned out at
    x 0.97 and 0.03, floating clear of a closed loop. Rendered, that is a
    rounded box with two fins stuck on it.
  - The heads are now 0.26 long against 0.28 across, with their points at
    0.66 and 0.34 — exactly where the loop stops being straight and
    starts curving, so each head grows out of the bar and narrows into
    the turn instead of being laid over the curve where it thickens into
    a blob.
  - Both earlier versions were signed off against a hand-drawn picture of
    what the code was hoped to produce. This one was chosen by rendering
    four designs side by side and then sweeping the three numbers.

### Added
- **`tools/icon-preview/` — a way to look at the icons.** It draws every
  icon in the app at 96pt and 22pt through the real components, with
  `react-native` aliased to `react-native-web`, so the styles a phone
  applies are the styles the browser applies rather than a guess at
  them. Same reason `tools/arena-preview/` exists: the checks that can be
  automated cannot see a picture, and somebody has to look.
- `npm test` now checks the two things that actually went wrong: an
  Ultimate arrowhead must be longer than it is wide, and its point must
  land on the straight part of the loop rather than out on the corner
  radius. Both are arithmetic, so both can be pinned.

## v1.58.0 — 2026-08-26 · reported by David

### Fixed
- **Copper rendered as a plain brown cube — and so did three others.**
  David: "the copper skin doesn't show when previewing it, it's just
  brown." Copper, Ruby, Ocean and Slate are painted by full-colour
  painters, which mix their own paint and carry no ink — and DieMesh
  used `!patternInk` to mean "this skin has no picture", so all four fell
  through to a flat body colour, in the hand as well as on the shelf.
  - The Store's copy of that mistake was found and fixed a version ago.
    The die's copy was not, and fixing one of two places is exactly how
    the other survived. Both are checked against the same list now.
  - The test that should have caught it was excluding them: it built its
    list of skins by filtering on `!!skin.ink`, so the four skins that
    mix their own paint were the four left out of the "no pattern comes
    out as a flat square" check.

### Changed
- **Copper is a metal like Gold and Silver.** David: "make it look like
  the gold and silver texture." It was a hammered surface of dimples,
  accurate and completely invisible at the size a die is seen. It is a
  polished sweep of light now, in the same family as the other two —
  what separates the three is the width of the sweep and what the shadow
  is made of. Gold's shadow is warm brown, Silver's is cold grey,
  Copper's is the first breath of verdigris.
- **The thirteen skins David named are remade.** Golf Ball, Cow,
  Bumblebee, Turtle, Soccer Ball, Denim, Snake, Basketball, Football,
  Honeycomb, Tiger, Bowling Ball and Volleyball. Ten of them moved off
  the single-ink painter for the same reason as the batch before: a mask
  travels from the shell colour toward ONE other, so it can darken or
  lighten but never both, and none of these can be drawn that way. A
  golf ball is white on white, so all of it is shading. A basketball's
  whole surface is pebble. A tiger is hairy. A honeycomb cell is a hole.
  A bowling ball is gloss. The Bowling Ball was the least visible pattern
  in the set at a local contrast of seventeen; it now has a swirl through
  the resin, a hard highlight and three holes with depth.
- **Every arena's retreat and jail belong to it.** David: "not every
  arena needs to have the same castle toppers on the bottom corners of
  the screen, make everything about every arena unique." The toppers
  were the retreat canopies — one cone on one post in all sixteen,
  repainted, standing at the two bottom corners of the frame where they
  are the closest and nearly the largest things on screen. A cone on a
  post is a turret roof, so every battlefield had a castle turret in each
  bottom corner however it was built.
  - There are sixteen shelters now: a snow-laden lean-to, a reed
    sunshade, a brazier of embers, a log A-frame, a floodlight, a hung
    crystal, the castle's parasol (which belongs to the Sky Kingdom and
    only there), a landing beacon, a stretched sail, a lollipop, a cage
    of fireflies, a ship's lantern, a birdhouse, a sea fan, a street
    lamp and a pinwheel.
  - The jail was nine identical iron bars behind the far wall of a coral
    reef and a rooftop alike. It is timber stakes, mud pillars, grown
    spires, machined rod, candy canes, saplings, rope and stacked bricks
    depending on where you are.
  - This is the third round of one fault — one crest for sixteen, then
    four, then one canopy for sixteen — so the new test checks the
    PATTERN rather than the piece: anything every battlefield must carry
    has to have a branch for every battlefield.

## v1.57.0 — 2026-08-26 · reported by David

### Fixed
- **The giant blob is gone.** David, on a screenshot with the top third
  of it filled by a featureless brown dome: "what is this giant blob."
  It was the "horizon bank" added in v1.56.0 — a squashed sphere of
  radius 7.5 at z -10.4, meant to give the world an edge to end at. The
  arithmetic nobody did: a sphere of radius 7.5 centred at z -10.4
  reaches FORWARD to z -2.9, past the tray's own far wall at -5.1, and
  stands 3.3 high against a wall 1.4 high. It was never a distant
  horizon. It was a dome sitting on top of the jail. My mistake, shipped
  because I could not see it.
- **The night battlefields were two stops under.** Rendered and measured,
  Rooftop City came out at 0.26 mean brightness with 54% of the board in
  deep shadow, and Volcano Rim at 0.28 with 78%. The palettes had already
  been lifted for exactly this complaint two versions ago; it was the
  lighting rig undoing them — a third dimmer than daylight, then
  compressed further by the scene's filmic tone mapping. Night is now
  carried by the COLOUR of the light rather than by how little of it
  there is, which is what it should always have been: a volcano at night
  is not dark, it is orange. City and Volcano now sit at 0.37.
- **Smaller blobs, same fault.** The Glow Glade's corner toadstools were
  pale domes most of a world unit across, and its mushrooms were bright
  enough to blow out to near-white circles. Trees were single spheres,
  which from a near-overhead camera project to flat coloured discs — they
  are clumps of foliage now. The city towers were near-black bricks.
- **The floors were too busy under the dice.** Wall-to-wall leaf litter
  reads as grit, not leaves; the tiles are larger and calmer, and about
  half the cells carry a leaf rather than all of them. The Pirate Cove's
  caulking was strong enough that the sand outside the tray read as
  blue-grey brick.

### Added
- **`tools/arena-preview/` — a way to actually look at an arena.** It
  renders any battlefield in a real browser through the real component
  and the real camera, at phone dimensions, and writes a PNG.
  - It exists because of this afternoon. Three rounds of arena work
    shipped without anyone being able to see the result: two hundred
    props placed outside the camera, then a dome on top of the jail, then
    a set of night arenas nobody could read. Every one of those passed a
    typecheck, a full suite and a Metro bundle check, because none of
    those can see a picture.
  - Metro is told to ignore `tools/`, and `react-dom` is installed on
    demand rather than added to package.json. Nothing in there can reach
    a phone build.

## v1.56.0 — 2026-08-26 · reported by David

### Fixed
- **The new battlefields were being dressed outside the camera.** David,
  looking at three of them on his phone: "every new map, not just these,
  look either unfinished, off centered, or only half done." He was right,
  and measuring the camera said why.
  - The board is framed almost straight down, and the visible world is a
    narrow box: x from -3.9 to 3.9 and z from -10.5 to 7.8 on a modern
    iPhone, of which the tray itself takes x ±2.8 and z ±5.1. **Every
    prop in all sixteen themed arenas sat at |x| between 7 and 10.** Not
    one had ever been on screen, on any phone, since the day it was
    written — and nor had the five hills at |x| 12, the three mountains
    at z -19, the clouds at z -13, the sun, the sixty stars, or the moon
    and the Earth and the aurora. Sixteen battlefields were a bare tray
    in a wash of flat colour, and everything meant to dress them was
    being rendered into the dark.
  - All two hundred props are re-placed inside the frame: a row down each
    side just outside the wall, and a bank of three behind the jail. The
    sky and the far landscape are gone from the 3D scene entirely, since
    height cannot rescue them — a distant object hung higher moves further
    UP the frame and out of it, not into view. The theme data still
    describes a sky and still should: the Inventory thumbnails are drawn
    wide and do show it.
  - `npm test` now projects every prop through the real fitted camera at
    the two extreme phone shapes and fails if it lands outside. Nothing
    could have caught this before: a prop off screen throws nothing, and
    reads in the source exactly like a prop that works.
- **All sixteen rolled on the same floor.** The renderer passed
  `theme.floor.a` to the shared flagstone painter and never read
  `theme.floor.b` at all, so every themed arena had the same grey
  eight-by-eight grid — the largest single thing on screen, identical
  sixteen times. There is a painter per battlefield now: packed snow,
  wind-rippled sand, cracked lava with the heat still in the seams,
  fallen leaves, riveted deck plate, mineral cave rock, flagstone,
  regolith, wet beach sand, iced squares, moss with stepping stones,
  ship's planking, straw on bare earth, rippled seabed under caustics,
  gravelled roofing felt and a printed play mat. The ground outside the
  tray is painted from the same family a shade duller.
- **The rim looked like scattered rubble.** It stepped 1.1 across the
  ends and 1.15 down the sides from inset starts — four pieces on each
  end against eight on each side, with gaps wider than the pieces. One
  pitch, measured from the wall's own corners, gives eight on the ends
  and seventeen down the sides, evenly.
- The ground plane was 70 by 70 and is now 26 — the other 44 units were
  a very large quad drawn for nobody.

## v1.55.0 — 2026-08-26 · requested by David

### Changed
- **Every dice design now matches its name.** David: "make sure every
  dice design still makes sense according to the dice name. Like the
  fish should have fish on it." He picked the clearest case — Fish was a
  scale texture, which is what a fish is COVERED in rather than what a
  fish looks like, and at a die's size it read as roof tiles. It has
  actual fish on it now, swimming in rows that alternate direction.
  - The audit turned up two more. Chicken & Waffles drew its chicken as
    two round lumps in the waffle's own brown — two burnt patches; they
    are drumsticks with bones now. Peacock drew its feather eye in one
    ink, which cannot work: an ocelle is navy, then blue, then gold, and
    that is the whole of what makes it a peacock.
- **The skins are textured properly.** Ten of them moved from the
  single-ink painter to full colour, because a mask can only travel from
  the shell colour toward ONE ink — it can darken or it can lighten,
  never both — and nothing with real relief can be drawn that way. The
  turtle's scutes are domed with growth rings; the chocolate bar is
  moulded and bevelled; the strawberry's seeds sit lit inside their
  dimples; Denim went from the faintest pattern in the set to real
  indigo twill with orange topstitching. Bubbles got a shaded side, so
  each one is a sphere rather than a hoop. Camo's four tones were pushed
  apart — camouflage is meant to break up a shape, not be invisible.
- **Ruby, Ocean, Slate and Copper have their materials.** They were flat
  colours, and all four are named after a MATERIAL. Ruby is a cut gem
  with facets, Ocean is swells with foam on the crests, Slate splits
  along its bedding, Copper is hammered with verdigris in the hollows.
  The rest of the trophy ladder stays flat colour, which is what tells
  it apart from the Store shelf.
- **All sixteen battlefields are built of something different.** David:
  "you just used the same like 4 different templates for the arenas now,
  make them all unique." Right, and for the same reason four was not
  enough that one was not: a skyline is what you recognise a place by.
  There are sixteen now — snow palings, adobe brick, basalt columns,
  stacked cordwood, a polar station, dripstone, the Sky Kingdom's
  merlons, moon-base hull plating, driftwood, piped icing, mossy stones,
  a ship's gunwale, a picket fence, coral heads, a rooftop parapet and
  wooden bricks — each with its own corner piece. The tray the dice
  bounce in is identical under all of them.
- **Prices and trophy thresholds climb properly.** David: they should
  "make sense scaling up higher and higher... just polish it off a bit."
  - Six dice used to cost 500 coins and five cost 450 — a third of the
    shelf was flat plateaus, which also made the display order arbitrary
    since the shelf sorts by price. All forty-two now have their own
    price, 250 up to 1,400, with the step widening the whole way.
  - The battlefields were a flat 200 coins apart and then 400 for the
    last one. They now widen 200, 250, 300 up to 500, from 900 to 3,350
    — deliberately above the dice, because a battlefield is a bigger
    thing to own than a die.
  - The trophy ladder ran 350, 350 at one point: the only rung on the
    whole climb that was no harder than the one below it. The long ladder
    now widens by exactly fifty a rung, 350 through 1,000. That moves the
    summit from a round 10,000 to 10,600 — the round number was what
    forced the kink, and a clean climb is worth more than a tidy number.
  - `npm test` now checks all of it: no two things on a shelf may share a
    price, both shelves must be in price order, the battlefield steps
    must widen, and the top of each shelf is converted into Hard wins so
    a change to prices or to rewards has to stay honest about the other.

## v1.54.0 — 2026-08-26 · requested by David

### Fixed
- **The dice designs are no longer drawn where the colour covers them.**
  David: "a lot of the dice are messed up because the design is in the
  center, which doesn't make sense because the colors are in the center."
  - He is describing a collision the two halves of a die's look were
    always going to have, and which nothing had ever checked. The
    coloured circle on each face — the thing a roll is actually read
    from — covers a third of that face, dead centre. The pattern
    painters draw on a plain square tile and had no idea any of it was
    about to be hidden.
  - Eleven of the forty-three patterned skins had put their whole
    subject in the middle. The **Football's** laces ran down the centre
    line with TEN TIMES as much ink under the sticker as outside it, so
    its faces were blank brown leather. The **Soccer Ball** was one
    pentagon, dead centre, entirely invisible. The **Tennis Ball's** two
    seams both crossed within six pixels of the middle. The
    **Basketball's** seams were a cross whose junction was the exact
    centre. All three of the **Bowling Ball's** finger holes were inside
    the circle. The **Lemon** was a wheel of segments radiating from a
    hidden hub. The **Galaxy's** bright core was the one thing covered
    up. Also affected: Cow, Pizza, Volleyball, Watermelon and Circuit
    Board.
  - Each is redrawn as the SURFACE of the thing rather than a portrait
    of it. The soccer ball is a proper pentagon-and-hexagon lattice; the
    football's laces ride the left third with the ball's long seam
    sweeping the right; the tennis and baseball seams bulge in from the
    edges; the basketball wears four shallow seams, one from each edge;
    the bowling ball's finger holes are up in a corner where a hand
    grips it; the lemon is four cut slices in the corners; the galaxy's
    core burns low in one corner with its disc tilted across.
  - `npm test` now measures the local contrast of every pattern inside
    the sticker's circle against outside it, so a new skin cannot ship
    with its design hidden. DieMesh and the painters read the sticker
    size from one shared number instead of two copies of 0.33.
  - It also checks the colours the full-colour painters mix themselves,
    which no test had ever looked at — they belong to no skin, so the
    existing shell and ink checks could not see them. Moving the galaxy
    off-centre meant giving its disc a colour, and the purple first
    chosen sat ΔLab 8.7 from the PURPLE face sticker: a soft bright
    field of almost exactly the face colour, spread across most of the
    face. It would have swallowed one face in six.

## v1.53.0 — 2026-08-26 · requested by David

### Changed
- **The dark battlefields can be seen now.** David: "a lot of these new
  maps are way too dark and you can't really tell what it is." He was
  right and it was measurable — five of the sixteen had most of their
  picture in the bottom third of the brightness range, and at the size
  the Items shelf draws them that is a smudge, not a mood.
  - Rooftop City is dusk instead of midnight, lit from the streets below.
    The volcano's rock is warm grey rather than near-black, so the lava
    has something to run down. The crystal cavern's stone is lit violet.
    Frozen Lights swapped ground and sky: the ground is SNOW, which is
    what ground under an aurora is, and the dark now lives in the sky
    where it belongs. Glow Glade became a mossy green clearing under a
    moon, which also moved it away from the coral reef — the two were the
    closest pair of colours in the set.
  - `npm test` now measures every picture's brightness and how much of it
    sits in shadow, so this cannot quietly creep back. The Space Station
    is the one exception, and only it: it is deep space, it is one of the
    four originals, and not seeing much is the subject there.
- **The battlefields are not all castles any more.** David: "the arenas
  all don't have to look like castles. They can be something that makes
  sense for the arena name, like how the space station doesn't look like
  a castle." The shared renderer had been putting notched battlements and
  cone-roofed corner turrets on every one of them, so a coral reef, a
  rooftop and a moon base were the same fortress in different paint.
  - There are four kinds of building now. The moon base, the polar
    station, the rooftop and the beached pirate hull have panelled walls
    with a lit strip and masts at the corners. The desert, the volcano,
    the cavern, the glade and the reef are heaped boulders with cairns.
    The snowy hollow, the autumn woods, the farm and the beach are timber
    fences with gateposts. Only the Sky Kingdom, the candy meadow's
    gingerbread and the toy room's building blocks kept their merlons —
    those three are castles on purpose.
  - The tray the dice bounce in is byte-for-byte identical in all four.
    Nothing about which battlefield you pick can change how the game
    plays, and a test now checks that the wall geometry never learns
    about the structure.
- **Extra decoration everywhere.** David: "add some extra decorations on
  them to make them look better." Five new kinds of scenery — flowers,
  bushes, pebbles, torches and banners — are placed around all sixteen
  battlefields, and every thumbnail gained detail: gulls over the beach,
  sparks over the volcano, a treasure chest at the cove, a lander and a
  flag on the moon, a fence and flowers on the farm, sprinkles in the
  candy meadow.

### Fixed
- **Leaving a preview drops you back where you were.** David: "after you
  exit a preview it should keep you where you were on the screen and not
  put you back to the top of the screen." Opening a preview takes the
  shelf off the screen entirely so you can see the item behind it, and
  the shelf that comes back is a brand new one, which starts at the top.
  With fifty-three dice and twenty battlefields on those shelves, that
  was a long scroll back to the thing you had just tapped. Where you were
  is now remembered outside the shelf and put back the instant it
  returns, with no animation, so there is nothing to watch.

## v1.52.0 — 2026-08-26 · reported by David

### Fixed
- **The arrows on the Ultimate mode icon.** The loop was meant to be a
  circle with a gap on each side for the two chasing arrows; what it
  actually drew was two short stubby arcs at the top and bottom with the
  arrowheads floating loose beside them.
  - The cause is a rule about how phones draw borders: a rounded box's
    four border sides each own one quarter of the shape and are cut off
    at the diagonals, so making the left and right sides see-through does
    not open the left and right of a circle — it leaves the top and
    bottom quarters behind.
  - It is a closed rounded-rectangle loop now with an arrowhead on the
    top-right pointing right and one on the bottom-left pointing left,
    which is what the repeat symbol actually is. Both heads are placed
    from the loop's own line thickness rather than by eye, so they sit on
    the bars instead of near them.
  - **This one is my fault twice over.** I checked the last version by
    drawing a picture of it — but the picture put the arcs on the left
    and right, so I approved something the code never made. A check only
    counts if it follows the same rules the phone does.

## v1.51.0 — 2026-08-26 · requested by David

### Changed
- **The game mode icons are the emoji shapes again, drawn — and bigger.**
  David: "the game mode icons need to be bigger and look very similar to
  the original emojis so they're easily identifiable for each mode." The
  previous drawn set depicted each mode's rule (a matching pair, a
  returning arrow, and so on), which was tidy and wrong: the family had
  weeks of knowing ⚔️ meant Color Rush, and an icon that throws away
  learned recognition makes the picker harder to use, not cleverer.
  - Color Rush is two crossed swords with steel blades and leather grips;
    Ultimate is the two chasing arrows of the repeat loop; Skirmish is
    two little figures leaning into a grapple, one green and one purple;
    Color War is a red-and-white bullseye.
  - They grew from 16pt to 21pt in the mode picker and from 30pt to 36pt
    in How to Play, and all four were rendered at both sizes — and on the
    gold selected chip — before shipping.

## v1.50.0 — 2026-08-26 · requested by David

### Added
- **Sixteen new battlefields**, taking the game from four arenas to
  twenty. Eight are earned on the trophy ladder, which now climbs to
  10,000 trophies — Snowy Hollow, Desert Dunes, Autumn Woods, Frozen
  Lights, Volcano Rim, Crystal Cavern, Sky Kingdom and Moon Base. Eight
  are bought in the Store with coins, 800 to 2,400 — Sunny Farm, Treasure
  Beach, Candy Meadow, Glow Glade, Pirate Cove, Coral Reef, Rooftop City
  and Toy Room. Battlefields now follow the same one-route rule dice
  always had: a trophy tier or a coin price, never both, and a test
  enforces it.
  - All sixteen share one renderer driven by pure data
    (src/arena/themeData.ts), so every arena keeps the jail, the retreat
    and the hazards exactly on the shared station coordinates — the
    figures can never stand inside the scenery. Each theme dresses its
    own hazards and names them ("Sssss! A die fell in the lava!"), so
    the grass-hill-on-a-space-station bug cannot come back with the set.
  - Every new arena has a drawn Inventory picture, generated FROM the
    theme data so the two cannot drift, and the distinctness test now
    measures the full colour cube across all twenty — the hue-only ruler
    scored the desert and the toy room nearly identical while any pair of
    eyes tells them apart instantly.
- **Forty new dice skins**, taking the set from thirteen to fifty-three.
  Six flat colours continue the trophy ladder (Ruby, Ocean, Lavender,
  Slate, Blossom, Copper); thirty-four patterned sets join the Store —
  ten animals (leopard, tiger, cow, giraffe, bumblebee, peacock, fish,
  turtle, snake, paw prints), eight sports balls (golf, tennis, baseball,
  soccer, basketball, football, bowling, volleyball), ten foods
  including David's own **Chicken & Waffles**, plus watermelon, pizza,
  donut and friends, and six oddities (denim, camo, tartan, circuit
  board, rainbow, galaxy).
  - Eight of them are painted in full colour — a watermelon is red,
    white, green AND black, which the two-colour mask system could never
    say — through a new colour-painter path in the texture builder.
  - Every shell and every pattern ink was solved against the six face
    colours before it was chosen (the ΔLab > 28 rule): the tiger is burnt
    umber because real tiger orange would swallow the orange face, the
    tennis ball is olive because optic yellow would swallow the yellow
    one, and the baseball's stitches are wine-dark for the same reason.
    Every pattern was rendered and looked at before shipping; the cow
    started as one blob, the camouflage as another, the basketball's
    seams met in an ellipse and three of the soccer ball's corner panels
    were missing — none of which the code showed.

## v1.49.0 — 2026-08-26 · requested by David

### Changed
- **The four game modes have drawn icons now**, in place of ⚔️ 🔁 🤼 🎯.
  They show up on the mode picker and on the How to Play page.
  - Each one draws its RULE rather than a mood, because that is what you
    are choosing between: Color Rush is two dice landing on the SAME
    colour, Ultimate is an arrow turning back on itself with a prisoner
    being sent in, Skirmish is two sides reaching for the ONE prisoner
    between them, and Color War is a field split down the middle with a
    colour each. 🤼 — two people wrestling — said nothing at all about a
    shared jail.
  - The four are deliberately different KINDS of picture: a pair, a ring,
    two arrows meeting, a divided box. That is the lesson from the Cups
    tab, where a trophy and a medal both came out as "round outlined
    thing" at menu size and had to be redone twice.
  - **The selected mode's chip is gold, and that decided one colour.**
    Yellow is 1.14:1 against it and the same hue, so a yellow prisoner in
    the Skirmish icon would have read as a hole punched in the chip at
    the exact moment the icon matters most. It is purple instead. Blue is
    out of all four for a different reason: the ink outline reads 2.25:1
    on it and the drawing dissolves into its own fill.
  - The `emoji` field is deleted from the mode definitions rather than
    left unused, so nothing can quietly start rendering one again.

## v1.48.0 — 2026-08-26 · reported by David

### Fixed
- **Opening a battlefield no longer flashes the last one you looked at.**
  David: "the arena preview doesn't load fast enough when you click on an
  arena, you can still see the previous arena you clicked on for a split
  second."
  - It was not a loading problem, which matters — making the arena
    cheaper would not have fixed it. The board **stops rendering
    entirely** while a menu is open, deliberately, because a phone should
    not run a 3D scene nobody can see. A screen that has stopped
    rendering keeps showing its last picture. So opening a preview
    uncovered a board still holding the arena you looked at before.
  - The board is now covered until it has genuinely drawn the new place —
    counted in real frames, not guessed at with a timer — and the cover
    is that arena's own sky, so it reads as walking out into it rather
    than as a panel being taken away.
  - **It was also doing far more work than it needed to.** Looking at a
    different battlefield was rebuilding the entire physics world and both
    dice from scratch, for a change that is only scenery. It does not any
    more, which makes the swap quicker as well as invisible.

## v1.47.0 — 2026-08-26 · requested by David

### Changed
- **The battlefields in Items are drawn pictures now, not emoji.** They
  were 🏰 🌅 🌴 🚀 — the last four emoji left in the game after the Paper
  & Ink pass took them out of everywhere else — and they failed in two
  ways at once. 🏰 and 🌅 are the *same building* in this game, so the
  Castle and the Sunset Castle told you nothing about which was which;
  and an emoji is drawn differently on every phone, so the menu could not
  be sure what its own battlefields looked like.
  - Each one is a little scene of the place it opens: the castle under a
    blue sky with its coral roofs, the same castle at dusk with a low sun
    and long shadows, the jungle clearing with its palm and its pool, and
    the space station with a ringed planet and a moon.
  - **Every colour is lifted from the arena itself**, not invented. The
    roofs are the roofs' colour, the jungle water is the jungle's water,
    the neon on the station is the station's neon. A test fails if those
    ever drift apart from the game.
  - **The two castles are the hard part**, and this project has been
    caught by it before — the Sunset Castle was once reported as not
    looking any different from the regular one. They share a building, so
    the difference is carried by what actually differs when you stand in
    them: a low huge sun instead of a high small one, warm masonry, lit
    windows, and long shadows thrown toward you. Measured rather than
    eyeballed — a test compares every pair and the two castles come out
    well clear of the bar.
  - The first jungle had to be redrawn: its palm fronds were flat
    four-sided shapes and the tree read as a windmill at the size the
    menu actually draws it. They are leaf-shaped now, with a spine and
    notched edges.

## v1.46.0 — 2026-08-26

### Fixed
- **The News tab had fallen four versions behind the game.** v1.42 to
  v1.45 all shipped without a word in it, so anyone opening News saw
  nothing about the see-through result screen or the new How to Play
  demonstration — the two changes they are most likely to notice. There
  is a post covering both now.
  - This is exactly what the "news keeps up with what has shipped" test
    exists for, and it did its job: it allows the News tab to run up to
    three minor versions behind and failed the moment the fourth landed.
    The tab had gone eighteen releases stale once before, which is why
    the rule is there at all.

## v1.45.0 — 2026-08-26 · requested by David

### Changed
- **A real finger flicks the dice in How to Play now**, instead of the
  drawn cartoon hand. David asked for it, and he was right that a finger
  is the better object anyway: what you see of your own hand on the glass
  IS a fingertip, and a whole hand at that size was mostly knuckles
  taking up the arena.
  - It is rendered rather than drawn, and everything that makes it look
    real is shading: the finger is lit as a cylinder with the highlight
    off the centre line, the tip is flushed redder the way a pressed
    fingertip is, the nail has a pale half-moon at its base and one bright
    streak across it, and there is a soft shadow beneath so it sits ON the
    glass. Most importantly it has **no outline at all** — a black keyline
    is the one thing that makes anything look drawn.
  - Two faults found by looking at it rather than at the code: the tip
    came to a **pencil point** instead of a rounded dome, and the base
    ended in a **hard horizontal cut** across the middle of the arena.
    The tip is a proper dome now and the finger fades out as it recedes,
    so it reaches in from off the edge rather than stopping in mid-air.
  - It also flicked clean over the jail and out of the arena at first.
    Fixed by tuning against the rendered frames — the numbers that look
    right on paper are not the ones that look right on screen, because
    the fingertip is a long way from the point the animation actually
    moves.
  - The picture is 39 kB. It was 81 kB until it was sized for the screen
    it is drawn on rather than for the maths that made it, which matters
    when it is an over-the-air update the family downloads on a phone.

## v1.44.0 — 2026-08-26 · requested by David

### Fixed
- **The How to Play demo now looks like the actual game.** David saw the
  first version and said it "doesn't look like a mini arena and does not
  look anything like a hand". Both were fair.
  - It played out on a **blank cream rectangle**. It is a real mini
    battlefield now — green grass, the stone tray with battlements along
    its walls, the tiled floor, the four red corner towers, and the
    barred jail across the top with the six prisoners standing behind it.
    The colours are sampled out of a real screenshot of the game rather
    than picked, so the demo cannot quietly disagree with the thing it is
    demonstrating.
  - The **hand was a grey circle on a stick**. It is a proper drawn hand
    now — palm, curled fingers, thumb, one finger pointing. It had to
    become an image to do that: a hand is curves and overlapping masses,
    which the rounded rectangles everything else is drawn from cannot
    make. Images ship over the air the same as the code, so this still
    reaches phones without a new build.
  - **The dice were solid blocks of colour**, which is not something a
    player ever sees. A die in this game is white with a big coloured
    spot, and now so are these.
  - Two more, found by rendering it out again: the dice began the throw
    sitting **on top of the wall, out on the grass**, and the freed
    prisoner **floated up and perched on the bars** instead of simply
    leaving. Everything happens inside the tray now, and the empty slot
    in the jail is what tells you somebody got out.
  - The lesson, written down because it has now cost two attempts: the
    first version WAS rendered and checked — but only for whether the
    timeline made sense, never against what the game actually looks like.
    A demo of the game is wrong if it does not resemble the game, and
    that is not something the code can tell you.

## v1.43.0 — 2026-08-26 · requested by David

### Added
- **"Throw the dice" in How to Play is a moving demonstration now.** A
  hand comes in, presses, flicks up the screen; two dice fly off the way
  it flicked, tumbling through the colours; they land square, both on
  blue; and the blue prisoner lifts out of the jail and is gone. Then it
  loops. David asked for "a little video showing real game play with a
  hand on the screen flicking the dice", and this is that — drawn rather
  than filmed.
  - **Why not a real recording.** Nothing here can record a phone, so the
    footage would have to come off David's handset every time the game
    changed. Playing a video also needs a native video player, which
    means a new build — and builds are exactly what is stuck — so a real
    video could not have shipped at all right now. A recording would also
    go stale silently, still showing old dice and an old jail long after
    they changed, with nothing to say so.
  - It reads the game's real six colours, and it wears the colourblind
    shapes when that setting is on, so it cannot end up teaching a game
    the player is not going to see.
  - It holds still, on the finished frame, for anyone who has asked their
    phone to reduce motion.
  - The page it replaces was three emoji in a row — 👆 💨 🎲 — which is the
    one thing the whole Paper & Ink pass set out to get rid of.
  - Two things were caught by drawing the frames out and looking at them
    rather than by reading the code: the dice appeared on the table
    before the hand had touched it, and the right-hand die came to rest
    tilted at 220°, sitting there as a diamond. That second one mattered
    more than it looks — the game itself refuses to end a roll until the
    dice have landed flat, so the tutorial was demonstrating the opposite
    of the rule it teaches.

## v1.42.0 — 2026-08-25 · requested by David

### Changed
- **The screen after a game is see-through now.** David: "make the screen
  after each game transparent, it should only be solid on the Home
  Screen." That is the right split — the home screen is a page you are
  ON, and the result screen is a note laid over the battle you just
  played, so hiding the final board behind solid paper threw away the
  thing you actually want to look at. The home screen stays solid, which
  is what it was changed to on 24 August and for the same reason.
  - The wash is 62% paper, solved rather than picked. The Space arena is
    the one that decides it: its sky is nearly black, so text there has
    far less to work with than on the blue, dusk or jungle boards. Below
    about 55% the small "next unlock" line stops being readable there.
  - The result screen's body text is full ink rather than the softer grey
    used elsewhere. That grey is ink at 70%, so on a see-through panel it
    fades twice over and lands at 3.7:1 on Space — under the readable
    bar. Full ink measures 6.4:1 on the same board.
- **No more names in the News tab.** It read "AJ spotted that..." and
  thanked him by name. The News tab ships inside the app to everyone who
  installs it, so that was publishing a child's name on the App Store.
  Bug reporters are thanked without being named, and a test now fails on
  any family name in a post.

## v1.41.0 — 2026-08-25 · requested by David (a crash he reported)

### Fixed — spamming, properly this time
- **The dice now have to actually land before their colour counts.**
  David reported this twice: "you're able to just spam as fast as you can
  and get every color in only a matter of seconds", and then, after the
  first fix, "you're still able to just spam and get the dice. They
  should have to fully land for it to count as getting the color."
  - The first fix put a 650ms floor under a spammed roll. It was not
    enough, and this project's own test suite had said so in one line the
    whole time: spammed rolls measured **median 650ms and p95 650ms** —
    the same number on every single roll, which is what a clock looks
    like, not what dice look like. The floor was not a floor, it was the
    duration. Dice that need about 1500ms to come to rest were being read
    at 650ms and turned onto a face in mid-air.
  - So the shortcut is gone rather than tightened. A roll ends when the
    dice are asleep or have measured still for several frames, and there
    is no longer any way for tapping to end one — the settle rule is not
    told whether the player tapped at all. A number can be tuned back
    down by anyone who finds the game slow; a missing argument cannot.
  - Spamming Classic now takes about **134 seconds** rather than 60, and
    it is the dice setting that pace instead of a thumb.
  - **Tapping early still gets you out faster.** That was never the roll's
    job: a tap during a roll is remembered and the next throw goes out
    34ms after the dice land instead of 130ms.
- **A die that stopped leaning on an obstacle could show one colour and
  count another.** Found while checking the above, and it had been hidden
  by the bug: the old code turned every die square, including ones in
  mid-air, so nothing downstream could tell the difference. With that
  removed, 720 test rolls turned up a die sitting **dead still at 54
  degrees** off flat on Hard. It is turned square now before the result
  is shown — which never changes which colour is counted, only whether
  you can see it.

### Changed
- **The Cups icon is black and white now**, at David's request. Its
  champion was a gold dot, which made it the only diagram on the bar
  pretending to be an object — the bag is leather and the crate is wood
  because those are things, and a knockout bracket is a drawing of a
  fixture list. It was also a third gold spot on a screen that already
  has the coin and the trophy. The dot came down from 0.24 of the box to
  0.21 in the same change: a ring's weight is its outline, so a solid
  disc of the same diameter read a step heavier and turned into a blob
  on the end of the line at the 21pt the bar actually draws it. Checked
  by rendering it at that size rather than by reading the numbers.

### Fixed
- **The game crashed on launch after the last update, and it was my
  mistake.** v1.40.0 went out over the air to a binary built before the
  advertising code existed. Ads are native — they have to be compiled
  into the app — so the phone ran JavaScript asking for something that
  was not in it, and died on the red error screen before the menu drew.
  - The update has been rolled back. Force-close the app and reopen it
    twice and it comes back on the last good version.
  - There WAS a guard for this, and it did not work. The code politely
    asked for the ad module inside a "if this fails, carry on" wrapper.
    React Native's own module loader catches that failure first, treats
    it as fatal, and never hands it back for the wrapper to ignore. So
    the protection was real in the source and absent on the phone.
  - The tests could never have caught it: they run in plain node, where
    a missing module throws an ordinary error that IS catchable. Only
    Metro, on a device, behaves differently. That is now written down in
    AGENTS.md so the next person does not trust the same pattern.

### Ads are switched off for now, so everything else can go out
- **The advertising code is out of the update, and ads wait for the next
  App Store build.** Pinning the app's native version was the correct fix
  for the crash, but it had a cost nobody would have chosen: it meant
  NOTHING could reach the family's phones until a new build existed, and
  that build is stuck on a signing problem. Five versions of work —
  including the dice fix above — would have sat on a shelf.
  - So the ad code is behind a single switch, `src/game/adSdk.ts`, which
    is currently off. With it off the advertising library is not in the
    update at all, which is checked by building the bundle and searching
    it rather than by reasoning about it: zero occurrences.
  - Turning ads back on is two lines that must move together — restore
    the switch, and pin the native version again — and a test now fails
    if only one of them is done. That pairing is the thing that was
    missing when the app crashed.
  - Nothing about the ad rules changed: still one interstitial after
    every third finished game, still tagged as a child's request, still
    G-rated only. It is a delivery decision, not a policy one.

## v1.40.0 — 2026-08-25 · requested by David

### Added
- **A light, a dark and a tinted app icon**, so the iPhone Customize
  screen has all three instead of iOS inventing the missing ones by
  machine. All three are the Paper & Ink drawing David picked: two dice
  showing the same colour, on cream, with the six colours beneath.
  - There was an oddity worth recording: the OLD icon was already the
    dark one — a purple gradient left from before the game was redrawn —
    so it was the light version that had been missing all along, and the
    app it opened was cream.
  - Each variant is built differently on purpose, because Expo treats
    them differently: light is opaque and carries its own paper ground,
    dark is TRANSPARENT so iOS supplies the backdrop rather than doubling
    it, and tinted is greyscale on a light ground.
- **The Android icon matches now too.** It was still the old artwork on
  a pale blue ground, so the two platforms were shipping visibly
  different icons.
- The layers Apple's Icon Composer needs are kept in `assets/icon/layers`
  with a note on how to build the Liquid Glass version. A flat PNG cannot
  have Liquid Glass — the depth is rendered from layered artwork in a
  `.icon` bundle, and those are made in Icon Composer on a Mac.

### Fixed
- **Opening the app flashed white before anything else.** The native
  splash screen — the one iOS shows before a single line of the game has
  run — had no configuration at all, and `expo-splash-screen` was not
  even installed. So launching went white, then the near-black title
  card, then the cream game: two jarring jumps, and nobody chose the
  first one. The splash is now the same ink as the title card, carrying
  the Paper Ship mark, so the launch has one deliberate transition
  instead of two accidental ones.
- The splash also stops pointing at Expo's stock placeholder artwork —
  the grid-and-circles image every new project ships with, which was
  never replaced.

### Under the hood
- Two tests hold the native splash to the same colour as the title card
  and off the placeholder art, so the two cannot drift apart again.
- This is native configuration, so it arrives with the next build rather
  than over the air.


## v1.39.0 — 2026-08-24 · requested by David

### Changed
- **The Cups tab is a bracket now.** David said twice that Cups and the
  trophy count still looked identical, and he was right twice — because
  this was the first time either was actually RENDERED at the 21pt it is
  used at. A trophy and a medal are both "round object, outlined,
  centred" at that size, and both came out as a dark ink lozenge with a
  gold speck in it. So Cups is no longer another award: it is two
  contenders feeding into one line with a champion at the end — wide
  where a cup is tall, lines where a cup is a mass.
- **The trophy is a trophy again.** It was outlined in ink on every part
  and filled only in the bowl, which is why it read as a blob. The cup,
  stem and foot are all gold under one thin outline now.
- **Timber looks like wood.** Its rings came from a single sine, so they
  were all the same width and evenly spaced — a striped jumper. Ring
  spacing now varies across the face the way a real board's does, each
  ring is soft on one side and sharp on the other, and there is a knot
  with the grain bending round it.
- **Marble looks like stone.** Its veins were evenly spaced parallel
  curves and read as a contour map. They are now a fracture network that
  forks and wanders, running with the stone's bedding, and each vein
  swells and thins along its length instead of being one weight.

### Under the hood
- Both painters, and the icons, were rendered to an image and looked at
  before being changed. The icon was wrong twice for exactly the want of
  that.
- The die's shell texture clamps to the edge of each face instead of
  repeat-wrapping. A cube's faces show it once and never tile it, so
  repeat was bleeding the far edge of the pattern into every rim.
- A first attempt at guarding this asserted every pattern tiles, which
  three other skins failed — on a wrong premise, since nothing tiles
  them. Replaced rather than satisfied.


## v1.38.0 — 2026-08-24 · requested by David

### Fixed
- **You could swipe as fast as your thumb moved and free every colour in
  seconds.** David found it; it was mine, from v1.29.0. Rolling again
  without waiting was built so that a new swipe called the previous roll
  immediately — and "immediately" turned out to mean the very next frame.
  The test suite has been printing "hurried median 17ms" ever since,
  because it only ever checked that hurrying was FASTER than waiting, not
  that a roll still took long enough to be a roll. So one swipe both
  ended a roll and started the next, and the number of scoring rolls per
  second was set by how fast a person can tap.
- Dice must now genuinely roll for 650ms before a result can be read off
  them. Spamming a Classic game to a win takes about a minute instead of
  about three seconds.
- **Rolling again is still fast.** 650ms is well under the ~1450ms a roll
  takes to stop on its own, and a swipe inside that window is not thrown
  away — it is remembered and fires the instant the roll lands, exactly
  as before. Nothing about the dead-input feel David asked twice to be
  rid of has come back.

### Under the hood
- The floor applies to every path, not just the hurried one, so a
  feather-light tap that happened to settle in 200ms cannot become the
  new way to spam.
- The hurried-roll test is two-sided now. Three new tests state the bug
  in David's own terms — how many seconds it takes to clear the board by
  spamming — so the next regression is caught by the symptom rather than
  by the internals that happened to cause it this time.
- Two new tests run the ad code with no ad SDK present, which is the real
  shape of the builds already on the family's phones, proving it stays
  silent rather than only asserting it was written to.


## v1.37.0 — 2026-08-24 · requested by David

### Changed
- **The Cups tab is a medal now, not a trophy.** It was the same drawing
  as the trophy count, so one picture was answering two questions — a
  trophy on screen could mean "your trophies" or "go to Cups", and there
  was no way to tell which. A medal on a ribbon is the furthest thing
  from a cup that still means you won something, and the two silhouettes
  cannot be confused at tab size. Its face is a ring rather than the
  coin's sparkle, so it does not collide with the coin either.
- **The icons are coloured.** A leather Store bag, a wooden crate, a
  steel gear, a blue How-to-play, a white newspaper with a colour
  headline, and Ranks bars in bronze, silver and gold by height — which
  is what a ranking actually is. Every one keeps its ink outline, so
  they stay drawings rather than becoming flat blobs.
- **The Battle die shows the game's own colours.** Its three pips are
  real prisoner colours read from the palette itself, not copies, so the
  tab that starts a battle says what the game is about and cannot drift
  from what the dice show.
- The tab bar no longer tints its icons grey when unselected — the gold
  pill and the label weight already say which tab you are on, and the
  icons stay themselves.

### Under the hood
- Colours live in one new `ICON` block in the theme rather than being
  scattered through the drawings.
- The first blue chosen for How-to-play left the ink outline at 2.77:1
  against it and the mark unreadable; it was solved for rather than
  nudged, and eight new tests hold every fill to 3:1 for its outline and
  4.5:1 for anything reversed out of it.


## v1.36.0 — 2026-08-24 · requested by David

### Added
- **Advertising, for the 1.0 App Store release.** David asked for ads
  from launch rather than a later update, and accepted delaying the
  release to get them. One interstitial after every third finished
  game — no banners, no rewarded video, nothing mid-round.
  - Counted at the end of a game but shown on the way OUT of the result
    screen, so an ad can never land on top of the victory fanfare or an
    unlock reward.
  - Quitting a battle early does not count toward an ad, and a brand-new
    player gets three clean games before the first one.
  - An ad that has not loaded is skipped, never waited for.
- Every request is child-directed, non-personalised and capped at
  G-rated creative. The game asks for no tracking permission and touches
  no advertising identifier — which is what makes the App Store privacy
  answers true rather than merely filed.
- EU users get Google's own consent form before any ad is requested, and
  a consent failure means no ads at all rather than ads anyway.
- The real AdMob interstitial unit is configured, so this build serves
  live ads rather than Google's test ones.

### Under the hood
- `src/game/ads.ts` is the only file that touches the ad SDK, the way
  `gameCenter.ts` is for Game Center — so swapping networks, or removing
  ads, stays a one-file job.
- The SDK is required lazily rather than imported. Ads are native code
  but JavaScript ships over the air to binaries built before the SDK
  existed; a top-level import would crash every one of those installs.
  13 new tests cover the interval, the child-directed flags, and that
  nothing else in the game imports the SDK.


## v1.35.0 — 2026-08-24 · requested by David

### Changed
- **The golden trophy now sits beside the Trophies count on the Ranks
  screen**, matching the coin that already sits beside the Coins count
  two cards over.


## v1.34.0 — 2026-08-24 · requested by David

### Changed
- **The trophy symbol is golden.** The drawn trophy that counts your
  trophies — in the HUD, the Inventory, the ladder prices and the Cups
  tab — was a plain ink outline; its cup is now filled gold under the
  same outline, so the game's prize looks like one.
- **The coin looks like a struck coin.** The drawn coin gained a milled
  inset ring and an embossed sparkle stamped in its face, on top of the
  raised rim and highlight it already had — a coin now, not a gold dot.


## v1.33.0 — 2026-08-24 · requested by David

### Changed
- **The home screen background is solid now.** The new paper look shipped
  with the 3D board ghosting through a translucent wash behind the home
  and round-over screens; David asked for solid. They are full paper
  pages now — the board appears only during a round and in item
  previews.
- Because nothing shows it any more, the 3D scene also stops rendering
  behind those screens instead of burning battery invisibly, the same
  rule the menu pages have always had.


## v1.32.0 — 2026-08-24 · requested by David

### Changed
- **The whole interface is redrawn in "Paper & Ink".** David picked the
  direction from mockups (light mode only, no dark mode): white cards
  with clean ink outlines and hard offset shadows on a warm paper table,
  in place of the dark purple glass the game launched with. Every screen
  is converted — home, Store, Items, Cups, Ranks, News, Settings, the
  tutorial, the battle scoreboard and callouts, the round-over screens,
  the reward popup, the opponent-finding screen, the item preview and the
  2-player split screen.
- **The emoji icons are gone.** The tab bar's 🛒 🎒 ⚔️ 🏆 🏅, the top
  buttons and the price tags are now drawn icons, so navigation looks the
  same on every phone and stops reading as a 2010 game. Emoji stay only
  where they are content: arena and cup pictures, ladder tiers, tutorial
  art and news posts.
- **Everything readable was measured, not eyeballed.** All text on the new
  paper surfaces holds at least the 4.5:1 WCAG contrast floor — including
  the two grey ink tones, which were re-derived against the darkest paper
  they sit on rather than against white.
- The title card on launch stays ink-dark on purpose: it is the one brand
  moment, and the paper-ship mark is the light-on-dark variant.
- The colours of the game itself — the six prisoner colours, the dice
  faces, the battlefields — are untouched. This is a new outfit, not a
  new game.


## v1.31.0 — 2026-08-24 · requested by AJ (bug board)

### Fixed
- **In Ultimate, two soldiers could end up standing on the same spot.**
  Rescued figures line up along the bottom of the board, and each new
  rescue stood at position "number already rescued". Ultimate is the one
  mode where a figure can LEAVE that line — matching a rescued color sends
  it back to jail — and after that the line had a gap, the count pointed
  at a spot someone was already standing on, and the next rescue landed on
  top of them. A rescue now takes the first empty spot, so the gap gets
  filled and nobody shares. Fixed in single player and in 2-player split
  screen, which had the same flaw.

## v1.30.0 — 2026-08-24 · requested by David

### Fixed
- **The News tab was eighteen releases out of date.** Its newest post was
  v1.11.0, from 19 August, while the game was on v1.29.0 — so it was
  quietly telling players nothing had changed in five days, during which
  the game changed more than in the fortnight before. Ten catch-up posts
  written: the dice materials, the snowflakes, the tutorial, rolling again
  without waiting, the rebuilt battlefields, the themed hazards, and Game
  Center on its way.

### Added
- **News can now be written on the HQ board and appears in the game.**
  A new page at `/admin/news`: write a post, tick "Show in the game", and
  it is there the next time anyone opens the tab. No release needed.
- The bundled posts are the FLOOR, not the ceiling. The tab opens
  instantly on the posts the app shipped with — no spinner, no empty state
  — and fills in from the board afterwards. Offline, on a plane, on a
  fresh install, or if the site is down, a player sees the news the game
  came with and cannot tell anything was attempted.
- A fetched post replaces a bundled one with the same id, which is what
  makes a correction possible: fix the wording on the board and the fixed
  version reaches players without shipping anything.
- The last feed successfully read is kept on the device, so a cold start
  with no network still shows what the board said yesterday.

### Under the hood
- **No key of any kind is in the app.** The game reads a plain public URL
  on the website, and the website holds the database credentials. A token
  shipped inside an app is not a token — it is a string anybody can pull
  out of the binary. Drafts are filtered out server-side for the same
  reason: an unpublished post is not reachable by guessing a query string.
- Every failure path was written as a test first: no network, a 500, a
  reply that is not JSON, JSON of the wrong shape, an empty feed, and a
  single malformed post among good ones. That last one costs only itself.
  `fetchNews` never rejects — the screen calls it without a catch, and an
  unhandled rejection inside a popup is a red screen on a device.
- A test now checks the News tab has not fallen more than three minor
  versions behind the game, so this cannot silently happen again.
- Posts are ordered by the board's own order, then the bundle. Deliberately
  not sorted by date: the dates are free text so they read properly on
  every phone, and parsing them back to sort would invent a contract the
  person writing them never agreed to.

## v1.29.0 — 2026-08-24 · requested by David

### Changed
- **The hazards belong to their battlefield now.** Both were drawn
  identically everywhere: a green grassy sphere, and a blue pool inside a
  square of cut kerbstone. That is a castle lawn and a castle moat, and it
  was being placed in a rainforest and on an orbiting station alike — a
  grass hill on a space station, as David put it. They are the most
  looked-at things on the board after the dice, because they are what you
  are trying to roll around, so drawing them the same everywhere undid a
  good deal of the work of making the arenas different.
  - **Jungle** — a lake rather than a swimming pool. The giveaway was the
    square of cut stone running round the water; nothing in a rainforest
    has that. A low soft bank of earth instead, and the water is the
    green-brown of standing water under a canopy. The bump is a mossy
    hillock.
  - **Space Station** — no grass and no water anywhere. The bump is a
    metal bulkhead dome in the deck plating, and the pit is an open hatch
    onto the drop with a lit warning strip round it.
  - **Sunset Castle** — the same castle later in the day: grass gone
    blue-green as the light leaves it, water picking up the sky instead of
    staying noon-blue.
- **The words follow the picture.** The Hard hint and the splash callout
  said "pond" on every battlefield. They now name what is actually there —
  and on the station a die does not sink at all, it falls out: "Gone! A die
  fell through the hatch!"

### Under the hood
- The PHYSICS is untouched. Same sphere in the same place, same square
  hole in the floor, on every battlefield — Hard is Hard wherever you play
  it. A test enforces that the dressing carries no dimensions at all, only
  colours and finishes, because a hazard that behaved differently by arena
  would make choosing a battlefield a way of secretly choosing a
  difficulty. The Store sells battlefields.
- The splash callout reads the arena from a ref. It fires from a callback
  created on the first render, so reading the value directly would have
  announced every lake as the castle's pond.

## v1.28.0 — 2026-08-24 · requested by David

David sent a screenshot, which changed the diagnosis completely. Three
rounds of tuning the jungle had been spent on parts of it the camera
cannot see.

### Fixed
- **The boundary is logs lying DOWN now, not standing up.** The camera
  looks down at the arena, so an upright post presents its top and almost
  nothing else — eighty-eight of them read as a ring of sawn tree stumps,
  which is exactly what the screenshot showed. Heights, lean, overlap,
  timber shades: every property tuned over the last two releases was on
  the side of the log nobody can see from up there. It is a log-cabin wall
  now — four courses of long rails stacked along each run, with a stout
  post at each corner — because what a horizontal log shows a camera above
  is its LENGTH.
- **The bright green frame around the arena is gone.** The clearing was
  drawn with a green tint multiplied over an already-green texture, so it
  came out far more saturated than the tray floor beside it and the two
  met in a hard band. Same pixels, same colour, no seam.
- **The dark smudges are gone.** The worn-earth patches reached full
  brown against green, which on a screen reads as stains rather than as
  ground wearing thin. Rarer, softer, and capped at half strength, so a
  patch is always still recognisably the ground it is part of.

### Fixed — the arena preview lag
- **Switching battlefields showed you the previous one for a moment.** Every
  procedural texture is painted pixel by pixel in JavaScript, because React
  Native has no canvas — and the jungle floor alone takes 65 to 120ms on a
  desktop, several hundred on a phone. Each arena built its own inside
  `useMemo`, which caches only for the life of one component instance: every
  switch blocked the JavaScript thread long enough for the old frame to sit
  there, and returning to an arena already viewed paid the whole cost again.
- They are cached at module level now, built once per app run. Measured in
  the suite: **75ms to paint, 0.08ms for the next twenty**. The first view
  of an arena pays once; every view after it is free.
- The jungle asks for two textures from the same painting (the tray floor
  and the clearing, at different repeats), so the painted bytes are cached
  as well as the textures.

### Under the hood
- A test now checks each log actually points the way it is meant to. A
  cylinder's axis is +Y, so a rail has to be turned onto its side, and the
  Euler order that does it is easy to get wrong in a way that lays rails
  across the middle of the arena — nothing else here looked at rotation at
  all. It fails when the rotation is swapped.
- Four more guards on the new boundary: most of it lies down and exactly
  four posts stand, the courses stack without daylight, every rail reaches
  its corner posts, and the timber stands proud of the wall the dice
  actually bounce off.

## v1.27.0 — 2026-08-24 · requested by David

### Fixed
- **The jungle is green again.** The forest floor shipped in v1.25.0 had it
  backwards: brown earth everywhere, moss in patches, and leaf litter
  scattered thickly over the lot. David's word for it was garbage dump, and
  he was right — a rainforest clearing is overwhelmingly green, and a floor
  that is mostly dirt and debris reads as mud with rubbish on it at the
  size a phone draws it. Green ground is the base now, with bare earth
  showing through only where growth has worn thin, and about a fifth as
  many leaves, blended into the grass rather than stamped on top of it.
- **The arena border was being painted in stone.** The palisade logs were
  drawn with `MOSS_STONE` and `MOSS_STONE_DARK` — the two greens the temple
  ruins are built from — so eighty-eight posts of varying height stood
  around the arena in grey-green and never read as timber at all. They are
  wood now, five shades of it, picked per log.
- **And it was built like a heap rather than a wall.** Three things at
  once: heights ran from 0.86 to 1.36 of the wall, so the top edge was
  jagged; each post chose its lean independently, up to five degrees either
  way, so neighbours fell against each other; and the logs were narrower
  than half their spacing, so there was daylight between them. Now they
  overlap into a solid run, the whole rank leans together in a slow wave
  under two and a half degrees, and the tops vary by a quarter of the wall
  height instead of half. Every log also stands at least as tall as the
  invisible wall the dice bounce off — some used to be shorter, which made
  a die look like it had stopped against nothing.

### Under the hood
- The test guarding the palisade had only a LOWER bound on how much the
  tops vary, so "more ragged" always passed and the boundary drifted into a
  pile of sticks with the suite green. It is bounded at both ends now, and
  joined by four more: every log clears the wall, no two neighbours leave
  daylight, no post leans more than four degrees, and the logs are not
  painted with the temple's stone. All five fail on the old palisade.
- One of those tests was written wrong first and caught in the writing: it
  filed each log onto a wall by whichever coordinate was larger, which
  misfiles every log near a corner and silently compares posts on different
  walls. It keys off the coordinate pinned to the boundary instead.

## v1.26.0 — 2026-08-24 · requested by David

### Changed
- **Rolling again no longer waits at all.** This was asked for twice and
  the first version only half did it: a swipe mid-roll was remembered, but
  the roll was still not called until BOTH dice happened to be moving
  slowly and lying within about 20 degrees of flat. That wait is most of
  the wait. Median time from swiping to the roll being called has gone from
  **1483ms to 17ms** — one frame.
  - The wait existed for a real reason: reading a colour off a die balanced
    on an edge is picking one of two faces at random. That is solved now by
    SNAPPING the die onto the face it was already nearest instead of
    waiting for it to get there, so the colour counted is the colour shown.
  - A roll is still binding. It is counted, never cancelled — in Ultimate a
    matched colour sends a rescued prisoner back to jail, so a roll you can
    throw away mid-air is a rule you can opt out of. Hurrying reads the
    roll sooner; it cannot dodge it.
- **Frost is classic snowflakes.** The last attempt grew branches but still
  read as stars, and rendering it at ten times size showed exactly why: the
  one flake that happened to sit axis-aligned looked fine, and every
  rotated one had been shredded into disconnected stair-steps. A one-pixel
  arm cannot survive rotation on a 64-pixel grid when each pixel is either
  ink or not. The shape is supersampled now — sampled on a 4x4 grid inside
  every pixel — which holds the thin diagonal arms together. Six arms,
  three pairs of dendrites, a bar across each tip, a hexagonal heart.
- **The tab bar is gone after a game.** It was hidden for the battle and
  the countdown but left up over the victory, defeat and tie screens, so
  the tabs sat under a result and invited you into the Store from a match
  that had just finished. It is the home screen's bar now, and only the
  home screen's. Those screens keep their own PLAY AGAIN and HOME.

### Under the hood
- `isReadable` is deleted rather than left behind. It answered "has this
  die landed flat enough to read?", which is the question snapping makes
  moot, and a safety check that no longer guards anything is worse than no
  check at all.
- Two tests went with it and were replaced by the invariant that is now
  load-bearing: after a hurried call every die is lying flat, and snapping
  never changes which colour is up — checked over 400 orientations,
  including the awkward ones balanced on an edge and on a corner. If
  snapping could turn a die onto a different face, hurrying would be
  changing results rather than reading them sooner.
- One screen test matched an exact source line rather than behaviour and
  failed the moment the guard in front of the tab bar grew a second clause.
  It reads the guard now.

## v1.25.0 — 2026-08-24 · requested by David

### Changed
- **Frost is snowflakes now.** It was three needles crossed through a
  point — a six-armed asterisk, which is a star with nothing on it, and at
  a glance it read as a sparkle rather than as snow. A snowflake is
  six-fold symmetric with DENDRITES: shorter arms angled forward off each
  spine, longest near the middle and shortest near the tip. Those branches
  are the whole silhouette. Every flake gets its own size and its own spin
  so no two in view are the same one.
- **The jungle rolls on ground instead of on the castle's floor.** Jungle
  Clearing was using the castle's flagstone texture tinted green — laid
  slabs, grout and all. That is the surface the camera is centred on and
  the dice come to rest on, so of everything in the arena it was doing the
  most to make the jungle look like the castle repainted. It is a forest
  floor now: damp earth mottled at two scales, moss in patches with soft
  edges, and fallen leaves scattered where they fell, each one turned to
  its own angle with a darker midrib. The clearing around the tray gets it
  too — that was one flat green plane, 34 by 40, the biggest unbroken
  surface in the arena.

### Tutorial
- Slide 2 says **swipe** rather than flick. (The physics code still calls
  it a flick internally; this is the word a player reads.)
- Slide 3's heading is **"Match two colours to free a prisoner"**. It read
  "Two the same frees one", which needs you to already know what "two" and
  "one" refer to — on the page that teaches the only rule in the game.
- Slide 4 is **"It's a race"**.

### Under the hood
- The new floor is deterministic, unlike the flagstone it replaces, which
  used `Math.random` and so was different on every launch and could not be
  checked at all. It is measured instead: no row is dark enough to be a
  grout line, it meets itself no worse at the wrap than anywhere inside
  the tile, and it is identical between builds.
- The moss needed three octaves of noise. One octave is interpolated
  across an 8x8 grid, and the blend between cells leaves diamond and
  square corners on every patch — the moss came out looking like
  camouflage.
- Two frost tests were written that passed on nothing: they thresholded
  ink at a fixed brightness, and frost's shell is a very pale blue that
  fell on the ink side of it, so the whole texture counted as ink. The
  threshold comes from the painter's own tone range now. Both fail on the
  old asterisk.

## v1.24.0 — 2026-08-24 · requested by David

### Changed
- **Timber, Marble and Granite are smooth now.** All three picked their
  tone from a ladder of thresholds, so a whole 64x64 face was painted in
  five tones and every threshold crossing was a hard cliff — the blocky,
  staircased edges that made the wood read as corduroy and the marble as
  cut paper. They ramp between the same tones instead. Wood went from 5
  distinct tones to 63, marble 5 to 95, granite 7 to 69.
  - **Timber**: one continuous fade from pale early wood into the dark
    late-wood ring, and the fine grain fibres halved — at their old
    strength they chewed a ragged edge into every ring, which was most of
    what made the plank look coarse.
  - **Marble**: the vein and the halo it bleeds into the stone are one
    falloff rather than a sharp line inside a second hard band. That pair
    of edges was what made the veins look drawn on with a pen and a
    highlighter.
  - **Granite**: the flecks were jumping most of the full range per pixel,
    which at this size is television static rather than stone. They are a
    third of that now, over two smooth scales of mottling.
- **Silver is the silver version of Gold.** It was brushed — thousands of
  fine scratches running one way — deliberately a different SHAPE from
  gold so the two could never be one picture in two tints. David asked for
  them to match, so silver is a polished sweep of light now. It is still
  not gold repainted: silver is a harder, cooler mirror, so the bar of
  light is tighter and brighter and the catch off the far edge is
  stronger. Gold spreads its highlight; silver snaps it.

### Under the hood
- The rule that no two skins may share a pattern is deliberately overruled
  for these two, and the test that enforced it now says so. It still
  passes — they are separate painters with separate ids — but it passes on
  a technicality, and anyone tightening it to compare pixels needs to know
  gold and silver are meant to match.
- The granite test used to require 200 pixel-to-pixel jumps of more than
  25 tone, and granite obligingly produced 1258 of them. A guard written
  to protect one quality had quietly mandated the fault David was looking
  at. It now checks both ends: enough gentle flecks that granite is not
  fog, few enough harsh ones that it cannot go back to static.
- A new test counts how many distinct tones each material paints, which is
  the one number that separates a ramp from a staircase. It fails on the
  old painters.

## v1.23.0 — 2026-08-23 · requested by David

### Added
- **Game Center.** The Ranks page has had a "Not live yet" note on it since
  the beginning; it is live now. Trophies and battles won go onto two real
  leaderboards, ten achievements are reported as you earn them, and two
  buttons open Apple's own world-ranking and achievement screens. It uses
  the phone's Apple account, so there is still no login, no password and
  nothing personal stored by this game.
- The ten achievements: First Victory, Ten Battles, Fifty Battles, The Hard
  Way, Every Way to Play, one for each of the four arena unlocks (Sunset
  Castle, Jungle Clearing, Space Station, Midnight), and Collector for
  owning ten sets of dice. 500 points of Apple's 1000, leaving room for new
  achievements when new dice and arenas ship.

### Changed
- **Collector is ten sets, not every set.** It was going to be "own every
  set of dice", which quietly changes meaning every time a die is added —
  a moving finish line, worth less to whoever got there first. A fixed
  number means the same thing in five years. New dice get their own
  achievement out of the spare 500 points instead of stretching this one.
- **A save with a typed-in number stays off the shared board.** The trophy
  and coin codes set a count to whatever you type, which is right for
  looking at a locked arena on your own phone and wrong for a ranking that
  puts you above people who actually played. Such a save keeps every local
  reward, every unlock and every record, and simply does not post. Family
  tester mode does NOT count: it unlocks cosmetics and invents no number,
  so testing an arena never costs you your place.

### Under the hood
- Everything Game Center is told is a QUESTION ABOUT THE CURRENT SAVE
  ("does this player have ten sets?"), never an event ("a set was just
  bought"). Event-shaped reporting loses an achievement for good if the one
  moment it could fire happens offline; asking again after the next battle
  heals itself.
- A report is only remembered as sent once Apple has accepted it. Marking
  it at the point of sending looks equivalent and silently destroys the
  retry — a report lost to a dropped connection would be remembered as
  delivered and never tried again. That bug was written and then caught by
  a test that fails when it is reintroduced.
- Nothing outside `src/game/gameCenter.ts` imports the Game Center package,
  which still reports scores through `GKScore` — soft-deprecated by Apple
  in iOS 14. Replacing it is a one-file job.
- The achievement identifiers are checked in the test suite against the
  ones read back from Apple's own API. They are the one part of this that
  can never be fixed later: an identifier cannot be renamed or deleted once
  it has shipped, so a typo would be a dead achievement for the life of the
  app.
- The Game Center entitlement is set directly in `app.json` rather than
  through the package's config plugin, which Expo cannot resolve (no
  `app.plugin.js` at its root). All the plugin did was set that one key.

### Needs a new build
- This is the first change in a long while that an over-the-air update
  cannot deliver. Apple bakes entitlements into the binary, so Game Center
  does nothing until a new build reaches TestFlight. On the current build
  the code detects there is no Game Center and quietly does nothing.

## v1.22.0 — 2026-08-23 · requested by David

### Changed
- **The battlefields stop being the same building.** David said the themes
  all just looked like the castle in different colours, and he was right:
  every arena was four full-height box walls at the tray edge with a
  different ornament on top — merlons on one, light strips on another,
  cracked slabs on a third — and four round corner towers. The props
  differed (palms, solar panels, tiki parasols) but the SKYLINE did not,
  and a skyline is what you recognise a place by.
  - **Jungle Clearing** is now ringed by a log palisade driven into a low
    earth bank: 88 logs, every one a different height and lean, cut to a
    point, bound with vine lashings. The corners are buttress trees that
    flare into roots and carry a canopy well above the wall, instead of
    round towers with a cap.
  - **Space Station** is mostly open. The hull is knee-high now, and what
    stops the dice above it is a see-through containment field hung
    between emitter studs — so you look out across the deck rather than
    standing in a grey keep. The corner pylons are thin masts on small
    bases rather than towers.
- The physics boundary has not moved on either. The tray walls are the
  same invisible full-height boxes they always were; only what is drawn in
  front of them changed. The field panel spans the full height on purpose,
  so a die still visibly stops where it always did.
- The jungle's palisade lives in `src/arena/palisade.ts` as data rather
  than inside the component, so its shape can be measured. Nothing in this
  project can render a 3D scene to look at, which is exactly how a
  palisade could quietly become an even picket fence with every test still
  green. The suite now checks it has enough logs to be a palisade, that
  the tops are ragged rather than level, that some clear the wall the dice
  actually bounce off, and that it is identical between builds.

## v1.21.0 — 2026-08-23 · requested by David

### Added
- **How to play.** Six short pages: the six prisoners, how to throw, the
  one rule the whole game is built on (both dice the same frees that
  prisoner), that it is a race, the four modes, and what trophies and
  coins are for. It opens by itself the first time the game is ever
  launched, and after that it lives behind a ❓ next to the gear — because
  the person who most needs it is whoever gets handed the phone in six
  months.
- Each page has a picture, which for a game whose signal is COLOUR does
  more work than the words. If colourblind mode is on, those pictures wear
  the shapes too — teaching somebody the colours-only game when they have
  asked for shapes would be teaching a game they are not going to see.
- The words live in `src/game/tutorial.ts` rather than inside the screen,
  so the test suite can check them against the rules the game actually
  implements. A tutorial is the one part of a game that can be WRONG
  rather than broken: nothing crashes when it describes a rule that has
  changed, it just quietly misleads the one person who cannot tell. The
  suite now fails if a mode exists that the tutorial never mentions, if
  the matching rule stops being stated, or if the palette stops having six
  colours in it while a page says "six".
- Measured on an iPhone SE with the real layout engine: the page gets
  389pt and the Back / Let's play buttons keep their full height. A
  first-time player who could not reach the button that closes the
  tutorial would be stuck in it.

## v1.20.0 — 2026-08-23 · requested by David

### Added
- **Dice made of real materials.** Three new sets in the Store — Marble
  (500), Granite (550) and Silver (650) — and two existing sets rebuilt:
  - **Gold** was a flat yellow cube. It now has a sweep of light rolling
    across it like polished metal.
  - **Silver** is brushed rather than polished: thousands of fine
    scratches running one way, each catching the light differently.
  - **Marble** has veins that wander, each with the soft halo where the
    mineral bled into the stone — leaving that off is what makes marble
    look drawn on with a pen.
  - **Granite** is mottled rock under a scatter of quartz and mica flecks.
  - **Timber** has growth rings that bend and vary in spacing, instead of
    the even wavy bands it had, which read as a painted pattern.

### Changed
- Shell textures can now darken as well as tint. The dice are drawn unlit
  on purpose (two dice under real lights once rendered as different whites
  on a phone), so nothing on a shell gets a highlight or a shadow from the
  scene — it has to be painted in. Being able to go both ways from one ink
  colour is what lets gold have a bright band and the dark trough beside
  it. Every pattern written before this is untouched.
- Silver deliberately does not share gold's pattern. Two skins that are
  one picture in two tints is what made Frost and Starry indistinguishable,
  and the suite refuses it — so silver is a different SURFACE, not a
  different metal.

## v1.19.0 — 2026-08-23 · requested by David

### Changed
- **Tapping again while the dice are still rolling now speeds the roll up
  instead of just queueing behind it.** The moment both dice are down and
  lying flat, the roll is called and the next throw goes out — measured
  over 240 rolls per difficulty, tap-to-tap drops from about 1.5s to about
  1.25s, and the slow rolls (95th percentile) from 2.0s to 1.8s. The pause
  after a result is 60ms rather than 130ms when you have already tapped,
  because you have seen the result and are waiting.
- The roll is still binding. Hurrying it changes WHEN it is counted, never
  whether — a roll you could throw away mid-air would make Ultimate's
  "matching a rescued colour sends that prisoner back to jail" a rule you
  could opt out of by tapping.
- The safety is that a roll is only ever called early on dice that are
  down, slow, AND lying within about 20° of flat. A die balanced on an
  edge has two faces it could fall onto, and picking one would be a rigged
  roll rather than a fast one. Tested by throwing a die and checking it
  reads as unsettled one physics step in, while airborne.
- **"Moat" is now "pond"** in the splash message on Hard. The difficulty
  hint already said pond; this was the last place using the other word.

## v1.18.0 — 2026-08-23 · requested by David

### Changed
- **Coins are spent in the Store and nowhere else.** Previewing a Store
  die from your Inventory now says "In the Store for 300" and cannot be
  pressed, instead of quietly selling it to you. The Inventory is the
  cupboard: it should show what a die costs without putting a child one
  tap away from having spent 450 coins they meant to look at.
- Whether you can afford it is checked *after* where you are standing, not
  before — otherwise a rich player could buy from the cupboard and a poor
  one could not, which is the version of this bug that would have looked
  like it worked.
- **Buying closes the preview and shows the PURCHASED popup.** The button
  used to flip from "Buy for 300" to "Use this one" in place, so the
  biggest thing that happens in this game — spending coins you played for
  — passed with nothing to mark it. It gets the same moment as earning an
  unlock now, and the popup says to tap the die again to put it on.

## v1.17.1 — 2026-08-23 · requested by David

### Fixed
- **A preview now shows the item and nothing else.** The tab bar and the
  trophy and coin pills were already stepping aside for it, but the home
  screen itself was not — so the mode picker, the difficulty picker, the
  next-unlock line and the START button all stayed sitting across the very
  thing the preview existed to show. All of it goes away now; you get the
  battlefield, the item on it, its name, and the one button.
- The test for this asks the general question rather than listing the
  pieces that happened to be wrong: every part of the screen drawn on the
  home screen must be hidden during a preview. Adding a new control to the
  home screen and forgetting it now fails before it ships.

## v1.17.0 — 2026-08-21 · requested by David

### Changed
- **Every item opens as a preview now, and that is where you buy and equip
  it.** Tapping a card in the Store or the Inventory no longer changes
  anything — it puts that item out on the real battlefield at full size,
  with the buy or use button underneath. A 58pt thumbnail was never enough
  to choose from, and it was certainly not enough to tell Frost from
  Starry.
- The preview is not a picture of the game, it IS the game: the board is
  already on screen, so opening a preview steps the menu aside and swaps
  the previewed dice or battlefield into the scene you were already
  looking at. Nothing is drawn twice, so nothing can disagree with the
  table. Locked items open too — seeing the battlefield you are saving for
  is the reason a locked card is shown at all.
- The button says one of five things and only two of them can be pressed:
  use it, buy it, or how many coins or trophies you still need. Coins and
  trophies stay separate on purpose — one means keep saving, the other
  means keep playing, and telling a five-year-old the wrong one is worse
  than saying nothing.
- **New wording for the dice in the Store**, which used to talk only about
  how coins are earned and never about the dice themselves.
- **The colourblind setting keeps its shape icon when it is off.** It used
  to swap to a blank white square, which read as a second empty checkbox
  beside the real one — and a setting about shapes losing its shape is the
  one state where the icon has nothing to say.

### Fixed
- A dice skin that was locked again (after family tester mode went off)
  drew as ivory wearing the locked skin's pattern. The board took the
  shell colour from a resolver that falls back and the pattern straight
  from the stored id, which does not. One resolved skin now feeds both.

### Caught before release
Both of these were found by testing the preview rather than by playing it,
and neither would have been obvious until somebody hit it:
- **A tap on the see-through middle of a preview started a real battle.**
  The menu pages used to be opaque and swallowed every touch; a preview
  takes that away on purpose, and the throw gesture underneath had no idea
  a preview was open. It now refuses the touch outright, and a preview is
  closed by anything that moves the game off the home screen — otherwise
  its buy button would have stayed live on top of the match.
- **"3 more trophies to go" could not be read.** That button was a white
  wash over the live board with white text on it, which on the sunlit
  castle floor came out at 1.65:1. It is dark-backed now, like the title
  and the hint, and reads at better than 15:1 on every battlefield.

## v1.16.1 — 2026-08-21 · requested by David

### Fixed
- **Every price now shows the drawn gold coin.** The HUD had been drawing
  its own coin for a while — three circles, guaranteed gold — while every
  price tag in the Store and the Inventory still printed the coin emoji,
  which renders silver on some phones and a flat disc on others. The same
  currency wore two different faces one tab apart. Prices, Your Records and
  the Settings message all use the drawn one now, through a single
  `CoinLabel` so there is only one way to show coins.
- **The Inventory lists dice cheapest first.** It was reading the raw list
  in the order the dice were written down, and the Store prices were typed
  out of sequence — 250, 300, 450, 400, 350 — so a 450-coin die sat above a
  350-coin one. Trophy dice come first, cheapest up, then the coin dice,
  cheapest up. The Store already sorted its own shelf; the Inventory never
  did. The tests now pin both, and that every die is still listed exactly
  once after sorting.

## v1.16.0 — 2026-08-21 · requested by David

### Changed
- **MONEY is gone; the coin code is now "X COIN".** Type `500 COIN` and
  you have exactly 500 coins — the same way `500 TROPHY` sets the trophy
  count. The word can go either side of the number (`COIN 500` works too),
  and case and spacing do not matter.
- Setting rather than adding is the point: the old code only ever handed
  over another 10,000, so once you were rich there was no way back down to
  see how the Store looks to a player who is not. Now there is.
- Coins stop at 999,999 — past that the number stops fitting the pill in
  the corner. Anything you already bought stays bought, even if you set
  yourself to zero.

## v1.15.1 — 2026-08-21 · requested by David

### Fixed
- **The Settings rows no longer run to the edges of the panel.** They had
  no horizontal inset at all, so every slider, toggle and button pressed
  against the rounded border while the title sat neatly inside it. All of
  it now shares the title's inset, including the version line — which sits
  outside the scrolling area and so needed telling separately.
- Narrowing the sliders is safe because each reads its live width and
  screen position when it lays out, rather than assuming either, so the
  touch maths follows the new size. The test suite now asserts those two
  reads still exist: losing them is what would make this break quietly
  later rather than loudly now.

## v1.15.0 — 2026-08-20 · requested by David

### Changed
- **Settings and News have left the bottom bar.** They are two small icon
  buttons at the top right of the home screen now, level with the trophy
  and coin pills. Neither is somewhere you go during play, so neither was
  earning its place among the things you move between constantly.
- **The bar is five tabs**: Store, Items, Battle, Cups, Ranks — Battle dead
  centre. Five cells leave about 75pt each on a small phone where seven
  left 53, so the labels go back up to a readable size.
- **Settings and News open as popups over the game**, dimmed but still
  visible behind, so it is obvious you have not gone anywhere. Two ways
  out: the ✕, and tapping the dim.

### Fixed before release
Two bugs were caught by the test agent before this shipped, both flexbox
arithmetic that the typechecker and 247 existing tests all passed happily:
- **The Settings popup rendered its whole body at zero height** — every
  slider, the toggle, the code box and the Report a Bug button, gone. A
  `flex: 1` scrolling area means "grow into space my parent proves it
  has", and a panel capped by `maxHeight` with no height of its own can
  never prove any.
- **The News popup clipped its older entries** with no way to scroll to
  them, and would have quietly lost one more with every entry added.
- Notably this is the OPPOSITE of the right answer three releases ago,
  when the same two properties were swapped the other way. What changed is
  whether the parent's height is known.

### Added
- **A test suite that runs the real layout engine.** Everything else here
  reads the source as text, which is why neither bug above was caught —
  a regex can see that a style exists, never what it resolves to. The new
  suite builds the actual popup trees in Yoga (the same algorithm React
  Native ships) and asserts the scrolling area comes out with real height,
  in the same spirit as the physics suite running real cannon-es.

## v1.14.2 — 2026-08-20 · requested by David

### Changed
- **The scroll bar in Settings is hidden again.** It draws over the
  right-hand edge of whatever it passes, and on a page of sliders and
  toggles that means sitting on top of the controls.
- The rubber-band bounce stays, which is the part that actually tells you
  the page can move. It was the missing bounce, not the missing bar, that
  made this page feel like a dead end back in v1.13.5 — and the page no
  longer runs underneath the tab bar, so there is nothing hidden down
  there for an indicator to hint at.

## v1.14.1 — 2026-08-20 · requested by David

### Fixed
- **The bottom of Ranks, Items and Settings is reachable again.** The tab
  bar was drawn ON TOP of every page, which left each page responsible for
  remembering to pad around it. Store, Inventory and Leaderboard used a
  flat 24pt with no allowance at all, so the bar sat over the last stretch
  of those pages and you could not scroll past it.
- **The bar is now its own section of the screen.** Every menu page ends
  where the bar begins, rather than running underneath it and hoping. That
  turns "remember to leave room" into something that cannot go wrong: there
  is no room down there for a page to lose. A page's own bottom padding is
  breathing room again, not clearance.
- Settings, News and Cups had been padding by the bar's height themselves;
  that allowance is gone, since keeping it would now leave a dead strip the
  size of the bar at the bottom of each.

## v1.14.0 — 2026-08-20 · requested by David

All three of David's reports from a real iPhone 15 turned out to share one
cause: nothing in the app knew that modern iPhones reserve a strip at the
bottom of the screen for the home indicator — the bar you swipe up on.

### Fixed
- **The bottom row of tabs now fits.** It was drawn with a flat 18pt of
  padding against the 34pt an iPhone 15 needs, so the labels sat inside
  the home indicator strip. The bar reserves the real inset now, and each
  label holds one line regardless of the phone's text-size setting — seven
  cells across the narrowest iPhone is about 53pt each, and a player who
  has turned iOS text up should not be the one who breaks the row.
- **The version number in Settings is always visible.** It only appeared
  if you tapped the secret-code box: it was still inside the flex layout,
  the scrolling area was taking the space, and opening the keyboard
  squeezed the panel just enough to reveal it. It is now positioned
  absolutely, outside both the flex flow and the keyboard-avoiding view,
  anchored above the tab bar where nothing can move it.
- **A bug report can be abandoned without sending it.** The Cancel button
  existed but sat under the keyboard, because the box takes focus as the
  screen opens and the panel is centred. The panel lifts clear now, and
  tapping the dimmed area behind it closes it too. Taps inside the panel
  are ignored, so missing a button by a few points does not throw away
  what you typed.

### Fixed (found by the smoke test, not reported)
- **The Done button on Store, Inventory and Leaderboard never worked.**
  All three drew it underneath the tab bar, which is opaque and sits on
  top — so it was invisible, and a tap there hit whichever tab was over
  it. It has been removed rather than moved: the tab bar is the way out of
  these pages, as it already is on Settings and Cups. The unused `onClose`
  wiring went with it.
- The in-battle HUD's distance from the bottom edge was a hardcoded 34 —
  right on a Face ID iPhone only because that happens to be the inset, and
  34pt of wasted board on a phone with a home button. It is derived now.
- The report panel's keyboard lift is deterministic rather than settling
  over several layout passes; centring moved inside the keyboard-avoiding
  view, which is where it belongs when the view grows its own box.

## v1.13.5 — 2026-08-20 · requested by David

### Fixed
- **The Settings page now behaves like the scrolling page it is.** It has
  always scrolled, but two flags hid every sign of it: `bounces={false}`
  meant pulling at the page did nothing, and the scroll indicator was
  hidden, so there was no bar to say anything sat below the fold. A page
  taller than the phone read as a dead end — which is the real reason the
  version line at the bottom read as missing rather than as further down.
- Both cues are on now. The indicator fades away by itself when you stop,
  so it costs nothing at rest.

## v1.13.4 — 2026-08-20 · requested by David

### Fixed
- **The version number is back, and now actually visible.** v1.13.3 pinned
  it below the scrolling area, which was the right move but made it vanish
  outright.

  The cause was a flexbox default. `settingsScroll` carried
  `flexGrow: 1, flexShrink: 1` and no `flexBasis`, which leaves flexBasis
  at `auto` — and for a ScrollView, `auto` means it starts out as tall as
  ALL of its content, hundreds of points of sliders and sections. With
  nothing beneath it that never showed. The moment the version line became
  a sibling underneath, the scroll started from that enormous basis,
  claimed the whole panel, and pushed the line off the bottom.

  `flex: 1` sets flexBasis to 0, so the scroll takes only what is left
  after the pinned footer — which is the entire point of pinning one.
- A test now fails if that basis is ever lost again, verified by
  reintroducing the exact bug and watching it go red.

## v1.13.3 — 2026-08-20 · requested by David

### Fixed
- **The version number in Settings is now pinned in place**, below the
  scrolling area instead of inside it. v1.13.2 gave it more breathing room,
  which did not help: the real problem was that it was the last thing in a
  scrolling list, so it only appeared once you had scrolled all the way
  down — and `bounces={false}` gives no hint there is anything below the
  fold, so it read as cut off.
- As a fixed footer it is on screen at every phone height, rather than at
  whichever height it happened to be measured against. `flexShrink: 0`
  keeps a short screen from squeezing it away.

## v1.13.2 — 2026-08-20 · requested by David

### Fixed
- **The version number at the bottom of Settings was clipped.** The scroll
  area ended exactly where its last row did, so the final line sat flush
  against the edge — and `bounces={false}` meant you could not even drag it
  into view to see what was cut. There is room under it now.
- The padding sits on the scroll container rather than on the version line,
  so anything added below it later gets the same clearance instead of
  inheriting the same fault.

## v1.13.1 — 2026-08-20 · requested by David

### Fixed
- **The keyboard no longer covers the secret-code box.** Tapping it opened
  the keyboard straight over the thing you were typing into. The Settings
  page now shrinks by the keyboard's height and scrolls the box up into
  what is left, so you can see what you type.
- Two details that matter for it working on a real phone: the scroll waits
  for the keyboard to finish appearing rather than firing on tap — at tap
  time its height is not known yet, so the scroll lands short, and by a
  different amount depending on whether the autocorrect bar is showing. And
  the position is measured rather than assumed, so it keeps working if
  anything is ever added below the box.

## v1.13.0 — 2026-08-20 · requested by David

### Added
- **A new secret code: "500 TROPHY".** Any number followed by the word
  sets the trophy count to exactly that — `137 TROPHY` gives you 137. The
  word can go either side of the number, so `TROPHY 137` works too; a
  child typing a cheat code should not have to remember the order.
- It **sets** rather than adds, so it goes down as readily as up. Standing
  at a chosen rung of the ladder and seeing what is unlocked there is the
  point, and that needs both directions. Going down relocks things; the
  equipped dice and arena already fall back on their own when they are no
  longer owned.
- Crossing a tier shows the usual unlock popup, so the reward moment can be
  tested without grinding for it.
- Wins are deliberately left untouched. They are a record of what was
  actually played, and a cheat that rewrote history would make Your
  Records lie.
- Numbers past 99,999 are capped, and it says so rather than pretending.

## v1.12.2 — 2026-08-20 · requested by David

### Fixed
- **Difficulty now applies in 2-player split screen.** It never did: the
  split screen passed an empty courtyard regardless, so picking Hard and
  handing the phone over quietly put both players back on Easy. Difficulty
  in this game IS the obstacles you roll on rather than how the opponent
  plays, which is exactly why it carries to a human opponent unchanged.
  The chosen difficulty now rides across from the start screen the same
  way the mode already did, and both the button and each zone's scoreline
  name it.
- Both players roll on **one shared layout**. Obstacle positions are rolled
  at random, so generating them per zone would have put the hill — and on
  Hard the pond — somewhere different for each player. In a head-to-head on
  one table that is not variety, it is one player getting the easier
  courtyard.
- A rematch rebuilds each zone's physics world around the new obstacles.
  The scene builds its world once per mount, so without this the dice would
  have collided with the previous match's hill while the new one was drawn
  somewhere else.

### Changed
- **"Shapes on the dice" is now "Colorblind mode"** in Settings, and in the
  news entry that introduced it. It stopped being only about the dice when
  the shapes went onto the prisoners too, and naming the setting after what
  it is for makes it findable by someone who needs it.

## v1.12.1 — 2026-08-20 · requested by David (reported on the ideas board)

### Fixed
- **Sunset Castle now actually looks like sunset.** It was the day castle
  with seven colours swapped — roof, grass, hills, water, clouds and two
  umbrellas — and nothing else. It cost 100 trophies and then looked like
  the arena you already had.

  The reason it could never work: **lighting was global to the scene and
  identical for every arena.** A high white sun stayed overhead no matter
  which battlefield you picked, and no amount of repainting says "evening"
  underneath a midday sun.

  Lighting now belongs to the arena (`ArenaLighting` in
  `src/arena/arenas.tsx`). Sunset Castle gets a low amber sun raking in
  from one side, cool blue skylight filling the other, and less light
  overall — evening is darker as well as warmer. Because the lights are
  global they fall on the dice and the prisoners too, so the whole table
  changes hour, not just the scenery.

  On top of that: a real gradient sky dome (gold at the horizon through
  pink to deep indigo overhead), the sun itself sitting low behind the
  hills on the same side the light comes from, lit windows in the corner
  towers, and a dusk landscape — trees near silhouette, hills and meadow
  gone deep, mountains a dusty violet.

### Fixed (found while building the above)
- The sky gradient was writing linear-light values into a texture declared
  as sRGB, so the GPU decoded them a second time and the whole sky came out
  far too dark. Caught by a test comparing the stored bytes against the
  colours asked for.

## v1.12.0 — 2026-08-20 · requested by David

### Added
- **The version number now shows in Settings**, under Report a Bug — so
  when someone reports something, the release it came from is one look
  away rather than a guess.

### Fixed
- **Bug reports were stamped with the wrong version, and had been for
  eleven releases.** They sent `app.json`'s native version, which sat at
  1.0.0 since the first build — an over-the-air update cannot change it,
  and almost every release has been over-the-air. Reports now carry the
  game version from the bundle (right the moment an update lands) as
  well as the native build number.
- The version lives in `src/game/version.ts`, and `npm test` fails if it
  does not match the newest heading in this file — a release that forgets
  to move it cannot go out.

## v1.11.8 — 2026-08-20 · requested by David

### Fixed
- **The menu no longer moves when you pick a difficulty.** Easy's hint
  wraps to two lines where Medium's and Hard's fit on one, so the stakes
  line and everything under it shifted between taps — the same fault the
  mode rules had. Both now reserve their height.
- The next-unlock line is held to one line as well, since arena names
  differ in length and it sits above the whole picker.

## v1.11.7 — 2026-08-20 · requested by David

### Added
- **The studio mark, from the design handoff**, in all three places it
  belongs: the game's title card (reversed variant, since that card is
  near-black), the website header and footer, and the admin header —
  which was a 🛠️ emoji. The site also gets a favicon, which it never had.
- **Colourblind shapes now sit on the prisoners as well as the dice.**
  The move is matching a rolled colour to a PRISONER, so shapes on one
  side left the other half of that judgement on colour. Split screen
  gets them too.

### Changed
- The mark's geometry is the handoff's: a short front sail and a tall
  main sail, where the old one drew both the same height.
- **No Done button in Settings** — it is a tab now, so you leave by
  tapping another one.

## v1.11.6 — 2026-08-20 · requested by David

### Changed
- **Settings is a page of its own**, like every other tab. It was still
  opening as a translucent card over the home screen; it is now solid,
  full height, and matches Store, Cups, Items, Ranks and News. Done
  returns you to Battle.

## v1.11.5 — 2026-08-20 · requested by David

### Changed
- **Color War stands both sides along the bottom row** — yours on the
  left three spots, your opponent's on the right three. Theirs used to be
  paraded on the far battlement instead. Scores are now counted by colour
  rather than by where a figure stands, since the two share a row.
- **The Store and Inventory show the real dice.** They showed a flat
  colour square with an emoji on it — 🦓 on white for Zebra — which told
  you nothing about what you were buying. The picture is generated by the
  same painter that builds the 3D shell, so the shelf and the table
  cannot disagree.
- **Settings is a tab on the bottom bar**, and Battle sits dead centre of
  the seven. Settings still opens as a popup over the game rather than
  becoming a page of its own; the floating gear is gone, since the bar
  reaches the same place.

## v1.11.4 — 2026-08-20 · requested by David

### Added
- **RESET code** in Settings: forgets everything bought with coins so the
  Store can be walked through from scratch. Coins are deliberately NOT
  refunded — the point is to buy the items again. If the wiped skin was
  the equipped one, the loadout goes back to Ivory.

### Fixed
- **Family tester mode now covers the Store.** It opened the trophy
  ladder and the arenas but stopped at anything with a coin price, so a
  playtester still had to grind for half the dice. Nothing is bought by
  the code — the items simply become usable while it is on, and cost
  coins again the moment it goes off.

## v1.11.3 — 2026-08-20 · requested by David

### Fixed
- **The game-name bar across the top is gone.** It spanned the full width
  at y58 while the trophy and coin pills sit at y52 on the left, so the
  two ran into each other. The name was already on the launch card and
  again in the heading below it, so nothing is lost.
- The trophy and coin pills now show only on the home screen and the
  menus. They also appeared on the result screen, where the centred
  scoreboard would have collided with them the same way — that screen
  reports what you won in its own text.

## v1.11.2 — 2026-08-20 · requested by David

### Fixed
- **The trophies, coins, settings gear and bottom menu no longer show
  through the title card.** They carried a zIndex (30, 5 and 35) and the
  card carried none, so tree order counted for nothing and all four
  punched through it on launch.
- **Menu pages are solid.** They sat at 96% opacity, so the arena showed
  faintly behind the Store, Cups, Items, Ranks and News. Settings stays
  translucent on purpose — it is a popup over the game, not its own page.
- **The board stops rendering behind a menu** rather than running unseen.

### Changed
- **The coin icon is a drawn gold coin** instead of 🪙, which renders
  silver or flat depending on the phone.
- The studio name sits a little higher on the title card.

## v1.11.1 — 2026-08-20 · requested by David

### Fixed
- **The title card now comes before the loading, not after it.** The game
  was rendered on the very first render with the card drawn on top, so the
  GL canvas, physics world, audio players and four storage reads all ran
  before React could paint anything — the card arrived once the slow part
  was already over. The card renders alone now and the game mounts a beat
  later, underneath it.

### Added
- **A sound on the title card** — a rising note, once per launch. It waits
  for the saved volume settings first, so a muted phone stays muted.

## v1.11.0 — 2026-08-19 · requested by Marc and David

A bottom menu bar, tournaments, news, and a long list of fixes.

### Added
- **Bottom navigation.** Store, Leaderboard and Inventory were buttons on
  the home screen that opened modals. They are tabs now, alongside two new
  ones, on a fixed bar — the Clash Royale shape Marc asked for.
- **Cups.** Three knockout brackets against the AI roster: Courtyard Cup
  (free, 4 players), Castle Classic (50 coins, 4) and Grand Championship
  (150 coins, 8). Win every round to take the prize; one loss ends the run.
  Offline by design — real bracket play needs accounts and a server.
- **News tab.** What changed, in plain words, bundled with each update.
- **Title card on launch** with the game's name and Paper Ship Studio.
- **Opponent reveal** before each round — names shuffle, then the rival you
  actually face is shown.
- **Colourblind mode** (Settings): every colour also gets a shape.
- **All four modes in split screen**, not just Color Rush.
- **Sounds** for button presses and equipping an item.
- **Unlock and purchase popups**, both saying where to go to equip.
- **MONEY** code in Settings adds 10,000 coins for testing.

### Changed
- The app is **Dice Battles: Color Rush** everywhere now; the phone used to
  show the short name deliberately, and no longer does.
- **Classic → Color Rush**, **Standings → Leaderboard**, "wandering moat" →
  "pond".
- The **"❓ Mystery Arena"** placeholder is gone — every tier shows its real
  name from the start.
- **Rewards vary** within a band instead of paying a fixed number. An easy
  win is 10–20 coins. Losing still never costs coins.
- **The ladder starts closer**: the first reward cost 100 trophies, now 40,
  with gaps widening the whole way up. Ivory Dice joins it at 0.
- **Color War** splits the jail into sides — your three on the left.
- Your Records gained the trophy count and wins by mode.

### Fixed
- **The dice now follow your finger.** A flick that ended with a moment's
  hesitation was read as a tap, because the throw used a whole-gesture
  average; it measures the last 90ms now.
- **Skirmish figures no longer stand inside the corner towers.**
- **The volume sliders** stopped jumping about and no longer hang off the
  edge of the panel.
- **The scoreboard** no longer sits on top of the prisoners.
- **The mode picker** stopped jumping when Color War is selected.
- **Starry and Frost** were the same picture in two colours; Frost is ice
  crystals now, and Starry's stars were blobs rather than stars.
- **Bubbles** looks like bubbles rather than polka dots.
- Coins and trophies no longer collide with the settings gear in the menus.
- Website: passwords have a Show button, and long words wrap instead of
  running out through the side of their card.


Every published update gets a version here, with **who asked for it**, so
any change can be traced back and rolled back on request.

Versions are for the over-the-air updates players actually receive. The
native build they run is listed separately — a new native build is only
needed when native code changes (ads SDK, in-app purchases, networking).

**Who's who:** David Sutton owns the game and made every request up to
v1.4.0. From **v1.5.0 onward, Marc (David's son)** is directing the work.

To roll back: every version below maps to a git commit on
`claude/game-development-51x4zl`. Ask for a version number and it can be
restored.

---

## v1.10.1 — 2026-08-19 · *requested by David*

Native build: 1.0.0 (build 5)

- **A prisoner sent back to jail mid-rescue no longer rockets off the
  top of the screen.** In Ultimate mode a rescued prisoner can be
  matched again and sent straight back while still in the air. Each leap
  arcs 3.4 above wherever the figure IS, so the second one stacked on top
  of the first and threw the figure to y 6.2 — brushing the invisible
  ceiling at 6.5 and well outside the camera's framing. A leap now only
  gets whatever headroom is left below an apex of 4.6, so interrupting
  one can never send a figure higher than an ordinary leap does. Ordinary
  leaps are untouched: still 4.0.
- A leap can no longer be handed a nonsense time by the render clock. If
  a backgrounded app or a re-mounted canvas produced a negative or wild
  value, the smoothstep turned it into a figure flung far outside the
  arena; the position is now clamped to the two ends of the leap.
- 103 tests now (9 new), including one that walks the whole flight path
  and asserts a figure never dips into the dice while crossing the tray —
  interrupted at any of twenty moments, in either direction.
- What the screenshot showed is most likely the animation working
  normally: an ordinary leap clears the dice by 2.5 units, but from the
  near-top-down camera a figure passing overhead sits right on top of
  them on screen. That is not a collision, and this release does not
  claim to have fixed it — see the note on the board.

## v1.10.0 — 2026-08-19 · *requested by David*

Native build: 1.0.0 (build 5)

- **🐞 Report a Bug**, in Settings. One box, one Send button — your
  device, OS, and app version are attached automatically so nobody has
  to type them. A report lands straight on the work board as an
  already-approved bug, the same way a repair reported in the HQ does,
  so it can be looked at without waiting on anyone's approval.
- This is the game's first network call outside its own update
  mechanism — the privacy policy was rewritten in this same update to
  say exactly that, before it shipped rather than after: what a bug
  report sends, that it only sends when you tap Send, and that nothing
  in one can be tied back to a person unless you put your name in the
  message yourself.
- 94 tests now (6 new) covering what a report is allowed to say — too
  short is rejected, too long is capped rather than dropped, and the
  title shown on the board never cuts a message off mid-word.

## The family settled two votes — 2026-08-17 · *requested by David*

- **Company name: Paper Ship Studio.** Settled by family vote over Sutton
  & Sons Studio, Good Noise Studio, Three Suttons Studio and Wild Table
  Studio. The website now names it as who makes the game, alongside
  David Sutton as the actual legal party — no company is incorporated
  yet, so the legal pages still name him, with Paper Ship Studio
  introduced as the name he makes it under.
- **App icon: Perfect Match** — two dice, both landed on red, the six
  game colours along the bottom. Settled over Colour Cube, Crossed
  Swords and Colour Rush. `assets/icon.png` is updated and committed,
  but an app icon is baked into the compiled app rather than delivered
  over the air, so it will not reach a phone until the next native
  build. That build is deliberately being held: Apple only reviews one
  TestFlight build per version at a time, and build 5 — the one Marc and
  AJ are waiting on — is still in that queue. Shipping the icon now
  would mean expiring build 5 and restarting their wait from zero, so
  the icon goes out in whichever build follows once build 5 clears.

## HQ voting — 2026-08-17 · *requested by David*

Not a game change.

- **🗳️ Vote** in the HQ. Where the ideas board is one person wanting
  something and David saying yes or no, this is for questions with more
  than one good answer — everybody votes, David settles it. Votes are
  open, not secret: you can see who picked what, which is the point.
- Claude raises the questions and reads the result, and deliberately
  cannot vote or settle one.
- **First vote up: four app icons** — Perfect Match, Colour Cube, Crossed
  Swords, Colour Rush. Each is shown large and again at 56px, because the
  small one is the honest test for an icon.

## Website and HQ — 2026-08-17 · *requested by David*

Not a game change — the game itself is untouched, and still has no web
build target.

- **A public website** in `hq/`: what the game is, plus the Privacy
  Policy, Terms of Use and Support pages Apple requires live URLs for.
  The privacy policy says the true thing — the game collects nothing —
  and commits to being rewritten *before* anything like ads ships.
- **A private HQ** at `/hq` for the family: put up ideas, David approves
  or parks them, approved ones get sorted into phases, and that is the
  timeline. Sign-in is a link emailed to invited addresses only — no
  passwords, which matters when half the team are children.
- **The approved list is the work queue.** Claude reads it, builds the
  top item, and marks it shipped with the version it went out in, so the
  board and this changelog always agree. Claude cannot approve anything.
- Deliberately built on personal accounts, never the employer-linked
  Supabase or Vercel accounts that were already connected.

## App Store setup — 2026-08-17 · *requested by David*

Not a game change — nothing players have installed is different.

- The game is registered with Apple as **Dice Battles: Color Rush**.
  Plain "Dice Battles" was already taken by another app, and David picked
  the new name from a list of options.
- The name under the icon on the phone is unchanged: **Dice Battles**.
  Apple only requires the *listing* name to be unique, so the two are
  deliberately different.
- App Store Connect ID `6802287913`, SKU `DICEBATTLES001`. The bundle ID
  did not change, so no signing or code changes were needed.
- Build 1.0.0 (2) was uploaded to TestFlight — the first time the game has
  reached Apple rather than Expo Go.

## v1.9.0 — 2026-08-17 · *requested by Marc*

Native build: 1.0.0 (build 1)

- **🔊 Volume sliders.** Settings had three ON/OFF switches; it now has four
  sliders — Everything, Sound effects, Music and Announcer — each from OFF
  to 100%. "Everything" scales the other three, so one drag quietens the
  whole game without losing the balance you set underneath it.
- All the way down is genuinely off: a muted channel loads nothing, plays
  nothing, and the music loop is paused rather than played silently.
- Move the music slider mid-battle and the loop follows it immediately —
  it does not wait for the next track or restart the one playing.
- Anyone who had a sound switched off before this update keeps it off; the
  old switches become the two ends of the new sliders.
- The sliders are drawn in the game's own code rather than pulled from a
  package with native code in it, so they reach players as an ordinary
  update instead of waiting for a new App Store build.
- Settings scrolls if the panel is taller than the phone, with Done pinned
  so it is always reachable.

## v1.8.0 — 2026-08-17 · *requested by Marc*

Native build: 1.0.0 (build 1)

- **🪙 Coins.** Earned every battle — 20/40/75 for a win on
  Easy/Medium/Hard, and 5/10/15 even for a loss, so a losing streak still
  builds toward something. Coins only ever go up; trophies remain the
  thing that rises and falls with your rank.
- **🛒 Store.** Spend coins on five new PATTERNED dice: Zebra, Bubbles,
  Starry, Timber and Frost, drawn with generated stripe/spot/star/grain
  textures. Patterns paint the shell only — the six face colours are
  untouched, and the suite checks each pattern colour stays clear of all
  six so a face can never be crowded.
- **🏅 Standings.** Your league on the trophy ladder, your record per
  difficulty, coins, and the full ladder with your position marked.
- Real-money purchases and world rankings are shown as not-yet-available
  rather than faked. Both need the app installed properly (not through
  Expo Go) plus, for money, the App Store payment setup.

## v1.7.1 — 2026-08-17 · *requested by Marc*

Native build: 1.0.0 (build 1)

- Skirmish rules said "before Sir Rollsalot", who is only one of eight
  opponents. Now reads "before your opponent".
- The Battlefields section of the Inventory has a description, like the
  Dice section does: it explains that every battlefield plays the same and
  that hazards come from the difficulty, not the arena.

## v1.7.0 — 2026-08-17 · *requested by Marc*

Native build: 1.0.0 (build 1)

- **Freed prisoners no longer run off the sides of the screen.** The
  retreat row was 6.6 units wide and framed by the figures' centres, so
  the outermost two hung over the edge. The row is narrower now and the
  camera frames the figures by their EDGES.
- **Nothing stands on top of the freed prisoners any more.** The parasols
  sat directly over the figures at x ±2.4 with a canopy wide enough to
  swallow them, and the pool rim clipped the outermost one. Posts now
  flank the row from further out and back, and the pool moved clear.
- All three battlefields (Castle, Jungle, Space) now read the retreat
  positions from one shared source instead of repeating the numbers,
  which is what let them drift out of alignment in the first place.

## v1.6.0 — 2026-08-17 · *requested by Marc*

Native build: 1.0.0 (build 1)

- **No gendered language.** Opponents are "your opponent" or "them"
  everywhere — the Color War callout, the Color War rules, and the Easy
  battlefield hint all referred to the opponent as "he"/"him".
- **Difficulty is the battlefield now, not the opponent's speed.** Every
  opponent rolls at the same human pace (2s per roll). Easy is a clear
  courtyard, Medium adds the hill, Hard adds the moat as well. Speed-based
  difficulty could not survive online play — a real opponent rolls at
  whatever pace they roll, so a difficulty built on their speed would mean
  nothing. Trophy stakes still scale with difficulty.

## v1.5.2 — 2026-08-17 · *requested by Marc*

Native build: 1.0.0 (build 1)

- Home screen no longer scrolls when everything already fits — it used to
  rubber-band with nothing to scroll to. Scrolling still switches on
  automatically on smaller screens where the content genuinely overflows,
  so the START button stays reachable.
- Title reads **⚔️ DICE BATTLES ⚔️**, swords on both sides.

## v1.5.1 — 2026-08-17 · *requested by Marc*

Native build: 1.0.0 (build 1)

- Home screen button now reads just **🎒 INVENTORY**; the equipped
  battlefield name no longer trails after it.

## v1.5.0 — 2026-08-17 · *requested by Marc*

Native build: 1.0.0 (build 1)

- Versioning started. Each update from here carries a version number and
  a note of who requested it, so changes can be rolled back individually.
- Two-player button renamed from "Pass & Play" to **"Split Screen"** — it
  was never turn-based; both players roll simultaneously on one phone.

## v1.4.0 — 2026-08-17 · *requested by David*

Native build: 1.0.0 (build 1)

- **Dice feel restored to the original.** Physics had drifted a long way
  while chasing shorter rolls: 2.5× the linear damping, 4× the angular
  damping, more friction, less bounce, plus a "settle assist" that bled
  speed off dice mid-roll and a throw that teleported them to a fixed
  spot. Reverted to the original values and the original throw — dice are
  thrown from wherever they lie, and nothing touches them while they roll.
- Kept from the rework: flick throws fire on release so they carry your
  hand's speed and direction, and a roll is called the moment the dice are
  still.
- Trade-off, deliberate: median roll ~1.5s rather than ~1.0s.
- **Moat fixes.** A drowned die no longer gets frozen mid-bounce after
  being fished out, is placed back gently instead of dropped, and can only
  be swallowed once per roll (it used to be knocked back in repeatedly,
  stretching rolls past nine seconds).

## v1.3.0 — 2026-08-17 · *requested by David*

- **🎒 Inventory** menu: equip battlefields and dice colours in one place,
  with locked items shown alongside their trophy price.
- **Dice skins**: Ivory, Gold, Mint, Bubblegum, Midnight. Skins colour the
  die shell only — the six face colours never change, so nothing bought
  can affect how a roll reads.
- Trophy ladder now alternates arenas and dice: Gold 100, Sunset 250,
  Mint 325, Jungle 400, Bubblegum 475, Treasure 550, Mystery 700,
  Midnight 850.
- The battlefield you last used is remembered between launches.

## v1.2.0 — 2026-08-16 · *requested by David*

- **Play Again / Home buttons** after every round, in both solo and
  split screen. A stray tap can no longer start a fresh round.
- Hill and moat can never overlap on Hard.

## v1.1.0 — 2026-08-16 · *requested by David*

- **Jungle Clearing** and **Space Station** arenas; the Mystery Arena at
  700 🏆 is real and keeps its identity secret until earned.
- **Family tester code** in Settings unlocks everything for playtesting.
- Test suite added (57 tests) plus an automatic check after every change.

## v1.0.0 — 2026-08-16 · *requested by David*

First TestFlight build. Four game modes, two-player split screen, trophy
ladder, AI roster, recorded audio and announcer, obstacles per difficulty.
