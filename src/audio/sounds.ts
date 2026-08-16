import {
  AudioPlayer,
  createAudioPlayer,
  setAudioModeAsync,
} from 'expo-audio';

/**
 * Tiny sound-effect engine. All sounds are procedurally synthesized WAVs
 * bundled with the app (see assets/sounds) — fully offline, no licensing.
 *
 * Clacks use a round-robin pool of players per variant so rapid dice
 * impacts can overlap instead of cutting each other off.
 */

const clackSources = [
  require('../../assets/sounds/clack1.wav'),
  require('../../assets/sounds/clack2.wav'),
  require('../../assets/sounds/clack3.wav'),
];
const cheerSource = require('../../assets/sounds/cheer.wav');
const fanfareSource = require('../../assets/sounds/fanfare.wav');

let clackPool: AudioPlayer[] = [];
let cheerPlayer: AudioPlayer | null = null;
let fanfarePlayer: AudioPlayer | null = null;
let clackIndex = 0;
let initialized = false;

/** Call once at app start. Safe to call again (no-op). */
export function initSounds(): void {
  if (initialized) return;
  initialized = true;
  try {
    // Game SFX should play even with the ring switch on silent, and mix
    // politely with the player's music.
    setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
    }).catch(() => {});

    // Two players per clack variant so bursts of impacts can overlap.
    clackPool = [...clackSources, ...clackSources].map((source) => {
      const player = createAudioPlayer(source);
      player.volume = 0.55;
      return player;
    });
    cheerPlayer = createAudioPlayer(cheerSource);
    cheerPlayer.volume = 0.9;
    fanfarePlayer = createAudioPlayer(fanfareSource);
    fanfarePlayer.volume = 1.0;
  } catch {
    // Sounds are garnish — never let audio failures break the game.
    clackPool = [];
    cheerPlayer = null;
    fanfarePlayer = null;
  }
}

function replay(player: AudioPlayer | null): void {
  if (!player) return;
  try {
    player.seekTo(0).catch(() => {});
    player.play();
  } catch {
    // ignore — see initSounds
  }
}

/** Short dice-impact tick. Cheap; call on every hard collision. */
export function playClack(): void {
  if (clackPool.length === 0) return;
  clackIndex = (clackIndex + 1) % clackPool.length;
  replay(clackPool[clackIndex]);
}

/** Crowd cheer + rising plinks — a prisoner was rescued. */
export function playCheer(): void {
  replay(cheerPlayer);
}

/** Victory fanfare — all prisoners freed. */
export function playFanfare(): void {
  replay(fanfarePlayer);
}
