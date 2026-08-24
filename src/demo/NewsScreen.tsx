import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchNews, NEWS, NewsItem } from '../game/news';
import { SHAPE, THEME } from '../ui/theme';

/**
 * What's new, newest first.
 *
 * Opens instantly on the posts bundled with the app, then quietly fills in
 * anything written on the HQ board since this version shipped. That order
 * matters: the tab is readable the moment it opens, with no spinner and no
 * empty state, and the network is an improvement rather than a
 * requirement. If it never answers, nobody can tell.
 *
 * The list only; the panel, the title and the ✕ come from Popup. News used
 * to be a whole page behind a tab of its own, which was a lot of ceremony
 * for something you read once when something changes.
 */
export function NewsScreen() {
  const [items, setItems] = useState<NewsItem[]>(NEWS);

  useEffect(() => {
    let alive = true;
    fetchNews().then((fresh) => {
      // Guard against the popup being closed mid-request — setting state
      // on a screen nobody is looking at is a warning at best and a leak
      // at worst.
      if (alive) setItems(fresh);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <View>
      <ScrollView
        /*
          flexShrink, or this list silently loses its oldest entries. With
          no flex at all a ScrollView takes its full content height, so the
          popup's maxHeight clipped the overflow — and because the scroll
          thought it already fitted inside its own bounds, dragging it did
          nothing. Everything past the fold was simply gone, and quietly
          worse with every news item added.
        */
        style={styles.list}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.note}>
          Everything that has changed in the game, in plain words.
        </Text>

        {items.map((item) => (
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
  list: {
    flexShrink: 1,
  },
  scroll: {
    paddingHorizontal: 18,
    paddingBottom: 6,
  },
  note: {
    color: THEME.inkSoft,
    fontSize: 13.5,
    fontWeight: '600',
    marginBottom: 16,
  },
  card: {
    backgroundColor: THEME.tile,
    borderWidth: SHAPE.line,
    borderColor: 'rgba(29,26,46,0.25)',
    borderRadius: SHAPE.radius,
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
    color: THEME.ink,
    fontSize: 16.5,
    fontWeight: '800',
  },
  cardMeta: {
    color: THEME.inkFaint,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  cardBody: {
    color: THEME.ink,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  footer: {
    color: THEME.inkFaint,
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 10,
  },
});
