import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
} from 'react-native';
import { PRISONER_COLORS } from '../game/colors';
import { COLOR_SYMBOLS } from '../game/colorblind';
import { ShapeMark } from '../ui/ShapeMark';
import { SHAPE, THEME } from '../ui/theme';

/**
 * "Throw the dice", shown rather than described.
 *
 * David asked on 26 Aug 2026 for "a little video showing real game play
 * with a hand on the screen flicking the dice". This is that, ANIMATED
 * rather than filmed, and the difference is worth writing down because it
 * was not a shortcut:
 *
 *   - Nothing here can record a phone. There is no device in this
 *     project's pipeline (AGENTS.md), so real footage would have to come
 *     off David's own handset every time the game changed.
 *   - Playing a video file needs `expo-video`, which is NATIVE code. A
 *     new native module means a new build, and builds are what is
 *     currently stuck — so a video could not ship at all right now, while
 *     this reaches the family over the air today.
 *   - A recording also goes stale silently. It would still show the old
 *     dice, the old arena and the old jail long after they changed, and
 *     nothing would fail to tell anybody.
 *
 * So this is drawn from the same palette the game plays with, in Views,
 * the way src/ui/Icon.tsx draws the icon set and for the same reason:
 * Views cost nothing, ship over the air, and cannot disagree with the
 * game about what a colour looks like.
 *
 * THE PAGE IT REPLACES was three emoji — 👆 💨 🎲 — which is exactly what
 * the Paper & Ink pass set out to get rid of everywhere else.
 */

/** One trip through the whole story, in milliseconds. */
const LOOP_MS = 4200;

/**
 * The colour the demo lands on. Blue, because it is the darkest of the
 * six and so the white shape stamped on it in colourblind mode is legible
 * at this size — several of the others are near-white themselves.
 */
const MATCH = PRISONER_COLORS.find((c) => c.id === 'blue')!;

/** The tumbling faces, so the dice are visibly CHANGING before they land. */
const TUMBLE = PRISONER_COLORS.filter((c) => c.id !== MATCH.id);

/** The board the demo plays on. Fixed, so the timeline can be laid out in it. */
const W = 250;
const H = 150;
const DIE = 34;

/**
 * The timeline, in fractions of the loop.
 *
 * Written as named marks rather than inline numbers so the sequence can
 * be read in one place and shifted without hunting through interpolations.
 */
const T = {
  handIn: 0.06,
  swipeStart: 0.12,
  swipeEnd: 0.24,
  handOut: 0.34,
  diceFly: 0.16,
  diceLand: 0.50,
  /*
    `settled` sits clear of BOTH dice. The right one lands 0.045 later and
    its landing squash runs on for 0.03 after that, so anything before
    0.58 would start freeing the prisoner while a die was still bouncing —
    and the one thing this page has to say is that the match comes first.
  */
  settled: 0.60,
  freed: 0.66,
  gone: 0.82,
  reset: 0.94,
};

