import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { offersAt, QuestDef, QuestIcon, questTarget, questToday, questXp, QuestState } from '../game/quests';
import type { QuestSize } from '../game/seasonPass';
import { DieIcon, FriendsIcon, RanksIcon, TrophyIcon } from '../ui/Icon';
import { MODE_ICONS } from '../ui/modeIcons';
import { MIN_TAP, SHAPE, THEME, TYPE } from '../ui/theme';

/**
 * "Today's quests", on the season pass card in the Cups tab.
 *
 * David, 1 Nov 2026: "Make it were you can choose out of three quests
 * for the pass." Three rows, quick to long: what to do, what it pays,
 * and once one is chosen, how far along it is. The rules are in
 * quests.ts; this only draws them.
 *
 * ROWS, NOT THREE CARDS SIDE BY SIDE. On a 375pt phone a third of the
 * card is about ninety points, and "Win 3 on Medium or Hard" does not
 * fit in ninety points at a size a grandparent can read. A row is a
 * full-width tap target and costs about sixty points of height each.
 *
 * Picking is one tap, as asked. The other two then go grey, still
 * readable, so you can see what you passed over, and say when the next
 * three arrive.
 */

const SIZE_WORD: Record<QuestSize, string> = { quick: 'Quick', medium: 'Medium', long: 'Longer' };

function Picture({ icon, size }: { icon: QuestIcon; size: number }) {
  switch (icon) {
    case 'die':
      return <DieIcon size={size} />;
    case 'trophy':
      return <TrophyIcon size={size} />;
    case 'people':
      return <FriendsIcon size={size} />;
    case 'ranks':
      return <RanksIcon size={size} />;
    default: {
      const Mode = MODE_ICONS[icon];
      return <Mode size={size} />;
    }
  }
}

export function DailyQuests({
  quest,
  onChoose,
  now = Date.now(),
}: {
  quest: QuestState | undefined;
  onChoose: (id: string) => void;
  /** Passed in for the preview tool; the game leaves it to the clock. */
  now?: number;
}) {
  const offers = offersAt(now);
  const today = questToday(quest, now);

  const row = (def: QuestDef) => {
    const mine = today?.chosen === def.id;
    const passed = !!today && !mine;
    const target = questTarget(def);
    const progress = mine ? today!.progress : 0;
    const done = mine && !!today!.done;
    const xp = questXp(def);
    const label = done
      ? `${def.title}. Done: ${xp} XP earned.`
      : mine
        ? `${def.title}. Your quest for today: ${progress} of ${target}. Pays ${xp} XP.`
        : passed
          ? `${def.title}. Not chosen today.`
          : `${def.title}. ${SIZE_WORD[def.size]} quest, pays ${xp} XP. Tap to choose it.`;
    return (
      <Pressable
        key={def.id}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!today, selected: mine }}
        disabled={!!today}
        onPress={() => onChoose(def.id)}
        style={({ pressed }) => [
          styles.row,
          mine && styles.rowMine,
          done && styles.rowDone,
          passed && styles.rowPassed,
          pressed && styles.rowPressed,
        ]}
      >
        <View style={styles.icon}>
          <Picture icon={def.icon} size={26} />
        </View>
        <View style={styles.words}>
          <Text style={styles.title} maxFontSizeMultiplier={1.4}>
            {def.title}
          </Text>
          {mine ? (
            <View style={styles.progressRow}>
              <View
                style={styles.rail}
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel={`${progress} of ${target}`}
              >
                <View style={[styles.railFill, { width: `${Math.round((progress / target) * 100)}%` }]} />
              </View>
              <Text style={styles.count} maxFontSizeMultiplier={1.3}>
                {done ? 'Done!' : `${progress} / ${target}`}
              </Text>
            </View>
          ) : def.hint && !passed ? (
            <Text style={styles.hint} maxFontSizeMultiplier={1.3}>
              {def.hint}
            </Text>
          ) : null}
        </View>
        <View style={styles.pay}>
          <Text style={styles.size} maxFontSizeMultiplier={1.2}>
            {SIZE_WORD[def.size].toUpperCase()}
          </Text>
          <Text style={styles.xp} maxFontSizeMultiplier={1.3}>
            {done ? '✓ ' : '+'}
            {xp} XP
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.box}>
      <Text style={styles.kicker}>TODAY&rsquo;S QUESTS</Text>
      <Text style={styles.how}>
        {today?.done
          ? 'Quest done! Three new ones at midnight, New York time.'
          : today
            ? 'Your quest for today. Finish it before midnight, New York time.'
            : 'Pick one of the three. Finish it today for extra XP.'}
      </Text>
      <View style={styles.list}>{offers.map(row)}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 14 },
  kicker: { color: THEME.accent, ...TYPE.label, letterSpacing: 0.8 },
  how: { color: THEME.inkSoft, ...TYPE.small, marginTop: 2 },
  list: { gap: 8, marginTop: 8 },
  row: {
    minHeight: MIN_TAP + 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
    backgroundColor: THEME.tile,
  },
  // The one you chose: gold, like a selected chip everywhere else.
  rowMine: { backgroundColor: 'rgba(255,210,31,0.30)', borderColor: THEME.ink },
  rowDone: { backgroundColor: 'rgba(28,122,72,0.12)' },
  // Passed over for today: still readable, plainly not on offer.
  rowPassed: { opacity: 0.45, borderColor: 'rgba(29,26,46,0.25)' },
  rowPressed: { transform: [{ translateY: 1 }] },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: THEME.surface,
    borderWidth: SHAPE.line,
    borderColor: 'rgba(29,26,46,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  words: { flex: 1, minWidth: 0, gap: 3 },
  title: { color: THEME.ink, ...TYPE.body, fontWeight: '800' },
  hint: { color: THEME.inkSoft, fontSize: 12, fontWeight: '600', lineHeight: 16 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rail: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: THEME.sunk,
    borderWidth: 1.5,
    borderColor: THEME.ink,
    overflow: 'hidden',
  },
  railFill: { height: '100%', backgroundColor: THEME.gold },
  count: { color: THEME.ink, ...TYPE.small },
  pay: { alignItems: 'flex-end', minWidth: 62 },
  size: { color: THEME.inkSoft, ...TYPE.label, letterSpacing: 0.5 },
  xp: { color: THEME.ink, ...TYPE.small, fontWeight: '900' },
});
