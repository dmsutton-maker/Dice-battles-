import { Canvas } from '@react-three/fiber/native';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ARENAS, ArenaId } from '../arena/arenas';
import { playCue } from '../audio/announcer';
import { playCheer, playFanfare, playThrow, startMusic, stopMusic } from '../audio/sounds';
import { ColorDef, PRISONER_COLORS } from '../game/colors';
import { makeUnits, MODES, ModeId, PrisonerUnit } from '../game/modes';
import { PrisonerColorId } from '../game/colors';
import {
  applySplitMatch,
  scoreOf,
  SplitBoards,
  targetFor,
  Zone,
} from '../game/splitRules';
import { EMPTY_LAYOUT } from '../game/obstacles';
import {
  flickFromGesture,
  TouchSample,
  velocityFromSamples,
} from '../game/aim';
import { DiceScene, SceneControls } from './DiceScene';

/**
 * Same-device 2-player split screen — the original tabletop face-off.
 * Phone flat on the table between two players: the top zone is rotated
 * 180° to face player 2, each zone has its own physics world and dice,
 * and both players roll simultaneously. No trophies at stake — this is a
 * head-to-head grudge match.
 *
 * All four modes play here, not just Color Rush. The rules themselves live
 * in src/game/splitRules.ts so they can be tested without a renderer;
 * Skirmish is the interesting one — it is defined by a single shared jail,
 * so the two boards are kept in step as views of the same six prisoners.
 */

type Phase = 'ready' | 'arm' | 'go' | 'battle' | 'over';

interface TwoPlayerScreenProps {
  arenaId: ArenaId;
  dieBodyColor: string;
  mode: ModeId;
  /** Colourblind mode — shapes on the dice and the prisoners. */
  symbols: boolean;
  onExit: () => void;
}

interface ZoneViewProps {
  rotated: boolean;
  phase: Phase;
  /** true won, false lost, null a draw (Skirmish can end level). */
  won: boolean | null;
  score: number;
  oppScore: number;
  target: number;
  modeName: string;
  units: PrisonerUnit[];
  arenaId: ArenaId;
  dieBodyColor: string;
  symbols: boolean;
  controlsRef: React.MutableRefObject<SceneControls | null>;
  onThrow: () => void;
  onSettled: (faces: ColorDef[]) => void;
  phaseRef: React.MutableRefObject<Phase>;
  onRematch: () => void;
  onExitToMenu: () => void;
}

