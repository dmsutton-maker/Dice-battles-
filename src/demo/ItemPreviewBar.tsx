import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BOTTOM_INSET } from '../game/safeArea';
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
  const showsCoin = action.kind === 'buy' || action.kind === 'unaffordable';

  return (
    // Not a backdrop: the board behind is the whole point, so only the
    // two bars catch touches. Everything between them is see-through.
    <View style={styles.layer} pointerEvents="box-none">
      <View style={styles.top}>
        <Pressable style={styles.back} onPress={onClose} hitSlop={14}>
          <Text style={styles.backText}>✕</Text>
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
            <Text style={[styles.actionText, !pressable && action.kind !== 'equipped' && styles.actionTextDead]}>
              {label}
            </Text>
          )}
        </Pressable>
        <Text style={styles.hint}>
          {pressable
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
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 46,
    marginHorizontal: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 18,
    // Dark enough to read a white name against any sky, still letting the
    // battlefield show through.
    backgroundColor: 'rgba(12,8,28,0.82)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  back: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  backText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  titleBlock: { flex: 1 },
  name: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  note: {
    color: 'rgba(255,255,255,0.72)',
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
    borderRadius: 22,
    alignItems: 'center',
    backgroundColor: '#ffe521',
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.2)',
  },
  actionEquipped: { backgroundColor: '#33cc6b' },
  // Dark, like the title bar and the hint. It used to be a white wash —
  // rgba(255,255,255,0.16) — with white text on top, which over a sunlit
  // castle floor came out at 1.65:1 and simply could not be read. This is
  // the button that says how many trophies you still need, so it is the
  // one that most has to be legible.
  actionDead: {
    backgroundColor: 'rgba(12,8,28,0.86)',
    borderColor: 'rgba(255,255,255,0.24)',
  },
  actionText: { color: '#1b1330', fontSize: 16, fontWeight: '900' },
  actionTextDead: { color: '#ffffff' },
  hint: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    // The board is behind this, so the words need their own backing.
    backgroundColor: 'rgba(12,8,28,0.7)',
    borderRadius: 10,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
