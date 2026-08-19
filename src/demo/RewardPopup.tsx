import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const textShadow = {
  textShadowColor: 'rgba(0,0,0,0.55)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 6,
};

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
      <View style={styles.card}>
        <Text style={styles.kicker}>{reward.kicker}</Text>
        <View style={styles.burst}>
          <Text style={styles.emoji}>{reward.emoji}</Text>
        </View>
        <Text style={styles.name}>{reward.name}</Text>
        <Text style={styles.note}>{reward.note}</Text>
        <Pressable style={styles.button} onPress={onClose}>
          <Text style={styles.buttonText}>NICE!</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(12,8,26,0.78)',
    paddingHorizontal: 30,
    // Above the Store and Inventory overlays (20) and the HUD (30).
    zIndex: 40,
  },
  card: {
    alignItems: 'center',
    alignSelf: 'stretch',
    maxWidth: 340,
    paddingVertical: 28,
    paddingHorizontal: 26,
    borderRadius: 26,
    backgroundColor: '#241a44',
    borderWidth: 3,
    borderColor: '#ffe521',
  },
  kicker: {
    color: '#ffe521',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginBottom: 14,
  },
  burst: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,229,33,0.16)',
    borderWidth: 3,
    borderColor: 'rgba(255,229,33,0.45)',
  },
  emoji: {
    fontSize: 52,
  },
  name: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 16,
    textAlign: 'center',
    ...textShadow,
  },
  note: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14.5,
    fontWeight: '600',
    lineHeight: 21,
    marginTop: 10,
    textAlign: 'center',
  },
  button: {
    marginTop: 22,
    alignSelf: 'stretch',
    backgroundColor: '#ffe521',
    borderRadius: 22,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#241a44',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
});
