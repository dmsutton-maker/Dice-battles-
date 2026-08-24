import React from 'react';
import { View } from 'react-native';
import { THEME } from './theme';

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
  color?: string;
}

/** The stroke weight every icon shares, scaled to its box. */
const w = (size: number) => Math.max(1.5, Math.round(size * 0.095));

/** A bag with a handle — the Store. */
export function BagIcon({ size = 22, color = THEME.ink }: IconProps) {
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
          backgroundColor: 'transparent',
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
export function CrateIcon({ size = 22, color = THEME.ink }: IconProps) {
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

/** A die — Battle. The game's own object, so it needs no metaphor. */
export function DieIcon({ size = 22, color = THEME.ink }: IconProps) {
  const s = w(size);
  const pip = size * 0.13;
  const at = (left: number, top: number) => (
    <View
      style={{
        position: 'absolute',
        left: size * left,
        top: size * top,
        width: pip,
        height: pip,
        borderRadius: pip / 2,
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
          top: size * 0.12,
          right: size * 0.12,
          bottom: size * 0.12,
          borderRadius: size * 0.22,
          borderWidth: s,
          borderColor: color,
        }}
      />
      {at(0.26, 0.26)}
      {at(0.435, 0.435)}
      {at(0.61, 0.61)}
    </View>
  );
}

/** A trophy — the Cups. */
export function TrophyIcon({ size = 22, color = THEME.ink }: IconProps) {
  const s = w(size);
  return (
    <View style={{ width: size, height: size }}>
      {/* The bowl: square at the shoulders, round at the bottom. */}
      <View
        style={{
          position: 'absolute',
          left: size * 0.26,
          top: size * 0.12,
          width: size * 0.48,
          height: size * 0.4,
          borderWidth: s,
          borderColor: color,
          borderTopLeftRadius: size * 0.04,
          borderTopRightRadius: size * 0.04,
          borderBottomLeftRadius: size * 0.24,
          borderBottomRightRadius: size * 0.24,
        }}
      />
      {/* Handles, one either side. */}
      <View
        style={{
          position: 'absolute',
          left: size * 0.09,
          top: size * 0.16,
          width: size * 0.2,
          height: size * 0.22,
          borderWidth: s,
          borderColor: color,
          borderTopLeftRadius: size * 0.1,
          borderBottomLeftRadius: size * 0.1,
          borderRightWidth: 0,
        }}
      />
      <View
        style={{
          position: 'absolute',
          right: size * 0.09,
          top: size * 0.16,
          width: size * 0.2,
          height: size * 0.22,
          borderWidth: s,
          borderColor: color,
          borderTopRightRadius: size * 0.1,
          borderBottomRightRadius: size * 0.1,
          borderLeftWidth: 0,
        }}
      />
      {/* Stem and foot. */}
      <View
        style={{
          position: 'absolute',
          left: size * 0.455,
          top: size * 0.52,
          width: s * 1.4,
          height: size * 0.2,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: size * 0.28,
          bottom: size * 0.1,
          width: size * 0.44,
          height: s * 1.4,
          borderRadius: s,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

/** Three rising bars — Ranks. */
export function RanksIcon({ size = 22, color = THEME.ink }: IconProps) {
  const s = w(size);
  const bar = (left: number, top: number) => (
    <View
      style={{
        position: 'absolute',
        left: size * left,
        top: size * top,
        bottom: size * 0.14,
        width: s * 1.3,
        borderRadius: s,
        backgroundColor: color,
      }}
    />
  );
  return (
    <View style={{ width: size, height: size }}>
      {bar(0.16, 0.52)}
      {bar(0.44, 0.18)}
      {bar(0.72, 0.38)}
    </View>
  );
}

/** A gear — Settings. */
export function GearIcon({ size = 22, color = THEME.ink }: IconProps) {
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
          backgroundColor: color,
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
export function HelpIcon({ size = 22, color = THEME.ink }: IconProps) {
  const s = w(size);
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
        }}
      />
      {/* The hook of the question mark: a ring with its bottom-left open. */}
      <View
        style={{
          position: 'absolute',
          left: size * 0.32,
          top: size * 0.24,
          width: size * 0.36,
          height: size * 0.3,
          borderWidth: s,
          borderColor: color,
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
          backgroundColor: color,
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
          backgroundColor: color,
        }}
      />
    </View>
  );
}

/** A newspaper — News: a page with a front-page block and text lines. */
export function NewsIcon({ size = 22, color = THEME.ink }: IconProps) {
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
        }}
      />
      {/* The front-page photo: a solid block, with its story beside it. */}
      <View
        style={{
          position: 'absolute',
          left: size * 0.26,
          top: size * 0.28,
          width: size * 0.22,
          height: size * 0.2,
          borderRadius: s * 0.8,
          backgroundColor: color,
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
