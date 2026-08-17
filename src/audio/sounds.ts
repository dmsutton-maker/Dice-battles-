import {
  AudioPlayer,
  createAudioPlayer,
  setAudioModeAsync,
} from 'expo-audio';
import { effectiveVolume, subscribeAudioSettings } from './settings';

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

/**
 * The mix: how loud each sound is RELATIVE to the others. This is the
 * balance the game was tuned with and it never changes — the player's SFX
 * slider scales all of it together (see MIX usage in `volumeOf`).
 */
export const MIX = {
  throw: 0.85,
  /** Collision accents are garnish under the throw sound — keep them quiet. */
  clack: 0.35,
  cheer: 0.9,
  fanfare: 1.0,
  music: 0.4,
} as const;

/** A player paired with its place in the mix, so levels can be reapplied. */
interface Voice {
  player: AudioPlayer;
  mix: number;
}

let throwPool: Voice[] = [];
let clackPool: Voice[] = [];
let cheerVoice: Voice | null = null;
let fanfareVoice: Voice | null = null;
let musicPlayers: AudioPlayer[] = [];
let musicPlayer: AudioPlayer | null = null;
/** Whether the game WANTS music — separate from whether it is audible. */
let musicWanted = false;
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

    const voice = (source: number, mix: number): Voice => ({
      player: createAudioPlayer(source),
      mix,
    });

    throwPool = [...throwSources, ...throwSources].map((s) => voice(s, MIX.throw));
    clackPool = [...clackSources, ...clackSources].map((s) => voice(s, MIX.clack));
    cheerVoice = voice(cheerSource, MIX.cheer);
    fanfareVoice = voice(fanfareSource, MIX.fanfare);
    musicPlayers = musicSources.map((source) => {
      const player = createAudioPlayer(source);
      player.loop = true;
      player.volume = volumeOf('music', MIX.music);
      return player;
    });

    // The music loop is already playing when a slider moves, so it has to
    // follow the slider live; one-shot sounds take their level at play time.
    subscribeAudioSettings(syncMusic);
  } catch {
    // Sounds are garnish — never let audio failures break the game.
    throwPool = [];
    clackPool = [];
    cheerVoice = null;
    fanfareVoice = null;
    musicPlayers = [];
    musicPlayer = null;
  }
}

/** A sound's place in the mix, scaled by the player's slider. */
function volumeOf(channel: 'sfx' | 'music', mix: number): number {
  return effectiveVolume(channel) * mix;
}

function replay(voice: Voice | null): void {
  if (!voice) return;
  const volume = volumeOf('sfx', voice.mix);
  if (volume <= 0) return;
  try {
    voice.player.volume = volume;
    voice.player.seekTo(0).catch(() => {});
    voice.player.play();
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
  replay(cheerVoice);
}

/** Victory fanfare — all prisoners freed. */
export function playFanfare(): void {
  replay(fanfareVoice);
}

/**
 * Match the music player to both the game's wishes and the slider: play
 * when the game wants music AND the level is above zero, pause otherwise.
 * A muted loop is paused rather than played silently — silent playback
 * still burns battery for nothing.
 */
function syncMusic(): void {
  if (!musicPlayer) return;
  const volume = volumeOf('music', MIX.music);
  try {
    musicPlayer.volume = volume;
    if (musicWanted && volume > 0) musicPlayer.play();
    else musicPlayer.pause();
  } catch {
    // ignore — see initSounds
  }
}

/**
 * Start the background music: resumes the current track, or picks a random
 * one from the rotation when starting from silence. A muted music slider
 * still selects a track, so raising it mid-battle starts the music at once.
 */
export function startMusic(): void {
  if (musicPlayers.length === 0) return;
  musicWanted = true;
  if (!musicPlayer) {
    musicPlayer = musicPlayers[Math.floor(Math.random() * musicPlayers.length)];
    try {
      musicPlayer.seekTo(0).catch(() => {});
    } catch {
      // ignore — see initSounds
    }
  }
  syncMusic();
}

/** Stop the music; the next start draws a fresh track. */
export function stopMusic(): void {
  musicWanted = false;
  if (!musicPlayer) return;
  try {
    musicPlayer.pause();
    musicPlayer.seekTo(0).catch(() => {});
  } catch {
    // ignore
  }
  musicPlayer = null;
}
