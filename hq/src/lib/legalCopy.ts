import { sectionList, text, type ContentMap, type Section } from './content';

/**
 * The Privacy Policy and Terms of Use, as written in code.
 *
 * Both pages can also be edited in the admin, and an edit there is stored
 * in `site_content`. Until 23 Oct 2026 a stored copy always won, which
 * meant that once anybody had pressed Save in the admin (somebody did,
 * in September, with the text unchanged), rewriting the policy in code
 * changed nothing on the live page — on the one page Apple checks
 * against what the app really does.
 *
 * So now the NEWER of the two wins: the copy here carries the date it
 * was written, and a stored copy is used only if it was saved after that.
 * An edit in the admin tomorrow still wins; an old save does not mask a
 * new policy. The admin form opens on whichever copy is showing, so
 * saving it never quietly puts the old wording back.
 */
export interface LegalCopy {
  /** The day this copy was written, YYYY-MM-DD. */
  written: string;
  intro: string;
  sections: Section[];
  metaDescription: string;
}

export const PRIVACY: LegalCopy = {
  written: '2026-11-05',
  metaDescription:
    'No accounts and no tracking. Friends, online battles, notifications and bug reports send a little information. This page says exactly what, and why.',
  intro:
    'Paper Ship Studio LLC ("we," "us," or "the studio") is a small, independent game studio, a limited liability company. This policy covers every app we publish, including Dice Battles: Color Rush.',
  sections: [
    {
      heading: 'The short version',
      body: 'There are no accounts to sign up for, no analytics, and nothing that tracks you around the internet. Most of the game never talks to us at all: your progress, coins, purchases and unlocked items live on your device, and the game keeps a copy of your progress on our server only so that it survives a reinstall. A few things do send us something: that backup, adding a friend, battling a friend, playing online against other players once you reach 100 trophies, turning on update notifications, sending a bug report, and writing to us through the contact form. Each is explained below.',
    },
    {
      heading: 'Your progress backup',
      body: 'So that deleting the game and installing it again does not start you over, the game keeps a copy of your progress on our server: your trophies and battle record, your coins and the items you have earned or bought with them, which die and battlefield you have equipped, your season pass experience and daily quest, and your sound, colourblind and how-to-play settings. It is stored with the same random player id your device uses for Friends, so only your device can read it back, and it is never shown to anyone else. Purchases made with real money are not in it: Restore Purchases asks Apple for those. The backup is deleted with everything else belonging to you if you ask us at hello@papershipstudio.com. So that a new iPhone can find your backup too, the game also keeps your player id, friend code, the device secret, your Game Center name and your trophy count in your own iCloud account, using Apple\'s iCloud storage for apps. That copy is stored by Apple under your Apple ID, not by us, and we cannot see it. On a new iPhone that has not been played yet, the game asks whether you are one of the players it found there, and only uses one if you pick it.',
    },
    {
      heading: 'Friends',
      body: 'Friends is optional, and nothing is sent unless you open it or play online (see Online battles, below). When you do, the game stores a profile on our server so the people you add can see it: the name Game Center gives you (or “New Player” if you are not signed in), a random player id, your friend code, your trophy count, how many battles you have won at each difficulty and in each game mode, how many dice sets and battlefields you own, your chosen die and battlefield, and when you last played. Your friend list is stored too, including requests and anyone you have blocked. Blocks are private, and the other person is never told. There is nowhere in Friends to type a message or a profile description, on purpose.',
    },
    {
      heading: 'Battling a friend',
      body: 'You can only challenge someone who is already your friend. While a challenge or a battle is going on, our server keeps what both phones need to play it: who is playing whom, the game mode and difficulty, which prisoners each of you has freed, when each phone last checked in (so the game can tell you if your friend has gone quiet), and who won. Nothing typed, spoken or filmed is ever sent, because there is nowhere to type, speak or film.',
    },
    {
      heading: 'Online battles',
      body: 'Once you have 100 trophies, a Color Rush or Ultimate battle looks for a real player for up to 15 seconds, and plays the computer instead if it finds nobody. Below 100 trophies, in the other game modes, and in Practice (in Settings) you always play the computer. To look for someone, the game stores the same profile described under Friends. While it looks, our server also keeps your player id, the game mode and difficulty, your trophy count (so you are paired with someone near your level), when you started looking and last checked in, and who you were paired with. That search record is deleted once you have stopped searching for ten minutes, the next time anyone searches. Once you are paired, the battle works exactly like a friend battle, described above. The other player sees only your Game Center name (or just “Player”) and how your game is going: never your friend code, your player id or anything else from your profile. Players who have blocked each other are never paired, and there is no chat of any kind.',
    },
    {
      heading: 'Purchases',
      body: 'Anything you buy in the game, such as Remove Ads, a coin pack, a die, a battlefield or the Gold Pass, is bought from Apple through the App Store. Apple takes the payment. We never see your name, your Apple ID, your card or your address. What you have bought is remembered on your own device, and Restore Purchases asks Apple for the list again; it is never sent to us.',
    },
    {
      heading: 'Update notifications',
      body: 'The game can tell you when a new update is ready, but only if you say yes when it asks. If you do, we store the address your phone gives us for notifications, your random player id and your game version. We use it to send one message to everybody when an update is out, never an ad, and there is no way for us to message one player on their own. You can turn notifications off at any time in the game\'s Settings or in your phone\'s Settings.',
    },
    {
      heading: 'News and cups',
      body: 'The game downloads the latest news and this week\'s cups from our website. That request carries nothing about you. Like every website, our host sees the internet address a request comes from and keeps it briefly in its server logs; we do not use it for anything.',
    },
    {
      heading: 'Bug reports and the contact form',
      body: 'If you send a bug report from inside the game, we receive what you typed plus your device model, its operating system version and the game version. That last part is what makes a report useful. If you write to us through the contact form on this website, we receive your name, your email address and your message, so that we can reply.',
    },
    {
      heading: 'Advertising',
      body: 'Dice Battles: Color Rush is free, and ads are what pay for it: one full-screen ad after every third finished game, and nothing else. There are no banners, no video rewards and nothing during a game, and buying Remove Ads switches them off. They come from Google AdMob, and every single request is marked as child-directed and non-personalised and capped at a G rating. In plain terms, AdMob is told not to build a profile of whoever is holding the phone and not to use anything about them to choose the ad. That is why the game never asks permission to track you. To show an ad at all, AdMob still receives what every ad request carries: the phone\'s IP address (which gives a rough idea of the country or city), a device identifier, basic details about the phone and the game, whether an ad was shown or tapped, and crash and performance information about the ad itself. Google uses that to deliver and count ads and to stop fraud, under its own privacy policy at policies.google.com/privacy.',
    },
    {
      heading: 'Game Center',
      body: 'If you are signed in to Game Center on your phone, the game sends your trophy count and your achievements to Apple\'s Game Center, so that leaderboards and achievements work. That is handled by Apple under Apple\'s own privacy policy.',
    },
    {
      heading: 'Where it is kept, and for how long',
      body: 'The little we do hold is stored in a Supabase database and served through Vercel, both in the United States. We keep it for as long as the game is running, and we will delete anything belonging to you if you ask us at hello@papershipstudio.com.',
    },
    {
      heading: 'Children\'s privacy',
      body: 'The game is made for families and is rated for ages 4 and up. It asks no one their age, their name or their email. Friends and online battles are built on Apple\'s Game Center precisely so that we do not have to: Apple already holds the account, already has a parent\'s consent where one is needed, and moderates the nickname that other players see. Purchases go through Apple too, so a parent\'s Ask to Buy and Screen Time settings apply. We collect no other personal details from anyone, at any age. If you have a question about a younger player, write to us at the address below.',
    },
    {
      heading: 'App Store and platform data',
      body: 'Apple, Google, or your device\'s operating system may collect standard information as part of operating their app stores and platforms (such as download counts or crash logs at the OS level). That collection is governed by their own privacy policies, not ours. We don\'t receive or request personal data from them.',
    },
    {
      heading: 'Changes to this policy',
      body: 'If this policy ever changes, for example because the game starts doing something new, we\'ll update this page and change the date at the top.',
    },
    {
      heading: 'Contact us',
      body: 'Questions about this policy or how a specific app works can go to hello@papershipstudio.com.',
    },
  ],
};

