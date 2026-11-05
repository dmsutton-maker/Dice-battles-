import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { assert, assertEqual, note, suite, test } from './harness';
import { store } from './storageMock';
import {
  applySnapshot,
  collectSnapshot,
  fetchSnapshot,
  flushCloudSave,
  isFreshSnapshot,
  isSnapshot,
  newerSnapshot,
  resetCloudSaveForTests,
  restoreOnLaunch,
  RESTORE_WAIT_MS,
  snapshotBytes,
  SNAPSHOT_MAX_BYTES,
  UPLOAD_DEBOUNCE_MS,
  uploadPending,
  uploadSnapshot,
  utf8Bytes,
  watchCloudSave,
  type Snapshot,
} from '../src/game/cloudSave';
import {
  applyMatchResult,
  getProgress,
  notePlayed,
  resetProgressForTests,
  setQuestState,
  setSeasonState,
} from '../src/game/progress';
import { awardCoins, getWallet, grantItem, resetWalletForTests } from '../src/game/currency';
import { equipArena, equipSkin, getLoadout } from '../src/game/loadout';
import { isColorblindMode, resetColorblindForTests, setColorblindMode } from '../src/game/colorblind';
import { getAudioSettings, resetAudioSettingsForTests, setAudioVolume } from '../src/audio/settings';
import { hasSeenTutorial, markTutorialSeen, resetTutorialForTests } from '../src/game/tutorial';
import type { Identity } from '../src/game/playerIdentity';
import {
  checkSnapshot,
  cleanGameVersion,
  isSaveAction,
  SAVE_MAX_BYTES,
} from '../hq/src/lib/playerSave';

/**
 * The progress backup: a reinstall keeps everything.
 *
 * Marc, 5 Nov 2026: "When I delete the game and redownload it, it
 * completely resets my account, friends, friend code, trophies, coins,
 * and everything."
 *
 * The friend code's half of that is in reinstall.test.ts (the keychain
 * keys). This is the rest: what the snapshot holds, which copy wins,
 * the size cap, the upload, the restore on launch, and — as in
 * friendlyServer.test.ts — the server's route and migration read as
 * source, since they need Supabase to run.
 */

const root = join(__dirname, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const ME: Identity = {
  playerId: 'local-backup-test',
  name: 'Tester',
  friendCode: 'K7M29XPQ',
  secret: 'not-the-real-one',
  signedIn: false,
  recovered: false,
};

const PENDING_KEY = 'dice-battles:cloud-restore-pending';

/** Delete the app: every module back to its defaults, storage empty. */
function freshPhone(): void {
  resetCloudSaveForTests();
  equipArena('castle');
  equipSkin('ivory');
  store.clear();
  resetProgressForTests();
  resetWalletForTests();
  resetColorblindForTests();
  resetAudioSettingsForTests();
  resetTutorialForTests();
  resetCloudSaveForTests();
}

/** Play for a while: something in every module the backup keeps. */
function playAWhile(): void {
  applyMatchResult(true, 'hard', 'ultimate', () => 0.5);
  applyMatchResult(false, 'easy', 'classic', () => 0.5);
  awardCoins('won', 'hard', () => 0.5);
  grantItem('zebra');
  grantItem('arena:jungle');
  equipArena('jungle');
  equipSkin('zebra');
  setColorblindMode(true);
  setAudioVolume('music', 0.3);
  markTutorialSeen();
  setSeasonState({ season: 'fire-and-ice', xp: 120, paid: 1, goldPaid: 0 });
  setQuestState({ day: '2026-11-05', chosen: 'win-2', progress: 1 });
}

type Call = { url: string; body: Record<string, unknown> | null; init?: RequestInit };

/** Swap global fetch for one run, and record every call it saw. */
async function withFetch<T>(
  impl: (url: string, init?: RequestInit) => Promise<unknown>,
  run: () => Promise<T>,
): Promise<{ result: T; calls: Call[] }> {
  const calls: Call[] = [];
  const real = (globalThis as { fetch?: unknown }).fetch;
  (globalThis as { fetch?: unknown }).fetch = async (url: string, init?: RequestInit) => {
    let body: Record<string, unknown> | null = null;
    try {
      body = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
    } catch {
      body = null;
    }
    calls.push({ url, body, init });
    return impl(url, init);
  };
  try {
    return { result: await run(), calls };
  } finally {
    (globalThis as { fetch?: unknown }).fetch = real;
  }
}

const respond = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

/** A server that answers the save route and nothing else. */
const server = (snapshot: Snapshot | null) => async (url: string, init?: RequestInit) => {
  if (!url.endsWith('/players/save')) return respond(404, { error: 'no such route' });
  const body = JSON.parse(String(init?.body));
  if (body.action === 'load') return respond(200, { snapshot });
  return respond(200, { ok: true });
};

/** A server that never answers in time, and honours the abort. */
const slow = (ms: number) => (_url: string, init?: RequestInit) =>
  new Promise<never>((_, reject) => {
    const t = setTimeout(() => reject(new Error('too slow')), ms);
    init?.signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new Error('aborted'));
    });
  });

