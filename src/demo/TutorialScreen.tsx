import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PRISONER_COLORS } from '../game/colors';
import { COLOR_SYMBOLS, SymbolId } from '../game/colorblind';
import { MODES, MODE_ORDER } from '../game/modes';
import { TUTORIAL_PAGES, TutorialArt } from '../game/tutorial';
import { playClick } from '../audio/sounds';
import { GoldCoin } from './GoldCoin';

/**
 * How to play, one screen at a time.
 *
 * Six pages rather than one long wall, because the whole game is one rule
 * — two dice the same frees a prisoner — and burying that in a paragraph
 * is how people end up not knowing it. Each page carries a picture, which
 * for a game whose signal is COLOUR does more work than the words do.
 *
 * The pictures honour colourblind mode: if shapes are on, the swatches
 * here get their shapes, exactly as the dice do. A tutorial that showed
 * plain colours to somebody who has asked for shapes would be teaching a
 * game they are not going to see.
 */
export function TutorialScreen({
  symbols,
  onClose,
}: {
  /** Colourblind mode: stamp each colour with its shape. */
  symbols: boolean;
  onClose: () => void;
}) {
  const [page, setPage] = useState(0);
  const current = TUTORIAL_PAGES[page];
  const last = page === TUTORIAL_PAGES.length - 1;

  const go = (delta: number) => {
    playClick();
    setPage((p) => Math.min(TUTORIAL_PAGES.length - 1, Math.max(0, p + delta)));
  };

  return (
    <View style={styles.body}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Art art={current.art} symbols={symbols} />
        <Text style={styles.title}>{current.title}</Text>
        {current.lines.map((line) => (
          <Text key={line} style={styles.line}>
            {line}
          </Text>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {TUTORIAL_PAGES.map((p, i) => (
          <View key={p.title} style={[styles.dot, i === page && styles.dotOn]} />
        ))}
      </View>

      <View style={styles.buttons}>
        <Pressable
          style={[styles.button, page === 0 && styles.buttonDead]}
          disabled={page === 0}
          onPress={() => go(-1)}
        >
          <Text style={[styles.buttonText, page === 0 && styles.buttonTextDead]}>
            Back
          </Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.buttonMain]}
          onPress={() => {
            if (last) {
              playClick();
              onClose();
            } else {
              go(1);
            }
          }}
        >
          <Text style={[styles.buttonText, styles.buttonTextMain]}>
            {last ? "Let's play" : 'Next'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/** A palette colour as it appears in play: the colour, plus its shape. */
function Swatch({
  hex,
  symbol,
  size = 38,
}: {
  hex: string;
  symbol: SymbolId | null;
  size?: number;
}) {
  return (
    <View
      style={[
        styles.swatch,
        { width: size, height: size, borderRadius: size * 0.28, backgroundColor: hex },
      ]}
    >
      {symbol && <ShapeMark symbol={symbol} size={size * 0.5} />}
    </View>
  );
}

/**
 * The colourblind shapes, drawn with plain Views.
 *
 * The dice build theirs as textures (src/dice/symbols.ts) because they go
 * onto a 3D face. Here a handful of borders and rotations gets the same
 * silhouette without dragging a texture painter into a menu — the point is
 * that the shape a player sees in the tutorial is the shape they will look
 * for on the table.
 */
function ShapeMark({ symbol, size }: { symbol: SymbolId; size: number }) {
  const ink = 'rgba(0,0,0,0.62)';
  if (symbol === 'circle') {
    return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: ink }} />;
  }
  if (symbol === 'square') {
    return <View style={{ width: size * 0.9, height: size * 0.9, backgroundColor: ink }} />;
  }
  if (symbol === 'diamond') {
    return (
      <View
        style={{
          width: size * 0.72,
          height: size * 0.72,
          backgroundColor: ink,
          transform: [{ rotate: '45deg' }],
        }}
      />
    );
  }
  if (symbol === 'triangle') {
    return (
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: size * 0.5,
          borderRightWidth: size * 0.5,
          borderBottomWidth: size * 0.86,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: ink,
        }}
      />
    );
  }
  if (symbol === 'hexagon') {
    // Close enough at this size: a wide rounded slab reads as the hexagon
    // it stands for, and nobody is telling them apart by corner count.
    return (
      <View
        style={{
          width: size,
          height: size * 0.78,
          borderRadius: size * 0.18,
          backgroundColor: ink,
        }}
      />
    );
  }
  // Star: two crossed bars is the silhouette that survives at this size.
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          width: size * 0.28,
          height: size,
          backgroundColor: ink,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size * 0.28,
          backgroundColor: ink,
        }}
      />
    </View>
  );
}

