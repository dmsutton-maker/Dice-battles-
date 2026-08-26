import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PRISONER_COLORS } from '../game/colors';
import { COLOR_SYMBOLS } from '../game/colorblind';
import { SymbolId } from '../game/colorblind';
import { ShapeMark } from '../ui/ShapeMark';
import { MODE_ICONS } from '../ui/modeIcons';
import { MODES, MODE_ORDER } from '../game/modes';
import { TUTORIAL_PAGES, TutorialArt } from '../game/tutorial';
import { playClick } from '../audio/sounds';
import { GoldCoin } from './GoldCoin';
import { ThrowDemo } from './ThrowDemo';
import { SHAPE, THEME } from '../ui/theme';

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
    // The one page that is a demonstration rather than a picture, because
    // "swipe and the dice go the way you swiped" is a MOVEMENT and three
    // emoji in a row (👆 💨 🎲, which is what was here) cannot show one.
    return <ThrowDemo symbols={symbols} />;
  }

  if (art.kind === 'modes') {
    // 30 matches the old emoji's font size, so the row keeps the height
    // the tutorial popup's layout was measured against.
    return (
      <View style={styles.artRow}>
        {MODE_ORDER.map((id) =>
          React.createElement(MODE_ICONS[id], { key: id, size: 30 }),
        )}
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
  verdict: { color: THEME.ink, fontSize: 15, fontWeight: '900', marginLeft: 4 },

  title: {
    color: THEME.ink,
    fontSize: 19,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  line: {
    color: THEME.inkSoft,
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
    backgroundColor: 'rgba(29,26,46,0.25)',
  },
  dotOn: { backgroundColor: THEME.ink },

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
    borderRadius: SHAPE.radius,
    alignItems: 'center',
    backgroundColor: THEME.surface,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
  },
  buttonMain: { backgroundColor: THEME.accent, borderColor: THEME.ink },
  buttonDead: {
    backgroundColor: THEME.sunk,
    borderColor: 'rgba(29,26,46,0.30)',
  },
  buttonText: { color: THEME.ink, fontSize: 15, fontWeight: '900' },
  buttonTextMain: { color: THEME.onAccent },
  buttonTextDead: { color: THEME.inkFaint },
});
