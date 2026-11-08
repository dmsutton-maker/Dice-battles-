import AsyncStorage from '@react-native-async-storage/async-storage';
import { stripEmojiDeep } from './noEmoji';

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
 * FOR PLAYERS ONLY. David, 8 Nov 2026, on seeing "the seasons have
 * swapped round" pop up: "Why would you put in the game the seasons were
 * swapped. We didn't even launch yet. Don't put back end updates that
 * are just for us in the news." So a post is written for somebody who
 * installed the game today and knows nothing of its history: it says
 * what is in the game and what is new to play. Never the calendar
 * behind the pass, never "built" or "coming soon", never a fix to
 * something only the family ever saw, never how the game is made. The
 * list was cut from 103 posts to the ones that pass that test on the
 * same day. And every new or changed post, with whether it pops up, is
 * shown to David or Marc in chat BEFORE the update that carries it is
 * published (AGENTS.md, Releasing).
 *
 * NO NAMES. David asked on 25 Aug 2026, and it applies to everyone in the
 * family, not only the post it came from. The News tab is read by every
 * stranger who installs the game, so "AJ spotted that..." publishes a
 * child's name to the App Store. Credit a reporter as "somebody" or
 * "a player" and thank them without naming them; the person who found it
 * knows which one they are. `tests/news.test.ts` fails on a first name.
 */

/**
 * The pictures a post can carry.
 *
 * Every post used to name its own emoji, and fifty-five posts had
 * forty-eight different ones — which is not a set, it is forty-eight
 * borrowed pictures that each render differently on every phone. David
 * asked on 10 Sep 2026 for these to be drawn like the rest of the game.
 *
 * Drawing forty-eight would have been the wrong answer: what the list
 * actually needs is to say what KIND of change a post is about, and a
 * dozen kinds covers every post there has ever been. So a post picks a
 * kind and `src/ui/newsIcons.tsx` decides what that looks like.
 *
 * Kept here, in the rules, rather than beside the drawings, because the
 * headless tests read this file and have no renderer at all.
 */
export const NEWS_ICON_IDS = [
  'news',
  'dice',
  'arena',
  'look',
  'speed',
  'sound',
  'people',
  'cups',
  'shop',
  'fix',
  'phone',
  'help',
] as const;

export type NewsIconId = (typeof NEWS_ICON_IDS)[number];

/**
 * Read a kind off a post, whatever the post actually contains.
 *
 * Posts can arrive from the board over the network, written by a person
 * in a browser, so this must never throw and never render nothing: an
 * unknown kind, a missing one, or an old post still carrying an emoji
 * all come back as the plain news picture. A post with a slightly wrong
 * icon is a small thing; a post that fails to draw is a hole in the
 * list.
 */
export function newsIconId(value: unknown): NewsIconId {
  return NEWS_ICON_IDS.includes(value as NewsIconId) ? (value as NewsIconId) : 'news';
}

export interface NewsItem {
  id: string;
  date: string;
  title: string;
  /**
   * Optional because a post fetched from the board may not have one, and
   * losing the post would be worse than losing its picture. Every post
   * bundled with the game does have one — `npm test` checks that.
   */
  icon?: NewsIconId;
  body: string;
  /** Set when the post is about a released version. */
  version?: string;
  /**
   * A BIG update: the post opens by itself, once, the first time the game
   * starts after that version arrives (src/game/whatsNew.ts). Everything
   * else waits in the News tab for whoever looks.
   *
   * Mark a post major when it is a new way to play, or a change every
   * player will notice the moment they open the game: online battles, a
   * new mode, the Shop no longer opening on blank squares. Not for one
   * redrawn die, one new item or a quiet fix, however welcome; a popup
   * on every update is a popup nobody reads. At most one major post per version, and it is
   * the first post for that version (`npm test` checks both).
   *
   * Read it through newsIsMajor, never directly: a post from the board
   * can carry anything in this field.
   */
  major?: true;
}

/**
 * Whether a post is a big update, whatever the post actually contains.
 *
 * The same tolerance as newsIconId: a post from the board is written in a
 * browser, so a missing field, "yes", 1 or anything else odd is simply
 * not major rather than a reason to drop the post.
 */
export function newsIsMajor(item: unknown): boolean {
  return typeof item === 'object' && item !== null && (item as Record<string, unknown>).major === true;
}

