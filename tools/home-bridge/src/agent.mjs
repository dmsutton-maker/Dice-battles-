import { createInterface } from 'node:readline';
import { hostname } from 'node:os';
import { buildArgs, interpret, resolveCwd, runClaude } from './runner.mjs';

const HEARTBEAT_MS = 10_000;
const sleep = (ms, signal) =>
  new Promise((r) => {
    const t = setTimeout(r, ms);
    signal?.addEventListener('abort', () => (clearTimeout(t), r()), { once: true });
  });

export function askInTerminal(task, timeoutMs = 5 * 60_000) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const timer = setTimeout(() => (rl.close(), resolve(false)), timeoutMs);
    console.log(`\n--- Task ${task.id} from Claude in the cloud (${task.target}${task.cwd ? `, in ${task.cwd}` : ''}) ---\n${task.instruction}\n---`);
    rl.question('Run this on this computer? [y/N] ', (a) => {
      clearTimeout(timer);
      rl.close();
      resolve(/^y(es)?$/i.test(a.trim()));
    });
  });
}

export async function runAgent(cfg, { signal, log = console.log, approve = askInTerminal, fetchImpl = fetch } = {}) {
  const info = () => ({ name: cfg.name, targets: Object.keys(cfg.targets), approval: cfg.approval });
  const call = async (path, body, timeoutMs = 15_000) => {
    const res = await fetchImpl(`${cfg.relayUrl}${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${cfg.agentToken}`, 'content-type': 'application/json' },
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.any([AbortSignal.timeout(timeoutMs), ...(signal ? [signal] : [])]),
    });
    if (res.status === 401) throw Object.assign(new Error('The relay rejected the agent token.'), { fatal: true });
    return res;
  };

  async function handle(task) {
    log(`task ${task.id} (${task.target}): ${task.instruction.replace(/\s+/g, ' ').slice(0, 100)}`);
    const control = new AbortController();
    const beat = setInterval(async () => {
      try {
        const r = await call(`/agent/tasks/${task.id}/progress`, {});
        if (r.ok && (await r.json()).cancel) control.abort();
      } catch {
        /* the relay will mark us stale if this keeps failing */
      }
    }, HEARTBEAT_MS);
    const report = (outcome) => call(`/agent/tasks/${task.id}/result`, outcome, 30_000).catch((e) => log(`could not report ${task.id}: ${e.message}`));
    try {
      const target = cfg.targets[task.target];
      if (!target) return await report({ status: 'rejected', error: `This computer has no "${task.target}" target. It offers: ${Object.keys(cfg.targets).join(', ')}.` });
      let cwd;
      try {
        cwd = resolveCwd(task.cwd, cfg);
      } catch (err) {
        return await report({ status: 'rejected', error: err.message });
      }
      if (cfg.approval === 'ask' && !(await approve(task))) return await report({ status: 'rejected', error: 'The owner declined, or did not answer in time.' });
      const run = await runClaude({
        bin: cfg.claudeBin,
        args: buildArgs(target),
        input: task.instruction,
        cwd,
        timeoutMs: cfg.taskTimeoutMs,
        maxBytes: cfg.maxOutputBytes,
        signal: signal ? AbortSignal.any([control.signal, signal]) : control.signal,
      });
      const outcome = interpret(run);
      log(`task ${task.id}: ${outcome.status}`);
      await report(outcome);
    } finally {
      clearInterval(beat);
    }
  }

  let backoff = 1000;
  log(`home-bridge agent "${cfg.name}" connected to ${cfg.relayUrl} (approval: ${cfg.approval}, folders: ${cfg.allowedDirs.join(', ')})`);
  while (!signal?.aborted) {
    try {
      const res = await call('/agent/claim?wait=25', { info: info() }, 40_000);
      backoff = 1000;
      if (res.status === 200) await handle((await res.json()).task);
      else if (res.status !== 204) throw new Error(`relay answered ${res.status}`);
    } catch (err) {
      if (signal?.aborted) break;
      if (err.fatal) throw err;
      log(`relay unreachable (${err.message}); retrying in ${Math.round(backoff / 1000)}s`);
      await sleep(backoff, signal);
      backoff = Math.min(backoff * 2, 60_000);
    }
  }
}

export { hostname };
