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
import { AI_DIFFICULTIES, AiDifficultyId } from '../game/ai';
import { PrisonerColorId } from '../game/colors';
import {
  applySplitMatch,
  scoreOf,
  SplitBoards,
  targetFor,
  Zone,
} from '../game/splitRules';
import { generateObstacleLayout, ObstacleLayout } from '../game/obstacles';
import {
  flickFromGesture,
  TouchSample,
  velocityFromSamples,
} from '../game/aim';
import { DiceScene, SceneControls } from './DiceScene';
import { useAppActive } from '../game/useAppActive';
import { SHAPE, THEME } from '../ui/theme';

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
  /**
   * The difficulty chosen on the start screen, carried in the same way the
   * mode is. Against the AI, difficulty is the obstacles in the courtyard
   * rather than how the opponent plays (see src/game/obstacles.ts) — which
   * is exactly why it transfers to a human opponent unchanged. Split screen
   * used to hard-code an empty courtyard, so picking Hard and then handing
   * the phone over quietly dropped you back to Easy.
   */
  difficulty: AiDifficultyId;
  /** Colourblind mode — shapes on the dice and the prisoners. */
  symbols: boolean;
  onExit: () => void;
}

interface ZoneViewProps {
  rotated: boolean;
  phase: Phase;
  /** False while the phone is not showing the game — see useAppActive. */
  appActive: boolean;
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
  /** Shared with the other zone — see the note where it is generated. */
  layout: ObstacleLayout;
  /** Bumped each match so the physics world rebuilds around new obstacles. */
  matchKey: number;
  difficultyName: string;
  /**
   * Color War only: the one colour THIS half of the phone is rescuing.
   * Without it neither player was ever told which colour was theirs —
   * the only cue was where their three prisoners happened to sit.
   */
  myColor?: ColorDef;
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
  appActive,
  won,
  score,
  oppScore,
  target,
  modeName,
  units,
  arenaId,
  dieBodyColor,
  symbols,
  layout,
  matchKey,
  difficultyName,
  myColor,
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
        /*
          TWO canvases are on screen here, one per player, and until now
          both ran flat out the whole time the split screen was open —
          including behind the solid "lay the phone flat" card before a
          match starts and behind the result card after it ends, when
          nobody can see either board.

          Single player has stopped its board outside a round since the
          overlays went solid; this is the same rule, applied where it
          costs twice as much. Two phones' worth of GPU, on the one
          screen most likely to be left face-up on a table between two
          people.
        */
        frameloop={
          appActive && (phase === 'arm' || phase === 'go' || phase === 'battle')
            ? 'always'
            : 'never'
        }
        camera={{ position: [0, 10.5, 5.6], fov: 46 }}
        onCreated={({ camera }) => {
          camera.lookAt(0, 0, -0.2);
        }}
      >
        <color attach="background" args={[ARENAS[arenaId].skyColor]} />
        <DiceScene
          /*
            Keyed on the match: DiceScene builds its physics world once per
            mount, so without a fresh key a rematch would draw the new hill
            and pond while the dice still collided with the old ones.
          */
          key={matchKey}
          controlsRef={controlsRef}
          onThrow={onThrow}
          onSettled={onSettled}
          units={units}
          shakeSignal={0}
          layout={layout}
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
        {myColor && (
          <View style={[styles.mySwatch, { backgroundColor: myColor.hex }]} />
        )}
        <Text style={styles.zoneScore}>
          {myColor ? `Rescue ${myColor.label}` : modeName} · {difficultyName} ·{' '}
          {score} / {target}
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
            {won === null ? "It's a draw" : won ? 'You win!' : 'Defeat'}
          </Text>
          {/* One set per zone, so each player has upright buttons. */}
          <View style={styles.endButtons}>
            <Pressable style={styles.playAgainButton} onPress={onRematch}>
              <Text style={styles.playAgainText}>Play again</Text>
            </Pressable>
            <Pressable style={styles.homeButton} onPress={onExitToMenu}>
              <Text style={styles.homeText}>Home</Text>
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
  difficulty,
  symbols,
  onExit,
}: TwoPlayerScreenProps) {
  // Both boards stop drawing when the phone is not showing the game.
  const appActive = useAppActive();
  // Color War gives each player one colour to rescue. Fixed for the match
  // so both boards agree on whose is whose.
  const zoneColors = useRef<[PrisonerColorId, PrisonerColorId]>([
    PRISONER_COLORS[0].id,
    PRISONER_COLORS[1].id,
  ]).current;
  /*
    Only Color War hands a player a colour of their own; in every other
    mode both halves are chasing the same six, so a swatch would be a
    lie. zoneColors[0] is the bottom half (Player 1) — the same order
    buildBoards uses below.
  */
  const myColorA =
    mode === 'colorwar'
      ? PRISONER_COLORS.find((c) => c.id === zoneColors[0])
      : undefined;
  const myColorB =
    mode === 'colorwar'
      ? PRISONER_COLORS.find((c) => c.id === zoneColors[1])
      : undefined;

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
  // The obstacles both players roll on. Rolled fresh at the start of each
  // match, and matchKey rebuilds each zone's physics world around them.
  const [layout, setLayout] = useState(() => generateObstacleLayout(difficulty));
  const [matchKey, setMatchKey] = useState(0);
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
    /*
      ONE layout for both zones. generateObstacleLayout rolls fresh random
      positions each call, so generating per zone would put the hill in a
      different place for each player — and on Hard, the pond too. In a
      head-to-head on one table that is not variety, it is one player
      getting the easier courtyard, and they would be right to complain.
    */
    setLayout(generateObstacleLayout(difficulty));
    setMatchKey((n) => n + 1);
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
  }, [setPhaseBoth, buildBoards, difficulty]);

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
      if (outcome.effect === 'none') {
        /*
          In Color War a matched pair that is not YOUR colour used to do
          nothing at all — no sound, no buzz, no words. Two identical
          faces landing to complete silence reads as a broken game, not
          as "wrong colour", so say so the way Ultimate already does.
        */
        if (mode === 'colorwar') {
          playCue('wrong');
          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Warning,
          ).catch(() => {});
        }
        return;
      }

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
        appActive={appActive}
        won={winner === null ? null : winner === 1}
        score={scoreB}
        oppScore={scoreA}
        target={targetFor(mode)}
        modeName={MODES[mode].name}
        units={unitsB}
        arenaId={arenaId}
        dieBodyColor={dieBodyColor}
        symbols={symbols}
        layout={layout}
        matchKey={matchKey}
        difficultyName={AI_DIFFICULTIES[difficulty].label}
        myColor={myColorB}
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
        appActive={appActive}
        won={winner === null ? null : winner === 0}
        score={scoreA}
        oppScore={scoreB}
        target={targetFor(mode)}
        modeName={MODES[mode].name}
        units={unitsA}
        arenaId={arenaId}
        dieBodyColor={dieBodyColor}
        symbols={symbols}
        layout={layout}
        matchKey={matchKey}
        difficultyName={AI_DIFFICULTIES[difficulty].label}
        myColor={myColorA}
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
            <Text style={styles.readyTitle}>Split screen</Text>
            <Text style={styles.readyBody}>This side is yours, Player 2!</Text>
          </View>
          <Text style={styles.readyPrompt}>
            Lay the phone flat between you.{'\n'}Tap anywhere to battle!
          </Text>
          <View style={styles.readyCard}>
            <Text style={styles.readyTitle}>Split screen</Text>
            <Text style={styles.readyBody}>
              {MODES[mode].rules}{'\n'}Tap fast. No mercy.
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
    backgroundColor: THEME.ink,
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
  // The table's centre line: ink, like every other line in the game.
  divider: {
    height: 3,
    backgroundColor: THEME.ink,
  },
  zoneHud: {
    position: 'absolute',
    top: 10,
    right: 14,
    backgroundColor: THEME.surface,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
    borderRadius: SHAPE.radiusSm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mySwatch: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
  },
  zoneScore: {
    color: THEME.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  zoneOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(253,246,236,0.85)',
  },
  zoneBig: {
    color: THEME.ink,
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
  },
  zoneSmall: {
    color: THEME.inkSoft,
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
    borderRadius: SHAPE.radiusLg,
    backgroundColor: THEME.accent,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
  },
  playAgainText: {
    color: THEME.onAccent,
    fontSize: 14,
    fontWeight: '900',
  },
  homeButton: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: SHAPE.radiusLg,
    backgroundColor: THEME.surface,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
  },
  homeText: {
    color: THEME.ink,
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
    backgroundColor: THEME.surface,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitText: {
    color: THEME.ink,
    fontSize: 17,
    fontWeight: '800',
  },
  readyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(253,246,236,0.92)',
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
    color: THEME.ink,
    fontSize: 26,
    fontWeight: '900',
  },
  readyBody: {
    color: THEME.inkSoft,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 21,
  },
  readyPrompt: {
    color: THEME.inkSoft,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});
