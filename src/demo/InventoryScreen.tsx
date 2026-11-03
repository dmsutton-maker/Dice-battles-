import React, { memo, useCallback, useEffect, useRef } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useGridCardWidth } from './grid';
import { playClick } from '../audio/sounds';
import { MENU_PAGE_EDGES, useMenuPageArea } from './BottomNav';
import { recallScroll, rememberScroll } from './menuScroll';
import { SHAPE, THEME, TYPE } from '../ui/theme';
import { PreviewTarget } from '../game/itemPreview';
import { DiceSwatch } from './DiceSwatch';
import { ARENAS, ArenaId } from '../arena/arenas';
import type { DiceSkin } from '../game/diceSkins';
import { ARENA_ART } from '../arena/arenaArt';
import {
  inventoryArenas,
  inventoryDice,
  onlyStarters,
  STARTING_ARENAS,
  STARTING_DICE,
} from '../game/inventoryRules';

/**
 * The Inventory: the player's cupboard. Everything cosmetic they OWN, in
 * one place, and nothing else. Battlefields and dice are chosen here
 * rather than on the start screen, so the pre-battle screen stays about
 * the battle.
 *
 * ONLY WHAT IS OWNED, since 1 Nov 2026. David: "Take the future season
 * stuff and anything not owned by a player out of their inventory so
 * they can only view it in the store or gold pass, wherever they're
 * from." It used to list every die and battlefield in the game with a
 * locked card and a tag for where it came from — including Sun & Moon,
 * whose season is not until June 2027. Now an unowned thing is seen on
 * the shelf it comes from (the Store, the Gold Pass and cup cards in
 * Cups, the ladder in Records), a future season's nowhere at all. Which
 * items qualify is decided in game/inventoryRules.ts, where the tests can
 * read it.
 */
