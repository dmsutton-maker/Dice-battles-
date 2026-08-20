import { Canvas } from '@react-three/fiber/native';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  GestureResponderEvent,
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
  playClick,
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
  parseTrophyCode,
  setTrophies as writeTrophies,
  TROPHY_CODE_MAX,
  getProgress,
  isUnlocked,
  loadProgress,
  nextTier,
  setUnlockAll as persistUnlockAll,
  TESTER_CODE,
  MONEY_CODE,
  MONEY_CODE_COINS,
  RESET_CODE,
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
import { GAME_VERSION } from '../game/version';
import { flickFromGesture, TouchSample, velocityFromSamples } from '../game/aim';
import {
  awardCoins,
  getWallet,
  grantCoins,
  clearPurchases,
  loadWallet,
  spendCoins,
} from '../game/currency';
import { DEFAULT_SKIN_ID, skinById } from '../game/diceSkins';
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
import { BottomNav, BOTTOM_NAV_HEIGHT, Tab } from './BottomNav';
import { NewsScreen } from './NewsScreen';
import { TournamentScreen } from './TournamentScreen';
import {
  RunState,
  TournamentDef,
  advanceRun,
  startRun,
  tournamentById,
} from '../game/tournament';
import { rollReward } from '../game/rewards';
import { Reward, RewardPopup } from './RewardPopup';
import {
  loadColorblindMode,
  setColorblindMode,
} from '../game/colorblind';

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
    Promise.all([
      loadAudioSettings(),
      loadLoadout(),
      loadProgress(),
      loadWallet(),
      loadColorblindMode(),
    ])
      .then(([audio, saved, progress, purse, cb]) => {
        setAudioPrefs(audio);
        setLoadout(saved);
        setWallet(purse);
        setTrophies(progress.trophies);
        setWins(progress.wins);
        setModeWins(progress.modeWins);
        setUnlockAll(!!progress.unlockAll);
        setColorblind(cb);
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
  const [tab, setTab] = useState<Tab>('play');
  // The cup being played, if any. A round started from a cup reports back
  // to it when it finishes.
  const [run, setRun] = useState<RunState | null>(null);
  const [wallet, setWallet] = useState(getWallet());
  const [hydrated, setHydrated] = useState(false);
  const [unlockAll, setUnlockAll] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [codeFeedback, setCodeFeedback] = useState<string | null>(null);
  /*
    Getting the code box out from under the keyboard.

    The box sits low in the Settings page, so on a phone the keyboard
    covered the very thing being typed into. Two halves to the fix: the
    panel shrinks by the keyboard's height (KeyboardAvoidingView below),
    and the page scrolls the box into what is left of the view.

    The scroll waits for `keyboardDidShow` rather than firing on focus,
    because at focus the keyboard has not finished animating and its height
    is not yet known — scrolling then lands in the wrong place, and by a
    different amount depending on whether the autocorrect bar is showing.
  */
  const settingsScrollRef = useRef<ScrollView | null>(null);
  const codeRowY = useRef(0);
  const codeFocused = useRef(false);

  const revealCodeBox = useCallback(() => {
    if (!codeFocused.current) return;
    // A little above the box, so it does not sit flush against the
    // keyboard with its label cut off.
    settingsScrollRef.current?.scrollTo({
      y: Math.max(0, codeRowY.current - 24),
      animated: true,
    });
  }, []);

  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', revealCodeBox);
    return () => shown.remove();
  }, [revealCodeBox]);
  // Rewards queue rather than replace each other: crossing two tiers in one
  // battle used to show only the second one.
  const [rewards, setRewards] = useState<Reward[]>([]);

  const [colorblind, setColorblind] = useState(false);
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
  const runRef = useRef<RunState | null>(null);
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
  /**
   * Color War stands both fighters' rescues along the same bottom row —
   * yours on the left three spots, your opponent's on the right three —
   * so counting has to go by COLOUR. retreatCount() would add the two
   * together and hand each side the other's score.
   */
  const warRetreatCount = (colorId: PrisonerColorId): number =>
    unitsRef.current.filter(
      (u) => u.station.kind === 'retreat' && u.colorId === colorId,
    ).length;

  const showCallout = useCallback((text: string, cue?: VoiceCue | null) => {
    setCallout({ key: Date.now(), text });
    if (calloutTimer.current) clearTimeout(calloutTimer.current);
    calloutTimer.current = setTimeout(() => setCallout(null), 2300);
    if (cue) playCue(cue);
  }, []);

  const submitCode = useCallback(() => {
    const code = codeInput.trim().toUpperCase();
    setCodeInput('');
    // Parsed once, up front: "500 TROPHY" carries a value, so it cannot be
    // matched by comparison like the others.
    const trophyCode = parseTrophyCode(code);
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
    } else if (code === RESET_CODE) {
      const removed = clearPurchases();
      setWallet({ ...getWallet() });
      // A wiped skin may still be the equipped one. activeDieBody already
      // falls back, but the Inventory would show "equipped" on a card it
      // also shows as locked, so put the loadout back to the free dice.
      setLoadout({ ...equipSkin(DEFAULT_SKIN_ID) });
      setCodeFeedback(
        removed === 0
          ? 'Nothing bought yet — the Store is already untouched.'
          : `🧹 ${removed} bought ${removed === 1 ? 'item' : 'items'} cleared. Coins kept.`,
      );
      playClick();
    } else if (trophyCode) {
      // Checked before the catch-all, so "500 TROPHY" is never met with
      // "that's not the secret code".
      const result = writeTrophies(trophyCode.trophies);
      setTrophies(result.trophies);
      // Going down relocks things, so the equipped skin may no longer be
      // owned. activeDieBody falls back on its own, but the Inventory would
      // still print "equipped" on a card it also shows as locked.
      setLoadout({ ...getLoadout() });
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
      setCodeFeedback(
        trophyCode.clamped
          ? `🏆 That is more trophies than the game holds — set to ${TROPHY_CODE_MAX.toLocaleString()}.`
          : `🏆 Trophies set to ${result.trophies.toLocaleString()}.`,
      );
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

      // A cup round reports back to the bracket. A tie does not advance
      // you and does not knock you out — you play the round again.
      if (runRef.current && outcome !== 'tie') {
        const cup = tournamentById(runRef.current.tournamentId);
        if (cup) {
          const next = advanceRun(runRef.current, cup, outcome === 'won');
          setRun(next);
          if (next.finished === 'champion') {
            const prize = rollReward(cup.prize);
            grantCoins(prize);
            setWallet({ ...getWallet() });
            setRewards((queue) => [
              ...queue,
              {
                emoji: cup.emoji,
                name: `${cup.name} champion!`,
                kicker: 'CUP WON',
                note: `You beat the whole bracket. ${prize} coins are yours.`,
              },
            ]);
          }
        }
      }
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
  /**
   * Which menu page is showing. A battle always takes the screen back —
   * being three rounds into a cup with the Store open would be nonsense.
   */
  // finishRound runs from a callback created once, so the run is read
  // through a ref rather than a captured value.
  runRef.current = run;

  const menuTab: Tab | null =
    phase === 'pick' && tab !== 'play' ? tab : null;

  // Leaving Settings clears the code feedback — the Done button used to
  // do this on its way out, and without it "10,000 coins added!" would
  // still be sitting there next time you opened the page.
  useEffect(() => {
    if (tab !== 'settings') setCodeFeedback(null);
  }, [tab]);

  const backToPlay = useCallback(() => {
    playClick();
    setTab('play');
  }, []);

  /** Pay the entry fee and open a bracket. */
  const enterTournament = useCallback((tournament: TournamentDef) => {
    if (tournament.entry > 0) {
      if (!spendCoins(tournament.entry)) return;
      setWallet({ ...getWallet() });
    }
    setRun(startRun(tournament));
    setDifficulty(tournament.difficulty);
    difficultyRef.current = tournament.difficulty;
  }, []);

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

  /** Start the next bracket round: same flow as a normal battle. */
  const playCupRound = useCallback(() => {
    setTab('play');
    startCountdown();
  }, [startCountdown]);

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
      // Right three spots of the bottom row: indices 3, 4, 5.
      moveUnit(unit.key, {
        kind: 'retreat',
        index: 3 + warRetreatCount(war.ai.id),
      });
      aiPing();
      const ac = warRetreatCount(war.ai.id);
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
      // Left three spots of the bottom row: indices 0, 1, 2.
      moveUnit(unit.key, {
        kind: 'retreat',
        index: warRetreatCount(war.player.id),
      });
      celebrate();
      const n = warRetreatCount(war.player.id);
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

  // Touch samples for the release velocity. PanResponder's own vx/vy is a
  // whole-gesture average and dies to nearly zero if the finger hesitates
  // before lifting, which turned real flicks into taps.
  const samples = useRef<TouchSample[]>([]);
  const sample = (event: GestureResponderEvent) => {
    const { pageX, pageY, timestamp } = event.nativeEvent;
    samples.current.push({ x: pageX, y: pageY, t: timestamp });
    // A tenth of a second of history is all the tail needs.
    if (samples.current.length > 12) samples.current.shift();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Once the throw gesture is claimed, nothing may take it away
      // mid-flick — a stolen gesture never reaches release and the dice
      // simply never move.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        samples.current = [];
        sample(event);
        if (phaseRef.current === 'pick') startCountdown();
        // battle: the throw waits for release, so a flick can carry the
        // player's own direction and speed into the dice. arm/go: inputs
        // locked during the ritual. won/lost/tie: the buttons decide.
      },
      // Lifting the finger throws: a fast gesture is a flick, carrying its
      // direction and speed into the dice; a slow one is a tap and rolls
      // them gently forward.
      onPanResponderMove: sample,
      onPanResponderRelease: (event, gesture) => {
        sample(event);
        if (phaseRef.current !== 'battle') return;
        const velocity = velocityFromSamples(samples.current);
        controlsRef.current?.throwAll(
          flickFromGesture(gesture, { velocity }) ?? undefined,
        );
        samples.current = [];
      },
    }),
  ).current;

  // Equipped in the Inventory, falling back if it is no longer unlocked
  // (which happens when family tester mode is switched back off).
  const arenaId: ArenaId = activeArena(trophies);
  const dieBodyColor = activeDieBody(trophies);
  const equippedSkin = skinById(loadout.skinId);
  // In Color War both sides stand in the retreat row, so each side's
  // score is its own colour rather than everyone standing there.
  const inRetreat = (colorId: PrisonerColorId) =>
    units.filter((u) => u.station.kind === 'retreat' && u.colorId === colorId)
      .length;
  const playerScore =
    mode === 'colorwar' && warColors
      ? inRetreat(warColors.player.id)
      : units.filter((u) => u.station.kind === 'retreat').length;
  const aiScore =
    mode === 'colorwar'
      ? warColors
        ? inRetreat(warColors.ai.id)
        : 0
      : mode === 'skirmish'
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
              playClick();
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
            playClick();
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
      {/*
        Two lines' worth of height always. Easy's hint wraps to two where
        Medium's and Hard's fit on one, so picking a difficulty shifted
        the stakes line and everything under it — the same fault the mode
        rules had.
      */}
      <Text style={styles.difficultyHint} numberOfLines={2}>
        {OBSTACLE_HINTS[difficulty]}
      </Text>
      <Text style={styles.stakesText}>
        Win +{rangeLabel(stakes.win)} 🏆 · Lose −{rangeLabel(stakes.loss)} 🏆
      </Text>
    </View>
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
        mode={mode}
        difficulty={difficulty}
        symbols={colorblind}
        onExit={() => setTwoPlayer(false)}
      />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Canvas
        style={styles.canvas}
        /*
         * The board is not just hidden behind a menu — it stops rendering.
         * Menus are only reachable from 'pick', where nothing is moving,
         * so there is nothing to keep animating, and a phone should not
         * be running a 3D scene nobody can see.
         */
        frameloop={menuTab === null ? 'always' : 'never'}
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
          dieSymbols={colorblind}
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
        There is no game-name bar across the top any more. It sat at y58
        spanning the full width while the trophy and coin pills sit at
        y52 on the left, so the two ran into each other — and the name was
        already on the launch card and again in the heading below.
      */}

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
          {/* The floating gear moved to the bottom bar. */}
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
              <Text style={styles.trophyNext} numberOfLines={1}>
                🔓 Family tester mode — everything unlocked
              </Text>
            ) : (
              upNext && (
                <Text style={styles.trophyNext} numberOfLines={1}>
                  Next unlock: {upNextLabel!.emoji} {upNextLabel!.name} at {upNext.at} 🏆
                </Text>
              )
            )}
            {modeRow}
            {difficultyRow}
            <Pressable style={styles.startButton} onPress={startCountdown}>
              <Text style={styles.startText}>▶ START BATTLE</Text>
            </Pressable>
            <Pressable
              style={styles.twoPlayerButton}
              onPress={() => {
                playClick();
                setTwoPlayer(true);
              }}
            >
              {/* The mode AND the difficulty picked above both carry into
                  split screen — the courtyard obstacles are the difficulty,
                  and they apply just as well to a human opponent. */}
              <Text
                style={styles.twoPlayerText}
                numberOfLines={1}
                // Naming both the mode and the difficulty makes this the
                // longest label on the screen. Shrink it rather than
                // ellipsising it on a small phone — "Color Rush · Med…"
                // is worse than the same words a point smaller.
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                👥 2 Players · {MODES[mode].name} · {AI_DIFFICULTIES[difficulty].label}
              </Text>
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
            <Text style={styles.trophyNext} numberOfLines={1}>
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
      {/*
        The menu pages. Each is a tab rather than a modal now — the Close
        buttons stay for the phone's own back gesture habits, and drop you
        on Battle.
      */}
      {menuTab === 'store' && (
        <StoreScreen
          onClose={backToPlay}
          onPurchase={(bought) => {
            setWallet({ ...getWallet() });
            if (bought) setRewards((queue) => [...queue, bought]);
          }}
        />
      )}
      {menuTab === 'leaderboard' && (
        <LeaderboardScreen
          trophies={trophies}
          wins={wins}
          modeWins={modeWins}
          onClose={backToPlay}
        />
      )}
      {menuTab === 'inventory' && (
        <InventoryScreen
          trophies={trophies}
          arenaId={arenaId}
          skinId={loadout.skinId}
          onEquipArena={(id) => setLoadout({ ...equipArena(id) })}
          onEquipSkin={(id) => setLoadout({ ...equipSkin(id) })}
          onClose={backToPlay}
        />
      )}
      {menuTab === 'news' && <NewsScreen />}
      {menuTab === 'cups' && (
        <TournamentScreen
          coins={wallet.coins}
          run={run}
          onEnter={enterTournament}
          onPlayRound={playCupRound}
          onAbandon={() => setRun(null)}
        />
      )}

      {/*
        Only on the home screen and the menus. It used to show on the
        result screen too, where the scoreboard sits centred at y54 and
        would have run into these pills at y52 — the same collision the
        game-name bar had. The result screen reports the trophies and
        coins won in its own text anyway.
      */}
      {phase === 'pick' && menuTab !== 'leaderboard' && (
        <StatsHud trophies={trophies} coins={wallet.coins} />
      )}

      {/* The bar itself. Gone during a battle — the board wants the room. */}
      {phase !== 'battle' && phase !== 'arm' && phase !== 'go' && phase !== 'matching' && (
        <BottomNav active={tab} onSelect={setTab} />
      )}

      {rewards.length > 0 && (
        <RewardPopup
          reward={rewards[0]}
          onClose={() => setRewards((queue) => queue.slice(1))}
        />
      )}

      {menuTab === 'settings' && (
        <View style={styles.settingsOverlay}>
          {/*
            Shrinks the panel by the keyboard's height, so there is somewhere
            to scroll the code box TO. Scrolling alone would not help: with
            the panel still full height, the box would scroll to a part of
            the page the keyboard is sitting on top of.

            iOS only. Android resizes the window for the keyboard by itself
            (Expo's default softwareKeyboardLayoutMode), and stacking this
            on top of that would count the keyboard twice.
          */}
          <KeyboardAvoidingView
            style={styles.settingsPanel}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <Text style={styles.settingsTitle}>⚙️ SETTINGS</Text>
            {/*
              Four sliders make this page taller than any phone, so the
              middle scrolls while the version line stays pinned below it.

              Both scroll cues are deliberately ON. They used to be off —
              `bounces={false}` and a hidden indicator — which made a page
              that genuinely scrolls feel like a dead end: no rubber-band
              when you pull, no bar to say there is more underneath. That
              is why the version line at the bottom read as missing rather
              than as below the fold. The bar fades away on its own when
              you stop, so showing it costs nothing at rest.
            */}
            <ScrollView
              ref={settingsScrollRef}
              style={styles.settingsScroll}
              contentContainerStyle={styles.settingsScrollContent}
              bounces
              showsVerticalScrollIndicator
              indicatorStyle="white"
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
            {/*
              Colourblind mode. The palette does not change — it is already
              built for colour-vision deficiency — a shape is added on top,
              so nobody has to make a fine colour judgement in a hurry.
            */}
            <Pressable
              style={styles.toggleRow}
              onPress={() => {
                playClick();
                const next = !colorblind;
                setColorblind(next);
                setColorblindMode(next);
              }}
            >
              <View style={styles.toggleText}>
                <Text style={styles.toggleLabel}>
                  {colorblind ? '🔷' : '⬜'} Colorblind mode
                </Text>
                <Text style={styles.toggleNote}>
                  Every colour gets its own shape, on the dice and the
                  prisoners.
                </Text>
              </View>
              <View style={[styles.toggleBox, colorblind && styles.toggleBoxOn]}>
                <Text style={styles.toggleTick}>{colorblind ? '✓' : ''}</Text>
              </View>
            </Pressable>
            <View style={styles.settingsDividerLine} />
            <Text style={styles.settingsStats}>
              🏆 {trophies} trophies{'\n'}🥉 Easy ×{wins.easy}   🥈 Medium ×
              {wins.medium}   🥇 Hard ×{wins.hard}
            </Text>
            <View style={styles.settingsDividerLine} />
            <View
              style={styles.codeRow}
              onLayout={(e) => {
                codeRowY.current = e.nativeEvent.layout.y;
              }}
            >
              <TextInput
                style={styles.codeInput}
                value={codeInput}
                onChangeText={setCodeInput}
                onSubmitEditing={submitCode}
                onFocus={() => {
                  codeFocused.current = true;
                  // Covers the case where the keyboard is already open —
                  // keyboardDidShow will not fire again for this tap.
                  revealCodeBox();
                }}
                onBlur={() => {
                  codeFocused.current = false;
                }}
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
            {/*
              No Done button. Settings is a tab now — you leave it by
              tapping another one, the same as every other page, and a
              button that only goes "back to Battle" is a second way to
              do what the bar already does.
            */}
          </KeyboardAvoidingView>
          {/*
            The version, pinned to the OVERLAY and positioned absolutely —
            outside the flex flow altogether, and outside the
            KeyboardAvoidingView.

            Two earlier attempts put it inside that flow, and both times
            something else took the space: first the scroll swallowed it,
            then it only surfaced when the keyboard opened and squeezed the
            panel enough to leave room. Taking it out of the flow entirely
            means nothing can push it anywhere. It sits just above the tab
            bar, on every screen, whatever else is happening.
          */}
          <Text style={styles.versionLine}>{GAME_VERSION}</Text>
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
    // Fixed, so shrinking the font to fit cannot change the button's
    // height and shift everything below it.
    lineHeight: 20,
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
    lineHeight: 18,
    // One line, always. Arena names differ in length and this sits above
    // the mode picker, so a wrap would push the whole column down.
    height: 18,
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
    paddingTop: 64,
    // Clear of the bottom bar, or START BATTLE sits behind it.
    paddingBottom: 64 + BOTTOM_NAV_HEIGHT,
    paddingHorizontal: 4,
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
  /*
   * Settings is a page of its own now, not a card floating over the game.
   * It used to be a translucent popup on the home screen; David asked for
   * it to behave like every other tab, so it is solid and full height and
   * matches Store, Cups, Items, Ranks and News.
   */
  settingsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#141028',
    zIndex: 20,
    paddingTop: 100,
    paddingHorizontal: 22,
  },
  settingsPanel: {
    flex: 1,
    /*
      Room for the tab bar AND for the version line pinned above it. The
      version line is positioned absolutely, so it takes no space of its
      own — if this padding only covered the bar, the scrolling content
      would run underneath the version line and the two would overlap.

      15pt of line, 8pt below it, 9pt above.
    */
    paddingBottom: BOTTOM_NAV_HEIGHT + 32,
  },
  settingsScroll: {
    /*
      `flex: 1`, NOT `flexGrow: 1, flexShrink: 1`. The difference is
      flexBasis: flex:1 sets it to 0, the pair leaves it `auto`, and `auto`
      on a ScrollView means its starting size is the WHOLE height of its
      content — hundreds of points of sliders and sections.

      With nothing below it that was harmless. The moment the version line
      became a sibling underneath, the scroll started from that enormous
      basis, claimed the entire panel, and pushed the version line off the
      bottom where it could not be seen at all.

      From a zero basis it takes only what is left after the pinned footer,
      which is the whole point of pinning one.
    */
    flex: 1,
  },
  settingsScrollContent: {
    /*
      Breathing room under the last thing on the page. Without it the final
      row sits flush against the bottom edge of the scroll area and looks
      clipped — and `bounces={false}` means you cannot even drag it into
      view to check. Padding here rather than a margin on the version line
      so anything added below it gets the same clearance.
    */
    paddingBottom: 26,
  },
  // Same header as Store, Cups, Items, Ranks and News — it is one of
  // them now, so it should not look like a leftover dialog.
  settingsTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.5,
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
  versionLine: {
    // Out of the flex flow: nothing above it can take its space.
    position: 'absolute',
    left: 0,
    right: 0,
    // Directly above the tab bar, which already includes the home
    // indicator, so this clears both.
    bottom: BOTTOM_NAV_HEIGHT + 8,
    color: 'rgba(255,255,255,0.38)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textAlign: 'center',
    // Stated, so the glyph box is never tighter than the descenders in a
    // version string need.
    lineHeight: 15,
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
    lineHeight: 18,
    // Exactly two lines — see the note at the usage site.
    height: 36,
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  toggleText: {
    flex: 1,
  },
  toggleLabel: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  toggleNote: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 2,
  },
  toggleBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBoxOn: {
    backgroundColor: '#33cc6b',
    borderColor: '#33cc6b',
  },
  toggleTick: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
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
