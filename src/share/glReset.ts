/**
 * Make `renderer.resetState()` safe to call on the phone, or say that it
 * cannot be.
 *
 * Marc, 5 Nov 2026, with a screenshot: "a new game started and the board
 * looks like something is wrong", and then "it happened again after i
 * restarted the game". The floor, the walls, the gatehouse, the moat and
 * both dice had gone, and the plain gravel under the courtyard showed
 * through.
 *
 * WHAT HAPPENED. three's `WebGLState.reset()` makes its GL calls first
 * (depth test off, culling off, blending off, ...), then sets the
 * scissor and viewport from `gl.canvas.width`, and only THEN clears its
 * own record of what is switched on. On the web every context has a
 * `canvas`. On the phone it does not: expo-gl's context has no `canvas`
 * and fiber's native Canvas never gives it one (it hands three a stand-in
 * as `renderer.domElement` instead). So on a phone `resetState()` threw
 * halfway: the depth test was really OFF, and three still believed it
 * was ON, so it never switched it back. From then until the app was
 * closed, everything was drawn in whatever order three sorted it, nearest
 * or not, and the lawn and the gravel, drawn later, were painted straight
 * over the floor, the walls and the dice.
 *
 * The share code (v1.166.0) is what called `resetState()`, once on every
 * win, to tell three it had borrowed the context. The same throw also
 * made the win's picture fail every time, which is why "Share your win"
 * never appeared on a phone. Reproduced in a browser by deleting the
 * context's `canvas`: the board came out exactly like Marc's screenshot.
 *
 * The fix is to give the context the canvas three expects: the same
 * stand-in fiber already gave three as `domElement`, so the size three
 * resets the viewport to is the size it already uses. If a context will
 * not take one, the answer is false, and the callers then do not touch
 * the context at all. No share picture is a fair price; a broken board
 * is not.
 *
 * Pure (no imports), so the tests can hold it to that.
 */

interface Sized {
  width: number;
  height: number;
}

function sized(value: unknown): value is Sized {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Sized).width === 'number' &&
    typeof (value as Sized).height === 'number'
  );
}

function canvasOf(gl: object): unknown {
  try {
    return (gl as { canvas?: unknown }).canvas;
  } catch {
    return undefined;
  }
}

/**
 * True when `resetState()` can run to the end on this context, giving
 * the context a canvas first if it has none. Never throws.
 *
 * `standIn` is the renderer's `domElement` (fiber's stand-in canvas);
 * when that has no size either, the drawing buffer's size is used.
 */
export function readyForReset(gl: object | null | undefined, standIn?: unknown): boolean {
  if (!gl) return false;
  if (sized(canvasOf(gl))) return true;
  const buffer = gl as { drawingBufferWidth?: unknown; drawingBufferHeight?: unknown };
  const canvas: Sized | null = sized(standIn)
    ? standIn
    : typeof buffer.drawingBufferWidth === 'number' && typeof buffer.drawingBufferHeight === 'number'
      ? { width: buffer.drawingBufferWidth, height: buffer.drawingBufferHeight }
      : null;
  if (!canvas) return false;
  try {
    Object.defineProperty(gl, 'canvas', { value: canvas, configurable: true, writable: true });
  } catch {
    try {
      (gl as { canvas?: unknown }).canvas = canvas;
    } catch {
      // A context that will take nothing: the caller leaves it alone.
    }
  }
  return sized(canvasOf(gl));
}
