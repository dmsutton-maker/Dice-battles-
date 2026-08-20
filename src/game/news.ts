/**
 * What's new in the game, shown in the News tab.
 *
 * Bundled with the app rather than fetched from a server, on purpose. A
 * live feed would mean putting a Supabase key in a public repo and adding
 * the game's first network call, and the thing it would buy — changing the
 * news without shipping — is not worth either, because news IS what
 * shipped. Every update carries its own note.
 *
 * Newest first. Dates are plain strings so they read the same on every
 * device regardless of locale settings.
 */

export interface NewsItem {
  id: string;
  date: string;
  title: string;
  emoji: string;
  body: string;
  /** Set when the post is about a released version. */
  version?: string;
}

export const NEWS: NewsItem[] = [
  {
    id: 'v1-11-0',
    date: '19 August 2026',
    version: 'v1.11.0',
    title: 'Tournaments, News and a bottom menu',
    emoji: '🏆',
    body:
      'Three cups to enter, each a knockout bracket against the opponents ' +
      'you already know. Win every round to be champion — lose one and the ' +
      'run is over. All the menus moved to the bar along the bottom, so ' +
      'everything is one tap away instead of buried.',
  },
  {
    id: 'v1-10-2-feel',
    date: '19 August 2026',
    version: 'v1.10.2',
    title: 'The dice follow your finger properly now',
    emoji: '🎲',
    body:
      'If you flicked the dice and paused for a moment before lifting your ' +
      'finger, the game read it as a gentle tap and rolled them slowly ' +
      'forward instead of throwing them where you aimed. Fixed — it now ' +
      'measures the last moment of the flick.',
  },
  {
    id: 'v1-10-2-modes',
    date: '19 August 2026',
    version: 'v1.10.2',
    title: 'Every mode plays in split screen',
    emoji: '👥',
    body:
      'Two-player split screen used to be Color Rush only. Ultimate, ' +
      'Skirmish and Color War all play head-to-head now. In Skirmish you ' +
      'share one jail, so grabbing a colour takes it out from under the ' +
      'other player.',
  },
  {
    id: 'v1-10-2-shapes',
    date: '19 August 2026',
    version: 'v1.10.2',
    title: 'Colorblind mode',
    emoji: '🔷',
    body:
      'A new setting gives every colour its own shape as well — a circle ' +
      'for red, a square for blue, and so on. Helpful if colours are hard ' +
      'to tell apart, and in bright sunlight it helps everyone. Find it in ' +
      'Settings.',
  },
];
