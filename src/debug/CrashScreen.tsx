import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { describe, getLastFatal } from './crashGuard';

/**
 * What a player sees if the game fails to start.
 *
 * Written to be readable by whoever is holding the phone, including a
 * child: it says the game broke, that it is not their fault, and shows
 * the technical detail underneath for whoever is fixing it.
 */
export function CrashScreen({ error }: { error: Error | null }) {
  return (
    <View style={styles.root}>
      <Text style={styles.emoji}>🎲💥</Text>
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
    backgroundColor: '#1b1430',
    paddingTop: 90,
    paddingHorizontal: 22,
    paddingBottom: 40,
  },
  emoji: { fontSize: 46, textAlign: 'center' },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 10,
  },
  body: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 18,
  },
  box: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  boxInner: { padding: 14 },
  detail: {
    color: '#ffb3b3',
    fontSize: 12,
    fontFamily: 'Courier',
    lineHeight: 17,
  },
});
