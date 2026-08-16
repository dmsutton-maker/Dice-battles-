import { AudioPlayer, createAudioPlayer } from 'expo-audio';
import { getAudioSettings } from './settings';

/**
 * The announcer: REAL recorded human voice clips (Kenney's CC0 voiceover
 * pack — professional male announcer) played at race beats. The detailed
 * play-by-play stays on the on-screen callout banner; the voice carries the
 * excitement: "Ready?" "Go!" — counts your rescues "One!" "Two!" — warns
 * "Look out!" when the opponent scores — "Hurry up!" when he's close —
 * "You win!" / "You lose!" at the end.
 *
 * Gated by the 'voice' audio setting.
 */
export type VoiceCue =
  | 'ready'
  | 'set'
  | 'go'
  | 'count1'
  | 'count2'
  | 'count3'
  | 'count4'
  | 'count5'
  | 'lookout'
  | 'gogogo'
  | 'hurry'
  | 'win'
  | 'lose'
  | 'congrats';

const CUE_SOURCES: Record<VoiceCue, number> = {
  ready: require('../../assets/voice/ready.wav'),
  set: require('../../assets/voice/set.wav'),
  go: require('../../assets/voice/go.wav'),
  count1: require('../../assets/voice/1.wav'),
  count2: require('../../assets/voice/2.wav'),
  count3: require('../../assets/voice/3.wav'),
  count4: require('../../assets/voice/4.wav'),
  count5: require('../../assets/voice/5.wav'),
  lookout: require('../../assets/voice/war_look_out.wav'),
  gogogo: require('../../assets/voice/war_go_go_go.wav'),
  hurry: require('../../assets/voice/hurry_up.wav'),
  win: require('../../assets/voice/you_win.wav'),
  lose: require('../../assets/voice/you_lose.wav'),
  congrats: require('../../assets/voice/congratulations.wav'),
};

let players: Partial<Record<VoiceCue, AudioPlayer>> = {};
let lastPlayed: AudioPlayer | null = null;
let initialized = false;

/** Preload all announcer clips. Safe to call more than once. */
export function initAnnouncer(): void {
  if (initialized) return;
  initialized = true;
  try {
    for (const [cue, source] of Object.entries(CUE_SOURCES)) {
      const player = createAudioPlayer(source);
      player.volume = 1.0;
      players[cue as VoiceCue] = player;
    }
  } catch {
    // Voice is garnish — never let audio failures break the game.
    players = {};
  }
}

/** Speak a cue, cutting off whatever the announcer was saying before. */
export function playCue(cue: VoiceCue): void {
  if (!getAudioSettings().voice) return;
  const player = players[cue];
  if (!player) return;
  try {
    if (lastPlayed && lastPlayed !== player) {
      lastPlayed.pause();
    }
    player.seekTo(0).catch(() => {});
    player.play();
    lastPlayed = player;
  } catch {
    // ignore — see initAnnouncer
  }
}

/** Spoken count for the n-th rescue (1-5); the 6th is "You win!". */
export function countCue(n: number): VoiceCue | null {
  if (n >= 1 && n <= 5) return `count${n}` as VoiceCue;
  return null;
}

export function stopAnnouncer(): void {
  try {
    lastPlayed?.pause();
  } catch {
    // ignore
  }
}
