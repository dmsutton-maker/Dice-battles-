import type { Metadata } from 'next';
import { SitePage } from '@/components/site/SitePage';
import { colors, fonts } from '@/components/site/tokens';
import { getSiteContent, sectionList, text } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Terms of Use — Paper Ship Studio',
  description: 'The terms that cover your use of any app published by Paper Ship Studio.',
};

export const dynamic = 'force-dynamic';

const DEFAULT_INTRO =
  'These terms cover your use of any app published by Paper Ship Studio, including Dice Battles: Color Rush. Paper Ship Studio is currently operated by its owner as an individual, trading under the Paper Ship Studio name, and is not yet a registered company. By downloading or using our apps, you agree to these terms.';

const DEFAULT_SECTIONS = [
  {
    heading: 'Using our apps',
    body: "Our apps are provided for personal, non-commercial entertainment. You're welcome to play, and to let your family and friends play, for as long as you like.",
  },
  {
    heading: 'No accounts, your device, your data',
    body: "Our apps don't require an account and don't collect personal data (see our Privacy Policy). Any game progress is stored on your own device and is yours to keep or delete.",
  },
  {
    heading: 'Intellectual property',
    body: 'The Paper Ship Studio name, logo, and the design, artwork, and code of our apps belong to Paper Ship Studio. You may not copy, redistribute, or resell any part of our apps without our permission.',
  },
  {
    heading: 'No warranty',
    body: 'We build our apps carefully, but they\'re provided "as is," without warranties of any kind. We\'re not liable for any issues arising from your use of them, to the extent permitted by law.',
  },
  {
    heading: 'Changes',
    body: "We may update these terms as the studio grows — for example, if we incorporate or add new apps. We'll update the date at the top when we do.",
  },
  {
    heading: 'Contact us',
    body: 'Questions about these terms can go to hello@papershipstudio.com.',
  },
];

export default async function TermsPage() {
  const content = await getSiteContent();
  const sections = sectionList(content, 'terms.sections', DEFAULT_SECTIONS);
  const intro = text(content, 'terms.intro', DEFAULT_INTRO);

  return (
    <SitePage active="none">
      <section
        className="psg-wrap"
        style={{ padding: '32px 56px 90px', maxWidth: 720, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}
      >
        <h1 style={{ font: `800 34px/1.2 ${fonts.heading}`, margin: '0 0 6px', color: colors.ink }}>
          Terms of Use
        </h1>
        <p style={{ font: `600 13px ${fonts.body}`, color: colors.muted, margin: '0 0 32px' }}>
          Last updated August 2026 · Applies to all Paper Ship Studio apps
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
    </SitePage>
  );
}
