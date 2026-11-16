/**
 * Which phone this is: 'ios', 'android', or null where React Native is not
 * there at all (the tests, in node).
 *
 * Added on 16 Nov 2026 for the first Google Play release (David: "lets get
 * the android app going"). The few places that behave differently on
 * Android — the ad unit, the store to rate in, the Gold Pass, the words
 * "Apple account" — ask here, so a test can say which phone it is with
 * setPlatformForTest instead of the answer coming from node by accident.
 */
let forced: string | null | undefined;

export function platformOS(): string | null {
  if (forced !== undefined) return forced;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const os = require('react-native').Platform?.OS;
    return typeof os === 'string' ? os : null;
  } catch {
    return null;
  }
}

export function isAndroid(): boolean {
  return platformOS() === 'android';
}

/** Test seam: pretend to be this phone; undefined goes back to asking. */
export function setPlatformForTest(os: string | null | undefined): void {
  forced = os;
}
