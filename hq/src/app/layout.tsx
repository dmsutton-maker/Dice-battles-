import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dice Battles: Color Rush',
  description:
    'A frantic two-dice colour race for iPhone. Match both dice to a colour, free that prisoner, first to six wins.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <div className="topbar-inner">
            <Link href="/" className="brand">
              ⚔️ DICE BATTLES
            </Link>
            <nav>
              <Link href="/">Home</Link>
              <Link href="/support">Support</Link>
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
              <Link href="/hq">HQ</Link>
            </nav>
          </div>
        </header>
        {children}
        <footer className="site">
          <div>
            © {new Date().getFullYear()} David Sutton, operating as{' '}
            <strong>Paper Ship Studio</strong>. Dice Battles: Color Rush is
            an independent game, made by one family.
          </div>
          <div style={{ marginTop: 8 }}>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/support">Support</Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
