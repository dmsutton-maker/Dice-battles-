import React from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';
import { SHAPE, THEME } from './theme';

/**
 * A piece of card on a table: an outline, and a hard shadow offset below
 * it. This one component carries the whole direction, which is why it is a
 * component rather than a copied style — every surface in the game is
 * either this or a mistake.
 *
 * WHY THE SHADOW IS A VIEW, not a shadow.
 *
 * React Native's shadow API is inconsistent in exactly the way this design
 * cannot tolerate. On iOS `shadowRadius: 0` does give a hard edge, but
 * Android ignores the whole shadow family and honours only `elevation`,
 * which is always a soft, blurred, system-drawn shade — the one thing that
 * would turn a piece of card into a floating glassy panel and undo the
 * direction on half the phones.
 *
 * So the drop is drawn: a second View of the same shape, in ink, sitting
 * `SHAPE.drop` lower. Identical on both platforms, exact, and free.
 */

export function Card({
  children,
  style,
  radius = SHAPE.radius,
  background = THEME.surface,
  border = THEME.ink,
  drop = SHAPE.drop,
  onPress,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  background?: string;
  border?: string;
  /** 0 for a card that sits flat — an inset track, a nested panel. */
  drop?: number;
  onPress?: () => void;
}) {
  const face = (
    <View
      style={[
        {
          backgroundColor: background,
          borderColor: border,
          borderWidth: SHAPE.line,
          borderRadius: radius,
        },
        style,
      ]}
    >
      {children}
    </View>
  );

  // No drop: nothing to stack, so skip the wrapper entirely rather than
  // leaving an empty absolutely-positioned View behind every flat panel.
  if (drop <= 0) {
    return onPress ? (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
      >
        {face}
      </Pressable>
    ) : (
      face
    );
  }

  /**
   * Pressed, the card drops onto its own shadow: the face moves down by
   * `drop` and the shadow is hidden. That is what a physical button does,
   * and it costs nothing — no animation, no state, no re-render.
   */
  const stacked = (isPressed: boolean) => (
    <View>
      {!isPressed && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            // Hangs BELOW whatever height the card turns out to be: the
            // card is sized by its content and this must not need to know
            // that height.
            top: drop,
            bottom: -drop,
            backgroundColor: THEME.ink,
            borderRadius: radius,
          }}
        />
      )}
      <View style={isPressed ? { transform: [{ translateY: drop }] } : null}>{face}</View>
    </View>
  );

  if (!onPress) return stacked(false);

  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {({ pressed }) => stacked(pressed)}
    </Pressable>
  );
}

/**
 * The one primary action on a screen. There is deliberately no `variant`
 * prop with six options — a screen with three equally loud buttons is a
 * screen with no primary action.
 */
export function PrimaryButton({
  children,
  onPress,
  style,
}: {
  children?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Card
      onPress={onPress}
      background={THEME.accent}
      radius={SHAPE.radiusLg}
      drop={6}
      style={[{ paddingVertical: 18, alignItems: 'center' }, style]}
    >
      {children}
    </Card>
  );
}

/** Everything that is not the primary action. */
export function SecondaryButton({
  children,
  onPress,
  style,
}: {
  children?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Card
      onPress={onPress}
      radius={SHAPE.radiusLg}
      style={[{ paddingVertical: 16, alignItems: 'center' }, style]}
    >
      {children}
    </Card>
  );
}