export const TERMS: LegalCopy = {
  written: '2026-11-05',
  metaDescription: 'The terms that cover your use of any app published by Paper Ship Studio, including purchases and the Gold Pass.',
  intro:
    'These terms cover your use of any app published by Paper Ship Studio LLC, including Dice Battles: Color Rush. By downloading or using our apps, you agree to these terms.',
  sections: [
    {
      heading: 'Using our apps',
      body: 'Our apps are provided for personal, non-commercial entertainment. You\'re welcome to play, and to let your family and friends play, for as long as you like.',
    },
    {
      heading: 'No accounts, and where your things are kept',
      body: 'Our apps don\'t require an account. Your progress, coins, purchases and unlocked items are stored on your own device and are yours to keep or delete, and the game keeps a copy of your progress on our server so that deleting and reinstalling it does not start you over. If you use Friends, battle a friend or play online, what other players can see is stored on our server too. Our Privacy Policy sets out exactly what that includes.',
    },
    {
      heading: 'Purchases',
      body: 'The game is free to play. Some things can be bought with real money, and the price is always shown by the App Store before you pay. Apple handles every payment, and refunds are requested from Apple at reportaproblem.apple.com. Coins and items bought or won are for use in the game only: they have no cash value and cannot be swapped, sold or moved to another person. Remove Ads, dice and battlefields are bought once and kept, and Restore Purchases brings them back on a new phone.',
    },
    {
      heading: 'The Gold Pass',
      body: 'A season normally runs for one calendar month, starting at midnight on the 1st, New York time; the game says when the current one ends. The Gold Pass opens the Gold rewards for the season it is bought in and ends when that season ends, so a pass bought on the 28th still ends on the 1st. It does not renew on its own and is never charged again unless you buy it again. Rewards you have earned stay yours after the season ends.',
    },
    {
      heading: 'Seasons, cups and prizes change',
      body: 'Cups change every week and seasons change every month. We may retune a cup, change a prize, or change how the game works, to keep it fair and fun. Anything you have already bought or earned stays yours.',
    },
    {
      heading: 'Being a good neighbour in Friends and online',
      body: 'Friends works by sharing a code with someone you already know. Please do not use it, or friend battles, to bother anyone. You can remove a friend at any time, and blocking someone is silent: they are not told, and they cannot ask again. Online battles pair you with players you may not know, so play fair: no tampering with the game to win. We may remove a player from Friends or from online battles if they cheat or use either to harass others.',
    },
    {
      heading: 'Intellectual property',
      body: 'The Paper Ship Studio name and logo, the name Dice Battles: Color Rush, and the design, artwork, and code of our apps belong to Paper Ship Studio LLC. Paper Ship Studio and Dice Battles: Color Rush are trademarks of Paper Ship Studio LLC. You may not copy, redistribute, or resell any part of our apps without our permission.',
    },
    {
      heading: 'No warranty',
      body: 'We build our apps carefully, but they\'re provided "as is," without warranties of any kind. We\'re not liable for any issues arising from your use of them, to the extent permitted by law. Nothing here takes away any right you have under the law where you live, or under Apple\'s own terms for the App Store.',
    },
    {
      heading: 'Changes',
      body: 'We may update these terms as the studio grows, for example if we incorporate or add new apps. We\'ll update the date at the top when we do.',
    },
    {
      heading: 'Contact us',
      body: 'Questions about these terms can go to hello@papershipstudio.com.',
    },
  ],
};

/** The instant a code copy was written, midnight New York time. */
function writtenAt(copy: LegalCopy): Date {
  return new Date(`${copy.written}T05:00:00Z`);
}

/** True when the copy saved in the admin is newer than the code's. */
export function storedIsNewer(copy: LegalCopy, storedAt: Date | null): boolean {
  return storedAt !== null && storedAt.getTime() > writtenAt(copy).getTime();
}

/**
 * What a legal page shows: the stored copy if it was saved after the code
 * copy was written, the code copy otherwise. `updated` is the date the
 * winning copy dates from, for "Last updated".
 */
export function legalPage(
  copy: LegalCopy,
  content: ContentMap,
  prefix: 'privacy' | 'terms',
  storedAt: Date | null,
): { intro: string; sections: Section[]; updated: Date } {
  if (storedAt !== null && storedIsNewer(copy, storedAt)) {
    return {
      intro: text(content, `${prefix}.intro`, copy.intro),
      sections: sectionList(content, `${prefix}.sections`, copy.sections),
      updated: storedAt,
    };
  }
  return { intro: copy.intro, sections: copy.sections, updated: writtenAt(copy) };
}