function Art({ art, symbols }: { art: TutorialArt; symbols: boolean }) {
  const sym = (id: keyof typeof COLOR_SYMBOLS) => (symbols ? COLOR_SYMBOLS[id] : null);

  if (art.kind === 'palette') {
    return (
      <View style={styles.artRow}>
        {PRISONER_COLORS.map((c) => (
          <Swatch key={c.id} hex={c.hex} symbol={sym(c.id)} size={34} />
        ))}
      </View>
    );
  }

  if (art.kind === 'match' || art.kind === 'miss') {
    const [a, b] =
      art.kind === 'match'
        ? [PRISONER_COLORS[2], PRISONER_COLORS[2]]
        : [PRISONER_COLORS[0], PRISONER_COLORS[1]];
    return (
      <View style={styles.artRow}>
        <Swatch hex={a.hex} symbol={sym(a.id)} size={52} />
        <Swatch hex={b.hex} symbol={sym(b.id)} size={52} />
        <Text style={styles.verdict}>{art.kind === 'match' ? '🔓 free!' : '🔒 nope'}</Text>
      </View>
    );
  }

  if (art.kind === 'throw') {
    return (
      <View style={styles.artRow}>
        <Text style={styles.bigEmoji}>👆</Text>
        <Text style={styles.bigEmoji}>💨</Text>
        <Text style={styles.bigEmoji}>🎲</Text>
      </View>
    );
  }

  if (art.kind === 'modes') {
    return (
      <View style={styles.artRow}>
        {MODE_ORDER.map((id) => (
          <Text key={id} style={styles.bigEmoji}>
            {MODES[id].emoji}
          </Text>
        ))}
      </View>
    );
  }

  if (art.kind === 'rewards') {
    return (
      <View style={styles.artRow}>
        <Text style={styles.bigEmoji}>🏆</Text>
        <GoldCoin size={34} />
      </View>
    );
  }

  // Every kind is handled above. This used to be the rewards branch as a
  // bare fall-through, which meant a page asking for art nobody had drawn
  // yet would silently show a trophy and a coin — wrong, and invisible.
  return null;
}

const styles = StyleSheet.create({
  // flexShrink, never flex: this sits inside a popup capped by maxHeight,
  // which never proves a definite height, so flex:1 resolves to zero and
  // the whole page renders empty. That has happened twice.
  body: { flexShrink: 1 },
  scroll: { flexShrink: 1 },
  scrollContent: { paddingHorizontal: 18, paddingBottom: 8 },

  artRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    minHeight: 62,
    marginBottom: 12,
  },
  swatch: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.22)',
  },
  bigEmoji: { fontSize: 30 },
  verdict: { color: '#fff', fontSize: 15, fontWeight: '900', marginLeft: 4 },

  title: {
    color: '#fff',
    fontSize: 19,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  line: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 8,
  },

  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  dotOn: { backgroundColor: '#ffe521' },

  buttons: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  button: {
    flexGrow: 1,
    flexBasis: 0,
    paddingVertical: 13,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  buttonMain: { backgroundColor: '#ffe521', borderColor: 'rgba(0,0,0,0.2)' },
  buttonDead: { opacity: 0.35 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  buttonTextMain: { color: '#1b1330' },
  buttonTextDead: { color: 'rgba(255,255,255,0.7)' },
});
