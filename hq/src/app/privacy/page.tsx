import { pageMetadata } from '@/lib/metadata';
import { SitePage } from '@/components/site/SitePage';
import { colors, fonts } from '@/components/site/tokens';
import { getContentUpdatedAt, getSiteContent, monthYear } from '@/lib/content';
import { legalPage, PRIVACY } from '@/lib/legalCopy';

// Editable in the admin, with the copy in lib/legalCopy.ts as the default.
export const generateMetadata = pageMetadata('privacy', {
  title: 'Privacy Policy — Paper Ship Studio',
  description: PRIVACY.metaDescription,
});

export const dynamic = 'force-dynamic';

export default async function PrivacyPage() {
  const content = await getSiteContent();
  // The newer of the code copy and the admin's saved copy, and the date
  // it dates from (lib/legalCopy.ts says why).
  const { intro, sections, updated: when } = legalPage(PRIVACY, content, 'privacy', await getContentUpdatedAt('privacy.'));
  const updated = monthYear(when, '');

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
