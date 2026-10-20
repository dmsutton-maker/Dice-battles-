import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../ui/Card';
import { Confirm, Tell } from '../ui/Confirm';
import { MIN_TAP, SHAPE, THEME, TYPE } from '../ui/theme';
import { playClick } from '../audio/sounds';
import { PRODUCTS, priceLabel, type Product } from '../game/products';
import { ProductArt } from './ProductArt';
import {
  buy,
  hasEntitlement,
  onPurchasesChanged,
  restore,
  storeState,
} from '../game/purchases';

/**
 * The part of the Store that costs real money.
 *
 * Three rules shape every pixel of this, and all three are about the
 * fact that a five-year-old holds this phone:
 *
 *   1. NOTHING HERE CHANGES HOW THE DICE LAND. It is printed on the
 *      screen, not just true in the code, because a promise you cannot
 *      see is not a promise.
 *   2. Every purchase asks first, in the game's own words, with the
 *      price in it. Apple's sheet asks too — this is the question
 *      before that one, so nobody ever reaches Apple's sheet by
 *      accident.
 *   3. Nothing here is loud. No timers counting down, no "only 3 left",
 *      no red badges. The one time-limited thing says plainly how long
 *      it lasts and is not shouted about.
 *
 * When purchasing is not available — which is every build until the
 * switch in storeKit.ts is thrown — this says so in one quiet line
 * rather than showing buttons that cannot work.
 */
