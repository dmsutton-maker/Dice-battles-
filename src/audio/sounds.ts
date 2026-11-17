import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AudioPlayer,
  createAudioPlayer,
  setAudioModeAsync,
} from 'expo-audio';
import {
  BattleTrackId,
  nextBattleTrack,
  parseStoredTrack,
  ROTATION_STORAGE_KEY,
} from '../game/musicRotation';
import { effectiveVolume, subscribeAudioSettings } from './settings';

/**
 * Sound-effect and music engine. The dice are REAL recordings (see
 * assets/sounds/CREDITS.md): Kenney's CC0 dice recordings, processed
 * offline into small mono files. Everything else — the music, the
 * fanfares, the title-card sting, the purchase sound, the rescue cheer and
 * the UI sounds — is OUR OWN, synthesised for this game (tools/music): no
 * samples, no licence, nobody to credit. Marc, 5 Nov 2026: "all the music
 * in the game is just ours."
 *
 * Design: each throw plays a full genuine dice-roll recording (rattle +
 * tumble + land); hard mid-roll collisions add quiet click accents on top.
 * Round-robin pools let rapid sounds overlap instead of cutting off.
 *
 * This is the ONE file that knows which sound files exist. A screen says
 * what it wants — `setMusicScene('lobby' | 'battle' | 'none')`,
 * `setMusicIntensity(true)` — and never touches a player.
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
const cheerSource = require('../../assets/sounds/cheer.m4a');
/**
 * UI sounds, synthesised rather than recorded — a 55ms tick and a rising
 * fifth. Written by this project (see assets/sounds/CREDITS.md), so there
 * is no third-party licence attached to either.
 */
const clickSource = require('../../assets/sounds/click.wav');
const equipSource = require('../../assets/sounds/equip.wav');
/** Plays once on the title card: Pixel Rush's sting (tools/music). */
const startupSource = require('../../assets/sounds/startup.m4a');
/**
 * Something bought. Marc, 5 Nov 2026: "give a little nice synthesized
 * excitement when they purchase something" — a coin ding-ding, a run up
 * D major, a bell shimmer (tools/music/purchase.py).
 */
const purchaseSource = require('../../assets/sounds/purchase.m4a');

/**
 * THE SOUNDTRACK. Marc, 5 Nov 2026: "Music should be fast paced and
 * energetic and exciting and owned completely by us so it needs to be
 * original" ... "Not just endgame music, all music for the game".
 *
 * Three battle tracks, each in two renders: the plain loop and a `hot`
 * one with more layers, sample-for-sample the same length and timing, so
 * the game can switch between them mid-bar without a seam. Each has its
 * own victory fanfare. They take turns, one per battle, in this order
 * (src/game/musicRotation.ts).
 */
const battleSources: Record<
  BattleTrackId,
  { normal: number; hot: number; fanfare: number }
> = {
  /** Pixel Rush — chiptune, 160 BPM. */
  pixel: {
    normal: require('../../assets/sounds/music-pixel.m4a'),
    hot: require('../../assets/sounds/music-pixel-hot.m4a'),
    fanfare: require('../../assets/sounds/fanfare-pixel.m4a'),
  },
  /** Brass Chase — funk, 132 BPM. */
  brass: {
    normal: require('../../assets/sounds/music-brass.m4a'),
    hot: require('../../assets/sounds/music-brass-hot.m4a'),
    fanfare: require('../../assets/sounds/fanfare-brass.m4a'),
  },
  /** Neon Sprint — synth-pop, 150 BPM. */
  neon: {
    normal: require('../../assets/sounds/music-neon.m4a'),
    hot: require('../../assets/sounds/music-neon-hot.m4a'),
    fanfare: require('../../assets/sounds/fanfare-neon.m4a'),
  },
};
/**
 * Pixel Rush slowed down for the home screen and the menus. Marc: "give
 * me slower version of A maybe to be the lobby music".
 */
const lobbySource = require('../../assets/sounds/music-lobby.m4a');

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
  /** UI sounds sit under everything — heard once, never noticed twice. */
  click: 0.3,
  equip: 0.55,
  /** The title card sting — present, not startling. */
  startup: 0.7,
  /** Something bought: a little occasion, just under the fanfare. */
  purchase: 0.9,
  music: 0.4,
  /** The menus' music sits a little under the battle's: company, not a show. */
  lobby: 0.35,
} as const;

/**
 * The build-up: how long the plain loop takes to hand over to the hot one,
 * and in how many steps. 80 ms a step is below what anyone hears as a
 * stair; the curve is equal-power (cosine/sine), so the loudness holds
 * steady through the middle instead of dipping.
 */
