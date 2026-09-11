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
}

export const NEWS: NewsItem[] = [
  {
    id: 'v1-91-0-blank-sides-really-gone',
    date: '11 September 2026',
    version: 'v1.91.0',
    title: 'Seven more dice had blank sides',
    icon: 'fix',
    body:
      'Yesterday ten dice got their designs back on every side. Then all ' +
      'fifty were drawn out, six sides each, and looked at \u2014 which is ' +
      'what should have happened the first time \u2014 and seven more were ' +
      'hiding.\n\n' +
      'The Fish dice was the worst: its four goldfish were nowhere on ' +
      'the dice at all, so every side was plain rippling water. The ' +
      'Waffles dice is meant to be chicken AND waffles, and the chicken ' +
      'only ever appeared on the shop card \u2014 the dice itself was ' +
      'plain waffle. Denim had its orange stitching on two sides. ' +
      'Lavender had its sprigs on two. Basketball, Ivory and the three ' +
      'plain-colour dice were all patchy.\n\n' +
      'Every one of the fifty is now checked, side by side, against the ' +
      'picture on its shop card. If a side is missing what the card ' +
      'promises, the game will not build.',
  },
  {
    id: 'v1-90-0-no-blank-sides',
    date: '11 September 2026',
    version: 'v1.90.0',
    title: 'No more blank sides on the dice',
    icon: 'dice',
    body:
      'Ten dice had sides with nothing on them \u2014 the pizza, the ' +
      'baseball, the donut, the watermelon, the bowling ball, the tennis ' +
      'ball, the football, the lemon, the blossom and the circuit board. ' +
      'Roll one and you would often be looking at plain cheese, or plain ' +
      'white, or plain pink.\n\n' +
      'It came from the change that gave every dice six joined-up sides. ' +
      'That works beautifully for a pattern like zebra stripes or marble, ' +
      'which really does run round the whole dice. It does not work for a ' +
      'dice with one big picture on it: a pizza dice should have a pizza ' +
      'on every side, not one pizza smeared across the whole thing with ' +
      'four sides of bare cheese.\n\n' +
      'So those ten now put the whole picture on each side, and every ' +
      'patterned dice in the game has been checked, side by side, to make ' +
      'sure none of them has a blank one.',
  },
  {
    id: 'v1-89-0-four-polished',
    date: '11 September 2026',
    version: 'v1.89.0',
    title: 'Gold, Silver, Copper and Ruby all shine now',
    icon: 'dice',
    body:
      'The four shiny dice are one polished surface in four colours. ' +
      'Ruby and Copper were still using the old drawing, where only two ' +
      'of the six sides caught the light \u2014 so most of the time they ' +
      'looked like a flat brown or a flat dark red. Every side of all ' +
      'four shines now.\n\n' +
      'Ruby and Copper are a bit brighter as well, so there is somewhere ' +
      'for the shine to go. Ruby stops short of where it wanted to be: ' +
      'any redder and it would start to look like the RED face on the ' +
      'dice, and no dice can be allowed to swallow one of the six ' +
      'colours the whole game is played with.',
  },
  {
    id: 'v1-88-0-ads-actually-show',
    date: '11 September 2026',
    version: 'v1.88.0',
    title: 'The adverts actually turn up now',
    icon: 'fix',
    body:
      'There is meant to be one advert after every third finished game, ' +
      'and for a lot of people there were none at all.\n\n' +
      'An advert has to be fetched over the internet before it can be ' +
      'shown, and the game was only ever asking for one quietly in the ' +
      'background. If it had not arrived by the time your third game ' +
      'ended \u2014 which, just after opening the app, it usually had ' +
      'not \u2014 the game skipped it and waited another three games to ' +
      'try again.\n\n' +
      'Now it waits a few seconds for one when you press Start battle or ' +
      'Play again, and if it still cannot get one it keeps owing you it ' +
      'rather than forgetting. Going back to the menu never waits: an ' +
      'advert appearing six seconds after you got there would be worse ' +
      'than none.',
  },
  {
    id: 'v1-87-0-friendly-battles',
    date: '11 September 2026',
    version: 'v1.87.0',
    title: 'Battle someone on your friends list',
    icon: 'people',
    body:
      'You can now challenge a friend to a real battle, against them, ' +
      'live. Open Friends, tap Battle next to their name, pick the mode ' +
      'and the battlefield, and ask.\n\n' +
      'It pops up on their screen straight away with Battle! or No ' +
      'thanks, and it is also waiting at the top of their Friends tab in ' +
      'case they were mid-roll. Say yes and you are both in the same ' +
      'battle a moment later \u2014 their prisoners move because their ' +
      'dice landed, not because a computer decided.\n\n' +
      'Nothing is won and nothing is lost: no trophies, no coins, no ' +
      'adverts. Just who won.\n\n' +
      'It is live only, on purpose. You challenge somebody who is ' +
      'playing right now, and the challenge runs out after about ' +
      'forty-five seconds \u2014 a battle you both have to be there for ' +
      'cannot be arranged in advance.\n\n' +
      'Color Rush and Ultimate to start with. Skirmish and Color War ' +
      'share prisoners between the two players, which needs more than a ' +
      'score passing back and forth to keep both phones honest.',
  },
  {
    id: 'v1-86-0-shiny-metals',
    date: '11 September 2026',
    version: 'v1.86.0',
    title: 'The gold and silver dice actually shine',
    icon: 'dice',
    body:
      'The gold dice were meant to catch the light as they turned, and ' +
      'mostly they did not \u2014 four of the six sides had no shine on ' +
      'them at all, so whichever way the dice landed you were usually ' +
      'looking at a flat yellow cube.\n\n' +
      'Every side catches the light now, each in a slightly different ' +
      'place, the way a real cube does. The bright bit is also smaller ' +
      'and sharper, which is what makes something look polished rather ' +
      'than painted.\n\n' +
      'Silver had exactly the same problem and got exactly the same fix. ' +
      'It is still the harder, cooler one of the two.',
  },
  {
    id: 'v1-85-0-dice-stay-put',
    date: '11 September 2026',
    version: 'v1.85.0',
    title: 'Your dice stay where they land',
    icon: 'dice',
    body:
      'A die that landed leaning against a wall used to jump down flat ' +
      'before the colour was counted. It looked like the game had moved ' +
      'your dice, because it had. It does not any more \u2014 whatever is ' +
      'on top is what counts, exactly as it lies.\n\n' +
      'Opening a dice set to look at it is also much faster. Every side ' +
      'of every die is now painted quietly in the background while you ' +
      'are on the menu, instead of all six being drawn in the instant you ' +
      'tap.',
  },
  {
    id: 'v1-84-0-live-friends',
    date: '10 September 2026',
    version: 'v1.84.0',
    title: 'Friends updates while you watch',
    icon: 'people',
    body:
      'When somebody accepts your friend request, it now appears on your ' +
      'friends list straight away. You used to have to close the Friends ' +
      'panel and open it again before anything changed.\n\n' +
      'It only looks while you are looking: the checking stops the moment ' +
      'you close the panel or put your phone down, and slows itself right ' +
      'down if there is no signal.\n\n' +
      'The colourblind setting also has a new picture beside it \u2014 a ' +
      'circle and a triangle, which is exactly what that mode does: every ' +
      'colour gets its own shape.',
  },
  {
    id: 'v1-82-0-friends-identity',
    date: '10 September 2026',
    version: 'v1.82.0',
    title: 'Adding a friend works again',
    icon: 'people',
    body:
      'Two things were wrong with adding somebody by their code. ' +
      'Everybody showed up as \u201cNew Player\u201d instead of their ' +
      'Game Center name, and asking to be friends could come back with ' +
      '\u201cthat did not go through \u2014 no such player\u201d.\n\n' +
      'Both came from the same mistake. The game used to swap your ' +
      'player id over to your Game Center one the moment you signed in, ' +
      'but your friend code belongs to your phone and never changes \u2014 ' +
      'so the two stopped matching and your profile could not be saved ' +
      'at all. Your id now stays put for good. Game Center supplies your ' +
      'name and nothing else.\n\n' +
      'The name also used to get stuck. Signing in to Game Center takes a ' +
      'moment, and if the game had already given up waiting it published ' +
      '\u201cNew Player\u201d and left it there. It now asks again every ' +
      'time you open Friends.\n\n' +
      'If a friend still shows as \u201cNew Player\u201d, ask them to ' +
      'open their own Friends tab once \u2014 that is when their name ' +
      'goes up.',
  },
  {
    id: 'v1-81-0-drawn-icons',
    date: '10 September 2026',
    version: 'v1.81.0',
    title: 'Every picture in the game is drawn now',
    icon: 'look',
    body:
      'The volume controls, the colourblind setting and every post on ' +
      'this page used to borrow their little pictures from the phone\u2019s ' +
      'emoji font. They are drawn now, in the same style as the rest of ' +
      'the game, so they look the same on every phone.\n\n' +
      'The volume ones had a second problem worth mentioning: the four ' +
      'speaker emoji were different widths from each other, so the word ' +
      'next to the slider slid sideways as you dragged it. It stays put ' +
      'now.\n\n' +
      'Also gone: the paragraph in the Store explaining where coins come ' +
      'from. It was pushing the dice off the bottom of the screen, and ' +
      'the Store is for looking at dice.\n\n' +
      'And tapping an item no longer flashes a blank sheet of colour ' +
      'before it opens \u2014 the shelf now stays put until the ' +
      'battlefield behind it is really ready.',
  },
  {
    id: 'v1-77-0-friends-popup',
    date: '10 September 2026',
    version: 'v1.77.0',
    title: 'Friends opens over the game',
    icon: 'people',
    body:
      'Friends is a panel now, the same as Settings and News \u2014 it ' +
      'opens on top of the game instead of taking you somewhere else, ' +
      'and the game stays visible behind it so it is obvious you have ' +
      'not left. Close it with the \u2715 or by tapping outside it.\n\n' +
      'Tapping a friend still opens their page inside the same panel, ' +
      'with their name at the top, and \u2039 Friends brings you back to ' +
      'the list.',
  },
  {
    id: 'v1-76-0-whole-dice',
    date: '10 September 2026',
    version: 'v1.76.0',
    title: 'Every side of a die is different now',
    icon: 'dice',
    body:
      'Until now a dice skin was one picture stamped on all six sides. ' +
      'Zebra was the same stripes six times, so the die looked like a ' +
      'cube with wallpaper on it rather than a striped object.\n\n' +
      'Each side now takes its own piece of one continuous design, laid ' +
      'out like the paper cube you cut out at school \u2014 so the ' +
      'stripes run round the die and over the edges instead of starting ' +
      'again at every corner.\n\n' +
      'Some patterns repeat so neatly that all six sides match anyway, ' +
      'and for those that is exactly right: the pattern already carried ' +
      'straight over the edge. Forcing them to differ would have broken ' +
      'the very thing this was for.',
  },
  {
    id: 'v1-75-0-faster-tabs',
    date: '10 September 2026',
    version: 'v1.75.0',
    title: 'Items and Store open straight away',
    icon: 'speed',
    body:
      'The Items tab took two or three seconds the first time you opened ' +
      'it, and about a second every time after. Both are gone.\n\n' +
      'Every dice picture on those shelves is drawn dot by dot while you ' +
      'wait, because a phone game has no quick way to draw them. Fifty-' +
      'three dice, all at once, in the same instant the tab was trying to ' +
      'appear. They are now drawn quietly in the background while you are ' +
      'doing something else, so by the time you tap Items they are ' +
      'already sitting there.\n\n' +
      'The second part: the shelves used to be thrown away and rebuilt ' +
      'from nothing every single time you left the tab and came back. ' +
      'They are kept now.',
  },
  {
    id: 'v1-74-0-friends-corner',
    date: '10 September 2026',
    version: 'v1.74.0',
    title: 'Friends is one tap away now',
    icon: 'people',
    body:
      'Friends has moved to the top corner of the home screen, where the ' +
      'question mark used to be. It was two taps deep behind the Ranks ' +
      'tab, which is a long way for the thing you check most often.\n\n' +
      'How to play went the other way, into Settings. It opens by itself ' +
      'the first time you ever play and most people never need it again, ' +
      'so it was holding a permanent button for a one-off \u2014 and ' +
      'Settings is where you look for the thing you want once in a ' +
      'while. It is still there whenever you want it.\n\n' +
      'And when you type in a friend code, the dash now puts itself in ' +
      'after the first four. One less thing to remember.',
  },
  {
    id: 'v1-73-0-pairing',
    date: '9 September 2026',
    version: 'v1.73.0',
    title: 'Your first hundred trophies are yours',
    icon: 'people',
    body:
      'Under 100 trophies you are always matched with a rival the game ' +
      'picks, never thrown in against somebody who already owns the ' +
      'ladder. Losing your first few battles to an expert is how people ' +
      'stop playing, and the first hundred trophies should belong to ' +
      'learning the game.\n\n' +
      'Above 100, the game is now built to spend up to fifteen seconds ' +
      'looking for another person before picking a rival instead \u2014 ' +
      'with a timer counting up so you can see how long is left.\n\n' +
      'Being straight with you: there is nobody to find yet. Playing ' +
      'against another person over the internet does not exist in this ' +
      'game, so the search has nowhere to look and goes straight to your ' +
      'rival rather than making you watch a countdown that was never ' +
      'going to end any other way. The rule is written and waiting for ' +
      'the day it can do something.',
  },
  {
    id: 'v1-72-0-folding-phone',
    date: '9 September 2026',
    version: 'v1.72.0',
    title: 'Ready for the folding iPhone',
    icon: 'phone',
    body:
      'Apple announced a folding iPhone today, and the game had two ' +
      'problems waiting for it.\n\n' +
      'The first: the game works out how much room to leave at the ' +
      'bottom for the bar you swipe up on, and it decided by height \u2014 ' +
      'short screen, old phone, no bar. A folded phone is short and ' +
      'definitely has the bar, so the buttons would have sat right on ' +
      'top of it. It now recognises the four old phones by name and ' +
      'assumes everything else has the bar.\n\n' +
      'The second: it measured the screen once, when the game started, ' +
      'because a phone never changed shape. Open a folding one and it ' +
      'does. Everything now measures as it draws.\n\n' +
      'Nobody has one yet, so this is groundwork rather than something ' +
      'you will notice \u2014 and the same fix quietly helps anyone ' +
      'running the game side by side with another app on an iPad.',
  },
  {
    id: 'v1-71-0-credits',
    date: '7 September 2026',
    version: 'v1.71.0',
    title: 'The people who made the sounds',
    icon: 'sound',
    body:
      'The music and the crowd cheer are borrowed under a licence that ' +
      'asks for one thing in return: the names have to be somewhere you ' +
      'can find them. They were in Settings \u2014 but as two tiny grey ' +
      'lines at the very bottom, right above the tiny grey version ' +
      'number, with nothing saying what they were.\n\n' +
      'Somebody went looking for them and could not find them, which is ' +
      'about as clear a verdict as you can get. They now have a heading ' +
      'of their own, in the same ink as everything else on the page, and ' +
      'Kenney is thanked too \u2014 the dice, the fanfare and the ' +
      'announcer are all his.',
  },
  {
    id: 'v1-70-0-names-and-reinstalls',
    date: '7 September 2026',
    version: 'v1.70.0',
    title: 'Your friends survive a reinstall',
    icon: 'people',
    body:
      'Delete the game, install it again, and it used to forget who you ' +
      'were. Not your trophies \u2014 your PROFILE: a new friend code, an ' +
      'empty friends list, and the code written on the card in your ' +
      'pocket suddenly belonging to nobody. There was no way back.\n\n' +
      'The phone now keeps the one thing that proves the profile is ' +
      'yours somewhere deleting the game does not reach. Reinstall and ' +
      'your code is the same code and your friends are still there, and ' +
      'the game says so when it happens.\n\n' +
      'Also: the tab that said Items now says Inventory, and the page ' +
      'behind Ranks is called Ranks instead of Leaderboard. The word you ' +
      'tap is now the word you land on \u2014 which matters most if you ' +
      'are five, or would rather not squint.',
  },
  {
    id: 'v1-69-0-battery',
    date: '7 September 2026',
    version: 'v1.69.0',
    title: 'Kinder to your battery',
    icon: 'phone',
    body:
      'The 3D board used to keep drawing itself sixty times a second even ' +
      'when nothing was moving \u2014 while you were reading the menu, while ' +
      'the split screen sat waiting on the table, even with the phone ' +
      'locked in a pocket. That is the most expensive thing this game can ' +
      'do to a phone, and it was doing it for nothing.\n\n' +
      'Now the board only draws when there is something to see: a roll, a ' +
      'prisoner leaping across, a wobble settling. Tap and it wakes ' +
      'instantly \u2014 you should not be able to tell, except that the ' +
      'phone stays cooler and lasts longer.\n\n' +
      'One real bug went with it: while your phone was locked, the ' +
      'computer opponent kept rolling. You could come back to a game you ' +
      'had lost without playing it. It waits for you now.',
  },
  {
    id: 'v1-68-0-shop',
    date: '7 September 2026',
    version: 'v1.68.0',
    title: 'A shop that takes real money — soon',
    icon: 'shop',
    body:
      'Groundwork for buying things: switching the adverts off for good, ' +
      'and coins for anyone who would rather not grind for the last ' +
      'battlefield. It is not switched on yet — that needs a new version ' +
      'of the game from the App Store.\n\n' +
      'One promise that will not change: nothing you can buy will ever ' +
      'change how the dice land. Everything for sale is something to ' +
      'look at, or an advert switched off. The moment money buys wins, ' +
      'the game stops being fair, and fair is the whole point of it.',
  },
  {
    id: 'v1-67-0-adverts',
    date: '7 September 2026',
    version: 'v1.67.0',
    title: 'One advert every third game',
    icon: 'shop',
    body:
      'The game is free, and from this update one full-screen advert ' +
      'appears after every third finished game. That is the whole of it: ' +
      'never during a battle, never a banner across the board, never a ' +
      'video you have to sit through.\n\n' +
      'Every advert is marked for a family audience, so nothing is ' +
      'chosen based on who is holding the phone and nothing follows you ' +
      'anywhere. It waits until you leave the results, so it can never ' +
      'cover a trophy or an unlock you have just won — and the next ' +
      'battle waits for you to close it.',
  },
  {
    id: 'v1-66-0-coins-shown',
    date: '7 September 2026',
    version: 'v1.66.0',
    title: 'You can see the coins you won',
    icon: 'shop',
    body:
      'Every result screen now shows the coins that battle paid, next to ' +
      'the trophies. They were being paid the whole time and never shown ' +
      'anywhere, which made the shop feel further away than it was.\n\n' +
      'Two other things: the opponent could squeeze in one more roll ' +
      'after you had already won, and switching apps in the middle of a ' +
      'roll used to drop the dice out of the air and count whatever face ' +
      'was on top. Both fixed.',
  },
  {
    id: 'v1-65-0-cups-and-floors',
    date: '7 September 2026',
    version: 'v1.65.0',
    title: 'Cups are safe, and the dice show up',
    icon: 'cups',
    body:
      'A normal battle used to count as a cup round, so an ordinary loss ' +
      'could knock you out of a cup you had paid to enter. Only rounds ' +
      'you start from Cups count now, and a run survives closing the ' +
      'game.\n\n' +
      'Entering a cup, giving up a run, removing a friend and blocking ' +
      'somebody all ask first — one stray tap used to be enough.\n\n' +
      'Eight battlefields were repainted where the floor was hiding the ' +
      'dice, the Coral Reef worst of all, and eighteen dice sets were ' +
      'redrawn.',
  },
  {
    id: 'v1-63-2-sharper-floors',
    date: '28 August 2026',
    version: 'v1.63.2',
    title: 'Sharper floors everywhere',
    icon: 'arena',
    body:
      'The arena floors were being drawn at half the detail they needed, ' +
      'so edges came out fuzzy and stepped instead of clean. Every ' +
      'battlefield is now drawn at twice the resolution, and the far end ' +
      'of the board — which the camera looks at on a slant — gets proper ' +
      'filtering as well.\n\n' +
      'It was set low back when floors took too long to build. That got ' +
      'fixed a few updates ago, so there was room to turn it up.',
  },
  {
    id: 'v1-63-1-cut-slabs',
    date: '28 August 2026',
    version: 'v1.63.1',
    title: 'Bigger pieces on the cavern floor',
    icon: 'arena',
    body:
      'The Crystal Cavern floor we put in yesterday was cut into small ' +
      'pieces, and up close that looks more like gravel than crystal. ' +
      'It is now cut into a handful of big flat faces instead, each one ' +
      'catching the light its own way — which is what the inside of a ' +
      'geode actually looks like.',
  },
  {
    id: 'v1-63-0-crystal-cavern',
    date: '28 August 2026',
    version: 'v1.63.0',
    title: 'The Crystal Cavern is made of crystal',
    icon: 'arena',
    body:
      'The family picked these two off a set of designs. The floor is ' +
      'no longer rock with a few crystals on it — the whole board is ' +
      'now the inside of a cracked geode, cut faces meeting edge to ' +
      'edge, some of them gemstone and the rest violet stone.\n\n' +
      'And the wall has proper crystal clusters along the top of it, ' +
      'all the way round: several six-sided points growing out of one ' +
      'root, tallest in the middle, the way crystal actually grows.',
  },
  {
    id: 'v1-62-3-both-free-rungs',
    date: '28 August 2026',
    version: 'v1.62.3',
    title: 'You start on both of them',
    icon: 'cups',
    body:
      'The Castle Courtyard and the Ivory Dice are both yours the moment ' +
      'you open the game, but the ladder was only highlighting one of ' +
      'them, so the other looked like something you still had to earn. ' +
      'Both are marked now.',
  },
  {
    id: 'v1-62-2-faster-floors',
    date: '27 August 2026',
    version: 'v1.62.2',
    title: 'The floors build five times faster',
    icon: 'speed',
    body:
      'Nothing looks different — this one is under the bonnet. The code ' +
      'that paints an arena floor was doing the same work six times ' +
      'over, and now it does not, so a floor takes about a fifth as ' +
      'long to appear the first time you open an arena.\n\n' +
      'Every floor comes out exactly, pixel for pixel, the way it did ' +
      'before, and there is now a test that checks that so a speed-up ' +
      'can never quietly change how a map looks.',
  },
  {
    id: 'v1-62-1-floors',
    date: '27 August 2026',
    version: 'v1.62.1',
    title: 'The floors are one piece now',
    icon: 'arena',
    body:
      'Every arena floor had a line across it about two thirds of the ' +
      'way down, where the picture ran out and started again. It was ' +
      'the same in all sixteen. Each floor is now one picture the shape ' +
      'of the board, so there is nothing to join.\n\n' +
      'The Crystal Cavern has proper crystals on it instead of jagged ' +
      'white splinters, and Glow Glade has mossy texture, rounder ' +
      'stones and spores that actually glow.',
  },
  {
    id: 'v1-62-0-ladder',
    date: '27 August 2026',
    version: 'v1.62.0',
    title: 'The ladder shows what you are climbing for',
    icon: 'cups',
    body:
      'Every rung of the ladder used to have a little emoji next to it. ' +
      'It now shows the actual thing you get — the real dice, the real ' +
      'picture of the battlefield — the same as the Store and your ' +
      'Inventory do.\n\n' +
      'The list also reads the right way round now: it starts where you ' +
      'started and climbs as you read down it.\n\n' +
      'And the top of the ladder is 10,000 trophies instead of 10,600, ' +
      'with the rungs below it moved to match. Every step up is still ' +
      'harder than the one before.',
  },
  {
    id: 'v1-61-1-soccer-and-ocean',
    date: '27 August 2026',
    version: 'v1.61.1',
    title: 'A football that looks like a football',
    icon: 'dice',
    body:
      'The Soccer Ball skin was picking its black panels at random, so ' +
      'they kept landing next to each other and running together, and ' +
      'every panel was a hexagon. A real football has black PENTAGONS ' +
      'that never touch, in among white hexagons — which is what it has ' +
      'now.\n\n' +
      'The Ocean skin has been redone too. It was a flat teal with white ' +
      'smears flying across it; it is now proper choppy water with the ' +
      'white caps breaking in runs along the swell.',
  },
  {
    id: 'v1-61-0-walls-all-the-way-round',
    date: '27 August 2026',
    version: 'v1.61.0',
    title: 'Every wall, the whole way round',
    icon: 'arena',
    body:
      'The orange rocks on Volcano Rim were all down one side. Fixing ' +
      'that turned up three more: the fence in the Snowy Woods was ' +
      'buried under the snow so you could not see a post of it, ' +
      'Rooftop City had a bare grey wall with nothing on it, and the ' +
      'bricks, driftwood and pickets on the Dune Fort, Palm Cove and ' +
      'Sunny Farm were lying sideways on two walls out of four.\n\n' +
      'All four are sorted. There is also a new tool that measures every ' +
      'wall of every arena and says which ones look bare, so this stops ' +
      'being something somebody has to spot.',
  },
  {
    id: 'v1-60-1-frozen-lights-ribs',
    date: '27 August 2026',
    version: 'v1.60.1',
    title: 'Frozen Lights goes all the way round',
    icon: 'arena',
    body:
      'The little ribs along the top of the wall in Frozen Lights were ' +
      'all down one side and none down the other. ' +
      'Last time we fixed where they sit; what was still wrong was the ' +
      'order they were listed in, so "every other one" quietly meant ' +
      '"one whole side of the arena".\n\n' +
      'They now run evenly the whole way round. The same fix tidied up ' +
      'the handrail on Rooftop City, the glowing crystals in the ' +
      'Crystal Cavern and the stacked logs in the Autumn Woods.',
  },
  {
    id: 'v1-60-0-arenas-and-dice-polish',
    date: '27 August 2026',
    version: 'v1.60.0',
    title: 'Decorations all the way round, and a lot of redrawing',
    icon: 'arena',
    body:
      'The pegs and decorations along the tops of the walls used to stop ' +
      'short at every corner, so the two short walls looked bare. They ' +
      'now run the whole way round.\n\n' +
      'The Crystal Cavern actually has crystals in it. The Coral Reef is ' +
      'full of coral in six colours and the things on its walls are ' +
      'brain corals and sea fans instead of spikes. The Moon Base floor ' +
      'is cratered dust. Sunny Farm has ploughed furrows and a lot more ' +
      'hay, trees and flowers. Glow Glade has brighter moss and pale ' +
      'stepping stones. Rooftop City has a hatch, ducting and painted ' +
      'lines. The Sky Kingdom has three times the clouds. And the Autumn ' +
      'Woods floor has proper red and gold leaves on it.\n\n' +
      'On the dice: Ruby is now Gold in red, the bubbles look like real ' +
      'bubbles, the cow has proper cow markings instead of a repeating ' +
      'pattern, the soccer ball is plain black and white hexagons, the ' +
      'bumblebee has lost its spots and the odd yellow dot on the denim ' +
      'is gone. The golf ball, turtle, snake, basketball and ocean were ' +
      'all redrawn too.',
  },
  {
    id: 'v1-59-0-ultimate-icon',
    date: '26 August 2026',
    version: 'v1.59.0',
    title: 'The Ultimate icon, finally',
    icon: 'look',
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
    icon: 'fix',
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
    icon: 'fix',
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
    icon: 'fix',
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
    icon: 'look',
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
    icon: 'dice',
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
    icon: 'arena',
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
    icon: 'arena',
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
    icon: 'look',
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
    icon: 'dice',
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
    icon: 'look',
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
    icon: 'fix',
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
    icon: 'shop',
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
    icon: 'look',
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
    icon: 'look',
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
    icon: 'fix',
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
    icon: 'arena',
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
    icon: 'speed',
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
    icon: 'arena',
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
    icon: 'speed',
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
    icon: 'dice',
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
    icon: 'dice',
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
    icon: 'people',
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
    icon: 'arena',
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
    icon: 'help',
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
    icon: 'shop',
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
    icon: 'cups',
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
    icon: 'dice',
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
    icon: 'people',
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
    icon: 'look',
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
