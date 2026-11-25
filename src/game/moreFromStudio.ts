/**
 * "More from Paper Ship Studio": the one place the game mentions the
 * family's other app, and the grown-up check in front of its link.
 *
 * David, 13 Nov 2026, in the Vector Faces chat and again here: "build the
 * Vector Faces link". Settled with him:
 *
 *   - NOT an advert. It never uses the ad slot (the interstitial after
 *     every third finished game stays exactly as it is, ads.ts untouched),
 *     and it is never shown during or between games: no pop-up, no badge,
 *     no red dot, no News post. One quiet row in Settings, for somebody
 *     who went looking.
 *   - A grown-up check before anything leaves the game. Vector Faces is a
 *     paid Apple Watch app, so the people it is for are the parents, and a
 *     five-year-old should not land in the App Store by tapping around.
 *     A times-table sum from 6 × 6 to 9 × 9 is beyond a pre-reader and
 *     takes a grown-up a second; a wrong answer gets a fresh sum, so
 *     guessing does not wear it down.
 *   - No price shown in the game (David is about to change it), so the
 *     words cannot go stale.
 *   - Opened with React Native's own Linking and the https App Store URL:
 *     no native module, so runtimeVersion does not move (AGENTS.md).
 *
 * Pure: no React Native, no storage, so the tests check it directly.
 */

/** Vector Faces in App Store Connect (Apple ID 6832990414). */
export const VECTOR_FACES_APP_STORE_ID = '6832990414';

export const VECTOR_FACES_URL = `https://apps.apple.com/us/app/vector-faces/id${VECTOR_FACES_APP_STORE_ID}`;

/** The words on the row, written for a family and with no price in them. */
export const STUDIO_ROW_TITLE = 'More from Paper Ship Studio';
export const STUDIO_ROW_NOTE = 'Vector Faces, our Apple Watch app: glowing clock faces that move.';

export interface GrownUpQuestion {
  a: number;
  b: number;
  answer: number;
}

/** The smallest and largest factor in the sum: 6 × 6 = 36 up to 9 × 9 = 81. */
export const GROWN_UP_MIN = 6;
export const GROWN_UP_MAX = 9;

function factor(random: () => number): number {
  const r = random();
  const unit = Number.isFinite(r) ? Math.min(Math.max(r, 0), 0.999999) : 0;
  return GROWN_UP_MIN + Math.floor(unit * (GROWN_UP_MAX - GROWN_UP_MIN + 1));
}

/** A fresh times-table sum for the grown-up check. */
export function grownUpQuestion(random: () => number = Math.random): GrownUpQuestion {
  const a = factor(random);
  const b = factor(random);
  return { a, b, answer: a * b };
}

/** Whether what was typed is the answer: digits only, spaces ignored. */
export function isGrownUpAnswer(question: GrownUpQuestion, typed: string): boolean {
  if (typeof typed !== 'string') return false;
  const clean = typed.trim();
  if (!/^\d{1,3}$/.test(clean)) return false;
  return Number(clean) === question.answer;
}
