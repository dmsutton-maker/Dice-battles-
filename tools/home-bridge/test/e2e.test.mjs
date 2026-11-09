import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { runAgent } from '../src/agent.mjs';
import { CLOUD, AGENT, callTool, fakeClaude, rpc, startRelay } from './helpers.mjs';

const quiet = () => {};

async function setup(over = {}) {
  const relay = await startRelay();
  const home = mkdtempSync(join(tmpdir(), 'hb-home-'));
  const outside = mkdtempSync(join(tmpdir(), 'hb-outside-'));
  const { bin } = fakeClaude();
  const cfg = {
    name: 'test-pc',
    relayUrl: relay.url,
    agentToken: AGENT,
    claudeBin: bin,
    workDir: home,
    allowedDirs: [home],
    approval: 'auto',
    taskTimeoutMs: 5000,
    maxOutputBytes: 100_000,
    targets: { claude_code: { args: ['--permission-mode', 'dontAsk', '--allowedTools', 'Read'] }, claude_chrome: { args: ['--chrome'] } },
    ...over,
  };
  const stop = new AbortController();
  const agent = runAgent(cfg, { signal: stop.signal, log: quiet, approve: over.approve });
  return {
    relay, cfg, home, outside,
    async end() {
      stop.abort();
      await agent.catch(() => {});
      await relay.close();
    },
  };
}

