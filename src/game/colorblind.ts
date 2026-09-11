import AsyncStorage from '@react-native-async-storage/async-storage';
import { PrisonerColorId } from './colors';

/**
 * Colourblind mode: give every colour a SHAPE as well as a colour.
 *
 * The palette is already engineered for colour-vision deficiency — it is
 * CIEDE2000-checked and separated by lightness as well as hue (see
 * colors.ts). But the whole game signal is "which colour came up", and a
 * palette that is merely *distinguishable* still asks someone to make a
 * fine judgement under time pressure. A shape is not a judgement call.
 *
 * So this is not a second palette. The colours stay exactly as they are
 * and a symbol is stamped on top, which also helps anyone playing on a
 * dim screen, in sunlight, or across the table from the phone.
 */
export type SymbolId =
  | 'circle'
  | 'square'
  | 'triangle'
  | 'star'
  | 'diamond'
  | 'hexagon';

/**
 * One shape per colour. Chosen to stay apart at a glance and at a small
 * size: no two share a silhouette, and none is a rotation of another.
 */
export const COLOR_SYMBOLS: Record<PrisonerColorId, SymbolId> = {
  red: 'circle',
  blue: 'square',
  green: 'triangle',
  yellow: 'star',
  purple: 'diamond',
  orange: 'hexagon',
};

const STORAGE_KEY = 'dice-battles:colorblind';

let enabled = false;
const listeners = new Set<(on: boolean) => void>();

export function isColorblindMode(): boolean {
  return enabled;
}

export async function loadColorblindMode(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    enabled = raw === 'true';
  } catch {
    // Off is a safe default if storage is unavailable.
  }
  return enabled;
}

export function setColorblindMode(on: boolean): void {
  enabled = on;
  AsyncStorage.setItem(STORAGE_KEY, on ? 'true' : 'false').catch(() => {});
  listeners.forEach((fn) => fn(on));
}

export function subscribeColorblindMode(fn: (on: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Test-only reset so suites do not leak state between cases. */
export function resetColorblindForTests(on = false): void {
  enabled = on;
  listeners.clear();
}
