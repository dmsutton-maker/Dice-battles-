import { File } from 'expo-file-system';

/**
 * The two files a win leaves in the cache — the board picture taken at
 * the win, and the finished card if one was made — and nothing more.
 *
 * expo-gl writes every snapshot to a fresh file under Caches/GLView and
 * never removes one, and iOS clears Caches only when the phone is short
 * of space. Five hundred wins would be a quarter of a gigabyte of old
 * board pictures nobody can see. So each kind keeps ONE file: taking a
 * new one deletes the last, and leaving the result screen deletes both.
 *
 * Best effort throughout. A file that will not delete is a file iOS
 * will get to eventually; it is never a reason to stop.
 */
type Kind = 'board' | 'card';

const kept: Record<Kind, string | null> = { board: null, card: null };

function remove(uri: string | null): void {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Already gone, or not ours to delete. Either way nothing to do.
  }
}

/** Remember `uri` as the one file of its kind, deleting the one before it. */
export function keepOnly(kind: Kind, uri: string | null): void {
  if (kept[kind] && kept[kind] !== uri) remove(kept[kind]);
  kept[kind] = uri;
}

/** Delete both files. Called when the result screen is left. */
export function discardShareFiles(): void {
  remove(kept.board);
  remove(kept.card);
  kept.board = null;
  kept.card = null;
}
