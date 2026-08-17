import Link from 'next/link';

/** The public front page: what the game is, and where to get it. */
export default function HomePage() {
  return (
    <main className="wrap">
      <section className="hero">
        <h1>⚔️ Dice Battles: Color Rush ⚔️</h1>
        <p>
          Two dice. Six colours. Roll both dice to the same colour and you
          free that colour&apos;s prisoner. Free six and you win — but your
          opponent is rolling at the same time, and nobody is taking turns.
        </p>
        <p className="faint">
          Coming to iPhone and iPad. In testing now.
        </p>
      </section>

      <div className="grid">
        <div className="card">
          <h3>🎲 Real dice, real physics</h3>
          <p className="muted">
            Flick them, tap them, bounce them off the walls. The dice tumble
            properly and land where they land — no animations pretending to
            be a roll.
          </p>
        </div>
        <div className="card">
          <h3>🏃 Nobody waits their turn</h3>
          <p className="muted">
            Both players roll at once, as fast as they can. A round takes a
            couple of frantic minutes.
          </p>
        </div>
        <div className="card">
          <h3>👥 Two players, one phone</h3>
          <p className="muted">
            Split screen for two people on the same device, plus four game
            modes and eight opponents to race on your own.
          </p>
        </div>
        <div className="card">
          <h3>🎨 Colours, not numbers</h3>
          <p className="muted">
            Every face is a colour, so a five year old can play it without
            reading a thing. The palette is picked to stay readable for
            colour-blind players.
          </p>
        </div>
        <div className="card">
          <h3>🏆 Trophies and coins</h3>
          <p className="muted">
            Win to climb the ladder and unlock battlefields and dice. Coins
            buy patterned dice in the store — and never change how a roll
            reads.
          </p>
        </div>
        <div className="card">
          <h3>🔒 Nothing collected</h3>
          <p className="muted">
            No account, no login, no tracking. Everything the game
            remembers stays on your phone.{' '}
            <Link href="/privacy">Read the privacy policy</Link>.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <h2>Where it came from</h2>
        <p className="muted">
          Dice Battles started as a physical game invented at a kitchen
          table. This is that game, on a phone, built by the same family —
          David, who invented it, and his kids, who decide what gets built
          next.
        </p>
      </div>
    </main>
  );
}
