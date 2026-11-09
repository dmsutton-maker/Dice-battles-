import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { playClick } from '../audio/sounds';
import { PrimaryButton, SecondaryButton } from '../ui/Card';
import { THEME, TYPE } from '../ui/theme';
import { adoptAccount, type CarriedAccount } from '../game/icloudAccount';
import { Popup } from './Popup';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "today", "yesterday", or "4 Nov". */
export function playedWhen(savedAt: number, now: number): string {
  const day = (t: number) => new Date(t).toDateString();
  if (day(savedAt) === day(now)) return 'today';
  if (day(savedAt) === day(now - 86_400_000)) return 'yesterday';
  const d = new Date(savedAt);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/**
 * "Is this you?" — a new iPhone, and the player's iCloud knows players
 * who have played before (icloudAccount.ts). Shown by name and trophies,
 * because one Apple ID is often shared by a family's phones.
 */
export function AccountPickPopup({
  accounts,
  onNew,
}: {
  accounts: CarriedAccount[];
  /** "I'm a new player", or the ✕. */
  onNew: () => void;
}) {
  const [state, setState] = useState<'choose' | 'working' | 'restart' | 'failed'>('choose');
  const now = Date.now();
  const shown = accounts.slice(0, 5);

  const pick = (account: CarriedAccount) => {
    playClick();
    setState('working');
    void adoptAccount(account).then((result) => {
      if (result === 'restart') setState('restart');
      if (result === 'failed') setState('failed');
    });
  };

  return (
    <Popup title="Is this you?" onClose={state === 'working' ? () => {} : onNew}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
        {state === 'working' && <Text style={styles.lead}>Bringing your game back…</Text>}
        {state === 'restart' && (
          <Text style={styles.lead}>Done! Close the game and open it again to carry on where you left off.</Text>
        )}
        {(state === 'choose' || state === 'failed') && (
          <>
            <Text style={styles.lead}>
              {state === 'failed'
                ? "That didn't work, and nothing was changed. You can try again."
                : 'This iPhone is new to Dice Battles, but your iCloud has played before. Pick your player to bring back your trophies, coins, items and friends.'}
            </Text>
            {shown.map((account) => (
              <View key={account.playerId} style={styles.player}>
                <Text style={styles.name} numberOfLines={1}>
                  {account.name}
                </Text>
                <Text style={styles.stats}>
                  {account.trophies.toLocaleString()} trophies · last played {playedWhen(account.savedAt, now)}
                </Text>
                <PrimaryButton style={styles.pick} onPress={() => pick(account)}>
                  <Text style={styles.pickText}>That's me</Text>
                </PrimaryButton>
              </View>
            ))}
            <Text style={styles.note}>Things bought with real money come back with "Bought before? Put it back" at the bottom of the Shop.</Text>
            <SecondaryButton
              style={styles.skip}
              onPress={() => {
                playClick();
                onNew();
              }}
            >
              <Text style={styles.skipText}>I'm a new player</Text>
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
  player: {
    borderWidth: 2,
    borderColor: THEME.ink,
    borderRadius: 14,
    padding: 12,
    gap: 4,
    backgroundColor: '#FFFFFF',
  },
  name: { ...TYPE.body, color: THEME.ink, fontWeight: '800' },
  stats: { ...TYPE.small, color: THEME.inkSoft, fontWeight: '700' },
  pick: { marginTop: 8, paddingVertical: 12 },
  pickText: { ...TYPE.body, color: '#FFFFFF', fontWeight: '900' },
  note: { ...TYPE.small, color: THEME.inkSoft },
  skip: { paddingVertical: 12 },
  skipText: { ...TYPE.body, color: THEME.ink, fontWeight: '800' },
});
