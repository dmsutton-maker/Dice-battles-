import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { assert, assertEqual, note, suite, test } from './harness';
import { store } from './storageMock';
import { useFakeCloudStoreForTest, type ICloudStore } from '../src/game/cloudSaveSdk';
import { useFakeVaultForTest } from '../src/game/deviceVault';
import {
  ACCOUNT_PREFIX,
  MAX_ACCOUNTS,
  accountsToOffer,
  accountsToPrune,
  adoptAccount,
  declineAccounts,
  findAccountsToOffer,
  listAccounts,
  parseAccount,
  rememberAccount,
  type CarriedAccount,
} from '../src/game/icloudAccount';
import type { Identity } from '../src/game/playerIdentity';

/**
 * Carrying the account to a new iPhone through iCloud (icloudAccount.ts).
 *
 * David, 5 Nov 2026: "I want players to be able to save their progress no
 * matter what", and then "Combine them": Marc's server backup brings the
 * progress back under an account; iCloud brings the account to a phone
 * that has never seen it.
 */

class FakeCloud implements ICloudStore {
  map = new Map<string, string>();
  isSignedIn() {
    return true;
  }
  synchronize() {
    return true;
  }
  getString(key: string) {
    return this.map.get(key) ?? null;
  }
  setString(key: string, value: string) {
    this.map.set(key, value);
    return true;
  }
  remove(key: string) {
    this.map.delete(key);
    return true;
  }
  keys() {
    return [...this.map.keys()];
  }
}

const identity = (playerId: string, extra: Partial<Identity> = {}): Identity =>
  ({
    playerId,
    name: 'Sam',
    friendCode: 'CODE-' + playerId,
    secret: 'secret-' + playerId,
    signedIn: true,
    recovered: false,
    ...extra,
  }) as Identity;

const account = (playerId: string, savedAt: number, trophies = 100): CarriedAccount => ({
  v: 1,
  playerId,
  secret: 's-' + playerId,
  friendCode: 'c-' + playerId,
  name: 'P ' + playerId,
  trophies,
  savedAt,
});

suite('iCloud account · the rules', () => {
  test('junk and half-entries are ignored', () => {
    assertEqual(parseAccount('nope'), null, 'junk');
    assertEqual(parseAccount(JSON.stringify({ v: 1, playerId: 'a' })), null, 'no secret');
    assert(parseAccount(JSON.stringify(account('a', 1))) !== null, 'a good entry was refused');
  });

  test('entries list newest first, and only under their own key', () => {
    const list = listAccounts({
      [ACCOUNT_PREFIX + 'a']: JSON.stringify(account('a', 1)),
      [ACCOUNT_PREFIX + 'b']: JSON.stringify(account('b', 2)),
      [ACCOUNT_PREFIX + 'c']: JSON.stringify(account('a', 3)),
      other: 'x',
    });
    assertEqual(list.map((a) => a.playerId).join(','), 'b,a', 'order or filtering');
  });

  test('old players are pruned beyond the limit, never this phone\'s', () => {
    const all = Array.from({ length: MAX_ACCOUNTS + 2 }, (_, i) => account(`p${i}`, i));
    const gone = accountsToPrune(all, 'p0');
    assert(!gone.includes('p0'), 'this phone\'s account was pruned');
    assertEqual(all.length - gone.length, MAX_ACCOUNTS, 'how many are kept');
  });

  test('offered only to a new, unplayed phone that did not recover its own account', () => {
    const all = [account('old', 5), account('sibling', 6)];
    const here = { playerId: 'fresh', recovered: false, fresh: true, answered: false };
    assertEqual(accountsToOffer(all, here).length, 2, 'a new phone');
    assertEqual(accountsToOffer(all, { ...here, fresh: false }).length, 0, 'a played phone');
    assertEqual(accountsToOffer(all, { ...here, recovered: true }).length, 0, 'a reinstall (Marc\'s restore handles it)');
    assertEqual(accountsToOffer(all, { ...here, answered: true }).length, 0, 'asked again after an answer');
    assertEqual(
      accountsToOffer(all, { ...here, playerId: 'old' }).map((a) => a.playerId).join(','),
      'sibling',
      'offered its own account',
    );
  });
});

