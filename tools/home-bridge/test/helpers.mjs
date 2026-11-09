import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRelay } from '../src/relay.mjs';
import { TaskStore } from '../src/store.mjs';

export const CLOUD = 'c'.repeat(40);
export const AGENT = 'a'.repeat(40);

export async function startRelay(storeOpts = {}) {
  const store = new TaskStore(storeOpts);
  const server = createRelay({ store, cloudToken: CLOUD, agentToken: AGENT });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}`;
  return { store, server, url, close: () => new Promise((r) => (server.closeAllConnections?.(), server.close(r))) };
}

let id = 1;
export async function rpc(url, method, params, path = `/mcp/${CLOUD}`, headers = {}) {
  const res = await fetch(url + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ jsonrpc: '2.0', id: id++, method, params }),
  });
  return { status: res.status, body: res.status === 200 ? await res.json() : null };
}
export const callTool = (url, name, args) => rpc(url, 'tools/call', { name, arguments: args }).then((r) => r.body.result);

/** A stand-in for the `claude` CLI: echoes its stdin and arguments back as the JSON the real one prints. */
export function fakeClaude(dir = mkdtempSync(join(tmpdir(), 'hb-'))) {
  mkdirSync(dir, { recursive: true });
  const bin = join(dir, 'fake-claude.mjs');
  writeFileSync(
    bin,
    `#!/usr/bin/env node
let input = '';
process.stdin.on('data', (c) => (input += c));
process.stdin.on('end', () => {
  if (input.includes('SLEEP')) return setTimeout(() => {}, 60000);
  if (input.includes('FAIL')) { console.error('boom'); process.exit(3); }
  console.log(JSON.stringify({ type: 'result', is_error: false, result: 'ran: ' + input + ' | cwd=' + process.cwd() + ' | args=' + process.argv.slice(2).join(' ') }));
});
`,
  );
  chmodSync(bin, 0o755);
  return { bin, dir };
}