export const CROSSFADE_MS = 1200;
export const CROSSFADE_STEPS = 15;
/**
 * If the hot player's seek never reports back (it should within a few
 * tens of milliseconds for a file on the phone), start the fade anyway
 * after this long rather than leaving the battle on the plain loop.
 */
const SEEK_FALLBACK_MS = 1000;

/** What the screen on top wants to hear. */
export type MusicScene = 'lobby' | 'battle' | 'none';

/** A player paired with its place in the mix, so levels can be reapplied. */
interface Voice {
  player: AudioPlayer;
  mix: number;
}

/** The battle's music: one track, in its plain render and, once hot, the other. */
interface Battle {
  track: BattleTrackId;
  /** The loop that is playing (the plain one, or the hot one after the fade). */
  player: AudioPlayer;
  /** The hot render while it is being faded in; null before and after. */
  hot: AudioPlayer | null;
  /** The hot player has been seeked to the plain one's position and may play. */
  hotReady: boolean;
  /** 0 = all plain, 1 = all hot. */
  fade: number;
  /** `cool` until the trigger; `warming` through the fade; `hot` after it. */
  heat: 'cool' | 'warming' | 'hot';
  timer: ReturnType<typeof setInterval> | null;
}

let throwPool: Voice[] = [];
let clackPool: Voice[] = [];
let cheerVoice: Voice | null = null;
let fanfareVoices: Partial<Record<BattleTrackId, Voice>> = {};
let clickPool: Voice[] = [];
let equipVoice: Voice | null = null;
let startupVoice: Voice | null = null;
let purchaseVoice: Voice | null = null;
/** What the screen asked for. Kept even before the players exist. */
let scene: MusicScene = 'none';
/**
 * The title card is up. The lobby music waits for it to lift — the card
 * has the startup sting, and the home screen is where the music belongs.
 */
let titleCardUp = true;
/** The menus' loop. Created when the lobby is wanted, released when it is not. */
let lobbyPlayer: AudioPlayer | null = null;
/** The battle's music. Created when a battle starts, released when it ends. */
let battle: Battle | null = null;
/**
 * A battle was begun for the current 'battle' scene — true even if the
 * player could not be built, so a failed start is not retried on every
 * slider move, moving the rotation on each time.
 */
let battleBegun = false;
/** The rotation's position: the last battle track that started, any launch. */
let rotationTrack: BattleTrackId | null = null;
/** The last battle track that played THIS launch; its fanfare is the one. */
let lastTrack: BattleTrackId | null = null;
/** Set once initSounds has built the sound effects; music needs it. */
let musicAvailable = false;
let throwIndex = 0;
let clackIndex = 0;
let clickIndex = 0;
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
    fanfareVoices = {
      pixel: voice(battleSources.pixel.fanfare, MIX.fanfare),
      brass: voice(battleSources.brass.fanfare, MIX.fanfare),
      neon: voice(battleSources.neon.fanfare, MIX.fanfare),
    };
    // Four clicks round-robin: tapping quickly through a menu should not
    // cut the previous tap off mid-tick.
    clickPool = [clickSource, clickSource, clickSource, clickSource].map((s) =>
      voice(s, MIX.click),
    );
    equipVoice = voice(equipSource, MIX.equip);
    startupVoice = voice(startupSource, MIX.startup);
    purchaseVoice = voice(purchaseSource, MIX.purchase);
    // The music loops are already playing when a slider moves, so they
    // have to follow the slider live; one-shot sounds take their level at
    // play time. The music tracks themselves are loaded only when one is
    // wanted, see refreshMusic: building them all here would cost memory
    // and launch time.
    subscribeAudioSettings(syncMusic);
    musicAvailable = true;
    readRotation();
    // The screen may have said what it wants before the players existed.
    refreshMusic();
  } catch {
    // Sounds are garnish — never let audio failures break the game.
    throwPool = [];
    clackPool = [];
    cheerVoice = null;
    fanfareVoices = {};
    clickPool = [];
    equipVoice = null;
    startupVoice = null;
    purchaseVoice = null;
    musicAvailable = false;
    lobbyPlayer = null;
    battle = null;
  }
}

/**
 * Where the rotation got to last launch, read once. If a battle has
 * already started by the time storage answers, what it chose stands.
 */
