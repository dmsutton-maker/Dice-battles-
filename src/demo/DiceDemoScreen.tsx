import { Canvas } from '@react-three/fiber/native';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ArenaId, ARENAS } from '../arena/arenas';
import {
  activeArena,
  activeDieBody,
  equipArena,
  equipSkin,
  getLoadout,
  loadLoadout,
} from '../game/loadout';
import { countCue, initAnnouncer, playCue, stopAnnouncer, VoiceCue } from '../audio/announcer';
import {
  AudioLevelKey,
  AudioSettings,
  getAudioSettings,
  loadAudioSettings,
  setAudioVolume,
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
  AiDifficultyId,
  AiOpponent,
  pickOpponent,
  rollAiDice,
} from '../game/ai';
import {
  EMPTY_LAYOUT,
  generateObstacleLayout,
  OBSTACLE_HINTS,
  ObstacleLayout,
} from '../game/obstacles';
import {
  applyMatchResult,
  getProgress,
  isUnlocked,
  loadProgress,
  nextTier,
  setUnlockAll as persistUnlockAll,
  TESTER_CODE,
  MONEY_CODE,
  MONEY_CODE_COINS,
  TESTER_LOCK_CODE,
  TIERS,
  tierLabel,
  TROPHY_STAKES,
} from '../game/progress';
import { ColorDef, PRISONER_COLORS, PrisonerColorId } from '../game/colors';
import {
  makeUnits,
  MODE_ORDER,
  MODES,
  ModeId,
  PrisonerUnit,
  Station,
} from '../game/modes';
import { TUNING } from '../game/tuning';
import { flickFromGesture } from '../game/aim';
import { awardCoins, getWallet, grantCoins, loadWallet } from '../game/currency';
import { skinById } from '../game/diceSkins';
import { DiceScene, SceneControls } from './DiceScene';
import { InventoryScreen } from './InventoryScreen';
import { LeaderboardScreen } from './LeaderboardScreen';
import { StoreScreen } from './StoreScreen';
import { TwoPlayerScreen } from './TwoPlayerScreen';
import { VolumeSlider } from './VolumeSlider';
import { BugReportModal } from '../debug/BugReportModal';
import { MatchmakingOverlay } from './MatchmakingOverlay';
import { rangeLabel } from '../game/rewards';
import { StatsHud } from './StatsHud';
import { Reward, RewardPopup } from './RewardPopup';

/**
 * Classic mode vs one AI opponent.
 *
 * Round flow: pick screen -> "ARM YOUR DICE!" -> "BATTLE!" -> race. The
 * player rolls real physics dice (flick to throw, tap for a straight roll);
 * a new throw is LOCKED until the dice settle, so every roll is binding.
 * The AI rolls fair virtual dice on a timer (difficulty = speed).
 */

type Phase =
  | 'pick'
  | 'matching'
  | 'arm'
  | 'go'
  | 'battle'
  | 'won'
  | 'lost'
  | 'tie';

