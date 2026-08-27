import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * What's new in the game, shown in the News tab.
 *
 * These posts are BUNDLED with the app: they are what a player sees on a
 * fresh install, on a plane, and the first moment the tab opens before
 * anything has been fetched. Posts written on the HQ board are layered on
 * top of them at runtime (see fetchNews below) — the bundled list is the
 * floor, never the ceiling.
 *
 * That split is the whole design. A purely live feed would show an empty
 * News tab to anyone offline, and a purely bundled one goes stale the
 * moment something is worth announcing between releases. This list is
 * always right about what shipped; the board can add to it.
 *
 * Newest first. Dates are plain strings so they read the same on every
 * device regardless of locale settings.
 *
 * NO NAMES. David asked on 25 Aug 2026, and it applies to everyone in the
 * family, not only the post it came from. The News tab is read by every
 * stranger who installs the game, so "AJ spotted that..." publishes a
 * child's name to the App Store. Credit a reporter as "somebody" or
 * "a player" and thank them without naming them; the person who found it
 * knows which one they are. `tests/news.test.ts` fails on a first name.
 */

export interface NewsItem {
  id: string;
  date: string;
  title: string;
  emoji: string;
  body: string;
  /** Set when the post is about a released version. */
  version?: string;
}

export const NEWS: NewsItem[] = [
  {
    id: 'v1-59-0-ultimate-icon',
    date: '26 August 2026',
    version: 'v1.59.0',
    title: 'The Ultimate icon, finally',
    emoji: '🔁',
    body:
      'The little loop-and-arrows icon for Ultimate mode has been wrong ' +
      'twice, both times on the arrowheads. The first version left odd ' +
      'stubs on the loop; the second drew heads that were wider than ' +
      'they were long and stuck them on the outside, so it looked like ' +
      'a rounded box with two fins.\n\n' +
      'It is now a proper repeat symbol: two arrowheads that are longer ' +
      'than they are wide, sitting on the straight part of the loop and ' +
      'narrowing into the turn.',
  },
  {
    id: 'v1-58-0-copper-and-thirteen',
    date: '26 August 2026',
    version: 'v1.58.0',
    title: 'Copper was showing as a plain brown cube',
    emoji: '🥉',
    body:
      'Copper had no pattern on it at all — and nor did Ruby, Ocean or ' +
      'Slate. All four are painted a different way from the rest and ' +
      'the die was checking for the wrong thing, so it fell back to a ' +
      'flat colour. Fixed, and Copper is now a polished metal to match ' +
      'Gold and Silver.\n\n' +
      'Thirteen more dice have been redrawn properly: the golf ball has ' +
      'real dimples, the basketball has pebbled leather, the tiger has ' +
      'fur, the honeycomb has holes with honey in them, the snake has ' +
      'shaded scales, the bowling ball has a swirl and a shine, and the ' +
      'cow, bumblebee, turtle, soccer ball, denim, football and ' +
      'volleyball all got the same treatment.\n\n' +
      'And the battlefields have stopped sharing furniture. The two ' +
      'shelters at the bottom of the screen used to be the same castle ' +
      'turret roof in all sixteen. Now there is a snowy lean-to, a reed ' +
      'shade, a brazier, a log A-frame, a floodlight, a hanging crystal, ' +
      'a landing beacon, a sail, a lollipop, a jar of fireflies, a ' +
      "ship's lantern, a birdhouse, a sea fan, a street lamp and a " +
      'pinwheel. The jail bars are different in every one too.',
  },
  {
    id: 'v1-57-0-no-more-blob',
    date: '26 August 2026',
    version: 'v1.57.0',
    title: 'Sorry about the giant blob',
    emoji: '🫧',
    body:
      'The last update put an enormous brown dome across the top of ' +
      'every battlefield. It was meant to be a distant horizon and it ' +
      'was actually sitting right on top of the jail. It is gone.\n\n' +
      'While fixing it, the night battlefields turned out to be far too ' +
      'dark — Rooftop City had half its board in deep shadow. The ' +
      'lighting has been brought up, so night is now carried by the ' +
      'colour of the light rather than by there being almost none of ' +
      'it. A volcano at night is not dark, it is orange.\n\n' +
      'Trees look like trees from above instead of flat coloured ' +
      'circles, the Glow Glade toadstools are no longer bigger than the ' +
      'mushrooms, and the floors are calmer under the dice.',
  },
  {
    id: 'v1-56-0-arenas-in-frame',
    date: '26 August 2026',
    version: 'v1.56.0',
    title: 'The new battlefields were being decorated off screen',
    emoji: '🔭',
    body:
      'Somebody said the new maps looked unfinished, and they were ' +
      'right for a reason nobody had spotted: all the scenery was ' +
      'outside the camera. The trees, rocks, lava pools, cacti and ' +
      'barns were all placed far enough out that the game never showed ' +
      'a single one of them, along with the hills, the mountains, the ' +
      'clouds, the sun, the stars and the moon. Every battlefield was ' +
      'really just a bare tray.\n\n' +
      'Everything has been moved in close where you can actually see ' +
      'it — a row down each side of the board and more behind the jail.\n\n' +
      'And the floor you roll on is different in every battlefield now. ' +
      'It used to be the same grey stone grid in all sixteen. There is ' +
      'packed snow, rippled desert sand, cracked lava with the heat ' +
      'still glowing in it, fallen leaves, riveted metal decking, cave ' +
      'rock, moon dust, wet beach sand, iced squares, moss with ' +
      'stepping stones, ship planks, straw, a rippled seabed, a city ' +
      'rooftop and a toy play mat.',
  },
  {
    id: 'v1-55-0-dice-and-arena-polish',
    date: '26 August 2026',
    version: 'v1.55.0',
    title: 'The Fish has fish on it, and every arena is its own place',
    emoji: '🐟',
    body:
      'The Fish dice had scales on it, which is what a fish is covered ' +
      'in — not what a fish looks like. It has fish on it now. The ' +
      'chicken on Chicken & Waffles is drumsticks with bones instead of ' +
      'two brown lumps, and the Peacock has proper feather eyes that go ' +
      'navy, then blue, then gold.\n\n' +
      'Most of the dice have been redrawn with real texture: the ' +
      'turtle shell is domed with growth rings, the chocolate bar is ' +
      'moulded, the strawberry seeds sit down in their dimples, and the ' +
      'denim has proper twill with orange stitching. Ruby, Ocean, Slate ' +
      'and Copper are not flat colours any more — a cut gem, water with ' +
      'foam on the waves, split stone and hammered metal.\n\n' +
      'All sixteen battlefields are built of something different now, ' +
      'instead of sharing four designs: snow palings, adobe brick, ' +
      'basalt columns, stacked logs, a polar station, cave dripstone, ' +
      'hull plating, driftwood, piped icing, mossy stones, a ship rail, ' +
      'a picket fence, coral, a rooftop parapet and wooden bricks.\n\n' +
      'And the Store makes more sense: everything has its own price ' +
      'instead of six dice all costing the same, and both shelves climb ' +
      'steadily from cheap to rare.',
  },
  {
    id: 'v1-54-0-dice-designs-move',
    date: '26 August 2026',
    version: 'v1.54.0',
    title: 'The dice designs were hiding under the colours',
    emoji: '🎲',
    body:
      'The coloured circle on each side of a die covers the middle of ' +
      'that side — and a lot of the dice had their design drawn right ' +
      'there, underneath it. The Football was four blank brown sides ' +
      'with the laces hidden. The Soccer Ball had one pentagon and you ' +
      'could not see it. The Tennis Ball, the Basketball, the Bowling ' +
      'Ball, the Lemon and the Galaxy all had the same problem.\n\n' +
      'Eleven dice are redrawn so the design goes around the colour ' +
      'instead of under it. The soccer ball is a proper lattice of ' +
      'pentagons now, the tennis and baseball seams curve in from the ' +
      'sides, the basketball has four seams around the edge, the ' +
      'bowling ball has its finger holes up in a corner, the lemon is ' +
      'four cut slices, and the galaxy has its bright core low in one ' +
      'corner with the arm sweeping across.',
  },
  {
    id: 'v1-53-0-brighter-battlefields',
    date: '26 August 2026',
    version: 'v1.53.0',
    title: 'Brighter battlefields, and not a castle in sight',
    emoji: '🏞️',
    body:
      'Some of the new battlefields were so dark you could not tell what ' +
      'you were looking at. Rooftop City is dusk now instead of ' +
      'midnight, the volcano rim is lit from the lava running down it, ' +
      'the crystal cavern glows, Frozen Lights stands on snow under the ' +
      'green sky, and Glow Glade is a mossy clearing in the moonlight.\n\n' +
      'They have also stopped all being castles. The moon base, the ' +
      'polar station, the rooftop and the pirate cove are built things ' +
      'with panelled walls and lit strips. The desert, volcano, cavern, ' +
      'glade and reef are ringed with boulders and cairns. The snowy ' +
      'hollow, autumn woods, farm and beach have timber fences. Only ' +
      'three of them kept their battlements, and those three are ' +
      'castles on purpose.\n\n' +
      'There is more to look at in all of them too: flowers, bushes, ' +
      'torches, banners, gulls over the beach, sparks over the volcano ' +
      'and a treasure chest down at the cove.\n\n' +
      'And a small annoyance is gone — leaving a preview now puts you ' +
      'back exactly where you were on the shelf instead of at the top.',
  },
  {
    id: 'v1-50-0-big-content',
    date: '26 August 2026',
    version: 'v1.50.0',
    title: 'Sixteen new battlefields and forty new dice',
    emoji: '🗺️',
    body:
      'The biggest update the game has ever had. Sixteen brand new ' +
      'battlefields: a snowy hollow, desert dunes, a volcano rim, a ' +
      'candy meadow, a pirate cove, a coral reef, a rooftop city at ' +
      'night, a moon base and more. Half are earned by winning trophies ' +
      '— the ladder now climbs all the way to 10,000 — and half are ' +
      'bought with the coins you win by playing.\n\n' +
      'And forty new dice: animals from leopard to bumblebee, sports ' +
      'balls from soccer to bowling, foods from watermelon to chicken ' +
      'and waffles, and stranger things — a galaxy, a rainbow, a ' +
      'circuit board. Tap anything in the Store or your Items to stand ' +
      'in it or hold it before you spend a single coin.',
  },
  {
    id: 'v1-46-0-see-through-and-a-finger',
    date: '26 August 2026',
    version: 'v1.46.0',
    title: 'See your board again, and a proper How to Play',
    emoji: '👆',
    body:
      'The screen you get after a game used to be solid paper, so the ' +
      'board you had just played on vanished behind it. It is see-through ' +
      'now — you can see how it finished while you read what you won. The ' +
      'Home Screen stays solid, which is how it should be.\n\n' +
      'How to Play has a proper demonstration on the "Throw the dice" ' +
      'page instead of three little pictures. A finger comes in and flicks, ' +
      'two dice tumble across a little battlefield, they land on the same ' +
      'colour, and that prisoner leaves the jail. It plays over and over, ' +
      'so you can just watch it until it makes sense.',
  },
  {
    id: 'v1-41-0-dice-must-land',
    date: '25 August 2026',
    version: 'v1.41.0',
    title: 'The dice have to actually land now',
    emoji: '🎲',
    body:
      'You could tap as fast as your thumb would go and the game would ' +
      'read the dice while they were still in the air — so a whole board ' +
      'could be cleared in about a minute. It waits for them to come to ' +
      'rest now, and a colour only counts once the die has settled on it. ' +
      'Tapping early still works exactly as before: your next throw goes ' +
      'out the moment the dice land, it just cannot cut short the roll ' +
      'that is still going.\n\n' +
      'While we were in there we found a die could stop leaning against ' +
      'one of the obstacles, showing one colour while the game counted ' +
      'another. It gets straightened up before you see the result.\n\n' +
      'The Cups picture is plain ink now to match the rest of the bar.',
  },
  {
    id: 'v1-39-0-icons-grain',
    date: '25 August 2026',
    version: 'v1.39.0',
    title: 'A bracket for Cups, and real wood and stone',
    emoji: '🪵',
    body:
      'The Cups tab had the same trophy picture as your trophy count, so ' +
      'there was no telling which one meant what. It is a tournament ' +
      'bracket now. The Timber dice were redrawn with real grain and a ' +
      'knot in it instead of even stripes, and the Marble dice have veins ' +
      'that branch and wander through the stone.',
  },
  {
    id: 'v1-38-0-spam',
    date: '24 August 2026',
    version: 'v1.38.0',
    title: 'No more winning by swiping as fast as you can',
    emoji: '🎲',
    body:
      'You could spam the screen and free all six colours in about three ' +
      'seconds, because a new swipe ended the previous roll instantly. ' +
      'The dice now have to actually roll for a moment before the result ' +
      'counts. You still never wait for them to stop — swipe whenever you ' +
      'like and it is remembered.',
  },
  {
    id: 'v1-36-0-ads',
    date: '24 August 2026',
    version: 'v1.36.0',
    title: 'Ads are coming, and here is the deal',
    emoji: '📺',
    body:
      'To pay for the game being free, an ad now shows after every third ' +
      'finished game. Never in the middle of a battle, never on top of a ' +
      'prize you just won, and never on your first few games. They are ' +
      'set to child-friendly ads only, and the game does not track you or ' +
      'collect anything about you to choose them. Quitting a battle early ' +
      'does not count toward one.',
  },
  {
    id: 'v1-34-0-gold',
    date: '24 August 2026',
    version: 'v1.34.0',
    title: 'A golden trophy and a proper coin',
    emoji: '🏆',
    body:
      'The trophy symbol is gold now instead of a plain outline, and the ' +
      'coin got a raised rim, an inner ring and a little sparkle stamped ' +
      'in the middle, so it looks like a real coin. The home screen ' +
      'background is solid too — the board no longer shows faintly ' +
      'through the menus.',
  },
  {
    id: 'v1-32-0-paper-ink',
    date: '24 August 2026',
    version: 'v1.32.0',
    title: 'A whole new look: Paper & Ink',
    emoji: '🎨',
    body:
      'Every menu, button and popup has been redrawn. The game now looks ' +
      'like pieces of white card laid out on a warm paper table — clean ' +
      'outlines, real shadows, and hand-drawn icons instead of emoji. ' +
      'The dice, the battlefields and the six colours are exactly as they ' +
      'were: this is a new outfit, not a new game. Picked by the family, ' +
      'built the same day.',
  },
  {
    id: 'v1-31-0-same-spot',
    date: '24 August 2026',
    version: 'v1.31.0',
    title: 'Ultimate soldiers stop sharing a spot',
    emoji: '🐛',
    body:
      'Somebody spotted that in Ultimate two rescued soldiers could end ' +
      'up standing on exactly the same spot. It happened after a prisoner ' +
      'was sent back to jail: the next rescue counted heads instead of ' +
      'looking for an empty space. Rescued soldiers now fill the first ' +
      'free spot in the line. Thank you for reporting it!',
  },
  {
    id: 'v1-29-0-hazards',
    date: '24 August 2026',
    version: 'v1.29.0',
    title: 'Every battlefield has its own traps',
    emoji: '🕳️',
    body:
      'On Medium and Hard the hill and the water used to be drawn the same ' +
      'everywhere — a grassy bump and a stone-edged pond, even on a space ' +
      'station. Now the jungle has a proper lake with an earth bank, and the ' +
      'station has a metal dome and an open hatch that a die falls straight ' +
      'through. They behave exactly the same as each other, so Hard is still ' +
      'Hard wherever you play it.',
  },
  {
    id: 'v1-28-0-arenas',
    date: '24 August 2026',
    version: 'v1.28.0',
    title: 'Battlefields open straight away',
    emoji: '⚡',
    body:
      'Looking through the battlefields used to show you the last one for a ' +
      'moment before the new one appeared. The ground and walls are drawn dot ' +
      'by dot when an arena opens, and the game was redoing that every single ' +
      'time — even for one you had already looked at. Now each is drawn once ' +
      'and kept.',
  },
  {
    id: 'v1-27-0-jungle',
    date: '24 August 2026',
    version: 'v1.27.0',
    title: 'The Jungle Clearing, rebuilt',
    emoji: '🌴',
    body:
      'The jungle was quietly using the castle\'s stone floor with green paint ' +
      'on it — you could see the slabs and the lines between them. It has ' +
      'proper ground now, and the fence around it is a real wall of logs ' +
      'instead of a row of posts you were looking down on the tops of.',
  },
  {
    id: 'v1-26-0-roll',
    date: '24 August 2026',
    version: 'v1.26.0',
    title: 'Never wait for the dice again',
    emoji: '🎲',
    body:
      'Swipe whenever you like. You no longer wait for the dice to stop ' +
      'rolling — the moment you swipe, the roll counts and the next one is on ' +
      'its way. The dice settle onto whichever colour was already facing up, ' +
      'so what gets counted is what you see.',
  },
  {
    id: 'v1-25-0-frost',
    date: '24 August 2026',
    version: 'v1.25.0',
    title: 'Snowflakes on the Frost dice',
    emoji: '❄️',
    body:
      'The Frost dice have proper snowflakes now, six arms with branches off ' +
      'each one and a little bar across every tip. Every flake is a different ' +
      'size and turned a different way, so no two on a die are the same.',
  },
  {
    id: 'v1-24-0-materials',
    date: '24 August 2026',
    version: 'v1.24.0',
    title: 'Wood, marble, granite, gold and silver',
    emoji: '✨',
    body:
      'Dice that look like what they are made of. The wooden ones have growth ' +
      'rings, the marble has veins running through it, the granite is flecked ' +
      'stone — and the gold and silver both catch a sweep of light across the ' +
      'face as they turn.',
  },
  {
    id: 'v1-23-0-gamecenter',
    date: '23 August 2026',
    version: 'v1.23.0',
    title: 'World rankings are coming',
    emoji: '🌍',
    body:
      'Your trophies and battles won will go up against everyone else\'s ' +
      'through Game Center, with ten things to earn along the way — your first ' +
      'win, winning on Hard, winning in all four modes, one for each ' +
      'battlefield you unlock, and one for collecting ten sets of dice. It ' +
      'needs a new version from the App Store rather than the usual instant ' +
      'update, so it will arrive with the next one.',
  },
  {
    id: 'v1-22-0-battlefields',
    date: '23 August 2026',
    version: 'v1.22.0',
    title: 'The battlefields stopped looking the same',
    emoji: '🏰',
    body:
      'Every arena used to be four tall walls with a different ornament on ' +
      'top, so they all read as the castle in another colour. The jungle and ' +
      'the space station have been rebuilt from the ground up — different ' +
      'shapes, not just different paint.',
  },
  {
    id: 'v1-21-0-tutorial',
    date: '23 August 2026',
    version: 'v1.21.0',
    title: 'How to play',
    emoji: '❓',
    body:
      'Six short pages explaining the whole game: the six prisoners, how to ' +
      'throw, the one rule everything is built on, the four modes, and what ' +
      'trophies and coins are for. It opens by itself the first time and is ' +
      'always one tap away from the home screen after that.',
  },
  {
    id: 'v1-17-0-previews',
    date: '22 August 2026',
    version: 'v1.18.0',
    title: 'See an item before you buy it',
    emoji: '👀',
    body:
      'Tap anything in the Store or the Inventory and you see it on the real ' +
      'board — the actual dice, the actual battlefield — rather than a small ' +
      'picture of it. Buying happens right there, and the Inventory now points ' +
      'you at the Store instead of letting you buy from the wrong place.',
  },
  {
    id: 'v1-11-0',
    date: '19 August 2026',
    version: 'v1.11.0',
    title: 'Tournaments, News and a bottom menu',
    emoji: '🏆',
    body:
      'Three cups to enter, each a knockout bracket against the opponents ' +
      'you already know. Win every round to be champion — lose one and the ' +
      'run is over. All the menus moved to the bar along the bottom, so ' +
      'everything is one tap away instead of buried.',
  },
  {
    id: 'v1-10-2-feel',
    date: '19 August 2026',
    version: 'v1.10.2',
    title: 'The dice follow your finger properly now',
    emoji: '🎲',
    body:
      'If you flicked the dice and paused for a moment before lifting your ' +
      'finger, the game read it as a gentle tap and rolled them slowly ' +
      'forward instead of throwing them where you aimed. Fixed — it now ' +
      'measures the last moment of the flick.',
  },
  {
    id: 'v1-10-2-modes',
    date: '19 August 2026',
    version: 'v1.10.2',
    title: 'Every mode plays in split screen',
    emoji: '👥',
    body:
      'Two-player split screen used to be Color Rush only. Ultimate, ' +
      'Skirmish and Color War all play head-to-head now. In Skirmish you ' +
      'share one jail, so grabbing a colour takes it out from under the ' +
      'other player.',
  },
  {
    id: 'v1-10-2-shapes',
    date: '19 August 2026',
    version: 'v1.10.2',
    title: 'Colorblind mode',
    emoji: '🔷',
    body:
      'A new setting gives every colour its own shape as well — a circle ' +
      'for red, a square for blue, and so on. Helpful if colours are hard ' +
      'to tell apart, and in bright sunlight it helps everyone. Find it in ' +
      'Settings.',
  },
];

