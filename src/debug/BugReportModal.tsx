import React, { useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { sendBugReport } from './bugReport';
import { Card, PrimaryButton, SecondaryButton } from '../ui/Card';
import { SHAPE, THEME, TYPE } from '../ui/theme';

/**
 * The whole point of this screen is to make reporting a bug take under
 * ten seconds: one box, one button, nothing to fill in that the game
 * can already work out for itself (device, OS, version — attached
 * automatically, never asked for).
 */
interface BugReportModalProps {
  visible: boolean;
  onClose: () => void;
}

export function BugReportModal({ visible, onClose }: BugReportModalProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const reset = () => {
    setMessage('');
    setResult(null);
    setSent(false);
  };

  const send = async () => {
    setSending(true);
    setResult(null);
    const outcome = await sendBugReport(message);
    setSending(false);
    setResult(outcome.message);
    if (outcome.ok) {
      setSent(true);
      setMessage('');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      {/*
        The panel is centred in the screen and the box takes focus on open,
        so the keyboard used to come up over the bottom of it — taking the
        Cancel button with it. There was no way out of this screen without
        sending a report you did not want to send.

        Two ways out now. The panel lifts clear of the keyboard, and
        tapping the dimmed area behind it closes the whole thing.
      */}
      <Pressable
        style={styles.backdrop}
        onPress={() => {
          Keyboard.dismiss();
          reset();
          onClose();
        }}
      >
        <KeyboardAvoidingView
          /*
            flex: 1 and the centring live HERE, not on the backdrop. With
            `behavior="padding"` the view grows its OWN box, so centring it
            from outside means each frame of padding also re-centres the
            panel, and it settles over several layout passes rather than
            one. Full-bleed with the centring inside, the panel is placed
            once, deterministically.
          */
          style={styles.avoider}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/*
            Two layers on purpose. The Pressable swallows taps so that
            pressing inside the panel — or missing a button by a few
            points — does not close it and discard what you typed. The
            Card is the panel itself and takes NO onPress, because Card
            renders a pressed state: the face drops onto its own shadow,
            so a Card with a do-nothing handler would visibly depress
            every time you touched anywhere inside the report, including
            while typing.
          */}
          <Pressable onPress={() => {}}>
            <Card style={styles.panel} radius={SHAPE.radiusLg}>
          <Text style={styles.title}>🐞 Report a Bug</Text>
          <Text style={styles.subtitle}>
            What happened? Your device and game version are attached
            automatically — you don&apos;t need to type those.
          </Text>

          {sent ? (
            <View style={styles.sentBox}>
              <Text style={styles.sentText}>{result}</Text>
            </View>
          ) : (
            <>
              <TextInput
                style={styles.input}
                value={message}
                onChangeText={setMessage}
                placeholder="The dice got stuck when…"
                placeholderTextColor={THEME.inkFaint}
                multiline
                maxLength={2000}
                autoFocus
              />
              {result && <Text style={styles.errorText}>{result}</Text>}
              <PrimaryButton
                onPress={sending ? undefined : send}
                style={sending ? styles.sendBusy : undefined}
              >
                {sending ? (
                  <ActivityIndicator color={THEME.onAccent} />
                ) : (
                  <Text style={styles.sendButtonText}>Send</Text>
                )}
              </PrimaryButton>
            </>
          )}

          <SecondaryButton
            style={styles.closeButton}
            onPress={() => {
              Keyboard.dismiss();
              reset();
              onClose();
            }}
          >
            <Text style={styles.closeButtonText}>
              {sent ? 'Done' : 'Cancel'}
            </Text>
          </SecondaryButton>
            </Card>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Ink at low opacity, not black: the dim behind a Paper & Ink panel is
  // the same ink everything else is drawn in, just thinned.
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(29,26,46,0.55)',
  },
  avoider: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 26,
  },
  panel: {
    padding: 22,
  },
  title: {
    ...TYPE.heading,
    color: THEME.ink,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    ...TYPE.body,
    color: THEME.inkSoft,
    textAlign: 'center',
    marginBottom: 16,
  },
  // The one sunk surface on the panel, so the box you type in reads as a
  // well cut into the card rather than another card on top of it.
  input: {
    backgroundColor: THEME.sunk,
    borderRadius: SHAPE.radiusSm,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
    color: THEME.ink,
    fontSize: 15,
    fontWeight: '600',
    padding: 14,
    minHeight: 110,
    textAlignVertical: 'top',
  },
  errorText: {
    ...TYPE.small,
    color: THEME.bad,
    marginTop: 10,
    textAlign: 'center',
  },
  sendBusy: {
    opacity: 0.7,
  },
  sendButtonText: {
    ...TYPE.cardTitle,
    color: THEME.onAccent,
  },
  // A gain, so it takes the good ink rather than a green of its own.
  sentBox: {
    backgroundColor: THEME.sunk,
    borderWidth: SHAPE.line,
    borderColor: THEME.good,
    borderRadius: SHAPE.radiusSm,
    padding: 16,
    marginBottom: 4,
  },
  sentText: {
    ...TYPE.body,
    fontSize: 15,
    color: THEME.ink,
    textAlign: 'center',
  },
  closeButton: {
    marginTop: 12,
  },
  closeButtonText: {
    ...TYPE.body,
    color: THEME.ink,
  },
});
