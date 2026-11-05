import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { assert, assertEqual, note, suite, test } from './harness';
import { store } from './storageMock';
import {
  BACKED_UP_KEYS,
  FRESH_PLAYED_LIMIT,
  MAX_SAVE_CHARS,
  MAX_SLOTS,
  SAVE_PREFIX,
  buildSave,
  encodeSave,
  listSaves,
  parseSave,
  restoreWrites,
  savedWhen,
  savesToOffer,
  slotsToPrune,
  type CloudSave,
} from '../src/game/cloudSaveCore';
import { useFakeCloudStoreForTest, type ICloudStore } from '../src/game/cloudSaveSdk';
import {
  backupNow,
  declineRestore,
  findRestoreOffer,
  resetCloudSaveForTest,
  restoreFromCloud,
  setRestoreOfferOpen,
} from '../src/game/cloudSave';
import { useFakeVaultForTest } from '../src/game/deviceVault';

/**
 * iCloud saves (src/game/cloudSave.ts, cloudSaveCore.ts).
 *
 * David, 5 Nov 2026: "I want players to be able to save their progress
 * no matter what" — after a TestFlight coin purchase, spent on dice, was
 * gone when he deleted and reinstalled the game.
 */

const progress = (played: number, trophies: number) =>
  JSON.stringify({ trophies, played: { easy: played, medium: 0, hard: 0 }, wins: { easy: 0, medium: 0, hard: 0 } });
const wallet = (coins: number) => JSON.stringify({ coins, owned: ['pizza'] });

function stored(played: number, trophies = 120, coins = 300): Record<string, string> {
  return {
    'dice-battles:progress': progress(played, trophies),
    'dice-battles:wallet': wallet(coins),
    'dice-battles:loadout': JSON.stringify({ skin: 'pizza' }),
    'dice-battles/player-id': 'p-1',
    'dice-battles/player-secret': 's-1',
    // Never copied: real-money purchases come back from Apple.
    'dice-battles:entitlements': JSON.stringify(['remove-ads']),
    'dice-battles:gold-pass-months': JSON.stringify(['2026-11']),
  };
}

function save(slot: string, played: number, savedAt: number, trophies = 100): CloudSave {
  const s = buildSave(slot, stored(played, trophies), savedAt, 'v1.161.0', 'Sam');
  if (!s) throw new Error('expected a save');
  return s;
}

class FakeCloud implements ICloudStore {
  map = new Map<string, string>();
  signedIn = true;
  isSignedIn() {
    return this.signedIn;
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

suite('iCloud saves · what a save holds', () => {
  test('nothing is saved before a game has been finished', () => {
    assertEqual(buildSave('a', stored(0), 1, 'v', 'Sam'), null, 'an empty install made a save');
  });

  test('progress, coins and the Friends profile are copied; purchases are not', () => {
    const s = save('a', 4, 1000);
    assert(s.data['dice-battles:progress'] !== undefined, 'progress missing');
    assert(s.data['dice-battles:wallet'] !== undefined, 'coins missing');
    assert(s.data['dice-battles/player-secret'] === 's-1', 'friends profile missing');
    assert(s.data['dice-battles:entitlements'] === undefined, 'a real-money purchase was copied');
    assert(s.data['dice-battles:gold-pass-months'] === undefined, 'the Gold Pass was copied');
    assertEqual(s.trophies, 100, 'trophies on the card');
    assertEqual(s.coins, 300, 'coins on the card');
    assertEqual(s.played, 4, 'games on the card');
  });

  test('purchase stores are never on the list, whatever is added to it later', () => {
    for (const key of ['dice-battles:entitlements', 'dice-battles:gold-pass-months', 'dice-battles:handled-transactions']) {
      assert(!(BACKED_UP_KEYS as readonly string[]).includes(key), `${key} is backed up`);
    }
  });

  test('every key backed up is one the game really writes (catches a rename)', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(name) && !name.startsWith('cloudSave')) files.push(readFileSync(path, 'utf8'));
      }
    };
    walk('src');
    const all = files.join('\n');
    const missing = BACKED_UP_KEYS.filter((key) => !all.includes(`'${key}'`));
    assertEqual(missing.join(', '), '', 'these keys are backed up but nothing in src/ uses them');
  });

  test('a save that is too big drops settings first, never progress', () => {
    const s = save('a', 4, 1);
    s.data['dice-battles:pending-match'] = 'x'.repeat(MAX_SAVE_CHARS);
    const text = encodeSave(s);
    assert(text !== null && text.length <= MAX_SAVE_CHARS, 'the oversized save was not trimmed');
    const back = parseSave(text);
    assert(back !== null && back.data['dice-battles:progress'] !== undefined, 'progress was dropped');
  });

  test('junk, other apps\' keys and saves without progress are ignored', () => {
    assertEqual(parseSave('not json'), null, 'junk accepted');
    assertEqual(parseSave(JSON.stringify({ v: 2 })), null, 'unknown version accepted');
    const s = save('a', 4, 1);
    const tampered = JSON.parse(JSON.stringify(s));
    tampered.data['dice-battles:entitlements'] = '["remove-ads"]';
    assertEqual(parseSave(JSON.stringify(tampered))?.data['dice-battles:entitlements'], undefined, 'a purchase key got through');
    const noProgress = JSON.parse(JSON.stringify(s));
    delete noProgress.data['dice-battles:progress'];
    assertEqual(parseSave(JSON.stringify(noProgress)), null, 'a save without progress was accepted');
  });
});

