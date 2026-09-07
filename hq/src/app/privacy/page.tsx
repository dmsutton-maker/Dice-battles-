import { pageMetadata } from '@/lib/metadata';
import { SitePage } from '@/components/site/SitePage';
import { colors, fonts } from '@/components/site/tokens';
import { getContentUpdatedAt, getSiteContent, monthYear, sectionList, text } from '@/lib/content';

// Editable in the admin, with the copy below as the default.
export const generateMetadata = pageMetadata('privacy', {
  title: 'Privacy Policy — Paper Ship Studio',
  description:
    'No accounts and no tracking. Adding a friend, reporting a bug or writing to us sends a little information — this page says exactly what, and why.',
});

export const dynamic = 'force-dynamic';

const DEFAULT_INTRO =
  'Paper Ship Studio ("we," "us," or "the studio") is a small, independent game studio, currently operated by its owner as an individual and trading under the Paper Ship Studio name. This policy covers every app we publish, including Dice Battles: Color Rush.';

const DEFAULT_SECTIONS = [
  {
    heading: 'The short version',
    body: 'There are no accounts to sign up for, no analytics, and nothing that tracks you around the internet. Most of the game never talks to us at all — your progress, coins and unlocked items live on your device. Three things do send us something: adding a friend, sending a bug report, and writing to us through the contact form. Each is explained below, and each only happens if you choose it.',
  },
  {
    heading: 'Friends',
    body: 'Friends is optional, and nothing is sent unless you open it. When you do, the game stores a profile on our server so the people you add can see it: the name Game Center gives you (or “New Player” if you are not signed in), a random player id, your friend code, your trophy count, how many battles you have won at each difficulty and in each game mode, how many dice sets and battlefields you own, your chosen die and battlefield, and when you last played. Your friend list is stored too, including requests and anyone you have blocked. Blocks are private — the other person is never told. There is nowhere in Friends to type a message or a profile description, on purpose.',
  },
  {
    heading: 'Bug reports and the contact form',
    body: 'If you send a bug report from inside the game, we receive what you typed plus your device model, its operating system version and the game version — that last part is what makes a report useful. If you write to us through the contact form on this website, we receive your name, your email address and your message, so that we can reply.',
  },
  {
    heading: 'Advertising',
    body: 'Dice Battles: Color Rush is free, and adverts are what pay for it: one full-screen advert after every third finished game, and nothing else — no banners, no video rewards, nothing during a game. They come from Google AdMob, and every single request is marked as child-directed and non-personalised and capped at a G rating. In plain terms: AdMob is told not to build a profile of whoever is holding the phone and not to use anything about them to choose the advert. That is why the game never asks permission to track you.',
  },
  {
    heading: 'Where it is kept, and for how long',
    body: 'The little we do hold is stored in a Supabase database and served through Vercel, both in the United States. We keep it for as long as the game is running, and we will delete anything belonging to you if you ask us at hello@papershipstudio.com.',
  },
  {
    heading: 'Children\'s privacy',
    body: 'The game is made for families and is rated for ages 4 and up. It asks no one their age, their name or their email. Friends is built on Apple\'s Game Center precisely so that we do not have to: Apple already holds the account, already has a parent\'s consent where one is needed, and moderates the nickname that other players see. We collect no other personal details from anyone, at any age. If you have a question about a younger player, write to us at the address below.',
  },
  {
    heading: 'App Store and platform data',
    body: 'Apple, Google, or your device\'s operating system may collect standard information as part of operating their app stores and platforms (such as download counts or crash logs at the OS level). That collection is governed by their own privacy policies, not ours — we don\'t receive or request personal data from them.',
  },
  {
    heading: 'Changes to this policy',
    body: 'If this policy ever changes — for example, if a future app needs to work differently — we\'ll update this page and change the date at the top.',
  },
  {
    heading: 'Contact us',
    body: 'Questions about this policy or how a specific app works can go to hello@papershipstudio.com.',
  },
];

export default async function PrivacyPage() {
  const content = await getSiteContent();
  // The date the copy on THIS page was last edited, so an edit in the
  // admin cannot leave the page claiming a policy older than it is.
  const updated = monthYear(await getContentUpdatedAt('privacy.'), 'August 2026');
  const sections = sectionList(content, 'privacy.sections', DEFAULT_SECTIONS);
  const intro = text(content, 'privacy.intro', DEFAULT_INTRO);

  return (
    <SitePage active="none">
      {/* A landmark, so "skip to content" and a screen reader's page
          outline both have somewhere to land — the support page already
          had one and these two did not. */}
      <main>
      <section
        className="psg-wrap"
        style={{ padding: '32px 56px 90px', maxWidth: 720, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}
      >
        <h1 style={{ font: `800 34px/1.2 ${fonts.heading}`, margin: '0 0 6px', color: colors.ink }}>
          Privacy Policy
        </h1>
        <p style={{ font: `600 13px ${fonts.body}`, color: colors.muted, margin: '0 0 32px' }}>
          Last updated {updated} · Applies to all Paper Ship Studio apps
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, font: `400 15.5px/1.7 ${fonts.body}`, color: colors.body }}>
          <p>{intro}</p>

          {sections.map((s) => (
            <div key={s.heading}>
              <h2 style={{ font: `700 19px ${fonts.heading}`, color: colors.ink, margin: '0 0 8px' }}>{s.heading}</h2>
              <p style={{ margin: 0 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </section>
      </main>
    </SitePage>
  );
}
