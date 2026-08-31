import React, { useEffect, useRef } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TIERS } from '../game/progress';
import { playClick } from '../audio/sounds';
import { MENU_PAGE_AREA } from './BottomNav';
import { recallScroll, rememberScroll } from './menuScroll';
import { TrophyIcon } from '../ui/Icon';
import { SHAPE, THEME, TYPE } from '../ui/theme';
import { PreviewTarget } from '../game/itemPreview';
import { CoinLabel } from './GoldCoin';
import { DiceSwatch } from './DiceSwatch';
import { ARENAS, ArenaId } from '../arena/arenas';
import { ARENA_ART } from '../arena/arenaArt';
import {
  ARENA_ORDER,
  ARENA_UNLOCKS,
  INVENTORY_SKIN_ORDER,
  isArenaUnlocked,
  isSkinUnlocked,
  ARENA_PRICES,
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
  const scrollRef = useRef<ScrollView>(null);
  // Restore before the first paint the player sees.
  useEffect(() => {
    const y = recallScroll('inventory');
    if (y > 0) scrollRef.current?.scrollTo({ y, animated: false });
  }, []);

  return (
    <View style={styles.overlay}>
      <View style={styles.header}>
        <Text style={styles.title}>Inventory</Text>
        <View style={styles.trophies}>
          <TrophyIcon size={16} />
          <Text style={styles.trophiesText}>{trophies}</Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        /*
          Opening a preview unmounts this page, so the offset is kept
          outside the component (menuScroll.ts) and put back on the way
          in. `animated: false` because this is not a movement the
          player made — it is where they already were.
        */
        onScroll={(e) => rememberScroll('inventory', e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={64}
      >
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
                  onPreview({ kind: 'die', id: skin.id, from: 'inventory' });
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
                  {skin.name}
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
                    {skin.price}
                  </CoinLabel>
                ) : (
                  <View style={styles.priceTagRow}>
                    <TrophyIcon size={11} color={THEME.inkFaint} />
                    <Text style={styles.priceTag}>
                      {priceFor(skin.unlock!)}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

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
            // Every arena shows its real name and its picture, locked or
            // not — you cannot want what you cannot see.
            const label = { name: arena.name };

            return (
              <Pressable
                key={id}
                // Locked items open too: seeing the battlefield you are
                // saving for is the reason a locked card is shown at all.
                onPress={() => {
                  playClick();
                  onPreview({ kind: 'arena', id, from: 'inventory' });
                }}
                style={[
                  styles.card,
                  equipped && styles.cardEquipped,
                  !unlocked && styles.cardLocked,
                ]}
              >
                <Image
                  source={ARENA_ART[id]}
                  // The sky sits underneath as the colour the picture
                  // opens on, so a card is never a white hole for the
                  // frame it takes the image to decode.
                  style={[styles.swatch, { backgroundColor: arena.skyColor }]}
                  accessibilityIgnoresInvertColors
                />
                <Text style={[styles.cardName, !unlocked && styles.lockedText]}>
                  {label.name}
                </Text>
                {equipped ? (
                  <Text style={styles.equippedTag}>EQUIPPED</Text>
                ) : unlocked ? (
                  <Text style={styles.tapTag}>Tap to see</Text>
                ) : ARENA_PRICES[id] !== undefined ? (
                  // Sold in the Store, so the tag is a coin price. The
                  // preview it opens says "In the Store for N" — coins
                  // are only ever spent there, same as for dice.
                  <CoinLabel
                    size={11}
                    style={styles.priceTag}
                    containerStyle={styles.priceTagRow}
                  >
                    {ARENA_PRICES[id]}
                  </CoinLabel>
                ) : (
                  <View style={styles.priceTagRow}>
                    <TrophyIcon size={11} color={THEME.inkFaint} />
                    <Text style={styles.priceTag}>
                      {priceFor(ARENA_UNLOCKS[id]!)}
                    </Text>
                  </View>
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
    backgroundColor: THEME.ground,
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
    color: THEME.ink,
    ...TYPE.title,
  },
  trophies: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  trophiesText: {
    color: THEME.ink,
    fontSize: 18,
    fontWeight: '800',
  },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  sectionTitle: {
    color: THEME.inkFaint,
    ...TYPE.label,
    letterSpacing: 2,
    marginTop: 14,
    marginBottom: 10,
    marginLeft: 4,
  },
  sectionNote: {
    color: THEME.inkSoft,
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
    borderRadius: SHAPE.radius,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    backgroundColor: THEME.surface,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
  },
  cardEquipped: {
    // A gold wash under the same ink outline — the BottomNav's selected
    // treatment, so "chosen" looks the same everywhere.
    backgroundColor: 'rgba(255,210,31,0.30)',
  },
  /*
   * Sunk into the table rather than dimmed with opacity: fading the whole
   * card dragged its name under the 4.5:1 floor on paper. The price is
   * the thing a locked card exists to say.
   */
  cardLocked: {
    backgroundColor: THEME.sunk,
    borderColor: 'rgba(29,26,46,0.35)',
  },
  /*
    The battlefield's picture. `overflow: hidden` matters: the art is a
    square and this corner radius is what makes it sit in the card rather
    than on top of it.
  */
  swatch: {
    width: 58,
    height: 58,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(29,26,46,0.25)',
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
    color: THEME.ink,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  lockedText: {
    color: THEME.inkSoft,
  },
  equippedTag: {
    color: THEME.ink,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
    marginTop: 3,
  },
  tapTag: {
    color: THEME.inkFaint,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
  },
  priceTagText: {
    color: THEME.inkFaint,
    fontSize: 10,
    fontWeight: '800',
  },
  priceTag: {
    color: THEME.inkFaint,
    fontSize: 10,
    fontWeight: '800',
  },
  // The drawn coin or trophy sits beside the text rather than inside it,
  // so the gap under the card belongs to the row, not to the number.
  priceTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
});