export function MoneyShelf({
  onBought,
  familyPreview = false,
  onGoldLayout,
  goldGlow = 0,
}: {
  onBought?: () => void;
  /** Family tester mode: also show what is not on sale yet. */
  familyPreview?: boolean;
  /** Where the Gold Pass card sits in the shelf, for the Store's glide. */
  onGoldLayout?: (y: number, height: number) => void;
  /** Moves on when the Store has glided to the Gold Pass: light it up. */
  goldGlow?: number;
}) {
  // Family tester mode sees the Starter pack whatever the install date.
  const [state, setState] = useState(() => storeState(Date.now(), familyPreview));
  const [asking, setAsking] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);
  const [told, setTold] = useState<{ title: string; body: string } | null>(null);
  /** The product whose full description is open, if any. */
  const [viewing, setViewing] = useState<Product | null>(null);

  const refresh = useCallback(
    () => setState(storeState(Date.now(), familyPreview)),
    [familyPreview],
  );

  useEffect(() => {
    /*
      The shop answers in its own time: StoreKit connects and prices
      arrive some while after launch, and this shelf is built early and
      kept mounted behind the other tabs. So it is TOLD when anything
      changes (ready, prices, a purchase landing) instead of looking once
      or twice and trusting the timing — a fixed delay showed "not on
      this phone yet" for the whole session on a slow connection. Looks
      once more on subscribing, in case the answer came between the first
      draw and now. If the shop never answers, nothing fires and the
      screen keeps saying so rather than polling for ever.
    */
    const stop = onPurchasesChanged(refresh);
    refresh();
    return stop;
  }, [refresh]);

  const purchase = async (product: Product) => {
    setBusy(true);
    const result = await buy(product.id);
    setBusy(false);
    refresh();
    if (result.ok) {
      onBought?.();
      setTold({
        title: 'Thank you!',
        body: product.coins
          ? `${product.coins.toLocaleString()} coins are in your purse.`
          : `${product.name} is yours.`,
      });
      return;
    }
    // A cancelled sheet is not a failure and says nothing at all.
    if (result.reason === 'cancelled') return;
    // Ask to Buy: not a failure, just not yet.
    if (result.reason === 'pending') {
      setTold({ title: 'Asked a grown-up', body: result.message });
      return;
    }
    setTold({ title: 'That did not go through', body: result.message });
  };

  const putBack = async () => {
    setBusy(true);
    const result = await restore();
    setBusy(false);
    refresh();
    onBought?.();
    setTold(
      result.restored > 0
        ? {
            title: 'Put back',
            body:
              result.restored === 1
                ? 'One thing you had bought before is yours again.'
                : `${result.restored} things you had bought before are yours again.`,
          }
        : {
            title: 'Nothing to put back',
            body: result.ok
              ? 'This Apple account has not bought anything here yet.'
              : 'We could not reach the shop. Try again in a moment.',
          },
    );
  };

  const comingLater = familyPreview ? <ComingLater onView={setViewing} /> : null;

  /*
    The full description, opened by tapping a card. On sale and not yet
    owned, it offers to buy — which goes through the same "are you sure"
    question as the price button, so there is still exactly one place a
    purchase is asked about. Owned, or not on sale, it only describes.
  */
  const detail = viewing && (
    <OnTop onClose={() => setViewing(null)}>
    <ProductDetail
      product={viewing}
      price={state.priceOf(viewing.id)}
      canBuy={
        viewing.available &&
        state.available &&
        !(viewing.kind !== 'consumable' && hasEntitlement(viewing.id))
      }
      owned={viewing.kind !== 'consumable' && hasEntitlement(viewing.id)}
      onBuy={() => {
        const product = viewing;
        playClick();
        setViewing(null);
        setAsking(product);
      }}
      onClose={() => {
        playClick();
        setViewing(null);
      }}
    />
    </OnTop>
  );

  if (!state.available) {
    return (
      <>
      <Card style={styles.notYet} drop={0} background={THEME.sunk}>
        <Text style={styles.notYetTitle}>Not on this phone yet</Text>
        <Text style={styles.notYetBody}>
          Buying needs a newer version of the game. Everything above can
          still be earned by playing.
        </Text>
      </Card>
      {comingLater}
      {detail}
      </>
    );
  }

  return (
    <View style={styles.shelf}>
      <Text style={styles.fairness}>
        Nothing here changes how the dice land.
      </Text>

      {state.products.map((product) => {
        const bought = product.kind !== 'consumable' && hasEntitlement(product.id);
        const price = priceLabel(product, state.priceOf(product.id));
        const isGold = product.kind === 'season';
        return (
          <View
            key={product.id}
            onLayout={
              isGold && onGoldLayout
                ? (e) => onGoldLayout(e.nativeEvent.layout.y, e.nativeEvent.layout.height)
                : undefined
            }
          >
            <Card
              style={styles.row}
              onPress={() => {
                playClick();
                setViewing(product);
              }}
            >
              <ProductArt product={product} size={ROW_ART} />
              <View style={styles.rowText}>
                <Text style={styles.rowName}>{product.name}</Text>
                <Text style={styles.rowBlurb}>{product.blurb}</Text>
                <Text style={styles.more}>Tap to see more</Text>
                {product.starterOnly && (
                  <Text style={styles.starter}>
                    First two days only
                  </Text>
                )}
              </View>
              {bought ? (
                <View style={styles.owned}>
                  <Text style={styles.ownedText}>YOURS</Text>
                </View>
              ) : (
                <Pressable
                  style={styles.buy}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={`Buy ${product.name}`}
                  onPress={() => {
                    playClick();
                    setAsking(product);
                  }}
                >
                  <Text style={styles.buyText}>{price}</Text>
                </Pressable>
              )}
            </Card>
            {isGold && <GoldGlow token={goldGlow} />}
          </View>
        );
      })}

      {/*
        Apple requires a visible way to get back what an account already
        bought — a new phone, a reinstall, a second phone in the family
        all depend on it, and an app selling one-off unlocks without one
        is rejected.
      */}
      <Pressable
        style={styles.restore}
        disabled={busy}
        accessibilityRole="button"
        onPress={() => {
          playClick();
          void putBack();
        }}
      >
        {busy ? (
          <ActivityIndicator color={THEME.ink} />
        ) : (
          <Text style={styles.restoreText}>Bought before? Put it back</Text>
        )}
      </Pressable>

      {comingLater}

      {detail}

      {asking && (
        <OnTop onClose={() => setAsking(null)}>
        <Confirm
          title={`Buy ${asking.name}?`}
          body={
            `${asking.blurb}\n\n` +
            `It costs ${priceLabel(asking, state.priceOf(asking.id))}. ` +
            'Your phone will ask you to confirm as well.'
          }
          confirmLabel="Yes, buy it"
          cancelLabel="No, not now"
          onCancel={() => {
            playClick();
            setAsking(null);
          }}
          onConfirm={() => {
            const product = asking;
            playClick();
            setAsking(null);
            void purchase(product);
          }}
        />
        </OnTop>
      )}

      {told && (
        <OnTop onClose={() => setTold(null)}>
        <Tell
          title={told.title}
          body={told.body}
          onDismiss={() => setTold(null)}
        />
        </OnTop>
      )}
    </View>
  );
}

