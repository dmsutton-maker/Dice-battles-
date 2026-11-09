/**
 * No emoji in the game — including in text that arrives from outside it.
 *
 * David, 30 Sep 2026: "I DONT WANT ANY EMOJIS IN THE GAME!" Everything
 * the game writes itself is already free of them (tests/noEmoji.test.ts).
 * What it does not write: a Game Center nickname (Apple allows emoji in
 * those, and they are the names on friends' cards and on the scoreboard
 * in a friendly battle), a news post or a cup typed into the HQ board
 * from a browser. All of it passes through here on the way in.
 *
 * Only pictographs go: letters, digits, punctuation and line breaks are
 * untouched, so "AJ 🏆" becomes "AJ" and a paragraph break in a news post
 * stays a paragraph break.
 */

// Pictographs, dingbats, symbols, flags, keycaps, and the invisible
// joiners and selectors that glue emoji sequences together.
const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}\u{FE0E}\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu;

export function hasEmoji(text: string): boolean {
  EMOJI.lastIndex = 0;
  const found = EMOJI.test(text);
  EMOJI.lastIndex = 0;
  return found;
}

/** The text with every emoji removed, and the gaps they leave closed up. */
export function stripEmoji(text: string): string {
  return text
    .replace(EMOJI, '')
    .replace(/ {2,}/g, ' ')
    .replace(/^ +| +$/gm, '');
}

/** The same, for every string anywhere inside a parsed JSON answer. */
export function stripEmojiDeep<T>(value: T): T {
  if (typeof value === 'string') return stripEmoji(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => stripEmojiDeep(v)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = stripEmojiDeep(v);
    return out as T;
  }
  return value;
}
