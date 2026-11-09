#!/usr/bin/env node
/**
 * One command, everything on this computer: the relay, a free Cloudflare quick tunnel so Claude's
 * cloud can reach it, and the agent that runs tasks. Nothing is hosted anywhere else.
 */
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { runAgent } from '../src/agent.mjs';
import { DEFAULT_CONFIG_PATH, loadConfig } from '../src/config.mjs';
import { loadOrCreateSecrets, startTunnel } from '../src/home.mjs';
import { createRelay } from '../src/relay.mjs';
import { TaskStore } from '../src/store.mjs';

const { values } = parseArgs({
  options: {
    port: { type: 'string' },
    config: { type: 'string' },
    cloudflared: { type: 'string' },
    'no-tunnel': { type: 'boolean' },
    'public-url': { type: 'string' },
  },
});
const dir = join(homedir(), '.home-bridge');
const port = Number(values.port || process.env.PORT) || 8787;

let cfg;
const secrets = loadOrCreateSecrets(join(dir, 'relay.json'));
try {
  cfg = loadConfig(values.config || process.env.HOME_BRIDGE_CONFIG || DEFAULT_CONFIG_PATH, {
    HOME_BRIDGE_URL: `http://127.0.0.1:${port}`,
    HOME_BRIDGE_AGENT_TOKEN: secrets.agentToken,
  });
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
if (cfg.approval === 'ask' && !process.stdin.isTTY) {
  console.error('approval is "ask" but there is no terminal to ask in. Run this in a terminal, or set "approval": "auto" in the config on purpose.');
  process.exit(1);
}

const store = new TaskStore({ file: join(dir, 'tasks.json') });
const server = createRelay({ store, cloudToken: secrets.cloudToken, agentToken: secrets.agentToken });
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(port, '127.0.0.1', resolve);
}).catch((err) => {
  console.error(err.code === 'EADDRINUSE' ? `Port ${port} is already in use. Is home-bridge already running? Try --port.` : err.message);
  process.exit(1);
});

const banner = (publicUrl) => {
  console.log(`
==============================================================
 Paste this into claude.ai -> Settings -> Connectors ->
 Add custom connector (leave OAuth blank). It is a password:

   ${publicUrl}/mcp/${secrets.cloudToken}

 Then start a NEW cloud session and ask it to run home_status.
==============================================================`);
};

let tunnel = null;
if (values['public-url']) banner(values['public-url'].replace(/\/+$/, ''));
else if (!values['no-tunnel'])
  tunnel = startTunnel({
    bin: values.cloudflared || 'cloudflared',
    port,
    onUrl: (url) => {
      banner(url);
      console.log('(This address changes whenever the tunnel restarts; paste the new one into the connector if it does.)');
    },
  });
else console.log(`Relay listening on 127.0.0.1:${port} with no tunnel. Connector path: /mcp/${secrets.cloudToken}`);

const stop = new AbortController();
const shutdown = () => {
  stop.abort();
  tunnel?.stop();
  store.flush();
  setTimeout(() => process.exit(0), 200).unref();
};
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, shutdown);

runAgent(cfg, { signal: stop.signal }).catch((err) => {
  console.error(err.message);
  shutdown();
});
