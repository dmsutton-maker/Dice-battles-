/**
 * The player's progress backup: the rules, apart from the database.
 *
 * Marc, 5 Nov 2026: "When I delete the game and redownload it, it
 * completely resets my account, friends, friend code, trophies, coins,
 * and everything." The game keeps a snapshot of its progress here
 * (src/game/cloudSave.ts), under the device's player id and proved by
 * its secret, and reads it back after a reinstall.
 *
 * Pure, so the tests can drive it; ../app/api/players/save/route.ts is
 * the handler.
 */

/**
 * The most a snapshot may be, in bytes of JSON. The game's own copy of
 * this number is SNAPSHOT_MAX_BYTES in src/game/cloudSave.ts, and the
 * tests hold the two equal. A real snapshot is a few kilobytes; a
 * modified client could otherwise fill a jsonb column with anything.
 */
export const SAVE_MAX_BYTES = 64 * 1024;

export type SnapshotCheck =
  | { ok: true; json: string; bytes: number }
  | { ok: false; error: string; status: number };

/**
 * Whether a body's `snapshot` may be stored: an object (not an array,
 * not a string) with a numeric `v` and `savedAt`, within the cap.
 * Nothing inside it is read here — the game is the only reader, and it
 * validates every field as it would a save of its own (restoreProgress
 * and friends) — but the shape and the size are the server's to refuse.
 */
export function checkSnapshot(snapshot: unknown): SnapshotCheck {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return { ok: false, error: 'snapshot must be an object', status: 400 };
  }
  const s = snapshot as Record<string, unknown>;
  if (typeof s.v !== 'number' || typeof s.savedAt !== 'number') {
    return { ok: false, error: 'snapshot needs v and savedAt', status: 400 };
  }
  const json = JSON.stringify(snapshot);
  const bytes = Buffer.byteLength(json, 'utf8');
  if (bytes > SAVE_MAX_BYTES) {
    return { ok: false, error: 'snapshot is too big', status: 413 };
  }
  return { ok: true, json, bytes };
}

/** The game version string the game sends, kept short and plain. */
export function cleanGameVersion(value: unknown): string {
  return typeof value === 'string' ? value.replace(/[^\w.+-]/g, '').slice(0, 32) : '';
}

/** The two things this route does. Anything else is a bad request. */
export const SAVE_ACTIONS = ['save', 'load'] as const;
export type SaveAction = (typeof SAVE_ACTIONS)[number];

export function isSaveAction(value: unknown): value is SaveAction {
  return typeof value === 'string' && (SAVE_ACTIONS as readonly string[]).includes(value);
}
