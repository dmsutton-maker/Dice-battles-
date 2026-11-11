import React from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { playClick } from '../audio/sounds';
import { CloseIcon } from '../ui/Icon';
import { SHAPE, THEME, TYPE } from '../ui/theme';

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
    // Explicit, not left to unmounting the focused box to do it. The bug
    // report modal looked fine by that reasoning too, right up until the
    // keyboard was left sitting over the screen behind it.
    Keyboard.dismiss();
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

      {/*
        A piece of card on the table, like every other surface: white, an
        ink outline, and a hard offset shadow drawn as a View underneath
        (Android has no unblurred shadow — see src/ui/Card.tsx).
      */}
      <View style={styles.stack}>
        <View pointerEvents="none" style={styles.shadow} />
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
              <CloseIcon size={16} />
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    // Ink, but you can still see the game through it — that is what says
    // "this is on top of where you were" rather than "you have left".
    backgroundColor: 'rgba(29,26,46,0.55)',
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
  stack: {
    width: '100%',
    // Tall enough to be worth opening, short enough to read as a panel
    // sitting on the game rather than another full page.
    maxHeight: '78%',
  },
  shadow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: SHAPE.drop,
    bottom: -SHAPE.drop,
    borderRadius: SHAPE.radiusLg,
    backgroundColor: THEME.ink,
  },
  panel: {
    width: '100%',
    maxHeight: '100%',
    backgroundColor: THEME.surface,
    borderRadius: SHAPE.radiusLg,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
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
    color: THEME.ink,
    ...TYPE.heading,
  },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.surface,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
  },
});