suite('cloud save · what the snapshot holds', () => {
  test('everything the player would miss goes round and comes back', async () => {
    freshPhone();
    playAWhile();
    const before = collectSnapshot(1_000);
    assertEqual(before.v, 1, 'the snapshot carries its version');
    assertEqual(before.savedAt, 1_000, 'the snapshot carries when it was taken');
    // Over the wire and back: plain JSON, nothing that does not survive it.
    const wire = JSON.parse(JSON.stringify(before)) as Snapshot;
    note(`a played-in snapshot is ${snapshotBytes(before).toLocaleString()} bytes`);

    freshPhone();
    assert(applySnapshot(wire), 'the snapshot was not applied');
    const p = getProgress();
    assertEqual(p.trophies, before.progress.trophies, 'trophies');
    assertEqual(p.wins.hard, 1, 'the hard win');
    assertEqual(p.played.easy, 0, 'played is seeded from wins, never invented');
    assertEqual(p.season?.xp, 120, 'the season experience');
    assertEqual(p.quest?.chosen, 'win-2', "today's quest");
    assertEqual(getWallet().coins, before.wallet.coins, 'coins');
    assert(getWallet().owned.includes('zebra') && getWallet().owned.includes('arena:jungle'), 'owned items');
    assertEqual(getLoadout().arenaId, 'jungle', 'the equipped battlefield');
    assertEqual(getLoadout().skinId, 'zebra', 'the equipped dice');
    assertEqual(isColorblindMode(), true, 'colourblind mode');
    assertEqual(getAudioSettings().music, 0.3, 'the music slider');
    assertEqual(hasSeenTutorial(), true, 'the tutorial seen');
    // Written through each module's own save, so the next launch reads it.
    for (const key of [
      'dice-battles:progress',
      'dice-battles:wallet',
      'dice-battles:loadout',
      'dice-battles:colorblind',
      'dice-battles:audio-settings',
      'dice-battles:tutorial-seen',
    ]) {
      assert(store.has(key), `${key} was not written by the restore`);
    }
    freshPhone();
  });

  test('junk from the server is refused, and the local state untouched', () => {
    freshPhone();
    playAWhile();
    const trophies = getProgress().trophies;
    for (const junk of [null, 'text', 42, [], {}, { v: 1 }, { v: 1, savedAt: 1 }, { v: 1, savedAt: 1, progress: 'x', wallet: {} }]) {
      assert(!isSnapshot(junk), `${JSON.stringify(junk)} passed as a snapshot`);
      assert(!applySnapshot(junk as unknown as Snapshot), `${JSON.stringify(junk)} was applied`);
    }
    assertEqual(getProgress().trophies, trophies, 'junk changed the trophies');
    freshPhone();
  });

  test('a snapshot from a newer game keeps fields this one does not know', () => {
    freshPhone();
    const future = {
      ...collectSnapshot(5),
      progress: { ...getProgress(), trophies: 77, somethingNew: { a: 1 } },
    } as Snapshot;
    assert(applySnapshot(future), 'a newer snapshot was refused');
    assertEqual(getProgress().trophies, 77, 'the trophies');
    assert((getProgress() as unknown as Record<string, unknown>).somethingNew !== undefined, 'the unknown field was dropped');
    freshPhone();
  });
});

