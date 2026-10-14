import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Player-facing audio preferences, persisted across launches.
 *
 * Every channel is a LEVEL from 0 (silent) to 1 (full), not an on/off
 * switch: a house where one child is playing and another is reading needs
 * "quieter", not "off". Zero is still exactly off — nothing is loaded,
 * played or resumed at 0 — so the old switches are just the two ends of
 * the new sliders.
 *
 * `master` scales the other three. The per-sound balance (a dice clack is
 * quieter than the fanfare) lives with the sounds themselves; these levels
 * scale that mix rather than replacing it, so at 1 the game sounds exactly
 * as it always has.
 */
export interface AudioSettings {
  /** Scales everything below it. */
  master: number;
  /** Sound effects: dice rolls, cheers, fanfare. */
  sfx: number;
  /** Background music loop. */
  music: number;
  /** Spoken announcer commentary. */
  voice: number;
}

/** The three channels the master level scales. */
export type AudioChannel = 'sfx' | 'music' | 'voice';
/** Everything with a slider, master included. */
export type AudioLevelKey = keyof AudioSettings;

const STORAGE_KEY = 'dice-battles:audio-settings';

/** Sliders move in twentieths — fine enough to matter, coarse enough to hit. */
export const VOLUME_STEP = 0.05;

const DEFAULTS: AudioSettings = { master: 1, sfx: 1, music: 1, voice: 1 };

let current: AudioSettings = { ...DEFAULTS };

type Listener = () => void;
const listeners = new Set<Listener>();

/** Rounds to the slider's own step and clamps into 0..1. */
export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const stepped = Math.round(value / VOLUME_STEP) * VOLUME_STEP;
  // Rounding to 2dp keeps stored JSON free of 0.30000000000000004.
  return Math.min(1, Math.max(0, Math.round(stepped * 100) / 100));
}

/**
 * Reads whatever was in storage into a valid settings object.
 *
 * Settings saved before v1.9.0 held booleans; `true` becomes full volume
 * and `false` becomes silence, so nobody's muted channel comes back loud
 * after the update.
 */
export function normalizeAudioSettings(raw: unknown): AudioSettings {
  const out: AudioSettings = { ...DEFAULTS };
  if (typeof raw !== 'object' || raw === null) return out;
  for (const key of Object.keys(DEFAULTS) as AudioLevelKey[]) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === 'boolean') out[key] = value ? 1 : 0;
    else if (typeof value === 'number') out[key] = clampVolume(value);
  }
  return out;
}

export function getAudioSettings(): AudioSettings {
  return current;
}

/** Load persisted settings (call once at startup). Returns the result. */
export async function loadAudioSettings(): Promise<AudioSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) current = normalizeAudioSettings(JSON.parse(raw));
  } catch {
    // Defaults are fine if storage is unavailable or holds junk.
    current = { ...DEFAULTS };
  }
  notify();
  return current;
}

/** Move one slider. Returns the whole settings object. */
export function setAudioVolume(key: AudioLevelKey, value: number): AudioSettings {
  current = { ...current, [key]: clampVolume(value) };
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current)).catch(() => {});
  notify();
  return current;
}

/**
 * How loud a channel should actually play right now, master included.
 * Everything that makes a noise multiplies its own mix level by this.
 */
export function effectiveVolume(channel: AudioChannel): number {
  return Math.round(current.master * current[channel] * 100) / 100;
}

/** Whether a channel would make any sound at all. */
export function isAudible(channel: AudioChannel): boolean {
  return effectiveVolume(channel) > 0;
}

/**
 * Called whenever a level changes, so already-playing audio (the music
 * loop) can follow the slider live instead of at the next track.
 */
export function subscribeAudioSettings(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // A broken listener must not take the settings screen down with it.
    }
  }
}

/** Test seam: restore defaults and drop listeners. */
export function resetAudioSettingsForTests(partial?: Partial<AudioSettings>): void {
  current = { ...DEFAULTS, ...partial };
  listeners.clear();
}
