import type { Metadata } from 'next';
import Link from 'next/link';
import { SitePage } from '@/components/site/SitePage';
import { colors, fonts } from '@/components/site/tokens';

export const metadata: Metadata = {
  title: 'Terms of Use — Paper Ship Studio',
  description: 'The terms that cover your use of any app published by Paper Ship Studio.',
};

export default function TermsPage() {
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
          <p>
            These terms cover your use of any app published by Paper Ship Studio, including Dice
            Battles: Color Rush. Paper Ship Studio is currently operated by its owner as an
            individual, trading under the Paper Ship Studio name, and is not yet a registered
            company. By downloading or using our apps, you agree to these terms.
          </p>

          <div>
            <h2 style={{ font: `700 19px ${fonts.heading}`, color: colors.ink, margin: '0 0 8px' }}>Using our apps</h2>
            <p style={{ margin: 0 }}>
              Our apps are provided for personal, non-commercial entertainment. You&apos;re
              welcome to play, and to let your family and friends play, for as long as you like.
            </p>
          </div>

          <div>
            <h2 style={{ font: `700 19px ${fonts.heading}`, color: colors.ink, margin: '0 0 8px' }}>
              No accounts, your device, your data
            </h2>
            <p style={{ margin: 0 }}>
              Our apps don&apos;t require an account and don&apos;t collect personal data (see our{' '}
              <Link href="/privacy" style={{ color: colors.cyan }}>
                Privacy Policy
              </Link>
              ). Any game progress is stored on your own device and is yours to keep or delete.
            </p>
          </div>

          <div>
            <h2 style={{ font: `700 19px ${fonts.heading}`, color: colors.ink, margin: '0 0 8px' }}>
              Intellectual property
            </h2>
            <p style={{ margin: 0 }}>
              The Paper Ship Studio name, logo, and the design, artwork, and code of our apps
              belong to Paper Ship Studio. You may not copy, redistribute, or resell any part of
              our apps without our permission.
            </p>
          </div>

          <div>
            <h2 style={{ font: `700 19px ${fonts.heading}`, color: colors.ink, margin: '0 0 8px' }}>No warranty</h2>
            <p style={{ margin: 0 }}>
              We build our apps carefully, but they&apos;re provided &quot;as is,&quot; without
              warranties of any kind. We&apos;re not liable for any issues arising from your use
              of them, to the extent permitted by law.
            </p>
          </div>

          <div>
            <h2 style={{ font: `700 19px ${fonts.heading}`, color: colors.ink, margin: '0 0 8px' }}>Changes</h2>
            <p style={{ margin: 0 }}>
              We may update these terms as the studio grows — for example, if we incorporate or
              add new apps. We&apos;ll update the date at the top when we do.
            </p>
          </div>

          <div>
            <h2 style={{ font: `700 19px ${fonts.heading}`, color: colors.ink, margin: '0 0 8px' }}>Contact us</h2>
            <p style={{ margin: 0 }}>
              Questions about these terms can go to{' '}
              <a href="mailto:hello@papershipstudio.com" style={{ color: colors.cyan }}>
                hello@papershipstudio.com
              </a>
              .
            </p>
          </div>
        </div>
      </section>
    </SitePage>
  );
}
