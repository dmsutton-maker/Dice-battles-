import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, assertEqual, suite, test } from './harness';
import { JOIN_WAIT_MS } from '../src/game/friendlyBattle';
import * as server from '../hq/src/lib/battleClock';

/**
 * Friend battles, the server's half: the waiting room and who is on.
 *
 * David, 1 Nov 2026: "Fix the versus against friends because it doesn't
 * connect and it's not actually against each other."
 *
 * The routes cannot run here (they need Supabase), so — like the clock
 * tests in battleTimer.test.ts — the pure rules are imported and the
 * routes are read as source and made to show they still say the thing
 * the game depends on.
 */

const root = join(__dirname, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const battles = read('hq/src/app/api/battles/route.ts');
const live = read('hq/src/app/api/battles/live/route.ts');
const friends = read('hq/src/app/api/friends/route.ts');

suite('friendly server · the waiting room', () => {
  test('the game and the server wait the same time for a friend to walk in', () => {
    // Two copies of one number on two machines. If they drift, one phone
    // gives up on a room the server still holds open, or the other way.
    assertEqual(server.JOIN_WAIT_MS, JOIN_WAIT_MS, 'JOIN_WAIT_MS differs between game and server');
    assertEqual(JOIN_WAIT_MS, 30_000, 'the join window is thirty seconds');
  });

  test('a phone has arrived only once its seen is LATER than the start', () => {
    const start = 1_000_000;
    assert(!server.hasArrived(start, start), 'equal to the start is the accept, not a beat');
    assert(server.hasArrived(start + 1, start), 'a millisecond later is a beat');
    assert(!server.hasArrived(start - 50, start), 'earlier than the start has not arrived');
    assert(!server.hasArrived(Number.NaN, start), 'an unreadable seen has not arrived');
    assert(!server.hasArrived(start + 1, Number.NaN), 'nothing arrives in a room with no start');
  });

  test('a room waits thirty seconds and then closes', () => {
    const start = 1_000_000;
    assert(!server.joinWindowOver(start, start), 'a new room is open');
    assert(!server.joinWindowOver(start, start + JOIN_WAIT_MS), 'exactly thirty seconds is still open');
    assert(server.joinWindowOver(start, start + JOIN_WAIT_MS + 1), 'past thirty seconds is closed');
    assert(server.joinWindowOver(Number.NaN, start), 'a room with no readable start is closed');
  });

  test('accepting a challenge makes a WAITING battle, all three times one instant', () => {
    const insert = battles.slice(battles.indexOf(".from('battles').insert({"));
    const body = insert.slice(0, insert.indexOf('});'));
    assert(body.length > 0, 'the accept no longer inserts a battle');
    assert(/state: 'waiting'/.test(body), 'the battle is not born waiting');
    // hasArrived compares *_seen with started_at: they must start equal.
    for (const col of ['started_at', 'a_seen', 'b_seen']) {
      assert(new RegExp(`${col}: bornAt`).test(body), `${col} is not written as the same instant`);
    }
  });

  test('GET hands a waiting battle to both players, as a list of values', () => {
    assert(
      /\.in\('state', \['waiting', 'playing'\]\)/.test(battles),
      'GET no longer returns a waiting battle, so the challenger cannot join the room',
    );
    // Not an "or" string — see the note at the top of the route.
    assert(!/\.or\(/.test(battles), 'an "or" filter string crept into the battles route');
  });

  test('sweep() closes a room the friend never walked into, with no winner', () => {
    const sweep = battles.slice(battles.indexOf('async function sweep'), battles.indexOf('async function friendsBothWays'));
    assert(
      /update\(\{ state: 'over', ended_at: now \}\)\s*\.eq\('state', 'waiting'\)\s*\.lt\('started_at', joinCutoff\)/.test(sweep),
      'an abandoned waiting room is never closed',
    );
    assert(/nowMs - JOIN_WAIT_MS/.test(sweep), 'the sweep does not use the join window');
  });

  test('the live route starts the battle only when both are there, once', () => {
    const start = live.indexOf("patch.state = 'playing';");
    assert(start > 0, 'the live route never turns a room into a battle');
    const branch = live.slice(live.lastIndexOf('} else if', start), start + 200);
    assert(
      /waiting && hasArrived\(theirSeenMs, startedAtMs\)/.test(branch),
      'the room starts without checking the other phone has arrived',
    );
    assert(/patch\.started_at = now\.toISOString\(\)/.test(branch), 'the clock is not restarted when the battle starts');
    // Two phones can find each other in the same instant; only one write lands.
    assert(
      /\.update\(patch\)\s*\.eq\('id', battleId\)\s*\.eq\('state', 'waiting'\)/.test(live),
      'starting the battle is not guarded by the waiting state',
    );
    // The loser of that race still stamps itself and reads the room back.
    assert(/\.update\(stamp\)/.test(live), 'the loser of the start race is not re-read');
  });

  test('a waiting room past its window closes before any leave is looked at', () => {
    const window = live.indexOf('waiting && joinWindowOver(startedAtMs');
    const leave = live.indexOf('body.leave === true');
    assert(window > 0, 'the live route never closes an abandoned room');
    assert(window < leave, 'a leave after the window would hand a battle nobody played to somebody');
    assert(
      /body\.leave === true && \(battle\.state === 'playing' \|\| waiting\)/.test(live),
      'leaving the waiting room no longer closes it',
    );
    // Time up for a PLAYING battle still comes first of all.
    assert(live.indexOf('if (onTime)') < window, 'the clock is no longer checked first');
  });

  test('the answer says started, and only over is over', () => {
    assert(
      /started: saved\.state === 'playing' \|\| saved\.state === 'over'/.test(live),
      'the beat no longer tells the phone the battle has started',
    );
    assert(/over: saved\.state === 'over'/.test(live), '`over` must be exactly the over state');
    assert(!/over: saved\.state !== 'playing'/.test(live), 'a waiting room would read as over');
    assert(
      /msLeft: saved\.state === 'waiting' \? BATTLE_TIME_MS : battleMsLeft\(savedStartMs/.test(live),
      'a waiting room does not show the full clock, or the clock ignores the restarted start',
    );
    assert(/theyDropped:\s*saved\.state === 'playing' &&/.test(live), 'theyDropped is not limited to a playing battle');
  });
});

suite('friendly server · who is on', () => {
  test('the friends list says who is on, and never when', () => {
    assert(/import \{ isOnline, touchSeen \} from '@\/lib\/playerAuth'/.test(friends), 'friends route does not use the shared presence rule');
    assert(/online: isOnline\(p\.last_seen/.test(friends), 'friends no longer say whether they are on');
    assert(/favourite_arena, last_played, last_seen'\)/.test(friends), 'last_seen is not read for the online flag');
    // The timestamp itself stays on the server.
    assert(!/lastSeen:|last_seen: p\.|\.\.\.p\b/.test(friends), 'the friends route sends last_seen to the phone');
  });

  test('looking at the Friends screen counts as being on', () => {
    const get = friends.slice(friends.indexOf('export async function GET'), friends.indexOf('export async function POST'));
    assert(/touchSeen\(auth\.playerId\)/.test(get), 'the friends GET does not mark the player as on');
  });
});
