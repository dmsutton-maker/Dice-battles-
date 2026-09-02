import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { describe, getLastFatal } from './crashGuard';
import { SHAPE, THEME } from '../ui/theme';

/**
 * What a player sees if the game fails to start.
 *
 * Written to be readable by whoever is holding the phone, including a
 * child: it says the game broke, that it is not their fault, and shows
 * the technical detail underneath for whoever is fixing it.
 *
 * PAPER & INK, like every other screen — this one was still wearing the
 * old dark-purple theme, which meant the single worst moment in the game
 * was also the only screen that looked like a different app.
 *
 * WHAT IT DELIBERATELY DOES NOT IMPORT. `theme.ts` is safe: a plain
 * object literal with no imports of its own, so if it cannot load then
 * nothing could have. `Icon.tsx` is not — it pulls React, the prisoner
 * colours and the theme, and this screen exists precisely for the case
 * where module loading has already gone wrong. So the broken die below
 * is drawn from Views here rather than borrowed, and that duplication is
 * the point rather than an oversight.
 */
export function CrashScreen({ error }: { error: Error | null }) {
  return (
    <View style={styles.root}>
      <View style={styles.mark}>
        <View style={styles.die} />
        <View style={[styles.crack, styles.crackA]} />
        <View style={[styles.crack, styles.crackB]} />
        <View style={[styles.crack, styles.crackC]} />
      </View>
      <Text style={styles.title}>The game could not start</Text>
      <Text style={styles.body}>
        This is a bug in the game, not anything you did. Please send this
        screen to whoever is building it — the text below says what went
        wrong.
      </Text>
      <ScrollView style={styles.box} contentContainerStyle={styles.boxInner}>
        <Text selectable style={styles.detail}>
          {describe(error)}
        </Text>
      </ScrollView>
    </View>
  );
}

/**
 * The same screen, used as the app's root when the app itself could not
 * be loaded — so it has to fetch the error rather than be handed one.
 */
export function CrashRoot() {
  return <CrashScreen error={getLastFatal()} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: THEME.ground,
    paddingTop: 90,
    paddingHorizontal: 22,
    paddingBottom: 40,
  },

  // A die with a crack through it, drawn rather than typed.
  //
  // Three bars, not two, and their ends MEET. The first attempt was two
  // long strokes tilted opposite ways with a couple of points between
  // them, which rendered as "/\" — a pair of slashes, not a break. A
  // crack has to be one unbroken line that changes direction, so each
  // bar's centre sits on the midpoint of a segment of the zigzag and
  // each is two points longer than its segment so the joints overlap.
  mark: { alignSelf: 'center', width: 54, height: 54, marginBottom: 4 },
  die: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 54,
    height: 54,
    borderRadius: 14,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
    backgroundColor: THEME.surface,
  },
  crack: {
    position: 'absolute',
    width: 3,
    backgroundColor: THEME.ink,
  },
  // (27,2) -> (21,20) -> (33,34) -> (27,52), top edge to bottom edge.
  crackA: { left: 22.5, top: 0.5, height: 21, transform: [{ rotate: '18.4deg' }] },
  crackB: { left: 25.5, top: 17, height: 20, transform: [{ rotate: '-40.6deg' }] },
  crackC: { left: 28.5, top: 32.5, height: 21, transform: [{ rotate: '18.4deg' }] },

  title: {
    color: THEME.ink,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 10,
  },
  body: {
    color: THEME.inkSoft,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 18,
  },
  // The detail is machine text, so it sits in a sunk well — the same
  // treatment every inset track gets, rather than a panel of its own.
  box: {
    flex: 1,
    backgroundColor: THEME.sunk,
    borderRadius: 14,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
  },
  boxInner: { padding: 14 },
  detail: {
    color: THEME.ink,
    fontSize: 12,
    fontFamily: 'Courier',
    lineHeight: 17,
  },
});
