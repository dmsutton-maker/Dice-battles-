import React, { useEffect, useRef } from 'react';
import { initSounds, playStartup } from '../audio/sounds';
import { loadAudioSettings } from '../audio/settings';
import { Image, StyleSheet, Text, View } from 'react-native';

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
 * The name is the full "Dice Battles: Color Rush" — David asked for the
 * one name everywhere, so the icon, the title card and the App Store
 * listing now all agree.
 */
export function BootSplash({ onDone }: { onDone: () => void }) {
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    let cancelled = false;
    // Saved volumes are read BEFORE the sound plays: a phone the family
    // muted must stay muted, and the settings live in storage, so playing
    // first and checking after would blare once on every launch.
    loadAudioSettings()
      .then(() => {
        if (cancelled) return;
        initSounds();
        playStartup();
      })
      .catch(() => {
        // No sound is fine; the card still shows.
      });

    const id = setTimeout(() => done.current(), BOOT_SPLASH_MS);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, []);

  return (
    <View style={styles.screen}>
      <Text style={styles.dice}>🎲</Text>
      <Text style={styles.title}>DICE BATTLES</Text>
      <Text style={styles.subtitle}>COLOR RUSH</Text>
      <View style={styles.rule} />
      <Text style={styles.tagline}>Colors, not numbers</Text>

      <View style={styles.studio}>
        <Text style={styles.studioLabel}>a game by</Text>
        {/*
          The reversed variant of the mark (logo-assets/2e-icon-reversed):
          this card is near-black, and the standard one has a near-black
          hull that would vanish into it.
        */}
        <Image
          source={require('../../assets/paper-ship-mark.png')}
          style={styles.mark}
          resizeMode="contain"
        />
        <Text style={styles.studioName}>Paper Ship Studio</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFillObject,
    /*
     * Above EVERYTHING in the game. Tree order is not enough: the stats
     * HUD carries zIndex 30, the bottom bar 35 and the settings gear 5,
     * and the card carried none — so the trophies, coins, gear and menu
     * bar all punched straight through it on launch.
     */
    zIndex: 100,
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
  subtitle: {
    color: '#fc8403',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 4.5,
    marginTop: 6,
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
    bottom: 104,
    alignItems: 'center',
  },
  mark: {
    width: 54,
    height: 45,
    marginTop: 8,
    marginBottom: 6,
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
