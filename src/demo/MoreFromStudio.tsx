import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { playClick } from '../audio/sounds';
import {
  grownUpQuestion,
  isGrownUpAnswer,
  STUDIO_ROW_NOTE,
  STUDIO_ROW_TITLE,
  VECTOR_FACES_URL,
  type GrownUpQuestion,
} from '../game/moreFromStudio';
import { MIN_TAP, SHAPE, THEME } from '../ui/theme';

/**
 * The "More from Paper Ship Studio" row in Settings, and the grown-up
 * check that has to be passed before the App Store opens. The rules are
 * in src/game/moreFromStudio.ts; this is only the drawing of them.
 *
 * `onInputFocus` / `onInputBlur` let the Settings page scroll the answer
 * box clear of the keyboard, the same way it does for the secret-code box.
 */
export function MoreFromStudio({
  onInputFocus,
  onInputBlur,
}: {
  onInputFocus?: () => void;
  onInputBlur?: () => void;
}) {
  const [question, setQuestion] = useState<GrownUpQuestion | null>(null);
  const [typed, setTyped] = useState('');
  const [wrong, setWrong] = useState(false);

  const close = () => {
    setQuestion(null);
    setTyped('');
    setWrong(false);
  };

  const check = () => {
    if (!question) return;
    playClick();
    if (isGrownUpAnswer(question, typed)) {
      close();
      void Linking.openURL(VECTOR_FACES_URL).catch(() => {});
      return;
    }
    // A fresh sum every time, so guessing does not wear it down.
    setQuestion(grownUpQuestion());
    setTyped('');
    setWrong(true);
  };

  return (
    <View>
      <Pressable
        style={styles.row}
        accessibilityRole="button"
        accessibilityHint="Asks a grown-up first, then opens the App Store"
        onPress={() => {
          playClick();
          if (question) close();
          else setQuestion(grownUpQuestion());
        }}
      >
        <View style={styles.text}>
          <Text style={styles.title}>{STUDIO_ROW_TITLE}</Text>
          <Text style={styles.note}>{STUDIO_ROW_NOTE}</Text>
        </View>
      </Pressable>
      {question && (
        <View style={styles.gate}>
          <Text style={styles.gateTitle}>Ask a grown-up</Text>
          <Text style={styles.gateNote}>
            {wrong ? "That's not it. Try this one: " : 'This opens the App Store. What is '}
            {question.a} × {question.b}?
          </Text>
          <View style={styles.answerRow}>
            <TextInput
              style={styles.answer}
              value={typed}
              onChangeText={(text) => setTyped(text.replace(/[^0-9]/g, '').slice(0, 3))}
              onSubmitEditing={check}
              onFocus={onInputFocus}
              onBlur={onInputBlur}
              keyboardType="number-pad"
              returnKeyType="go"
              maxLength={3}
              placeholder="Answer"
              placeholderTextColor="rgba(29,26,46,0.45)"
              accessibilityLabel={`What is ${question.a} times ${question.b}?`}
            />
            <Pressable style={styles.go} onPress={check} accessibilityRole="button">
              <Text style={styles.goText}>Open</Text>
            </Pressable>
          </View>
          <Pressable
            style={styles.notNow}
            onPress={() => {
              playClick();
              close();
            }}
          >
            <Text style={styles.notNowText}>Not now</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
    minHeight: MIN_TAP,
  },
  text: { flex: 1 },
  title: { color: THEME.ink, fontSize: 15, fontWeight: '700' },
  note: { color: THEME.inkSoft, fontSize: 12.5, fontWeight: '600', marginTop: 2 },
  gate: {
    marginTop: 6,
    padding: 12,
    gap: 6,
    borderRadius: SHAPE.radiusSm,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
    backgroundColor: THEME.surface,
  },
  gateTitle: { color: THEME.ink, fontSize: 14, fontWeight: '800' },
  gateNote: { color: THEME.ink, fontSize: 13.5, fontWeight: '600' },
  answerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  answer: {
    flex: 1,
    color: THEME.ink,
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: SHAPE.radiusSm,
    backgroundColor: THEME.sunk,
    borderWidth: SHAPE.line,
    borderColor: 'rgba(29,26,46,0.35)',
  },
  go: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: MIN_TAP,
    justifyContent: 'center',
    borderRadius: SHAPE.radiusSm,
    backgroundColor: THEME.gold,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
  },
  goText: { color: THEME.onGold, fontSize: 14, fontWeight: '800' },
  notNow: { alignSelf: 'flex-start', minHeight: MIN_TAP, justifyContent: 'center' },
  notNowText: { color: THEME.inkSoft, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
});
