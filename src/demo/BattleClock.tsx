import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { playClick } from '../audio/sounds';
import { clockWords, formatClock, inFinalSeconds, shownSeconds } from '../game/battleTimer';
import { SHAPE, THEME } from '../ui/theme';

/**
 * The battle clock on the scoreboard: "2:30", counting down.
 *
 * David, 1 Nov 2026: "Add a two minute thirty second timer and if the
 * game doesn't finish by then it is a tie if the score is tied, or a win
 * for whoever is winning at that moment."
 *
 * IT KEEPS ITS OWN TIME, so the screen does not have to. Ticking the
 * clock through the battle screen's state would re-render all four
 * thousand lines of it, and the 3D board under them, four times a
 * second. Instead the screen holds the clock in a ref and hands over a
 * reader; only this small box re-renders, and only when the second it
 * shows actually changes. The decision at 0:00 is not made here — the
 * screen schedules that itself, so a clock that is not on screen still
 * ends the battle.
 *
 * THE LAST TEN SECONDS turn the box red with white figures, and tick
 * once a second with the game's own click. A colour and a sound, never a
 * flash: a blinking box is hard on some eyes and reads as an error.
 * Ticks only happen when the second changes, so a clock paused with the
 * game in a pocket is silent.
 */
export function BattleClock({
  read,
  ticks = true,
}: {
  /** Milliseconds left, read fresh on every look. */
  read: () => number;
  /** False for the second of two clocks on one phone (split screen), so it ticks once. */
  ticks?: boolean;
}) {
  const reader = useRef(read);
  reader.current = read;
  const [seconds, setSeconds] = useState(() => shownSeconds(read()));

  useEffect(() => {
    // Four looks a second, so the change of second is never more than a
    // quarter of a second late. Setting the same number again is free:
    // React does nothing when the value has not changed.
    const id = setInterval(() => setSeconds(shownSeconds(reader.current())), 250);
    return () => clearInterval(id);
  }, []);

  const ms = seconds * 1000;
  const final = inFinalSeconds(ms);
  const last = useRef(seconds);
  useEffect(() => {
    const changed = last.current !== seconds;
    last.current = seconds;
    if (changed && ticks && final) playClick();
  }, [seconds, ticks, final]);

  return (
    <View
      style={[styles.box, final && styles.boxFinal, seconds === 0 && styles.boxDone]}
      accessible
      accessibilityRole="timer"
      accessibilityLabel={clockWords(ms)}
    >
      <Text
        style={[styles.text, (final || seconds === 0) && styles.textFinal]}
        maxFontSizeMultiplier={1.3}
      >
        {formatClock(ms)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: THEME.sunk,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
    borderRadius: SHAPE.radiusSm,
    paddingHorizontal: 7,
    paddingVertical: 1,
    alignItems: 'center',
  },
  boxFinal: {
    backgroundColor: THEME.bad,
  },
  boxDone: {
    backgroundColor: THEME.ink,
  },
  text: {
    color: THEME.ink,
    fontSize: 17,
    fontWeight: '900',
    // Every figure the same width, so "1:11" and "1:00" are the same size
    // and the box does not twitch as the seconds go by.
    fontVariant: ['tabular-nums'],
  },
  textFinal: {
    color: THEME.onAccent,
  },
});