function ZoneView({
  rotated,
  phase,
  won,
  score,
  oppScore,
  target,
  modeName,
  units,
  arenaId,
  dieBodyColor,
  symbols,
  controlsRef,
  onThrow,
  onSettled,
  phaseRef,
  onRematch,
  onExitToMenu,
}: ZoneViewProps) {
  // See the note in src/game/aim.ts: PanResponder's own vx/vy averages the
  // whole gesture and collapses if the finger hesitates before lifting.
  const samples = useRef<TouchSample[]>([]);
  const sample = (event: GestureResponderEvent) => {
    const { pageX, pageY, timestamp } = event.nativeEvent;
    samples.current.push({ x: pageX, y: pageY, t: timestamp });
    if (samples.current.length > 12) samples.current.shift();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Neither zone may have its throw stolen mid-flick.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        // The throw waits for release so the flick carries the gesture.
        // 'over': the round-over buttons decide what happens next.
        samples.current = [];
        sample(event);
      },
      onPanResponderMove: sample,
      // Lifting the finger throws, carrying the flick.
      onPanResponderRelease: (event, gesture) => {
        sample(event);
        if (phaseRef.current !== 'battle') return;
        const velocity = velocityFromSamples(samples.current);
        controlsRef.current?.throwAll(
          flickFromGesture(gesture, { rotated, velocity }) ?? undefined,
        );
        samples.current = [];
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
          dieBodyColor={dieBodyColor}
          dieSymbols={symbols}
          showTreasure={false}
          throwsEnabled={phase === 'battle'}
        />
      </Canvas>
      <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers} />

      {/* Zone score strip */}
      <View pointerEvents="none" style={styles.zoneHud}>
        <Text style={styles.zoneScore}>
          {modeName} · {score} / {target}
          {oppScore > score ? '  — catch up!' : ''}
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
        <View style={styles.zoneOverlay}>
          <Text style={styles.zoneBig}>
            {won === null ? "🤝 IT'S A DRAW" : won ? '🏆 YOU WIN!' : '😤 DEFEAT'}
          </Text>
          {/* One set per zone, so each player has upright buttons. */}
          <View style={styles.endButtons}>
            <Pressable style={styles.playAgainButton} onPress={onRematch}>
              <Text style={styles.playAgainText}>▶ PLAY AGAIN</Text>
            </Pressable>
            <Pressable style={styles.homeButton} onPress={onExitToMenu}>
              <Text style={styles.homeText}>🏠 HOME</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

export function TwoPlayerScreen({
  arenaId,
  dieBodyColor,
  mode,
  symbols,
  onExit,
}: TwoPlayerScreenProps) {
  // Color War gives each player one colour to rescue. Fixed for the match
  // so both boards agree on whose is whose.
  const zoneColors = useRef<[PrisonerColorId, PrisonerColorId]>([
    PRISONER_COLORS[0].id,
    PRISONER_COLORS[1].id,
  ]).current;
  const buildBoards = useCallback((): SplitBoards => {
    if (mode === 'colorwar') {
      const [one, two] = zoneColors.map(
        (id) => PRISONER_COLORS.find((c) => c.id === id)!,
      );
      return {
        a: makeUnits('colorwar', PRISONER_COLORS, one, two),
        b: makeUnits('colorwar', PRISONER_COLORS, two, one),
      };
    }
    return {
      a: makeUnits(mode, PRISONER_COLORS, null, null),
      b: makeUnits(mode, PRISONER_COLORS, null, null),
    };
  }, [mode, zoneColors]);
  const [phase, setPhase] = useState<Phase>('ready');
  const phaseRef = useRef<Phase>('ready');
  const [winner, setWinner] = useState<0 | 1 | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [unitsA, setUnitsA] = useState<PrisonerUnit[]>(
    () => buildBoards().a,
  );
  const [unitsB, setUnitsB] = useState<PrisonerUnit[]>(
    () => buildBoards().b,
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
    const fresh = buildBoards();
    unitsRefA.current = fresh.a;
    unitsRefB.current = fresh.b;
    setUnitsA(fresh.a);
    setUnitsB(fresh.b);
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
  }, [setPhaseBoth, buildBoards]);

  const makeSettleHandler = useCallback(
    (zone: Zone) => (faces: ColorDef[]) => {
      if (phaseRef.current !== 'battle') return;
      if (faces.length !== 2 || faces[0].id !== faces[1].id) return;

      const outcome = applySplitMatch(
        mode,
        { a: unitsRefA.current, b: unitsRefB.current },
        zone,
        faces[0].id,
        zoneColors,
      );
      if (outcome.effect === 'none') return;

      unitsRefA.current = outcome.boards.a;
      unitsRefB.current = outcome.boards.b;
      setUnitsA(outcome.boards.a);
      setUnitsB(outcome.boards.b);

      if (outcome.effect === 'returned') {
        // Ultimate: that one went backwards. A cheer would be a lie.
        playCue('wrong');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
          () => {},
        );
      } else {
        playCheer();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => {},
        );
      }

      // Skirmish ends when the shared jail empties, which can finish on a
      // draw — the other modes only ever end on someone reaching the target.
      const jailEmpty =
        mode === 'skirmish' &&
        outcome.boards.a.every((u) => u.station.kind !== 'jail');

      if (outcome.winner !== null || jailEmpty) {
        setWinner(outcome.winner);
        setPhaseBoth('over');
        playFanfare();
        if (outcome.winner !== null) playCue('win');
        else playCue('tie');
      }
    },
    [setPhaseBoth, mode, zoneColors],
  );

  const settledA = useRef(makeSettleHandler(0)).current;
  const settledB = useRef(makeSettleHandler(1)).current;
  const noop = useCallback(() => {}, []);

  const scoreA = scoreOf(unitsA);
  const scoreB = scoreOf(unitsB);

  return (
    <View style={styles.container}>
      {/* Player 2 zone (top, rotated to face them) */}
      <ZoneView
        rotated
        phase={phase}
        won={winner === null ? null : winner === 1}
        score={scoreB}
        oppScore={scoreA}
        target={targetFor(mode)}
        modeName={MODES[mode].name}
        units={unitsB}
        arenaId={arenaId}
        dieBodyColor={dieBodyColor}
        symbols={symbols}
        controlsRef={controlsB}
        onThrow={noop}
        onSettled={settledB}
        phaseRef={phaseRef}
        onRematch={startMatch}
        onExitToMenu={onExit}
      />
      <View style={styles.divider} />
      {/* Player 1 zone (bottom) */}
      <ZoneView
        rotated={false}
        phase={phase}
        won={winner === null ? null : winner === 0}
        score={scoreA}
        oppScore={scoreB}
        target={targetFor(mode)}
        modeName={MODES[mode].name}
        units={unitsA}
        arenaId={arenaId}
        dieBodyColor={dieBodyColor}
        symbols={symbols}
        controlsRef={controlsA}
        onThrow={noop}
        onSettled={settledA}
        phaseRef={phaseRef}
        onRematch={startMatch}
        onExitToMenu={onExit}
      />

      {/* Center controls: exit always available, start prompt when ready */}
      <Pressable style={styles.exitButton} onPress={onExit}>
        <Text style={styles.exitText}>✕</Text>
      </Pressable>
      {phase === 'ready' && (
        <Pressable style={styles.readyOverlay} onPress={startMatch}>
          <View style={styles.readyCardFlipped}>
            <Text style={styles.readyTitle}>⚔️ split screen</Text>
            <Text style={styles.readyBody}>This side is yours, Player 2!</Text>
          </View>
          <Text style={styles.readyPrompt}>
            Lay the phone flat between you.{'\n'}Tap anywhere to battle!
          </Text>
          <View style={styles.readyCard}>
            <Text style={styles.readyTitle}>⚔️ split screen</Text>
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
  endButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    alignItems: 'center',
  },
  playAgainButton: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 20,
    backgroundColor: '#ffe521',
  },
  playAgainText: {
    color: '#241c40',
    fontSize: 14,
    fontWeight: '900',
  },
  homeButton: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  homeText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
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
