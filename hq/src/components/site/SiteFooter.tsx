import Link from 'next/link';
import styles from '@/app/site.module.css';
import { Logo } from './Logo';
import { colors, fonts } from './tokens';

export function SiteFooter() {
  return (
    <footer
      className="psg-wrap psg-footer"
      style={{
        marginTop: 'auto',
        borderTop: `1px solid ${colors.hairline}`,
        padding: '36px 56px',
        maxWidth: 1200,
        marginLeft: 'auto',
        marginRight: 'auto',
        width: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Logo size={20} />
        <span style={{ font: `600 13px ${fonts.body}`, color: colors.secondary2 }}>
          &copy; {new Date().getFullYear()} Paper Ship Studio
        </span>
      </div>
      <div style={{ display: 'flex', gap: 24, font: `700 13px ${fonts.body}` }}>
        <Link href="/privacy" className={styles.link} style={{ color: colors.secondary2 }}>
          Privacy Policy
        </Link>
        <Link href="/terms" className={styles.link} style={{ color: colors.secondary2 }}>
          Terms of Use
        </Link>
      </div>
    </footer>
  );
}
