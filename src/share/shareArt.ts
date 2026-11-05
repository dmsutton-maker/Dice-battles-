import { Asset } from 'expo-asset';
import { ArtId } from './shareArtManifest';

/**
 * The card's fixed pictures (assets/share, made by tools/share-card/
 * make_art.py), as files the GL context can read.
 *
 * The composer uploads each one with expo-gl's own image loading —
 * `texImage2D` given `{ localUri }` decodes the file natively — so all
 * the JavaScript has to do is find out where each file is. In a release
 * build that is a path inside the bundle; in development it is a copy
 * in the cache, fetched from Metro the first time.
 *
 * This is the only file that names the PNGs. The layout never does: it
 * works in ids and sizes (shareArtManifest.ts), which is what keeps it
 * runnable in a test.
 */
const MODULES: Record<ArtId, number> = {
  victory: require('../../assets/share/victory.png'),
  panel: require('../../assets/share/panel.png'),
  title: require('../../assets/share/title.png'),
  of: require('../../assets/share/of.png'),
  freed: require('../../assets/share/freed.png'),
  trophies: require('../../assets/share/trophies.png'),
  digits: require('../../assets/share/digits.png'),
  digitsSmall: require('../../assets/share/digits-small.png'),
  modeClassic: require('../../assets/share/mode-classic.png'),
  modeUltimate: require('../../assets/share/mode-ultimate.png'),
  modeSkirmish: require('../../assets/share/mode-skirmish.png'),
  modeColorwar: require('../../assets/share/mode-colorwar.png'),
};

/** Every picture's `file://` location, by id. */
export type ArtFiles = Record<ArtId, string>;

/**
 * Where every picture is, or null if any could not be had. Never
 * throws: a card that cannot be made is a sheet that says so, not a
 * red box over a win.
 */
export async function loadShareArt(): Promise<ArtFiles | null> {
  try {
    const ids = Object.keys(MODULES) as ArtId[];
    const assets = await Asset.loadAsync(ids.map((id) => MODULES[id]));
    const files = {} as ArtFiles;
    for (let i = 0; i < ids.length; i++) {
      const uri = assets[i]?.localUri;
      if (!uri || !uri.startsWith('file://')) return null;
      files[ids[i]] = uri;
    }
    return files;
  } catch {
    return null;
  }
}
