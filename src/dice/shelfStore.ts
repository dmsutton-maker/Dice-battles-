import AsyncStorage from '@react-native-async-storage/async-storage';
import { DICE_SKINS, DiceSkin } from '../game/diceSkins';
import { GAME_VERSION } from '../game/version';
import { adoptShelfPicture, paintedShelfPictures } from './preview';

/**
 * The shelf pictures, kept between launches.
 *
 * David's family, 3 Nov 2026: "make sure the game is fully loaded before
 * showing the home screen" — and before that, "it all has to be
 * lightning fast". Painting the sixty shelf pictures is about two and a
 * half seconds of JavaScript on a desktop, ten or more on a phone, and it
 * used to be paid again on EVERY launch for pictures that had not
 * changed. Now they are painted once per version of the game, stored,
 * and read back in one go (a few tens of milliseconds) on every launch
 * after that, so the loading screen does not wait for them at all.
 *
 * KEYED ON THE GAME VERSION, and on each skin's colours and pattern.
 * Every update that ships carries a new GAME_VERSION (AGENTS.md,
 * Releasing), and a painter can only change in an update, so a picture
 * kept from an older version is never shown: the first launch after an
 * update paints them afresh. Never in development, where the painters
 * change without the version moving.
 *
 * Never throws and never blocks: storage that fails simply means the
 * pictures are painted, the way they always were.
 */
const STORAGE_KEY = 'dice-battles/shelf-pictures';

interface Kept {
  version: string;
  pictures: Record<string, { sig: string; uri: string }>;
}

/** Everything a skin's picture is painted from, bar the painter's code. */
export function shelfSignature(skin: DiceSkin): string {
  return [skin.pattern, skin.body, skin.ink ?? '', skin.effect ?? ''].join('|');
}

let saved = false;

const inDevelopment = () => typeof __DEV__ !== 'undefined' && __DEV__;

/**
 * Put the pictures kept from an earlier launch of THIS version back in
 * the shelf's cache. Resolves with how many were taken.
 */
export async function loadShelfPictures(): Promise<number> {
  if (inDevelopment()) return 0;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const kept = JSON.parse(raw) as Kept;
    if (!kept || kept.version !== GAME_VERSION || typeof kept.pictures !== 'object') return 0;
    let taken = 0;
    for (const skin of DICE_SKINS) {
      const entry = kept.pictures[skin.id];
      if (!entry || entry.sig !== shelfSignature(skin)) continue;
      if (typeof entry.uri !== 'string' || !entry.uri.startsWith('data:image/png;base64,')) continue;
      adoptShelfPicture(skin.id, entry.uri);
      taken++;
    }
    // Everything came back: nothing new to keep this run.
    if (taken === DICE_SKINS.filter((s) => s.pattern !== 'plain').length) saved = true;
    return taken;
  } catch {
    return 0;
  }
}

/**
 * Keep every painted picture for the next launch. Called once the whole
 * shelf is painted; writes once per run, and only if there is something
 * the stored copy does not already have.
 */
export async function saveShelfPictures(): Promise<void> {
  if (saved || inDevelopment()) return;
  saved = true;
  try {
    const painted = paintedShelfPictures();
    const pictures: Kept['pictures'] = {};
    for (const skin of DICE_SKINS) {
      const uri = painted[skin.id];
      if (uri) pictures[skin.id] = { sig: shelfSignature(skin), uri };
    }
    if (Object.keys(pictures).length === 0) return;
    const kept: Kept = { version: GAME_VERSION, pictures };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(kept));
  } catch {
    // Painted again next launch, as before.
  }
}

/** Test seam. */
export function resetShelfStoreForTests(): void {
  saved = false;
}
