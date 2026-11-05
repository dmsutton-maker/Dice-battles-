import { GLView } from 'expo-gl';
import { Image } from 'react-native';
import * as THREE from 'three';
import type { WebGLRenderer } from 'three';
import { THEME } from '../ui/theme';
import { BoardShot, contextOf, snapshotUri } from './boardShot';
import { loadShareArt } from './shareArt';
import { SHARE_ART_SIZES } from './shareArtManifest';
import { CARD, DrawItem, hexTint, layoutCard, ShareResult } from './shareCard';
import { keepOnly } from './tempFiles';

/**
 * The finished card, as a PNG file — made ON DEMAND, when the player
 * taps "Share your win", never on its own.
 *
 * HOW. React Native cannot draw a picture into a file without a native
 * view-capture package, and this game adds no packages for this. What
 * it does have is the board's GL context, and expo-gl, which can load an
 * image file straight into a texture (`{ localUri }`, decoded natively)
 * and write any framebuffer out as a PNG (`takeSnapshotAsync` with
 * `framebuffer`). So the card is drawn as a dozen textured rectangles —
 * the board picture, the banner, the paper, the words (shareCard.ts) —
 * into a 1080 x 1350 render target, and expo-gl writes the file.
 *
 * DRAWN BY THREE, since v1.167.0. The first version drew the same list
 * with a shader and raw GL calls of its own. In a browser that card is
 * perfect; on Marc's iPhone (5 Nov 2026, "Share your win screen is
 * blank") the paper colour was cleared and not one rectangle appeared.
 * Raw GL on the board's context means agreeing with three about every
 * piece of state it left behind, on a GL driver nobody here can watch.
 * three draws every battle on that phone correctly, and the way it
 * loads a picture file here is the way fiber's own TextureLoader does on
 * native (`{ data: { localUri }, width, height }`, `isDataTexture`), so
 * the card now goes through it: an orthographic scene, a plane per
 * picture, one render into a render target. Nothing of the GL state is
 * ours to get wrong.
 *
 * Colour: the textures are uploaded raw (`NoColorSpace`), drawn unlit
 * and un-tone-mapped into a linear render target, so the pixels in the
 * file are the pixels in the pictures, as before.
 *
 * Nothing here throws. Null means "couldn't make the picture", and the
 * sheet says so.
 */

/** One picture the card draws from: what three uploads, and its size in pixels. */
export interface CardPicture {
  source: unknown;
  width: number;
  height: number;
}

/**
 * The card drawn into a render target of its own, ready to read. The
 * caller reads it and then calls `dispose`, which frees everything
 * this made (the textures, the planes, the target).
 *
 * Exported for the browser check (tools/die-preview), which feeds it
 * HTML images instead of files; the drawing is the same code.
 */
