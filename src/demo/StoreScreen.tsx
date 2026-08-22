import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { STORE_SKINS } from '../game/diceSkins';
import { MENU_PAGE_AREA } from './BottomNav';
import { COIN_REWARDS, Wallet } from '../game/currency';
import { rangeLabel } from '../game/rewards';
import { playClick } from '../audio/sounds';
import { CoinLabel } from './GoldCoin';
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
  /**
   * Passed in rather than read here, because buying now happens in the
   * preview. This screen is mounted the whole time a preview is open over
   * it, so reading the wallet once on mount would leave it showing the old
   * balance and the old OWNED tags the moment you came back.
   */
  wallet: Wallet;
  /** Opens the die on the real battlefield, where it is bought. */
  onPreview: (skinId: string) => void;
}

export function StoreScreen({ wallet, onPreview }: StoreScreenProps) {
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
          Tap any dice to see them on the battlefield before you spend a
          coin — that is where you buy them too. Only the shell changes: the
          six colours on the faces are the same on every set, so a match is
          always a match.
        </Text>
        <Text style={styles.sectionNote}>
          Coins come from playing. {rangeLabel(COIN_REWARDS.easy.win)} for an
          Easy win, up to {rangeLabel(COIN_REWARDS.hard.win)} on Hard, and
          losing still pays a little — it never costs you coins.
        </Text>

        <View style={styles.grid}>
          {STORE_SKINS.map((skin) => {
            const bought = wallet.owned.includes(skin.id);
            const affordable = wallet.coins >= skin.price!;
            return (
              <Pressable
                key={skin.id}
                // Owned dice are still tappable now: the preview is where
                // you put them on, so a card you cannot open is a dead end.
                onPress={() => {
                  playClick();
                  onPreview(skin.id);
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
                  <CoinLabel
                    size={13}
                    style={[styles.priceText, !affordable && styles.priceShort]}
                    containerStyle={styles.priceRow}
                  >
                    {skin.price}
                  </CoinLabel>
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
    ...MENU_PAGE_AREA,
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
  priceText: { color: '#ffe521', fontSize: 12, fontWeight: '900' },
  priceRow: { marginTop: 3 },
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
});