/**
 * Draw over the WHOLE screen, not over the shelf.
 *
 * The shelf sits at the bottom of the Store's long scrolling page, and a
 * popup drawn inside it is centred on the shelf — which, scrolled to the
 * Gold Pass, put the middle of it below the bottom of the phone. A
 * transparent Modal is drawn above everything, the way the bug-report
 * form is.
 */
function OnTop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      {children}
    </Modal>
  );
}

/**
 * One product, in full: everything it gives, how long it lasts, and what
 * happens on a new phone. Same card-on-the-table look as Confirm and Tell.
 */
function ProductDetail({
  product,
  price,
  canBuy,
  owned,
  onBuy,
  onClose,
}: {
  product: Product;
  price: string | null;
  canBuy: boolean;
  owned: boolean;
  onBuy: () => void;
  onClose: () => void;
}) {
  const shown = priceLabel(product, price);
  return (
    <View style={styles.detailBackdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <Card style={styles.detailPanel} radius={SHAPE.radiusLg}>
        <ScrollView style={styles.detailText} contentContainerStyle={styles.detailScroll}>
          <View style={styles.detailArt}>
            <ProductArt product={product} size={DETAIL_ART} />
          </View>
          <Text style={styles.detailTitle}>{product.name}</Text>
          <Text style={styles.detailPrice}>
            {owned ? 'Yours already' : product.available ? shown : `${shown} · not on sale yet`}
          </Text>
          <Text style={styles.detailBody}>{product.details}</Text>
          {!product.available && product.blockedBy && (
            <Text style={styles.laterWhy}>Waiting on: {product.blockedBy}</Text>
          )}
        </ScrollView>
        {canBuy && (
          <Pressable
            style={[styles.buy, styles.detailBuy]}
            accessibilityRole="button"
            accessibilityLabel={`Buy ${product.name} for ${shown}`}
            onPress={onBuy}
          >
            <Text style={styles.buyText}>Buy for {shown}</Text>
          </Pressable>
        )}
        <Pressable style={styles.detailClose} accessibilityRole="button" onPress={onClose}>
          <Text style={styles.restoreText}>Close</Text>
        </Pressable>
      </Card>
    </View>
  );
}

/**
 * The products the family chose that are not on sale yet, drawn the way
 * they would look — FAMILY TESTER MODE ONLY.
 *
 * David, 13 Oct 2026: "A couple months ago we went over everything we
 * want people to be able to buy with real money, so go back to that and
 * add them into the store just so I can see what they look like."
 *
 * Only for the family, and never buyable: each of these is parked in
 * products.ts for a real reason (artwork that does not exist yet), and a
 * Buy button that cannot work in front of a stranger — or in front of
 * App Review — is worse than no button. The price sits where the button
 * would, greyed, with the reason underneath. Nothing here can reach
 * `buy()`.
 */
function ComingLater({ onView }: { onView: (product: Product) => void }) {
  const parked = PRODUCTS.filter((p) => !p.available);
  if (parked.length === 0) return null;
  return (
    <View style={styles.later}>
      <Text style={styles.laterTitle}>COMING LATER</Text>
      <Text style={styles.laterNote}>
        Only the family sees these. Not on sale yet.
      </Text>
      {parked.map((product) => (
        <Card
          key={product.id}
          style={styles.row}
          drop={0}
          background={THEME.sunk}
          onPress={() => {
            playClick();
            onView(product);
          }}
        >
          <ProductArt product={product} size={ROW_ART} />
          <View style={styles.rowText}>
            <Text style={styles.rowName}>{product.name}</Text>
            <Text style={styles.rowBlurb}>{product.blurb}</Text>
            {product.blockedBy && (
              <Text style={styles.laterWhy} numberOfLines={3}>
                Waiting on: {product.blockedBy}
              </Text>
            )}
          </View>
          <View style={styles.laterPrice}>
            <Text style={styles.laterPriceText}>${product.usd.toFixed(2)}</Text>
          </View>
        </Card>
      ))}
    </View>
  );
}

/**
 * A gold ring that breathes twice round the Gold Pass when the Store has
 * just glided down to it from the Cups tab, so the eye lands where the
 * scroll did. Native-driven opacity only, drawn over the card and never
 * in the way of a tap.
 */
function GoldGlow({ token }: { token: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (token === 0) return;
    opacity.setValue(0);
    const pulse = (to: number, ms: number) =>
      Animated.timing(opacity, {
        toValue: to,
        duration: ms,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      });
    const run = Animated.sequence([
      pulse(1, 260),
      pulse(0.35, 320),
      pulse(1, 320),
      pulse(0, 700),
    ]);
    run.start();
    return () => run.stop();
  }, [token, opacity]);
  return <Animated.View pointerEvents="none" style={[styles.goldGlow, { opacity }]} />;
}

