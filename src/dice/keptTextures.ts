import AsyncStorage from '@react-native-async-storage/async-storage';
import * as THREE from 'three';
import { cachedTexture, hasCachedTexture, peekCachedTexture } from '../arena/textureCache';
import { GAME_VERSION } from '../game/version';

/**
 * The equipped die's pictures, kept between launches.
 *
 * David's family, 3 Nov 2026: "make sure the game is fully loaded before
 * showing the home screen" — and "it all has to be lightning fast".
 * Measured that day, the biggest single wait left on the loading screen
 * was painting the die in the player's hand: the six sides of an
 * ordinary die are a quarter of a second on a desktop, the Pizza or Fish
 * die well over a second, and a phone is several times slower — paid
 * again on every launch for a die that had not changed. So the die's six
 * sides, its stickers and its shade map are kept once painted, and read
 * back on the next launch instead (shelfStore.ts does the same for the
 * shelf pictures).
 *
 * KEYED ON THE GAME VERSION and on each picture's own cache key, which
 * already names everything it is painted from (pattern, colours, side).
 * Every update carries a new GAME_VERSION and a painter can only change
 * in an update, so nothing from an older version is ever shown. Never in
 * development. Never throws: storage that fails means painting, as before.
 */
const STORAGE_KEY = 'dice-battles/kept-textures';

interface KeptTexture {
  key: string;
  width: number;
  height: number;
  /** RGBA, base64. */
  data: string;
  colorSpace: string;
  wrapS: number;
  wrapT: number;
  magFilter: number;
  minFilter: number;
  generateMipmaps: boolean;
  flipY: boolean;
}

interface Kept {
  version: string;
  textures: KeptTexture[];
}

const inDevelopment = () => typeof __DEV__ !== 'undefined' && __DEV__;

/** The keys taken back this launch, so an unchanged set is not written again. */
const taken = new Set<string>();

/** Put back every kept texture of this version. Resolves with how many. */
export async function loadKeptTextures(): Promise<number> {
  if (inDevelopment()) return 0;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const kept = JSON.parse(raw) as Kept;
    if (!kept || kept.version !== GAME_VERSION || !Array.isArray(kept.textures)) return 0;
    let count = 0;
    for (const t of kept.textures) {
      if (typeof t.key !== 'string' || hasCachedTexture(t.key)) continue;
      const data = fromBase64(t.data);
      if (data.length !== t.width * t.height * 4) continue;
      cachedTexture(t.key, () => {
        const texture = new THREE.DataTexture(data, t.width, t.height);
        texture.colorSpace = t.colorSpace as THREE.ColorSpace;
        texture.wrapS = t.wrapS as THREE.Wrapping;
        texture.wrapT = t.wrapT as THREE.Wrapping;
        texture.magFilter = t.magFilter as THREE.MagnificationTextureFilter;
        texture.minFilter = t.minFilter as THREE.MinificationTextureFilter;
        texture.generateMipmaps = t.generateMipmaps;
        texture.flipY = t.flipY;
        texture.needsUpdate = true;
        return texture;
      });
      taken.add(t.key);
      count++;
    }
    return count;
  } catch {
    return 0;
  }
}

/**
 * Keep these cached textures for the next launch of this version. Writes
 * only when one of them was painted this launch rather than taken back.
 */
export async function saveKeptTextures(keys: readonly string[]): Promise<void> {
  if (inDevelopment()) return;
  try {
    const present = keys.filter((key) => peekCachedTexture(key) instanceof THREE.DataTexture);
    if (present.length === 0 || present.every((key) => taken.has(key))) return;
    const textures: KeptTexture[] = [];
    for (const key of present) {
      const t = peekCachedTexture(key) as THREE.DataTexture;
      const { data, width, height } = t.image as { data: Uint8Array; width: number; height: number };
      if (!(data instanceof Uint8Array) || data.length !== width * height * 4) continue;
      textures.push({
        key,
        width,
        height,
        data: toBase64(data),
        colorSpace: t.colorSpace,
        wrapS: t.wrapS,
        wrapT: t.wrapT,
        magFilter: t.magFilter,
        minFilter: t.minFilter,
        generateMipmaps: t.generateMipmaps,
        flipY: t.flipY,
      });
    }
    for (const key of present) taken.add(key);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ version: GAME_VERSION, textures } satisfies Kept));
  } catch {
    // Painted again next launch, as before.
  }
}

/** Test seam. */
export function resetKeptTexturesForTests(): void {
  taken.clear();
}

/* ── base64, by hand: no Buffer in React Native ─────────────────────── */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = new Uint8Array(128);
for (let i = 0; i < ALPHABET.length; i++) LOOKUP[ALPHABET.charCodeAt(i)] = i;

export function toBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  let chunk = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    chunk +=
      ALPHABET[a >> 2] +
      ALPHABET[((a & 3) << 4) | (b >> 4)] +
      (i + 1 < bytes.length ? ALPHABET[((b & 15) << 2) | (c >> 6)] : '=') +
      (i + 2 < bytes.length ? ALPHABET[c & 63] : '=');
    if (chunk.length >= 8192) {
      parts.push(chunk);
      chunk = '';
    }
  }
  parts.push(chunk);
  return parts.join('');
}

export function fromBase64(text: string): Uint8Array {
  const pad = text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0;
  const out = new Uint8Array((text.length / 4) * 3 - pad);
  let o = 0;
  for (let i = 0; i < text.length; i += 4) {
    const a = LOOKUP[text.charCodeAt(i)];
    const b = LOOKUP[text.charCodeAt(i + 1)];
    const c = LOOKUP[text.charCodeAt(i + 2)];
    const d = LOOKUP[text.charCodeAt(i + 3)];
    const n = (a << 18) | (b << 12) | (c << 6) | d;
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length) out[o++] = (n >> 8) & 255;
    if (o < out.length) out[o++] = n & 255;
  }
  return out;
}
