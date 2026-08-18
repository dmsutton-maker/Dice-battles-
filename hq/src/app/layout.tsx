import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Paper Ship Studio',
  description:
    'Paper Ship Studio is an independent studio building simple, well-made games for players of any age — starting with Dice Battles: Color Rush.',
};

/**
 * Deliberately bare: the public marketing pages (/, /apps, /support,
 * /privacy, /terms) bring their own header and footer via SitePage, and
 * the private board under /hq brings its own nav via hq/layout.tsx. This
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
