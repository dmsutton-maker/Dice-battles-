/**
 * The one drawer on the phone that a reinstall does not empty.
 *
 * WHY THIS EXISTS. Delete the game and install it again and every
 * ordinary store the app has is gone — AsyncStorage lives in the app's
 * own folder, and iOS deletes that folder with the app. The player's
 * device secret went with it, and that secret is the only thing proving
 * to the server that this phone owns that profile. So a reinstall left
 * a player permanently locked out of their own friends: their Game
 * Center id was unchanged, the server still had their row, and every
 * write came back "wrong secret" for ever.
 *
 * David's call, 7 Sep 2026: signing in should get your profile back.
 *
 * HOW. The iOS keychain is not part of the app's folder, so keychain
 * items survive the app being deleted. `expo-secure-store` writes there.
 * Put the secret in it and the reinstall problem disappears — for a Game
 * Center player and a local one alike, and without the app ever having
 * to prove to a server that it is who it says it is.
 *
 * WHY IT IS BEST-EFFORT AND NOT A PROMISE. Expo's own SDK 54 docs say
 * the data "will persist across app uninstallations" on iOS and then, in
 * the next breath, "this is not guaranteed and you should never rely on
 * this implementation detail". Apple has changed its mind about this
 * before. So every caller here treats a miss as ordinary — the player
 * gets a fresh profile and the honest sentence about it — rather than
 * as an error. It recovers what it can and never depends on having.
 *
 * WHAT IS NOT IN HERE, and why it could not be. The airtight version of
 * this is Apple's own identity check: `fetchItems(forIdentityVerification
 * Signature:)` hands the app a signature the SERVER can verify against
 * Apple's public key, which proves a caller really is that Game Center
 * player. `expo-game-center@1.0.1` does not expose it — its whole native
 * surface is eleven methods and that is not one of them — so the server
 * has no way to tell a returning player from anyone who has typed their
 * id. And ids are gettable: looking up a friend code returns one. A
 * server-side "reclaim by player id" would therefore hand a child's
 * profile to anybody holding the code they had written on a card, which
 * is worse than the problem it fixes. The keychain needs no such trust:
 * the phone simply still has the secret it always had.
 *
 * THE USUAL RULE. Nothing here may throw, reject, or block — a keychain
 * that will not answer must look exactly like one with nothing in it.
 */

/** Keyed together so a future migration can move them as one. */
const SERVICE = 'dice-battles';

interface SecureStoreModule {
  getItemAsync(key: string, options?: { keychainService?: string }): Promise<string | null>;
  setItemAsync(
    key: string,
    value: string,
    options?: { keychainService?: string; keychainAccessible?: unknown },
  ): Promise<void>;
  AFTER_FIRST_UNLOCK?: unknown;
}

let store: SecureStoreModule | null | undefined;

/**
 * The native module, or null for ever.
 *
 * Required lazily, never imported at module scope — the same discipline
 * as gameCenter.ts and ads.ts. The catch here is NOT what makes that
 * safe (Metro's loader reports a throwing module factory before any
 * catch in this repo sees it); pinning `runtimeVersion` in app.json is.
 * This only handles the ordinary cases: the headless test suite, and
 * anywhere react-native itself cannot be resolved.
 */
function vault(): SecureStoreModule | null {
  if (store !== undefined) return store;
  store = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Platform } = require('react-native');
    // Android wipes its own keystore entries with the app, so there is
    // nothing to recover there and no reason to pay for the call.
    if (Platform.OS !== 'ios') return store;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('expo-secure-store') as SecureStoreModule | undefined;
    if (mod && typeof mod.getItemAsync === 'function') store = mod;
  } catch {
    // Not in this build. Everything below turns into a quiet miss.
  }
  return store;
}

/** True when there is a drawer at all. */
export function vaultAvailable(): boolean {
  return vault() !== null;
}

/** What is in the drawer, or null — including when there is no drawer. */
export async function vaultGet(key: string): Promise<string | null> {
  const secure = vault();
  if (!secure) return null;
  try {
    return await secure.getItemAsync(key, { keychainService: SERVICE });
  } catch {
    return null;
  }
}

/**
 * Put something in the drawer. Returns whether it went in, for the
 * caller that wants to say so on screen.
 *
 * AFTER_FIRST_UNLOCK rather than the WHEN_UNLOCKED default: the game
 * reads this on launch, and a launch can happen from a notification or
 * a background refresh while the phone is still locked. WHEN_UNLOCKED
 * would return nothing in exactly that case and the app would conclude
 * the profile was gone.
 */
export async function vaultSet(key: string, value: string): Promise<boolean> {
  const secure = vault();
  if (!secure) return false;
  try {
    await secure.setItemAsync(key, value, {
      keychainService: SERVICE,
      keychainAccessible: secure.AFTER_FIRST_UNLOCK,
    });
    return true;
  } catch {
    return false;
  }
}

/** Test seam: forget whether the module was found. */
export function resetVaultForTest(): void {
  store = undefined;
}

/**
 * Test seam: stand a fake keychain in for the real one.
 *
 * The headless suite cannot resolve react-native at all, so `vault()`
 * always finds nothing there — which is the right default (every other
 * suite runs as though the phone had no keychain) but leaves the one
 * behaviour that matters untestable. Pass a map to play the keychain,
 * null to go back to having none.
 */
export function useFakeVaultForTest(fake: Map<string, string> | null): void {
  if (fake === null) {
    store = null;
    return;
  }
  store = {
    getItemAsync: async (key: string) => fake.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => {
      fake.set(key, value);
    },
  };
}
