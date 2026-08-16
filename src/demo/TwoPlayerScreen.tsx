import { Canvas } from '@react-three/fiber/native';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { ARENAS, ArenaId } from '../arena/arenas';
import { playCue } from '../audio/announcer';
import { playCheer, playFanfare, playThrow, startMusic, stopMusic } from '../audio/sounds';
import { ColorDef, PRISONER_COLORS } from '../game/colors';
import { makeUnits, PrisonerUnit } from '../game/modes';
import { EMPTY_LAYOUT } from '../game/obstacles';
import { TUNING } from '../game/tuning';
import { DiceScene, SceneControls } from './DiceScene';

/**
 * Same-device 2-player split screen — the original tabletop face-off.
 * Phone flat on the table between two players: the top zone is rotated
 * 180° to face player 2, each zone has its own physics world and dice,
 * and both players roll simultaneously. Classic rules, first to six.
 * No trophies at stake — this is a head-to-head grudge match.
 */

type Phase = 'ready' | 'arm' | 'go' | 'battle' | 'over';

interface TwoPlayerScreenProps {
  arenaId: ArenaId;
  goldenDice: boolean;
  onExit: () => void;
}

interface ZoneViewProps {
  rotated: boolean;
  phase: Phase;
  won: boolean | null;
  score: number;
  oppScore: number;
  units: PrisonerUnit[];
  arenaId: ArenaId;
  goldenDice: boolean;
  controlsRef: React.MutableRefObject<SceneControls | null>;
  onThrow: () => void;
  onSettled: (faces: ColorDef[]) => void;
  phaseRef: React.MutableRefObject<Phase>;
  onRematch: () => void;
}

function ZoneView({
  rotated,
  phase,
  won,
  score,
  oppScore,
  units,
  arenaId,
  goldenDice,
  controlsRef,
  onThrow,
  onSettled,
  phaseRef,
  onRematch,
}: ZoneViewProps) {
  /** Did this gesture's touch-down actually launch a roll? */
  const threwOnTouchDown = useRef(false);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        threwOnTouchDown.current = false;
        if (phaseRef.current === 'battle') {
          threwOnTouchDown.current =
            controlsRef.current?.throwAll() === 'launched';
        } else if (phaseRef.current === 'over') {
          onRematch();
        }
      },
      // A swipe that already threw on touch-down must not throw again; the
      // flick only aims a throw still queued behind a roll in progress.
      onPanResponderRelease: (_event, gesture) => {
        if (phaseRef.current !== 'battle') return;
        if (threwOnTouchDown.current) return;
        const speed = Math.hypot(gesture.vx, gesture.vy);
        if (speed < TUNING.throw.flickThreshold) return;
        const scale = TUNING.throw.flickScale;
        const max = TUNING.throw.flickMaxSpeed;
        const clamp = (v: number) => Math.max(-max, Math.min(max, v));
        // Screen-space gesture velocity: flip for the rotated zone so a
        // flick "away from me" always throws into the castle.
        const sign = rotated ? -1 : 1;
        controlsRef.current?.throwAll({
          x: clamp(gesture.vx * scale * sign),
          z: clamp(gesture.vy * scale * sign),
        });
      },
    }),
  ).current;

  return (
    <View style={[styles.zone, rotated && styles.rotated]}>
      <Canvas
        style={styles.canvas}
        camera={{ position: [0, 10.5, 5.6], fov: 46 }}
        onCreated={({ camera }) => {
          camera.lookAt(0, 0, -0.2);
        }}
      >
        <color attach="background" args={[ARENAS[arenaId].skyColor]} />
        <DiceScene
          controlsRef={controlsRef}
          onThrow={onThrow}
          onSettled={onSettled}
          units={units}
          shakeSignal={0}
          layout={EMPTY_LAYOUT}
          arenaId={arenaId}
          goldenDice={goldenDice}
          showTreasure={false}
          throwsEnabled={phase === 'battle'}
        />
      </Canvas>
      <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers} />

      {/* Zone score strip */}
      <View pointerEvents="none" style={styles.zoneHud}>
        <Text style={styles.zoneScore}>
          {score} / 6{oppScore > score ? '  — catch up!' : ''}
        </Text>
      </View>

      {/* Countdown + result, rendered per zone so both players can read it */}
      {(phase === 'arm' || phase === 'go') && (
        <View pointerEvents="none" style={styles.zoneOverlay}>
          <Text style={styles.zoneBig}>
            {phase === 'arm' ? 'ARM YOUR DICE!' : 'BATTLE!'}
          </Text>
        </View>
      )}
      {phase === 'over' && (
        <View pointerEvents="none" style={styles.zoneOverlay}>
          <Text style={styles.zoneBig}>
            {won ? '🏆 YOU WIN!' : '😤 DEFEAT'}
          </Text>
          <Text style={styles.zoneSmall}>Tap to battle again</Text>
        </View>
      )}
    </View>
  );
}

