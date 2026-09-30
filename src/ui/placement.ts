import type { StyleProp, ViewStyle } from 'react-native';

/**
 * The style keys that place a card among its neighbours, as opposed to
 * shaping the card itself.
 *
 * They have to go on the OUTER wrapper when there is a drop. They used to
 * go on the face, inside it — and the drop is drawn from the wrapper's
 * top, so a face with `marginTop: 14` sat 14 points down inside a
 * wrapper whose shadow started 6 points down: a black band showed above
 * the button and another below it. David, 30 Sep 2026: "fix the button on
 * the cups screen to make it look full and not partially black." Every
 * button given a margin had the same fault; the Cups one was simply the
 * one on show.
 */
const PLACEMENT_KEYS = [
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginHorizontal',
  'marginVertical',
  'marginStart',
  'marginEnd',
  'alignSelf',
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'position',
  'top',
  'bottom',
  'left',
  'right',
  'zIndex',
] as const;

/** Split a style into where the card sits, and what the card is. */
export function splitPlacement(style: StyleProp<ViewStyle>): {
  placement: ViewStyle;
  face: ViewStyle;
} {
  const flat = flatten(style);
  const placement: Record<string, unknown> = {};
  for (const key of PLACEMENT_KEYS) {
    if (key in flat) {
      placement[key] = flat[key];
      delete flat[key];
    }
  }
  // A card stretched across its parent must still stretch inside the
  // wrapper it now sits in.
  if (placement.alignSelf === 'stretch') flat.alignSelf = 'stretch';
  return { placement: placement as ViewStyle, face: flat as ViewStyle };
}

/**
 * React Native's StyleSheet.flatten, without React Native: nested arrays
 * merged left to right, falsy entries skipped. Here rather than borrowed
 * so this file stays loadable by the headless tests.
 */
function flatten(style: StyleProp<ViewStyle>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const walk = (s: unknown) => {
    if (!s) return;
    if (Array.isArray(s)) s.forEach(walk);
    else if (typeof s === 'object') Object.assign(out, s);
  };
  walk(style);
  return out;
}