suite('iCloud saves · one save per phone', () => {
  test('saves list newest first, and only under their own slot', () => {
    const a = save('a', 3, 100);
    const b = save('b', 5, 200);
    const list = listSaves({
      [SAVE_PREFIX + 'a']: JSON.stringify(a),
      [SAVE_PREFIX + 'b']: JSON.stringify(b),
      [SAVE_PREFIX + 'c']: JSON.stringify(a), // a's save under the wrong name
      'something-else': 'x',
    });
    assertEqual(list.map((s) => s.slot).join(','), 'b,a', 'order or filtering');
  });

  test('old phones are pruned beyond the limit, never this one', () => {
    const saves = Array.from({ length: MAX_SLOTS + 3 }, (_, i) => save(`s${i}`, 3, i));
    const pruned = slotsToPrune(saves, 's0');
    assert(!pruned.includes('s0'), 'this phone\'s own save was pruned');
    assertEqual(saves.length - pruned.length, MAX_SLOTS, 'how many are kept');
  });

  test('a new install is offered saves with more progress, a used one is not', () => {
    const saves = [save('old', 40, 5), save('tiny', 1, 6)];
    const fresh = savesToOffer(saves, { played: 0, slot: null, answered: false });
    assertEqual(fresh.map((s) => s.slot).join(','), 'old,tiny', 'new install');
    assertEqual(savesToOffer(saves, { played: 0, slot: null, answered: true }).length, 0, 'asked again after an answer');
    assertEqual(
      savesToOffer(saves, { played: FRESH_PLAYED_LIMIT, slot: null, answered: false }).length,
      0,
      'offered to a phone already being played',
    );
    assertEqual(
      savesToOffer(saves, { played: 0, slot: 'old', answered: false }).map((s) => s.slot).join(','),
      'tiny',
      'offered its own save back',
    );
  });

  test('restoring never clears the Friends profile', () => {
    const s = save('a', 4, 1);
    delete s.data['dice-battles/player-secret'];
    const { remove } = restoreWrites(s);
    assert(!remove.includes('dice-battles/player-secret'), 'the profile would be wiped');
    assert(remove.includes('dice-battles:tutorial-seen'), 'other stores not in the save are cleared');
  });

  test('the card says when', () => {
    const now = new Date(2026, 10, 5, 15).getTime();
    assertEqual(savedWhen(now - 3_600_000, now), 'today', 'today');
    assertEqual(savedWhen(now - 86_400_000, now), 'yesterday', 'yesterday');
    assertEqual(savedWhen(new Date(2026, 10, 1).getTime(), now), '1 Nov', 'a date');
  });
});

