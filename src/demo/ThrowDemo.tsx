import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
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
 * with a hand on the screen flicking the dice", looked at the first
 * attempt, and said: "it doesn't look like a mini arena and does not look
 * anything like a hand." He was right on both counts. The first version
 * played out on a blank cream rectangle with a grey circle on a stick for
 * a hand, and it was checked only for whether the TIMELINE made sense —
 * never against what the game actually looks like.
 *
 * So this one is built from a real screenshot of the game
 * (hq/public/images/game-screenshot-1.jpeg), with the colours sampled out
 * of it rather than invented:
 *
 *     grass   #82b16d      stone wall  #917f67 / #7a6b56
 *     floor   #c1b295      floor lines #928366
 *     towers  #e16355      jail base   #423b31
 *
 * and the same furniture the battlefield has: a stone tray with
 * crenellated walls, red corner towers, a tiled floor, and the barred
 * jail across the top with the six prisoners standing behind it. The dice
 * are white with a big colour spot, which is what a die in this game
 * looks like — the first version drew them as solid colour blocks, which
 * is not a thing the player ever sees.
 *
 * WHY IT IS ANIMATED AND NOT FILMED. Nothing here can record a phone, so
 * footage would have to come off David's own handset every time the game
 * changed; playing a video needs a native player, which needs a build,
 * which is what is currently stuck; and a recording goes stale in silence
 * while the game moves on. This cannot — it reads the live palette.
 *
 * THE FINGER is the one piece that is an image (assets/tutorial/finger.png,
 * and the README beside it explains why). It took three goes: a fingertip
 * made of two rounded rectangles, which was a circle on a stick; a drawn
 * cartoon hand with an ink outline; and then this, after David asked for
 * "a real looking finger". He was right that a finger is the better
 * object — what you see of your own hand on the glass IS a fingertip, and
 * a whole hand at this size was mostly knuckles taking up the arena.
 *
 * What makes it read as real is shading and the absence of an outline,
 * which is exactly what Views cannot do; react-native-svg is native code
 * and cannot be added. Image assets ship over the air with the update
 * like everything else, so this still needs no build.
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

/** Sampled from the game, not chosen. See the note above. */
const ARENA = {
  grass: '#82b16d',
  grassDark: '#6f9a5c',
  wall: '#917f67',
  wallDark: '#7a6b56',
  floor: '#c1b295',
  floorLine: '#928366',
  tower: '#e16355',
  towerDark: '#c94f43',
  jail: '#423b31',
} as const;

