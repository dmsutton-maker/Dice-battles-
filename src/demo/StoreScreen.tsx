import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { STORE_SKINS } from '../game/diceSkins';
import { ARENA_PRICES, STORE_ARENAS, arenaKey } from '../game/loadout';
import { ARENAS } from '../arena/arenas';
import { ARENA_ART } from '../arena/arenaArt';
import { MENU_PAGE_EDGES, useMenuPageArea } from './BottomNav';
import { recallScroll, rememberScroll } from './menuScroll';
import { SHAPE, THEME, TYPE } from '../ui/theme';
import { Wallet } from '../game/currency';
import { useGridCardWidth } from './grid';
import { playClick } from '../audio/sounds';
import { CoinLabel } from './GoldCoin';
import { DiceSwatch } from './DiceSwatch';
import { MoneyShelf } from './MoneyShelf';
import type { PreviewTarget } from '../game/itemPreview';
import { easeInOutCubic, glideDuration, glideTarget } from './glide';

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
   * Kept mounted but out of sight.
   *
   * This screen builds ~70 cards, and rebuilding them cost about a
   * second every time the tab was opened (David, 10 Sep 2026). Hiding
   * rather than unmounting pays that once. `display: 'none'` takes it
   * out of layout as well as out of sight, so a hidden screen costs
   * nothing to lay out.
   */
  hidden?: boolean;

  /**
   * Passed in rather than read here, because buying now happens in the
   * preview. This screen is mounted the whole time a preview is open over
   * it, so reading the wallet once on mount would leave it showing the old
   * balance and the old OWNED tags the moment you came back.
   */
  wallet: Wallet;
  /** Called after a real-money purchase, so the screen above can refresh. */
  onBought?: () => void;
  /** Family tester mode: also show the products not on sale yet. */
  familyPreview?: boolean;
  /** Opens the die on the real battlefield, where it is bought. */
  onPreview: (skinId: string) => void;
  /** Opens the battlefield itself, standing in it — bought there too. */
  onPreviewArena: (arenaId: (typeof STORE_ARENAS)[number]) => void;
  /** A die or battlefield included in a money purchase, on the real board. */
  onPreviewItem: (target: PreviewTarget) => void;
  /**
   * Glide down to the Gold Pass. A counter rather than a flag, so every
   * tap of "Get the Gold Pass" on the Cups tab moves it on and is
   * honoured, even a second tap after scrolling back up. 0 = never asked.
   */
  focusGold?: number;
}

