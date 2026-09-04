import * as THREE from 'three';

/**
 * Procedural flagstone floor texture (no canvas API on React Native, so we
 * build the pixels by hand). Power-of-two size for mipmaps.
 */
export function createFlagstoneTexture(
  base: { r: number; g: number; b: number } = { r: 208, g: 184, b: 144 },
  groutFactor = 0.7,
): THREE.DataTexture {
  const TILES = 8;
  const PX = 16;
  const size = TILES * PX; // 128 — power of two
  const data = new Uint8Array(size * size * 4);

  // One base shade per stone tile so the floor reads as laid stones.
  const shades: number[][] = [];
  for (let ty = 0; ty < TILES; ty++) {
    shades[ty] = [];
    for (let tx = 0; tx < TILES; tx++) {
      shades[ty][tx] = 0.82 + Math.random() * 0.16;
    }
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tx = Math.floor(x / PX);
      const ty = Math.floor(y / PX);
      const inX = x % PX;
      const inY = y % PX;
      const isGrout = inX === 0 || inY === 0 || inX === PX - 1 || inY === PX - 1;

      let shade = shades[ty][tx] * (0.97 + Math.random() * 0.05);
      if (isGrout) shade *= groutFactor;

      const i = (y * size + x) * 4;
      data[i] = Math.min(255, base.r * shade);
      data[i + 1] = Math.min(255, base.g * shade);
      data[i + 2] = Math.min(255, base.b * shade);
      data[i + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, size, size);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
