/**
 * "Something the backup keeps has just been written."
 *
 * Every module that persists a piece of the player's progress (progress,
 * the wallet, the loadout, the three settings) says so here after its
 * own write, and cloudSave.ts listens, so one debounced upload follows
 * a battle, a purchase or a slider rather than six. A separate module
 * rather than a call into cloudSave.ts because cloudSave reads all of
 * those modules, and a cycle is not worth saving a file.
 *
 * Nothing here can throw: a listener that fails is dropped on the floor
 * so the write that caused it still lands.
 */

type Listener = () => void;
const listeners = new Set<Listener>();

export function noteSaveChanged(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // A broken listener must not stop a save being written.
    }
  }
}

export function onSaveChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
