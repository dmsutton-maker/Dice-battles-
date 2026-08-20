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
            Swallows taps so pressing inside the panel — or missing a
            button by a few points — does not close it.
          */}
          <Pressable style={styles.panel} onPress={() => {}}>
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
                placeholderTextColor="rgba(255,255,255,0.4)"
                multiline
                maxLength={2000}
                autoFocus
              />
              {result && <Text style={styles.errorText}>{result}</Text>}
              <Pressable
                style={[styles.sendButton, sending && styles.sendButtonBusy]}
                onPress={send}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator color="#241c40" />
                ) : (
                  <Text style={styles.sendButtonText}>Send</Text>
                )}
              </Pressable>
            </>
          )}

          <Pressable
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
          </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,8,24,0.75)',
  },
  avoider: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 26,
  },
  panel: {
    backgroundColor: '#2c2450',
    borderRadius: 22,
    padding: 22,
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  input: {
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    color: '#ffffff',
    fontSize: 15,
    padding: 14,
    minHeight: 110,
    textAlignVertical: 'top',
  },
  errorText: {
    color: '#ffb3b3',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
    textAlign: 'center',
  },
  sendButton: {
    marginTop: 16,
    backgroundColor: '#ffe521',
    borderRadius: 20,
    paddingVertical: 13,
    alignItems: 'center',
  },
  sendButtonBusy: {
    opacity: 0.7,
  },
  sendButtonText: {
    color: '#241c40',
    fontSize: 16,
    fontWeight: '900',
  },
  sentBox: {
    backgroundColor: 'rgba(51,204,107,0.16)',
    borderWidth: 1,
    borderColor: '#33cc6b',
    borderRadius: 14,
    padding: 16,
    marginBottom: 4,
  },
  sentText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  closeButton: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '700',
  },
});
