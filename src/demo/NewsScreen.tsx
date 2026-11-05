import React, { useEffect, useState } from 'react';
import { LayoutAnimation, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { playClick } from '../audio/sounds';
import { fetchNews, NEWS, newsIconId, NewsItem } from '../game/news';
import { NEWS_ICONS } from '../ui/newsIcons';
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
 *
 * Every post starts COLLAPSED to its first two lines, and a tap opens it in
 * place (Marc, 5 Nov 2026: "make it to where you can click on it to see the
 * whole thing"). Sixty posts in full was a wall to scroll past; this way the
 * list reads as headlines and the one you care about is a tap away.
 */
/**
 * The picture for a post.
 *
 * Goes through newsIconId rather than reading item.icon directly:
 * posts can arrive from the board over the network, so an unknown kind
 * has to come back as a real drawing rather than as nothing.
 */
function renderIcon(icon: NewsItem['icon']) {
  const Drawing = NEWS_ICONS[newsIconId(icon)];
  return <Drawing size={28} />;
}

/** The picture, title, date and version at the top of a post. */
function PostHead({ item }: { item: NewsItem }) {
  return (
    <View style={styles.cardHead}>
      {/*
        A drawn icon, not an emoji. Fifty-five posts carried
        forty-eight different emoji between them — forty-eight
        borrowed pictures that each look different on every
        phone. A post now says what KIND of change it is about
        and the set decides what that looks like, so the picture
        beside a post about the Store is the same bag that is on
        the Store button.
      */}
      <View style={styles.cardIcon}>{renderIcon(item.icon)}</View>
      <View style={styles.cardHeadText}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardMeta}>
          {item.date}
          {item.version ? ` · ${item.version}` : ''}
        </Text>
      </View>
    </View>
  );
}

/**
 * The "What's new" popup's contents: one big update, in full, the first
 * time the game opens after it arrives (src/game/whatsNew.ts).
 *
 * "Got it" closes it; "Read all news" opens the News tab in its place.
 * Either way the version counts as seen, which the caller records.
 */
export function WhatsNew({
  item,
  onDone,
  onAllNews,
}: {
  item: NewsItem;
  onDone: () => void;
  onAllNews: () => void;
}) {
  return (
    // Shrinks with the panel, so a long post scrolls and the buttons under
    // it stay on screen rather than being clipped off the bottom.
    <View style={styles.whatsNew}>
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <PostHead item={item} />
          <Text style={styles.cardBody}>{item.body}</Text>
        </View>
      </ScrollView>
      <View style={styles.actions}>
        <Pressable
          style={styles.button}
          onPress={() => {
            playClick();
            onDone();
          }}
          accessibilityRole="button"
          accessibilityLabel="Got it"
        >
          <Text style={styles.buttonText}>Got it</Text>
        </Pressable>
        <Pressable
          style={styles.allNews}
          onPress={() => {
            playClick();
            onAllNews();
          }}
          accessibilityRole="button"
          accessibilityLabel="Read all news"
          hitSlop={8}
        >
          <Text style={styles.allNewsText}>Read all news</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** How many lines of a post show before it is opened. */
const COLLAPSED_LINES = 2;

export function NewsScreen() {
  const [items, setItems] = useState<NewsItem[]>(NEWS);
  // The posts opened, by id. Several can be open at once: closing one to
  // read the next would be a chore nobody asked for.
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());

  const toggle = (id: string) => {
    playClick();
    // The cards below slide down (or up) rather than jumping.
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((was) => {
      const next = new Set(was);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
          Everything that has changed in the game, in plain words. Tap a
          post to read all of it.
        </Text>

        {items.map((item) => {
          const expanded = open.has(item.id);
          return (
            <Pressable
              key={item.id}
              style={styles.card}
              onPress={() => toggle(item.id)}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}, ${item.date}`}
              accessibilityHint={expanded ? 'Shows less of this post' : 'Shows the whole post'}
              accessibilityState={{ expanded }}
            >
              <PostHead item={item} />
              {/*
                Collapsed, the body ends in an ellipsis after two lines,
                which is all the "there is more" a card needs. A post short
                enough to fit simply looks the same open or shut.
              */}
              <Text style={styles.cardBody} numberOfLines={expanded ? undefined : COLLAPSED_LINES}>
                {item.body}
              </Text>
            </Pressable>
          );
        })}

        <Text style={styles.footer}>
          Found something broken? Tap Report a bug in Settings — every
          message is read by a person.
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
  /*
    A fixed box, so every title in the list starts at the same place.
    The emoji it replaced were different widths from each other, which
    left the titles very slightly ragged down the page.
  */
  cardIcon: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
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
  whatsNew: {
    flexShrink: 1,
  },
  actions: {
    flexShrink: 0,
    paddingHorizontal: 18,
    paddingTop: 4,
    alignItems: 'stretch',
  },
  button: {
    paddingVertical: 13,
    borderRadius: SHAPE.radius,
    alignItems: 'center',
    backgroundColor: THEME.accent,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
  },
  buttonText: {
    color: THEME.onAccent,
    fontSize: 15,
    fontWeight: '900',
  },
  allNews: {
    alignSelf: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
  allNewsText: {
    color: THEME.inkSoft,
    fontSize: 14,
    fontWeight: '800',
    textDecorationLine: 'underline',
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