suite('cloud save · which copy wins', () => {
  test('a fresh install is empty; one battle, one coin or one item is not', () => {
    freshPhone();
    assert(isFreshSnapshot(collectSnapshot()), 'a reset phone is not fresh');

    freshPhone();
    applyMatchResult(false, 'easy', 'classic', () => 0.5);
    notePlayed('easy', 'classic');
    assert(!isFreshSnapshot(collectSnapshot()), 'a lost battle on zero trophies still counts as played');

    freshPhone();
    awardCoins('lost', 'easy', () => 0.5);
    assert(!isFreshSnapshot(collectSnapshot()), 'coins are progress');

    freshPhone();
    grantItem('zebra');
    assert(!isFreshSnapshot(collectSnapshot()), 'an owned item is progress');

    freshPhone();
    setSeasonState({ season: 'x', xp: 10, paid: 0 });
    assert(!isFreshSnapshot(collectSnapshot()), 'season experience is progress');

    // The tutorial opens itself on a first launch, so closing it is not
    // progress — otherwise a reinstall whose first launch was offline
    // could never be restored on the second.
    freshPhone();
    markTutorialSeen();
    assert(isFreshSnapshot(collectSnapshot()), 'closing the how-to card made a phone look played-in');
    freshPhone();
  });

  test('the server replaces an empty phone, and nothing else on its own', () => {
    freshPhone();
    const empty = collectSnapshot(1);
    playAWhile();
    const played = collectSnapshot(2);
    const older = { ...played, savedAt: 0 };

    assertEqual(newerSnapshot(empty, played), 'remote', 'a fresh phone takes the server copy');
    assertEqual(newerSnapshot(null, played), 'remote', 'no local copy at all takes the server copy');
    assertEqual(newerSnapshot(played, older), 'ask', 'progress is never silently written over');
    assertEqual(newerSnapshot(played, played), 'ask', 'even the same copy is the player\'s call');
    assertEqual(newerSnapshot(played, null), 'local', 'the server having nothing changes nothing');
    assertEqual(newerSnapshot(empty, empty), 'local', 'an empty server copy is not worth the write');
    assertEqual(newerSnapshot(empty, { v: 1 } as Snapshot), 'local', 'junk from the server changes nothing');
    freshPhone();
  });
});

suite('cloud save · the size cap', () => {
  test('the game and the server agree on the cap', () => {
    assertEqual(SNAPSHOT_MAX_BYTES, SAVE_MAX_BYTES, 'the two copies of the cap differ');
    assertEqual(SNAPSHOT_MAX_BYTES, 64 * 1024, 'the cap is 64 KB');
  });

  test('bytes are counted as UTF-8, the way the server counts them', () => {
    for (const text of ['', 'plain', 'Colour Rush', '{"a":"é"}', 'dice — battles', '\u{1F3B2}']) {
      assertEqual(utf8Bytes(text), Buffer.byteLength(text, 'utf8'), `byte count of ${JSON.stringify(text)}`);
    }
  });

  test('a real snapshot is far inside it, and a bloated one is not sent', async () => {
    freshPhone();
    playAWhile();
    const real = collectSnapshot();
    assert(snapshotBytes(real) < SNAPSHOT_MAX_BYTES / 8, `a real snapshot is ${snapshotBytes(real)} bytes`);
    assert(checkSnapshot(real).ok, 'the server refuses a real snapshot');

    const bloated = {
      ...real,
      progress: { ...real.progress, tournaments: { big: 'x'.repeat(SNAPSHOT_MAX_BYTES) } },
    } as unknown as Snapshot;
    const { result, calls } = await withFetch(server(null), () => uploadSnapshot(ME, bloated));
    assertEqual(result, false, 'a bloated snapshot was reported as sent');
    assertEqual(calls.length, 0, 'a bloated snapshot reached the network');
    const refused = checkSnapshot(bloated);
    assert(!refused.ok && refused.status === 413, 'the server does not refuse a bloated snapshot with 413');
    freshPhone();
  });
});

