import React, { useEffect, useRef } from 'react';
import { initSounds, playStartup } from '../audio/sounds';
import { loadAudioSettings } from '../audio/settings';
import { Image, StyleSheet, Text, View } from 'react-native';
import { DieIcon } from '../ui/Icon';
import { THEME } from '../ui/theme';

/** How long the title card is held before the game appears. */
export const BOOT_SPLASH_MS = 1900;


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
      {/*
        Drawn, not 🎲 — the same die the tab bar draws, at title size.
        Filled paper-white on the ink card, so it reads as a solid die
        carrying the game's own six colours rather than an outline that
        would half-vanish against the dark.
      */}
      <View style={styles.dice}>
        <DieIcon size={72} color={THEME.onInk} fill={THEME.onInk} />
      </View>
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
    /*
     * INK, deliberately, in a light-mode game: the title card is the one
     * brand moment, and the bundled ship mark is the reversed variant —
     * a paper-white hull that needs a dark ground or it vanishes. The
     * interface proper starts on paper the moment this card leaves.
     */
    backgroundColor: THEME.ink,
    paddingHorizontal: 32,
  },
  dice: {
    marginBottom: 14,
  },
  title: {
    color: THEME.gold,
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  subtitle: {
    color: THEME.onInk,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 4.5,
    marginTop: 6,
    textAlign: 'center',
  },
  rule: {
    width: 74,
    height: 4,
    borderRadius: 2,
    backgroundColor: THEME.gold,
    marginTop: 16,
  },
  tagline: {
    color: 'rgba(253,246,236,0.88)',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
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
    color: 'rgba(253,246,236,0.55)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  studioName: {
    color: THEME.onInk,
    fontSize: 19,
    fontWeight: '800',
    marginTop: 6,
  },
});
