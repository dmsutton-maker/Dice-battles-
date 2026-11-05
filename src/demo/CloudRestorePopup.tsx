import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { playClick } from '../audio/sounds';
import { PrimaryButton, SecondaryButton } from '../ui/Card';
import { THEME, TYPE } from '../ui/theme';
import { savedWhen, type CloudSave } from '../game/cloudSaveCore';
import { restoreFromCloud } from '../game/cloudSave';
import { Popup } from './Popup';

/**
 * "Welcome back": a saved game found in the player's iCloud.
 *
 * 'welcome' is a new install being offered its old progress; 'settings'
 * is the player choosing to bring a save onto a phone that already has
 * progress, which replaces it, so it says so.
 *
 * Every save is shown by name, trophies and coins, because a family on
 * one Apple ID can have several, one per child's phone (cloudSaveCore.ts).
 */
export function CloudRestorePopup({
  saves,
  mode,
  onClose,
}: {
  saves: CloudSave[];
  mode: 'welcome' | 'settings';
  /** Closed without restoring: "Start a new game", ✕, or nothing to restore. */
  onClose: () => void;
}) {
  const [state, setState] = useState<'choose' | 'restoring' | 'restart' | 'failed'>('choose');
  const now = Date.now();
  const shown = saves.slice(0, 4);

  const restore = (save: CloudSave) => {
    playClick();
    setState('restoring');
    void restoreFromCloud(save).then((result) => {
      // 'reloading' means the game is already restarting on the save.
      if (result === 'restart') setState('restart');
      if (result === 'failed') setState('failed');
    });
  };

  const title = mode === 'welcome' ? 'Welcome back!' : 'Saved games in iCloud';

  return (
    <Popup title={title} onClose={state === 'restoring' ? () => {} : onClose}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
        {state === 'restoring' && <Text style={styles.lead}>Bringing your game back…</Text>}
        {state === 'restart' && (
          <Text style={styles.lead}>Done! Close the game and open it again to carry on where you left off.</Text>
        )}
        {state === 'failed' && (
          <Text style={styles.lead}>That didn't work. Nothing on this phone was changed, so you can try again.</Text>
        )}

        {(state === 'choose' || state === 'failed') && (
          <>
            {shown.length === 0 ? (
              <Text style={styles.lead}>
                There are no other saved games in your iCloud. This phone's progress saves itself after every game.
              </Text>
            ) : (
              <Text style={styles.lead}>
                {mode === 'welcome'
                  ? shown.length === 1
                    ? 'We found your saved game in iCloud. Pick up where you left off?'
                    : 'We found saved games in iCloud. Which one is yours?'
                  : 'Bringing a saved game onto this phone replaces the progress on it now.'}
              </Text>
            )}

            {shown.map((save) => (
              <View key={save.slot} style={styles.save}>
                <Text style={styles.name} numberOfLines={1}>
                  {save.name}
                </Text>
                <Text style={styles.stats}>
                  {save.trophies.toLocaleString()} trophies · {save.coins.toLocaleString()} coins · saved{' '}
                  {savedWhen(save.savedAt, now)}
                </Text>
                <PrimaryButton style={styles.restore} onPress={() => restore(save)}>
                  <Text style={styles.restoreText}>{shown.length === 1 ? 'Restore my game' : 'This one is mine'}</Text>
                </PrimaryButton>
              </View>
            ))}

            {shown.length > 0 && (
              <Text style={styles.note}>
                Things bought with real money come back with Restore Purchases in Settings.
              </Text>
            )}

            <SecondaryButton
              style={styles.skip}
              onPress={() => {
                playClick();
                onClose();
              }}
            >
              <Text style={styles.skipText}>
                {mode === 'welcome' && shown.length > 0 ? 'Start a new game' : 'Close'}
              </Text>
            </SecondaryButton>
          </>
        )}
      </ScrollView>
    </Popup>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 520 },
  body: { paddingBottom: 6, gap: 12 },
  lead: { ...TYPE.body, color: THEME.ink, lineHeight: 22 },
  save: {
    borderWidth: 2,
    borderColor: THEME.ink,
    borderRadius: 14,
    padding: 12,
    gap: 4,
    backgroundColor: '#FFFFFF',
  },
  name: { ...TYPE.body, color: THEME.ink, fontWeight: '800' },
  stats: { ...TYPE.small, color: THEME.inkSoft, fontWeight: '700' },
  restore: { marginTop: 8, paddingVertical: 12 },
  restoreText: { ...TYPE.body, color: '#FFFFFF', fontWeight: '900' },
  note: { ...TYPE.small, color: THEME.inkSoft },
  skip: { paddingVertical: 12 },
  skipText: { ...TYPE.body, color: THEME.ink, fontWeight: '800' },
});
