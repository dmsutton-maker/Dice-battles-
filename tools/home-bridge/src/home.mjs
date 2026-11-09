import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const TUNNEL_URL = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;

/** Pull the public address out of cloudflared's log output. */
export function findTunnelUrl(text) {
  const m = TUNNEL_URL.exec(text);
  return m ? m[0] : null;
}

/** The two secrets live in one private file so the connector URL stays the same between runs. */
export function loadOrCreateSecrets(path) {
  if (existsSync(path)) {
    try {
      const s = JSON.parse(readFileSync(path, 'utf8'));
      if (s.cloudToken?.length >= 32 && s.agentToken?.length >= 32) return s;
    } catch {
      /* fall through and make new ones */
    }
  }
  const s = { cloudToken: randomBytes(32).toString('hex'), agentToken: randomBytes(32).toString('hex') };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(s, null, 2) + '\n', { mode: 0o600 });
  try {
    chmodSync(path, 0o600);
  } catch {
    /* Windows */
  }
  return s;
}

/**
 * Run `cloudflared tunnel --url ...` and report each address it is given. A quick tunnel gets a
 * NEW random address every time it starts, so a restart is reported and the caller prints the
 * connector URL again.
 */
export function startTunnel({ bin = 'cloudflared', port, onUrl, log = console.log }) {
  let child = null;
  let stopped = false;

  const launch = () => {
    let announced = null;
    child = spawn(bin, ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${port}`], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    const scan = (chunk) => {
      const url = findTunnelUrl(chunk.toString('utf8'));
      if (url && url !== announced) {
        announced = url;
        onUrl(url);
      }
    };
    child.stdout.on('data', scan);
    child.stderr.on('data', scan);
    child.on('error', (err) => {
      stopped = true;
      log(err.code === 'ENOENT' ? `Could not start "${bin}". Install cloudflared first (see the README), or use --no-tunnel.` : `tunnel failed: ${err.message}`);
    });
    child.on('close', (code) => {
      if (stopped) return;
      log(`tunnel stopped (code ${code}); restarting in 5s. The public address will change.`);
      setTimeout(() => !stopped && launch(), 5000).unref?.();
    });
  };
  launch();

  return {
    stop() {
      stopped = true;
      child?.kill('SIGTERM');
    },
  };
}
