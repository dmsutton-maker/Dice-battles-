import AsyncStorage from '@react-native-async-storage/async-storage';

/** Player-facing audio preferences, persisted across launches. */
export interface AudioSettings {
  /** Sound effects: dice rolls, cheers, fanfare. */
  sfx: boolean;
  /** Background music loop. */
  music: boolean;
  /** Spoken announcer commentary. */
  voice: boolean;
}

const STORAGE_KEY = 'dice-battles:audio-settings';

let current: AudioSettings = { sfx: true, music: true, voice: true };

export function getAudioSettings(): AudioSettings {
  return current;
}

/** Load persisted settings (call once at startup). Returns the result. */
export async function loadAudioSettings(): Promise<AudioSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      current = { ...current, ...JSON.parse(raw) };
    }
  } catch {
    // Defaults are fine if storage is unavailable.
  }
  return current;
}

export function setAudioSetting<K extends keyof AudioSettings>(
  key: K,
  value: AudioSettings[K],
): AudioSettings {
  current = { ...current, [key]: value };
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current)).catch(() => {});
  return current;
}
