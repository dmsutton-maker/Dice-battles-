import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SHAPE, THEME } from '../ui/theme';

export interface Reward {
  /** The big picture at the top — the item's own emoji. */
  emoji: string;
  /** What was won or bought. */
  name: string;
  /** UNLOCKED / PURCHASED — why the popup is here. */
  kicker: string;
  /** The line underneath, usually where to go next. */
  note: string;
}

/**
 * The moment something new is yours.
 *
 * Both routes into the game's wardrobe end here — crossing a trophy tier
 * and buying from the Store — because from the player's side they are the
 * same event, and a reward that arrives silently may as well not have.
 *
 * Both say where to go to put it on: earning a thing and then not knowing
 * where it went is the complaint this answers.
 */
export function RewardPopup({
  reward,
  onClose,
}: {
  reward: Reward;
  onClose: () => void;
}) {
  return (
    <View style={styles.backdrop}>
      <View style={styles.stack}>
        <View pointerEvents="none" style={styles.shadow} />
        <View style={styles.card}>
        <Text style={styles.kicker}>{reward.kicker}</Text>
        <View style={styles.burst}>
          <Text style={styles.emoji}>{reward.emoji}</Text>
        </View>
        <Text style={styles.name}>{reward.name}</Text>
        <Text style={styles.note}>{reward.note}</Text>
        <Pressable style={styles.button} onPress={onClose}>
          <Text style={styles.buttonText}>Nice!</Text>
        </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(29,26,46,0.66)',
    paddingHorizontal: 30,
    // Above the Store and Inventory overlays (20) and the HUD (30).
    zIndex: 40,
  },
  stack: {
    alignSelf: 'stretch',
    maxWidth: 340,
  },
  // The hard offset shadow, drawn — see src/ui/Card.tsx for why.
  shadow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: SHAPE.drop,
    bottom: -SHAPE.drop,
    borderRadius: SHAPE.radiusLg,
    backgroundColor: THEME.ink,
  },
  card: {
    alignItems: 'center',
    alignSelf: 'stretch',
    paddingVertical: 28,
    paddingHorizontal: 26,
    borderRadius: SHAPE.radiusLg,
    backgroundColor: THEME.surface,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
  },
  kicker: {
    color: THEME.inkSoft,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginBottom: 14,
  },
  // The one place gold gets to be loud: the reward moment.
  burst: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,210,31,0.30)',
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
  },
  emoji: {
    fontSize: 52,
  },
  name: {
    color: THEME.ink,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 16,
    textAlign: 'center',
  },
  note: {
    color: THEME.inkSoft,
    fontSize: 14.5,
    fontWeight: '600',
    lineHeight: 21,
    marginTop: 10,
    textAlign: 'center',
  },
  button: {
    marginTop: 22,
    alignSelf: 'stretch',
    backgroundColor: THEME.gold,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
    borderRadius: SHAPE.radiusLg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: THEME.onGold,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
});