suite('cloud save · the upload', () => {
  test('a change is sent a while later, with the id, the secret and the snapshot', async () => {
    freshPhone();
    assertEqual(UPLOAD_DEBOUNCE_MS, 10_000, 'the debounce is ten seconds');
    const { calls } = await withFetch(server(null), async () => {
      watchCloudSave(ME);
      assert(!uploadPending(), 'nothing had changed yet');
      applyMatchResult(true, 'easy', 'classic', () => 0.5);
      assert(uploadPending(), 'a battle did not mark the backup as changed');
      // The ten seconds have not passed, so nothing has gone yet; the
      // background flush is what sends it here.
      return flushCloudSave();
    });
    assertEqual(calls.length, 1, 'one upload for one change');
    const [call] = calls;
    assert(call.url.endsWith('/api/players/save'), `sent to ${call.url}`);
    assertEqual(call.body?.action, 'save', 'the action');
    assertEqual(call.body?.playerId, ME.playerId, 'the player id');
    assertEqual(call.body?.secret, ME.secret, 'the secret proves the phone');
    assert(isSnapshot(call.body?.snapshot), 'the body carries a snapshot');
    assertEqual(typeof call.body?.gameVersion, 'string', 'the game version');
    assert(!uploadPending(), 'sent, but still marked as waiting');
    freshPhone();
  });

  test('nothing waiting means nothing sent', async () => {
    freshPhone();
    const { result, calls } = await withFetch(server(null), async () => {
      watchCloudSave(ME);
      return flushCloudSave();
    });
    assertEqual(result, false, 'reported a send with nothing to send');
    assertEqual(calls.length, 0, 'called the server for nothing');
    freshPhone();
  });

  test('a phone the server has never met sends its profile once and tries again', async () => {
    freshPhone();
    let known = false;
    const { result, calls } = await withFetch(
      async (url, init) => {
        const body = JSON.parse(String(init?.body));
        if (url.endsWith('/api/players')) {
          known = true;
          return respond(200, { ok: true, created: true });
        }
        if (!known) return respond(401, { error: 'no such player' });
        return respond(200, { ok: true });
      },
      () => uploadSnapshot(ME),
    );
    assertEqual(result, true, 'the retry was not reported as sent');
    assertEqual(calls.map((c) => c.url.replace(/^.*\/api/, '')).join(' '), '/players/save /players /players/save', 'the order of calls');
    assertEqual(calls[1].body?.friendCode, ME.friendCode, 'the profile claim carries the friend code');
    freshPhone();
  });

  test('no connection, a server error or junk back is "try later", never a throw', async () => {
    freshPhone();
    playAWhile();
    for (const impl of [
      async () => {
        throw new Error('no connection');
      },
      async () => respond(500, { error: 'boom' }),
      async () => respond(503, { error: 'could not save that' }),
      async () => ({ ok: true, status: 200, json: async () => { throw new Error('not json'); } }),
    ]) {
      const { result } = await withFetch(impl, () => uploadSnapshot(ME));
      assertEqual(result, false, 'a failed upload was reported as sent');
    }
    // And through the watcher: what failed is still waiting.
    await withFetch(
      async () => {
        throw new Error('no connection');
      },
      async () => {
        watchCloudSave(ME);
        applyMatchResult(true, 'easy', 'classic', () => 0.5);
        await flushCloudSave();
      },
    );
    assert(uploadPending(), 'a change the server never got was forgotten');
    freshPhone();
  });
});

