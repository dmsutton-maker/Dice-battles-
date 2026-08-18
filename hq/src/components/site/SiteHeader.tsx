import Link from 'next/link';
import styles from '@/app/site.module.css';
import { Logo } from './Logo';
import { colors, fonts } from './tokens';

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/apps', label: 'Apps' },
  { href: '/support', label: 'Support' },
] as const;

export function SiteHeader({ active }: { active: 'Home' | 'Apps' | 'Support' | 'none' }) {
  return (
    <header
      className="psg-wrap"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '26px 56px',
        maxWidth: 1200,
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
        flexWrap: 'wrap',
        gap: 16,
      }}
    >
      <Link
        href="/"
        className={styles.link}
        style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}
      >
        <Logo size={30} />
        <span style={{ font: `800 18px ${fonts.heading}`, color: colors.ink }}>
          Paper Ship Studio
        </span>
      </Link>
      <nav
        className="psg-nav"
        style={{ display: 'flex', gap: 32, font: `700 14px ${fonts.body}`, color: colors.body }}
      >
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={styles.link}
            style={{ color: active === item.label ? colors.ink : colors.body, textDecoration: 'none' }}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