export function TwoPlayerScreen({ arenaId, goldenDice, onExit }: TwoPlayerScreenProps) {
  const [phase, setPhase] = useState<Phase>('ready');
  const phaseRef = useRef<Phase>('ready');
  const [winner, setWinner] = useState<0 | 1 | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [unitsA, setUnitsA] = useState<PrisonerUnit[]>(() =>
    makeUnits('classic', PRISONER_COLORS, null, null),
  );
  const [unitsB, setUnitsB] = useState<PrisonerUnit[]>(() =>
    makeUnits('classic', PRISONER_COLORS, null, null),
  );
  const unitsRefA = useRef<PrisonerUnit[]>([]);
  const unitsRefB = useRef<PrisonerUnit[]>([]);
  const controlsA = useRef<SceneControls | null>(null);
  const controlsB = useRef<SceneControls | null>(null);

  const setPhaseBoth = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout);
      stopMusic();
    };
  }, []);

  useEffect(() => {
    if (phase === 'arm' || phase === 'go' || phase === 'battle') {
      startMusic();
    } else {
      stopMusic();
    }
  }, [phase]);

  const startMatch = useCallback(() => {
    const freshA = makeUnits('classic', PRISONER_COLORS, null, null);
    const freshB = makeUnits('classic', PRISONER_COLORS, null, null);
    unitsRefA.current = freshA;
    unitsRefB.current = freshB;
    setUnitsA(freshA);
    setUnitsB(freshB);
    setWinner(null);
    setPhaseBoth('arm');
    playCue('ready');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    timers.current.forEach(clearTimeout);
    timers.current = [
      setTimeout(() => {
        setPhaseBoth('go');
        playCue('go');
        playThrow();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      }, 1100),
      setTimeout(() => setPhaseBoth('battle'), 1800),
    ];
  }, [setPhaseBoth]);

  const makeSettleHandler = useCallback(
    (zone: 0 | 1) => (faces: ColorDef[]) => {
      if (phaseRef.current !== 'battle') return;
      if (faces.length !== 2 || faces[0].id !== faces[1].id) return;
      const unitsRef = zone === 0 ? unitsRefA : unitsRefB;
      const setUnitsState = zone === 0 ? setUnitsA : setUnitsB;
      const jailUnit = unitsRef.current.find(
        (u) => u.colorId === faces[0].id && u.station.kind === 'jail',
      );
      if (!jailUnit) return;
      const rescued = unitsRef.current.filter(
        (u) => u.station.kind === 'retreat',
      ).length;
      const next = unitsRef.current.map((u) =>
        u.key === jailUnit.key
          ? { ...u, station: { kind: 'retreat' as const, index: rescued } }
          : u,
      );
      unitsRef.current = next;
      setUnitsState(next);
      playCheer();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
      if (rescued + 1 === PRISONER_COLORS.length) {
        setWinner(zone);
        setPhaseBoth('over');
        playFanfare();
        playCue('win');
      }
    },
    [setPhaseBoth],
  );

  const settledA = useRef(makeSettleHandler(0)).current;
  const settledB = useRef(makeSettleHandler(1)).current;
  const noop = useCallback(() => {}, []);

  const scoreA = unitsA.filter((u) => u.station.kind === 'retreat').length;
  const scoreB = unitsB.filter((u) => u.station.kind === 'retreat').length;

  return (
    <View style={styles.container}>
      {/* Player 2 zone (top, rotated to face them) */}
      <ZoneView
        rotated
        phase={phase}
        won={winner === null ? null : winner === 1}
        score={scoreB}
        oppScore={scoreA}
        units={unitsB}
        arenaId={arenaId}
        goldenDice={goldenDice}
        controlsRef={controlsB}
        onThrow={noop}
        onSettled={settledB}
        phaseRef={phaseRef}
        onRematch={startMatch}
      />
      <View style={styles.divider} />
      {/* Player 1 zone (bottom) */}
      <ZoneView
        rotated={false}
        phase={phase}
        won={winner === null ? null : winner === 0}
        score={scoreA}
        oppScore={scoreB}
        units={unitsA}
        arenaId={arenaId}
        goldenDice={goldenDice}
        controlsRef={controlsA}
        onThrow={noop}
        onSettled={settledA}
        phaseRef={phaseRef}
        onRematch={startMatch}
      />

      {/* Center controls: exit always available, start prompt when ready */}
      <Pressable style={styles.exitButton} onPress={onExit}>
        <Text style={styles.exitText}>✕</Text>
      </Pressable>
      {phase === 'ready' && (
        <Pressable style={styles.readyOverlay} onPress={startMatch}>
          <View style={styles.readyCardFlipped}>
            <Text style={styles.readyTitle}>⚔️ PASS & PLAY</Text>
            <Text style={styles.readyBody}>This side is yours, Player 2!</Text>
          </View>
          <Text style={styles.readyPrompt}>
            Lay the phone flat between you.{'\n'}Tap anywhere to battle!
          </Text>
          <View style={styles.readyCard}>
            <Text style={styles.readyTitle}>⚔️ PASS & PLAY</Text>
            <Text style={styles.readyBody}>
              First to rescue all six prisoners wins.{'\n'}Tap fast. No mercy.
            </Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#241c40',
  },
  zone: {
    flex: 1,
    overflow: 'hidden',
  },
  rotated: {
    transform: [{ rotate: '180deg' }],
  },
  canvas: {
    flex: 1,
  },
  divider: {
    height: 3,
    backgroundColor: '#ffe521',
  },
  zoneHud: {
    position: 'absolute',
    top: 10,
    right: 14,
    backgroundColor: 'rgba(20,16,40,0.55)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  zoneScore: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  zoneOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,12,40,0.35)',
  },
  zoneBig: {
    color: '#ffe521',
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: 'rgba(20,20,40,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 5,
  },
  zoneSmall: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
  },
  exitButton: {
    position: 'absolute',
    top: '50%',
    left: 10,
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(20,16,40,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
  },
  readyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,12,40,0.72)',
    justifyContent: 'space-between',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  readyCard: {
    alignItems: 'center',
  },
  readyCardFlipped: {
    alignItems: 'center',
    transform: [{ rotate: '180deg' }],
  },
  readyTitle: {
    color: '#ffe521',
    fontSize: 26,
    fontWeight: '900',
  },
  readyBody: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 21,
  },
  readyPrompt: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});
