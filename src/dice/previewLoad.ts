import { skinById } from '../game/diceSkins';
import { arenaLaunchJobs } from '../arena/warmArenas';
import type { PaintStep } from './slicedPaint';
import { equippedDieJobs } from './warmPreviews';

/**
 * Opening a preview without painting in the middle of it.
 *
 * Marc, 5 Nov 2026: "When I click on a dice or arena to view it, there is
 * about a second where the screen is the page it was on, no words at the
 * top, and just a color on the bottom inch of the screen. Make it load
 * better, or give a very brief loading thing while it loads in."
 *
 * The board draws the previewed item itself, and a die's six sides are
 * painted pixel by pixel in JavaScript the first time anything asks for
 * them (DieMesh, createDieFaceTextures) — measured 5 Nov 2026 on a
 * desktop at 0.65 s for Pizza and over 10 s for Leopard and Tiger, a
 * phone several times slower. When the background warm-up had not got
 * to that die yet, the tap paid all of it in one block in the middle of
 * drawing the preview: the menu had gone, the name had not arrived.
 *
 * So the board only ever gets an item whose pictures are already
 * painted. A cached item opens exactly as before. Anything else opens
 * the preview's own screen at once — name, button and a spinner where
 * the board goes — while previewJobs runs in slices (the screen runs
 * them with runSliced), and the board takes the item when they are done.
 */

/** What a preview opens: a die or a battlefield, by id. */
export interface PreviewItem {
  kind: 'die' | 'arena';
  id: string;
}

/**
 * The painting the board still needs before it can draw `item` without
 * painting anything itself: a die's shade, stickers and sides (the same
 * jobs the loading screen runs for the die in hand), or a battlefield's
 * floor and ground. Empty when it is all cached. Every job writes into
 * the cache the board reads, so the board then finds it there.
 */
export function previewJobs(item: PreviewItem): PaintStep[] {
  if (item.kind === 'die') return equippedDieJobs(skinById(item.id));
  return arenaLaunchJobs(item.id);
}

/** Whether the board can draw `item` right now without painting it. */
export function previewPainted(item: PreviewItem): boolean {
  return previewJobs(item).length === 0;
}

/**
 * What the board should draw, and whether the preview is still loading.
 *
 * - nothing open: the board's own item (`show` null), not loading;
 * - painted: the item at once, not loading — no loading state at all;
 * - not painted: loading, and the board keeps whatever it was showing
 *   (`onBoard`: the item of the preview before, or null for the board's
 *   own) until the item's pictures are in.
 */
export function previewScene<T extends PreviewItem>(
  target: T | null,
  painted: boolean,
  onBoard: T | null,
): { show: T | null; loading: boolean } {
  if (target === null) return { show: null, loading: false };
  if (painted) return { show: target, loading: false };
  return { show: onBoard, loading: true };
}
