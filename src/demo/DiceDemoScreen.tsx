import { Canvas } from '@react-three/fiber/native';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { ARENAS, CURRENT_ARENA } from '../arena/arenas';
import { countCue, initAnnouncer, playCue, stopAnnouncer, VoiceCue } from '../audio/announcer';
import {
  AudioSettings,
  getAudioSettings,
  loadAudioSettings,
  setAudioSetting,
} from '../audio/settings';
import {
  initSounds,
  playCheer,
  playFanfare,
  playThrow,
  startMusic,
  stopMusic,
} from '../audio/sounds';
import {
  AI_DIFFICULTIES,
  AI_NAME,
  AiDifficultyId,
  rollAiDice,
} from '../game/ai';
import { OBSTACLE_HINTS } from '../game/obstacles';
import { ColorDef, PRISONER_COLORS, PrisonerColorId } from '../game/colors';
import { TUNING } from '../game/tuning';
import { DiceScene, SceneControls } from './DiceScene';

/**
 * Classic mode vs one AI opponent.
 *
 * Round flow: pick screen -> "ARM YOUR DICE!" -> "BATTLE!" -> race. The
 * player rolls real physics dice (touch down = throw, flick = aimed throw);
 * the AI rolls fair virtual dice on a timer (difficulty = speed). First to
 * free all six prisoners wins. Tap after the result to rematch instantly.
 */

type Phase = 'pick' | 'arm' | 'go' | 'battle' | 'won' | 'lost';