suite('iCloud account · on the phone', () => {
  const cloud = new FakeCloud();
  const reset = () => {
    store.clear();
    cloud.map.clear();
    useFakeCloudStoreForTest(cloud);
    useFakeVaultForTest(new Map());
  };

  test('a played phone keeps its account in iCloud; an unplayed one does not', () => {
    reset();
    assertEqual(rememberAccount(identity('a'), 0, true), false, 'an empty account was written');
    assertEqual(cloud.keys().length, 0, 'iCloud was written for an unplayed phone');
    assert(rememberAccount(identity('a'), 250, false), 'not written');
    const saved = parseAccount(cloud.getString(ACCOUNT_PREFIX + 'a'));
    assert(saved !== null && saved.trophies === 250 && saved.secret === 'secret-a', 'wrong entry');
  });

  test('a new iPhone is offered the old account, takes it, and is not asked again', async () => {
    reset();
    rememberAccount(identity('old', { name: 'Marc' }), 1240, false);
    const offer = await findAccountsToOffer(identity('brand-new'), true);
    assertEqual(offer.map((a) => a.name).join(','), 'Marc', 'not offered');
    const result = await adoptAccount(offer[0]);
    note(`adopt result in node: ${result}`);
    assert(result !== 'failed', 'nothing was written');
    assertEqual(store.get('dice-battles/player-id'), 'old', 'the account is not on the phone');
    assertEqual(store.get('dice-battles/player-secret'), 'secret-old', 'the secret is not on the phone');
    assertEqual((await findAccountsToOffer(identity('old'), true)).length, 0, 'asked again');
  });

  test('"I\'m a new player" is not asked again', async () => {
    reset();
    rememberAccount(identity('old'), 10, false);
    await declineAccounts();
    assertEqual((await findAccountsToOffer(identity('new'), true)).length, 0, 'asked again');
  });

  test('a phone without the iCloud module does nothing', async () => {
    reset();
    useFakeCloudStoreForTest(null);
    assertEqual(rememberAccount(identity('a'), 10, false), false, 'claimed a write');
    assertEqual((await findAccountsToOffer(identity('a'), true)).length, 0, 'offered something');
    useFakeCloudStoreForTest(undefined);
  });
});

suite('iCloud account · safe on builds without the module', () => {
  test('the module is looked up with requireOptionalNativeModule, lazily', () => {
    const code = readFileSync('src/game/cloudSaveSdk.ts', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    assert(code.includes("requireOptionalNativeModule('ICloudStore')"), 'not the optional lookup');
    assert(!/requireNativeModule\(/.test(code), 'requireNativeModule throws on build 18 and earlier');
    assert(!/^import .* from 'expo'/m.test(code), 'expo imported at module scope');
  });

  test('nothing else names the native module', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(name) && path !== join('src', 'game', 'cloudSaveSdk.ts')) {
          if (readFileSync(path, 'utf8').includes("'ICloudStore'")) offenders.push(path);
        }
      }
    };
    walk('src');
    assertEqual(offenders.join(', '), '', 'the native module is named outside cloudSaveSdk.ts');
  });

  test('the module and its iCloud entitlement are both in place', () => {
    assert(existsSync('modules/icloud-store/ios/ICloudStoreModule.swift'), 'the Swift module is missing');
    assert(existsSync('modules/icloud-store/expo-module.config.json'), 'autolinking would not find it');
    const swift = readFileSync('modules/icloud-store/ios/ICloudStoreModule.swift', 'utf8');
    assert(swift.includes('Name("ICloudStore")'), 'the native name differs from the JS lookup');
    const app = JSON.parse(readFileSync('app.json', 'utf8'));
    assert(
      typeof app.expo.ios.entitlements['com.apple.developer.ubiquity-kvstore-identifier'] === 'string',
      'without the entitlement iCloud never syncs',
    );
  });

  test('only the account goes to iCloud, never progress or purchases', () => {
    const code = readFileSync('src/game/icloudAccount.ts', 'utf8');
    for (const key of ['dice-battles:progress', 'dice-battles:wallet', 'dice-battles:entitlements', 'dice-battles:gold-pass-months']) {
      assert(!code.includes(`'${key}'`), `${key} is handled by the iCloud account file`);
    }
  });
});