export function drawCard(
  renderer: WebGLRenderer,
  items: readonly DrawItem[],
  pictures: Record<string, CardPicture>,
): { target: THREE.WebGLRenderTarget; dispose(): void } {
  const { width, height } = CARD;
  const owned: { dispose(): void }[] = [];
  const target = new THREE.WebGLRenderTarget(width, height, {
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    colorSpace: THREE.NoColorSpace,
  });
  owned.push(target);

  const scene = new THREE.Scene();
  const [r, g, b] = hexTint(THEME.ground);
  scene.background = new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace);
  // Card pixels, y down: (0, 0) is the top-left corner of the card.
  const camera = new THREE.OrthographicCamera(0, width, 0, -height, -10, 10);

  const textures = new Map<string, THREE.Texture>();
  const textureFor = (art: string): THREE.Texture | null => {
    const found = textures.get(art);
    if (found) return found;
    const picture = pictures[art];
    if (!picture) return null;
    const texture = new THREE.Texture();
    /*
      fiber's native TextureLoader's shape: the upload is a data
      upload whose "data" is an object expo-gl decodes from the file.
      In the browser check `source` is an image element instead, which
      WebGL2 takes in the same slot.
    */
    texture.image = { data: picture.source, width: picture.width, height: picture.height };
    (texture as unknown as { isDataTexture: boolean }).isDataTexture = true;
    // Row 0 of the file is v = 0, which is what shareCard.ts's uv rects mean.
    texture.flipY = false;
    texture.colorSpace = THREE.NoColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    textures.set(art, texture);
    owned.push(texture);
    return texture;
  };

  items.forEach((item, order) => {
    const map = textureFor(item.art);
    if (!map) return;
    const geometry = new THREE.PlaneGeometry(1, 1);
    // PlaneGeometry's corners: top-left, top-right, bottom-left, bottom-right.
    const [u0, v0, u1, v1] = item.uv;
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute([u0, v0, u1, v0, u0, v1, u1, v1], 2));
    const material = new THREE.MeshBasicMaterial({
      map,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    material.color.setRGB(item.tint[0], item.tint[1], item.tint[2], THREE.LinearSRGBColorSpace);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(item.x + item.w / 2, -(item.y + item.h / 2), 0);
    mesh.scale.set(item.w, item.h, 1);
    // Painted in list order, the order shareCard.ts lays them out in.
    mesh.renderOrder = order;
    mesh.frustumCulled = false;
    scene.add(mesh);
    owned.push(geometry, material);
  });

  const before = renderer.getRenderTarget();
  try {
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
  } finally {
    renderer.setRenderTarget(before);
  }

  return {
    target,
    dispose() {
      for (const thing of owned) {
        try {
          thing.dispose();
        } catch {
          // Freed with the context already.
        }
      }
    },
  };
}

/** A picture file's size in pixels, from the file itself; `fallback` if it cannot be read. */
function sizeOfFile(uri: string, fallback: { width: number; height: number }): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    try {
      Image.getSize(
        uri,
        (width, height) => resolve(width > 0 && height > 0 ? { width, height } : fallback),
        () => resolve(fallback),
      );
    } catch {
      resolve(fallback);
    }
  });
}

/** The GL framebuffer three made for `target`, for the snapshot to read. */
function framebufferOf(renderer: WebGLRenderer, target: THREE.WebGLRenderTarget): WebGLFramebuffer | null {
  try {
    const fb = (renderer.properties.get(target) as { __webglFramebuffer?: unknown }).__webglFramebuffer;
    return fb && typeof fb === 'object' ? (fb as WebGLFramebuffer) : null;
  } catch {
    return null;
  }
}

export async function composeWinCard(
  renderer: WebGLRenderer | null,
  shot: BoardShot,
  result: ShareResult,
): Promise<string | null> {
  const gl = contextOf(renderer);
  if (!gl || !renderer) return null;
  const art = await loadShareArt();
  if (!art) return null;
  // The board's picture: its size from the file, which is what expo-gl
  // will decode, so the upload and the allocation agree.
  const board = await sizeOfFile(shot.uri, { width: shot.width, height: shot.height });
  // The Canvas can have gone (the player left) while those were read.
  if (contextOf(renderer) !== gl) return null;

  const pictures: Record<string, CardPicture> = {
    board: { source: { localUri: shot.uri }, width: board.width, height: board.height },
  };
  for (const id of Object.keys(SHARE_ART_SIZES) as (keyof typeof SHARE_ART_SIZES)[]) {
    pictures[id] = { source: { localUri: art[id] }, ...SHARE_ART_SIZES[id] };
  }

  let uri: string | null = null;
  let drawn: ReturnType<typeof drawCard> | null = null;
  try {
    drawn = drawCard(renderer, layoutCard(board, result), pictures);
    const framebuffer = framebufferOf(renderer, drawn.target);
    if (framebuffer) {
      const snap = await GLView.takeSnapshotAsync(gl, {
        framebuffer,
        rect: { x: 0, y: 0, width: CARD.width, height: CARD.height },
        format: 'png',
      });
      uri = snapshotUri(snap);
    }
  } catch {
    uri = null;
  } finally {
    drawn?.dispose();
  }
  keepOnly('card', uri);
  return uri;
}
