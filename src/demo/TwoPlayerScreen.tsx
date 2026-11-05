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
import { obstacleLook } from '../arena/obstacleLooks';
import { FLIGHT_SECONDS } from '../game/flight';
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
import {
  clockLeft,
  newClock,
  pauseClock,
  runClock,
  timeUpOutcome,
  type ClockState,
} from '../game/battleTimer';
import { BattleClock } from './BattleClock';
import { MIN_TAP, SHAPE, THEME } from '../ui/theme';
import type { WebGLRenderer } from 'three';
import { BoardShot, captureBoard } from '../share/boardShot';
import { composeWinCard } from '../share/composeCard';
import { cardLines, CardLines, ShareResult } from '../share/shareCard';
import { shareCardFile } from '../share/shareWin';
import { discardShareFiles } from '../share/tempFiles';
import { ShareSheetState, ShareWinSheet } from './ShareWinSheet';

/**
 * Share your win, for the half of the phone that won (Marc, 5 Nov
 * 2026). Handed to the winning zone only, so the loser's half has no
 * button and no sheet. The sheet is drawn inside the zone, so it is
 * the right way up for whoever won.
 */
interface ZoneShare {
  sheet: ShareSheetState | null;
  lines: CardLines;
  open: () => void;
  shareNow: () => void;
  close: () => void;
}

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
  /** true won, false lost, null a draw (Skirmish, or level when time ran out). */
  won: boolean | null;
  /** Milliseconds left on the battle clock — see battleTimer.ts. */
  readClock: () => number;
  /** The clock ran out, rather than somebody finishing. */
  endedOnTime: boolean;
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
  /** This zone's board renderer, for the picture of a win. */
  rendererRef: React.MutableRefObject<WebGLRenderer | null>;
  /** Only the winner gets one, and only once the board's picture is in hand. */
  share: ZoneShare | null;
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
  readClock,
  endedOnTime,
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
  rendererRef,
  share,
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

  /*
    When this board needs drawing between the phase changes. The same
    two things the main screen watches (DiceDemoScreen: `rolling` and
    `boardBusy`), kept per zone because each player's dice fly on their
    own clock.

    `rolling` is the dice: set by the scene's throw callback, cleared by
    its settle callback. `boardBusy` is the prisoners, whose leaps take
    FLIGHT_SECONDS after a settle changes `units`; like the main
    screen's it is a TIMER, so the worst case is a second of spare
    drawing rather than a board frozen mid-leap.
  */
  const [rolling, setRolling] = useState(false);
  const [boardBusy, setBoardBusy] = useState(false);
  const busyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markBoardBusy = useCallback(() => {
    setBoardBusy(true);
    if (busyTimer.current) clearTimeout(busyTimer.current);
    busyTimer.current = setTimeout(
      () => setBoardBusy(false),
      FLIGHT_SECONDS * 1000 + 400,
    );
  }, []);
  useEffect(
    () => () => {
      if (busyTimer.current) clearTimeout(busyTimer.current);
    },
    [],
  );
  // Any change to the prisoners is a leap on this board, whichever zone's
  // dice caused it (Skirmish shares one jail between both).
  useEffect(() => {
    markBoardBusy();
  }, [units, markBoardBusy]);
  // A fresh match rebuilds the dice, so a roll left unfinished by the
  // last one (the loser's dice stop mid-air) must not keep this awake.
  useEffect(() => {
    setRolling(false);
  }, [matchKey]);
  const handleThrow = useCallback(() => {
    markBoardBusy();
    setRolling(true);
    onThrow();
  }, [markBoardBusy, onThrow]);
  const handleSettled = useCallback(
    (faces: ColorDef[]) => {
      setRolling(false);
      // A settle can be followed by a die fished out of the pond.
      markBoardBusy();
      onSettled(faces);
    },
    [markBoardBusy, onSettled],
  );
  // Every board keeps its idle life moving during a battle; see the same
  // rule in DiceDemoScreen.
  const waterIdle = appActive && phase === 'battle';

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

          Inside the battle it is the single-player rule too: draw while
          this board's dice are in the air or a prisoner is mid-leap, and
          otherwise let it rest — a battle is mostly two people deciding
          when to flick. Water still ripples between rolls, at the slow
          'demand' rate (see WaterClock), as it does on the main screen.
        */
        frameloop={
          appActive &&
          (phase === 'arm' ||
            phase === 'go' ||
            (phase === 'battle' && (rolling || boardBusy)))
            ? 'always'
            : waterIdle
              ? 'demand'
              : 'never'
        }
        camera={{ position: [0, 10.5, 5.6], fov: 46 }}
        onCreated={({ camera, gl }) => {
          camera.lookAt(0, 0, -0.2);
          rendererRef.current = gl;
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
          onThrow={handleThrow}
          onSettled={handleSettled}
          units={units}
          shakeSignal={0}
          layout={layout}
          arenaId={arenaId}
          dieBodyColor={dieBodyColor}
          dieSymbols={symbols}
          waterIdle={waterIdle}
        />
      </Canvas>
      <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers} />

      {/* Zone score strip */}
      <View pointerEvents="none" style={styles.zoneHud}>
        {/*
          The battle clock, one per half so each player reads it the
          right way up. Only the bottom one ticks in the last ten
          seconds: two clicks a second from one phone sounds like a fault.
        */}
        {phase === 'battle' && <BattleClock read={readClock} ticks={!rotated} />}
        {myColor && (
          <View style={[styles.mySwatch, { backgroundColor: myColor.hex }]} />
        )}
        {/*
          During the battle the clock takes the difficulty's place in the
          strip: with both, the longest strip ran into the exit button.
          The difficulty is back the moment the battle ends.
        */}
        <Text style={styles.zoneScore}>
          {myColor ? `Rescue ${myColor.label}` : modeName} ·{' '}
          {phase === 'battle' ? '' : `${difficultyName} · `}
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
          {endedOnTime && <Text style={styles.zoneTimeUp}>Time's up!</Text>}
          <Text style={styles.zoneBig}>
            {won === null ? "It's a draw" : won ? 'You win!' : 'Defeat'}
          </Text>
          {/* One set per zone, so each player has upright buttons. */}
          <View style={styles.endButtons}>
            <Pressable style={styles.playAgainButton} onPress={onRematch}>
              <Text style={styles.playAgainText}>Play again</Text>
            </Pressable>
            {/* The winner's half only: `share` is null for the other. */}
            {won === true && share && (
              <Pressable
                style={styles.shareWinButton}
                onPress={share.open}
                accessibilityRole="button"
                accessibilityLabel="Share your win"
                accessibilityHint="Makes a picture of the winning board to share"
              >
                <Text style={styles.shareWinText}>Share your win</Text>
              </Pressable>
            )}
            <Pressable style={styles.homeButton} onPress={onExitToMenu}>
              <Text style={styles.homeText}>Home</Text>
            </Pressable>
          </View>
        </View>
      )}
      {won === true && share?.sheet && (
        <ShareWinSheet
          state={share.sheet}
          lines={share.lines}
          // Half a phone: the preview has to fit in the zone.
          pictureHeight={190}
          onShare={share.shareNow}
          onClose={share.close}
        />
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
  /*
    The same two-and-a-half-minute clock as a battle against the
    computer (battleTimer.ts) — David, 1 Nov 2026: "if the game doesn't
    finish by then it is a tie if the score is tied, or a win for
    whoever is winning at that moment." Both players are at this one
    phone, so it stops with the phone: when the game leaves the screen
    both boards freeze, and neither player can roll, so nor does the
    clock run.
  */
  const clockRef = useRef<ClockState>(newClock());
  const readClock = useCallback(() => clockLeft(clockRef.current, Date.now()), []);
  const [endedOnTime, setEndedOnTime] = useState(false);

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
  const rendererA = useRef<WebGLRenderer | null>(null);
  const rendererB = useRef<WebGLRenderer | null>(null);

  const setPhaseBoth = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  /*
    SHARE YOUR WIN, as on the main screen (DiceDemoScreen): the winning
    board is photographed the moment the match is decided, from the
    winner's own Canvas, and the card is made when the sheet opens. A
    draw takes no picture. No trophies here, ever — split screen pays
    none — so the card says none.
  */
  const [winShot, setWinShot] = useState<BoardShot | null>(null);
  const [shareSheet, setShareSheet] = useState<ShareSheetState | null>(null);
  const cardUriRef = useRef<string | null>(null);
  const forgetWinShot = useCallback(() => {
    setWinShot(null);
    setShareSheet(null);
    cardUriRef.current = null;
    discardShareFiles();
  }, []);
  const decided = useCallback(
    (winner: 0 | 1 | null) => {
      setWinner(winner);
      setPhaseBoth('over');
      if (winner === null) return;
      const renderer = winner === 0 ? rendererA.current : rendererB.current;
      void captureBoard(renderer).then((shot) => {
        if (shot && phaseRef.current === 'over') setWinShot(shot);
      });
    },
    [setPhaseBoth],
  );

  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout);
      stopMusic();
      discardShareFiles();
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
    forgetWinShot();
    setEndedOnTime(false);
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
      setTimeout(() => {
        clockRef.current = newClock();
        setPhaseBoth('battle');
      }, 1800),
    ];
  }, [setPhaseBoth, buildBoards, difficulty, forgetWinShot]);

  /*
    Time up: whoever has rescued more wins, level is a draw. The scores
    are the ones on the two strips (scoreOf), taken as the clock stops.
  */
  const endOnTime = useCallback(() => {
    if (phaseRef.current !== 'battle') return;
    const outcome = timeUpOutcome(scoreOf(unitsRefA.current), scoreOf(unitsRefB.current));
    setEndedOnTime(true);
    decided(outcome === 'won' ? 0 : outcome === 'lost' ? 1 : null);
    playFanfare();
    playCue(outcome === 'tie' ? 'tie' : 'win');
  }, [decided]);

  useEffect(() => {
    if (phase !== 'battle' || !appActive) return;
    clockRef.current = runClock(clockRef.current, Date.now());
    const id = setTimeout(endOnTime, clockLeft(clockRef.current, Date.now()));
    return () => {
      clearTimeout(id);
      clockRef.current = pauseClock(clockRef.current, Date.now());
    };
  }, [phase, appActive, endOnTime]);

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
        decided(outcome.winner);
        playFanfare();
        if (outcome.winner !== null) playCue('win');
        else playCue('tie');
      }
    },
    [decided, mode, zoneColors],
  );

  const settledA = useRef(makeSettleHandler(0)).current;
  const settledB = useRef(makeSettleHandler(1)).current;
  const noop = useCallback(() => {}, []);

  const scoreA = scoreOf(unitsA);
  const scoreB = scoreOf(unitsB);

  // The winner's half gets the share offer, once the board's picture is in hand.
  const shareResult: ShareResult | null =
    winner === null
      ? null
      : { mode, score: winner === 0 ? scoreA : scoreB, target: targetFor(mode), trophies: 0 };
  const zoneShare: ZoneShare | null =
    winShot && shareResult
      ? {
          sheet: shareSheet,
          lines: cardLines(shareResult),
          open: () => {
            const made = cardUriRef.current;
            if (made) {
              setShareSheet({ step: 'ready', uri: made, shareFailed: false });
              return;
            }
            setShareSheet({ step: 'making' });
            const renderer = winner === 0 ? rendererA.current : rendererB.current;
            void composeWinCard(renderer, winShot, shareResult).then((uri) => {
              if (uri) cardUriRef.current = uri;
              setShareSheet((open) =>
                open === null ? null : uri ? { step: 'ready', uri, shareFailed: false } : { step: 'failed' },
              );
            });
          },
          shareNow: () => {
            const uri = cardUriRef.current;
            if (!uri) return;
            void shareCardFile(uri).then((outcome) => {
              if (outcome === 'shared') setShareSheet(null);
              else if (outcome === 'failed') setShareSheet({ step: 'ready', uri, shareFailed: true });
            });
          },
          close: () => setShareSheet(null),
        }
      : null;

  return (
    <View style={styles.container}>
      {/* Player 2 zone (top, rotated to face them) */}
      <ZoneView
        rotated
        phase={phase}
        appActive={appActive}
        won={winner === null ? null : winner === 1}
        readClock={readClock}
        endedOnTime={endedOnTime}
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
        rendererRef={rendererB}
        share={winner === 1 ? zoneShare : null}
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
        readClock={readClock}
        endedOnTime={endedOnTime}
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
        rendererRef={rendererA}
        share={winner === 0 ? zoneShare : null}
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
    // 20, not 10: clear of the exit button, which straddles the centre
    // line by 18pt. With the battle clock in it (1 Nov 2026) the longest
    // strip — Color War, behind — reaches the left edge of the screen.
    top: 20,
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
  zoneTimeUp: {
    color: THEME.bad,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 6,
  },
  zoneSmall: {
    color: THEME.inkSoft,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
  },
  endButtons: {
    flexDirection: 'row',
    // Three buttons for the winner; wrap on a narrow phone.
    flexWrap: 'wrap',
    justifyContent: 'center',
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
  shareWinButton: {
    minHeight: MIN_TAP,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: SHAPE.radiusLg,
    backgroundColor: THEME.surface,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
    justifyContent: 'center',
  },
  shareWinText: {
    color: THEME.ink,
    fontSize: 13,
    fontWeight: '800',
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
