import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../ui/Card';
import { Confirm, Tell } from '../ui/Confirm';
import { MIN_TAP, SHAPE, THEME, TYPE } from '../ui/theme';
import { playClick } from '../audio/sounds';
import type { Product } from '../game/products';
import {
  buy,
  hasEntitlement,
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
export function MoneyShelf({ onBought }: { onBought?: () => void }) {
  const [state, setState] = useState(() => storeState());
  const [asking, setAsking] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);
  const [told, setTold] = useState<{ title: string; body: string } | null>(null);

  const refresh = useCallback(() => setState(storeState()), []);

  useEffect(() => {
    /*
      Prices arrive from the phone a moment after launch, so the shelf
      looks again shortly after it is first drawn. One retry, not a
      poll: if the shop is unreachable the screen says so instead of
      quietly trying for ever.
    */
    const timer = setTimeout(refresh, 1200);
    return () => clearTimeout(timer);
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

  if (!state.available) {
    return (
      <Card style={styles.notYet} drop={0} background={THEME.sunk}>
        <Text style={styles.notYetTitle}>Not on this phone yet</Text>
        <Text style={styles.notYetBody}>
          Buying things needs a newer version of the game than this one.
          Everything in the Store above can still be earned by playing —
          which is how most of it is meant to be got anyway.
        </Text>
      </Card>
    );
  }

  return (
    <View style={styles.shelf}>
      <Text style={styles.fairness}>
        Nothing here changes how the dice land. Every one of these is
        something to look at, or an advert switched off.
      </Text>

      {state.products.map((product) => {
        const bought = product.kind !== 'consumable' && hasEntitlement(product.id);
        const price = state.priceOf(product.id);
        return (
          <Card key={product.id} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowName}>{product.name}</Text>
              <Text style={styles.rowBlurb}>{product.blurb}</Text>
              {product.starterOnly && (
                <Text style={styles.starter}>
                  Only in your first two days with the game
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
                <Text style={styles.buyText}>{price ?? '—'}</Text>
              </Pressable>
            )}
          </Card>
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

      {asking && (
        <Confirm
          title={`Buy ${asking.name}?`}
          body={
            `${asking.blurb}\n\n` +
            (state.priceOf(asking.id)
              ? `It costs ${state.priceOf(asking.id)}. Your phone will ask you to confirm as well.`
              : 'Your phone will show the price and ask you to confirm.')
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
      )}

      {told && (
        <Tell
          title={told.title}
          body={told.body}
          onDismiss={() => setTold(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shelf: { gap: 10 },
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
