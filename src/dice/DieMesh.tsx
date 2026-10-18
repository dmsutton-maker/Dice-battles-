import React, { forwardRef, useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { DIE_FACE_COLORS } from '../game/colors';
import { TUNING } from '../game/tuning';
import {
  createDieFaceTextures,
  PatternId,
  STICKER_FRACTION,
} from './patterns';
import { COLOR_SYMBOLS } from '../game/colorblind';
import {
  BEVEL_FRACTION,
  dieShadeTexture,
  SHADE_INTENSITY,
  stickerTexture,
} from './dieShading';

/*
  One body geometry and one sticker geometry, shared by every die and built
  on first use. The sizes come only from TUNING (a const), so every die
  would build the same shape anyway. Building one per die per battle leaked
  about 190 KB: three keeps a GPU buffer and vertex-array object for each
  geometry it has seen. These are never disposed, because there is only
  ever one of each.
*/
let sharedBodyGeometry: RoundedBoxGeometry | null = null;
let sharedStickerGeometry: THREE.CircleGeometry | null = null;

function getBodyGeometry(): RoundedBoxGeometry {
  if (!sharedBodyGeometry) {
    const size = TUNING.dieSize;
    sharedBodyGeometry = new RoundedBoxGeometry(size, size, size, 4, size * BEVEL_FRACTION);
  }
  return sharedBodyGeometry;
}

function getStickerGeometry(): THREE.CircleGeometry {
  if (!sharedStickerGeometry) {
    const size = TUNING.dieSize;
    sharedStickerGeometry = new THREE.CircleGeometry(size * STICKER_FRACTION, 24);
  }
  return sharedStickerGeometry;
}

/**
 * Visual die: an ivory rounded cube with a colored circular sticker inset on
 * each face — reads like a real color die mid-tumble and on settle.
 *
 * Sticker order MUST match FACE_NORMALS in die.ts (+x, -x, +y, -y, +z, -z)
 * so top-face detection reports the right color.
 */
const STICKER_TRANSFORMS: {
  position: [number, number, number];
  rotation: [number, number, number];
}[] = [
  { position: [1, 0, 0], rotation: [0, Math.PI / 2, 0] },
  { position: [-1, 0, 0], rotation: [0, -Math.PI / 2, 0] },
  { position: [0, 1, 0], rotation: [-Math.PI / 2, 0, 0] },
  { position: [0, -1, 0], rotation: [Math.PI / 2, 0, 0] },
  { position: [0, 0, 1], rotation: [0, 0, 0] },
  { position: [0, 0, -1], rotation: [0, Math.PI, 0] },
];

export const DieMesh = forwardRef<
  THREE.Group,
  {
    bodyColor?: string;
    pattern?: PatternId;
    patternInk?: string;
    /** Colourblind mode: stamp a distinct shape on each face sticker. */
    symbols?: boolean;
  }
>(function DieMesh(
  { bodyColor = '#ffffff', pattern = 'plain', patternInk, symbols = false },
  ref,
) {
  const size = TUNING.dieSize;
  const half = size / 2 + 0.004; // stickers float a hair above the surface

  const bodyGeometry = getBodyGeometry();
  // Fully unlit body, like the stickers: after repeated on-device reports of
  // one die rendering beige while the other stayed white under identical
  // materials, the dice no longer participate in lighting or tone mapping at
  // all. Every pixel is a constant color, so both dice are identical by
  // construction. Depth comes from the silhouette, the blob shadow, and
  // — since 18 Oct 2026 — light PAINTED into a shade map (dieShading.ts):
  // darker toward the rounded edges, a glint on the bevel, a shadow round
  // each sticker. It goes in as a lightMap, which MeshBasicMaterial
  // multiplies in without consulting a single light, so every die on
  // every phone still gets exactly the same numbers.
  // The shell colour and pattern are the equipped dice skin
  // (src/game/diceSkins.ts). Skins never touch the sticker colours, which
  // are the game signal.
  const bodyMaterial = useMemo(() => {
    /*
      PLAIN is the only skin without a picture.

      `!patternInk` used to stand in for that, and it was wrong the moment
      a skin arrived that mixes its own paint: a colour painter takes no
      ink, so Copper, Ruby, Ocean and Slate all fell through to a flat
      body colour and rendered as plain brown, plain maroon, plain teal
      and plain grey — in the preview and on the table. David reported it
      as "the copper skin doesn't show when previewing it, it's just
      brown", and it was four skins, not one.

      The same mistake was made and fixed in preview.ts a version
      earlier. Fixing it in one of the two places is how it survived.
    */
    // Shared by every die: it depends only on the shape. Never disposed.
    const shade = {
      lightMap: dieShadeTexture(),
      lightMapIntensity: SHADE_INTENSITY,
      toneMapped: false,
    };
    if (pattern === 'plain') {
      return new THREE.MeshBasicMaterial({ color: bodyColor, ...shade });
    }
    /*
      SIX materials, not one, since 10 Sep 2026.

      A single texture handed to the whole box put the same picture on
      every side, so a zebra die was the same stripes six times and read
      as wallpaper rather than an object. Each side now takes its own
      square of one continuous design — see CUBE_NET_CELLS — so the
      pattern runs around the die instead of restarting at every corner.

      An array of materials on a BoxGeometry is matched to its groups in
      three.js's own face order, which is the order CUBE_NET_CELLS is
      written in. Do not reorder one without the other.
    */
    return createDieFaceTextures(pattern, bodyColor, patternInk ?? bodyColor).map(
      // A colour painter ignores the ink; a mask painter cannot do
      // without one.
      (map) => new THREE.MeshBasicMaterial({ map, ...shade }),
    );
  }, [bodyColor, pattern, patternInk]);
  // Unlit stickers with toneMapped:false — the face color IS the game
  // signal, so it must render as the exact palette hex from every angle and
  // must bypass the scene's tone mapping curve. This lets the rest of the
  // scene keep filmic tone mapping (which makes the white bodies pop)
  // without it muting or hue-shifting the sticker colors.
  //
  // Textured since 18 Oct 2026: a thin darker rim and a soft highlight arc
  // at the very edge, so the sticker reads as set into the die. The
  // middle of the sticker is still the exact hex; only the rim is shaded
  // (see stickerTexture). Colourblind mode is the same sticker with the
  // shape stamped on. Both are cached app-wide: twelve textures at most,
  // shared by every die and never disposed.
  const stickerMaterials = useMemo(
    () =>
      DIE_FACE_COLORS.map(
        (c) =>
          new THREE.MeshBasicMaterial({
            map: stickerTexture(c.hex, symbols ? COLOR_SYMBOLS[c.id] : null),
            toneMapped: false,
          }),
      ),
    [symbols],
  );
  /*
    STICKER_FRACTION, not a literal 0.33: patterns.ts uses the same number
    to keep each skin's design OUT of the middle of a face, and the test
    suite measures the circle it describes. Three copies of one number is
    how the design creeps back in — David, 26 Aug 2026: "a lot of the dice
    are messed up because the design is in the center, which doesn't make
    sense because the colors are in the center."
  */
  const stickerGeometry = getStickerGeometry();

  return (
    <group ref={ref}>
      <mesh geometry={bodyGeometry} material={bodyMaterial} />
      {STICKER_TRANSFORMS.map((t, i) => (
        <mesh
          key={i}
          geometry={stickerGeometry}
          material={stickerMaterials[i]}
          position={[t.position[0] * half, t.position[1] * half, t.position[2] * half]}
          rotation={t.rotation}
        />
      ))}
    </group>
  );
});
