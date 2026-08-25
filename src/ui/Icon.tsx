import React from 'react';
import { View } from 'react-native';
import { PRISONER_COLORS } from '../game/colors';
import { ICON, THEME } from './theme';

/**
 * The icon set, drawn rather than typed.
 *
 * Emoji used as icons was the single loudest reason the interface read as
 * a game from 2010 — 🛒 🎒 ⚔️ 🏆 🏅 along the bottom bar. They also render
 * differently on every platform and version, so the game could not even be
 * sure what its own navigation looked like. The same argument already won
 * once here: GoldCoin.tsx exists because 🪙 is silver on some phones.
 *
 * These are Views, not SVG. `react-native-svg` is a NATIVE module, and
 * adding one means a new build — which is exactly what is blocked. Views
 * cost nothing, ship over the air, and geometric icons are mostly rounded
 * rectangles and circles anyway.
 *
 * Every icon is drawn inside a `size` box on the same optical weight, so a
 * row of them looks like one family rather than five borrowed pictures.
 */

interface IconProps {
  size?: number;
  /** The ink outline. Every icon keeps one, whatever it is filled with. */
  color?: string;
  /**
   * The fill under the outline. Each icon defaults to its own object
   * colour (see ICON in theme.ts); pass 'transparent' for a line-only
   * version — which is what the launch card does, drawing on ink.
   */
  fill?: string;
}

/** The stroke weight every icon shares, scaled to its box. */
const w = (size: number) => Math.max(1.5, Math.round(size * 0.095));

/** A bag with a handle — the Store. */
export function BagIcon({ size = 22, color = THEME.ink, fill = ICON.leather }: IconProps) {
  const s = w(size);
  const bodyTop = size * 0.34;
  return (
    <View style={{ width: size, height: size }}>
      {/* The handle: a circle whose bottom half is hidden behind the bag. */}
      <View
        style={{
          position: 'absolute',
          left: size * 0.3,
          top: size * 0.12,
          width: size * 0.4,
          height: size * 0.4,
          borderRadius: size * 0.2,
          borderWidth: s,
          borderColor: color,
        }}
      />
      {/* The bag itself, drawn over the handle's lower half. */}
      <View
        style={{
          position: 'absolute',
          left: size * 0.11,
          top: bodyTop,
          right: size * 0.11,
          bottom: size * 0.08,
          borderRadius: size * 0.13,
          borderWidth: s,
          borderColor: color,
          backgroundColor: fill,
        }}
      />
      {/* Masks the handle where it passes behind the bag's top edge. */}
      <View
        style={{
          position: 'absolute',
          left: size * 0.24,
          top: bodyTop - s,
          width: size * 0.52,
          height: s * 1.6,
          backgroundColor: 'transparent',
        }}
      />
    </View>
  );
}

/** A crate — the Inventory. */
export function CrateIcon({ size = 22, color = THEME.ink, fill = ICON.wood }: IconProps) {
  const s = w(size);
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          position: 'absolute',
          left: size * 0.1,
          top: size * 0.16,
          right: size * 0.1,
          bottom: size * 0.16,
          borderRadius: size * 0.11,
          borderWidth: s,
          borderColor: color,
          backgroundColor: fill,
        }}
      />
      {/* The lid seam, which is what stops it reading as a plain square. */}
      <View
        style={{
          position: 'absolute',
          left: size * 0.1,
          top: size * 0.38,
          right: size * 0.1,
          height: s,
          backgroundColor: color,
        }}
      />
      {/* The clasp. */}
      <View
        style={{
          position: 'absolute',
          left: size * 0.42,
          top: size * 0.44,
          width: size * 0.16,
          height: size * 0.16,
          borderRadius: size * 0.04,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

/**
 * A die — Battle. The game's own object, so it needs no metaphor.
 *
 * The three pips wear the game's REAL prisoner colours, read straight
 * from src/game/colors.ts rather than copied into the palette. A game
 * whose whole idea is "match the colours" should say so on the tab that
 * starts a battle, and reading the true source means the icon cannot
 * drift away from what the dice actually show.
 */
export function DieIcon({
  size = 22,
  color = THEME.ink,
  fill = THEME.surface,
}: IconProps) {
  const s = w(size);
  const pip = size * 0.15;
  const at = (left: number, top: number, hex: string) => (
    <View
      key={hex}
      style={{
        position: 'absolute',
        left: size * left,
        top: size * top,
        width: pip,
        height: pip,
        borderRadius: pip / 2,
        backgroundColor: hex,
      }}
    />
  );
  // Red, green and blue: the three furthest apart in the palette, so they
  // stay tellable from each other down at 11pt.
  const hex = (id: string) =>
    PRISONER_COLORS.find((c) => c.id === id)?.hex ?? color;
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          position: 'absolute',
          left: size * 0.12,
          top: size * 0.12,
          right: size * 0.12,
          bottom: size * 0.12,
          borderRadius: size * 0.22,
          borderWidth: s,
          borderColor: color,
          backgroundColor: fill,
        }}
      />
      {at(0.25, 0.25, hex('red'))}
      {at(0.425, 0.425, hex('green'))}
      {at(0.6, 0.6, hex('blue'))}
    </View>
  );
}