/**
 * Posts written on the HQ board, layered over the bundled ones.
 *
 * THE RULES, in order of importance:
 *
 * 1. The News tab must never be empty and must never show an error. It is
 *    a page of announcements, not a feature — if the network is gone, the
 *    right outcome is the news we shipped with, silently.
 * 2. Nothing here may block. The fetch happens after the tab is already
 *    drawn from the bundled list, and swaps in more if any arrive.
 * 3. No key of any kind lives in the app. The game reads a plain public
 *    URL on the website, and the website holds the database credentials.
 *    A token inside an app is not a token — it is a string anybody can
 *    pull out of the binary.
 */

const FEED_URL = 'https://dice-battles-hq.vercel.app/api/news';
const CACHE_KEY = 'dice-battles:news-cache';
/** Long enough that a plane journey still shows the last news seen. */
const FETCH_TIMEOUT_MS = 6000;

function isNewsItem(value: unknown): value is NewsItem {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    item.id.length > 0 &&
    typeof item.date === 'string' &&
    typeof item.title === 'string' &&
    typeof item.emoji === 'string' &&
    typeof item.body === 'string' &&
    (item.version === undefined || typeof item.version === 'string')
  );
}

/**
 * Bundled posts plus fetched ones, newest first, no duplicates.
 *
 * A fetched post WINS over a bundled one with the same id, which is what
 * makes a correction possible: fix the wording on the board and the fixed
 * version is what players see, without shipping anything.
 */
