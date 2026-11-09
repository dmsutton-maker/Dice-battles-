import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export const FINAL = new Set(['done', 'failed', 'cancelled', 'rejected', 'expired']);
export const MAX_INSTRUCTION = 20_000;
export const MAX_RESULT = 100_000;

export class BridgeError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * The task queue. Lives in the relay. A task is: queued -> running (the home
 * agent claimed it) -> done | failed | rejected, or cancelled / expired.
 */
export class TaskStore {
  constructor({
    file = null,
    now = Date.now,
    ttlMs = 60 * 60_000, // a task nobody picked up for this long is dropped, not run late
    staleMs = 90_000, // a running task with no heartbeat for this long is failed
    maxTasks = 200,
    maxQueued = 20,
  } = {}) {
    Object.assign(this, { file, now, ttlMs, staleMs, maxTasks, maxQueued });
    this.tasks = [];
    this.claimers = new Set();
    this.finishers = new Map();
    this.saveTimer = null;
    this.agent = { lastSeen: 0, info: null };
    this.#load();
  }

  #load() {
    if (!this.file) return;
    try {
      const saved = JSON.parse(readFileSync(this.file, 'utf8'));
      if (Array.isArray(saved.tasks)) this.tasks = saved.tasks;
    } catch {
      /* first run, or unreadable: start empty */
    }
  }

  #save() {
    if (!this.file || this.saveTimer) return;
    this.saveTimer = setTimeout(() => this.flush(), 50);
    this.saveTimer.unref?.();
  }

  flush() {
    clearTimeout(this.saveTimer);
    this.saveTimer = null;
    if (!this.file) return;
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      writeFileSync(tmp, JSON.stringify({ tasks: this.tasks }), { mode: 0o600 });
      renameSync(tmp, this.file);
    } catch (err) {
      console.error('could not save tasks:', err.message);
    }
  }

  #wake(set) {
    for (const fn of [...set]) fn();
  }

  #end(task, status, { result = '', error = '' } = {}) {
    task.status = status;
    task.finishedAt = this.now();
    task.result = String(result).slice(0, MAX_RESULT);
    task.error = String(error).slice(0, 4000);
    this.#save();
    const waiting = this.finishers.get(task.id);
    if (waiting) this.#wake(waiting);
  }

  enqueue({ instruction, target = 'claude_code', cwd = '' }) {
    this.sweep();
    if (typeof instruction !== 'string' || !instruction.trim())
      throw new BridgeError('bad_input', 'instruction must be a non-empty string');
    if (instruction.length > MAX_INSTRUCTION)
      throw new BridgeError('bad_input', `instruction is longer than ${MAX_INSTRUCTION} characters`);
    if (typeof target !== 'string' || !/^[a-z0-9_-]{1,40}$/.test(target))
      throw new BridgeError('bad_input', 'target must be lowercase letters, digits, - or _');
    if (typeof cwd !== 'string' || cwd.length > 500)
      throw new BridgeError('bad_input', 'cwd must be a short string');
    if (this.tasks.filter((t) => t.status === 'queued').length >= this.maxQueued)
      throw new BridgeError('queue_full', `${this.maxQueued} tasks are already waiting; cancel some or start the home agent`);
    const task = {
      id: `t_${randomBytes(5).toString('hex')}`,
      target,
      cwd: cwd.trim(),
      instruction,
      status: 'queued',
      createdAt: this.now(),
      startedAt: 0,
      finishedAt: 0,
      lastBeat: 0,
      cancelRequested: false,
      result: '',
      error: '',
    };
    this.tasks.push(task);
    if (this.tasks.length > this.maxTasks) {
      const drop = this.tasks.findIndex((t) => FINAL.has(t.status));
      if (drop >= 0) this.tasks.splice(drop, 1);
    }
    this.#save();
    this.#wake(this.claimers);
    return task;
  }

  sweep() {
    const t = this.now();
    for (const task of this.tasks) {
      if (task.status === 'queued' && t - task.createdAt > this.ttlMs)
        this.#end(task, 'expired', { error: 'The home computer did not pick this up in time, so it was dropped rather than run late.' });
      else if (task.status === 'running' && t - task.lastBeat > this.staleMs)
        this.#end(task, 'failed', { error: 'The home agent stopped responding while running this task.' });
    }
  }

  #seen(info) {
    this.agent.lastSeen = this.now();
    if (info && typeof info === 'object') this.agent.info = info;
  }

  #takeNext() {
    this.sweep();
    const task = this.tasks.find((t) => t.status === 'queued');
    if (!task) return null;
    task.status = 'running';
    task.startedAt = task.lastBeat = this.now();
    this.#save();
    return task;
  }

  /** The home agent asks for work; holds up to waitMs. Resolves null if none. */
  async claim(waitMs, info, signal) {
    this.#seen(info);
    const first = this.#takeNext();
    if (first || waitMs <= 0) return first;
    await new Promise((resolve) => {
      const wake = () => {
        clearTimeout(timer);
        this.claimers.delete(wake);
        signal?.removeEventListener('abort', wake);
        resolve();
      };
      const timer = setTimeout(wake, waitMs);
      this.claimers.add(wake);
      signal?.addEventListener('abort', wake);
    });
    if (signal?.aborted) return null;
    this.#seen(info);
    return this.#takeNext();
  }

  /** A claimed task that never reached the agent goes back in the queue. */
  release(id) {
    const task = this.tasks.find((t) => t.id === id);
    if (task && task.status === 'running') {
      task.status = 'queued';
      task.startedAt = task.lastBeat = 0;
      this.#save();
      this.#wake(this.claimers);
    }
  }

  heartbeat(id) {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) return null;
    this.#seen();
    if (task.status === 'running') task.lastBeat = this.now();
    return { cancel: task.cancelRequested || task.status === 'cancelled' };
  }

  finish(id, { status, result, error }) {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) return false;
    if (task.status !== 'running') return false; // cancelled / expired meanwhile: first ending wins
    this.#seen();
    this.#end(task, ['done', 'failed', 'rejected', 'cancelled'].includes(status) ? status : 'failed', { result, error });
    return true;
  }

  cancel(id) {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) return null;
    if (task.status === 'queued') this.#end(task, 'cancelled', { error: 'Cancelled before it started.' });
    else if (task.status === 'running') {
      task.cancelRequested = true;
      this.#end(task, 'cancelled', { error: 'Cancelled while running; the home agent will stop it at its next check-in.' });
    }
    return task;
  }

  get(id) {
    this.sweep();
    return this.tasks.find((t) => t.id === id) || null;
  }

  list(limit = 10) {
    this.sweep();
    return this.tasks.slice(-limit).reverse();
  }

  waitFor(id, ms) {
    const task = this.get(id);
    if (!task || FINAL.has(task.status) || ms <= 0) return Promise.resolve(task);
    return new Promise((resolve) => {
      const set = this.finishers.get(id) ?? new Set();
      this.finishers.set(id, set);
      const done = () => {
        clearTimeout(timer);
        set.delete(done);
        if (!set.size) this.finishers.delete(id);
        resolve(this.get(id));
      };
      const timer = setTimeout(done, ms);
      set.add(done);
    });
  }

  agentStatus() {
    const ageMs = this.agent.lastSeen ? this.now() - this.agent.lastSeen : null;
    return { online: ageMs !== null && ageMs < 60_000, ageMs, info: this.agent.info };
  }
}
