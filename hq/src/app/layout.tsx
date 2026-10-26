import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Paper Ship Studio',
  description:
    'Paper Ship Studio is an independent studio building simple, well-made games for players of any age — starting with Dice Battles: Color Rush.',
  /*
    Saved to a phone's home screen (David, 22 Oct 2026: "it should have a
    little icon logo"): the paper ship, from apple-icon.png beside this
    file for iPhones and manifest.ts for Android. The short title is
    what fits under a home-screen icon.
  */
  appleWebApp: { title: 'Paper Ship' },
};

/**
 * Deliberately bare: the public marketing pages (/, /games, /support,
 * /privacy, /terms) bring their own header and footer via SitePage, and
 * the private board under /admin brings its own nav via admin/layout.tsx. This
 * root layout only owns the one thing every route needs — globals.css,
 * which the internal board and the auth pages (/login, /password) still
 * depend on for their dark theme.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