export function mergeNews(bundled: NewsItem[], fetched: NewsItem[]): NewsItem[] {
  const byId = new Map<string, NewsItem>();
  for (const item of bundled) byId.set(item.id, item);
  for (const item of fetched) byId.set(item.id, item);
  // The board's own order first, then everything bundled that it did not
  // mention. Deliberately not sorted by date: the dates are free text so
  // they read properly on every phone, and parsing them back into real
  // dates to sort by would be inventing a contract the writer never
  // agreed to.
  const fetchedIds = new Set(fetched.map((f) => f.id));
  return [
    ...fetched.map((f) => byId.get(f.id)!),
    ...bundled.filter((b) => !fetchedIds.has(b.id)),
  ];
}

/** The last feed we managed to read, so a cold start offline still has it. */
async function readCache(): Promise<NewsItem[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isNewsItem) : [];
  } catch {
    return [];
  }
}

/**
 * Fetch the board's posts. Resolves to the merged list, always.
 *
 * Never rejects and never throws. Every failure path — no network, a
 * timeout, a 500, malformed JSON, a post missing a field — ends at the
 * same place: the news this version of the game already had.
 */
export async function fetchNews(): Promise<NewsItem[]> {
  const cached = await readCache();
  // Something to show immediately if the request below never answers.
  const fallback = mergeNews(NEWS, cached);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(FEED_URL, { signal: controller.signal });
    if (!response.ok) return fallback;
    const body = await response.json();
    const posts: unknown = (body as Record<string, unknown>)?.posts;
    if (!Array.isArray(posts)) return fallback;

    // Each post is checked on its own, so one malformed row costs that
    // row and not the whole feed.
    const clean = posts.filter(isNewsItem);
    if (clean.length === 0) return fallback;

    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(clean)).catch(() => {});
    return mergeNews(NEWS, clean);
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}