/**
 * A trophy cup — the TROPHY COUNT, everywhere it appears: the HUD, the
 * Inventory header, the ladder prices, the Ranks screen.
 *
 * MOSTLY GOLD, thinly outlined. The first version outlined every part in
 * ink and filled only the bowl, which at 15pt came out as a dark blob
 * with a gold speck in it — and the Cups tab, drawn the same way, came
 * out as the SAME dark blob. David said twice they still looked
 * identical. They did. Making the cup, stem and foot all gold under one
 * thin outline is what turns it back into a recognisable trophy at the
 * size it is actually used.
 */
export function TrophyIcon({
  size = 22,
  color = THEME.ink,
  fill = THEME.gold,
}: IconProps) {
  const s = w(size) * 0.85;
  return (
    <View style={{ width: size, height: size }}>
      {/* Handles first, so the bowl is drawn over where they meet it. */}
      <View
        style={{
          position: 'absolute',
          left: size * 0.05,
          top: size * 0.17,
          width: size * 0.25,
          height: size * 0.26,
          borderRadius: size * 0.13,
          borderWidth: s,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          right: size * 0.05,
          top: size * 0.17,
          width: size * 0.25,
          height: size * 0.26,
          borderRadius: size * 0.13,
          borderWidth: s,
          borderColor: color,
        }}
      />
      {/* Foot and stem, gold like the bowl — an ink stem was half the blob. */}
      <View
        style={{
          position: 'absolute',
          left: size * 0.26,
          top: size * 0.76,
          width: size * 0.48,
          height: size * 0.15,
          borderRadius: size * 0.06,
          backgroundColor: fill,
          borderWidth: s,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: size * 0.42,
          top: size * 0.54,
          width: size * 0.16,
          height: size * 0.26,
          backgroundColor: fill,
          borderLeftWidth: s,
          borderRightWidth: s,
          borderColor: color,
        }}
      />
      {/* The bowl: square shoulders, deeply rounded underneath. */}
      <View
        style={{
          position: 'absolute',
          left: size * 0.2,
          top: size * 0.11,
          width: size * 0.6,
          height: size * 0.47,
          backgroundColor: fill,
          borderWidth: s,
          borderColor: color,
          borderTopLeftRadius: size * 0.06,
          borderTopRightRadius: size * 0.06,
          borderBottomLeftRadius: size * 0.3,
          borderBottomRightRadius: size * 0.3,
        }}
      />
    </View>
  );
}

/**
 * A knockout BRACKET — the Cups tab.
 *
 * Cups was a trophy, then a medal, and David said both times that it
 * still looked the same as the trophy count. He was right both times:
 * rendering the two at their real 21pt showed a compact gold-and-ink
 * lozenge either way, because a cup and a medal are both "round object,
 * outlined, centred" once they are 21 pixels wide.
 *
 * So this is not another award. It is the shape of the thing the tab
 * actually opens: two contenders feeding into one line, and a champion
 * at the end of it. Wide where a cup is tall, open where a cup is solid,
 * lines where a cup is a mass — nothing about it can be mistaken for a
 * trophy at any size, which is the entire requirement.
 */