/** The stage, and the tray inside it. */
const W = 252;
const H = 168;
const TRAY = { w: 148, h: 116, top: 40, wall: 8 };
const DIE = 30;
/** Blocks along the top and bottom walls — the crenellation. */
const MERLONS = 7;

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
        // Everything animated here is transform or opacity, which is the
        // whole reason it can run off the JS thread — a tutorial that
        // stutters while React renders is worse than a still picture.
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, t]);

  // ── The hand ────────────────────────────────────────────────────────
  // In from the bottom-right, press, flick up and to the left, away. The
  // dice go the way it went, which is the rule the page is teaching:
  // "swipe, and the dice go the way you swiped".
  const handX = t.interpolate({
    inputRange: [0, T.handIn, T.swipeStart, T.swipeEnd, T.handOut, 1],
    outputRange: [120, 52, 52, -20, 54, 120],
    extrapolate: 'clamp',
  });
  const handY = t.interpolate({
    inputRange: [0, T.handIn, T.swipeStart, T.swipeEnd, T.handOut, 1],
    /*
      Tuned against the rendered frames, not reasoned about. translateY
      moves the view's CENTRE, and the fingertip is 52pt above that, so
      the marks that look right for a fingertip are nowhere near the ones
      that look right on paper: at -30 the tip flicked clean over the jail
      and out of the arena. It now stops just below the bars.
    */
    outputRange: [104, 48, 48, 4, 60, 104],
    extrapolate: 'clamp',
  });
  const handFade = t.interpolate({
    inputRange: [0, T.handIn, T.handOut - 0.05, T.handOut, 1],
    outputRange: [0, 1, 1, 0, 0],
    extrapolate: 'clamp',
  });
  // The press: the hand dips into the glass on contact and lifts as it goes.
  const handPress = t.interpolate({
    inputRange: [0, T.handIn, T.swipeStart, T.swipeEnd, 1],
    outputRange: [1, 1, 0.9, 1.02, 1.02],
    extrapolate: 'clamp',
  });

  // The smear the finger leaves, wiped along with the flick.
  const trailFade = t.interpolate({
    inputRange: [0, T.swipeStart, T.swipeEnd, T.handOut, 1],
    outputRange: [0, 0, 0.55, 0, 0],
    extrapolate: 'clamp',
  });

  // ── The prisoner who goes free ──────────────────────────────────────
  /*
    A small hop, not a flight. At -30 the prisoner rose clear of the cage
    and sat on TOP of the bars for a second, which looks like a drawing
    mistake rather than a rescue. It lifts just enough to read as leaving
    and is gone before it could clear the bars; the empty slot left behind
    is what actually tells the story.
  */
  const freeLift = t.interpolate({
    inputRange: [0, T.settled, T.gone, 1],
    outputRange: [0, 0, -9, -9],
    easing: Easing.out(Easing.quad),
    extrapolate: 'clamp',
  });
  const freeFade = t.interpolate({
    inputRange: [0, T.settled, T.freed, T.gone, T.reset, 1],
    outputRange: [1, 1, 1, 0, 0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.stage}>
      {/* Grass, and the path that runs out of the gate. */}
      <View style={styles.path} />

      {/* The jail across the top: a dark barred cage, six prisoners in it. */}
      <View style={styles.jail}>
        <View style={styles.jailFloor} />
        <View style={styles.jailRow}>
          {PRISONER_COLORS.map((c) => (
            <Animated.View
              key={c.id}
              style={[
                styles.peg,
                { backgroundColor: c.hex },
                c.id === MATCH.id && {
                  opacity: freeFade,
                  transform: [{ translateY: freeLift }],
                },
              ]}
            >
              {symbols && <ShapeMark symbol={COLOR_SYMBOLS[c.id]} size={7} />}
            </Animated.View>
          ))}
        </View>
        {/* The bars, in front of them. */}
        <View style={styles.bars}>
          {Array.from({ length: 11 }).map((_, i) => (
            <View key={i} style={styles.bar} />
          ))}
        </View>
      </View>

      {/* The tray: stone walls, tiled floor. */}
      <View style={styles.tray}>
        <View style={styles.floor}>
          {/* The tile grid. Faint, the way it is in the game. */}
          {Array.from({ length: 5 }).map((_, i) => (
            <View key={`h${i}`} style={[styles.tileLine, { top: (i + 1) * 16 }]} />
          ))}
          {Array.from({ length: 3 }).map((_, i) => (
            <View key={`v${i}`} style={[styles.tileLineV, { left: (i + 1) * 33 }]} />
          ))}
        </View>

        {/* Crenellation: blocks standing along the top and bottom walls. */}
        {(['top', 'bottom'] as const).map((edge) =>
          Array.from({ length: MERLONS }).map((_, i) => (
            <View
              key={`${edge}${i}`}
              style={[
                styles.merlon,
                { left: 6 + i * ((TRAY.w - 18) / (MERLONS - 1)) },
                edge === 'top' ? { top: 0 } : { bottom: 0 },
              ]}
            />
          )),
        )}
      </View>

      {/* The four red towers, on the tray's corners. */}
      {([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).map(([sx, sy]) => (
        <View
          key={`${sx}${sy}`}
          style={[
            styles.tower,
            {
              left: W / 2 + sx * (TRAY.w / 2) - 11,
              top: TRAY.top + (sy < 0 ? -8 : TRAY.h - 14),
            },
          ]}
        />
      ))}

      {/* The two dice. */}
      <Die t={t} symbols={symbols} lane={-1} />
      <Die t={t} symbols={symbols} lane={1} />

      {/* The smear, under the hand. */}
      <Animated.View style={[styles.trail, { opacity: trailFade }]} />

      {/* The hand. */}
      <Animated.Image
        source={require('../../assets/tutorial/finger.png')}
        resizeMode="contain"
        style={[
          styles.hand,
          {
            opacity: handFade,
            transform: [
              { translateX: handX },
              { translateY: handY },
              { rotate: '18deg' },
              { scale: handPress },
            ],
          },
        ]}
      />
    </View>
  );
}

/**
 * One die: white, with a big colour spot, which is what this game's dice
 * actually look like. The first version drew them as solid colour blocks
 * — a thing the player never sees.
 *
 * `lane` is -1 for the left die and 1 for the right.
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
    of two dice. They leave from different points, arc to different
    heights, and land a beat apart.
  */
  const lands = T.diceLand + (lane === 1 ? 0.045 : 0);
  const peak = lane === 1 ? -6 : -20;

  /*
    Everything happens INSIDE the tray. The dice used to start at x=66,
    which is past the inner face of the right-hand wall — so the throw
    began with two dice sitting on the battlements, out on the grass.
    38 keeps the whole die on the floor at its widest point.
  */
  const x = t.interpolate({
    inputRange: [0, T.diceFly, lands, T.settled, T.reset, 1],
    outputRange: [38 + lane * 7, 38 + lane * 7, lane * 26, lane * 26, lane * 26, 38 + lane * 7],
    extrapolate: 'clamp',
  });
  const y = t.interpolate({
    inputRange: [0, T.diceFly, (T.diceFly + lands) / 2, lands, T.settled, T.reset, 1],
    // Up over an arc and back down — a throw, not a slide.
    outputRange: [46, 46, peak, 32, 32, 32, 46],
    extrapolate: 'clamp',
  });

  /*
    A WHOLE NUMBER OF TURNS, so the die comes to rest square on a face.

    This was 560·lane + 380, which is 940° for one die and -180° for the
    other. Rendering the timeline showed the result plainly: the right die
    settled at 220°, sitting on the floor as a diamond. That is precisely
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
    the dice on the floor before the hand had touched the glass, so the
    page opened on two dice sitting there and the flick looked like it did
    nothing.
  */
  const show = t.interpolate({
    inputRange: [0, T.swipeStart, T.swipeStart + 0.02, T.reset, 1],
    outputRange: [0, 0, 1, 1, 0],
    extrapolate: 'clamp',
  });

  /*
    Colour cannot be animated on the native driver, so the spots are
    STACKED and cross-faded instead: the tumbling colours underneath, the
    matched colour on top. That keeps the whole demo off the JS thread,
    and it is also closer to what the eye sees on a real die — a colour
    replacing a colour, not one shape becoming another.
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
            styles.spot,
            { backgroundColor: c.hex },
            {
              // Each tumbling colour takes its turn, so the die is not one
              // flat block sliding across the floor.
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
        style={[styles.spot, { backgroundColor: MATCH.hex, opacity: matchFade }]}
      >
        {symbols && <ShapeMark symbol={COLOR_SYMBOLS[MATCH.id]} size={DIE * 0.3} />}
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
    backgroundColor: ARENA.grass,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
    borderRadius: SHAPE.radius,
    overflow: 'hidden',
  },
  /** The dirt path leading away from the gate, as in the real arena. */
  path: {
    position: 'absolute',
    bottom: 0,
    width: 44,
    height: 26,
    backgroundColor: ARENA.grassDark,
  },

  // ── the jail ────────────────────────────────────────────────────────
  jail: {
    position: 'absolute',
    top: 4,
    width: 132,
    height: 32,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  jailFloor: {
    ...StyleSheet.absoluteFillObject,
    top: 12,
    backgroundColor: ARENA.jail,
    borderRadius: 3,
  },
  jailRow: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 3,
  },
  /** A prisoner: a stubby peg, the way they stand in the jail. */
  peg: {
    width: 13,
    height: 17,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: THEME.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bars: {
    ...StyleSheet.absoluteFillObject,
    top: 2,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'stretch',
    paddingHorizontal: 4,
  },
  bar: {
    width: 2,
    backgroundColor: THEME.ink,
    borderRadius: 1,
  },

  // ── the tray ────────────────────────────────────────────────────────
  tray: {
    position: 'absolute',
    top: TRAY.top,
    width: TRAY.w,
    height: TRAY.h,
    backgroundColor: ARENA.wall,
    borderWidth: 1.5,
    borderColor: ARENA.wallDark,
    borderRadius: 3,
    padding: TRAY.wall,
  },
  floor: {
    flex: 1,
    backgroundColor: ARENA.floor,
    overflow: 'hidden',
  },
  tileLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: ARENA.floorLine,
    opacity: 0.45,
  },
  tileLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: ARENA.floorLine,
    opacity: 0.45,
  },
  /** One block of the battlement. */
  merlon: {
    position: 'absolute',
    width: 12,
    height: 7,
    backgroundColor: ARENA.wallDark,
    borderRadius: 1,
  },
  tower: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: ARENA.tower,
    borderWidth: 1.5,
    borderColor: ARENA.towerDark,
  },

  // ── the dice ────────────────────────────────────────────────────────
  die: {
    position: 'absolute',
    width: DIE,
    height: DIE,
    borderRadius: DIE * 0.22,
    borderWidth: 1.5,
    borderColor: 'rgba(29,26,46,0.55)',
    // White, like a real die in this game. The colour is the SPOT on it.
    backgroundColor: '#fdfcf8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spot: {
    position: 'absolute',
    width: DIE * 0.56,
    height: DIE * 0.56,
    borderRadius: DIE * 0.28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── the hand ────────────────────────────────────────────────────────
  /*
    A finger, not a hand.
    
    David asked for "a real looking finger" after seeing the drawn hand.
    He is right that it is the better object: what a player sees of their
    own hand on the glass IS a fingertip, and a whole hand at this size
    was mostly knuckles taking up the arena. The proportions are a real
    finger's — a shade under half as wide as it is long.
  */
  /*
    43 x 104 is the asset's own aspect ratio, so `contain` fits it exactly
    with no letterboxing. The length is what it is for a reason: any
    longer and the flick carried the fingertip up over the jail, because
    translateY moves the view's CENTRE and a long finger's tip is a long
    way from that.
  */
  hand: {
    position: 'absolute',
    width: 43,
    height: 104,
  },
  trail: {
    position: 'absolute',
    width: 92,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ffffff',
    transform: [{ rotate: '-30deg' }, { translateX: 18 }, { translateY: 18 }],
  },
});
