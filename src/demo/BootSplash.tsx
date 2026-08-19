import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

/** How long the title card is held before the game appears. */
export const BOOT_SPLASH_MS = 1900;

const textShadow = {
  textShadowColor: 'rgba(0,0,0,0.55)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 8,
};

/**
 * The title card on launch: the game's name, and who made it.
 *
 * This is a React screen rather than the native splash in app.json, because
 * the native one can only be a static image and cannot say "Paper Ship
 * Studio" in the studio's own type. The native splash still shows first,
 * for the moment before JavaScript is running; this takes over from it.
 *
 * The name here is "Dice Battles" — the name under the icon on the phone.
 * The App Store listing name is "Dice Battles: Color Rush", deliberately
 * kept separate (see AGENTS.md).
 */
export function BootSplash({ onDone }: { onDone: () => void }) {
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const id = setTimeout(() => done.current(), BOOT_SPLASH_MS);
    return () => clearTimeout(id);
  }, []);

  return (
    <View style={styles.screen}>
      <Text style={styles.dice}>🎲</Text>
      <Text style={styles.title}>DICE BATTLES</Text>
      <View style={styles.rule} />
      <Text style={styles.tagline}>Colors, not numbers</Text>

      <View style={styles.studio}>
        <Text style={styles.studioLabel}>a game by</Text>
        <Text style={styles.studioName}>Paper Ship Studio</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#140c28',
    paddingHorizontal: 32,
  },
  dice: {
    fontSize: 68,
    marginBottom: 14,
  },
  title: {
    color: '#ffe521',
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: 1.5,
    textAlign: 'center',
    ...textShadow,
  },
  rule: {
    width: 74,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#fc8403',
    marginTop: 16,
  },
  tagline: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
    ...textShadow,
  },
  studio: {
    position: 'absolute',
    bottom: 64,
    alignItems: 'center',
  },
  studioLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  studioName: {
    color: '#ffffff',
    fontSize: 19,
    fontWeight: '800',
    marginTop: 6,
    ...textShadow,
  },
});