function readRotation(): void {
  try {
    AsyncStorage.getItem(ROTATION_STORAGE_KEY)
      .then((raw) => {
        if (lastTrack === null) rotationTrack = parseStoredTrack(raw);
      })
      .catch(() => {});
  } catch {
    // Storage is a nicety: without it the rotation starts at Pixel Rush.
  }
}

/** A sound's place in the mix, scaled by the player's slider. */
function volumeOf(channel: 'sfx' | 'music', mix: number): number {
  return effectiveVolume(channel) * mix;
}

function replay(voice: Voice | null | undefined): void {
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

/** A button meeting a finger. Every tappable control in a menu plays it. */
export function playClick(): void {
  if (clickPool.length === 0) return;
  replay(clickPool[clickIndex]);
  clickIndex = (clickIndex + 1) % clickPool.length;
}

/** The sting on the title card, once per launch. */
export function playStartup(): void {
  replay(startupVoice);
}

/** Something snapping into place — putting on a skin or an arena. */
export function playEquip(): void {
  replay(equipVoice);
}

/**
 * Something bought — with coins in the Store, or for money anywhere a
 * purchase lands. Not for things WON: a Gold Pass level, a cup, a secret
 * code keep the fanfare. Under the sound-effects slider like the fanfare.
 */
export function playPurchase(): void {
  replay(purchaseVoice);
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

/**
 * The crowd — a prisoner was rescued. Our own since 5 Nov 2026: a crowd
 * of synthesised claps, a rising whistle and a short ta-da
 * (tools/music/cheer.py), in place of the Creative Commons recording.
 */
export function playCheer(): void {
  replay(cheerVoice);
}

/**
 * Victory fanfare — all prisoners freed. It is the fanfare of the track
 * that just played, so the ending belongs to the battle; before any
 * battle this launch it is Pixel Rush's.
 */
export function playFanfare(): void {
  replay(fanfareVoices[lastTrack ?? 'pixel']);
}

/**
 * Match every music player to both the game's wishes and the slider: play
 * when its scene is wanted AND the level is above zero, pause otherwise.
 * A muted loop is paused rather than played silently — silent playback
 * still burns battery for nothing. During the build-up both renders of
 * the battle track are here, each at its share of the fade.
 */
function syncMusic(): void {
  const level = effectiveVolume('music');
  if (lobbyPlayer) {
    try {
      lobbyPlayer.volume = level * MIX.lobby;
      if (scene === 'lobby' && !titleCardUp && level > 0) lobbyPlayer.play();
      else lobbyPlayer.pause();
    } catch {
      // ignore — see initSounds
    }
  }
  const b = battle;
  if (b) {
    try {
      const base = level * MIX.music;
      // Equal power: the two shares add up to a steady loudness.
      const angle = (b.fade * Math.PI) / 2;
      b.player.volume = base * Math.cos(angle);
      if (b.hot) b.hot.volume = base * Math.sin(angle);
      const on = scene === 'battle' && level > 0;
      if (on) {
        b.player.play();
        if (b.hot && b.hotReady) b.hot.play();
      } else {
        b.player.pause();
        if (b.hot) b.hot.pause();
      }
    } catch {
      // ignore — see initSounds
    }
  }
}

/**
 * Bring the players into line with what the screen wants: let go of the
 * scene that is over, build the one that is wanted, then set the levels.
 * Safe to call at any time and from any order of events — a screen may
 * speak before the sounds exist, or the title card may lift after the
 * home screen has already asked for its music.
 */
function refreshMusic(): void {
  if (!musicAvailable) return;
  if (scene !== 'battle') endBattle();
  if (scene !== 'lobby') endLobby();
  if (scene === 'battle' && !battleBegun) beginBattle();
  if (scene === 'lobby' && !lobbyPlayer && !titleCardUp) beginLobby();
  syncMusic();
}

function beginLobby(): void {
  try {
    const player = createAudioPlayer(lobbySource);
    player.loop = true;
    player.volume = volumeOf('music', MIX.lobby);
    lobbyPlayer = player;
  } catch {
    // ignore — see initSounds
  }
}

/**
 * Let go of the menus' loop. Keeping a paused player around would hold the
 * track in memory for nothing; it comes back on the next visit.
 */
function endLobby(): void {
  const player = lobbyPlayer;
  if (!player) return;
  lobbyPlayer = null;
  try {
    player.pause();
    player.remove();
  } catch {
    // ignore
  }
}

/**
 * A fresh battle: the next track in the rotation, loaded now and started
 * plain. The position is written down at once so the next launch carries
 * on from here. A muted music slider still selects a track, so raising
 * it mid-battle starts the music at once.
 */
function beginBattle(): void {
  battleBegun = true;
  const track = nextBattleTrack(rotationTrack);
  rotationTrack = track;
  lastTrack = track;
  try {
    AsyncStorage.setItem(ROTATION_STORAGE_KEY, track).catch(() => {});
  } catch {
    // Storage is a nicety; the rotation still runs for this launch.
  }
  try {
    const player = createAudioPlayer(battleSources[track].normal);
    player.loop = true;
    player.volume = volumeOf('music', MIX.music);
    battle = {
      track,
      player,
      hot: null,
      hotReady: false,
      fade: 0,
      heat: 'cool',
      timer: null,
    };
  } catch {
    battle = null;
  }
}

/**
 * The battle is over or left: stop the fade if one is running and let go
 * of both renders. The next battle draws the next track and starts cool.
 */
function endBattle(): void {
  battleBegun = false;
  const b = battle;
  if (!b) return;
  battle = null;
  if (b.timer) clearInterval(b.timer);
  for (const player of [b.player, b.hot]) {
    if (!player) continue;
    try {
      player.pause();
      player.remove();
    } catch {
      // ignore
    }
  }
}

/**
 * Tell the music what is on screen. The home screen and every menu are
 * the `lobby`; the countdown and the fight are the `battle`; the result
 * screens, and anything else, are `none`. Saying the same thing twice
 * changes nothing, so a screen can say it on every render it likes —
 * and resuming the same battle after a pause never draws a new track.
 */
export function setMusicScene(next: MusicScene): void {
  if (next === scene) return;
  scene = next;
  refreshMusic();
}

/**
 * The title card has lifted and the home screen is showing: the lobby
 * music may start now, not under the card and not over its sting.
 */
export function titleCardLifted(): void {
  if (!titleCardUp) return;
  titleCardUp = false;
  refreshMusic();
}

/**
 * The build-up. Marc: "as there's only like one more player to save then
 * it gets a little bit more intense". The hot render of the playing track
 * is started at the plain one's position, silent, and the two are
 * crossfaded over CROSSFADE_MS in CROSSFADE_STEPS steps; then the plain
 * player is let go. Once hot it stays hot until the music stops — there
 * is no cooling down, so `false` does nothing, as does going hot when
 * already hot or with no battle music playing.
 */
export function setMusicIntensity(hot: boolean): void {
  if (!hot) return;
  const b = battle;
  if (!b || b.heat !== 'cool') return;
  b.heat = 'warming';
  try {
    const hotPlayer = createAudioPlayer(battleSources[b.track].hot);
    hotPlayer.loop = true;
    hotPlayer.volume = 0;
    b.hot = hotPlayer;

    let steps = 0;
    const step = () => {
      if (battle !== b || b.hot !== hotPlayer) return;
      steps += 1;
      b.fade = Math.min(1, steps / CROSSFADE_STEPS);
      syncMusic();
      if (steps < CROSSFADE_STEPS) return;
      // Handover: the hot render is now the battle's one player.
      if (b.timer) clearInterval(b.timer);
      b.timer = null;
      const plain = b.player;
      b.player = hotPlayer;
      b.hot = null;
      b.hotReady = false;
      b.fade = 0;
      b.heat = 'hot';
      try {
        plain.pause();
        plain.remove();
      } catch {
        // ignore
      }
      syncMusic();
    };

    let started = false;
    const start = () => {
      if (started || battle !== b || b.hot !== hotPlayer) return;
      started = true;
      b.hotReady = true;
      // At volume 0 until the first step, playing from the same position.
      syncMusic();
      b.timer = setInterval(step, CROSSFADE_MS / CROSSFADE_STEPS);
    };

    /*
      Land on the plain player's position. A seek takes a moment, and the
      plain loop keeps moving while it does, so the first seek is used to
      measure that moment and a second one leads by it. Both renders are
      the same length, so the position means the same thing in each.
    */
    const position = () => {
      const at = b.player.currentTime;
      return Number.isFinite(at) && at >= 0 ? at : 0;
    };
    const first = position();
    hotPlayer
      .seekTo(first)
      .then(() => {
        if (battle !== b || b.hot !== hotPlayer) return;
        const now = position();
        const lag = Math.max(0, now - first);
        return hotPlayer.seekTo(now + lag);
      })
      .then(start, start);
    setTimeout(start, SEEK_FALLBACK_MS);
  } catch {
    // The plain loop simply carries on; the build-up is garnish.
    b.hot = null;
    b.heat = 'hot';
  }
}
