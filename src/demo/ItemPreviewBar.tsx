import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BOTTOM_INSET } from '../game/safeArea';
import { CloseIcon } from '../ui/Icon';
import { SHAPE, THEME } from '../ui/theme';
import { CoinLabel } from './GoldCoin';
import {
  actionLabel,
  isActionPressable,
  PreviewAction,
} from '../game/itemPreview';

/**
 * The frame around a preview.
 *
 * There is no picture in this component, and that is the point: the
 * preview IS the game's own board, already on screen behind everything.
 * Opening a preview hides the menu page and lets the real scene through,
 * with the previewed dice or battlefield swapped in for as long as you
 * are looking. Nothing is drawn twice and nothing can disagree with the
 * table, because it is the table.
 *
 * All this adds is a name at the top, a way back, and the one button that
 * does something.
 */
export function ItemPreviewBar({
  name,
  note,
  action,
  onAct,
  onClose,
}: {
  name: string;
  /** One line about the item, under its name. */
  note: string;
  action: PreviewAction;
  onAct: () => void;
  onClose: () => void;
}) {
  const pressable = isActionPressable(action);
  const label = actionLabel(action);
  const showsCoin =
    action.kind === 'buy' ||
    action.kind === 'unaffordable' ||
    action.kind === 'in-store';

  return (
    // Not a backdrop: the board behind is the whole point, so only the
    // two bars catch touches. Everything between them is see-through.
    <View style={styles.layer} pointerEvents="box-none">
      <View style={styles.top}>
        <Pressable style={styles.back} onPress={onClose} hitSlop={14}>
          <CloseIcon size={15} />
        </Pressable>
        <View style={styles.titleBlock}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.note} numberOfLines={2}>
            {note}
          </Text>
        </View>
        {/* Balances the ✕ so the name sits centred rather than shunted. */}
        <View style={styles.back} />
      </View>

      <View style={styles.bottom}>
        <Pressable
          style={[
            styles.action,
            !pressable && styles.actionDead,
            action.kind === 'equipped' && styles.actionEquipped,
          ]}
          disabled={!pressable}
          onPress={onAct}
        >
          {showsCoin ? (
            <CoinLabel size={16} style={[styles.actionText, !pressable && styles.actionTextDead]}>
              {label}
            </CoinLabel>
          ) : (
            <Text
              style={[
                styles.actionText,
                action.kind === 'equipped' && styles.actionTextEquipped,
                !pressable && action.kind !== 'equipped' && styles.actionTextDead,
              ]}
            >
              {label}
            </Text>
          )}
        </Pressable>
        <Text style={styles.hint}>
          {action.kind === 'in-store'
            ? // The one dead button that has somewhere to send you, so it
              // says where rather than only that you cannot do it here.
              'Dice are bought on the Store tab, not in your bag.'
            : pressable
              ? 'Tap ✕ to go back without changing anything.'
              : 'This is what it looks like on the board.'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    // Over the menus (20) and the tab bar (35), because while a preview is
    // open those are not what you are looking at.
    zIndex: 38,
    justifyContent: 'space-between',
  },
  /*
   * Solid paper, not a dark glass wash. These bars float over the live
   * board — any arena, any sky — and a translucent bar's contrast depends
   * on whatever happens to be behind it. That is how the old white-wash
   * button ended up at 1.65:1 over the sunlit castle. A solid card cannot
   * be undermined by its background.
   */
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 46,
    marginHorizontal: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: SHAPE.radius,
    backgroundColor: THEME.surface,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
  },
  back: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.surface,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
  },
  titleBlock: { flex: 1 },
  name: {
    color: THEME.ink,
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  note: {
    color: THEME.inkSoft,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
  },

  bottom: {
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 14,
    marginBottom: BOTTOM_INSET + 16,
  },
  action: {
    minWidth: 220,
    paddingVertical: 15,
    paddingHorizontal: 26,
    borderRadius: SHAPE.radiusLg,
    alignItems: 'center',
    backgroundColor: THEME.gold,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
  },
  actionEquipped: { backgroundColor: THEME.good },
  // Solid white with soft ink text: the button that says how many
  // trophies you still need is the one that most has to be legible, on
  // every battlefield.
  actionDead: {
    backgroundColor: THEME.surface,
    borderColor: 'rgba(29,26,46,0.45)',
  },
  actionText: { color: THEME.onGold, fontSize: 16, fontWeight: '900' },
  actionTextDead: { color: THEME.inkSoft },
  // EQUIPPED sits on the deep green, where ink would vanish.
  actionTextEquipped: { color: '#ffffff' },
  hint: {
    color: THEME.ink,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    // The board is behind this, so the words need their own backing.
    backgroundColor: 'rgba(253,246,236,0.92)',
    borderRadius: 10,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
