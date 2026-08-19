import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { NEWS } from '../game/news';
import { BOTTOM_NAV_HEIGHT } from './BottomNav';

/**
 * What's new, newest first. Bundled with the app — see src/game/news.ts
 * for why there is no feed behind it.
 */
export function NewsScreen() {
  return (
    <View style={styles.overlay}>
      <View style={styles.header}>
        <Text style={styles.title}>📰 NEWS</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.note}>
          Everything that has changed in the game, in plain words.
        </Text>

        {NEWS.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardEmoji}>{item.emoji}</Text>
              <View style={styles.cardHeadText}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardMeta}>
                  {item.date}
                  {item.version ? ` · ${item.version}` : ''}
                </Text>
              </View>
            </View>
            <Text style={styles.cardBody}>{item.body}</Text>
          </View>
        ))}

        <Text style={styles.footer}>
          Got an idea, or found something broken? Tell us from the Settings
          screen — every message is read by a person.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,16,40,0.96)',
    zIndex: 20,
    paddingTop: 100,
  },
  header: {
    paddingHorizontal: 22,
    marginBottom: 10,
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  scroll: {
    paddingHorizontal: 22,
    paddingBottom: BOTTOM_NAV_HEIGHT + 24,
  },
  note: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13.5,
    fontWeight: '600',
    marginBottom: 16,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  cardEmoji: {
    fontSize: 30,
  },
  cardHeadText: {
    flex: 1,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 16.5,
    fontWeight: '800',
  },
  cardMeta: {
    color: '#ffe521',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  cardBody: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  footer: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 10,
  },
});