suite('iCloud saves · on the phone', () => {
  const cloud = new FakeCloud();
  const reset = () => {
    store.clear();
    cloud.map.clear();
    resetCloudSaveForTest();
    useFakeCloudStoreForTest(cloud);
    useFakeVaultForTest(new Map());
  };

  test('a finished game is saved under this phone\'s own slot, and the slot sticks', async () => {
    reset();
    for (const [k, v] of Object.entries(stored(3))) store.set(k, v);
    assert(await backupNow(1000), 'not written');
    const slot = store.get('dice-battles:cloud-slot');
    assert(typeof slot === 'string' && slot.length > 0, 'no slot');
    assert(cloud.map.has(SAVE_PREFIX + slot), 'not in iCloud under the slot');
    await backupNow(2000);
    assertEqual(store.get('dice-battles:cloud-slot'), slot, 'the slot changed');
    assertEqual(cloud.keys().length, 1, 'a second save was made');
    assert(!cloud.map.get(SAVE_PREFIX + slot)!.includes('remove-ads'), 'a purchase reached iCloud');
  });

  test('nothing is written while "Welcome back" is on screen', async () => {
    reset();
    for (const [k, v] of Object.entries(stored(3))) store.set(k, v);
    setRestoreOfferOpen(true);
    assertEqual(await backupNow(1000), false, 'backed up while the player was choosing');
    assertEqual(cloud.keys().length, 0, 'iCloud was written');
  });

  test('delete, reinstall, restore: the old progress comes back', async () => {
    reset();
    const old = save('oldphone', 25, 500, 1240);
    cloud.setString(SAVE_PREFIX + 'oldphone', JSON.stringify(old));
    // The reinstalled phone: nothing on it at all.
    const offer = await findRestoreOffer();
    assertEqual(offer.map((s) => s.slot).join(','), 'oldphone', 'not offered');
    const result = await restoreFromCloud(offer[0]);
    note(`restore result in node: ${result}`);
    assert(result !== 'failed', 'the restore wrote nothing');
    assertEqual(store.get('dice-battles:progress'), old.data['dice-battles:progress'], 'progress not restored');
    assertEqual(store.get('dice-battles:wallet'), old.data['dice-battles:wallet'], 'coins not restored');
    assertEqual(store.get('dice-battles:cloud-slot'), 'oldphone', 'not carrying on with the old save');
    assertEqual((await findRestoreOffer()).length, 0, 'offered again after restoring');
  });

  test('"Start a new game" is not asked again', async () => {
    reset();
    cloud.setString(SAVE_PREFIX + 'x', JSON.stringify(save('x', 25, 5)));
    assertEqual((await findRestoreOffer()).length, 1, 'not offered');
    await declineRestore();
    assertEqual((await findRestoreOffer()).length, 0, 'asked again');
  });

  test('a phone without the module has no iCloud saves and nothing breaks', async () => {
    reset();
    useFakeCloudStoreForTest(null);
    for (const [k, v] of Object.entries(stored(3))) store.set(k, v);
    assertEqual(await backupNow(), false, 'claimed a save');
    assertEqual((await findRestoreOffer()).length, 0, 'offered a save');
    useFakeCloudStoreForTest(undefined);
  });
});

suite('iCloud saves · safe on builds without the module', () => {
  test('the module is looked up with requireOptionalNativeModule, lazily', () => {
    const sdk = readFileSync('src/game/cloudSaveSdk.ts', 'utf8');
    const code = sdk.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert(code.includes("requireOptionalNativeModule('ICloudStore')"), 'not the optional lookup');
    assert(!/requireNativeModule\(/.test(code), 'requireNativeModule throws on build 18 and earlier');
    assert(!/^import .* from 'expo'/m.test(code), 'expo imported at module scope');
  });

  test('nothing else in the game names the native module', () => {
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
});
