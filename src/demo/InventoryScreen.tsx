import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TIERS } from '../game/progress';
import { playClick } from '../audio/sounds';
import { MENU_PAGE_AREA } from './BottomNav';
import { PreviewTarget } from '../game/itemPreview';
import { CoinLabel } from './GoldCoin';
import { DiceSwatch } from './DiceSwatch';
import { ARENAS, ArenaId } from '../arena/arenas';
import {
  ARENA_ORDER,
  ARENA_UNLOCKS,
  INVENTORY_SKIN_ORDER,
  isArenaUnlocked,
  isSkinUnlocked,
} from '../game/loadout';

/**
 * The Inventory: everything cosmetic the player has earned, in one place.
 * Battlefields and dice are chosen here rather than on the start screen, so
 * the pre-battle screen stays about the battle.
 *
 * Locked items are shown, not hidden — seeing the next reward and its price
 * is the point of a trophy ladder.
 */
interface InventoryScreenProps {
  trophies: number;
  arenaId: ArenaId;
  skinId: string;
  /**
   * Opens the item on the real battlefield. Equipping happens there now,
   * not here — a 58pt thumbnail is not enough to choose from, and it was
   * never enough to tell Frost from Starry.
   */
  onPreview: (target: PreviewTarget) => void;
}

function priceFor(unlockId: string): number {
  return TIERS.find((t) => t.id === unlockId)?.at ?? 0;
}

export function InventoryScreen({
  trophies,
  arenaId,
  skinId,
  onPreview,
}: InventoryScreenProps) {
  return (
    <View style={styles.overlay}>
      <View style={styles.header}>
        <Text style={styles.title}>🎒 INVENTORY</Text>
        <Text style={styles.trophies}>🏆 {trophies}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>BATTLEFIELDS</Text>
        <Text style={styles.sectionNote}>
          Tap one to stand on it and look around before you choose. Every
          battlefield plays exactly the same — only the view changes. Hills
          and moats come from the difficulty you pick, not from the arena.
        </Text>
        <View style={styles.grid}>
          {ARENA_ORDER.map((id) => {
            const arena = ARENAS[id];
            const unlocked = isArenaUnlocked(id, trophies);
            const equipped = arenaId === id;
            // Every arena shows its real name and sky, locked or not —
            // you cannot want what you cannot see.
            const label = { name: arena.name, emoji: arena.emoji };

            return (
              <Pressable
                key={id}
                // Locked items open too: seeing the battlefield you are
                // saving for is the reason a locked card is shown at all.
                onPress={() => {
                  playClick();
                  onPreview({ kind: 'arena', id });
                }}
                style={[
                  styles.card,
                  equipped && styles.cardEquipped,
                  !unlocked && styles.cardLocked,
                ]}
              >
                <View
                  style={[
                    styles.swatch,
                    { backgroundColor: arena.skyColor },
                  ]}
                >
                  <Text style={styles.swatchEmoji}>{label.emoji}</Text>
                </View>
                <Text style={[styles.cardName, !unlocked && styles.lockedText]}>
                  {label.name}
                </Text>
                {equipped ? (
                  <Text style={styles.equippedTag}>EQUIPPED</Text>
                ) : unlocked ? (
                  <Text style={styles.tapTag}>Tap to see</Text>
                ) : (
                  <Text style={styles.priceTag}>
                    🔒 {priceFor(ARENA_UNLOCKS[id])} 🏆
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>DICE</Text>
        <Text style={styles.sectionNote}>
          Tap a set to see it out on the board, and use it from there. Only
          the shell changes — the six face colours always stay the same, so a
          match is always a match. Plain colours are earned with trophies;
          patterned ones are bought in the Store with coins.
        </Text>
        <View style={styles.grid}>
          {INVENTORY_SKIN_ORDER.map((skin) => {
            const unlocked = isSkinUnlocked(skin.id, trophies);
            const equipped = skinId === skin.id;
            return (
              <Pressable
                key={skin.id}
                onPress={() => {
                  playClick();
                  onPreview({ kind: 'die', id: skin.id });
                }}
                style={[
                  styles.card,
                  equipped && styles.cardEquipped,
                  !unlocked && styles.cardLocked,
                ]}
              >
                {/* The real shell, same painter as the dice in play. */}
                <DiceSwatch skin={skin} size={58} />
                <Text style={[styles.cardName, !unlocked && styles.lockedText]}>
                  {skin.emoji} {skin.name}
                </Text>
                {equipped ? (
                  <Text style={styles.equippedTag}>EQUIPPED</Text>
                ) : unlocked ? (
                  <Text style={styles.tapTag}>Tap to see</Text>
                ) : skin.price !== undefined ? (
                  <CoinLabel
                    coinFirst={false}
                    size={12}
                    style={styles.priceTagText}
                    containerStyle={styles.priceTagRow}
                  >
                    🛒 {skin.price}
                  </CoinLabel>
                ) : (
                  <Text style={styles.priceTag}>
                    🔒 {priceFor(skin.unlock!)} 🏆
                  </Text>
                )}
              </Pressable>
            );
          })}
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
    marginBottom: 14,
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  trophies: {
    color: '#ffe521',
    fontSize: 18,
    fontWeight: '800',
  },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 14,
    marginBottom: 10,
    marginLeft: 4,
  },
  sectionNote: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
    marginLeft: 4,
    marginTop: -4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
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
  cardEquipped: {
    borderColor: '#ffe521',
    backgroundColor: 'rgba(255,229,33,0.16)',
  },
  cardLocked: {
    opacity: 0.55,
  },
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
  swatchEmoji: {
    fontSize: 26,
  },
  pipRow: {
    flexDirection: 'row',
    gap: 6,
  },
  pip: {
    width: 13,
    height: 13,
    borderRadius: 7,
  },
  cardName: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  lockedText: {
    color: 'rgba(255,255,255,0.7)',
  },
  equippedTag: {
    color: '#ffe521',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
    marginTop: 3,
  },
  tapTag: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
  },
  priceTagText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '800',
  },
  priceTag: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 3,
  },
  // The drawn coin sits beside the text rather than inside it, so the gap
  // under the card belongs to the row, not to the number.
  priceTagRow: {
    marginTop: 3,
  },
});
