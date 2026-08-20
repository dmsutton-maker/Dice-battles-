import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { playClick } from '../audio/sounds';

/**
 * A panel that opens over the game rather than replacing it.
 *
 * Settings and News were full pages behind tabs of their own, which made
 * them feel like places you travelled to. As popups they read as things
 * you glance at and dismiss — and the game stays visible, dimmed, behind
 * them, so it is obvious you have not gone anywhere.
 *
 * Two ways out, because a popup you can get stuck in is worse than a page:
 * the ✕ in the corner, and tapping the dimmed area around the panel.
 */
export function Popup({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const close = () => {
    playClick();
    onClose();
  };

  return (
    <View style={styles.backdrop}>
      {/* The dim itself is the outside-tap target. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={close}
        accessibilityLabel={`Close ${title}`}
      />

      <View style={styles.panel}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Pressable
            style={styles.close}
            onPress={close}
            // The ✕ glyph is small; the tappable area is not.
            hitSlop={14}
          >
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    // Dark, but you can still see the game through it — that is what says
    // "this is on top of where you were" rather than "you have left".
    backgroundColor: 'rgba(8,5,20,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    /*
      Above the tab bar (35) so the dim covers it too — the whole screen
      behind the popup should recede, not just the middle of it. Still
      below the reward popup (40), because unlocking something while
      Settings is open should be the thing you see.
    */
    zIndex: 38,
  },
  panel: {
    width: '100%',
    // Tall enough to be worth opening, short enough to read as a panel
    // sitting on the game rather than another full page.
    maxHeight: '78%',
    backgroundColor: '#221a44',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingTop: 14,
    paddingBottom: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  title: {
    flexShrink: 1,
    color: '#ffffff',
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  closeText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 18,
  },
});
