import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, assertEqual, suite, test } from './harness';
import { FRIENDLY_MODES } from '../src/game/friendlyBattle';
import { PRISONER_COLORS } from '../src/game/colors';
import {
  MATCH_FULL_RESCUE,
  MATCH_MIN_MS,
  MATCH_MODES,
  QUEUE_FRESH_MS,
  isServiceMissing,
  matchClaimHolds,
  opponentDisplayName,
  pickPartner,
  trophyBand,
  type QueueEntry,
} from '../hq/src/lib/matchQueue';

/**
 * Online matchmaking, the server's half.
 *
 * Marc, 4 Nov 2026: "add the online matchmaking where you now verse real
 * players instead of bots. it should search for a player for 15 seconds
 * ... and if it can't find a real person to verse after 15 seconds then
 * it loads you against one of the bots".
 *
 * As in friendlyServer.test.ts, the routes cannot run here (they need
 * Supabase), so the pure pairing rules are imported and the routes and
 * the migration are read as source.
 */

const root = join(__dirname, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const matchRoute = read('hq/src/app/api/match/route.ts');
const battles = read('hq/src/app/api/battles/route.ts');
const live = read('hq/src/app/api/battles/live/route.ts');
const migration = read('hq/supabase/migrations/20261104_matchmaking.sql');
const schema = read('hq/supabase/schema.sql');

const NOW = 10_000_000;

function entry(over: Partial<QueueEntry> & { playerId: string }): QueueEntry {
  return {
    mode: 'classic',
    difficulty: 'medium',
    trophies: 500,
    state: 'searching',
    joinedAtMs: NOW - 1_000,
    seenAtMs: NOW - 500,
    ...over,
  };
}

const me = entry({ playerId: 'local-me' });
const none = new Set<string>();

suite('match server · who is paired with whom', () => {
  test('only the same mode and the same difficulty', () => {
    const others = [
      entry({ playerId: 'local-ultimate', mode: 'ultimate' }),
      entry({ playerId: 'local-hard', difficulty: 'hard' }),
    ];
    assertEqual(pickPartner(me, others, NOW, none), null, 'paired across a mode or difficulty');
    const same = entry({ playerId: 'local-same' });
    assertEqual(pickPartner(me, [...others, same], NOW, none)?.playerId, 'local-same', 'the matching row');
  });

  test('never yourself, a stale row, or anybody not searching', () => {
    assertEqual(pickPartner(me, [entry({ playerId: 'local-me' })], NOW, none), null, 'paired with self');
    const stale = entry({ playerId: 'local-gone', seenAtMs: NOW - QUEUE_FRESH_MS });
    assertEqual(pickPartner(me, [stale], NOW, none), null, 'paired with a phone that stopped asking');
    const fresh = entry({ playerId: 'local-here', seenAtMs: NOW - QUEUE_FRESH_MS + 1 });
    assertEqual(pickPartner(me, [fresh], NOW, none)?.playerId, 'local-here', 'a fresh row is paired');
    for (const state of ['matched', 'withdrawn']) {
      assertEqual(pickPartner(me, [entry({ playerId: 'local-x', state })], NOW, none), null, `paired with ${state}`);
    }
  });

  test('never a blocked player, whichever of the two did the blocking', () => {
    // The route puts both directions into one set; either alone must keep
    // the two apart.
    const them = entry({ playerId: 'local-blocked' });
    assertEqual(pickPartner(me, [them], NOW, new Set(['local-blocked'])), null, 'paired with a blocked player');
    assert(/\.eq\('player_id', me\)\.eq\('state', 'blocked'\)/.test(matchRoute), 'my own blocks are not read');
    assert(/\.eq\('other_id', me\)\.eq\('state', 'blocked'\)/.test(matchRoute), 'blocks against me are not read');
    assert(!/\.or\(/.test(matchRoute), 'an "or" filter string crept into the match route');
  });

  test('the trophy band widens with the wait, for both sides', () => {
    assertEqual(trophyBand(0), 300, 'the band to start with');
    assertEqual(trophyBand(1_000), 400, 'one second in');
    assertEqual(trophyBand(15_000), 1_800, 'at the end of the fifteen seconds');
    assertEqual(trophyBand(-5_000), 300, 'a clock that went backwards');
    const far = entry({ playerId: 'local-far', trophies: 1_300, joinedAtMs: NOW - 10_000 });
    assertEqual(pickPartner(me, [far], NOW, none), null, 'paired 800 apart after a second of my wait');
    const meLater = { ...me, joinedAtMs: NOW - 5_000 };
    assertEqual(pickPartner(meLater, [far], NOW, none)?.playerId, 'local-far', 'not paired once both waited long enough');
    const newcomer = { ...far, joinedAtMs: NOW };
    assertEqual(pickPartner(meLater, [newcomer], NOW, none), null, "the newcomer's narrow band was ignored");
  });

  test('nearest trophies first, then whoever has waited longest', () => {
    const near = entry({ playerId: 'local-near', trophies: 520, joinedAtMs: NOW - 200 });
    const farther = entry({ playerId: 'local-farther', trophies: 650, joinedAtMs: NOW - 3_000 });
    assertEqual(pickPartner(me, [farther, near], NOW, none)?.playerId, 'local-near', 'nearest in trophies');
    const young = entry({ playerId: 'local-young', joinedAtMs: NOW - 500 });
    const old = entry({ playerId: 'local-old', joinedAtMs: NOW - 2_500 });
    assertEqual(pickPartner(me, [young, old], NOW, none)?.playerId, 'local-old', 'a tie goes to the oldest');
  });

  test('a stranger is shown their chosen name or "Player", nothing else', () => {
    assertEqual(opponentDisplayName(''), 'Player', 'empty name');
    assertEqual(opponentDisplayName('   '), 'Player', 'blank name');
    assertEqual(opponentDisplayName(null), 'Player', 'no name');
    assertEqual(opponentDisplayName(' Marc '), 'Marc', 'a chosen name, trimmed');
    // Every name the route sends goes through that rule.
    const sent = matchRoute.match(/opponentName: [^\n]*/g) ?? [];
    assert(sent.length >= 2, 'the route no longer names the opponent');
    for (const line of sent) assert(/opponentName: await nameOf\(/.test(line), `named without the rule: ${line}`);
    assert(/return opponentDisplayName\(data\?\.name\)/.test(matchRoute), 'nameOf does not use the rule');
  });

  test('matchmaking is for Color Rush and Ultimate only, as friend battles are', () => {
    assertEqual(MATCH_MODES.join(','), 'classic,ultimate', 'MATCH_MODES');
    assertEqual(MATCH_MODES.join(','), FRIENDLY_MODES.join(','), 'the server and the game disagree on live modes');
  });
});

suite('match server · a win against a stranger', () => {
  test('a whole rescue is the same six colours the game has', () => {
    assertEqual(MATCH_FULL_RESCUE, PRISONER_COLORS.length, 'MATCH_FULL_RESCUE differs from PRISONER_COLORS');
  });

  test('a claim holds only with every colour and the minimum time', () => {
    const all = PRISONER_COLORS.map((c) => c.id);
    assert(matchClaimHolds(all, 0, MATCH_MIN_MS), 'six colours after twenty seconds is a win');
    assert(!matchClaimHolds(all, 0, MATCH_MIN_MS - 1), 'too soon to have won');
    assert(!matchClaimHolds(all.slice(0, 5), 0, 60_000), 'five colours is not a win');
    assert(!matchClaimHolds([...all.slice(0, 5), 'red'], 0, 60_000), 'a colour reported twice counts once');
    assert(!matchClaimHolds(all, Number.NaN, 60_000), 'a battle with no readable start');
    assert(!matchClaimHolds('everything', 0, 60_000), 'not a list');
  });
});

suite('match server · the routes', () => {
  test('the match route answers off while the migration is not applied', () => {
    assert(/const OFF = \{ state: 'off' \}/.test(matchRoute), 'there is no off answer');
    assert(/isServiceMissing\(mine\.error\)\) return NextResponse\.json\(OFF\)/.test(matchRoute), 'a missing queue is not off');
    assert(/isServiceMissing\(claimError\)\) return NextResponse\.json\(OFF\)/.test(matchRoute), 'a missing claim_match is not off');
    assert(isServiceMissing({ code: '42P01', message: 'relation "public.match_queue" does not exist' }), '42P01');
    assert(
      isServiceMissing({ code: 'PGRST205', message: "Could not find the table 'public.match_queue' in the schema cache" }),
      'PGRST205',
    );
    assert(
      isServiceMissing({ code: 'PGRST202', message: 'Could not find the function public.claim_match' }),
      'PGRST202',
    );
    // The partner being taken is NOT the service being missing.
    assert(
      !isServiceMissing({ code: 'P0001', message: 'claim_match: one of the two is no longer searching' }),
      'a taken partner switched matchmaking off',
    );
    assert(!isServiceMissing(null), 'no error');
    assert(/export const dynamic = 'force-dynamic'/.test(matchRoute), 'the match route can be cached');
  });

  test('the battle starts on the route\'s clock, not the database\'s', () => {
    assert(/p_born: new Date\(\)\.toISOString\(\)/.test(matchRoute), 'p_born does not come from the route');
    assert(/rpc\('claim_match'/.test(matchRoute), 'the route does not pair through claim_match');
    assert(!/now\(\)/.test(migration.slice(migration.indexOf('create or replace function'))), 'claim_match uses now()');
  });

  test('the friends poll is never handed a match', () => {
    assert(/\.filter\(\(r\) => r\.kind !== 'match'\)/.test(battles), 'battles GET does not filter out matches in JS');
    const liveSides = battles.slice(battles.indexOf('const liveSides'), battles.indexOf('const live ='));
    assert(/\.select\('\*'\)/.test(liveSides), 'the friends poll names a column that may not exist yet');
  });

  test('the live route treats a match more strictly, and only a match', () => {
    assert(/const isMatch = battle\.kind === 'match'/.test(live), 'the live route does not read the kind');
    assert(
      /isMatch && body\.leave === true && waiting\)/.test(live),
      'leaving a match waiting room is not its own branch',
    );
    const branch = live.slice(live.indexOf('isMatch && body.leave === true'), live.indexOf('body.leave === true && (battle.state'));
    assert(/patch\.state = 'over'/.test(branch) && !/patch\.winner/.test(branch), 'a match left before it began hands out a win');
    assert(
      /\(!isMatch \|\| matchClaimHolds\(freed, startedAtMs, now\.getTime\(\)\)\)/.test(live),
      'a match win claim is not checked',
    );
    // Friend battles keep handing the room to whoever stayed.
    assert(/if \(!battle\.winner\) patch\.winner = iAmA \? battle\.b_id : battle\.a_id/.test(live), 'friend leave changed');
  });
});

suite('match server · the migration', () => {
  test('it is additive and complete', () => {
    // Comments may say there is no DROP; the statements may not have one.
    const statements = migration.replace(/--[^\n]*/g, '');
    assert(!/\bdrop\b/i.test(statements), 'the migration contains a DROP');
    for (const word of ['match_queue', 'claim_match', 'kind']) {
      assert(migration.includes(word), `the migration has no ${word}`);
    }
    assert(/add column if not exists kind text not null default 'friend'/.test(migration), 'battles.kind');
    assert(/check \(kind in \('friend', 'match'\)\)\s*not valid/.test(migration), 'the kind check');
    assert(/p_born\s+timestamptz/.test(migration), 'claim_match does not take p_born');
    assert(/kind\)\s*values[\s\S]*'waiting', p_born, p_born, p_born, 'match'\)/.test(migration), 'the battle is not born waiting as one instant');
    assert(/if paired <> 2 then\s*raise exception/.test(migration), 'a half-made pair is not rolled back');
    assert(/enable row level security/.test(migration), 'the queue has no RLS');
    assert(/from anon, authenticated/.test(migration), 'anon can call claim_match');
  });

  test('schema.sql has it too', () => {
    for (const word of ['create table if not exists public.match_queue', 'public.claim_match(', "kind in ('friend', 'match')"]) {
      assert(schema.includes(word), `schema.sql has no ${word}`);
    }
  });
});
