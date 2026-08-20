import AsyncStorage from '@react-native-async-storage/async-storage';
import { ARENAS, ArenaId } from '../arena/arenas';
import { DEFAULT_SKIN_ID, DICE_SKINS, skinById } from './diceSkins';
import { owns } from './currency';
import { hasUnlockAll, isUnlocked, UnlockId } from './progress';

/**
 * What the player has EQUIPPED, as opposed to what they have earned
 * (src/game/progress.ts). Kept separate on purpose: trophies are the record
 * of what was won and must never be rewritten by a cosmetic choice.
 *
 * Every read is validated against the current unlocks, so a selection can
 * never leave the player in an item they no longer have — which is exactly
 * what happens when family tester mode is switched back off.
 */
export interface Loadout {
  arenaId: ArenaId;
  skinId: string;
}

/** Which trophy tier gates each battlefield. */
export const ARENA_UNLOCKS: Record<ArenaId, UnlockId> = {
  castle: 'castle',
  castleSunset: 'sunset-castle',
  jungle: 'jungle',
  space: 'space',
};

/** Display order in the Inventory — cheapest first. */
export const ARENA_ORDER: ArenaId[] = ['castle', 'castleSunset', 'jungle', 'space'];

const STORAGE_KEY = 'dice-battles:loadout';
const DEFAULT_LOADOUT: Loadout = { arenaId: 'castle', skinId: DEFAULT_SKIN_ID };

let current: Loadout = { ...DEFAULT_LOADOUT };

export function getLoadout(): Loadout {
  return current;
}

export async function loadLoadout(): Promise<Loadout> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      current = {
        arenaId: parsed.arenaId in ARENAS ? parsed.arenaId : DEFAULT_LOADOUT.arenaId,
        skinId: DICE_SKINS.some((s) => s.id === parsed.skinId)
          ? parsed.skinId
          : DEFAULT_LOADOUT.skinId,
      };
    }
  } catch {
    // Defaults are fine if storage is unavailable.
  }
  return current;
}

function persist(): void {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current)).catch(() => {});
}

export function equipArena(arenaId: ArenaId): Loadout {
  current = { ...current, arenaId };
  persist();
  return current;
}

export function equipSkin(skinId: string): Loadout {
  current = { ...current, skinId };
  persist();
  return current;
}

export function isArenaUnlocked(arenaId: ArenaId, trophies: number): boolean {
  return isUnlocked(ARENA_UNLOCKS[arenaId], trophies);
}

/**
 * A skin is available if it is free, earned on the ladder, or bought in
 * the Store. The two routes never overlap: a skin has an unlock tier or a
 * coin price, not both.
 *
 * Family tester mode covers BOTH routes. It used to open the ladder and
 * the arenas but stop at the Store, so a playtester still had to grind
 * coins for half the dice — which is the opposite of what the mode is
 * for. Nothing is bought: they are simply usable while it is on, and
 * still cost coins the moment it goes off.
 */
export function isSkinUnlocked(skinId: string, trophies: number): boolean {
  const skin = skinById(skinId);
  if (skin.price !== undefined) return hasUnlockAll() || owns(skin.id);
  if (skin.unlock === null || skin.unlock === undefined) return true;
  return isUnlocked(skin.unlock, trophies);
}

/**
 * The battlefield actually used for a battle: the equipped one if it is
 * still unlocked, otherwise the best one the player owns.
 */
export function activeArena(trophies: number): ArenaId {
  if (isArenaUnlocked(current.arenaId, trophies)) return current.arenaId;
  const owned = ARENA_ORDER.filter((id) => isArenaUnlocked(id, trophies));
  return owned[owned.length - 1] ?? 'castle';
}

/** The dice shell colour actually used, with the same fallback rule. */
export function activeDieBody(trophies: number): string {
  const skin = isSkinUnlocked(current.skinId, trophies)
    ? skinById(current.skinId)
    : skinById(DEFAULT_SKIN_ID);
  return skin.body;
}
