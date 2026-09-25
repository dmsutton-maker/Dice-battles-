import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, PrimaryButton, SecondaryButton } from './Card';
import { MIN_TAP, SHAPE, THEME, TYPE } from './theme';

/**
 * "Are you sure?", once, for the whole game.
 *
 * Every place that spends coins, ends a paid run or cuts a friendship
 * used to be a single tap with nothing between the finger and the
 * consequence. One mis-tap by a five-year-old cost 150 coins, and the
 * game's own rules say a cup entry is not refundable — so the moment to
 * ask is before, not after.
 *
 * Deliberately NOT React Native's Alert: Alert draws the platform's own
 * grey system box, which is the one surface in the game that would not
 * be a piece of card on a table. This is the same Card, the same ink
 * outline and the same hard drop as everything else.
 *
 * The safe answer is the wide primary button and the destructive one is
 * the quiet text link underneath — the opposite of the usual arrangement,
 * on purpose. The loud button is where a thumb lands by habit, so the
 * loud button must be the one that changes nothing.
 */
export function Confirm({
  title,
  body,
  confirmLabel,
  cancelLabel = 'No, go back',
  onConfirm,
  onCancel,
}: {
  title: string;
  /** One or two plain sentences saying what happens, including the cost. */
  body: string;
  /** Names the action, never "OK" — "Yes, enter" beats a word with no verb. */
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <View style={styles.backdrop}>
      {/* Tapping outside is a cancel: the safe answer is always reachable. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onCancel}
        accessibilityLabel={cancelLabel}
      />
      <Card style={styles.panel} radius={SHAPE.radiusLg}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        <SecondaryButton style={styles.cancel} onPress={onCancel}>
          <Text style={styles.cancelText}>{cancelLabel}</Text>
        </SecondaryButton>
        <Pressable
          style={styles.confirm}
          onPress={onConfirm}
          accessibilityRole="button"
        >
          <Text style={styles.confirmText}>{confirmLabel}</Text>
        </Pressable>
      </Card>
    </View>
  );
}

/**
 * The same question, when the answer is harmless and just needs saying.
 * Kept beside Confirm so the two never drift apart visually.
 */
export function Tell({
  title,
  body,
  dismissLabel = 'Got it',
  onDismiss,
}: {
  title: string;
  body: string;
  dismissLabel?: string;
  onDismiss: () => void;
}) {
  return (
    <View style={styles.backdrop}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onDismiss}
        accessibilityLabel={dismissLabel}
      />
      <Card style={styles.panel} radius={SHAPE.radiusLg}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        <PrimaryButton style={styles.cancel} onPress={onDismiss}>
          <Text style={styles.primaryText}>{dismissLabel}</Text>
        </PrimaryButton>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    // Higher than the Friends page (20) and the menu pages, lower than
    // nothing — a question about an irreversible thing goes on top.
    zIndex: 90,
    backgroundColor: 'rgba(29, 26, 46, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 26,
  },
  panel: { width: '100%', maxWidth: 340, padding: 22 },
  title: { ...TYPE.heading, color: THEME.ink, marginBottom: 8, textAlign: 'center' },
  body: {
    color: THEME.inkSoft,
    fontSize: 14.5,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 18,
  },
  cancel: { alignSelf: 'stretch' },
  cancelText: { color: THEME.ink, fontSize: 15.5, fontWeight: '900' },
  primaryText: { color: THEME.surface, fontSize: 15.5, fontWeight: '900' },
  confirm: {
    // 44pt, the theme's own floor for anything tappable — quiet is not
    // the same as small.
    minHeight: MIN_TAP,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  confirmText: {
    color: THEME.accent,
    fontSize: 14.5,
    fontWeight: '900',
    textDecorationLine: 'underline',
  },
});