export const NEWS: NewsItem[] = [
  {
    id: 'v1-166-0-share-win',
    date: '5 November 2026',
    version: 'v1.166.0',
    title: 'Share your win',
    icon: 'people',
    body:
      'Won a battle? Tap "Share your win" on the victory screen and the game ' +
      'makes a picture of your winning board with a big VICTORY! banner, your ' +
      'score and the trophies you won. Share it to Instagram, send it in a ' +
      'message or save it to your photos. Names never appear on the picture, ' +
      'and nothing is shared unless you tap Share.',
  },
  {
    id: 'v1-165-0-our-music',
    date: '5 November 2026',
    version: 'v1.165.0',
    title: 'Brand-new music, all our own',
    icon: 'sound',
    major: true,
    body:
      'Every bit of music in the game was made just for Dice Battles. Three ' +
      'battle tracks take turns, one per battle: a chiptune, a funk groove ' +
      'and a synth-pop sprint. When either side is one rescue from winning, ' +
      'the music turns up and gets more intense. The menus have their own ' +
      'slower, calmer version of the chiptune.\n\n' +
      'Listen out for the sounds too: a victory fanfare for each track, a ' +
      'cheer when a prisoner is freed, a sparkle when you buy something and ' +
      'a little bloop when you put on a die or a battlefield.',
  },
  {
    id: 'v1-162-0-keeps-everything',
    date: '5 November 2026',
    version: 'v1.162.0',
    title: 'Your progress survives a reinstall',
    icon: 'fix',
    major: true,
    body:
      'Deleting the game and installing it again does not start you over. ' +
      'Your trophies, record, coins, the dice and battlefields you have ' +
      'earned, your season pass progress, your settings, your friend code ' +
      'and your friends list are kept safe under your own player id and ' +
      'come back on their own the first time you open the game after a ' +
      'reinstall, with a "Welcome back" card. Anything bought with real ' +
      'money is restored by Apple: Restore purchases in Settings.\n\n' +
      'After a battle with a friend or an online opponent, "Play again" ' +
      'really asks them: you wait while they see the invitation, and the ' +
      'rematch starts when they accept.',
  },
  {
    id: 'v1-160-0-ocean',
    date: '4 November 2026',
    version: 'v1.160.0',
    title: 'The Ocean dice are alive',
    icon: 'dice',
    body:
      'The Ocean dice move: the waves roll round the die while you play, ' +
      'every side in step, and each landing throws up a splash of droplets. ' +
      'Dropping one in the moat makes a bigger one. The faces stay put, as ' +
      'always.',
  },
  {
    id: 'v1-159-0-online',
    date: '4 November 2026',
    version: 'v1.159.0',
    title: 'Battle real players',
    icon: 'people',
    // A new way to play.
    major: true,
    body:
      'From 100 trophies, Color Rush and Ultimate look for a real ' +
      'player first. You will see "Searching for an opponent" with a ' +
      'countdown; if nobody is free within 15 seconds you play a rival ' +
      'instead. Online battles count for everything: trophies, coins, ' +
      'the pass, quests and cups. Leaving one early counts as a loss.\n\n' +
      'Want to warm up? Settings has a Practice button: a battle ' +
      'against the computer that changes nothing, win or lose.',
  },
  {
    id: 'v1-157-0-battle-menu',
    date: '3 November 2026',
    version: 'v1.157.0',
    title: 'The battle menu',
    icon: 'news',
    body:
      'The button in the corner of a battle (the three lines) is a menu. ' +
      'It pauses a battle against the computer, and has the volume ' +
      'sliders, How to play, and a way to leave.\n\n' +
      'Leaving asks first, because it counts as a loss: the menu tells ' +
      'you how many trophies it would cost. In a battle with a friend ' +
      'nothing pauses, since they are still playing, and leaving hands ' +
      'them the win.',
  },
  {
    id: 'v1-155-0-friend-battles',
    date: '1 November 2026',
    version: 'v1.155.0',
    title: 'Battle a friend, live',
    icon: 'people',
    body:
      'Challenge a friend to a real battle, against them, live. Open ' +
      'Friends, tap Battle next to their name, pick the mode and the ' +
      'battlefield, and ask. It pops up on their screen with Battle! or No ' +
      'thanks, and the challenge runs out after about forty-five seconds, ' +
      'so you challenge somebody who is playing right now.\n\n' +
      'Both phones wait in a little room ("Waiting for your friend...") ' +
      'until you are both there, then count down together, and the 2:30 ' +
      'clock starts at that moment for both of you. If your friend does ' +
      'not turn up within 30 seconds, the room closes and nobody wins or ' +
      'loses.\n\n' +
      'You can feel your friend playing: a buzz, a flash and "Sam freed ' +
      'Red!" when they score, and "needs only ONE more" when they are ' +
      'close. The Friends list shows who is on right now, so you know who ' +
      'to challenge. A friend battle is for bragging rights: no trophies ' +
      'or coins change hands, just who won.',
  },
  {
    id: 'v1-154-0-clock-quests-cupboard',
    date: '1 November 2026',
    version: 'v1.154.0',
    title: 'A battle clock, daily quests and more',
    icon: 'news',
    body:
      'Battles have a 2:30 clock. If nobody has finished when it runs ' +
      'out, whoever is ahead wins, and a level score is a tie.\n\n' +
      'Every day the Cups tab offers three quests for the season pass: ' +
      'pick one, finish it before midnight (New York time) and earn a ' +
      'big chunk of pass XP.\n\n' +
      'The Inventory is your cupboard: it shows what you own. Things ' +
      'you do not have yet are seen where they come from: the Shop, the ' +
      'Gold Pass and cups in Cups, and the trophy ladder in Records, where ' +
      'every rung can be tapped to see it on the board.\n\n' +
      'The Neon dice are alive: a head of light chases round each tube, ' +
      'the tubes breathe and shift colour, and they flash when a die ' +
      'lands. The Sun Temple has a phoenix with a fire aura, the Pirate ' +
      'Cove shark swims under the boats, and the Dino Valley dinosaurs ' +
      'roam.',
  },
  {
    id: 'v1-147-0-weekly-cups',
    date: '21 October 2026',
    version: 'v1.147.0',
    title: 'A new cup every week',
    icon: 'cups',
    body:
      'Ten cups take turns, one a week, changing at midnight on ' +
      'Sunday night (New York time). They run from five Color Rush wins ' +
      'in a row up to The Gauntlet: eight Ultimate wins in a row on Hard. ' +
      'None of them is easy. A cup that has just run rests for at least ' +
      'six weeks, and the order is never the same twice.',
  },
  {
    id: 'v1-138-0-neon-dice',
    date: '20 October 2026',
    version: 'v1.138.0',
    title: 'Neon dice',
    icon: 'dice',
    body:
      'In the Shop: Neon dice. Black glass with a glowing pink tube round ' +
      'every side, and they leave a trail of light as they roll, with a ' +
      'ring of light where they land. $0.99, yours for good.',
  },
  {
    id: 'v1-134-0-more-life-on-the-boards',
    date: '19 October 2026',
    version: 'v1.134.0',
    title: 'Camels, aliens, lava and snow',
    icon: 'arena',
    body:
      'A camel train crosses the dunes behind Desert Dunes, two of the ' +
      'camels with riders. Little green aliens bound about behind Moon ' +
      'Base. A river of lava flows right round Volcano Rim.\n\n' +
      'On Snowy Hollow two children have a snowball fight behind the far ' +
      'wall, a snowman gets built in the corner over and over, and a ' +
      'finished one waddles along the front of the board.',
  },
  {
    id: 'v1-130-0-fights-and-dogfights',
    date: '19 October 2026',
    version: 'v1.130.0',
    title: 'Sword fights and a space battle',
    icon: 'arena',
    body:
      'The sword fighters outside the castle really fight: they circle ' +
      'each other, lunge, parry and clash blades. The same pairs fight on ' +
      'Sunset Castle, the Jungle and the themed boards.\n\n' +
      'On the Space Station, fighter ships chase each other through the ' +
      'stars beside the deck, firing lasers back and forth, and duck ' +
      'under the station at either end. The toy train goes round the Toy ' +
      'Room, and nothing crosses the playing surface.',
  },
  {
    id: 'v1-127-0-boards-come-alive',
    date: '19 October 2026',
    version: 'v1.127.0',
    title: 'The boards are alive',
    icon: 'arena',
    body:
      'Little fish swim around the Coral Reef, a shark circles the pirate ' +
      'ship and ducks under its hull, two helicopters fly over Rooftop ' +
      'City, cows, sheep and chickens wander Sunny Farm, and Treasure ' +
      'Beach has surfers on the waves and sunbathers on the sand. They ' +
      'move during battles and previews and keep off the playing surface.',
  },
  {
    id: 'v1-107-0-gold-pass',
    date: '13 October 2026',
    version: 'v1.107.0',
    title: 'The Gold Pass',
    icon: 'cups',
    body:
      'The season pass has two rows. Everybody climbs the top row for ' +
      'free, and it pays something at every level, with one of the ' +
      'season\'s dice waiting at level 20.\n\n' +
      'The Gold row sits underneath, on the same levels, and is unlocked ' +
      'by the Gold Pass in the Shop. It holds the season\'s other three ' +
      'things, two battlefields and a die, and coins at every other level. ' +
      'If you get the Gold Pass part-way through the season, every Gold ' +
      'level you have already reached pays out straight away. Nothing on ' +
      'either row changes how the dice land.',
  },
  {
    id: 'v1-103-0-moving-water',
    date: '30 September 2026',
    version: 'v1.103.0',
    title: 'Real water, and one or two cups',
    icon: 'arena',
    body:
      'The ponds move. On every battlefield with water — the castle, ' +
      'the jungle, the beach and the rest — the water ripples and ' +
      'drifts, light shimmers across it, and foam laps at the edge. The ' +
      'river in the jungle flows.\n\n' +
      'The Cups tab shows one or two cups at a time, and every one of them ' +
      'changes every week or so.',
  },
  {
    id: 'v1-102-0-season-pass',
    date: '30 September 2026',
    version: 'v1.102.0',
    title: 'The season pass',
    icon: 'cups',
    body:
      'Every battle you finish earns experience — a win more than a ' +
      'loss, and Hard more than Easy — and experience climbs the season ' +
      'pass, at the top of the Cups tab. There are thirty levels, and every ' +
      'one pays something: a few coins or a few trophies, a little more ' +
      'the higher you go.\n\n' +
      'Four levels are special: a battlefield at level 6, a die at level ' +
      '12, a die at level 20, and the season\'s big battlefield at level 30. ' +
      'The season pass is the only way to get them. The season changes on ' +
      'the 1st of the month, and everything you earned stays yours.\n\n' +
      'The pass is free. Every level is earned by playing. Tap a die or a ' +
      'battlefield on the pass to look at it before you get there.',
  },
  {
    id: 'v1-67-0-adverts',
    date: '7 September 2026',
    version: 'v1.67.0',
    title: 'One ad every third game',
    icon: 'shop',
    body:
      'The game is free, and one full-screen ad appears after every third ' +
      'finished game. That is the whole of it: never during a battle, ' +
      'never a banner across the board, never a video you have to sit ' +
      'through.\n\n' +
      'Every ad is marked for a family audience, so nothing is chosen ' +
      'based on who is holding the phone and nothing follows you anywhere. ' +
      'It waits until you leave the results, so it can never cover a ' +
      'trophy or an unlock you have just won — and the next battle ' +
      'waits for you to close it.',
  },
  {
    id: 'v1-50-0-big-content',
    date: '26 August 2026',
    version: 'v1.50.0',
    title: 'Battlefields and dice',
    icon: 'arena',
    body:
      'Battlefields to fight on: a snowy hollow, desert dunes, a volcano ' +
      'rim, a candy meadow, a pirate cove, a coral reef, a rooftop city at ' +
      'night, a moon base and more. Some are earned by winning trophies ' +
      'on the ladder, and some are bought with the coins you win by ' +
      'playing.\n\n' +
      'And dice: animals from leopard to bumblebee, foods from watermelon ' +
      'to chicken and waffles, and stranger things — a galaxy, a ' +
      'rainbow, a circuit board. Tap anything in the Shop or your ' +
      'Inventory to stand in it or hold it before you spend a single coin.',
  },
  {
    id: 'v1-21-0-tutorial',
    date: '23 August 2026',
    version: 'v1.21.0',
    title: 'How to play',
    icon: 'help',
    body:
      'Six short pages explaining the whole game: the six prisoners, how to ' +
      'throw, the one rule everything is built on, the four modes, and what ' +
      'trophies and coins are for. It opens by itself the first time and is ' +
      'always there afterwards, in Settings.',
  },
  {
    id: 'v1-17-0-previews',
    date: '22 August 2026',
    version: 'v1.18.0',
    title: 'See an item before you buy it',
    icon: 'shop',
    body:
      'Tap anything in the Shop or the Inventory and you see it on the real ' +
      'board — the actual dice, the actual battlefield — rather ' +
      'than a small picture of it. Buying happens right there.',
  },
  {
    id: 'v1-10-2-modes',
    date: '19 August 2026',
    version: 'v1.10.2',
    title: 'Every mode plays in split screen',
    icon: 'people',
    body:
      'Two-player split screen, on one phone, works in every mode: Color ' +
      'Rush, Ultimate, Skirmish and Color War. In Skirmish you share one ' +
      'jail, so grabbing a colour takes it out from under the other player.',
  },
  {
    id: 'v1-10-2-shapes',
    date: '19 August 2026',
    version: 'v1.10.2',
    title: 'Colorblind mode',
    icon: 'look',
    body:
      'A setting gives every colour its own shape as well — a circle ' +
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
    // No check on `icon`: newsIconId turns anything at all into a real
    // picture, so a post is never dropped over one.
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
    // Saved before the emoji rule, possibly: cleaned on the way out too.
    const parsed = stripEmojiDeep(JSON.parse(raw));
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
    // Typed into the HQ board from a browser: no emoji reaches the News tab.
    const body = stripEmojiDeep(await response.json());
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
