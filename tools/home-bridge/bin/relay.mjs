#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { createRelay } from '../src/relay.mjs';
import { TaskStore } from '../src/store.mjs';

if (process.argv.includes('--gen-tokens')) {
  console.log(`BRIDGE_CLOUD_TOKEN=${randomBytes(32).toString('hex')}`);
  console.log(`BRIDGE_AGENT_TOKEN=${randomBytes(32).toString('hex')}`);
  process.exit(0);
}

const cloudToken = process.env.BRIDGE_CLOUD_TOKEN || '';
const agentToken = process.env.BRIDGE_AGENT_TOKEN || '';
if (cloudToken.length < 32 || agentToken.length < 32 || cloudToken === agentToken) {
  console.error('Set BRIDGE_CLOUD_TOKEN and BRIDGE_AGENT_TOKEN: two different secrets of at least 32 characters.');
  console.error('Make a pair with:  node bin/relay.mjs --gen-tokens');
  process.exit(1);
}

const store = new TaskStore({ file: process.env.BRIDGE_DATA || null });
const server = createRelay({ store, cloudToken, agentToken });
const port = Number(process.env.PORT) || 8787;
server.listen(port, () => console.log(`home-bridge relay listening on :${port}  (MCP at /mcp/<BRIDGE_CLOUD_TOKEN>)`));
for (const sig of ['SIGINT', 'SIGTERM'])
  process.on(sig, () => {
    store.flush();
    process.exit(0);
  });
