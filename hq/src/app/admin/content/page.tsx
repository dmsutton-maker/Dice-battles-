import Link from 'next/link';

/** Each public page gets its own editor, rather than one endless form. */
const PAGES = [
  { href: '/admin/content/home', emoji: '🏠', name: 'Home', what: 'The headline, the studio blurb, and the Dice Battles card.' },
  { href: '/admin/content/apps', emoji: '📱', name: 'Apps', what: 'The apps list and how the game is described there.' },
  { href: '/admin/content/dice-battles', emoji: '🎲', name: 'Dice Battles', what: 'Description, the claim badges, highlights, FAQ, and extra sections.' },
  { href: '/admin/content/support', emoji: '✉️', name: 'Support', what: 'The intro and the note under the contact form.' },
  { href: '/admin/content/privacy', emoji: '🔒', name: 'Privacy Policy', what: 'Every section of the policy.' },
  { href: '/admin/content/terms', emoji: '📜', name: 'Terms of Use', what: 'Every section of the terms.' },
];

export default function ContentIndex() {
  return (
    <>
      <p className="muted">
        Everything written on the public site. Pick a page — each one saves on
        its own, and takes effect the moment you press Save.
      </p>
      {PAGES.map((p) => (
        <Link key={p.href} href={p.href} className="idea" style={{ borderLeftColor: 'var(--accent)' }}>
          <h3>{p.emoji} {p.name}</h3>
          <p className="muted" style={{ margin: '2px 0 0' }}>{p.what}</p>
        </Link>
      ))}
      <div className="notice" style={{ marginTop: 18 }}>
        The FAQ lives on the <strong>Dice Battles</strong> page only. The
        Support page shows the first few of those same questions, so an
        answer is written once and cannot disagree with itself.
      </div>
    </>
  );
}