export function BracketIcon({
  size = 22,
  color = THEME.ink,
  fill = THEME.gold,
}: IconProps) {
  const s = Math.max(1.5, w(size) * 0.9);
  const xIn = size * 0.14;
  const xJoin = size * 0.5;
  const xOut = size * 0.78;
  const yTop = size * 0.2;
  const yBottom = size * 0.8;
  const dot = size * 0.24;

  const across = (y: number, from: number, to: number) => (
    <View
      key={`${y}-${from}`}
      style={{
        position: 'absolute',
        left: from,
        top: y - s / 2,
        width: to - from,
        height: s,
        borderRadius: s / 2,
        backgroundColor: color,
      }}
    />
  );

  return (
    <View style={{ width: size, height: size }}>
      {/* The two contenders. */}
      {across(yTop, xIn, xJoin)}
      {across(yBottom, xIn, xJoin)}
      {/* The joiner they meet on. */}
      <View
        style={{
          position: 'absolute',
          left: xJoin - s / 2,
          top: yTop,
          width: s,
          height: yBottom - yTop,
          borderRadius: s / 2,
          backgroundColor: color,
        }}
      />
      {/* The winner's line out to the final. */}
      {across(size * 0.5, xJoin, xOut)}
      {/* The champion. */}
      <View
        style={{
          position: 'absolute',
          left: xOut - dot * 0.3,
          top: size * 0.5 - dot / 2,
          width: dot,
          height: dot,
          borderRadius: dot / 2,
          backgroundColor: fill,
          borderWidth: s * 0.85,
          borderColor: color,
        }}
      />
    </View>
  );
}

/**
 * Three bars — Ranks.
 *
 * Coloured by HEIGHT rather than by position: the tallest bar is gold,
 * the middle one silver, the shortest bronze. That is what a ranking IS,
 * so the icon now says the same thing its screen does instead of being
 * three anonymous strokes.
 */
export function RanksIcon({ size = 22, color = THEME.ink }: IconProps) {
  const s = w(size);
  const bar = (left: number, top: number, tint: string) => (
    <View
      key={left}
      style={{
        position: 'absolute',
        left: size * left,
        top: size * top,
        bottom: size * 0.14,
        width: s * 1.6,
        borderRadius: s * 0.6,
        backgroundColor: tint,
        borderWidth: s * 0.55,
        borderColor: color,
      }}
    />
  );
  return (
    <View style={{ width: size, height: size }}>
      {bar(0.14, 0.52, ICON.bronze)}
      {bar(0.42, 0.18, THEME.gold)}
      {bar(0.7, 0.38, ICON.silver)}
    </View>
  );
}

/** A gear — Settings. */
export function GearIcon({ size = 22, color = THEME.ink, fill = ICON.steel }: IconProps) {
  const s = w(size);
  const teeth = [0, 45, 90, 135];
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {teeth.map((deg) => (
        <View
          key={deg}
          style={{
            position: 'absolute',
            width: s * 1.3,
            height: size * 0.86,
            borderRadius: s,
            backgroundColor: color,
            transform: [{ rotate: `${deg}deg` }],
          }}
        />
      ))}
      {/* The hub, painted over the tooth ends so they read as spokes. */}
      <View
        style={{
          position: 'absolute',
          width: size * 0.56,
          height: size * 0.56,
          borderRadius: size * 0.28,
          backgroundColor: fill,
          borderWidth: s * 0.7,
          borderColor: color,
        }}
      />
      {/* The hole. Ground-coloured, because a View cannot punch a hole. */}
      <View
        style={{
          position: 'absolute',
          width: size * 0.26,
          height: size * 0.26,
          borderRadius: size * 0.13,
          backgroundColor: THEME.surface,
        }}
      />
    </View>
  );
}