export function StoreScreen({
  wallet,
  onBought,
  familyPreview = false,
  onPreview,
  onPreviewArena,
  onPreviewItem,
  hidden = false,
  focusGold = 0,
}: StoreScreenProps) {
  const scrollRef = useRef<ScrollView>(null);
  /*
    What the glide to the Gold Pass needs to know, all measured by the
    layout as it happens: where the shelf starts, where the card sits in
    it, how tall the screen and the page are, and where we are now.
  */
  const shelfY = useRef(0);
  const gold = useRef<{ y: number; height: number } | null>(null);
  const viewportH = useRef(0);
  const contentH = useRef(0);
  const scrollY = useRef(0);
  const glideFrame = useRef<number | null>(null);
  /*
    The last "Get the Gold Pass" tap already glided to. Without it, coming
    back to the Store from a dice preview (hidden, then shown again) would
    replay the glide every time.
  */
  const glidedFor = useRef(0);
  /** Moves on when the glide lands, so the shelf can light the card up. */
  const [goldGlow, setGoldGlow] = useState(0);
  // Live: a fold changes how many cards fit across.
  const cardWidth = useGridCardWidth();
  // Restore before the first paint the player sees.
  useEffect(() => {
    const y = recallScroll('store');
    if (y > 0) scrollRef.current?.scrollTo({ y, animated: false });
    scrollY.current = y;
  }, []);

  const stopGlide = () => {
    if (glideFrame.current !== null) cancelAnimationFrame(glideFrame.current);
    glideFrame.current = null;
  };

  /*
    THE GLIDE TO THE GOLD PASS. Driven a frame at a time rather than with
    `scrollTo({ animated: true })`, whose fixed quarter-second makes a
    long trip read as a jump — David asked for it to flow. A finger on the
    page stops it at once (onScrollBeginDrag), because the player always
    wins over an animation. With Reduce Motion on, it is the phone's own
    short scroll instead: still not a jump, but no long sweep.
  */
  useEffect(() => {
    if (focusGold === 0 || hidden || glidedFor.current === focusGold) return;
    glidedFor.current = focusGold;
    let cancelled = false;
    const asked = Date.now();
    const begin = (reduceMotion: boolean) => {
      if (cancelled) return;
      /*
        The Store has just been unhidden; wait until the layout has
        measured the card, the screen AND the page before deciding where
        to go. Up to three seconds, by the clock. It used to give up after
        thirty frames — half a second — and the first time the Store is
        shown on a phone, laying out its seventy cards takes longer than
        that, so the glide quietly never started (David: "it just takes
        me to the shop but doesn't take me to the place in the shop where
        you purchase the gold pass"). A browser lays it out in a frame or
        two, which is why it worked in the preview.
      */
      if (gold.current === null || viewportH.current === 0 || contentH.current === 0) {
        if (Date.now() - asked < 3000) {
          glideFrame.current = requestAnimationFrame(() => begin(reduceMotion));
        }
        return;
      }
      const to = glideTarget({
        cardY: shelfY.current + gold.current.y,
        cardHeight: gold.current.height,
        viewportHeight: viewportH.current,
        contentHeight: contentH.current,
      });
      const from = scrollY.current;
      if (reduceMotion || Math.abs(to - from) < 2) {
        scrollRef.current?.scrollTo({ y: to, animated: true });
        setGoldGlow((n) => n + 1);
        return;
      }
      const duration = glideDuration(to - from);
      const start = Date.now();
      const step = () => {
        if (cancelled) return;
        const t = (Date.now() - start) / duration;
        const y = from + (to - from) * easeInOutCubic(t);
        scrollRef.current?.scrollTo({ y, animated: false });
        if (t < 1) {
          glideFrame.current = requestAnimationFrame(step);
        } else {
          glideFrame.current = null;
          setGoldGlow((n) => n + 1);
        }
      };
      glideFrame.current = requestAnimationFrame(step);
    };
    AccessibilityInfo.isReduceMotionEnabled()
      .then(begin)
      .catch(() => begin(false));
    return () => {
      cancelled = true;
      stopGlide();
    };
  }, [focusGold, hidden]);

  return (
    <View style={[styles.overlay, useMenuPageArea(), hidden && styles.hidden]}>
      {/* No coin count here — the shared HUD shows it on every screen. */}
      <View style={styles.header}>
        <Text style={styles.title}>Store</Text>
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
        onScroll={(e) => {
          scrollY.current = e.nativeEvent.contentOffset.y;
          rememberScroll('store', scrollY.current);
        }}
        scrollEventThrottle={16}
        onScrollBeginDrag={stopGlide}
        onLayout={(e) => {
          viewportH.current = e.nativeEvent.layout.height;
        }}
        onContentSizeChange={(_w, h) => {
          contentH.current = h;
        }}
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
        {/*
          There was a third paragraph here explaining where coins come
          from — the exact payout for an Easy win, for a Hard win, and
          that losing still pays. David asked for it out on 10 Sep 2026.
          The shelf is what this screen is for, and three blocks of text
          above it pushed the dice off the bottom of the screen.
        */}

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
                  { width: cardWidth },
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

        <Text style={styles.sectionTitle}>BATTLEFIELDS</Text>
        <Text style={styles.sectionNote}>
          Whole new places to battle. Tap one to stand in it and look
          around before you spend anything — every battlefield plays
          exactly the same, only the view changes.
        </Text>
        <View style={styles.grid}>
          {STORE_ARENAS.map((id) => {
            const arena = ARENAS[id];
            const bought = wallet.owned.includes(arenaKey(id));
            const affordable = wallet.coins >= ARENA_PRICES[id]!;
            return (
              <Pressable
                key={id}
                onPress={() => {
                  playClick();
                  onPreviewArena(id);
                }}
                style={[
                  styles.card,
                  { width: cardWidth },
                  bought && styles.cardOwned,
                  !bought && !affordable && styles.cardLocked,
                ]}
              >
                <Image
                  source={ARENA_ART[id]}
                  style={[styles.arenaArt, { backgroundColor: arena.skyColor }]}
                  accessibilityIgnoresInvertColors
                />
                <Text style={styles.cardName}>{arena.name}</Text>
                {bought ? (
                  <Text style={styles.ownedTag}>OWNED</Text>
                ) : (
                  <CoinLabel
                    size={13}
                    style={[styles.priceText, !affordable && styles.priceShort]}
                    containerStyle={styles.priceRow}
                  >
                    {ARENA_PRICES[id]}
                  </CoinLabel>
                )}
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>WITH REAL MONEY</Text>
        <View
          onLayout={(e) => {
            shelfY.current = e.nativeEvent.layout.y;
          }}
        >
          <MoneyShelf
            onBought={onBought}
            familyPreview={familyPreview}
            onGoldLayout={(y, height) => {
              gold.current = { y, height };
            }}
            goldGlow={goldGlow}
            onPreview={onPreviewItem}
          />
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
  // Out of sight AND out of layout — see the `hidden` prop.
  hidden: { display: 'none' },
  /** Same footprint as the 58pt dice swatch, so the two shelves align. */
  arenaArt: {
    width: 58,
    height: 58,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(29,26,46,0.25)',
  },
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
    marginBottom: 10,
  },
  title: { color: THEME.ink, ...TYPE.title },
  scroll: { paddingHorizontal: 16, paddingBottom: 16 },
  note: {
    color: THEME.inkSoft,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    marginLeft: 4,
  },
  sectionTitle: {
    color: THEME.inkFaint,
    ...TYPE.label,
    letterSpacing: 2,
    marginTop: 16,
    marginBottom: 6,
    marginLeft: 4,
  },
  sectionNote: {
    color: THEME.inkSoft,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
    marginLeft: 4,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
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
  cardOwned: { borderColor: THEME.good },
  /*
   * Sunk into the table rather than dimmed: opacity would drag the name's
   * contrast under 4.5:1 on paper, and a price you cannot pay yet is
   * information, not something to squint at.
   */
  cardLocked: {
    backgroundColor: THEME.sunk,
    borderColor: 'rgba(29,26,46,0.35)',
  },
  cardName: { color: THEME.ink, fontSize: 12, fontWeight: '800', textAlign: 'center' },
  priceText: { color: THEME.ink, fontSize: 12, fontWeight: '900' },
  priceRow: { marginTop: 3 },
  priceShort: { color: THEME.inkFaint },
  ownedTag: {
    color: THEME.good,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
    marginTop: 3,
  },
  comingSoon: {
    backgroundColor: THEME.tile,
    borderRadius: SHAPE.radius,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
    padding: 14,
    gap: 6,
  },
  comingTitle: { color: THEME.ink, fontSize: 14, fontWeight: '800' },
  comingBody: {
    color: THEME.inkSoft,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
});
