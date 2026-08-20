import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TIERS } from '../game/progress';
import { playClick, playEquip } from '../audio/sounds';
import { ARENAS, ArenaId } from '../arena/arenas';
import { DICE_SKINS } from '../game/diceSkins';
import {
  ARENA_ORDER,
  ARENA_UNLOCKS,
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
  onEquipArena: (id: ArenaId) => void;
  onEquipSkin: (id: string) => void;
  onClose: () => void;
}

function priceFor(unlockId: string): number {
  return TIERS.find((t) => t.id === unlockId)?.at ?? 0;
}

export function InventoryScreen({
  trophies,
  arenaId,
  skinId,
  onEquipArena,
  onEquipSkin,
  onClose,
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
          Where your battles are fought. Every battlefield plays exactly the
          same — only the view changes. Hills and moats come from the
          difficulty you pick, not from the arena.
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
                disabled={!unlocked}
                onPress={() => {
                  playEquip();
                  onEquipArena(id);
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
                  <Text style={styles.tapTag}>Tap to use</Text>
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
          Only the shell changes — the six face colours always stay the same,
          so a match is always a match. Plain colours are earned with
          trophies; patterned ones are bought in the Store with coins.
        </Text>
        <View style={styles.grid}>
          {DICE_SKINS.map((skin) => {
            const unlocked = isSkinUnlocked(skin.id, trophies);
            const equipped = skinId === skin.id;
            return (
              <Pressable
                key={skin.id}
                disabled={!unlocked}
                onPress={() => {
                  playEquip();
                  onEquipSkin(skin.id);
                }}
                style={[
                  styles.card,
                  equipped && styles.cardEquipped,
                  !unlocked && styles.cardLocked,
                ]}
              >
                {/* A little die drawn in the skin's own shell colour. */}
                <View style={[styles.swatch, { backgroundColor: skin.body }]}>
                  <View style={styles.pipRow}>
                    <View style={[styles.pip, { backgroundColor: '#cc2533' }]} />
                    <View style={[styles.pip, { backgroundColor: '#043fe0' }]} />
                  </View>
                </View>
                <Text style={[styles.cardName, !unlocked && styles.lockedText]}>
                  {skin.emoji} {skin.name}
                </Text>
                {equipped ? (
                  <Text style={styles.equippedTag}>EQUIPPED</Text>
                ) : unlocked ? (
                  <Text style={styles.tapTag}>Tap to use</Text>
                ) : skin.price !== undefined ? (
                  <Text style={styles.priceTag}>🛒 {skin.price} 🪙</Text>
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

      <Pressable
        style={styles.doneButton}
        onPress={() => {
          playClick();
          onClose();
        }}
      >
        <Text style={styles.doneText}>Done</Text>
      </Pressable>
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
  priceTag: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 3,
  },
  doneButton: {
    alignSelf: 'center',
    paddingHorizontal: 40,
    paddingVertical: 13,
    borderRadius: 24,
    backgroundColor: '#ffe521',
  },
  doneText: {
    color: '#241c40',
    fontSize: 16,
    fontWeight: '900',
  },
});