suite('cloud save · the restore on launch', () => {
  const recovered: Identity = { ...ME, recovered: true };

  function served(): Snapshot {
    freshPhone();
    playAWhile();
    const snapshot = JSON.parse(JSON.stringify(collectSnapshot(1_000))) as Snapshot;
    freshPhone();
    return snapshot;
  }

  test('a reinstall gets everything back before the home screen reads it', async () => {
    const snapshot = served();
    const { result, calls } = await withFetch(server(snapshot), () => restoreOnLaunch(recovered));
    assertEqual(result, 'restored', 'the outcome');
    assertEqual(calls.length, 1, 'one load');
    assertEqual(calls[0].body?.action, 'load', 'asked to load');
    assertEqual(calls[0].body?.secret, ME.secret, 'proved by the secret');
    assertEqual(getProgress().trophies, snapshot.progress.trophies, 'the trophies are back');
    assertEqual(getWallet().coins, snapshot.wallet.coins, 'the coins are back');
    assertEqual(getLoadout().skinId, 'zebra', 'the equipped dice are back');
    assert(!store.has(PENDING_KEY), 'the restore is still marked as pending');
    assert(!uploadPending(), 'the restore queued itself to be sent straight back');
    // Applied ONCE: the local copy is the truth from here on.
    const again = await withFetch(server({ ...snapshot, progress: { ...snapshot.progress, trophies: 1 } }), () =>
      restoreOnLaunch({ ...ME, recovered: false }),
    );
    assertEqual(again.result, 'nothing', 'a second launch asked again');
    assertEqual(again.calls.length, 0, 'a second launch called the server');
    assertEqual(getProgress().trophies, snapshot.progress.trophies, 'a second launch changed the trophies');
    freshPhone();
  });

  test('no connection on the reinstall launch: tried again next launch', async () => {
    const snapshot = served();
    const first = await withFetch(
      async () => {
        throw new Error('no connection');
      },
      () => restoreOnLaunch(recovered),
    );
    assertEqual(first.result, 'later', 'the outcome');
    assertEqual(store.get(PENDING_KEY), 'true', 'the reinstall was not remembered');
    assertEqual(getProgress().trophies, 0, 'something was applied with no answer');

    // The next launch is an ordinary one — recovered is only true once —
    // and the server answers this time.
    const second = await withFetch(server(snapshot), () => restoreOnLaunch(ME));
    assertEqual(second.result, 'restored', 'the second launch did not restore');
    assertEqual(getProgress().trophies, snapshot.progress.trophies, 'the trophies on the second launch');
    assert(!store.has(PENDING_KEY), 'still pending after a restore');
    freshPhone();
  });

  test('a server slower than the loading screen is given up on', async () => {
    served();
    assertEqual(RESTORE_WAIT_MS, 3_000, 'the loading screen waits three seconds');
    const started = Date.now();
    const { result } = await withFetch(slow(2_000), () => restoreOnLaunch(recovered, 30));
    const took = Date.now() - started;
    assertEqual(result, 'later', 'the outcome');
    assert(took < 1_000, `waited ${took} ms for a server that was given 30`);
    assertEqual(store.get(PENDING_KEY), 'true', 'a slow server lost the reinstall');
    freshPhone();
  });

  test('an identity slower than the loading screen is given up on too', async () => {
    // loadIdentity waits for Game Center, which on a first launch can be
    // Apple's sign-in sheet. The home screen must not wait behind it.
    served();
    const never = new Promise<Identity>(() => {});
    const started = Date.now();
    const { result, calls } = await withFetch(server(null), () => restoreOnLaunch(never, 30));
    assertEqual(result, 'later', 'the outcome');
    assert(Date.now() - started < 1_000, 'waited on an identity that never came');
    assertEqual(calls.length, 0, 'asked the server without an identity');
    freshPhone();
  });

  test('an ordinary launch on a played-in phone asks the server nothing', async () => {
    const snapshot = served();
    playAWhile();
    const { result, calls } = await withFetch(server(snapshot), () => restoreOnLaunch(ME));
    assertEqual(result, 'nothing', 'the outcome');
    assertEqual(calls.length, 0, 'the server was asked');
    freshPhone();
  });

  test('an empty phone the server does not know is simply new', async () => {
    freshPhone();
    const { result, calls } = await withFetch(async () => respond(401, { error: 'no such player' }), () => restoreOnLaunch(ME));
    assertEqual(result, 'nothing', 'the outcome');
    assertEqual(calls.length, 1, 'an empty phone asks once');
    assert(!store.has(PENDING_KEY), 'a new phone was left pending');
    freshPhone();
  });

  test('an empty phone the server has a save for is restored without a keychain', async () => {
    // The brief's other door: the keychain did not say "recovered", but
    // the phone is empty and the server has this id's progress.
    const snapshot = served();
    const { result } = await withFetch(server(snapshot), () => restoreOnLaunch(ME));
    assertEqual(result, 'restored', 'the outcome');
    assertEqual(getProgress().trophies, snapshot.progress.trophies, 'the trophies');
    freshPhone();
  });

  test('progress played since a failed restore is never written over', async () => {
    const snapshot = served();
    store.set(PENDING_KEY, 'true');
    applyMatchResult(true, 'easy', 'classic', () => 0.5);
    const mine = getProgress().trophies;
    const { result } = await withFetch(server(snapshot), () => restoreOnLaunch(ME));
    assertEqual(result, 'kept', 'the outcome');
    assertEqual(getProgress().trophies, mine, 'the battles played since were taken away');
    assert(!store.has(PENDING_KEY), 'left pending for ever');
    freshPhone();
  });

  test('a database that answers 503 is "later", not "nothing to restore"', async () => {
    served();
    const { result } = await withFetch(async () => respond(503, { error: 'could not read that' }), () => restoreOnLaunch(recovered));
    assertEqual(result, 'later', 'the outcome');
    assertEqual(store.get(PENDING_KEY), 'true', 'a blip lost the reinstall');
    freshPhone();
  });

  test('storage that will not answer cannot throw out of the launch', async () => {
    served();
    const real = AsyncStorage.getItem;
    (AsyncStorage as unknown as Record<string, unknown>).getItem = async () => {
      throw new Error('storage is gone');
    };
    try {
      const { result } = await withFetch(server(null), () => restoreOnLaunch(recovered));
      assert(result === 'nothing' || result === 'later', `the launch ended as ${result}`);
      const fetched = await withFetch(server(null), () => fetchSnapshot(ME));
      assert(fetched.result.ok && fetched.result.snapshot === null, 'a server with nothing is not "nothing"');
    } finally {
      (AsyncStorage as unknown as Record<string, unknown>).getItem = real;
    }
    freshPhone();
  });
});

