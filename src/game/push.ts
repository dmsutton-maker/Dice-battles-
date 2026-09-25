import { loadPushSdk } from './pushSdk';
import { GAME_VERSION } from './version';
import type { Identity } from './playerIdentity';

/**
 * Being told when there is a new update.
 *
 * David, 25 Sep 2026: "make push notifications for when there's a new
 * update."
 *
 * THIS IS THE ONLY FILE THAT MAY TOUCH THE NOTIFICATIONS MODULE, the
 * way `ads.ts` is for the ad SDK and `gameCenter.ts` is for Game Center,
 * and it reaches it only through `pushSdk.ts` — which is currently a
 * switch in the OFF position. Read that file before changing anything
 * here; the reason it is off is a build that cannot be made from a
 * session, not an oversight.
 *
 * NOTHING HERE MAY THROW, REJECT OR BLOCK. Every path resolves, and the
 * failure of every one of them is "no notifications", never a crash and
 * never a wait. A game that would not start because a permission
 * prompt did not answer would be a far worse bug than the feature is a
 * feature.
 *
 * WHAT IT SENDS AND WHAT IT DOES NOT. One message exists — "a new
 * version is out" — and it goes to everybody at once. There is no
 * per-player targeting anywhere in the system, by design: nothing in
 * this game needs it, and the endpoint that could do it would be an
 * endpoint that could be made to. An Expo push token is a routing
 * address issued by Expo, not an advertising identifier; it is stored
 * against the player id only so it can be deleted on request, and it is
 * joined to nothing else.
 *
 * ASKING PERMISSION IS NOT DONE AT LAUNCH. iOS gives an app one chance
 * at that prompt for good, and a prompt on first launch — before a
 * child has seen a die roll — is the one most likely to be refused
 * forever. `askToBeTold` is called from Settings, where somebody has
 * gone looking.
 */

/** What the notifications module looks like, as much of it as is used. */
interface PushSdk {
  getPermissionsAsync(): Promise<{ status: string; canAskAgain: boolean }>;
  requestPermissionsAsync(): Promise<{ status: string }>;
  getExpoPushTokenAsync(options?: { projectId?: string }): Promise<{ data: string }>;
}

const REGISTER_URL = 'https://dice-battles-hq.vercel.app/api/push/register';
const TIMEOUT_MS = 6000;

export type PushState =
  /** The binary has no notifications module — see pushSdk.ts. */
  | 'unavailable'
  /** Never asked. The Settings row should offer to.  */
  | 'not-asked'
  /** Asked and refused, or turned off later in the phone's Settings. */
  | 'off'
  /** On, and this device's address is registered. */
  | 'on';

function sdk(): PushSdk | null {
  return loadPushSdk() as PushSdk | null;
}

/**
 * Where this device stands, without asking for anything.
 *
 * Safe to call at any time, including on a binary with no notifications
 * module at all — which is every binary in existence today.
 */
export async function pushState(): Promise<PushState> {
  const push = sdk();
  if (!push) return 'unavailable';
  try {
    const { status } = await push.getPermissionsAsync();
    return status === 'granted' ? 'on' : status === 'undetermined' ? 'not-asked' : 'off';
  } catch {
    return 'unavailable';
  }
}

/**
 * Ask iOS for permission, and register this device if it is given.
 *
 * Returns where things ended up. Never throws, never rejects; a refusal
 * and a broken network both come back as a state rather than an error,
 * because the caller is a settings row and there is nothing useful it
 * could do with an exception.
 */
export async function askToBeTold(me: Identity): Promise<PushState> {
  const push = sdk();
  if (!push) return 'unavailable';
  try {
    const existing = await push.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      /*
        `canAskAgain` is false once somebody has said no. Asking again
        does nothing at all — iOS does not show the prompt a second
        time — so this reports 'off' rather than pretending to ask and
        coming back with the same answer.
      */
      if (!existing.canAskAgain) return 'off';
      status = (await push.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return 'off';
    const { data: token } = await push.getExpoPushTokenAsync();
    return (await registerToken(me, token)) ? 'on' : 'off';
  } catch {
    return 'unavailable';
  }
}

/**
 * Tell the server this device's address.
 *
 * Called on every launch once permission is held, not only the first
 * time: iOS rotates a push token whenever it likes, and a token nobody
 * re-registered is a phone that quietly stops being told anything.
 * Cheap — one small write, and the row is keyed on the token so it is
 * an upsert rather than a pile of duplicates.
 */
export async function registerToken(me: Identity, token: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(REGISTER_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        playerId: me.playerId,
        secret: me.secret,
        token,
        platform: 'ios',
        version: GAME_VERSION,
      }),
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Re-register on launch if permission is already held, and do nothing
 * at all otherwise.
 *
 * Deliberately silent: it never prompts, so it can be fired and
 * forgotten from the launch sequence without ever putting a dialog in
 * front of somebody who is trying to play.
 */
export async function refreshToken(me: Identity): Promise<void> {
  const push = sdk();
  if (!push) return;
  try {
    const { status } = await push.getPermissionsAsync();
    if (status !== 'granted') return;
    const { data: token } = await push.getExpoPushTokenAsync();
    await registerToken(me, token);
  } catch {
    // No notifications. Never a crash, never a wait.
  }
}
