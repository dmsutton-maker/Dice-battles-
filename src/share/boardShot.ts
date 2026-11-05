import { ExpoWebGLRenderingContext, GLView } from 'expo-gl';
import * as THREE from 'three';
import type { Camera, Object3D, WebGLRenderer } from 'three';
import { keepOnly } from './tempFiles';

/**
 * The board, the moment a battle is won: dice where they landed,
 * before the result screen draws over anything.
 *
 * DRAWN AGAIN, NOT COPIED, since v1.170.0. The first version copied the
 * screen: it blitted the view's multisampled framebuffer into one of its
 * own and had expo-gl write that out. On Marc's iPhone (5 Nov 2026) the
 * board in the card came out pure white, while the card's own artwork,
 * drawn the other way, was fine. What a phone keeps in the screen's
 * buffer once a frame has been shown is the driver's business, and
 * nothing here can watch it. So the scene is drawn once more, by three,
 * into a render target of our own, and the snapshot reads that.
 *
 * DRAWN EXACTLY AS THE SCREEN IS. three draws a render target in linear
 * colour with no tone mapping, which would make a darker, flatter board
 * than the one on screen. Marked `isXRRenderTarget`, the target gets the
 * screen's treatment instead: the renderer's tone mapping, and output
 * encoded to the target texture's colour space (sRGB) in the shader,
 * the very same shader programs the screen uses, so nothing is compiled
 * at the moment of the win. The storage is forced to plain `RGBA8`;
 * left to follow the sRGB colour space it would be an sRGB texture and
 * the hardware would encode the already-encoded colour a second time.
 *
 * Single-sampled: expo-gl does not implement multisampled renderbuffers
 * (`renderbufferStorageMultisample`), so the picture has no antialiasing.
 * At the phone's own resolution that is barely visible in a share card.
 *
 * Every GL call is three's, so three's record of the GL state stays
 * true; no `resetState()` is needed. (It used to be called here, and on
 * a phone it threw halfway and broke the board: see glReset.ts.)
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

/** The GL framebuffer three made for `target`, for a snapshot to read. */
export function framebufferOf(renderer: WebGLRenderer, target: THREE.WebGLRenderTarget): WebGLFramebuffer | null {
  try {
    const fb = (renderer.properties.get(target) as { __webglFramebuffer?: unknown }).__webglFramebuffer;
    return fb && typeof fb === 'object' ? (fb as WebGLFramebuffer) : null;
  } catch {
    return null;
  }
}

/* Each board's scene and camera, by its renderer, from the Canvas's onCreated. */
const views = new WeakMap<WebGLRenderer, { scene: Object3D; camera: Camera }>();

/** Remember what `renderer` draws, so a win can draw it again. */
export function rememberView(renderer: WebGLRenderer, scene: Object3D, camera: Camera): void {
  views.set(renderer, { scene, camera });
}

/**
 * The scene drawn as the screen draws it, into a render target the
 * size of the screen. Returns the target; the caller reads it and
 * disposes it. Exported for the browser check.
 */
export function drawBoard(
  renderer: WebGLRenderer,
  scene: Object3D,
  camera: Camera,
  width: number,
  height: number,
): THREE.WebGLRenderTarget {
  const target = new THREE.WebGLRenderTarget(width, height, {
    depthBuffer: true,
    stencilBuffer: false,
    generateMipmaps: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    colorSpace: THREE.SRGBColorSpace,
  });
  // Plain bytes, encoded once, by the shader (see the note at the top).
  target.texture.internalFormat = 'RGBA8';
  (target as unknown as { isXRRenderTarget: boolean }).isXRRenderTarget = true;
  const before = renderer.getRenderTarget();
  try {
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
  } finally {
    renderer.setRenderTarget(before);
  }
  return target;
}

export async function captureBoard(renderer: WebGLRenderer | null): Promise<BoardShot | null> {
  const gl = contextOf(renderer);
  if (!gl || !renderer) return null;
  const view = views.get(renderer);
  if (!view) return null;
  const width = gl.drawingBufferWidth;
  const height = gl.drawingBufferHeight;
  if (!(width > 0 && height > 0)) return null;

  let target: THREE.WebGLRenderTarget | null = null;
  let shot: BoardShot | null = null;
  try {
    target = drawBoard(renderer, view.scene, view.camera, width, height);
    const framebuffer = framebufferOf(renderer, target);
    if (framebuffer) {
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
      target?.dispose();
    } catch {
      // The context is gone; so is everything in it.
    }
  }
  keepOnly('board', shot?.uri ?? null);
  return shot;
}