suite('cloud save · the server', () => {
  const route = read('hq/src/app/api/players/save/route.ts');
  const migration = read('hq/supabase/migrations/20261105_player_saves.sql');

  test('a snapshot has to be an object with a version and a time, inside the cap', () => {
    for (const bad of [null, 'text', 7, [1, 2], {}, { v: 1 }, { savedAt: 1 }, { v: '1', savedAt: 1 }]) {
      const checked = checkSnapshot(bad);
      assert(!checked.ok && checked.status === 400, `${JSON.stringify(bad)} was accepted`);
    }
    const fine = checkSnapshot({ v: 1, savedAt: 1, progress: {}, wallet: {} });
    assert(fine.ok, 'a minimal snapshot was refused');
    const big = checkSnapshot({ v: 1, savedAt: 1, pad: 'x'.repeat(SAVE_MAX_BYTES) });
    assert(!big.ok && big.status === 413, 'an oversized snapshot was not refused with 413');
    const exact = checkSnapshot({ v: 1, savedAt: 1, pad: 'x'.repeat(SAVE_MAX_BYTES - '{"v":1,"savedAt":1,"pad":""}'.length) });
    assert(exact.ok && exact.bytes === SAVE_MAX_BYTES, 'exactly the cap is still allowed');
  });

  test('only save and load, and a plain game version', () => {
    assert(isSaveAction('save') && isSaveAction('load'), 'the two actions');
    for (const bad of ['delete', '', undefined, null, 1, 'SAVE']) assert(!isSaveAction(bad), `${String(bad)} is an action`);
    assertEqual(cleanGameVersion('v1.162.0'), 'v1.162.0', 'a real version');
    assertEqual(cleanGameVersion('v1<script>'), 'v1script', 'junk is stripped');
    assertEqual(cleanGameVersion(42), '', 'not a string');
    assertEqual(cleanGameVersion('x'.repeat(100)).length, 32, 'capped');
  });

  test('the route proves the phone first, and refuses everything else with 401', () => {
    assert(/import \{ authenticatePlayer, touchSeen \} from '@\/lib\/playerAuth'/.test(route), 'the route does not use the shared authentication');
    assert(/const auth = await authenticatePlayer\(body\.playerId, body\.secret\)/.test(route), 'the secret is not checked');
    assert(/if \('error' in auth\) \{\s*return NextResponse\.json\(\{ error: auth\.error \}, \{ status: 401 \}\)/.test(route), 'a wrong secret or an unknown player is not 401');
    // Authentication comes before any read or write.
    assert(route.indexOf('authenticatePlayer(body') < route.indexOf(".from('player_saves')"), 'the table is touched before the phone is proved');
  });

  test('a save is checked, then written as the player\'s one row', () => {
    assert(/const checked = checkSnapshot\(body\.snapshot\)/.test(route), 'the snapshot is not checked');
    assert(route.indexOf('checkSnapshot(body.snapshot)') < route.indexOf('.upsert('), 'written before it is checked');
    assert(/\.upsert\(\s*\{\s*player_id: auth\.playerId,\s*snapshot: body\.snapshot,/.test(route), 'the upsert is not keyed on the proved player');
    assert(/\{ onConflict: 'player_id' \}/.test(route), 'a second save would not replace the first');
    assert(/game_version: cleanGameVersion\(body\.gameVersion\)/.test(route), 'the game version is written raw');
    assert(!/\.or\(/.test(route), 'an "or" filter string crept into the save route');
  });

  test('a load answers the snapshot, null for never saved, 503 for a failed read', () => {
    const load = route.slice(route.indexOf("body.action === 'load'"), route.indexOf('const checked'));
    assert(/\.eq\('player_id', auth\.playerId\)/.test(load), 'a load is not limited to the proved player');
    assert(/if \(error\) return NextResponse\.json\(\{ error: [^}]+\}, \{ status: 503 \}\)/.test(load), 'a failed read is not 503');
    assert(/if \(!data\) return NextResponse\.json\(\{ snapshot: null \}\)/.test(load), 'never saved is not null');
  });

  test('the migration is additive, keyed to the profile, and closed to the anon key', () => {
    assert(/create table if not exists public\.player_saves/.test(migration), 'no table');
    assert(/player_id\s+text primary key references public\.player_profiles \(player_id\) on delete cascade/.test(migration), 'not one row per profile, deleted with it');
    assert(/snapshot\s+jsonb not null/.test(migration), 'no snapshot column');
    assert(/saved_at\s+timestamptz/.test(migration) && /game_version\s+text/.test(migration), 'the two bookkeeping columns');
    assert(/alter table public\.player_saves enable row level security/.test(migration), 'RLS is off');
    assert(!/create policy/i.test(migration), 'a policy would open the table to the anon key');
    const sql = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
    assert(!/\bdrop\b/i.test(sql), 'the migration drops something');
  });
});

suite('cloud save · the wiring', () => {
  const screen = read('src/demo/DiceDemoScreen.tsx');
  const cloud = read('src/game/cloudSave.ts');

  test('the restore runs before the home screen reads the saved game', () => {
    const hydrate = screen.slice(screen.indexOf('loadShelfPictures(),'), screen.indexOf("reportStep('saved')"));
    const restore = hydrate.indexOf('await restoreOnLaunch(loadIdentity())');
    assert(restore > 0, 'the home screen never restores');
    for (const read of ['setTrophies(progress.trophies)', 'setWallet(purse)', 'setLoadout(saved)', "setPopup('howto')"]) {
      assert(hydrate.indexOf(read) > restore, `${read} happens before the restore`);
    }
    assert(/if \(restored === 'restored'\) \{[\s\S]*?progress = getProgress\(\);[\s\S]*?purse = getWallet\(\);/.test(hydrate), 'the restored values are not read back');
    assert(/kicker: 'WELCOME BACK'/.test(hydrate), 'the player is not told');
    assert(/Tap Restore purchases in Settings for anything you bought\./.test(hydrate), 'the banner does not say where purchases come from');
  });

  test('every change is watched, and whatever is waiting goes when the app leaves the screen', () => {
    assert(/return watchCloudSave\(me\);/.test(screen), 'changes are not watched');
    assert(/if \(!appActive\) void flushCloudSave\(\);/.test(screen), 'the background does not flush');
    for (const file of [
      'src/game/progress.ts',
      'src/game/currency.ts',
      'src/game/loadout.ts',
      'src/game/colorblind.ts',
      'src/audio/settings.ts',
      'src/game/tutorial.ts',
    ]) {
      assert(/noteSaveChanged\(\)/.test(read(file)), `${file} writes without telling the backup`);
    }
  });

  test('the snapshot is written back through the modules, never raw keys', () => {
    for (const key of ['dice-battles:progress', 'dice-battles:wallet', 'dice-battles:loadout', 'dice-battles:colorblind', 'dice-battles:audio-settings', 'dice-battles:tutorial-seen']) {
      assert(!cloud.includes(key), `cloudSave.ts writes ${key} itself`);
    }
    assert(/restoreProgress\(snapshot\.progress\)/.test(cloud) && /restoreWallet\(snapshot\.wallet\)/.test(cloud), 'the modules are bypassed');
    assert(!/Buffer\.(byteLength|from)\(/.test(cloud), 'Buffer does not exist on Hermes');
  });

  test('the privacy policy says so, dated today or later', () => {
    const legal = read('hq/src/lib/legalCopy.ts');
    const privacy = legal.slice(legal.indexOf('export const PRIVACY'), legal.indexOf('export const TERMS'));
    const written = privacy.match(/written: '(\d{4}-\d{2}-\d{2})'/)?.[1] ?? '';
    assert(written >= '2026-11-05', `the policy is dated ${written}`);
    assert(/heading: 'Your progress backup'/.test(privacy), 'the policy has no section on the backup');
    assert(/trophies and battle record, your coins and the items/.test(privacy), 'the section does not say what is kept');
    assert(/stored with the same random player id/.test(privacy), 'the section does not say it is keyed to the player id');
    assert(/reinstall/.test(privacy), 'the section does not say why');
    assert(/deleted with everything else belonging to you if you ask/.test(privacy), 'the section does not say it can be deleted');
    assert(/Restore Purchases asks Apple/.test(privacy), 'purchases are not Apple\'s');
  });
});
