import { ExpoWebGLRenderingContext, GLView } from 'expo-gl';
import type { WebGLRenderer } from 'three';
import { readyForReset } from './glReset';
import { keepOnly } from './tempFiles';

/**
 * The board, the moment a battle is won: dice where they landed,
 * before the result screen draws over anything.
 *
 * Taken from the game's own GL context — the one the r3f Canvas draws
 * into — through expo-gl's `takeSnapshotAsync`, which reads the pixels
 * and writes a JPEG natively. Nothing is composed and nothing is
 * encoded in JavaScript here; this has to be cheap, because it runs in
 * the same tick as the fanfare.
 *
 * WHY THE BLIT. The context's default framebuffer is the view's
 * MULTISAMPLED one (fiber asks expo-gl for 4x MSAA, and GLView.swift
 * hands that framebuffer back as the default). `glReadPixels` cannot
 * read a multisampled framebuffer — it is an error, and the file would
 * be noise — so the frame is first resolved into a plain framebuffer of
 * our own with `blitFramebuffer`, exactly as expo-gl itself resolves it
 * before presenting, and the snapshot reads from that. Orientation is
 * untouched by the blit, so the file comes out the way the screen looks.
 *
 * Every GL call is followed by `renderer.resetState()`, which is three's
 * way of being told that something else used its context. Without it
 * three's cached bindings would disagree with the real ones on the next
 * frame. On a phone that call THREW halfway until v1.167.0 and left the
 * depth test off for the rest of the session: see glReset.ts. Nothing
 * here touches the context unless `readyForReset` says the reset will
 * run to the end.
 *
 * Nothing here throws. A board that could not be captured is simply no
 * share button on the result screen.
 */
export interface BoardShot {
  /** A `file://` JPEG in the cache. */
  uri: string;
  width: number;
  height: number;
}

/** The expo-gl context behind a three renderer, if that is what it is. */
export function contextOf(renderer: WebGLRenderer | null): ExpoWebGLRenderingContext | null {
  if (!renderer) return null;
  try {
    const gl = renderer.getContext() as unknown as ExpoWebGLRenderingContext;
    return typeof gl?.contextId === 'number' ? gl : null;
  } catch {
    return null;
  }
}

/** The file name a snapshot came back with, as a string, or null. */
export function snapshotUri(snap: { uri: unknown; localUri: unknown }): string | null {
  if (typeof snap.uri === 'string' && snap.uri.length > 0) return snap.uri;
  if (typeof snap.localUri === 'string' && snap.localUri.length > 0) return snap.localUri;
  return null;
}

export async function captureBoard(renderer: WebGLRenderer | null): Promise<BoardShot | null> {
  const gl = contextOf(renderer);
  if (!gl || !renderer) return null;
  const width = gl.drawingBufferWidth;
  const height = gl.drawingBufferHeight;
  if (!(width > 0 && height > 0)) return null;
  // Before ANY GL call: a reset that throws breaks the board (glReset.ts).
  if (!readyForReset(gl, renderer.domElement)) return null;

  let texture: WebGLTexture | null = null;
  let framebuffer: WebGLFramebuffer | null = null;
  let shot: BoardShot | null = null;
  try {
    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;

    if (complete) {
      // Resolve the view's multisampled frame into ours. `null` is the
      // default framebuffer on expo-gl, for the read target as for any.
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, framebuffer);
      gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    renderer.resetState();

    if (complete) {
      const snap = await GLView.takeSnapshotAsync(gl, {
        framebuffer,
        rect: { x: 0, y: 0, width, height },
        format: 'jpeg',
        compress: 0.92,
      });
      const uri = snapshotUri(snap);
      if (uri) shot = { uri, width: snap.width || width, height: snap.height || height };
    }
  } catch {
    shot = null;
  } finally {
    try {
      if (framebuffer) gl.deleteFramebuffer(framebuffer);
      if (texture) gl.deleteTexture(texture);
      renderer.resetState();
    } catch {
      // The context is gone; so is everything in it.
    }
  }
  keepOnly('board', shot?.uri ?? null);
  return shot;
}
