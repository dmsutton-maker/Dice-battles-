import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { STORE_SKINS } from '../game/diceSkins';
import { buyWithCoins, COIN_REWARDS, getWallet, owns } from '../game/currency';
import { rangeLabel } from '../game/rewards';
import { Reward } from './RewardPopup';
import { playClick } from '../audio/sounds';
import { DiceSwatch } from './DiceSwatch';

/**
 * The Store: spend coins earned by playing.
 *
 * Every item is cosmetic. Nothing here touches the six face colours, the
 * dice physics, or the opponent — so nothing bought can win a battle. That
 * is a promise worth keeping visible, which is why it is printed on the
 * screen rather than only being true in the code.
 */
interface StoreScreenProps {
  /** Reports what was bought, so the reward popup can celebrate it. */
  onPurchase: (bought: Reward | null) => void;
}

export function StoreScreen({ onPurchase }: StoreScreenProps) {
  const [wallet, setWallet] = useState(getWallet());
  const [message, setMessage] = useState<string | null>(null);

  const buy = (id: string, price: number, name: string, emoji: string) => {
    const result = buyWithCoins(id, price);
    if (result.ok) {
      setWallet({ ...getWallet() });
      setMessage(null);
      onPurchase({
        emoji,
        name,
        kicker: 'PURCHASED',
        note: 'Head to the Inventory to equip it.',
      });
    } else if (result.reason === 'too-expensive') {
      setMessage(`${name} costs ${price} coins — keep battling!`);
    }
  };

  return (
    <View style={styles.overlay}>
      {/* No coin count here — the shared HUD shows it on every screen. */}
      <View style={styles.header}>
        <Text style={styles.title}>🛒 STORE</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.note}>
          Everything here is decoration. Nothing you buy changes the dice,
          the battlefield or your opponent — so nothing here can win you a
          battle.
        </Text>

        <Text style={styles.sectionTitle}>PATTERNED DICE</Text>
        <Text style={styles.sectionNote}>
          Earn coins every battle: {rangeLabel(COIN_REWARDS.easy.win)} for an
          Easy win, up to {rangeLabel(COIN_REWARDS.hard.win)} on Hard. Losing
          still pays a little — it never costs you coins.
        </Text>

        <View style={styles.grid}>
          {STORE_SKINS.map((skin) => {
            const bought = owns(skin.id);
            const affordable = wallet.coins >= skin.price!;
            return (
              <Pressable
                key={skin.id}
                disabled={bought}
                onPress={() => {
                  playClick();
                  buy(skin.id, skin.price!, skin.name, skin.emoji);
                }}
                style={[
                  styles.card,
                  bought && styles.cardOwned,
                  !bought && !affordable && styles.cardLocked,
                ]}
              >
                <DiceSwatch skin={skin} size={58} />
                <Text style={styles.cardName}>{skin.name}</Text>
                {bought ? (
                  <Text style={styles.ownedTag}>OWNED</Text>
                ) : (
                  <Text style={[styles.price, !affordable && styles.priceShort]}>
                    🪙 {skin.price}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>COIN PACKS</Text>
        <View style={styles.comingSoon}>
          <Text style={styles.comingTitle}>Not open yet</Text>
          <Text style={styles.comingBody}>
            Buying coins with real money needs the App Store payment setup
            finished first. Until then every coin is earned by playing —
            which is the only way to get anything in the game right now.
          </Text>
        </View>
      </ScrollView>

      {message && <Text style={styles.message}>{message}</Text>}

      {/*
        No Done button. It used to sit here and it never worked: the tab
        bar is drawn on top of this screen with an opaque background and a
        higher zIndex, so the button was both invisible and untappable —
        a tap in that spot hit whichever tab was over it. The bar IS the
        way out of these pages, the way it already is on Settings and
        Cups.
      */}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    // Solid, not 96%: the arena used to show faintly through every
    // menu. Only the battle screen shows the board now.
    backgroundColor: '#141028',
    // Above the Home screen's settings gear (zIndex 5), which used to
    // float on top of these screens and sit over their headers.
    zIndex: 20,
    paddingTop: 100,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    marginBottom: 10,
  },
  title: { color: '#ffffff', fontSize: 22, fontWeight: '900', letterSpacing: 1.5 },
  coins: { color: '#ffe521', fontSize: 18, fontWeight: '800' },
  scroll: { paddingHorizontal: 16, paddingBottom: 16 },
  note: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    marginLeft: 4,
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 16,
    marginBottom: 6,
    marginLeft: 4,
  },
  sectionNote: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
    marginLeft: 4,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '31%',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  cardOwned: { borderColor: '#33cc6b', backgroundColor: 'rgba(51,204,107,0.14)' },
  cardLocked: { opacity: 0.6 },
  swatch: {
    width: 58,
    height: 58,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
  },
  swatchEmoji: { fontSize: 24 },
  cardName: { color: '#ffffff', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  price: { color: '#ffe521', fontSize: 12, fontWeight: '900', marginTop: 3 },
  priceShort: { color: 'rgba(255,255,255,0.55)' },
  ownedTag: {
    color: '#33cc6b',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
    marginTop: 3,
  },
  comingSoon: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    padding: 14,
    gap: 6,
  },
  comingTitle: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  comingBody: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  message: {
    color: '#ffe521',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  doneText: { color: '#241c40', fontSize: 16, fontWeight: '900' },
});
