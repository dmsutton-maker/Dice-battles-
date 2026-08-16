import {
  AudioPlayer,
  createAudioPlayer,
  setAudioModeAsync,
} from 'expo-audio';
import { getAudioSettings } from './settings';

/**
 * Sound-effect engine. All sounds are REAL recordings (see
 * assets/sounds/CREDITS.md): Kenney's CC0 dice recordings, a real crowd
 * cheer, and a victory fanfare — processed offline into small mono WAVs.
 *
 * Design: each throw plays a full genuine dice-roll recording (rattle +
 * tumble + land); hard mid-roll collisions add quiet click accents on top.
 * Round-robin pools let rapid sounds overlap instead of cutting off.
 */

const throwSources = [
  require('../../assets/sounds/throw1.wav'),
  require('../../assets/sounds/throw2.wav'),
  require('../../assets/sounds/throw3.wav'),
];
const clackSources = [
  require('../../assets/sounds/clack1.wav'),
  require('../../assets/sounds/clack2.wav'),
  require('../../assets/sounds/clack3.wav'),
];
const cheerSource = require('../../assets/sounds/cheer.wav');
const fanfareSource = require('../../assets/sounds/fanfare.wav');
/**
 * Battle music rotation — Kevin MacLeod (incompetech.com), CC-BY 4.0.
 * A different track is picked each time music starts from silence.
 */
const musicSources = [
  require('../../assets/sounds/music-monkeys.m4a'),
  require('../../assets/sounds/music-sneaky.m4a'),
  require('../../assets/sounds/music-polka.m4a'),
  require('../../assets/sounds/music.m4a'),
];

let throwPool: AudioPlayer[] = [];
let clackPool: AudioPlayer[] = [];
let cheerPlayer: AudioPlayer | null = null;
let fanfarePlayer: AudioPlayer | null = null;
let musicPlayers: AudioPlayer[] = [];
let musicPlayer: AudioPlayer | null = null;
let throwIndex = 0;
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

    throwPool = [...throwSources, ...throwSources].map((source) => {
      const player = createAudioPlayer(source);
      player.volume = 0.85;
      return player;
    });
    // Collision accents are garnish under the throw sound — keep them quiet.
    clackPool = [...clackSources, ...clackSources].map((source) => {
      const player = createAudioPlayer(source);
      player.volume = 0.35;
      return player;
    });
    cheerPlayer = createAudioPlayer(cheerSource);
    cheerPlayer.volume = 0.9;
    fanfarePlayer = createAudioPlayer(fanfareSource);
    fanfarePlayer.volume = 1.0;
    musicPlayers = musicSources.map((source) => {
      const player = createAudioPlayer(source);
      player.loop = true;
      player.volume = 0.4;
      return player;
    });
  } catch {
    // Sounds are garnish — never let audio failures break the game.
    throwPool = [];
    clackPool = [];
    cheerPlayer = null;
    fanfarePlayer = null;
    musicPlayers = [];
    musicPlayer = null;
  }
}

function replay(player: AudioPlayer | null): void {
  if (!player || !getAudioSettings().sfx) return;
  try {
    player.seekTo(0).catch(() => {});
    player.play();
  } catch {
    // ignore — see initSounds
  }
}

/** Full real dice-roll recording (rattle + tumble + land). Play per throw. */
export function playThrow(): void {
  if (throwPool.length === 0) return;
  throwIndex = (throwIndex + 1) % throwPool.length;
  replay(throwPool[throwIndex]);
}

/** Quiet single-impact click accent. Call on hard mid-roll collisions. */
export function playClack(): void {
  if (clackPool.length === 0) return;
  clackIndex = (clackIndex + 1) % clackPool.length;
  replay(clackPool[clackIndex]);
}

/** Real crowd cheer — a prisoner was rescued. */
export function playCheer(): void {
  replay(cheerPlayer);
}

/** Victory fanfare — all prisoners freed. */
export function playFanfare(): void {
  replay(fanfarePlayer);
}

/**
 * Start the background music if enabled: resumes the current track, or
 * picks a random one from the rotation when starting from silence.
 */
export function startMusic(): void {
  if (musicPlayers.length === 0 || !getAudioSettings().music) return;
  try {
    if (!musicPlayer) {
      musicPlayer = musicPlayers[Math.floor(Math.random() * musicPlayers.length)];
      musicPlayer.seekTo(0).catch(() => {});
    }
    musicPlayer.play();
  } catch {
    // ignore — see initSounds
  }
}

/** Stop the music; the next start draws a fresh track. */
export function stopMusic(): void {
  if (!musicPlayer) return;
  try {
    musicPlayer.pause();
    musicPlayer.seekTo(0).catch(() => {});
  } catch {
    // ignore
  }
  musicPlayer = null;
}
