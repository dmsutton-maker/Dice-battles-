import * as THREE from 'three';
import { cachedTexture } from '../arena/textureCache';
import { DIE_FACE_COLORS, inkOn } from '../game/colors';
import { SymbolId } from '../game/colorblind';
import { symbolCovers } from './symbols';
import { STICKER_FRACTION } from './patterns';

/**
 * Form for a die that is lit by nobody.
 *
 * The dice are drawn UNLIT on purpose (see DieMesh: two dice under the
 * same lights rendered as two different whites on device, again and
 * again). The price was that a die became a flat silhouette: the top and
 * the side of an ivory die are the same ivory, so the edge between them
 * disappears and the cube reads as a hexagon of cream with circles on it.
 *
 * So the light is PAINTED, once, into two small textures, and every die
 * on every phone samples the same numbers. Nothing here looks at the
 * scene's lights, the tone mapping or the time of day, which is what
 * keeps the beige-die fault fixed.
 *
 *   - The SHADE map darkens each face toward its rounded edges and its
 *     corners, gives the flat of the face a gentle pillow, and puts a
 *     narrow glint where the flat turns into the bevel — the line a real
 *     polished die catches. It also lays a soft shadow round the sticker,
 *     the way a recess darkens at its rim.
 *   - The STICKER map is the face colour with a thin darker ring at its
 *     edge and a soft highlight arc just inside it, so each colour reads
 *     as set INTO the die rather than painted on top.
 *
 * The middle of every sticker is the exact palette hex, untouched: the
 * colour is the game, and only the rim is shaded.
 */

/**
 * The die's rounded-edge radius, as a share of its width.
 *
 * Here rather than in TUNING: it is a drawing constant, not a dice-feel
 * one — the physics body is a plain box either way. DieMesh builds its
 * geometry from this, and the shade map works out where the bevel falls
 * in texture space from the same number, so the two cannot disagree.
 */
export const BEVEL_FRACTION = 0.12;

/**
 * How much of a face's texture, from each edge, is the bevel.
 *
 * RoundedBoxGeometry shares each face's 0..1 UVs out by ARC LENGTH: half
 * of each rounded edge, then the flat, then the other half. Worked out
 * from the geometry's own rule so a change of bevel moves the shading
 * with it.
 */
const ARC = (Math.PI * BEVEL_FRACTION) / 2; // a whole quarter-round
const FACE_LENGTH = 1 - 2 * BEVEL_FRACTION + ARC;
export const BEVEL_UV = ARC / 2 / FACE_LENGTH;
/** The sticker's radius in the same UV units. */
const STICKER_UV = STICKER_FRACTION / FACE_LENGTH;

const SHADE_SIZE = 128;

/**
 * The shade is stored over this range and lightMapIntensity scales it
 * back, so a texel can BRIGHTEN as well as darken — the glint on the
 * bevel needs a little over 1.
 */
const SHADE_RANGE = 1.25;

/*
  The look, in display brightness (1 = the skin exactly as painted).
  Converted to linear only at the end, because that is the space three
  multiplies in, and a number tuned by eye is tuned in display space.
*/
/** How dark the very crest of an edge goes. */
const EDGE_DARK = 0.24;
/** How far the flat of a face falls off from its centre to its edge. */
const PILLOW = 0.05;
/** The glint where flat becomes bevel. */
const GLINT = 0.08;
/** The shadow round the sticker. */
const RECESS = 0.14;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Display brightness of the shell at one point of a face's UV square. */
export function shadeAt(u: number, v: number): number {
  // How far round each bevel this point is: 0 on the flat, 45 degrees at
  // the crest where this face meets its neighbour.
  const tiltU = (1 - Math.min(1, Math.min(u, 1 - u) / BEVEL_UV)) * 45;
  const tiltV = (1 - Math.min(1, Math.min(v, 1 - v) / BEVEL_UV)) * 45;
  // Both at once in a corner, which is where three faces meet and the
  // surface turns furthest from the eye.
  const tilt = Math.hypot(tiltU, tiltV);
  const edge = 1 - EDGE_DARK * Math.min(1.35, Math.pow(tilt / 45, 1.6));

  const flatHalf = 0.5 - BEVEL_UV;
  const fromCentre = Math.min(1, Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5)) / flatHalf);
  const pillow = 1 - PILLOW * fromCentre * fromCentre;

  const glint = GLINT * Math.exp(-Math.pow((tilt - 13) / 6, 2));

  const d = Math.hypot(u - 0.5, v - 0.5);
  // A ring only: under the sticker nothing shows, and the middle of a
  // face is the reference brightness everything else is measured from.
  const recess =
    RECESS *
    smooth(STICKER_UV - 0.03, STICKER_UV - 0.01, d) *
    (1 - smooth(STICKER_UV - 0.01, STICKER_UV + 0.06, d));

  return pillow * edge * (1 - recess) + glint;
}

/**
 * The shade map, shared by every die's body.
 *
 * One texture for the whole game: it depends only on the shape, which
 * is the same for every die. It goes in as a LIGHT map, which
 * MeshBasicMaterial multiplies into its colour without ever consulting
 * a light — see DieMesh.
 */
