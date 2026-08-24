/**
 * Paper & Ink — the one place the game's colours and shapes are decided.
 *
 * David chose this direction on 24 Aug 2026, light mode only, after seeing
 * it beside a darker "Deep Table" alternative. The old interface read as an
 * early-App-Store game for five specific reasons, and this exists to fix
 * the ones that are colour and shape:
 *
 *   1. Emoji used as icons          -> src/ui/Icon.tsx draws them
 *   2. Saturated slab buttons       -> ACCENT on paper, with a real border
 *   3. ALL CAPS with no hierarchy   -> weight and size carry it instead
 *   4. No typeface                  -> see the note on fonts below
 *   5. Flat panels, hard borders    -> outline plus an offset shadow
 *
 * The character of the direction is DEPTH FROM SHAPE, not from light: a
 * 2px outline and a hard offset shadow, so every card reads as a physical
 * piece sitting on a table. That is why nothing here is a gradient and
 * nothing is a soft blur — a piece of card does not glow.
 *
 * NO DARK MODE. It was mocked up and deliberately dropped, so anything
 * reading a system colour scheme is a mistake rather than a feature.
 */

export const THEME = {
  /** The table everything sits on. Warm, never blue-grey. */
  ground: '#fdf6ec',
  /** A card. */
  surface: '#ffffff',
  /** Inset tracks — segmented controls, progress rails. */
  sunk: '#efe4d4',
  /** A tile behind an object being shown off, e.g. a die in the Store. */
  tile: '#f5ece0',

  /** Text, and the outline. One ink for both is what makes it read as ink. */
  ink: '#1d1a2e',
  /**
   * Secondary and tertiary text. Solved against WCAG 4.5:1, not nudged —
   * and solved on SUNK, the darkest paper text sits on, not on white:
   * 0.62 passed white (4.79:1) and quietly failed the sunk track (4.40:1).
   * 0.66 is the floor that passes everywhere; 0.70 keeps secondary a real
   * step darker than tertiary.
   */
  inkSoft: 'rgba(29,26,46,0.70)',
  inkFaint: 'rgba(29,26,46,0.66)',
  /** Text ON the ink — a selected segment, a dark pill. */
  onInk: '#fdf6ec',

  /** The one primary action per screen. */
  accent: '#d2451e',
  onAccent: '#ffffff',
  /** Selected states, coins, the reward moment. */
  gold: '#ffd21f',
  onGold: '#1d1a2e',
  /** A gain: trophies won, coins earned. */
  good: '#1c7a48',
  /** A loss. Used sparingly — losing is not an error. */
  bad: '#b3341a',

  /** The six prisoner colours are NOT here. They live in src/game/colors.ts
   *  and are the game's signal; restyling them by theme would change what a
   *  match looks like, which is the one thing that must never happen. */
} as const;

/**
 * The shapes. Every card in the game is built from these three numbers, so
 * the interface cannot drift into having four kinds of corner.
 */
export const SHAPE = {
  /** The outline. Always this width; only its colour ever varies. */
  line: 2,
  /** How far the hard shadow is offset. Never blurred. */
  drop: 4,
  /** A small control — a pill, a chip, a nav highlight. */
  radiusSm: 12,
  /** A card, a button. */
  radius: 18,
  /** A big surface — a popup, the primary button. */
  radiusLg: 20,
} as const;

/**
 * The offset shadow, as a style object.
 *
 * React Native has no `box-shadow`, so this is the platform's shadow API
 * pinned to zero blur and zero opacity-falloff — which is what makes it
 * read as a piece of card with a hard edge rather than a soft glow.
 * `elevation` is Android's own shadow and cannot be made hard, so it is
 * left off and the drop is drawn as a real View underneath instead; see
 * `Card` in src/ui/Card.tsx.
 */
export const DROP = {
  shadowColor: THEME.ink,
  shadowOffset: { width: 0, height: SHAPE.drop },
  shadowOpacity: 1,
  shadowRadius: 0,
} as const;

/**
 * Type scale. Weights do the work that ALL CAPS used to.
 *
 * A custom typeface is the one part of the direction not shipped yet: it
 * needs the font files bundled, which is a new asset in the binary rather
 * than an over-the-air change. The scale below is built so dropping a face
 * in later changes only `fontFamily`.
 */
export const TYPE = {
  display: { fontSize: 44, fontWeight: '700' as const, letterSpacing: -1 },
  title: { fontSize: 30, fontWeight: '700' as const, letterSpacing: -0.6 },
  heading: { fontSize: 21, fontWeight: '700' as const },
  cardTitle: { fontSize: 17, fontWeight: '700' as const },
  body: { fontSize: 14, fontWeight: '600' as const },
  small: { fontSize: 12.5, fontWeight: '700' as const },
  label: { fontSize: 11.5, fontWeight: '800' as const },
  nav: { fontSize: 10, fontWeight: '800' as const },
} as const;

/** Nothing tappable is smaller than this. Apple's floor, and a real one. */
export const MIN_TAP = 44;
