/**
 * The trimming and length rules for a bug report, kept out of
 * `bugReport.ts` so they can be tested headlessly — that file also pulls
 * in `react-native` and `expo-updates`, neither of which run under the
 * plain Node test harness (same reason `settle.ts` and `slider.ts` were
 * split from their native-touching callers).
 */

export const MIN_MESSAGE_LENGTH = 5;
export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_DEVICE_LENGTH = 300;
/** Titles over this read badly on the HQ board, which shows them inline. */
const TITLE_LENGTH = 80;

export type PreparedReport =
  | { ok: true; message: string }
  | { ok: false; error: string };

/** Trims and length-caps a report; rejects anything too short to act on. */
export function prepareBugReport(raw: string): PreparedReport {
  const message = raw.trim().slice(0, MAX_MESSAGE_LENGTH);
  if (message.length < MIN_MESSAGE_LENGTH) {
    return { ok: false, error: 'Tell us a little more about what happened.' };
  }
  return { ok: true, message };
}

/** The short line the HQ board shows for a report — never mid-word cut. */
export function bugReportTitle(message: string): string {
  if (message.length <= TITLE_LENGTH) return message;
  return `${message.slice(0, TITLE_LENGTH - 3)}...`;
}