export function ThrowDemo({ symbols }: { symbols: boolean }) {
  const t = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let alive = true;
    /*
      A loop the viewer cannot stop is exactly what "reduce motion" is for
      — and a tutorial is somewhere a person may sit for a while. When it
      is on, the demo holds the FINISHED frame: dice matched, prisoner
      gone. That is the frame that carries the meaning, so nothing is lost
      by not moving.
    */
    AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (alive) setReduceMotion(on);
    });
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (on) => {
        if (alive) setReduceMotion(on);
      },
    );
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      t.setValue(T.freed);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(t, {
        toValue: 1,
        duration: LOOP_MS,
        easing: Easing.linear,
        // Everything below is transform or opacity, which is the whole
        // reason this can run off the JS thread — a tutorial that stutters
        // while React renders is worse than no animation.
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, t]);

  /** Shorthand: a value that moves between marks and holds outside them. */
  const between = (
    from: number,
    to: number,
    out: [number, number],
    easing?: (v: number) => number,
  ) =>
    t.interpolate({
      inputRange: [0, from, to, 1],
      outputRange: [out[0], out[0], out[1], out[1]],
      easing,
      extrapolate: 'clamp',
    });

  // ── The hand ────────────────────────────────────────────────────────
  // It comes in from the bottom-right, flicks up and to the left, and
  // leaves. The dice go the way it went, which is the rule the page is
  // teaching: "swipe, and the dice go the way you swiped".
  const handX = t.interpolate({
    inputRange: [0, T.handIn, T.swipeStart, T.swipeEnd, T.handOut, 1],
    outputRange: [90, 46, 46, -18, 40, 90],
    extrapolate: 'clamp',
  });
  const handY = t.interpolate({
    inputRange: [0, T.handIn, T.swipeStart, T.swipeEnd, T.handOut, 1],
    outputRange: [90, 34, 34, -14, 44, 90],
    extrapolate: 'clamp',
  });
  const handFade = t.interpolate({
    inputRange: [0, T.handIn, T.handOut - 0.04, T.handOut, 1],
    outputRange: [0, 1, 1, 0, 0],
    extrapolate: 'clamp',
  });
  // The press: the fingertip squashes on contact and releases as it goes.
  const handPress = t.interpolate({
    inputRange: [0, T.handIn, T.swipeStart, T.swipeEnd, 1],
    outputRange: [1, 1, 0.86, 1, 1],
    extrapolate: 'clamp',
  });

  // The swipe trail, drawn once and wiped along with the flick.
  const trailFade = t.interpolate({
    inputRange: [0, T.swipeStart, T.swipeEnd, T.handOut, 1],
    outputRange: [0, 0, 0.9, 0, 0],
    extrapolate: 'clamp',
  });

  // ── The prisoner who goes free ──────────────────────────────────────
  // He lifts out of the jail once the dice have settled, not before: the
  // whole point of the page is that the match comes first.
  const freeLift = between(T.settled, T.gone, [0, -54], Easing.out(Easing.quad));
  const freeFade = t.interpolate({
    inputRange: [0, T.settled, T.freed, T.gone, T.reset, 1],
    outputRange: [1, 1, 1, 0, 0, 1],
    extrapolate: 'clamp',
  });
  const freeSpin = between(T.settled, T.gone, [0, 1]);

  return (
    <View style={styles.stage}>
      {/* The jail the six are held in, along the top. */}
      <View style={styles.jail}>
        {PRISONER_COLORS.map((c) => {
          const isMatch = c.id === MATCH.id;
          return (
            <Animated.View
              key={c.id}
              style={[
                styles.cell,
                { backgroundColor: c.hex },
                isMatch && {
                  opacity: freeFade,
                  transform: [
                    { translateY: freeLift },
                    {
                      rotate: freeSpin.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '38deg'],
                      }),
                    },
                  ],
                },
              ]}
            >
              {symbols && (
                <ShapeMark symbol={COLOR_SYMBOLS[c.id]} size={9} />
              )}
            </Animated.View>
          );
        })}
      </View>

      {/* The two dice. */}
      <Die t={t} symbols={symbols} lane={-1} />
      <Die t={t} symbols={symbols} lane={1} />

      {/* The swipe trail, under the hand. */}
      <Animated.View style={[styles.trail, { opacity: trailFade }]} />

      {/* The hand. */}
      <Animated.View
        style={[
          styles.hand,
          {
            opacity: handFade,
            transform: [
              { translateX: handX },
              { translateY: handY },
              { scale: handPress },
            ],
          },
        ]}
      >
        <View style={styles.fingertip} />
        <View style={styles.finger} />
      </Animated.View>
    </View>
  );
}

/**
 * One die.
 *
 * `lane` is -1 for the left die and 1 for the right, which is all that
 * separates them — they fly the same arc, land side by side, and show the
 * same colour, because a MATCH is the thing this page exists to explain.
 */
