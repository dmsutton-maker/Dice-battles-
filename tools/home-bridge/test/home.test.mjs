import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { findTunnelUrl, loadOrCreateSecrets } from '../src/home.mjs';

test('finds the quick-tunnel address in cloudflared output', () => {
  const log = '2026-11-09T12:00:00Z INF |  https://quiet-lake-ab12.trycloudflare.com  |\n';
  assert.equal(findTunnelUrl(log), 'https://quiet-lake-ab12.trycloudflare.com');
  assert.equal(findTunnelUrl('see https://www.cloudflare.com/docs for help'), null);
});

test('secrets are made once, kept private, and reused', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'hb-sec-')), 'relay.json');
  const a = loadOrCreateSecrets(file);
  assert.notEqual(a.cloudToken, a.agentToken);
  assert.ok(a.cloudToken.length >= 32);
  if (process.platform !== 'win32') assert.equal(statSync(file).mode & 0o077, 0, 'not readable by others');
  assert.deepEqual(loadOrCreateSecrets(file), a);
});

const freePort = () =>
  new Promise((r) => {
    const s = createServer().listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => r(p));
    });
  });

test('bin/home.mjs runs relay + tunnel + agent from one command and prints the connector URL', async () => {
  const home = mkdtempSync(join(tmpdir(), 'hb-homedir-'));
  const fake = join(home, 'fake-cloudflared.mjs');
  writeFileSync(fake, `#!/usr/bin/env node\nconsole.error('INF |  https://fake-demo-1234.trycloudflare.com  |');\nsetInterval(() => {}, 1000);\n`);
  chmodSync(fake, 0o755);
  const cfgFile = join(home, 'config.json');
  writeFileSync(cfgFile, JSON.stringify({ approval: 'auto' }));
  const port = await freePort();
  const child = spawn(process.execPath, [fileURLToPath(new URL('../bin/home.mjs', import.meta.url)), '--port', String(port), '--cloudflared', fake, '--config', cfgFile], {
    env: { ...process.env, HOME: home, USERPROFILE: home },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  child.stdout.on('data', (c) => (out += c));
  child.stderr.on('data', (c) => (out += c));
  try {
    const deadline = Date.now() + 8000;
    while (!/\/mcp\/[0-9a-f]{64}/.test(out) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
    const secrets = JSON.parse(readFileSync(join(home, '.home-bridge', 'relay.json'), 'utf8'));
    assert.ok(out.includes(`https://fake-demo-1234.trycloudflare.com/mcp/${secrets.cloudToken}`), out);
    assert.equal((await fetch(`http://127.0.0.1:${port}/health`)).status, 200);
    // the agent is connected to the in-process relay
    let online = '';
    for (let i = 0; i < 40 && !/online/.test(online); i++) {
      const res = await fetch(`http://127.0.0.1:${port}/mcp/${secrets.cloudToken}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'home_status', arguments: {} } }),
      });
      online = (await res.json()).result.content[0].text;
      if (!/online/.test(online)) await new Promise((r) => setTimeout(r, 100));
    }
    assert.match(online, /online/);
  } finally {
    child.kill('SIGTERM');
  }
});
