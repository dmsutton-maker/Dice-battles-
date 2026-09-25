import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, assertEqual, note, suite, test } from './harness';
import { store } from './storageMock';
import { loadIdentity, resetIdentityForTest } from '../src/game/playerIdentity';
import { useFakeVaultForTest } from '../src/game/deviceVault';

/**
 * Deleting the game and installing it again.
 *
 * David's call, 7 Sep 2026, from the launch list: option B, "let signing
 * in to Game Center reclaim the old profile".
 *
 * WHAT WAS WRONG. iOS deletes an app's own folder when the app is
 * deleted, and the device secret lived in it. That secret is the only
 * thing proving to the server that a phone owns a profile, so after a
 * reinstall every write came back "wrong secret" — for ever, with no way
 * back. The friend code on the card in a child's pocket was dead, and
 * the screen showed a raw server error instead of saying so.
 *
 * WHAT THE FIX IS. The keychain is not part of that folder and survives
 * the app being deleted, so the secret is kept there too and read back
 * on first launch. No server change, and nothing has to be trusted:
 * the phone simply still holds what it always held.
 *
 * WHY NOT APPLE'S OWN CHECK. See deviceVault.ts. expo-game-center 1.0.1
 * does not expose the identity-verification signature, so the server
 * cannot tell a returning player from anyone who has typed their id —
 * and ids are handed out by the friend-code lookup. A server-side
 * "reclaim by id" would give a child's profile to anyone holding the
 * code they had shared, which is worse than the bug.
 */

/** Delete the app: the app's own folder goes, the keychain stays. */
function reinstall(): void {
  store.clear();
  resetIdentityForTest();
}

suite('reinstall · the profile comes back', () => {
  test('the friend code and the secret survive being deleted', async () => {
    const keychain = new Map<string, string>();
    useFakeVaultForTest(keychain);
    store.clear();
    resetIdentityForTest();

    const before = await loadIdentity();
    assertEqual(before.recovered, false, 'a first run claimed to have recovered something');

    reinstall();
    const after = await loadIdentity();

    assertEqual(after.friendCode, before.friendCode, 'the friend code after a reinstall');
    assertEqual(after.secret, before.secret, 'the secret after a reinstall');
    assertEqual(after.playerId, before.playerId, 'the player id after a reinstall');
    note(`kept ${before.friendCode} across a reinstall`);
  });

  test('and the player is told, once, that it came back', async () => {
    // Without this the eight letters on screen are indistinguishable
    // from eight new ones, and a child has no way to know which.
    const keychain = new Map<string, string>();
    useFakeVaultForTest(keychain);
    store.clear();
    resetIdentityForTest();
    await loadIdentity();

    reinstall();
    const after = await loadIdentity();
    assertEqual(after.recovered, true, 'the reinstall was not reported as a recovery');

    // Opening the game again is not another reinstall.
    resetIdentityForTest();
    const later = await loadIdentity();
    assertEqual(later.recovered, false, 'an ordinary launch claimed to be a recovery');
  });

  test('an existing phone is put in the keychain before it ever needs it', async () => {
    /*
      The upgrade path, and the reason the write is unconditional rather
      than only on first run. Every phone the family already plays on has
      a secret in ordinary storage and nothing in the keychain; it has to
      get there BEFORE they delete the game, not after.
    */
    const keychain = new Map<string, string>();
    useFakeVaultForTest(null);
    store.clear();
    resetIdentityForTest();
    const old = await loadIdentity(); // made when there was no keychain

    // The update lands. Same storage, a keychain now exists.
    useFakeVaultForTest(keychain);
    resetIdentityForTest();
    await loadIdentity();
    assert(keychain.size > 0, 'an existing profile was never copied into the keychain');

    reinstall();
    const after = await loadIdentity();
    assertEqual(after.secret, old.secret, 'an existing profile did not survive a reinstall');
  });

  test('a keychain that keeps nothing is survivable, not a crash', async () => {
    /*
      Expo's SDK 54 docs say the data "will persist across app
      uninstallations" and then that "this is not guaranteed and you
      should never rely on this implementation detail". So the miss is
      an ordinary outcome: a new profile, and no pretending otherwise.
    */
    useFakeVaultForTest(null);
    store.clear();
    resetIdentityForTest();
    const before = await loadIdentity();

    reinstall();
    const after = await loadIdentity();
    assert(after.friendCode !== before.friendCode, 'a new install reused a code it could not read');
    assertEqual(after.recovered, false, 'a failed recovery was reported as a success');
  });

  test('the secret alone decides, not whatever else the keychain held', async () => {
    /*
      A friend code coming back without the secret would be worse than
      useless: the screen would show the old code and say "welcome back"
      while every write to the server was still refused.
    */
    const keychain = new Map<string, string>();
    useFakeVaultForTest(keychain);
    store.clear();
    resetIdentityForTest();
    await loadIdentity();

    keychain.delete('dice-battles/player-secret');
    reinstall();
    const after = await loadIdentity();
    assertEqual(after.recovered, false, 'a code without a secret was called a recovery');
  });
});

