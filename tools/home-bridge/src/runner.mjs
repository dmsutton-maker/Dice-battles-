import { spawn } from 'node:child_process';
import { realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

/**
 * The prompt goes in on stdin, never on the command line: `--allowedTools`
 * takes a list and would swallow a positional prompt, and a prompt that starts
 * with "-" would be read as a flag.
 */
export function buildArgs(target) {
  return ['-p', '--output-format', 'json', '--no-session-persistence', ...(target.args || [])];
}

/** Resolve the folder a task may run in, or throw. Symlinks are followed before checking. */
export function resolveCwd(requested, cfg) {
  const base = requested ? (isAbsolute(requested) ? requested : resolve(cfg.workDir, requested)) : cfg.workDir;
  let real;
  try {
    real = realpathSync(base);
    if (!statSync(real).isDirectory()) throw new Error('not a directory');
  } catch {
    throw new Error(`Folder does not exist on the home computer: ${base}`);
  }
  const ok = cfg.allowedDirs.some((dir) => {
    let root;
    try {
      root = realpathSync(dir);
    } catch {
      return false;
    }
    const rel = relative(root, real);
    return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
  });
  if (!ok) throw new Error(`The home computer only allows work inside: ${cfg.allowedDirs.join(', ')}`);
  return real;
}

export function runClaude({ bin, args, input, cwd, timeoutMs, maxBytes, signal, env = process.env }) {
  return new Promise((resolvePromise) => {
    let child;
    try {
      child = spawn(bin, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'], shell: process.platform === 'win32', windowsHide: true });
    } catch (err) {
      return resolvePromise({ code: -1, stdout: '', stderr: err.message, timedOut: false, cancelled: false });
    }
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let cancelled = false;
    let settled = false;
    const take = (cur, chunk) => (cur.length < maxBytes ? cur + chunk.toString('utf8') : cur);
    child.stdout.on('data', (c) => (stdout = take(stdout, c)));
    child.stderr.on('data', (c) => (stderr = take(stderr, c)));
    child.stdin.on('error', () => {});
    child.stdin.end(input);

    const kill = () => {
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 5000).unref();
    };
    const timer = setTimeout(() => {
      timedOut = true;
      kill();
    }, timeoutMs);
    const onAbort = () => {
      cancelled = true;
      kill();
    };
    if (signal?.aborted) onAbort();
    else signal?.addEventListener('abort', onAbort, { once: true });

    const done = (code, extraErr) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      resolvePromise({ code, stdout, stderr: extraErr ?? stderr, timedOut, cancelled });
    };
    child.on('error', (err) => done(-1, err.code === 'ENOENT' ? `Could not start "${bin}". Is Claude Code installed and on PATH?` : err.message));
    child.on('close', (code) => done(code ?? -1));
  });
}

/** Turn what the CLI printed into a status for the relay. */
export function interpret(run) {
  if (run.cancelled) return { status: 'cancelled', result: '', error: 'Stopped by request.' };
  let parsed = null;
  try {
    parsed = JSON.parse(run.stdout);
  } catch {
    /* plain text */
  }
  const body = typeof parsed?.result === 'string' ? parsed.result : run.stdout.trim();
  if (run.timedOut) return { status: 'failed', result: body, error: 'Timed out and was stopped on the home computer.' };
  if (parsed?.is_error) return { status: 'failed', result: body, error: 'Claude on the home computer reported an error.' };
  if (run.code !== 0) return { status: 'failed', result: body, error: `claude exited with code ${run.code}. ${run.stderr.trim().slice(-1500)}`.trim() };
  return { status: 'done', result: body || '(no output)', error: '' };
}