export function dieShadeTexture(): THREE.DataTexture {
  return cachedTexture(`die-shade:${BEVEL_FRACTION}:${STICKER_FRACTION}`, () => {
    const data = new Uint8Array(SHADE_SIZE * SHADE_SIZE * 4);
    for (let y = 0; y < SHADE_SIZE; y++) {
      for (let x = 0; x < SHADE_SIZE; x++) {
        const display = shadeAt((x + 0.5) / SHADE_SIZE, (y + 0.5) / SHADE_SIZE);
        const linear = Math.pow(Math.max(0, display), 2.2);
        const byte = Math.round(Math.min(1, linear / SHADE_RANGE) * 255);
        const i = (y * SHADE_SIZE + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = byte;
        data[i + 3] = 255;
      }
    }
    return dataTexture(data, SHADE_SIZE, THREE.NoColorSpace);
  }) as THREE.DataTexture;
}

/** What to set lightMapIntensity to, so a texel of 1 means SHADE_RANGE. */
// three divides a light map by pi in MeshBasicMaterial's shader.
export const SHADE_INTENSITY = SHADE_RANGE * Math.PI;

const STICKER_SIZE = 128;
/** Where the darker rim starts, as a share of the sticker's radius. */
const RIM = 0.9;
/**
 * Supersampling per axis, for texels on the edge of a colourblind shape.
 *
 * Only those: the rim and the highlight are ramps already, and every
 * other texel is one flat colour. Supersampling all of them cost 90ms for
 * six stickers on a desktop, landing on the first roll; this costs a
 * tenth of that and draws the same picture.
 */
const AA = 3;
/** The highlight's tint. A warm white, not a pure one. */
const GLOW: readonly [number, number, number] = [255, 250, 238];

const parseHex = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** One sample of the sticker, in symbol space (-1..1, +y up). */
function stickerAt(
  x: number,
  y: number,
  face: readonly number[],
  ink: readonly number[],
  symbol: SymbolId | null,
): [number, number, number] {
  const r = Math.hypot(x, y);
  const c = symbol !== null && symbolCovers(symbol, x, y) ? ink : face;
  if (r < 0.7) return [c[0], c[1], c[2]];

  // The rim: the face colour, darker, and darker still at the very edge,
  // like the wall of a shallow well seen from above.
  const rim = smooth(RIM - 0.02, RIM + 0.02, r);
  const depth = 0.7 - 0.1 * smooth(RIM, 1, r);
  // The highlight: an arc on one side only, just inside the rim. A whole
  // ring would read as a halo; light comes from somewhere.
  const lightDir = (x * -0.7071 + y * 0.7071) / Math.max(r, 1e-6);
  const arc =
    smooth(0.72, 0.8, r) * (1 - smooth(0.83, RIM - 0.01, r)) * smooth(0.35, 0.9, lightDir) * 0.32;
  const out: [number, number, number] = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    const lit = c[k] + (GLOW[k] - c[k]) * arc;
    out[k] = lit + (c[k] * depth - lit) * rim;
  }
  return out;
}

/**
 * One face sticker: the palette colour, set into the die.
 *
 * `symbol` adds the colourblind shape, drawn by the same masks as the
 * flat symbol stickers (src/dice/symbols.ts) and with the same choice of
 * ink, so the shape for Red is the shape for Red everywhere.
 *
 * Twelve possible keys (six colours, with and without a shape), so the
 * cache stays bounded.
 */
export function stickerTexture(hex: string, symbol: SymbolId | null): THREE.DataTexture {
  return cachedTexture(`die-sticker:${hex}:${symbol ?? 'none'}`, () => {
    const face = parseHex(hex);
    const ink = parseHex(inkOn(hex));
    const data = new Uint8Array(STICKER_SIZE * STICKER_SIZE * 4);
    for (let py = 0; py < STICKER_SIZE; py++) {
      for (let px = 0; px < STICKER_SIZE; px++) {
        // -ny throughout: the same flip createSymbolTexture makes, so a
        // shape stands the same way up on both kinds of sticker.
        const at = (fx: number, fy: number) =>
          stickerAt(
            ((px + fx) / STICKER_SIZE) * 2 - 1,
            -(((py + fy) / STICKER_SIZE) * 2 - 1),
            face,
            ink,
            symbol,
          );
        // Does a shape's edge cross this texel? Its four corners disagree.
        const covers = (fx: number, fy: number) =>
          symbol !== null &&
          symbolCovers(
            symbol,
            ((px + fx) / STICKER_SIZE) * 2 - 1,
            -(((py + fy) / STICKER_SIZE) * 2 - 1),
          );
        const c0 = covers(0, 0);
        const onEdge = c0 !== covers(1, 0) || c0 !== covers(0, 1) || c0 !== covers(1, 1);
        let r = 0;
        let g = 0;
        let b = 0;
        const n = onEdge ? AA * AA : 1;
        if (!onEdge) {
          [r, g, b] = at(0.5, 0.5);
        } else {
          for (let sy = 0; sy < AA; sy++) {
            for (let sx = 0; sx < AA; sx++) {
              const c = at((sx + 0.5) / AA, (sy + 0.5) / AA);
              r += c[0];
              g += c[1];
              b += c[2];
            }
          }
        }
        const i = (py * STICKER_SIZE + px) * 4;
        data[i] = Math.round(r / n);
        data[i + 1] = Math.round(g / n);
        data[i + 2] = Math.round(b / n);
        data[i + 3] = 255;
      }
    }
    return dataTexture(data, STICKER_SIZE, THREE.SRGBColorSpace);
  }) as THREE.DataTexture;
}

/**
 * Build the shade map and the six plain stickers ahead of the first roll.
 *
 * Together about 20ms on a desktop and several times that on a phone —
 * small, but a stall in the frame the dice first appear in is what the
 * warm-up exists to prevent. The colourblind stickers are left to be
 * built when that setting is on.
 */
export function warmDieShading(): void {
  dieShadeTexture();
  for (const c of DIE_FACE_COLORS) stickerTexture(c.hex, null);
}

function dataTexture(
  data: Uint8Array,
  size: number,
  colorSpace: THREE.ColorSpace,
): THREE.DataTexture {
  const texture = new THREE.DataTexture(data, size, size);
  texture.colorSpace = colorSpace;
  // Clamped: each is shown exactly once per face or sticker, never tiled.
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