/** A question mark — How to play. */
export function HelpIcon({ size = 22, color = THEME.ink, fill = ICON.info }: IconProps) {
  const s = w(size);
  // A filled disc carries a reversed mark; an unfilled one keeps ink.
  const mark = fill === 'transparent' ? color : ICON.onFill;
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          position: 'absolute',
          left: size * 0.08,
          top: size * 0.08,
          right: size * 0.08,
          bottom: size * 0.08,
          borderRadius: size * 0.46,
          borderWidth: s,
          borderColor: color,
          backgroundColor: fill,
        }}
      />
      {/*
        The question mark, REVERSED OUT of the disc rather than drawn in
        ink. Ink on this blue measured 2.77:1 — the mark that matters most
        would have been the hardest thing to see on it.
      */}
      <View
        style={{
          position: 'absolute',
          left: size * 0.32,
          top: size * 0.24,
          width: size * 0.36,
          height: size * 0.3,
          borderWidth: s,
          borderColor: mark,
          borderRadius: size * 0.18,
          borderBottomColor: 'transparent',
          borderLeftColor: 'transparent',
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: size * 0.5 - s * 0.65,
          top: size * 0.48,
          width: s * 1.3,
          height: size * 0.14,
          backgroundColor: mark,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: size * 0.5 - s * 0.8,
          top: size * 0.68,
          width: s * 1.6,
          height: s * 1.6,
          borderRadius: s,
          backgroundColor: mark,
        }}
      />
    </View>
  );
}

/** A newspaper — News: a page with a front-page block and text lines. */
export function NewsIcon({ size = 22, color = THEME.ink, fill = THEME.surface }: IconProps) {
  const s = w(size);
  const line = (top: number, left: number, rightInset: number) => (
    <View
      key={`${top}-${left}`}
      style={{
        position: 'absolute',
        left: size * left,
        top: size * top,
        right: size * rightInset,
        height: s * 0.9,
        borderRadius: s,
        backgroundColor: color,
      }}
    />
  );
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          position: 'absolute',
          left: size * 0.12,
          top: size * 0.14,
          right: size * 0.12,
          bottom: size * 0.14,
          borderRadius: size * 0.11,
          borderWidth: s,
          borderColor: color,
          backgroundColor: fill,
        }}
      />
      {/* The front-page photo: the one splash of colour on the page. */}
      <View
        style={{
          position: 'absolute',
          left: size * 0.26,
          top: size * 0.28,
          width: size * 0.22,
          height: size * 0.2,
          borderRadius: s * 0.8,
          backgroundColor: ICON.leather,
        }}
      />
      {line(0.29, 0.56, 0.26)}
      {line(0.4, 0.56, 0.26)}
      {line(0.58, 0.26, 0.26)}
      {line(0.69, 0.26, 0.34)}
    </View>
  );
}

/** A cross — close. */
export function CloseIcon({ size = 22, color = THEME.ink }: IconProps) {
  const s = w(size);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {[45, -45].map((deg) => (
        <View
          key={deg}
          style={{
            position: 'absolute',
            width: size * 0.68,
            height: s * 1.2,
            borderRadius: s,
            backgroundColor: color,
            transform: [{ rotate: `${deg}deg` }],
          }}
        />
      ))}
    </View>
  );
}

/** A chevron. `up` by default; rotate for the other three. */
export function ChevronIcon({
  size = 22,
  color = THEME.ink,
  direction = 'up',
}: IconProps & { direction?: 'up' | 'down' | 'left' | 'right' }) {
  const s = w(size);
  const spin = { up: 0, right: 90, down: 180, left: 270 }[direction];
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ rotate: `${spin}deg` }],
      }}
    >
      <View
        style={{
          width: size * 0.44,
          height: size * 0.44,
          borderTopWidth: s * 1.2,
          borderLeftWidth: s * 1.2,
          borderColor: color,
          borderTopLeftRadius: s * 0.6,
          transform: [{ rotate: '45deg' }, { translateY: size * 0.06 }],
        }}
      />
    </View>
  );
}
