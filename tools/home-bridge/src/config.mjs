import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, hostname } from 'node:os';
import { dirname, join } from 'node:path';

export const DEFAULT_CONFIG_PATH = join(homedir(), '.home-bridge', 'config.json');

/**
 * Safe by default: both targets run with `dontAsk`, which means anything not
 * listed in allowedTools is refused instead of prompting (nobody is there to
 * click Allow). Widen them deliberately, in your own config file.
 */
export const DEFAULTS = {
  name: hostname(),
  relayUrl: '',
  agentToken: '',
  claudeBin: 'claude',
  workDir: homedir(),
  allowedDirs: [], // empty = just workDir
  approval: 'ask', // 'ask' = confirm each task in this terminal; 'auto' = run without asking
  taskTimeoutMs: 15 * 60_000,
  maxOutputBytes: 400_000,
  targets: {
    claude_code: {
      args: ['--permission-mode', 'dontAsk', '--allowedTools', 'Read,Glob,Grep'],
    },
    claude_chrome: {
      args: ['--chrome', '--permission-mode', 'dontAsk', '--allowedTools', 'mcp__claude-in-chrome'],
    },
  },
};

export function loadConfig(path = process.env.HOME_BRIDGE_CONFIG || DEFAULT_CONFIG_PATH, env = process.env) {
  let file = {};
  if (existsSync(path)) {
    try {
      file = JSON.parse(readFileSync(path, 'utf8'));
    } catch (err) {
      throw new Error(`Could not read ${path}: ${err.message}`);
    }
  }
  const cfg = { ...DEFAULTS, ...file, targets: { ...DEFAULTS.targets, ...(file.targets || {}) } };
  if (env.HOME_BRIDGE_URL) cfg.relayUrl = env.HOME_BRIDGE_URL;
  if (env.HOME_BRIDGE_AGENT_TOKEN) cfg.agentToken = env.HOME_BRIDGE_AGENT_TOKEN;
  cfg.relayUrl = String(cfg.relayUrl).replace(/\/+$/, '');
  if (!cfg.allowedDirs?.length) cfg.allowedDirs = [cfg.workDir];
  if (!/^https?:\/\//.test(cfg.relayUrl)) throw new Error('relayUrl is missing. Run:  node bin/agent.mjs init --url <relay url> --token <agent token>');
  if (!cfg.agentToken) throw new Error('agentToken is missing. Run:  node bin/agent.mjs init --url <relay url> --token <agent token>');
  if (!['ask', 'auto'].includes(cfg.approval)) throw new Error('approval must be "ask" or "auto"');
  return cfg;
}

export function writeConfig(path, { relayUrl, agentToken, approval }) {
  mkdirSync(dirname(path), { recursive: true });
  const body = { name: hostname(), relayUrl, agentToken, approval: approval || 'ask' };
  writeFileSync(path, JSON.stringify(body, null, 2) + '\n', { mode: 0o600 });
  try {
    chmodSync(path, 0o600);
  } catch {
    /* Windows */
  }
  return body;
}
