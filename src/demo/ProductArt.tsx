import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ArenaId } from '../arena/arenas';
import type { Product } from '../game/products';
import { coinsInPile, pictureOfProduct } from '../game/productPictures';
import { ArenaIcon, DieIcon } from '../ui/Icon';
import { SHAPE, THEME } from '../ui/theme';
import { GoldCoin } from './GoldCoin';
import { ItemIcon } from './ItemIcon';

/**
 * The picture on a money shop card: the thing you are buying, drawn.
 *
 * The real die for a die, the real battlefield picture for a battlefield,
 * a pile of the game's own gold coins that grows with the pack, and an
 * advert crossed out for No more ads. What to draw comes from
 * `pictureOfProduct`, which reads what the product grants, so the card
 * cannot picture something it does not sell.
 */
export function ProductArt({ product, size = 64 }: { product: Product; size?: number }) {
  const pic = pictureOfProduct(product);
  const gold = product.kind === 'season';

  let body: React.ReactNode;
  if (pic.noAds) {
    body = <NoAds size={size} />;
  } else if (pic.placeholder) {
    body = <Fan size={size} count={pic.placeholder === 'dice' ? 3 : 2} render={(s) =>
      pic.placeholder === 'dice' ? <DieIcon size={s} /> : <ArenaIcon size={s} />
    } />;
  } else if (pic.items.length > 1) {
    body = <Fan size={size} count={pic.items.length} render={(s, i) =>
      <ItemIcon picture={asPicture(pic.items[i])} size={s} />
    } />;
  } else if (pic.items.length === 1 && pic.coins > 0) {
    // A die and some coins, like the Starter pack: the die up front, the
    // coins tucked in the corner.
    body = (
      <>
        <View style={{ position: 'absolute', left: size * 0.08, top: size * 0.08 }}>
          <ItemIcon picture={asPicture(pic.items[0])} size={size * 0.66} />
        </View>
        <View style={{ position: 'absolute', right: size * 0.02, bottom: size * 0.04 }}>
          <CoinPile count={3} coin={size * 0.27} />
        </View>
      </>
    );
  } else if (pic.items.length === 1) {
    body = <ItemIcon picture={asPicture(pic.items[0])} size={size * 0.84} />;
  } else {
    body = <CoinPile count={coinsInPile(pic.coins)} coin={size * 0.27} />;
  }

  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: size * 0.22 },
        gold && styles.tileGold,
      ]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {body}
    </View>
  );
}

function asPicture(item: { kind: 'die' | 'arena'; id: string }) {
  return item.kind === 'die'
    ? { kind: 'die' as const, id: item.id }
    : { kind: 'arena' as const, id: item.id as ArenaId };
}

/** Several things overlapping like a hand of cards, the middle one on top. */
function Fan({
  size,
  count,
  render,
}: {
  size: number;
  count: number;
  render: (size: number, index: number) => React.ReactNode;
}) {
  const each = size * (count > 2 ? 0.46 : 0.54);
  const spread = count > 1 ? (size - each) * 0.8 / (count - 1) : 0;
  const start = (size - each - spread * (count - 1)) / 2;
  const middle = (count - 1) / 2;
  const order = Array.from({ length: count }, (_, i) => i)
    // Outer ones first, so the middle one is drawn last and sits on top.
    .sort((a, b) => Math.abs(b - middle) - Math.abs(a - middle));
  return (
    <>
      {order.map((i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: start + spread * i,
            top: (size - each) / 2 + Math.abs(i - middle) * size * 0.06,
            transform: [{ rotate: `${(i - middle) * 12}deg` }],
          }}
        >
          {render(each, i)}
        </View>
      ))}
    </>
  );
}

/**
 * A pyramid of gold coins: 3, 6 or 10 of them. Every coin is the same
 * size whatever the pack, so the bigger pack is a bigger PILE — the first
 * version shrank the coins to fit, and the vault came out looking smaller
 * than the chest.
 */
function CoinPile({ count, coin }: { count: number; coin: number }) {
  const rows: number[] = count >= 10 ? [4, 3, 2, 1] : count >= 6 ? [3, 2, 1] : [2, 1];
  const step = coin * 0.82;
  const size = coin + step * (rows[0] - 1);
  const rise = coin * 0.62;
  const height = coin + rise * (rows.length - 1);
  const coins: React.ReactNode[] = [];
  rows.forEach((n, r) => {
    const left = (size - (coin + step * (n - 1))) / 2;
    for (let i = 0; i < n; i++) {
      coins.push(
        <View
          key={`${r}-${i}`}
          style={{ position: 'absolute', left: left + step * i, bottom: rise * r }}
        >
          <GoldCoin size={coin} />
        </View>,
      );
    }
  });
  return <View style={{ width: size, height }}>{coins}</View>;
}

/** An advert on a little screen, with a red no-entry line through it. */
function NoAds({ size }: { size: number }) {
  const ring = size * 0.74;
  const line = Math.max(3, size * 0.075);
  return (
    <>
      <View
        style={[
          styles.screen,
          { width: size * 0.62, height: size * 0.46, borderRadius: size * 0.08 },
        ]}
      >
        <Text style={[styles.adText, { fontSize: size * 0.22 }]} allowFontScaling={false}>
          AD
        </Text>
      </View>
      <View
        style={{
          position: 'absolute',
          width: ring,
          height: ring,
          borderRadius: ring / 2,
          borderWidth: line,
          borderColor: THEME.bad,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: ring,
          height: line,
          borderRadius: line / 2,
          backgroundColor: THEME.bad,
          transform: [{ rotate: '-45deg' }],
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.tile,
    borderWidth: SHAPE.line,
    borderColor: 'rgba(29,26,46,0.14)',
    overflow: 'hidden',
  },
  tileGold: {
    backgroundColor: '#fff3c4',
    borderColor: THEME.gold,
    borderWidth: 2,
  },
  screen: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.surface,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
  },
  adText: { color: THEME.ink, fontWeight: '900', letterSpacing: 1 },
});
