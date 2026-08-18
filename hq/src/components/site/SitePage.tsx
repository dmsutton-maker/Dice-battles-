import type { ReactNode } from 'react';
import styles from '@/app/site.module.css';
import { baloo2, nunito } from './fonts';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import { fonts } from './tokens';

/** Shared chrome + fonts for every public Paper Ship Studio page. Never used by /admin. */
export function SitePage({
  active,
  children,
}: {
  active: 'Home' | 'Apps' | 'Support' | 'none';
  children: ReactNode;
}) {
  return (
    <div
      className={`${baloo2.variable} ${nunito.variable} ${styles.page}`}
      style={{
        background: '#ffffff',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: fonts.body,
      }}
    >
      <SiteHeader active={active} />
      {children}
      <SiteFooter />
    </div>
  );
}