export function DiceDemoScreen() {
  const [audioPrefs, setAudioPrefs] = useState<AudioSettings>(getAudioSettings());

  useEffect(() => {
    initSounds();
    initAnnouncer();
    loadAudioSettings().then(setAudioPrefs);
  }, []);

  const controlsRef = useRef<SceneControls | null>(null);
  const [phase, setPhase] = useState<Phase>('pick');
  const [difficulty, setDifficulty] = useState<AiDifficultyId>('easy');
  const [rolledFaces, setRolledFaces] = useState<ColorDef[] | null>(null);
  const [rolling, setRolling] = useState(false);
  const [freedOrder, setFreedOrder] = useState<PrisonerColorId[]>([]);
  const [aiFreed, setAiFreed] = useState<PrisonerColorId[]>([]);
  const [aiLastRoll, setAiLastRoll] = useState<[ColorDef, ColorDef] | null>(null);
  const [shakeSignal, setShakeSignal] = useState(0);
  const [callout, setCallout] = useState<{ key: number; text: string } | null>(null);
  const [aiFlash, setAiFlash] = useState(false);
  const [playerFlash, setPlayerFlash] = useState(false);

  // Refs mirroring state that gesture/timer callbacks need synchronously.
  const phaseRef = useRef<Phase>('pick');
  const freedRef = useRef<PrisonerColorId[]>([]);
  const aiFreedRef = useRef<PrisonerColorId[]>([]);
  const countdownTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const calloutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lastSplash = useRef(0);

  const setPhaseBoth = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  useEffect(() => {
    return () => {
      countdownTimers.current.forEach(clearTimeout);
      flashTimers.current.forEach(clearTimeout);
      if (calloutTimer.current) clearTimeout(calloutTimer.current);
      stopAnnouncer();
      stopMusic();
    };
  }, []);

  const resetRace = useCallback(() => {
    freedRef.current = [];
    aiFreedRef.current = [];
    setFreedOrder([]);
    setAiFreed([]);
    setRolledFaces(null);
    setAiLastRoll(null);
    setRolling(false);
  }, []);

  const showCallout = useCallback((text: string, cue?: VoiceCue | null) => {
    setCallout({ key: Date.now(), text });
    if (calloutTimer.current) clearTimeout(calloutTimer.current);
    calloutTimer.current = setTimeout(() => setCallout(null), 2300);
    if (cue) playCue(cue);
  }, []);

  const handleMoatSink = useCallback(() => {
    const now = Date.now();
    if (now - lastSplash.current < 2500 || phaseRef.current !== 'battle') return;
    lastSplash.current = now;
    showCallout('Splash! A die fell in the moat!');
  }, [showCallout]);

  const quitToMenu = useCallback(() => {
    countdownTimers.current.forEach(clearTimeout);
    stopAnnouncer();
    resetRace();
    setCallout(null);
    setPhaseBoth('pick');
  }, [resetRace, setPhaseBoth]);

  const startCountdown = useCallback(() => {
    resetRace();
    setCallout(null);
    setPhaseBoth('arm');
    playCue('ready');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    countdownTimers.current.forEach(clearTimeout);
    countdownTimers.current = [
      setTimeout(() => {
        setPhaseBoth('go');
        playCue('go');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        playThrow();
      }, 1100),
      setTimeout(() => {
        setPhaseBoth('battle');
      }, 1800),
    ];
  }, [resetRace, setPhaseBoth]);

  // Background music plays through the countdown and the race.
  useEffect(() => {
    if (phase === 'arm' || phase === 'go' || phase === 'battle') {
      startMusic();
    } else {
      stopMusic();
    }
  }, [phase, audioPrefs.music]);

  // The AI opponent: fair virtual rolls on a fixed cadence while battling.
  useEffect(() => {
    if (phase !== 'battle') return;
    const { rollIntervalMs } = AI_DIFFICULTIES[difficulty];
    const id = setInterval(() => {
      const roll = rollAiDice();
      setAiLastRoll(roll);
      const [a, b] = roll;
      if (a.id !== b.id || aiFreedRef.current.includes(a.id)) return;
      const next = [...aiFreedRef.current, a.id];
      aiFreedRef.current = next;
      setAiFreed(next);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setAiFlash(true);
      flashTimers.current.push(setTimeout(() => setAiFlash(false), 650));
      const m = next.length;
      const n = freedRef.current.length;
      if (m === PRISONER_COLORS.length) {
        setPhaseBoth('lost');
        showCallout('Oh no — Sir Rollsalot wins!', 'lose');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => {},
        );
      } else if (m === PRISONER_COLORS.length - 1) {
        showCallout('He needs only ONE more — hurry!', 'hurry');
      } else if (m === n && n > 0) {
        showCallout(`Sir Rollsalot ties it up ${m}–${n}!`, 'lookout');
      } else if (m === n + 1) {
        showCallout(`Sir Rollsalot freed ${a.label} — you're falling behind!`, 'lookout');
      } else {
        showCallout(`Sir Rollsalot freed ${a.label}!`, 'lookout');
      }
    }, rollIntervalMs);
    return () => clearInterval(id);
  }, [phase, difficulty, setPhaseBoth]);

  const handleThrow = useCallback(() => {
    setRolling(true);
    setRolledFaces(null);
  }, []);

  const handleSettled = useCallback(
    (faces: ColorDef[]) => {
      setRolling(false);
      setRolledFaces(faces);
      if (phaseRef.current !== 'battle') return;
      const isMatch = faces.length === 2 && faces[0].id === faces[1].id;
      if (!isMatch) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        return;
      }
      const color = faces[0].id;
      if (freedRef.current.includes(color)) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        return;
      }
      const next = [...freedRef.current, color];
      freedRef.current = next;
      setFreedOrder(next);
      setShakeSignal((s) => s + 1);
      setPlayerFlash(true);
      flashTimers.current.push(setTimeout(() => setPlayerFlash(false), 650));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
      const n = next.length;
      const m = aiFreedRef.current.length;
      if (n === PRISONER_COLORS.length) {
        setPhaseBoth('won');
        playFanfare();
        showCallout('Victory! All prisoners freed!', 'win');
      } else {
        playCheer();
        if (n === PRISONER_COLORS.length - 1) {
          showCallout(`${faces[0].label} rescued — one more to win!`, 'gogogo');
        } else if (n === m && m > 0) {
          showCallout(`${faces[0].label} rescued — you're tied ${n}–${m}!`, countCue(n));
        } else if (n === m + 1) {
          showCallout(`${faces[0].label} rescued — you take the lead!`, countCue(n));
        } else {
          showCallout(`${faces[0].label} rescued!`, countCue(n));
        }
      }
    },
    [setPhaseBoth, showCallout],
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Throw on touch-down so rapid tapping feels instant.
      onPanResponderGrant: () => {
        const current = phaseRef.current;
        if (current === 'pick') {
          startCountdown();
        } else if (current === 'battle') {
          controlsRef.current?.throwAll();
        } else if (current === 'won' || current === 'lost') {
          startCountdown();
        }
        // arm/go: inputs locked during the ritual.
      },
      // A fast release re-throws as a directional flick.
      onPanResponderRelease: (_event, gesture) => {
        if (phaseRef.current !== 'battle') return;
        const speed = Math.hypot(gesture.vx, gesture.vy);
        if (speed < TUNING.throw.flickThreshold) return;
        const scale = TUNING.throw.flickScale;
        const max = TUNING.throw.flickMaxSpeed;
        const clamp = (v: number) => Math.max(-max, Math.min(max, v));
        controlsRef.current?.throwAll({
          x: clamp(gesture.vx * scale),
          // Screen up (negative vy) throws away from the player (-z).
          z: clamp(gesture.vy * scale),
        });
      },
    }),
  ).current;

  const isMatch =
    rolledFaces !== null &&
    rolledFaces.length === 2 &&
    rolledFaces[0].id === rolledFaces[1].id;

  const difficultyRow = (
    <View style={styles.difficultyBlock}>
      <View style={styles.difficultyRow}>
      {Object.values(AI_DIFFICULTIES).map((d) => (
        <Pressable
          key={d.id}
          onPress={() => setDifficulty(d.id)}
          style={[
            styles.difficultyButton,
            difficulty === d.id && styles.difficultyButtonActive,
          ]}
        >
          <Text
            style={[
              styles.difficultyText,
              difficulty === d.id && styles.difficultyTextActive,
            ]}
          >
            {d.label}
          </Text>
        </Pressable>
      ))}
      </View>
      <Text style={styles.difficultyHint}>{OBSTACLE_HINTS[difficulty]}</Text>
      <View style={styles.audioRow}>
        {(
          [
            ['sfx', '🔊 Sound'],
            ['music', '🎵 Music'],
            ['voice', '🎙️ Announcer'],
          ] as const
        ).map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => setAudioPrefs({ ...setAudioSetting(key, !audioPrefs[key]) })}
            style={[styles.audioButton, !audioPrefs[key] && styles.audioButtonOff]}
          >
            <Text style={[styles.audioText, !audioPrefs[key] && styles.audioTextOff]}>
              {label} {audioPrefs[key] ? 'ON' : 'OFF'}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Canvas
        style={styles.canvas}
        camera={{ position: [0, 10.5, 5.6], fov: 46 }}
        onCreated={({ camera }) => {
          camera.lookAt(0, 0, -0.2);
        }}
      >
        <color attach="background" args={[ARENAS[CURRENT_ARENA].skyColor]} />
        <DiceScene
          key={difficulty}
          difficulty={difficulty}
          controlsRef={controlsRef}
          onThrow={handleThrow}
          onSettled={handleSettled}
          onMoatSink={handleMoatSink}
          freedOrder={freedOrder}
          shakeSignal={shakeSignal}
        />
      </Canvas>

      {/* Gesture layer (transparent, above the canvas). */}
      <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers} />

      {/* Title */}
      <View pointerEvents="none" style={styles.topBar}>
        <Text style={styles.title}>DICE BATTLES</Text>
      </View>

      {/* Scoreboard */}
      {(phase === 'battle' || phase === 'won' || phase === 'lost') && (
        <View pointerEvents="none" style={styles.scoreboard}>
          <View style={[styles.scoreSide, playerFlash && styles.scoreFlashYou]}>
            <Text style={styles.scoreLabel}>YOU</Text>
            <Text style={styles.scoreNumber}>{freedOrder.length}</Text>
          </View>
          <Text style={styles.scoreVs}>⚔️</Text>
          <View style={[styles.scoreSide, aiFlash && styles.scoreFlashAi]}>
            <Text style={styles.scoreNumber}>{aiFreed.length}</Text>
            <Text style={styles.scoreLabel}>SIR R.</Text>
          </View>
          <View style={styles.aiMeta}>
            <View style={styles.aiDots}>
              {PRISONER_COLORS.map((c) => (
                <View
                  key={c.id}
                  style={[
                    styles.aiDot,
                    { backgroundColor: c.hex },
                    !aiFreed.includes(c.id) && styles.aiDotPending,
                  ]}
                />
              ))}
            </View>
            {aiLastRoll && (
              <View style={styles.aiRoll}>
                {aiLastRoll.map((c, i) => (
                  <View
                    key={i}
                    style={[styles.aiRollSwatch, { backgroundColor: c.hex }]}
                  />
                ))}
              </View>
            )}
          </View>
        </View>
      )}

      {/* Restart (quit to menu) during a round */}
      {(phase === 'battle' || phase === 'arm' || phase === 'go') && (
        <Pressable style={styles.quitButton} onPress={quitToMenu}>
          <Text style={styles.quitText}>↺</Text>
        </Pressable>
      )}

      {/* Announcer callout banner */}
      {callout && (
        <View pointerEvents="none" style={styles.calloutWrap} key={callout.key}>
          <Text style={styles.calloutText}>{callout.text}</Text>
        </View>
      )}

      {/* Player status HUD at the bottom, in the thumb zone. */}
      {phase === 'battle' && (
        <View pointerEvents="none" style={styles.bottomHud}>
          <View style={styles.resultRow}>
            {rolledFaces ? (
              <>
                {rolledFaces.map((face, i) => (
                  <View
                    key={i}
                    style={[styles.swatch, { backgroundColor: face.hex }]}
                  />
                ))}
                <Text style={[styles.resultText, isMatch && styles.matchText]}>
                  {isMatch
                    ? `${rolledFaces[0].label.toUpperCase()} RESCUED!`
                    : `${rolledFaces[0].label} · ${rolledFaces[1].label}`}
                </Text>
              </>
            ) : (
              <Text style={styles.hint}>
                {rolling ? 'Rolling…' : 'Tap to roll · flick to throw'}
              </Text>
            )}
          </View>
          <Text style={styles.rescueCount}>
            {freedOrder.length} / {PRISONER_COLORS.length} RESCUED
          </Text>
        </View>
      )}

      {/* Pick / countdown / result overlays */}
      {phase === 'pick' && (
        <Pressable style={styles.overlay} onPress={startCountdown}>
          <Text style={styles.overlayTitle}>⚔️ DICE BATTLES</Text>
          <Text style={styles.overlayBody}>
            Race {AI_NAME} to free your six prisoners!{'\n'}Roll both dice the
            same color to rescue that prisoner.
          </Text>
          {difficultyRow}
          <Text style={styles.overlayPrompt}>Tap anywhere to arm your dice</Text>
        </Pressable>
      )}
      {phase === 'arm' && (
        <View pointerEvents="none" style={styles.overlayClear}>
          <Text style={styles.countdownText}>ARM YOUR DICE!</Text>
        </View>
      )}
      {phase === 'go' && (
        <View pointerEvents="none" style={styles.overlayClear}>
          <Text style={[styles.countdownText, styles.battleText]}>BATTLE!</Text>
        </View>
      )}
      {phase === 'won' && (
        <Pressable style={styles.overlay} onPress={startCountdown}>
          <Text style={styles.overlayTitle}>🏆 VICTORY!</Text>
          <Text style={styles.overlayBody}>
            All six prisoners rescued!{'\n'}
            {AI_NAME} only managed {aiFreed.length}.
          </Text>
          {difficultyRow}
          <Text style={styles.overlayPrompt}>Tap to battle again</Text>
        </Pressable>
      )}
      {phase === 'lost' && (
        <Pressable style={styles.overlay} onPress={startCountdown}>
          <Text style={styles.overlayTitle}>😤 DEFEAT!</Text>
          <Text style={styles.overlayBody}>
            {AI_NAME} freed all six prisoners first.{'\n'}You rescued{' '}
            {freedOrder.length} — avenge them!
          </Text>
          {difficultyRow}
          <Text style={styles.overlayPrompt}>Tap to battle again</Text>
        </Pressable>
      )}
    </View>
  );
}

