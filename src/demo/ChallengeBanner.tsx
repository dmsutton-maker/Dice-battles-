import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { MODES } from '../game/modes';
import { AI_DIFFICULTIES } from '../game/ai';
import { SHAPE, THEME, TYPE } from '../ui/theme';
import { FriendsIcon } from '../ui/Icon';
import type { Challenge } from '../game/friendlyBattle';

/**
 * "Marc wants a battle!" — across the top of whatever you were doing.
 *
 * David, 11 Sep 2026: "the battle request should show up on the other
 * player's screen as a short couple second pop up on the top of your
 * screen where you can choose to accept or decline."
 *
 * ACROSS THE TOP, NOT OVER THE MIDDLE. A challenge is an offer, not an
 * interruption: it must be possible to ignore it and carry on rolling.
 * A modal in the centre of the screen would stop a battle already in
 * progress to ask about a different one.
 *
 * It slides in, waits, and slides away on its own. The countdown on it
 * is real — the challenge expires whether or not anybody is looking —
 * and showing the seconds is kinder than a button that quietly stops
 * working.
 */
export function ChallengeBanner({
  challenge,
  secondsLeft,
  onAccept,
  onDecline,
}: {
  challenge: Challenge;
  secondsLeft: number;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const slide = useRef(new Animated.Value(-120)).current;

  useEffect(() => {
    Animated.spring(slide, {
      toValue: 0,
      useNativeDriver: true,
      speed: 14,
      bounciness: 6,
    }).start();
    // Keyed on the challenge id by the caller, so a second challenge
    // arriving slides in fresh rather than appearing already in place.
  }, [slide, challenge.id]);

  const who = challenge.who?.name ?? 'A friend';
  return (
    <Animated.View style={[styles.wrap, { transform: [{ translateY: slide }] }]}>
      <View style={styles.card}>
        <View style={styles.head}>
          <FriendsIcon size={20} />
          <View style={styles.headText}>
            <Text style={styles.title} numberOfLines={1}>
              {who} wants a battle!
            </Text>
            <Text style={styles.detail} numberOfLines={1}>
              {MODES[challenge.mode].name} · {AI_DIFFICULTIES[challenge.difficulty].label} · no
              trophies
            </Text>
          </View>
          {/* The clock, so a challenge that is about to go says so. */}
          <Text style={styles.clock}>{secondsLeft}</Text>
        </View>
        <View style={styles.buttons}>
          <Pressable style={[styles.button, styles.decline]} onPress={onDecline}>
            <Text style={styles.declineText}>No thanks</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.accept]} onPress={onAccept}>
            <Text style={styles.acceptText}>Battle!</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    /*
      Above the board, the menus, the tab bar, a popup and even the
      reward card (40) — a challenge lasts seconds and everything else
      here will wait. Below the title card at 100, which is the one
      thing that must never be drawn through: `npm test` fails if
      anything in this folder climbs past it, and it caught this at 900
      on the first run.
    */
    zIndex: 45,
    paddingHorizontal: 10,
    // Clear of the status bar and the notch. Deliberately a plain number
    // rather than the safe-area helper: that one answers for the BOTTOM
    // of the screen, and a wrong top inset here would hide the buttons.
    paddingTop: 54,
  },
  card: {
    backgroundColor: THEME.surface,
    borderRadius: SHAPE.radius,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
    padding: 10,
    gap: 8,
    // The paper drop shadow the rest of the game uses, drawn as an offset
    // rather than a blur so it matches every other card.
    shadowColor: THEME.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: SHAPE.drop },
    elevation: 6,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  headText: { flex: 1 },
  title: { color: THEME.ink, fontSize: 15.5, fontWeight: '800' },
  detail: { color: THEME.inkSoft, fontSize: 12.5, fontWeight: '700' },
  clock: {
    color: THEME.inkFaint,
    ...TYPE.label,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  buttons: { flexDirection: 'row', gap: 8 },
  button: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: SHAPE.radius - 4,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
    alignItems: 'center',
  },
  decline: { backgroundColor: THEME.sunk },
  accept: { backgroundColor: THEME.gold },
  declineText: { color: THEME.inkSoft, fontSize: 14, fontWeight: '800' },
  acceptText: { color: THEME.ink, fontSize: 14, fontWeight: '800' },
});