export function DiceDemoScreen() {
  const [audioPrefs, setAudioPrefs] = useState<AudioSettings>(getAudioSettings());

  useEffect(() => {
    initSounds();
    initAnnouncer();
    // Nothing is drawn until the saved loadout and progress are in hand:
    // rendering first would show the default castle for a frame before
    // swapping to the battlefield the player actually left equipped.
    Promise.all([loadAudioSettings(), loadLoadout(), loadProgress(), loadWallet()])
      .then(([audio, saved, progress, purse]) => {
        setAudioPrefs(audio);
        setLoadout(saved);
        setWallet(purse);
        setTrophies(progress.trophies);
        setWins(progress.wins);
        setModeWins(progress.modeWins);
        setUnlockAll(!!progress.unlockAll);
      })
      .catch(() => {
        // Defaults are fine if storage is unavailable.
      })
      .finally(() => setHydrated(true));
  }, []);

  const controlsRef = useRef<SceneControls | null>(null);
  const [phase, setPhase] = useState<Phase>('pick');
  const [difficulty, setDifficulty] = useState<AiDifficultyId>('easy');
  const [mode, setMode] = useState<ModeId>('classic');
  const [opponent, setOpponent] = useState<AiOpponent>(() => pickOpponent());
  const [twoPlayer, setTwoPlayer] = useState(false);
  const [loadout, setLoadout] = useState(getLoadout());
  const [showInventory, setShowInventory] = useState(false);
  const [showStore, setShowStore] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [wallet, setWallet] = useState(getWallet());
  const [hydrated, setHydrated] = useState(false);
  const [unlockAll, setUnlockAll] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [codeFeedback, setCodeFeedback] = useState<string | null>(null);
  // Rewards queue rather than replace each other: crossing two tiers in one
  // battle used to show only the second one.
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showBugReport, setShowBugReport] = useState(false);
  const [rolledFaces, setRolledFaces] = useState<ColorDef[] | null>(null);
  const [rolling, setRolling] = useState(false);
  const [units, setUnits] = useState<PrisonerUnit[]>(() =>
    makeUnits('classic', PRISONER_COLORS, null, null),
  );
  const [warColors, setWarColors] = useState<{ player: ColorDef; ai: ColorDef } | null>(null);
  const [aiFreed, setAiFreed] = useState<PrisonerColorId[]>([]);
  const [aiLastRoll, setAiLastRoll] = useState<[ColorDef, ColorDef] | null>(null);
  const [shakeSignal, setShakeSignal] = useState(0);
  const [callout, setCallout] = useState<{ key: number; text: string } | null>(null);
  const [layout, setLayout] = useState<ObstacleLayout>(EMPTY_LAYOUT);
  const [round, setRound] = useState(0);
  const [trophies, setTrophies] = useState(0);
  const [wins, setWins] = useState({ easy: 0, medium: 0, hard: 0 });
  const [modeWins, setModeWins] = useState<Record<ModeId, number>>({
    classic: 0,
    ultimate: 0,
    skirmish: 0,
    colorwar: 0,
  });
  const [lastDelta, setLastDelta] = useState<number | null>(null);
  const [lastCoins, setLastCoins] = useState(0);
  const [aiFlash, setAiFlash] = useState(false);
  const [playerFlash, setPlayerFlash] = useState(false);

  // Refs mirroring state that gesture/timer callbacks need synchronously.
  const phaseRef = useRef<Phase>('pick');
  const difficultyRef = useRef<AiDifficultyId>('easy');
  const modeRef = useRef<ModeId>('classic');
  const opponentRef = useRef<AiOpponent | null>(null);
  const unitsRef = useRef<PrisonerUnit[]>([]);
  const warRef = useRef<{ player: ColorDef; ai: ColorDef } | null>(null);
  const aiFreedRef = useRef<PrisonerColorId[]>([]);
  const countdownTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const calloutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lastSplash = useRef(0);

  // Whether the start screen's content is taller than the screen itself.
  const pickHeights = useRef({ viewport: 0, content: 0 });
  const [pickOverflows, setPickOverflows] = useState(false);
  const measurePick = useCallback(
    (next: { viewport?: number; content?: number }) => {
      pickHeights.current = { ...pickHeights.current, ...next };
      const { viewport, content } = pickHeights.current;
      setPickOverflows(viewport > 0 && content > viewport + 1);
    },
    [],
  );

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
    // Color War: draw two distinct fighter colors for this round.
    let war: { player: ColorDef; ai: ColorDef } | null = null;
    if (modeRef.current === 'colorwar') {
      const shuffled = [...PRISONER_COLORS].sort(() => Math.random() - 0.5);
      war = { player: shuffled[0], ai: shuffled[1] };
    }
    warRef.current = war;
    setWarColors(war);
    const fresh = makeUnits(
      modeRef.current,
      PRISONER_COLORS,
      war?.player ?? null,
      war?.ai ?? null,
    );
    unitsRef.current = fresh;
    setUnits(fresh);
    aiFreedRef.current = [];
    setAiFreed([]);
    setRolledFaces(null);
    setAiLastRoll(null);
    setRolling(false);
  }, []);

  const moveUnit = useCallback((key: string, station: Station) => {
    const next = unitsRef.current.map((u) =>
      u.key === key ? { ...u, station } : u,
    );
    unitsRef.current = next;
    setUnits(next);
    return next;
  }, []);

  const retreatCount = () =>
    unitsRef.current.filter((u) => u.station.kind === 'retreat').length;
  const wallCount = () =>
    unitsRef.current.filter((u) => u.station.kind === 'wall').length;
  const jailCount = () =>
    unitsRef.current.filter((u) => u.station.kind === 'jail').length;

  const showCallout = useCallback((text: string, cue?: VoiceCue | null) => {
    setCallout({ key: Date.now(), text });
    if (calloutTimer.current) clearTimeout(calloutTimer.current);
    calloutTimer.current = setTimeout(() => setCallout(null), 2300);
    if (cue) playCue(cue);
  }, []);

  const submitCode = useCallback(() => {
    const code = codeInput.trim().toUpperCase();
    setCodeInput('');
    if (code === TESTER_CODE) {
      persistUnlockAll(true);
      setUnlockAll(true);
      setCodeFeedback('🔓 Everything unlocked — have fun testing!');
      playFanfare();
    } else if (code === MONEY_CODE) {
      grantCoins(MONEY_CODE_COINS);
      setWallet({ ...getWallet() });
      setCodeFeedback(`🪙 ${MONEY_CODE_COINS.toLocaleString()} coins added!`);
      playFanfare();
    } else if (code === TESTER_LOCK_CODE) {
      persistUnlockAll(false);
      setUnlockAll(false);
      setCodeFeedback('🔒 Tester mode off — back to earning unlocks.');
    } else if (code) {
      setCodeFeedback("Hmm, that's not the secret code…");
    }
  }, [codeInput]);

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

  const finishRound = useCallback(
    (outcome: 'won' | 'lost' | 'tie') => {
      setPhaseBoth(outcome);
      const coins = awardCoins(outcome, difficultyRef.current);
      setWallet({ ...getWallet() });
      setLastCoins(coins);
      if (outcome === 'tie') {
        showCallout("It's a tie!", 'tie');
        setLastDelta(0);
        return;
      }
      const result = applyMatchResult(
        outcome === 'won',
        difficultyRef.current,
        modeRef.current,
      );
      setTrophies(result.trophies);
      if (result.newUnlocks.length > 0) {
        setRewards((queue) => [
          ...queue,
          ...result.newUnlocks.map((tier) => ({
            emoji: tier.emoji,
            name: tier.name,
            kicker: 'NEW REWARD UNLOCKED',
            note: 'Put it on in the Inventory whenever you like.',
          })),
        ]);
      }
      setWins(getProgress().wins);
      setModeWins(getProgress().modeWins);
      setLastDelta(result.delta);
      if (outcome === 'won') {
        playFanfare();
        showCallout('Victory!', 'win');
        if (result.newUnlocks.length > 0) {
          const unlock = result.newUnlocks[result.newUnlocks.length - 1];
          flashTimers.current.push(
            setTimeout(
              () => showCallout(`UNLOCKED: ${unlock.emoji} ${unlock.name}!`, 'congrats'),
              1900,
            ),
          );
        }
      } else {
        showCallout(`Oh no — ${opponentRef.current?.name ?? 'your rival'} wins!`, 'lose');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => {},
        );
      }
    },
    [setPhaseBoth, showCallout],
  );

  /**
   * Start of a round: pick the rival, then show who it is for a couple of
   * seconds before the countdown. `beginCountdown` is the old body of this
   * function and runs when the reveal finishes.
   */
  const startCountdown = useCallback(() => {
    const rival = pickOpponent(opponentRef.current ?? undefined);
    opponentRef.current = rival;
    setOpponent(rival);
    resetRace();
    // Fresh obstacle spots every battle.
    setLayout(generateObstacleLayout(difficultyRef.current));
    setRound((r) => r + 1);
    setCallout(null);
    setPhaseBoth('matching');
  }, [resetRace, setPhaseBoth]);

  const beginCountdown = useCallback(() => {
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
  }, [setPhaseBoth]);

  // Background music plays through the countdown and the race. The music
  // level is not a dependency: the player can move that slider mid-battle
  // and the loop follows it without being restarted (see syncMusic).
  useEffect(() => {
    if (
      phase === 'matching' ||
      phase === 'arm' ||
      phase === 'go' ||
      phase === 'battle'
    ) {
      startMusic();
    } else {
      stopMusic();
    }
  }, [phase]);

  // The AI opponent: fair virtual rolls on a fixed cadence while battling.
  // What a match DOES depends on the mode.
  useEffect(() => {
    if (phase !== 'battle') return;
    const { rollIntervalMs } = AI_DIFFICULTIES[difficulty];
    const id = setInterval(() => {
      const roll = rollAiDice();
      setAiLastRoll(roll);
      const [a, b] = roll;
      if (a.id !== b.id) return;
      const m = modeRef.current;
      const aiPing = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        setAiFlash(true);
        flashTimers.current.push(setTimeout(() => setAiFlash(false), 650));
      };

      if (m === 'classic' || m === 'ultimate') {
        // AI races its own abstract set of six.
        if (aiFreedRef.current.includes(a.id)) {
          if (m === 'ultimate') {
            // Prisoner exchange bites the AI too!
            const next = aiFreedRef.current.filter((c) => c !== a.id);
            aiFreedRef.current = next;
            setAiFreed(next);
            showCallout(`Ha! ${opponentRef.current?.name}'s ${a.label} was captured again!`);
          }
          return;
        }
        const next = [...aiFreedRef.current, a.id];
        aiFreedRef.current = next;
        setAiFreed(next);
        aiPing();
        const ac = next.length;
        const pc = retreatCount();
        if (ac === PRISONER_COLORS.length) {
          finishRound('lost');
        } else if (ac === PRISONER_COLORS.length - 1) {
          showCallout('He needs only ONE more — hurry!', 'hurry');
        } else if (ac === pc && pc > 0) {
          showCallout(`${opponentRef.current?.name} ties it up ${ac}–${pc}!`, 'lookout');
        } else if (ac === pc + 1) {
          showCallout(`${opponentRef.current?.name} freed ${a.label} — you're falling behind!`, 'lookout');
        } else {
          showCallout(`${opponentRef.current?.name} freed ${a.label}!`, 'lookout');
        }
        return;
      }

      if (m === 'skirmish') {
        // Shared pool: grab the prisoner if it's still in jail.
        const unit = unitsRef.current.find(
          (u) => u.colorId === a.id && u.station.kind === 'jail',
        );
        if (!unit) return;
        moveUnit(unit.key, { kind: 'wall', index: wallCount() });
        aiPing();
        const pc = retreatCount();
        const ac = wallCount();
        if (jailCount() === 0) {
          finishRound(pc > ac ? 'won' : pc < ac ? 'lost' : 'tie');
        } else {
          showCallout(`${opponentRef.current?.name} GRABBED ${a.label}! ${pc}–${ac}`, 'lookout');
        }
        return;
      }

      // Color War: only the AI's own color counts.
      const war = warRef.current;
      if (!war || a.id !== war.ai.id) return;
      const unit = unitsRef.current.find(
        (u) => u.colorId === war.ai.id && u.station.kind === 'jail',
      );
      if (!unit) return;
      moveUnit(unit.key, { kind: 'wall', index: wallCount() });
      aiPing();
      const ac = wallCount();
      if (ac >= 3) {
        finishRound('lost');
      } else if (ac === 2) {
        showCallout(`${opponentRef.current?.name} has 2 of 3 — hurry!`, 'hurry');
      } else {
        showCallout(`${opponentRef.current?.name} rescued a ${war.ai.label}!`, 'lookout');
      }
    }, rollIntervalMs);
    return () => clearInterval(id);
  }, [phase, difficulty, finishRound, moveUnit, showCallout]);

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
      const color = faces[0];
      const m = modeRef.current;

      const celebrate = () => {
        setShakeSignal((s2) => s2 + 1);
        setPlayerFlash(true);
        flashTimers.current.push(setTimeout(() => setPlayerFlash(false), 650));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => {},
        );
        playCheer();
      };

      if (m === 'classic' || m === 'ultimate') {
        const jailUnit = unitsRef.current.find(
          (u) => u.colorId === color.id && u.station.kind === 'jail',
        );
        if (!jailUnit) {
          if (m === 'ultimate') {
            // Prisoner exchange: an already-rescued color goes BACK to jail.
            const freedUnit = unitsRef.current.find(
              (u) => u.colorId === color.id && u.station.kind === 'retreat',
            );
            if (freedUnit) {
              moveUnit(freedUnit.key, { kind: 'jail', index: freedUnit.jailIndex });
              showCallout(`Oh no! ${color.label} was captured again!`, 'wrong');
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Warning,
              ).catch(() => {});
            }
          } else {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          }
          return;
        }
        moveUnit(jailUnit.key, { kind: 'retreat', index: retreatCount() });
        celebrate();
        const n = retreatCount();
        const ac = aiFreedRef.current.length;
        if (n === PRISONER_COLORS.length) {
          finishRound('won');
        } else if (n === PRISONER_COLORS.length - 1) {
          showCallout(`${color.label} rescued — one more to win!`, 'gogogo');
        } else if (n === ac && ac > 0) {
          showCallout(`${color.label} rescued — you're tied ${n}–${ac}!`, countCue(n));
        } else if (n === ac + 1) {
          showCallout(`${color.label} rescued — you take the lead!`, countCue(n));
        } else {
          showCallout(`${color.label} rescued!`, countCue(n));
        }
        return;
      }

      if (m === 'skirmish') {
        const unit = unitsRef.current.find(
          (u) => u.colorId === color.id && u.station.kind === 'jail',
        );
        if (!unit) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          return;
        }
        moveUnit(unit.key, { kind: 'retreat', index: retreatCount() });
        celebrate();
        const pc = retreatCount();
        const ac = wallCount();
        if (jailCount() === 0) {
          finishRound(pc > ac ? 'won' : pc < ac ? 'lost' : 'tie');
        } else {
          showCallout(`You grabbed ${color.label}! ${pc}–${ac}`, countCue(pc));
        }
        return;
      }

      // Color War: only YOUR color counts.
      const war = warRef.current;
      if (!war) return;
      if (color.id !== war.player.id) {
        showCallout(
          color.id === war.ai.id
            ? `That's your opponent's color — hands off!`
            : `${color.label} isn't your color!`,
        );
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        return;
      }
      const unit = unitsRef.current.find(
        (u) => u.colorId === war.player.id && u.station.kind === 'jail',
      );
      if (!unit) return;
      moveUnit(unit.key, { kind: 'retreat', index: retreatCount() });
      celebrate();
      const n = retreatCount();
      if (n >= 3) {
        finishRound('won');
      } else if (n === 2) {
        showCallout(`Two down — one more ${war.player.label}!`, 'gogogo');
      } else {
        showCallout(`${war.player.label} rescued!`, countCue(n));
      }
    },
    [finishRound, moveUnit, showCallout],
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        if (phaseRef.current === 'pick') startCountdown();
        // battle: the throw waits for release, so a flick can carry the
        // player's own direction and speed into the dice. arm/go: inputs
        // locked during the ritual. won/lost/tie: the buttons decide.
      },
      // Lifting the finger throws: a fast gesture is a flick, carrying its
      // direction and speed into the dice; a slow one is a tap and rolls
      // them gently forward.
      onPanResponderRelease: (_event, gesture) => {
        if (phaseRef.current !== 'battle') return;
        controlsRef.current?.throwAll(flickFromGesture(gesture) ?? undefined);
      },
    }),
  ).current;

  // Equipped in the Inventory, falling back if it is no longer unlocked
  // (which happens when family tester mode is switched back off).
  const arenaId: ArenaId = activeArena(trophies);
  const dieBodyColor = activeDieBody(trophies);
  const equippedSkin = skinById(loadout.skinId);
  const playerScore = units.filter((u) => u.station.kind === 'retreat').length;
  const aiScore =
    mode === 'skirmish' || mode === 'colorwar'
      ? units.filter((u) => u.station.kind === 'wall').length
      : aiFreed.length;
  const target = mode === 'colorwar' ? 3 : 6;
  const upNext = nextTier(trophies);
  const upNextLabel = upNext ? tierLabel(upNext, trophies) : null;
  const stakes = TROPHY_STAKES[difficulty];

  const isMatch =
    rolledFaces !== null &&
    rolledFaces.length === 2 &&
    rolledFaces[0].id === rolledFaces[1].id;

  const modeRow = (
    <View style={styles.modeBlock}>
      <View style={styles.modeGrid}>
        {MODE_ORDER.map((id) => (
          <Pressable
            key={id}
            onPress={() => {
              modeRef.current = id;
              setMode(id);
            }}
            style={[styles.modeButton, mode === id && styles.difficultyButtonActive]}
          >
            <Text
              style={[
                styles.modeText,
                mode === id && styles.difficultyTextActive,
              ]}
            >
              {MODES[id].emoji} {MODES[id].name}
            </Text>
          </Pressable>
        ))}
      </View>
      {/*
        Two lines' worth of height is always reserved. Color War's rules
        fit on one line where the others take two, so picking it used to
        pull the whole screen up by a line and push it back down again on
        the next tap.
      */}
      <Text style={styles.modeRules} numberOfLines={2}>
        {MODES[mode].rules}
      </Text>
    </View>
  );

  const difficultyRow = (
    <View style={styles.difficultyBlock}>
      <View style={styles.difficultyRow}>
      {Object.values(AI_DIFFICULTIES).map((d) => (
        <Pressable
          key={d.id}
          onPress={() => {
            difficultyRef.current = d.id;
            setDifficulty(d.id);
          }}
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
      <Text style={styles.stakesText}>
        Win +{rangeLabel(stakes.win)} 🏆 · Lose −{rangeLabel(stakes.loss)} 🏆
      </Text>
    </View>
  );

  const inventoryButton = (
    <Pressable style={styles.inventoryButton} onPress={() => setShowInventory(true)}>
      <Text style={styles.inventoryText}>🎒 INVENTORY</Text>
    </Pressable>
  );

  // Every round ends with an explicit choice — one more battle, or back to
  // the menu to change mode, difficulty or arena. Tapping the result screen
  // used to restart instantly, which meant a stray tap started a fresh
  // round (and on Hard, put 25 trophies back on the line).
  const roundOverButtons = (
    <View style={styles.endButtons}>
      <Pressable style={styles.playAgainButton} onPress={startCountdown}>
        <Text style={styles.playAgainText}>▶ PLAY AGAIN</Text>
      </Pressable>
      <Pressable style={styles.homeButton} onPress={quitToMenu}>
        <Text style={styles.homeText}>🏠 HOME</Text>
      </Pressable>
    </View>
  );

  if (!hydrated) {
    // One or two frames on a cold start, in the app's own background.
    return <View style={styles.hydrating} />;
  }

  if (twoPlayer) {
    return (
      <TwoPlayerScreen
        arenaId={arenaId}
        dieBodyColor={dieBodyColor}
        onExit={() => setTwoPlayer(false)}
      />
    );
  }

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
        <color attach="background" args={[ARENAS[arenaId].skyColor]} />
        <DiceScene
          key={`${difficulty}-${round}-${arenaId}`}
          layout={layout}
          arenaId={arenaId}
          dieBodyColor={dieBodyColor}
          diePattern={equippedSkin.pattern}
          diePatternInk={equippedSkin.ink}
          showTreasure={isUnlocked('treasure', trophies)}
          controlsRef={controlsRef}
          onThrow={handleThrow}
          onSettled={handleSettled}
          onMoatSink={handleMoatSink}
          units={units}
          shakeSignal={shakeSignal}
          throwsEnabled={phase === 'battle'}
        />
      </Canvas>

      {/* Gesture layer (transparent, above the canvas). */}
      <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers} />

      {/*
        The title steps aside once a battle starts. It and the scoreboard
        used to stack, pushing the score down onto the jail row — you know
        which game you are in by then, and the prisoners matter more.
      */}
      {phase !== 'battle' && phase !== 'won' && phase !== 'lost' && phase !== 'tie' && (
        <View pointerEvents="none" style={styles.topBar}>
          <Text style={styles.title}>DICE BATTLES</Text>
        </View>
      )}

      {/* Scoreboard */}
      {(phase === 'battle' || phase === 'won' || phase === 'lost' || phase === 'tie') && (
        <View pointerEvents="none" style={styles.scoreboard}>
          <View style={[styles.scoreSide, playerFlash && styles.scoreFlashYou]}>
            <Text style={styles.scoreLabel}>YOU</Text>
            {warColors && (
              <View style={[styles.aiRollSwatch, { backgroundColor: warColors.player.hex }]} />
            )}
            <Text style={styles.scoreNumber}>{playerScore}</Text>
          </View>
          <Text style={styles.scoreVs}>⚔️</Text>
          <View style={[styles.scoreSide, aiFlash && styles.scoreFlashAi]}>
            <Text style={styles.scoreNumber}>{aiScore}</Text>
            {warColors && (
              <View style={[styles.aiRollSwatch, { backgroundColor: warColors.ai.hex }]} />
            )}
            <Text style={styles.scoreLabel}>{opponent.short}</Text>
          </View>
          <View style={styles.aiMeta}>
            {(mode === 'classic' || mode === 'ultimate') && (
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
            )}
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
            {playerScore} / {target} RESCUED
          </Text>
        </View>
      )}

      {/* Pick / countdown / result overlays */}
      {phase === 'pick' && (
        <View style={styles.overlay}>
          <Pressable
            style={styles.gearButton}
            onPress={() => setShowSettings(true)}
          >
            <Text style={styles.gearText}>⚙️</Text>
          </Pressable>
          {/*
            Scrolling is enabled only when the content genuinely overflows.
            On most phones everything fits, and a screen that rubber-bands
            with nothing to scroll to feels broken — but a small screen
            (iPhone SE) still has to be able to reach the START button.
          */}
          <ScrollView
            contentContainerStyle={styles.pickScroll}
            showsVerticalScrollIndicator={false}
            bounces={false}
            scrollEnabled={pickOverflows}
            onLayout={(e) => measurePick({ viewport: e.nativeEvent.layout.height })}
            onContentSizeChange={(_w, h) => measurePick({ content: h })}
          >
            <Text style={styles.overlayTitle}>⚔️ DICE BATTLES ⚔️</Text>
            <Text style={styles.tagline}>
              Race other players to free your prisoners!
            </Text>
            {unlockAll ? (
              <Text style={styles.trophyNext}>
                🔓 Family tester mode — everything unlocked
              </Text>
            ) : (
              upNext && (
                <Text style={styles.trophyNext}>
                  Next unlock: {upNextLabel!.emoji} {upNextLabel!.name} at {upNext.at} 🏆
                </Text>
              )
            )}
            {modeRow}
            {difficultyRow}
            {inventoryButton}
            <View style={styles.navRow}>
              <Pressable
                style={styles.navButton}
                onPress={() => setShowStore(true)}
              >
                <Text style={styles.navText}>🛒 STORE</Text>
              </Pressable>
              <Pressable
                style={styles.navButton}
                onPress={() => setShowLeaderboard(true)}
              >
                <Text style={styles.navText}>🏅 LEADERBOARD</Text>
              </Pressable>
            </View>
            <Pressable style={styles.startButton} onPress={startCountdown}>
              <Text style={styles.startText}>▶ START BATTLE</Text>
            </Pressable>
            <Pressable
              style={styles.twoPlayerButton}
              onPress={() => setTwoPlayer(true)}
            >
              <Text style={styles.twoPlayerText}>👥 2 Players — Split Screen</Text>
            </Pressable>
          </ScrollView>
        </View>
      )}
      {phase === 'matching' && (
        <MatchmakingOverlay opponent={opponent} onDone={beginCountdown} />
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
        <View style={styles.overlay}>
          <Text style={styles.overlayTitle}>🏆 VICTORY!</Text>
          <Text style={styles.trophyLine}>
            {lastDelta !== null && lastDelta >= 0 ? `+${lastDelta}` : lastDelta} 🏆 → {trophies}
          </Text>
          {upNext && (
            <Text style={styles.trophyNext}>
              Next unlock: {upNextLabel!.emoji} {upNextLabel!.name} at {upNext.at} 🏆
            </Text>
          )}
          <Text style={styles.overlayBody}>
            {MODES[mode].name} victory!{'\n'}
            You {playerScore} — {opponent.name} {aiScore}.
          </Text>
          {difficultyRow}
          {roundOverButtons}
        </View>
      )}
      {phase === 'tie' && (
        <View style={styles.overlay}>
          <Text style={styles.overlayTitle}>🤝 IT'S A TIE!</Text>
          <Text style={styles.overlayBody}>
            {playerScore}–{aiScore} — nobody loses trophies.{'\n'}Settle it in a
            rematch!
          </Text>
          {difficultyRow}
          {roundOverButtons}
        </View>
      )}
      {showStore && (
        <StoreScreen
          onClose={() => setShowStore(false)}
          onPurchase={(bought) => {
            setWallet({ ...getWallet() });
            if (bought) setRewards((queue) => [...queue, bought]);
          }}
        />
      )}
      {showLeaderboard && (
        <LeaderboardScreen
          trophies={trophies}
          wins={wins}
          modeWins={modeWins}
          onClose={() => setShowLeaderboard(false)}
        />
      )}
      {showInventory && (
        <InventoryScreen
          trophies={trophies}
          arenaId={arenaId}
          skinId={loadout.skinId}
          onEquipArena={(id) => setLoadout({ ...equipArena(id) })}
          onEquipSkin={(id) => setLoadout({ ...equipSkin(id) })}
          onClose={() => setShowInventory(false)}
        />
      )}
      {phase !== 'battle' &&
        phase !== 'arm' &&
        phase !== 'go' &&
        phase !== 'matching' &&
        !showLeaderboard && <StatsHud trophies={trophies} coins={wallet.coins} />}

      {rewards.length > 0 && (
        <RewardPopup
          reward={rewards[0]}
          onClose={() => setRewards((queue) => queue.slice(1))}
        />
      )}

      {showSettings && (
        <View style={styles.settingsOverlay}>
          <View style={styles.settingsPanel}>
            <Text style={styles.settingsTitle}>⚙️ Settings</Text>
            {/*
              Four sliders make this panel taller than a small phone, so the
              middle scrolls and the Done button stays put — no scrolling
              yourself off the only way out. It only scrolls when it has to:
              `bounces={false}` means no rubber-band on a panel that fits.
            */}
            <ScrollView
              style={styles.settingsScroll}
              bounces={false}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
            <Text style={styles.settingsSectionTitle}>VOLUME</Text>
            {(
              [
                ['master', 'Everything', true],
                ['sfx', 'Sound effects', false],
                ['music', 'Music', false],
                ['voice', 'Announcer', false],
              ] as [AudioLevelKey, string, boolean][]
            ).map(([key, label, emphasis]) => (
              <VolumeSlider
                key={key}
                label={label}
                emphasis={emphasis}
                value={audioPrefs[key]}
                onChange={(value) =>
                  setAudioPrefs({ ...setAudioVolume(key, value) })
                }
              />
            ))}
            <View style={styles.settingsDividerLine} />
            <Text style={styles.settingsStats}>
              🏆 {trophies} trophies{'\n'}🥉 Easy ×{wins.easy}   🥈 Medium ×
              {wins.medium}   🥇 Hard ×{wins.hard}
            </Text>
            <View style={styles.settingsDividerLine} />
            <View style={styles.codeRow}>
              <TextInput
                style={styles.codeInput}
                value={codeInput}
                onChangeText={setCodeInput}
                onSubmitEditing={submitCode}
                placeholder="Secret code…"
                placeholderTextColor="rgba(255,255,255,0.4)"
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="go"
              />
              <Pressable style={styles.codeGo} onPress={submitCode}>
                <Text style={styles.codeGoText}>OK</Text>
              </Pressable>
            </View>
            {(codeFeedback ?? (unlockAll ? '🔓 Tester mode ON' : null)) && (
              <Text style={styles.codeStatus}>
                {codeFeedback ?? '🔓 Tester mode ON'}
              </Text>
            )}
            <View style={styles.settingsDividerLine} />
            <Pressable
              style={styles.bugReportButton}
              onPress={() => setShowBugReport(true)}
            >
              <Text style={styles.bugReportButtonText}>🐞 Report a Bug</Text>
            </Pressable>
            </ScrollView>
            <Pressable
              style={styles.settingsDone}
              onPress={() => {
                setShowSettings(false);
                setCodeFeedback(null);
              }}
            >
              <Text style={styles.settingsDoneText}>Done</Text>
            </Pressable>
          </View>
        </View>
      )}
      <BugReportModal
        visible={showBugReport}
        onClose={() => setShowBugReport(false)}
      />
      {phase === 'lost' && (
        <View style={styles.overlay}>
          <Text style={styles.overlayTitle}>😤 DEFEAT!</Text>
          <Text style={styles.trophyLine}>{lastDelta} 🏆 → {trophies}</Text>
          <Text style={styles.overlayBody}>
            {opponent.name} wins this {MODES[mode].name} battle {aiScore}–{playerScore}.{'\n'}
            Avenge your prisoners!
          </Text>
          {difficultyRow}
          {roundOverButtons}
        </View>
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
  hydrating: {
    flex: 1,
    backgroundColor: '#1b1430',
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
    // Up where the title used to sit, which is above the jail rather than
    // on top of it.
    top: 54,
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
  twoPlayerButton: {
    marginTop: 12,
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  twoPlayerText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  tagline: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14.5,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
    ...textShadow,
  },
  trophyLine: {
    color: '#ffe521',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 10,
    ...textShadow,
  },
  medalLine: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 6,
    ...textShadow,
  },
  trophyNext: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13.5,
    fontWeight: '700',
    marginTop: 4,
    ...textShadow,
  },
  stakesText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 6,
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
  pickScroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 4,
  },
  gearButton: {
    position: 'absolute',
    top: 54,
    right: 18,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  gearText: {
    fontSize: 21,
  },
  startButton: {
    marginTop: 24,
    alignSelf: 'stretch',
    backgroundColor: '#ffe521',
    borderRadius: 26,
    paddingVertical: 15,
    alignItems: 'center',
  },
  startText: {
    color: '#241c40',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1,
  },
  settingsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,8,24,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    zIndex: 10,
  },
  settingsPanel: {
    alignSelf: 'stretch',
    backgroundColor: '#2c2450',
    borderRadius: 22,
    padding: 22,
    // Never taller than the screen, so Done is always on it.
    maxHeight: '88%',
  },
  settingsScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  settingsTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 12,
  },
  settingsSectionTitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 8,
  },
  settingsDividerLine: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: 12,
  },
  settingsStats: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 24,
  },
  bugReportButton: {
    marginTop: 4,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
  },
  bugReportButtonText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    fontWeight: '800',
  },
  settingsDone: {
    marginTop: 16,
    backgroundColor: '#ffe521',
    borderRadius: 20,
    paddingVertical: 11,
    alignItems: 'center',
  },
  settingsDoneText: {
    color: '#241c40',
    fontSize: 16,
    fontWeight: '900',
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
  modeBlock: {
    alignItems: 'center',
    marginTop: 16,
    alignSelf: 'stretch',
  },
  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'stretch',
  },
  modeButton: {
    width: '46%',
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
  },
  modeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  modeRules: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    // Exactly two lines, always — see the note at the usage site.
    height: 36,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 10,
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
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  codeInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  codeGo: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#ffe521',
  },
  codeGoText: {
    color: '#241c40',
    fontSize: 14,
    fontWeight: '800',
  },
  navRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  navButton: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  navText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  inventoryButton: {
    marginTop: 22,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  inventoryText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  endButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 26,
    alignItems: 'center',
  },
  playAgainButton: {
    paddingHorizontal: 26,
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: '#ffe521',
  },
  playAgainText: {
    color: '#241c40',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  homeButton: {
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  homeText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  codeStatus: {
    color: '#ffe521',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
});
