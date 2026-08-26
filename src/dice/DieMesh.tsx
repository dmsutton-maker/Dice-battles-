import React, { forwardRef, useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { DIE_FACE_COLORS } from '../game/colors';
import { TUNING } from '../game/tuning';
import { createPatternTexture, PatternId, STICKER_FRACTION } from './patterns';
import { createSymbolTexture } from './symbols';
import { COLOR_SYMBOLS } from '../game/colorblind';

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

  const bodyGeometry = useMemo(
    () => new RoundedBoxGeometry(size, size, size, 4, size * 0.12),
    [size],
  );
  // Fully unlit body, like the stickers: after repeated on-device reports of
  // one die rendering beige while the other stayed white under identical
  // materials, the dice no longer participate in lighting or tone mapping at
  // all. Every pixel is a constant color, so both dice are identical by
  // construction. Depth comes from the silhouette and the blob shadow.
  // The shell colour and pattern are the equipped dice skin
  // (src/game/diceSkins.ts). Skins never touch the sticker colours, which
  // are the game signal.
  const bodyMaterial = useMemo(() => {
    if (pattern === 'plain' || !patternInk) {
      return new THREE.MeshBasicMaterial({ color: bodyColor, toneMapped: false });
    }
    return new THREE.MeshBasicMaterial({
      map: createPatternTexture(pattern, bodyColor, patternInk),
      toneMapped: false,
    });
  }, [bodyColor, pattern, patternInk]);
  // Unlit stickers with toneMapped:false — the face color IS the game
  // signal, so it must render as the exact palette hex from every angle and
  // must bypass the scene's tone mapping curve. This lets the rest of the
  // scene keep filmic tone mapping (which makes the white bodies pop)
  // without it muting or hue-shifting the sticker colors.
  const stickerMaterials = useMemo(
    () =>
      DIE_FACE_COLORS.map((c) =>
        symbols
          ? new THREE.MeshBasicMaterial({
              // The colour is still the colour — the shape is stamped on
              // top of it, so nothing about the palette changes.
              map: createSymbolTexture(COLOR_SYMBOLS[c.id], c.hex),
              toneMapped: false,
            })
          : new THREE.MeshBasicMaterial({ color: c.hex, toneMapped: false }),
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
  const stickerGeometry = useMemo(
    () => new THREE.CircleGeometry(size * STICKER_FRACTION, 24),
    [size],
  );

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
