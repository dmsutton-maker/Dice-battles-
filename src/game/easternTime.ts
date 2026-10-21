/**
 * New York's clock, worked out by hand.
 *
 * Two things in the game turn on a fixed clock in the Eastern time zone:
 * the weekly cup (cupRotation.ts, midnight Monday) and the season pass
 * (seasonPass.ts, midnight on the first of the month). Both are decided
 * from the date on every phone alike, with no server, so every phone has
 * to agree to the second what time it is in New York — which is why the
 * daylight-saving rule is written here rather than asked of the phone's
 * own time-zone tables, and why the test suite can check it against the
 * real dates the clocks change.
 */

const HOUR = 3_600_000;

/** The day of the month of the n-th Sunday of a month (0-based month). */
function nthSunday(year: number, month: number, n: number): number {
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
  return 1 + ((7 - first) % 7) + (n - 1) * 7;
}

/**
 * New York's offset from UTC at an instant, in milliseconds: four hours
 * behind in summer, five in winter. Daylight saving runs from 2 AM on
 * the second Sunday of March to 2 AM on the first Sunday of November,
 * the rule since 2007.
 */
export function easternOffsetMs(utcMs: number): number {
  const year = new Date(utcMs).getUTCFullYear();
  const start = Date.UTC(year, 2, nthSunday(year, 2, 2), 7); // 2 AM EST
  const end = Date.UTC(year, 10, nthSunday(year, 10, 1), 6); // 2 AM EDT
  return utcMs >= start && utcMs < end ? -4 * HOUR : -5 * HOUR;
}

/** The New York calendar at an instant. `month` is 1 to 12. */
export function easternParts(utcMs: number): { year: number; month: number; day: number } {
  const local = new Date(utcMs + easternOffsetMs(utcMs));
  return { year: local.getUTCFullYear(), month: local.getUTCMonth() + 1, day: local.getUTCDate() };
}

/** The New York month an instant falls in, as YYYY-MM. */
export function monthStamp(utcMs: number): string {
  const { year, month } = easternParts(utcMs);
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * A New York local time, written as if it were UTC, as the instant it
 * really is. Midnight on the first of a month and midnight on a Monday
 * are never inside the hour the clocks change (2 AM on a Sunday), so the
 * offset at either guess is the right one.
 */
export function easternLocalToUtc(localAsUtcMs: number): number {
  return localAsUtcMs - easternOffsetMs(localAsUtcMs + 5 * HOUR);
}

/** The instant a New York month (YYYY-MM) begins. */
export function monthStartUtc(stamp: string): number {
  const [y, m] = stamp.split('-').map(Number);
  return easternLocalToUtc(Date.UTC(y, m - 1, 1));
}

/** The YYYY-MM after a given one. */
export function nextMonth(stamp: string): string {
  const [y, m] = stamp.split('-').map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

/** Whole months from one YYYY-MM to another; negative if `b` is earlier. */
export function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return (by - ay) * 12 + (bm - am);
}