interface InventoryScreenProps {
  /**
   * Kept mounted but out of sight.
   *
   * This screen used to build ~70 cards, and rebuilding them cost about a
   * second every time the tab was opened (David, 10 Sep 2026). Hiding
   * rather than unmounting pays that once. `display: 'none'` takes it
   * out of layout as well as out of sight, so a hidden screen costs
   * nothing to lay out.
   */
  hidden?: boolean;

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

export function InventoryScreen({
  trophies,
  arenaId,
  skinId,
  onPreview,
  hidden = false,
}: InventoryScreenProps) {
  const scrollRef = useRef<ScrollView>(null);
  // Live: a fold changes how many cards fit across.
  const cardWidth = useGridCardWidth();
  // Restore before the first paint the player sees.
  useEffect(() => {
    const y = recallScroll('inventory');
    if (y > 0) scrollRef.current?.scrollTo({ y, animated: false });
  }, []);

  // Asked on every draw, not remembered: the cupboard changes the moment
  // something is bought, won or earned, and the screen above re-renders
  // this one each time it does. The clock is read here so a phone left
  // open across the first of the month moves on with it.
  const now = Date.now();
  const dice = inventoryDice(trophies, now);
  const arenas = inventoryArenas(trophies, now);
  /*
    One opener for every card, the same function on every draw, so a card
    whose die, tag and width have not changed is not drawn again.

    David, 3 Nov 2026: "The game runs very slow when you open it,
    especially if I have everything unlocked." This page stays mounted,
    hidden, once built, and the game screen above it redraws on every
    change of its state — a coin, a timer, a roll in a battle. With
    everything unlocked that redrew some eighty cards each time, about 8ms
    on a desktop (several times that on a phone) for a page nobody could
    see. Memoised cards cost a comparison each instead.
  */
  const previewRef = useRef(onPreview);
  previewRef.current = onPreview;
  const open = useCallback((target: PreviewTarget) => {
    playClick();
    previewRef.current(target);
  }, []);

  return (
    <View style={[styles.overlay, useMenuPageArea(), hidden && styles.hidden]}>
      <View style={styles.header}>
        {/* No trophy count here: the shared HUD already draws one over
            this page, and two of the same number on one screen reads as
            two different things. Same reason StoreScreen dropped its. */}
        <Text style={styles.title}>Inventory</Text>
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
          Every set you own. Tap one to see it on the board and use it. Only
          the shell changes — the six face colours always stay the same, so
          a match is always a match.
        </Text>
        <View style={styles.grid}>
          {dice.map((skin) => (
            <DieCard
              key={skin.id}
              skin={skin}
              equipped={skinId === skin.id}
              width={cardWidth}
              onOpen={open}
            />
          ))}
        </View>
        {onlyStarters(dice.map((s) => s.id), STARTING_DICE) && (
          // Where more come from, in the words of the tabs a child can see
          // along the bottom — not a list of what they are missing.
          <Text style={styles.moreNote}>
            More dice are won on the trophy ladder in Records, bought in the
            Store, and earned on the season pass in Cups.
          </Text>
        )}

        <Text style={styles.sectionTitle}>BATTLEFIELDS</Text>
        <Text style={styles.sectionNote}>
          Every battlefield you own. Tap one to stand on it and use it. They
          all play exactly the same — only the view changes. Hills and moats
          come from the difficulty you pick, not from the battlefield.
        </Text>
        <View style={styles.grid}>
          {arenas.map((id) => (
            <ArenaCard key={id} id={id} equipped={arenaId === id} width={cardWidth} onOpen={open} />
          ))}
        </View>
        {onlyStarters(arenas, STARTING_ARENAS) && (
          <Text style={styles.moreNote}>
            More battlefields are won on the trophy ladder in Records, bought
            in the Store, and earned on the season pass in Cups.
          </Text>
        )}
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

/** One die in the cupboard. Redrawn only when what it shows changes. */
const DieCard = memo(function DieCard({
  skin,
  equipped,
  width,
  onOpen,
}: {
  skin: DiceSkin;
  equipped: boolean;
  width: number;
  onOpen: (target: PreviewTarget) => void;
}) {
  return (
    <Pressable
      onPress={() => onOpen({ kind: 'die', id: skin.id, from: 'inventory' })}
      style={[styles.card, { width }, equipped && styles.cardEquipped]}
    >
      {/* The real shell, same painter as the dice in play. */}
      <DiceSwatch skin={skin} size={58} />
      <Text style={styles.cardName}>{skin.name}</Text>
      {equipped ? (
        <Text style={styles.equippedTag}>EQUIPPED</Text>
      ) : (
        <Text style={styles.tapTag}>Tap to see</Text>
      )}
    </Pressable>
  );
});

/** One battlefield in the cupboard, the same way. */
const ArenaCard = memo(function ArenaCard({
  id,
  equipped,
  width,
  onOpen,
}: {
  id: ArenaId;
  equipped: boolean;
  width: number;
  onOpen: (target: PreviewTarget) => void;
}) {
  const arena = ARENAS[id];
  return (
    <Pressable
      onPress={() => onOpen({ kind: 'arena', id, from: 'inventory' })}
      style={[styles.card, { width }, equipped && styles.cardEquipped]}
    >
      <Image
        source={ARENA_ART[id]}
        // The sky sits underneath as the colour the picture
        // opens on, so a card is never a white hole for the
        // frame it takes the image to decode.
        style={[styles.swatch, { backgroundColor: arena.skyColor }]}
        accessibilityIgnoresInvertColors
      />
      <Text style={styles.cardName}>{arena.name}</Text>
      {equipped ? (
        <Text style={styles.equippedTag}>EQUIPPED</Text>
      ) : (
        <Text style={styles.tapTag}>Tap to see</Text>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  // Out of sight AND out of layout — see the `hidden` prop.
  hidden: { display: 'none' },
  overlay: {
    ...MENU_PAGE_EDGES,
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
    // width comes from useGridCardWidth() at the call site — see grid.ts.
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
  // Under a section holding only what everybody starts with: where more
  // come from. Quieter than the note above it — a pointer, not a nag.
  moreNote: {
    color: THEME.inkSoft,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    marginTop: 10,
    marginLeft: 4,
  },
});
