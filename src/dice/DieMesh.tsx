import React, { forwardRef, useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { DIE_FACE_COLORS } from '../game/colors';
import { TUNING } from '../game/tuning';

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

export const DieMesh = forwardRef<THREE.Group>(function DieMesh(_props, ref) {
  const size = TUNING.dieSize;
  const half = size / 2 + 0.004; // stickers float a hair above the surface

  const bodyGeometry = useMemo(
    () => new RoundedBoxGeometry(size, size, size, 4, size * 0.12),
    [size],
  );
  const bodyMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#f6f1e6',
        roughness: 0.35,
        metalness: 0.02,
      }),
    [],
  );
  // Unlit stickers: the face color IS the game signal, so it must render as
  // the exact palette hex from every angle. Lit materials hue-shift with the
  // scene lighting (sky-tinted from above, warm from the side), which made
  // purple read as green/blue on some faces.
  const stickerMaterials = useMemo(
    () => DIE_FACE_COLORS.map((c) => new THREE.MeshBasicMaterial({ color: c.hex })),
    [],
  );
  const stickerGeometry = useMemo(
    () => new THREE.CircleGeometry(size * 0.33, 24),
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
