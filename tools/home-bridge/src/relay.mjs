import { createServer } from 'node:http';
import { bearer, safeEqual } from './auth.mjs';
import { handleMessage } from './mcp.mjs';

const MAX_BODY = 512 * 1024;

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('body too large'), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve(null);
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('invalid JSON'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

const send = (res, status, body, headers = {}) => {
  if (res.headersSent || res.destroyed) return;
  if (body === undefined) return res.writeHead(status, headers).end();
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers }).end(JSON.stringify(body));
};

/**
 * The relay: an MCP endpoint for Claude's cloud (/mcp) and a small private API
 * for the home agent (/agent/*). Two different secrets, so a leaked connector
 * URL cannot impersonate the home computer and vice versa.
 */
export function createRelay({ store, cloudToken, agentToken }) {
  const sweeper = setInterval(() => store.sweep(), 10_000);
  sweeper.unref();

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://relay');
      const path = url.pathname;

      if (req.method === 'GET' && path === '/health') return send(res, 200, { ok: true });

      // ---- MCP for Claude's cloud: secret in the path, or a bearer header ----
      if (path === '/mcp' || path.startsWith('/mcp/')) {
        const fromPath = path.length > 5 ? decodeURIComponent(path.slice(5)) : null;
        const given = fromPath ?? bearer(req);
        if (!given || !safeEqual(given, cloudToken)) return send(res, fromPath ? 404 : 401, { error: 'not found' });
        if (req.method !== 'POST') return send(res, 405, { error: 'POST only' }, { allow: 'POST' });
        const body = await readJson(req);
        if (body === null) return send(res, 400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
        if (Array.isArray(body)) {
          const out = (await Promise.all(body.map((m) => handleMessage(store, m)))).filter(Boolean);
          return out.length ? send(res, 200, out) : send(res, 202);
        }
        const out = await handleMessage(store, body);
        return out ? send(res, 200, out) : send(res, 202);
      }

      // ---- Private API for the home agent ----
      if (path.startsWith('/agent/')) {
        const given = bearer(req);
        if (!given || !safeEqual(given, agentToken)) return send(res, 401, { error: 'unauthorized' });
        if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
        const body = (await readJson(req)) ?? {};

        if (path === '/agent/claim') {
          const wait = Math.min(Math.max(Number(url.searchParams.get('wait')) || 0, 0), 30) * 1000;
          const abort = new AbortController();
          res.on('close', () => abort.abort());
          const task = await store.claim(wait, body.info, abort.signal);
          if (!task) return send(res, 204);
          if (res.destroyed) return store.release(task.id);
          return send(res, 200, { task: { id: task.id, instruction: task.instruction, target: task.target, cwd: task.cwd } });
        }

        const m = /^\/agent\/tasks\/([\w-]+)\/(progress|result)$/.exec(path);
        if (m) {
          if (m[2] === 'progress') {
            const beat = store.heartbeat(m[1]);
            return beat ? send(res, 200, beat) : send(res, 404, { error: 'no such task' });
          }
          const accepted = store.finish(m[1], { status: body.status, result: body.result ?? '', error: body.error ?? '' });
          return send(res, 200, { accepted });
        }
      }

      send(res, 404, { error: 'not found' });
    } catch (err) {
      if (err.status) return send(res, err.status, { error: err.message });
      console.error('request failed:', err.message);
      send(res, 500, { error: 'internal error' });
    }
  });
  server.on('close', () => clearInterval(sweeper));
  return server;
}
