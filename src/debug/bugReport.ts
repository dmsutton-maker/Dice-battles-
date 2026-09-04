import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { Dimensions, Platform } from 'react-native';
import { MAX_DEVICE_LENGTH, prepareBugReport } from './bugReportValidation';
import { GAME_VERSION } from '../game/version';

/**
 * Sends a bug report to the family HQ.
 *
 * This is the game's first-ever network call outside Expo's own update
 * mechanism — everything else has always stayed on the device. That is
 * a real change to what the privacy policy promises, so it shipped in
 * the same release as the policy saying exactly this: a report sends
 * the message typed plus basic device info, nothing else, and only when
 * the player chooses to send one.
 *
 * No name, no email, no account — there is nothing to attach one to.
 */

const ENDPOINT = 'https://dice-battles-hq.vercel.app/api/bug-report';

export interface BugReportResult {
  ok: boolean;
  message: string;
}

/** Everything attached automatically, so a player never has to type it. */
function deviceContext(): string {
  const { width, height } = Dimensions.get('window');
  // GAME_VERSION, not Constants.expoConfig.version. The latter is the
  // NATIVE version from app.json, which an over-the-air update cannot
  // change — it read 1.0.0 while the game was on v1.11.8, so every report
  // so far has been stamped with the wrong release. Both are sent now:
  // the game version says which code, the native one says which build.
  const nativeVersion = Constants.expoConfig?.version ?? 'unknown';
  const parts = [
    `${Platform.OS} ${Platform.Version}`,
    `game ${GAME_VERSION}`,
    `build ${nativeVersion}`,
    `${Math.round(width)}x${Math.round(height)}`,
    `update ${Updates.updateId ?? 'embedded'}`,
    `channel ${Updates.channel ?? 'none'}`,
  ];
  return parts.join(' · ');
}

export async function sendBugReport(message: string): Promise<BugReportResult> {
  const prepared = prepareBugReport(message);
  if (!prepared.ok) {
    return { ok: false, message: prepared.error };
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        message: prepared.message,
        device: deviceContext().slice(0, MAX_DEVICE_LENGTH),
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        message: body.error ?? 'Could not send that. Please try again.',
      };
    }
    return { ok: true, message: 'Sent! Thank you — it goes straight to the list of bugs to fix.' };
  } catch {
    // No internet, or the HQ is briefly unreachable — never let this
    // crash the game the report is trying to help fix.
    return {
      ok: false,
      message: 'Could not reach the server. Check your connection and try again.',
    };
  }
}
