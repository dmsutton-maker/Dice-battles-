import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, assertEqual, suite, test } from './harness';
import { JOIN_WAIT_MS } from '../src/game/friendlyBattle';
import { REMATCH_WINDOW_MS } from '../src/game/rematch';
import * as server from '../hq/src/lib/battleClock';
import * as rematch from '../hq/src/lib/rematch';

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
const migration = read('hq/supabase/migrations/20261105_rematch.sql');
const schema = read('hq/supabase/schema.sql');

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

/**
 * THE REMATCH, the server's half (hq/src/lib/rematch.ts and the
 * 'rematch' action in the battles route).
 *
 * Marc, 5 Nov 2026: "After a game against your friend, if one of you
 * chooses to play again, it should have to wait for the other player too
 * in order to be able to play again, because right now it plays again
 * against your friend but they're not playing really."
 */
suite('friendly server · the rematch', () => {
  const me = 'local-me';
  const them = 'local-marc';
  const mine = { id: 'inv-mine', from_id: me, to_id: them };
  const theirs = { id: 'inv-theirs', from_id: them, to_id: me };
  const ended = 7_000_000;

  test('the game and the server give the same ten minutes', () => {
    assertEqual(rematch.REMATCH_WINDOW_MS, REMATCH_WINDOW_MS, 'REMATCH_WINDOW_MS differs between game and server');
    assertEqual(REMATCH_WINDOW_MS, 10 * 60_000, 'the window is ten minutes');
  });

  test('within ten minutes of the end, and not after', () => {
    assert(rematch.rematchWindowOpen(ended, ended), 'closed at once');
    assert(rematch.rematchWindowOpen(ended, ended + REMATCH_WINDOW_MS - 1), 'closed a moment early');
    assert(!rematch.rematchWindowOpen(ended, ended + REMATCH_WINDOW_MS), 'open past ten minutes');
    assert(!rematch.rematchWindowOpen(Number.NaN, ended), 'a battle with no readable end can be played again');
    // The invite lives exactly to the end of the window.
    assertEqual(rematch.rematchExpiresAt(ended), ended + REMATCH_WINDOW_MS, 'the invite does not run out with the window');
  });

  test('both asking is one battle: the second ask accepts the first', () => {
    // Marc asked first; my ask is the answer to his.
    const second = rematch.mergeRematchAsks(me, [theirs]);
    assertEqual(second.kind, 'accept', 'their invite is not accepted');
    assert(second.kind === 'accept' && second.invite.id === 'inv-theirs', 'accepted the wrong invite');
    // Seen from Marc's side at the same moment: the mirror image.
    const his = rematch.mergeRematchAsks(them, [mine]);
    assertEqual(his.kind, 'accept', 'from the other side, my invite is not accepted');
    // Nobody has asked: ask.
    assertEqual(rematch.mergeRematchAsks(me, []).kind, 'ask', 'nothing open is not an ask');
  });

  test('asking twice returns the invite already sent', () => {
    const again = rematch.mergeRematchAsks(me, [mine]);
    assertEqual(again.kind, 'mine', 'a second ask is not the first');
    assert(again.kind === 'mine' && again.invite.id === 'inv-mine', 'the wrong invite');
    // Both open at once (two requests raced past the lookup): theirs wins,
    // so the next ask from either side still ends in one battle.
    assertEqual(rematch.mergeRematchAsks(me, [mine, theirs]).kind, 'accept', 'two open invites are left standing');
    // Somebody else's invite for this battle is nobody's business here.
    assertEqual(rematch.mergeRematchAsks(me, [{ id: 'x', from_id: 'local-other', to_id: them }]).kind, 'ask', 'a stranger\'s invite was taken');
  });

  test('a rematch is the kind the first battle was', () => {
    assertEqual(rematch.rematchKind('match'), 'match', 'a match');
    assertEqual(rematch.rematchKind('friend'), 'friend', 'a friend');
    assertEqual(rematch.rematchKind(undefined), 'friend', 'a row from before the column');
    assertEqual(rematch.rematchKind(null), 'friend', 'null');
  });

  test('the route: only an over battle, only its players, only inside the window', () => {
    const ask = battles.slice(battles.indexOf("if (action === 'rematch')"), battles.indexOf('const inviteId ='));
    assert(ask.length > 0, 'there is no rematch action');
    assert(/if \(!iAmA && !iAmB\) return NextResponse\.json\(\{ error: 'not your battle' \}, \{ status: 403 \}\)/.test(ask), 'anybody may ask about any battle');
    assert(/battle\.state !== 'over'/.test(ask), 'a battle still on can be asked again');
    assert(/if \(!rematchWindowOpen\(endedAtMs, Date\.now\(\)\)\)/.test(ask), 'the window is not checked');
    assert(ask.indexOf('rematchWindowOpen(') < ask.indexOf('mergeRematchAsks('), 'the merge runs before the window');
  });

  test('the route merges the asks, and accepts by the one accept path', () => {
    const ask = battles.slice(battles.indexOf("if (action === 'rematch')"), battles.indexOf('const inviteId ='));
    assert(/\.eq\('state', 'waiting'\)\s*\.eq\('rematch_of', battleId\)/.test(ask), 'the open invites for this battle are not looked up');
    assert(/if \(openError\) return NextResponse\.json\(\{ error: 'could not send that' \}/.test(ask), 'a failed lookup is read as nobody');
    assert(/if \(merged\.kind === 'accept'\) \{[\s\S]*?return acceptInvite\(supabase, merged\.invite/.test(ask), 'the second ask does not accept the first');
    assert(/if \(merged\.kind === 'mine'\) \{[\s\S]*?id: merged\.invite\.id/.test(ask), 'asking twice makes a second invite');
    // The tapped Accept takes the same path, so a rematch accepted by hand is the same battle.
    assert(/if \(action === 'accept'\) \{\s*if \(!mine\)[^\n]*\n\s*return acceptInvite\(supabase, invite, now\);/.test(battles), 'accept has its own copy of the battle insert');
    assert(!/\.or\(/.test(battles), 'an "or" filter string crept into the battles route');
  });

  test('the invite lives to the end of the window and is marked as a rematch', () => {
    const ask = battles.slice(battles.indexOf("if (action === 'rematch')"), battles.indexOf('const inviteId ='));
    const insert = ask.slice(ask.indexOf(".from('battle_invites')\n      .insert({"));
    assert(/expires_at: new Date\(rematchExpiresAt\(endedAtMs\)\)\.toISOString\(\)/.test(insert), 'the invite runs out in 45 seconds');
    assert(/rematch_of: battleId/.test(insert), 'the invite is not marked as a rematch');
    assert(/mode: battle\.mode,\s*difficulty: battle\.difficulty/.test(insert), 'the rematch is not the same game');
    // One outgoing invite at a time, as with a challenge.
    assert(/update\(\{ state: 'cancelled', decided_at: now\.toISOString\(\) \}\)\s*\.eq\('from_id', auth\.playerId\)\s*\.eq\('state', 'waiting'\)/.test(ask), 'an earlier invite of mine is left standing');
  });

  test('they must still be playable, and on — in the same words as a challenge', () => {
    const ask = battles.slice(battles.indexOf("if (action === 'rematch')"), battles.indexOf('const inviteId ='));
    assert(ask.includes('mayPlay(supabase, auth.playerId, otherId, kind)'), 'a block or an unfriending is not checked');
    assert(/if \(!may\.ok \|\| !isOnline\(them\?\.last_seen\)\)/.test(ask), 'an absent player can be asked');
    assert(ask.includes("is not playing right now"), 'the words differ from a challenge\'s');
  });

  test('a match\'s rematch is a match: never friends-checked, and found by the poll', () => {
    const accept = battles.slice(battles.indexOf('async function acceptInvite'), battles.indexOf('const peek ='));
    assert(/kind = rematchKind\(original\?\.kind\)/.test(accept), 'the kind of the first battle is not read');
    assert(/\.\.\.\(kind === 'match' \? \{ kind \} : \{\}\)/.test(accept), 'kind is written for every battle, or for none');
    assert(/battle: \{[\s\S]*?kind,\s*\}/.test(accept), 'the accepter is not told the kind');
    const may = battles.slice(battles.indexOf('async function mayPlay'), battles.indexOf('async function acceptInvite'));
    assert(/if \(kind === 'match'\) \{\s*const block = await blockedEitherWay/.test(may), 'two strangers are asked to be friends');
    assert(/return \{ ok: link\.mine && link\.theirs, error: link\.error \}/.test(may), 'friends are not checked both ways');
    // The friends poll hands out a match born from an invite, and says so.
    assert(/\.filter\(\(r\) => r\.kind !== 'match' \|\| fromInvite\.has\(String\(r\.id\)\)\)/.test(battles), 'the asker of a match rematch never finds the room');
    assert(/kind: rematchKind\(live\.kind\)/.test(battles), 'the poll does not say what kind a battle is');
  });

  test('invites are read with *, so the website deploys before the migration', () => {
    assert(/const INVITE_COLUMNS = '\*'/.test(battles), 'invites are read by a list of columns');
    assert(!/select\('id, from_id, to_id, mode, difficulty, state, expires_at'\)/.test(battles), 'an invite read names columns and would break without rematch_of');
    assert(/rematchOf: r\.rematch_of \?\? null/.test(battles) && /rematchOf: outgoing\.rematch_of \?\? null/.test(battles), 'the answer does not say which invite is a rematch');
    assert(/online: isOnline\(p\.last_seen/.test(battles), 'the asker cannot tell their app has closed');
    assert(/select\('player_id, name, trophies, last_seen'\)/.test(battles), 'last_seen is not read for the online flag');
  });

  test('the migration is additive, and schema.sql has it too', () => {
    const statements = migration.replace(/--[^\n]*/g, '');
    assert(!/\bdrop\b/i.test(statements), 'the migration contains a DROP');
    assert(/add column if not exists rematch_of uuid null/.test(migration), 'rematch_of');
    assert(/references public\.battles \(id\) on delete set null/.test(migration), 'rematch_of does not point at battles');
    assert(/create index if not exists battle_invites_rematch_idx/.test(migration), 'no index for the lookup');
    assert(/enable row level security/.test(migration), 'RLS is not restated');
    assert(!/create policy/i.test(statements), 'a policy appeared on a table that has none');
    assert(schema.includes('rematch_of uuid null'), 'schema.sql has no rematch_of');
    assert(schema.includes('battle_invites_rematch_idx'), 'schema.sql has no rematch index');
  });
});