suite('reinstall · what it tells the player', () => {
  const friends = readFileSync(
    join(__dirname, '..', 'src/demo/FriendsScreen.tsx'),
    'utf8',
  );

  test('the dead end says so instead of offering "Try again"', () => {
    /*
      "wrong secret" is the one server error a player can reach without
      anything being broken, and it is permanent — the phone can never
      prove it owns that profile. A retry button on it is a lie.
    */
    assert(/function explain\(/.test(friends), 'the raw server error is shown to players again');
    assert(
      !/\{problem\}/.test(friends),
      'the raw error string is rendered straight onto the screen',
    );
    assert(
      /retryable && \(/.test(friends),
      'every error still offers "Try again", including the one it cannot fix',
    );
  });

  test('nothing on the screen ever prints the secret', () => {
    // It is the password the player never sees. The friend code is the
    // thing to share; this is emphatically not.
    assert(
      !/\{me\.secret\}/.test(friends) && !/me\.secret/.test(friends),
      'the Friends screen reads the device secret into something on screen',
    );
  });
});

suite('reinstall · the keychain is held to the same rules as the rest', () => {
  const vaultSource = readFileSync(
    join(__dirname, '..', 'src/game/deviceVault.ts'),
    'utf8',
  );

  test('only one file may touch the keychain', () => {
    const { execSync } = require('node:child_process') as typeof import('node:child_process');
    const hits = execSync("grep -rl \"'expo-secure-store'\" src || true", {
      encoding: 'utf8',
    })
      .split('\n')
      .filter((f) => f.trim());
    assertEqual(
      hits.join(','),
      'src/game/deviceVault.ts',
      'the secure store is imported outside deviceVault.ts',
    );
  });

  test('it is required lazily, never at module scope', () => {
    // A native package named by a top-level import crashes every binary
    // built before it existed. AGENTS.md, learned on 25 Aug 2026.
    const top = vaultSource.slice(0, vaultSource.indexOf('function vault('));
    assert(
      !/^import .*expo-secure-store/m.test(top),
      'expo-secure-store is imported at module scope',
    );
    assert(
      /require\('expo-secure-store'\)/.test(vaultSource),
      'the lazy require is gone, so the keychain can never be reached',
    );
  });

  test('nothing in it can throw', () => {
    // Same rule as ads.ts and gameCenter.ts: a keychain that will not
    // answer has to look exactly like one with nothing in it.
    for (const fn of ['vaultGet', 'vaultSet']) {
      const body = vaultSource.slice(vaultSource.indexOf(`export async function ${fn}`));
      assert(/try \{/.test(body.slice(0, 400)), `${fn} has no catch around the native call`);
    }
  });

  test('the keychain entry outlives a locked phone', () => {
    /*
      The default is WHEN_UNLOCKED, and the game can be launched while
      the phone is still locked — at which point the read returns
      nothing and the app concludes the profile is gone, which is the
      exact failure this whole change exists to prevent.
    */
    assert(
      /AFTER_FIRST_UNLOCK/.test(vaultSource),
      'the keychain entry is unreadable on a locked phone, so a launch ' +
        'from a notification would look like a lost profile',
    );
  });
});
