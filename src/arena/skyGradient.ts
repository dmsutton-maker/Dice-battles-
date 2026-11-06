import * as THREE from 'three';

/**
 * A vertical gradient for a sky dome.
 *
 * React Native has no canvas, so the pixels are written by hand — the same
 * approach as the flagstone floor. It is 4 pixels wide and 64 tall: the
 * gradient only varies up the frame, and the horizontal axis is there
 * because a 1px-wide texture wraps badly on some drivers.
 *
 * `stops` run from the HORIZON (index 0) to the ZENITH (last), which is the
 * order a sky is described in rather than the order the pixels are written.
 */
export function createSkyGradient(stops: string[]): THREE.DataTexture {
  const W = 4;
  const H = 64;
  const data = new Uint8Array(W * H * 4);
  const colors = stops.map((hex) => new THREE.Color(hex));

  for (let y = 0; y < H; y++) {
    // DataTexture does NOT flip vertically the way a loaded image does, so
    // row 0 is v=0 — the BOTTOM of the dome, which is the horizon end.
    // Writing the stops in the same direction keeps them horizon-first.
    const t = y / (H - 1);
    const scaled = t * (colors.length - 1);
    const i0 = Math.min(colors.length - 1, Math.floor(scaled));
    const i1 = Math.min(colors.length - 1, i0 + 1);
    // Blend in LINEAR light — three.js keeps Color in linear working space,
    // and that is the only space where a halfway mix looks halfway rather
    // than muddy. Then encode to sRGB, because that is what the texture
    // below declares itself to be; writing the linear numbers straight in
    // makes the GPU decode them a second time and the whole sky comes out
    // far too dark.
    const blended = colors[i0]
      .clone()
      .lerp(colors[i1], scaled - i0)
      .convertLinearToSRGB();

    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      data[i] = Math.round(blended.r * 255);
      data[i + 1] = Math.round(blended.g * 255);
      data[i + 2] = Math.round(blended.b * 255);
      data[i + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, W, H);
  texture.colorSpace = THREE.SRGBColorSpace;
  // Stated rather than assumed: the row order above depends on it.
  texture.flipY = false;
  texture.needsUpdate = true;
  return texture;
}