/**
 * The picture on each card, and the bigger one on its full story. David,
 * 20 Oct 2026: "Add pictures and icons for the money items in the store
 * so you know what you're getting."
 */
const ROW_ART = 64;
const DETAIL_ART = 132;

const styles = StyleSheet.create({
  detailArt: { alignItems: 'center', marginBottom: 2 },
  more: { ...TYPE.small, color: THEME.accent, marginTop: 4 },
  detailBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 90,
    backgroundColor: 'rgba(29, 26, 46, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  detailPanel: { width: '100%', maxWidth: 420, padding: 20 },
  // The limit goes on the words, not the card: limiting the card cut its
  // hard shadow loose from it and clipped the last line.
  detailText: { maxHeight: 440 },
  detailScroll: { gap: 10, paddingBottom: 6 },
  detailTitle: { ...TYPE.title, color: THEME.ink },
  detailPrice: { ...TYPE.cardTitle, color: THEME.accent },
  detailBody: { ...TYPE.body, color: THEME.ink, lineHeight: 21 },
  detailBuy: { alignSelf: 'stretch', marginTop: 14, minHeight: MIN_TAP },
  detailClose: { alignSelf: 'center', marginTop: 10, minHeight: MIN_TAP, justifyContent: 'center', paddingHorizontal: 20 },
  later: { marginTop: 22, gap: 10 },
  laterTitle: { ...TYPE.label, color: THEME.accent, letterSpacing: 0.8 },
  laterNote: { ...TYPE.small, color: THEME.inkSoft },
  laterWhy: { ...TYPE.small, color: THEME.inkFaint, fontStyle: 'italic', marginTop: 4 },
  laterPrice: {
    borderWidth: SHAPE.line,
    borderColor: THEME.inkFaint,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 76,
    alignItems: 'center',
  },
  laterPriceText: { ...TYPE.body, color: THEME.inkFaint, fontWeight: '900' },
  shelf: { gap: 10 },
  goldGlow: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: SHAPE.radius + 4,
    borderWidth: 3,
    borderColor: THEME.gold,
  },
  fairness: {
    ...TYPE.small,
    color: THEME.inkSoft,
    marginBottom: 4,
    lineHeight: 17,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  rowText: { flex: 1, minWidth: 0 },
  rowName: { ...TYPE.cardTitle, color: THEME.ink },
  rowBlurb: {
    ...TYPE.small,
    color: THEME.inkSoft,
    fontWeight: '600',
    lineHeight: 16,
    marginTop: 2,
  },
  starter: {
    ...TYPE.label,
    color: THEME.accent,
    marginTop: 5,
  },
  buy: {
    minHeight: MIN_TAP,
    minWidth: 84,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.accent,
    borderRadius: SHAPE.radiusSm,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
  },
  buyText: { color: THEME.onAccent, fontSize: 15, fontWeight: '900' },
  owned: {
    minHeight: MIN_TAP,
    minWidth: 84,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.sunk,
    borderRadius: SHAPE.radiusSm,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
  },
  ownedText: { ...TYPE.label, color: THEME.inkSoft },
  restore: {
    minHeight: MIN_TAP,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  restoreText: {
    ...TYPE.small,
    color: THEME.ink,
    textDecorationLine: 'underline',
  },
  notYet: { padding: 16 },
  notYetTitle: { ...TYPE.cardTitle, color: THEME.ink, marginBottom: 4 },
  notYetBody: {
    ...TYPE.small,
    color: THEME.inkSoft,
    fontWeight: '600',
    lineHeight: 17,
  },
});
