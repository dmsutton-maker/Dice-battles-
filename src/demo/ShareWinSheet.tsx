import React from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { playClick } from '../audio/sounds';
import { CardLines } from '../share/shareCard';
import { MIN_TAP, SHAPE, THEME, TYPE } from '../ui/theme';
import { Popup } from './Popup';

/**
 * The sheet behind "Share your win": the finished picture, and two
 * buttons — Share, and Not now.
 *
 * The picture is made when the sheet opens (composeCard.ts), not when
 * the battle ends, so this starts on "Making your picture…" for the
 * half-second that takes. Nothing is sent anywhere until "Share" is
 * tapped, and then only to the phone's own share sheet.
 */
export type ShareSheetState =
  | { step: 'making' }
  | { step: 'ready'; uri: string; shareFailed: boolean }
  | { step: 'failed' };

export function ShareWinSheet({
  state,
  lines,
  pictureHeight,
  onShare,
  onClose,
}: {
  state: ShareSheetState;
  /** What the card says, for VoiceOver. */
  lines: CardLines;
  /** How tall the preview may be, so it fits the screen (or half of it). */
  pictureHeight: number;
  onShare: () => void;
  onClose: () => void;
}) {
  const size = { width: Math.round(pictureHeight * 0.8), height: pictureHeight };
  const label = [lines.score, lines.mode, lines.trophies, lines.title].filter(Boolean).join(', ');

  return (
    <Popup title="Share your win" onClose={onClose}>
      <View style={styles.body}>
        {state.step === 'ready' ? (
          <Image
            source={{ uri: state.uri }}
            style={[styles.picture, size]}
            accessibilityLabel={`Your winning picture: Victory! ${label}`}
          />
        ) : (
          <View style={[styles.picture, styles.placeholder, size]}>
            {state.step === 'making' ? (
              <>
                <ActivityIndicator color={THEME.ink} />
                <Text style={styles.placeholderText}>Making your picture…</Text>
              </>
            ) : (
              <Text style={styles.placeholderText}>Couldn't make the picture this time.</Text>
            )}
          </View>
        )}

        {state.step === 'ready' && state.shareFailed && (
          <Text style={styles.failed}>Couldn't open the share sheet. Nothing was sent.</Text>
        )}

        <View style={styles.buttons}>
          {state.step === 'ready' && (
            <Pressable
              style={styles.share}
              onPress={() => {
                playClick();
                onShare();
              }}
              accessibilityRole="button"
              accessibilityLabel="Share this picture"
            >
              <Text style={styles.shareText}>Share</Text>
            </Pressable>
          )}
          <Pressable
            style={styles.notNow}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={state.step === 'failed' ? 'Close' : 'Not now'}
          >
            <Text style={styles.notNowText}>{state.step === 'failed' ? 'OK' : 'Not now'}</Text>
          </Pressable>
        </View>
      </View>
    </Popup>
  );
}

const styles = StyleSheet.create({
  body: {
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  picture: {
    borderRadius: SHAPE.radiusSm,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
    backgroundColor: THEME.tile,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 10,
  },
  placeholderText: {
    color: THEME.inkSoft,
    ...TYPE.body,
    textAlign: 'center',
  },
  failed: {
    color: THEME.bad,
    ...TYPE.small,
    textAlign: 'center',
    marginTop: 10,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  share: {
    minHeight: MIN_TAP,
    paddingHorizontal: 26,
    paddingVertical: 12,
    borderRadius: SHAPE.radiusLg,
    backgroundColor: THEME.accent,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
    justifyContent: 'center',
  },
  shareText: {
    color: THEME.onAccent,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  notNow: {
    minHeight: MIN_TAP,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: SHAPE.radiusLg,
    backgroundColor: THEME.surface,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
    justifyContent: 'center',
  },
  notNowText: {
    color: THEME.ink,
    fontSize: 16,
    fontWeight: '800',
  },
});
