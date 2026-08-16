import * as Speech from 'expo-speech';
import { getAudioSettings } from './settings';

/**
 * The announcer: spoken race commentary via the device's text-to-speech.
 * Each new line interrupts the previous one so commentary never backs up
 * during frantic play. Gated by the 'voice' audio setting.
 */
export function announce(text: string): void {
  if (!getAudioSettings().voice) return;
  try {
    Speech.stop();
    Speech.speak(text, { rate: 1.05, pitch: 1.08 });
  } catch {
    // Commentary is garnish — never let TTS failures break the game.
  }
}

export function stopAnnouncer(): void {
  try {
    Speech.stop();
  } catch {
    // ignore
  }
}
