import React, { useEffect, useRef } from 'react';
import { initSounds, playStartup } from '../audio/sounds';
import { loadAudioSettings } from '../audio/settings';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { SHAPE, THEME } from '../ui/theme';
import { launchProgress, onLaunchChange } from '../game/launchReady';

/** The loading bar's width, in points. */
const BAR_WIDTH = 176;
/** Inside its outline. */
const FILL_WIDTH = BAR_WIDTH - SHAPE.line * 2;


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
 *
 * A LOADING SCREEN since 3 Nov 2026. The family: "make sure the game is
 * fully loaded before showing the home screen". It no longer decides how
 * long it stays up — App lifts it when the game reports ready
 * (src/game/launchReady.ts) — and it shows how far along that is with a
 * bar under the tagline, drawn in the card's own ink on paper.
 */
export function BootSplash() {
  /*
    The bar is a scale on the native side, not a width in JavaScript:
    the loading work runs on the JavaScript thread in slices, and an
    animation driven from there would stutter between them. Each report
    of progress starts a short native glide to the new figure.
  */
  const fill = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let last = -1;
    const show = () => {
      const to = launchProgress();
      if (to === last) return;
      last = to;
      Animated.timing(fill, {
        toValue: to,
        duration: 260,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    };
    show();
    return onLaunchChange(show);
  }, [fill]);

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
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.screen}>
      {/*
        THE PAPER & INK LOGO. David, 30 Sep 2026: "the logo at the bottom
        of the home tab and the logo on startup are not the paper and ink
        logo I wanted a long time ago, so go back and get those paper and
        ink logos and use it." It is the app icon he chose — two
        ink-outlined dice showing the same colour, the Perfect Match, over
        the six-colour bar — cut from its own layers in assets/icon/layers
        rather than redrawn, so the icon on the phone and the card that
        opens the game are the same drawing.
      */}
      <Image
        source={require('../../assets/logo/logo.png')}
        style={styles.logo}
        resizeMode="contain"
        accessibilityLabel="Dice Battles: Color Rush"
      />
      <Text style={styles.title}>DICE BATTLES</Text>
      <Text style={styles.subtitle}>COLOR RUSH</Text>
      <View style={styles.rule} />
      <Text style={styles.tagline}>Colors, not numbers</Text>
      <View
        style={styles.track}
        accessibilityRole="progressbar"
        accessibilityLabel="Loading"
      >
        <Animated.View
          style={[
            styles.fill,
            {
              // Grown from the left edge: shifted half its lost width
              // back, since a scale works from the middle.
              transform: [
                {
                  translateX: fill.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-FILL_WIDTH / 2, 0],
                  }),
                },
                { scaleX: fill },
              ],
            },
          ]}
        />
      </View>

      <View style={styles.studio}>
        <Text style={styles.studioLabel}>a game by</Text>
        {/*
          The studio's FULL mark — ink hull, cyan main sail — the variant
          made for a light ground. The card used to be ink-dark and carried
          the reversed, paper-white ship; on paper it is the ink one.
        */}
        <Image
          source={require('../../assets/logo/ship.png')}
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
     * PAPER, like the rest of the game. It was ink until 30 Sep 2026 —
     * the one screen left over from before Paper & Ink, carrying the
     * reversed ship. The native splash in app.json is paper too, so the
     * launch does not flash from one to the other.
     */
    backgroundColor: THEME.ground,
    paddingHorizontal: 32,
  },
  logo: {
    width: 176,
    height: 170,
    marginBottom: 10,
  },
  title: {
    color: THEME.ink,
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  subtitle: {
    color: THEME.accent,
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
    backgroundColor: THEME.ink,
    marginTop: 16,
  },
  tagline: {
    color: THEME.inkSoft,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
  },
  /*
    The bar: the card's rule drawn long and hollow, filling with the
    same ink. Paper & Ink tokens only, no new colour.
  */
  track: {
    width: BAR_WIDTH,
    height: 10,
    marginTop: 26,
    borderRadius: SHAPE.radiusSm,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
    backgroundColor: THEME.sunk,
    overflow: 'hidden',
  },
  fill: {
    width: FILL_WIDTH,
    height: '100%',
    backgroundColor: THEME.ink,
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
    color: THEME.inkFaint,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  studioName: {
    color: THEME.ink,
    fontSize: 19,
    fontWeight: '800',
    marginTop: 6,
  },
});
