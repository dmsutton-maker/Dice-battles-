import type { Metadata } from 'next';
import { SitePage } from '@/components/site/SitePage';
import { colors, fonts } from '@/components/site/tokens';
import { getSiteContent, sectionList } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Privacy Policy — Paper Ship Studio',
  description:
    "Paper Ship Studio doesn't collect personal information, show ads, or use analytics or tracking tools of any kind, across every app we publish.",
};

export const dynamic = 'force-dynamic';

const DEFAULT_SECTIONS = [
  {
    heading: 'The short version',
    body: "We don't collect personal information, we don't show ads, and we don't use analytics or tracking tools of any kind. There are no accounts to create and no data leaves your device because of our apps.",
  },
  {
    heading: 'Information we collect',
    body: "None. Our apps don't require sign-up, don't ask for personal details, and don't include any analytics, advertising, or crash-reporting software that would send data about you or your device to us or to any third party.",
  },
  {
    heading: "Children's privacy",
    body: "Our apps are designed to be friendly to young players, including kids who can't read yet. Because we don't collect any personal information from anyone — regardless of age — there is no personal information collected from children either. If you have questions about a specific app and younger players, reach out at the address below.",
  },
  {
    heading: 'App Store and platform data',
    body: "Apple, Google, or your device's operating system may collect standard information as part of operating their app stores and platforms (such as download counts or crash logs at the OS level). That collection is governed by their own privacy policies, not ours — we don't receive or request personal data from them.",
  },
  {
    heading: 'Changes to this policy',
    body: "If this policy ever changes — for example, if a future app needs to work differently — we'll update this page and change the date at the top.",
  },
  {
    heading: 'Contact us',
    body: 'Questions about this policy or how a specific app works can go to hello@papershipstudio.com.',
  },
];

export default async function PrivacyPage() {
  const content = await getSiteContent();
  const sections = sectionList(content, 'privacy.sections', DEFAULT_SECTIONS);

  return (
    <SitePage active="none">
      <section
        className="psg-wrap"
        style={{ padding: '32px 56px 90px', maxWidth: 720, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}
      >
        <h1 style={{ font: `800 34px/1.2 ${fonts.heading}`, margin: '0 0 6px', color: colors.ink }}>
          Privacy Policy
        </h1>
        <p style={{ font: `600 13px ${fonts.body}`, color: colors.muted, margin: '0 0 32px' }}>
          Last updated August 2026 · Applies to all Paper Ship Studio apps
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, font: `400 15.5px/1.7 ${fonts.body}`, color: colors.body }}>
          <p>
            Paper Ship Studio (&quot;we,&quot; &quot;us,&quot; or &quot;the studio&quot;) is a
            small, independent game studio, currently operated by its owner as an individual and
            trading under the Paper Ship Studio name. This policy covers every app we publish,
            including Dice Battles: Color Rush.
          </p>

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
