import assert from 'node:assert/strict';
import test from 'node:test';
import { TaskStore } from '../src/store.mjs';

const clock = () => {
  let t = 1_000_000;
  return { now: () => t, advance: (ms) => (t += ms) };
};

test('a queued task is claimed once, then finished', async () => {
  const s = new TaskStore();
  const t = s.enqueue({ instruction: 'hi' });
  assert.equal(t.status, 'queued');
  const claimed = await s.claim(0);
  assert.equal(claimed.id, t.id);
  assert.equal(await s.claim(0), null, 'no double hand-out');
  assert.ok(s.finish(t.id, { status: 'done', result: 'ok' }));
  assert.equal(s.get(t.id).result, 'ok');
});

test('a claim that is waiting wakes up when a task arrives', async () => {
  const s = new TaskStore();
  const waiting = s.claim(5000);
  setTimeout(() => s.enqueue({ instruction: 'later' }), 20);
  assert.equal((await waiting).instruction, 'later');
});

test('an aborted claim does not swallow a task', async () => {
  const s = new TaskStore();
  const ac = new AbortController();
  const waiting = s.claim(5000, null, ac.signal);
  ac.abort();
  assert.equal(await waiting, null);
  const t = s.enqueue({ instruction: 'x' });
  assert.equal(s.get(t.id).status, 'queued');
});

test('untouched tasks expire instead of running hours late', () => {
  const c = clock();
  const s = new TaskStore({ now: c.now, ttlMs: 1000 });
  const t = s.enqueue({ instruction: 'x' });
  c.advance(1500);
  assert.equal(s.get(t.id).status, 'expired');
});

test('a running task whose agent goes silent is failed', async () => {
  const c = clock();
  const s = new TaskStore({ now: c.now, staleMs: 1000 });
  const t = s.enqueue({ instruction: 'x' });
  await s.claim(0);
  c.advance(500);
  s.heartbeat(t.id);
  c.advance(800);
  assert.equal(s.get(t.id).status, 'running', 'heartbeat kept it alive');
  c.advance(1200);
  assert.equal(s.get(t.id).status, 'failed');
});

test('cancel wins over a late result', async () => {
  const s = new TaskStore();
  const t = s.enqueue({ instruction: 'x' });
  await s.claim(0);
  s.cancel(t.id);
  assert.deepEqual(s.heartbeat(t.id), { cancel: true });
  assert.equal(s.finish(t.id, { status: 'done', result: 'too late' }), false);
  assert.equal(s.get(t.id).status, 'cancelled');
});

test('input limits', () => {
  const s = new TaskStore({ maxQueued: 2 });
  assert.throws(() => s.enqueue({ instruction: '   ' }), /non-empty/);
  assert.throws(() => s.enqueue({ instruction: 'x'.repeat(20_001) }), /longer/);
  assert.throws(() => s.enqueue({ instruction: 'x', target: 'Bad Target!' }), /target/);
  s.enqueue({ instruction: 'a' });
  s.enqueue({ instruction: 'b' });
  assert.throws(() => s.enqueue({ instruction: 'c' }), /waiting/);
});

test('waitFor resolves when the task ends, and times out otherwise', async () => {
  const s = new TaskStore();
  const t = s.enqueue({ instruction: 'x' });
  await s.claim(0);
  const quick = s.waitFor(t.id, 30);
  assert.equal((await quick).status, 'running');
  const pending = s.waitFor(t.id, 5000);
  setTimeout(() => s.finish(t.id, { status: 'done', result: 'r' }), 20);
  assert.equal((await pending).status, 'done');
});