const textShadow = {
  textShadowColor: 'rgba(20,20,40,0.55)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
} as const;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#8ec8f7',
  },
  canvas: {
    flex: 1,
  },
  topBar: {
    position: 'absolute',
    top: 58,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  title: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 5,
    ...textShadow,
  },
  scoreboard: {
    position: 'absolute',
    top: 80,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20,16,40,0.6)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 7,
    gap: 10,
  },
  scoreSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  scoreFlashYou: {
    backgroundColor: 'rgba(51,204,107,0.55)',
  },
  scoreFlashAi: {
    backgroundColor: 'rgba(204,37,51,0.6)',
  },
  scoreLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  scoreNumber: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
  },
  scoreVs: {
    fontSize: 16,
  },
  aiMeta: {
    alignItems: 'center',
    gap: 3,
    marginLeft: 2,
  },
  calloutWrap: {
    position: 'absolute',
    top: 150,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  calloutText: {
    color: '#ffe521',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: 'rgba(20,20,40,0.85)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 5,
  },
  audioRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  audioButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  audioButtonOff: {
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  audioText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  audioTextOff: {
    color: 'rgba(255,255,255,0.45)',
  },
  quitButton: {
    position: 'absolute',
    top: 52,
    left: 18,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(20,16,40,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quitText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    marginTop: -2,
  },
  aiDots: {
    flexDirection: 'row',
    gap: 3,
  },
  aiDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  aiDotPending: {
    opacity: 0.22,
  },
  aiRoll: {
    flexDirection: 'row',
    gap: 3,
  },
  aiRollSwatch: {
    width: 13,
    height: 13,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  bottomHud: {
    position: 'absolute',
    bottom: 34,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  rescueCount: {
    color: '#ffe521',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 6,
    ...textShadow,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 30,
  },
  swatch: {
    width: 24,
    height: 24,
    borderRadius: 6,
    marginHorizontal: 4,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  resultText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
    ...textShadow,
  },
  matchText: {
    color: '#ffe521',
    fontWeight: '900',
  },
  hint: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 15,
    fontWeight: '500',
    ...textShadow,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,12,40,0.6)',
    paddingHorizontal: 28,
  },
  overlayClear: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayTitle: {
    color: '#ffe521',
    fontSize: 34,
    fontWeight: '900',
    textAlign: 'center',
    ...textShadow,
  },
  overlayBody: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 23,
    ...textShadow,
  },
  overlayPrompt: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 26,
    ...textShadow,
  },
  countdownText: {
    color: '#ffffff',
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
    textShadowColor: 'rgba(20,20,40,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  battleText: {
    color: '#ffe521',
    fontSize: 52,
  },
  difficultyBlock: {
    alignItems: 'center',
    marginTop: 22,
  },
  difficultyRow: {
    flexDirection: 'row',
    gap: 10,
  },
  difficultyHint: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
    textAlign: 'center',
  },
  difficultyButton: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  difficultyButtonActive: {
    backgroundColor: '#ffe521',
    borderColor: '#ffe521',
  },
  difficultyText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  difficultyTextActive: {
    color: '#241c40',
  },
});