function Die({
  t,
  symbols,
  lane,
}: {
  t: Animated.Value;
  symbols: boolean;
  lane: -1 | 1;
}) {
  /*
    The two dice are deliberately NOT identical in flight. Rendering the
    timeline frame by frame showed them converging on the same point at
    the same speed and passing through each other about two thirds of the
    way, so for several frames there was one fat blob in the air instead
    of two dice. They now leave from different points, arc to different
    heights and land a beat apart.
  */
  const lands = T.diceLand + (lane === 1 ? 0.045 : 0);
  const peak = lane === 1 ? -14 : -30;

  // Off to the bottom-right where the hand starts, then up the flick.
  const x = t.interpolate({
    inputRange: [0, T.diceFly, lands, T.settled, T.reset, 1],
    outputRange: [58 + lane * 9, 58 + lane * 9, lane * 30, lane * 30, lane * 30, 58 + lane * 9],
    extrapolate: 'clamp',
  });
  const y = t.interpolate({
    inputRange: [0, T.diceFly, (T.diceFly + lands) / 2, lands, T.settled, T.reset, 1],
    // Up over an arc and back down — a throw, not a slide.
    outputRange: [56, 56, peak, 14, 14, 14, 56],
    extrapolate: 'clamp',
  });
  /*
    The tumble. It spins fast at first and eases to a stop, which is what
    makes the landing read as a landing rather than a jump cut — the same
    reason the real game waits for the dice to stop before it counts a
    colour (see src/dice/settle.ts).
  */
  /*
    A WHOLE NUMBER OF TURNS, so the die comes to rest square on a face.

    This was 560·lane + 380, which is 940° for one die and -180° for the
    other. Rendering the timeline showed the result plainly: the right die
    settled at 220°, sitting on the table as a diamond. That is precisely
    what the game itself refuses to do — a roll only ends when the dice
    have landed flat, and cocked ones are turned square before the colour
    is read (src/dice/settle.ts, src/dice/die.ts). A tutorial demonstrating
    the opposite of the rule is worse than no tutorial.

    Two different totals, so the dice still look independently thrown.
  */
  const turns = lane === 1 ? 1080 : 720;
  const spin = t.interpolate({
    inputRange: [0, T.diceFly, lands, 1],
    outputRange: ['0deg', '0deg', `${turns}deg`, `${turns}deg`],
    easing: Easing.out(Easing.cubic),
    extrapolate: 'clamp',
  });
  // A small squash as it hits, then settled.
  const land = t.interpolate({
    inputRange: [0, lands, lands + 0.03, T.settled, 1],
    outputRange: [1, 1, 1.14, 1, 1],
    extrapolate: 'clamp',
  });
  /*
    Hidden until the finger actually moves. A straight fade from t=0 put
    the dice on the table before the hand had touched it, so the page
    opened on two dice sitting there and the flick looked like it did
    nothing.
  */
  const show = t.interpolate({
    inputRange: [0, T.swipeStart, T.swipeStart + 0.02, T.reset, 1],
    outputRange: [0, 0, 1, 1, 0],
    extrapolate: 'clamp',
  });

  /*
    Colour cannot be animated on the native driver, so the faces are
    STACKED and cross-faded instead: the tumbling colours underneath, the
    matched colour on top. That keeps the whole demo off the JS thread,
    and it is also closer to what the eye sees on a real die — a colour
    replacing a colour, not one shape morphing into another.
  */
  const matchFade = t.interpolate({
    inputRange: [0, lands - 0.06, lands, T.reset, 1],
    outputRange: [0, 0, 1, 1, 0],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      style={[
        styles.die,
        {
          opacity: show,
          transform: [{ translateX: x }, { translateY: y }, { rotate: spin }, { scale: land }],
        },
      ]}
    >
      {TUMBLE.map((c, i) => (
        <Animated.View
          key={c.id}
          style={[
            StyleSheet.absoluteFill,
            styles.face,
            { backgroundColor: c.hex },
            {
              // Each tumbling colour takes its turn, so the die is not one
              // flat block sliding across the board.
              opacity: t.interpolate({
                inputRange: [
                  T.diceFly,
                  T.diceFly + (i / TUMBLE.length) * (lands - T.diceFly),
                  T.diceFly + ((i + 1) / TUMBLE.length) * (lands - T.diceFly),
                  lands,
                ],
                outputRange: [0, 1, 0, 0],
                extrapolate: 'clamp',
              }),
            },
          ]}
        />
      ))}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.face,
          { backgroundColor: MATCH.hex, opacity: matchFade },
        ]}
      >
        {symbols && (
          <View style={styles.faceMark}>
            <ShapeMark symbol={COLOR_SYMBOLS[MATCH.id]} size={DIE * 0.42} />
          </View>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: W,
    height: H,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.tile,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
    borderRadius: SHAPE.radius,
    overflow: 'hidden',
  },
  jail: {
    position: 'absolute',
    top: 10,
    flexDirection: 'row',
    gap: 5,
  },
  cell: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: THEME.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  die: {
    position: 'absolute',
    width: DIE,
    height: DIE,
    borderRadius: DIE * 0.24,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
    backgroundColor: THEME.surface,
    overflow: 'hidden',
  },
  face: {
    borderRadius: DIE * 0.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceMark: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  /*
    The swipe, as the smear a finger leaves rather than an arrow. An arrow
    would be an instruction; this is the movement itself, which is what
    the page is asking the player to copy.
  */
  trail: {
    position: 'absolute',
    width: 96,
    height: 5,
    borderRadius: 3,
    backgroundColor: THEME.ink,
    opacity: 0.9,
    transform: [{ rotate: '-28deg' }, { translateX: 14 }, { translateY: 12 }],
  },
  /*
    The hand is a fingertip and the finger behind it, not a whole hand.
    At 150pt tall a full hand becomes a grey blob; a fingertip on the
    glass is what a player actually sees of their own hand anyway.
  */
  hand: {
    position: 'absolute',
    alignItems: 'center',
  },
  fingertip: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(29,26,46,0.16)',
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
  },
  finger: {
    width: 15,
    height: 40,
    marginTop: -5,
    borderRadius: 8,
    backgroundColor: 'rgba(29,26,46,0.10)',
    borderWidth: 1.5,
    borderColor: 'rgba(29,26,46,0.55)',
  },
});
