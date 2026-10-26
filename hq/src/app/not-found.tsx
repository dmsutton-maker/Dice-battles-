import { SitePage } from '@/components/site/SitePage';
import { colors, fonts } from '@/components/site/tokens';

/**
 * The 404, in the studio's own clothes.
 *
 * Next's default is an unbranded black-on-white page carrying a
 * `prefers-color-scheme: dark` rule — on a brand with no dark mode at
 * all, which meant half of everyone who mistyped a URL saw a stark dark
 * page belonging to nobody, with no way back.
 */
export default function NotFound() {
  return (
    <SitePage active="none">
      <main
        style={{
          padding: '90px 24px 120px',
          maxWidth: 560,
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            font: `800 12px ${fonts.body}`,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: colors.orangeText,
            margin: '0 0 10px',
          }}
        >
          Page not found
        </p>
        <h1 style={{ font: `800 34px/1.2 ${fonts.heading}`, color: colors.ink, margin: '0 0 14px' }}>
          We could not find that page
        </h1>
        <p style={{ font: `400 16px/1.7 ${fonts.body}`, color: colors.body, margin: '0 0 28px' }}>
          It may have moved, or the address may have a typo in it. Everything
          we make is one tap away from the home page.
        </p>
        <a
          href="/"
          style={{
            display: 'inline-block',
            padding: '13px 26px',
            borderRadius: 999,
            background: colors.ink,
            color: colors.white,
            font: `800 14px ${fonts.body}`,
            textDecoration: 'none',
          }}
        >
          Back to Paper Ship Studio
        </a>
      </main>
    </SitePage>
  );
}