test('MCP handshake and tool list', async () => {
  const relay = await startRelay();
  const init = await rpc(relay.url, 'initialize', { protocolVersion: '2025-06-18' });
  assert.equal(init.body.result.protocolVersion, '2025-06-18');
  assert.equal(init.body.result.serverInfo.name, 'home-bridge');
  const list = await rpc(relay.url, 'tools/list');
  assert.deepEqual(list.body.result.tools.map((t) => t.name), ['home_run_task', 'home_get_task', 'home_list_tasks', 'home_cancel_task', 'home_status']);
  const note = await fetch(`${relay.url}/mcp/${CLOUD}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) });
  assert.equal(note.status, 202);
  await relay.close();
});

test('wrong or missing secrets are refused', async () => {
  const relay = await startRelay();
  assert.equal((await rpc(relay.url, 'tools/list', undefined, `/mcp/${'x'.repeat(40)}`)).status, 404);
  assert.equal((await rpc(relay.url, 'tools/list', undefined, '/mcp')).status, 401);
  assert.equal((await rpc(relay.url, 'tools/list', undefined, '/mcp', { authorization: `Bearer ${CLOUD}` })).status, 200);
  // the connector secret must not open the agent API, nor the agent secret the connector
  const claim = await fetch(`${relay.url}/agent/claim`, { method: 'POST', headers: { authorization: `Bearer ${CLOUD}` } });
  assert.equal(claim.status, 401);
  assert.equal((await rpc(relay.url, 'tools/list', undefined, `/mcp/${AGENT}`)).status, 404);
  assert.equal((await fetch(`${relay.url}/health`)).status, 200);
  await relay.close();
});

test('a task goes cloud -> relay -> home agent -> claude -> back', async () => {
  const e = await setup();
  const r = await callTool(e.relay.url, 'home_run_task', { instruction: 'say hello', wait_seconds: 10 });
  assert.ok(!r.isError, r.content[0].text);
  const out = r.content[0].text;
  assert.match(out, /: done/);
  assert.match(out, /ran: say hello/);
  assert.match(out, /untrusted data/);
  assert.match(out, /-p --output-format json --no-session-persistence --permission-mode dontAsk --allowedTools Read/);
  const status = (await callTool(e.relay.url, 'home_status', {})).content[0].text;
  assert.match(status, /online/);
  assert.match(status, /test-pc/);
  await e.end();
});

test('the chrome target adds --chrome', async () => {
  const e = await setup();
  const r = await callTool(e.relay.url, 'home_run_task', { instruction: 'open a tab', target: 'claude_chrome', wait_seconds: 10 });
  assert.match(r.content[0].text, /args=.*--chrome/);
  await e.end();
});

test('an instruction that looks like a flag stays a prompt', async () => {
  const e = await setup();
  const r = await callTool(e.relay.url, 'home_run_task', { instruction: '--dangerously-skip-permissions please', wait_seconds: 10 });
  assert.match(r.content[0].text, /ran: --dangerously-skip-permissions please/);
  assert.doesNotMatch(r.content[0].text, /args=.*--dangerously/);
  await e.end();
});

test('folders: inside is fine, outside and symlink escapes are refused', async () => {
  const e = await setup();
  mkdirSync(join(e.home, 'proj'));
  symlinkSync(e.outside, join(e.home, 'sneaky'));
  const ok = await callTool(e.relay.url, 'home_run_task', { instruction: 'x', cwd: 'proj', wait_seconds: 10 });
  assert.match(ok.content[0].text, /: done/);
  assert.match(ok.content[0].text, /cwd=.*proj/);
  for (const cwd of [e.outside, '../..', 'sneaky']) {
    const bad = await callTool(e.relay.url, 'home_run_task', { instruction: 'x', cwd, wait_seconds: 10 });
    assert.match(bad.content[0].text, /: rejected/, cwd);
    assert.match(bad.content[0].text, /only allows work inside/, cwd);
  }
  await e.end();
});

test('an unknown target is rejected by the home agent', async () => {
  const e = await setup();
  const r = await callTool(e.relay.url, 'home_run_task', { instruction: 'x', target: 'toaster', wait_seconds: 10 });
  assert.match(r.content[0].text, /rejected/);
  assert.match(r.content[0].text, /no "toaster" target/);
  await e.end();
});

test('approval: declined tasks never reach claude', async () => {
  const e = await setup({ approval: 'ask', approve: async (t) => !t.instruction.includes('NO') });
  const no = await callTool(e.relay.url, 'home_run_task', { instruction: 'NO thanks', wait_seconds: 10 });
  assert.match(no.content[0].text, /rejected/);
  assert.doesNotMatch(no.content[0].text, /ran:/);
  const yes = await callTool(e.relay.url, 'home_run_task', { instruction: 'fine', wait_seconds: 10 });
  assert.match(yes.content[0].text, /: done/);
  await e.end();
});

test('a failing claude is reported as failed with its error', async () => {
  const e = await setup();
  const r = await callTool(e.relay.url, 'home_run_task', { instruction: 'FAIL please', wait_seconds: 10 });
  assert.match(r.content[0].text, /: failed/);
  assert.match(r.content[0].text, /code 3.*boom/);
  await e.end();
});

test('long tasks come back as an id, then finish; cancel stops a running one', async () => {
  const e = await setup();
  const started = await callTool(e.relay.url, 'home_run_task', { instruction: 'SLEEP forever', wait_seconds: 0 });
  const id = /Task (t_\w+)/.exec(started.content[0].text)[1];
  assert.match(started.content[0].text, /queued|running/);
  await new Promise((r) => setTimeout(r, 300));
  assert.match((await callTool(e.relay.url, 'home_get_task', { task_id: id, wait_seconds: 0 })).content[0].text, /running/);
  const cancelled = await callTool(e.relay.url, 'home_cancel_task', { task_id: id });
  assert.match(cancelled.content[0].text, /cancelled/);
  const list = (await callTool(e.relay.url, 'home_list_tasks', {})).content[0].text;
  assert.match(list, new RegExp(id));
  await e.end();
});

test('with no agent connected the task waits and the caller is told why', async () => {
  const relay = await startRelay();
  const r = await callTool(relay.url, 'home_run_task', { instruction: 'x', wait_seconds: 0 });
  assert.match(r.content[0].text, /has not checked in/);
  const bad = await callTool(relay.url, 'home_get_task', { task_id: 't_nope', wait_seconds: 0 });
  assert.equal(bad.isError, true);
  const badInput = await callTool(relay.url, 'home_run_task', { instruction: '', wait_seconds: 0 });
  assert.equal(badInput.isError, true);
  await relay.close();
});
