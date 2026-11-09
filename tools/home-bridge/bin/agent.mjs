#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { runAgent } from '../src/agent.mjs';
import { DEFAULT_CONFIG_PATH, loadConfig, writeConfig } from '../src/config.mjs';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    url: { type: 'string' },
    token: { type: 'string' },
    approval: { type: 'string' },
    config: { type: 'string' },
  },
});
const path = values.config || process.env.HOME_BRIDGE_CONFIG || DEFAULT_CONFIG_PATH;

if (positionals[0] === 'init') {
  if (!values.url || !values.token) {
    console.error('Usage: node bin/agent.mjs init --url https://your-relay.example.com --token <BRIDGE_AGENT_TOKEN> [--approval ask|auto]');
    process.exit(1);
  }
  writeConfig(path, { relayUrl: values.url.replace(/\/+$/, ''), agentToken: values.token, approval: values.approval });
  console.log(`Wrote ${path} (readable only by you). Start the agent with:  node bin/agent.mjs`);
  process.exit(0);
}

let cfg;
try {
  cfg = loadConfig(path);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
if (cfg.approval === 'ask' && !process.stdin.isTTY) {
  console.error('approval is "ask" but there is no terminal to ask in. Run this in a terminal, or set "approval": "auto" in the config on purpose.');
  process.exit(1);
}

const stop = new AbortController();
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => stop.abort());
runAgent(cfg, { signal: stop.signal }).catch((err) => {
  console.error(err.message);
  process.exit(1);
});
