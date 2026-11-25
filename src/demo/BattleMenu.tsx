import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { playClick } from '../audio/sounds';
import { AudioSettings } from '../audio/settings';
import { clockWords, formatClock, shownSeconds } from '../game/battleTimer';
import { LeaveWords } from '../game/battleMenu';
import { PrimaryButton, SecondaryButton } from '../ui/Card';
import { HelpIcon, TimerIcon } from '../ui/Icon';
import { MIN_TAP, SHAPE, THEME, TYPE } from '../ui/theme';
import { VolumeSliders } from './VolumeSlider';

/**
 * The menu over a battle, opened by the three lines in the corner.
 *
 * Marc, 2 Nov 2026: "when you're in a battle and want to exit a game it
 * should be a button that's three lines and it should take you to a
 * small menu overlayed on the game playing. the menu should have the
 * ability to leave the game and when you click leave it should warn you
 * that forfeiting counts as a loss, and it should have the volume lines
 * and other things you think".
 *
 * A piece of card over the board, like Popup: the game stays visible
 * behind the dim, so it is plain you have not gone anywhere. Resume is
 * the biggest thing on it because it is what most people opened it to do
 * after turning the music down; tapping the dim does the same.
 *
 * Leaving asks first, INSIDE this panel rather than in the phone's own
 * Alert box, and says what it costs. The words are decided in
 * src/game/battleMenu.ts; this only draws them. Whether the battle is
 * paused while this is open is the screen's business (it is, against the
 * computer; it cannot be, against a friend).
 */
export function BattleMenu({
  title,
  note,
  audio,
  onAudio,
  onResume,
  onHowTo,
  leave,
  onLeave,
  where,
  readClock,
}: {
  /** "Paused", or "Battle menu" when the battle cannot stop. */
  title: string;
  /** The line under the title, e.g. "Your friend is still playing". */
  note: string | null;
  audio: AudioSettings;
  /** The settings after a slider moved, already saved and heard. */
  onAudio: (next: AudioSettings) => void;
  onResume: () => void;
  onHowTo: () => void;
  /** What the leave question says (leaveWords). */
  leave: LeaveWords;
  /** Called only once the leave has been confirmed. */
  onLeave: () => void;
  /** Mode and opponent, for the small print (whereLine). */
  where: string;
  /** Milliseconds left on the battle clock, read fresh on every look. */
  readClock: () => number;
}) {
  const [asking, setAsking] = useState(false);
  // Whether the list has more below the fold (see styles.moreBelow).
  const [seen, setSeen] = useState({ view: 0, content: 0, y: 0 });
  const moreBelow = seen.content - seen.view - seen.y > 8;

  const tap = (then: () => void) => () => {
    playClick();
    then();
  };

  return (
    <View style={styles.backdrop}>
      {/* The dim is a way back to the game, never a way out of it. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={tap(onResume)}
        accessibilityLabel="Resume"
      />
      <View style={styles.stack}>
        <View pointerEvents="none" style={styles.shadow} />
        <View style={styles.panel}>
          {asking ? (
            <View style={styles.body}>
              <Text style={styles.askTitle} accessibilityRole="header">
                {leave.title}
              </Text>
              {leave.lines.map((line) => (
                <Text key={line} style={styles.askLine}>
                  {line}
                </Text>
              ))}
              <PrimaryButton style={styles.askStay} onPress={tap(() => setAsking(false))}>
                <Text style={styles.primaryText}>{leave.stayLabel}</Text>
              </PrimaryButton>
              {/*
                The answer that costs something is the quiet one, as in
                src/ui/Confirm.tsx: the big button is where a thumb lands
                by habit, so the big button must be the one that changes
                nothing.
              */}
              <Pressable
                style={styles.askLeave}
                onPress={tap(onLeave)}
                accessibilityRole="button"
              >
                <Text style={styles.askLeaveText}>{leave.leaveLabel}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.header}>
                <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
                  {title}
                </Text>
                {note && <Text style={styles.note}>{note}</Text>}
              </View>
              <View style={styles.scrollWrap}>
                <ScrollView
                  style={styles.scroll}
                  contentContainerStyle={styles.body}
                  bounces
                  showsVerticalScrollIndicator
                  scrollEventThrottle={32}
                  onLayout={(e) => {
                    const view = e.nativeEvent.layout.height;
                    setSeen((s) => ({ ...s, view }));
                  }}
                  onContentSizeChange={(_w, content) => setSeen((s) => ({ ...s, content }))}
                  onScroll={(e) => {
                    const y = e.nativeEvent.contentOffset.y;
                    setSeen((s) => ({ ...s, y }));
                  }}
                >
                  <PrimaryButton onPress={tap(onResume)}>
                    <Text style={styles.resumeText}>Resume</Text>
                  </PrimaryButton>

                  <Text style={styles.section}>VOLUME</Text>
                  <VolumeSliders value={audio} onChange={onAudio} />
                </ScrollView>
                {/*
                  On the smallest phone the four sliders do not all fit,
                  and a cut that happens to land in the gap between two
                  of them looks like the end of the list. This says there
                  is more, and goes once there is not.
                */}
                {moreBelow && (
                  <View pointerEvents="none" style={styles.moreBelow}>
                    <View style={styles.chevron} />
                  </View>
                )}
              </View>
              {/*
                Outside the scroll on purpose: on the smallest phone the four
                sliders push these two off the bottom, and a Leave button that
                has to be scrolled to, with nothing to say it is there, is
                worse than a list that scrolls a little.
              */}
              <View style={styles.actions}>
                <SecondaryButton style={styles.row} onPress={tap(onHowTo)}>
                  <View style={styles.rowInner}>
                    <HelpIcon size={20} />
                    <Text style={styles.rowText}>How to play</Text>
                  </View>
                </SecondaryButton>
                <SecondaryButton style={styles.row} onPress={tap(() => setAsking(true))}>
                  <Text style={styles.leaveText}>Leave battle</Text>
                </SecondaryButton>
              </View>
            </>
          )}
          <View style={styles.footer}>
            <Text style={styles.footerText} numberOfLines={1}>
              {where}
            </Text>
            <ClockLeft read={readClock} />
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * The time left, in the small print. Keeps its own time like BattleClock
 * does, so the panel is not re-rendered by the screen four times a
 * second; against the computer the clock is stopped and this simply
 * stays put, and against a friend it keeps counting, which is true.
 */
function ClockLeft({ read }: { read: () => number }) {
  const reader = useRef(read);
  reader.current = read;
  const [seconds, setSeconds] = useState(() => shownSeconds(read()));
  useEffect(() => {
    const id = setInterval(() => setSeconds(shownSeconds(reader.current())), 250);
    return () => clearInterval(id);
  }, []);
  const ms = seconds * 1000;
  return (
    <View style={styles.clock} accessible accessibilityLabel={clockWords(ms)}>
      <TimerIcon size={14} />
      <Text style={styles.footerText}>{formatClock(ms)} left</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    // The same ink dim as Popup, so the board shows through it.
    backgroundColor: 'rgba(29,26,46,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    /*
      Over the scoreboard, the callout and the bottom HUD, and BELOW
      Popup (38): How to play opens from here and has to land on top of
      this, with this still waiting underneath when it closes.
    */
    zIndex: 37,
  },
  stack: {
    width: '100%',
    // Small: a panel on the game, not another page.
    maxWidth: 360,
    maxHeight: '86%',
  },
  shadow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: SHAPE.drop,
    bottom: -SHAPE.drop,
    borderRadius: SHAPE.radiusLg,
    backgroundColor: THEME.ink,
  },
  panel: {
    width: '100%',
    maxHeight: '100%',
    backgroundColor: THEME.surface,
    borderRadius: SHAPE.radiusLg,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
    paddingTop: 16,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 18,
    paddingBottom: 12,
    alignItems: 'center',
  },
  title: {
    color: THEME.ink,
    ...TYPE.heading,
  },
  note: {
    marginTop: 4,
    color: THEME.inkSoft,
    ...TYPE.small,
    textAlign: 'center',
  },
  scrollWrap: {
    flexShrink: 1,
  },
  scroll: {
    flexGrow: 0,
  },
  moreBelow: {
    position: 'absolute',
    bottom: 2,
    alignSelf: 'center',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: THEME.surface,
    borderWidth: 2,
    borderColor: THEME.inkFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    width: 9,
    height: 9,
    marginTop: -3,
    borderRightWidth: 2.5,
    borderBottomWidth: 2.5,
    borderColor: THEME.inkFaint,
    transform: [{ rotate: '45deg' }],
  },
  body: {
    paddingHorizontal: 18,
    paddingBottom: 4,
  },
  actions: {
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  resumeText: {
    color: THEME.onAccent,
    fontSize: 19,
    fontWeight: '900',
  },
  section: {
    // Settings' own section heading, so the sliders look like the ones there.
    color: THEME.inkFaint,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 20,
    marginBottom: 8,
  },
  row: {
    marginTop: 10,
    paddingVertical: 12,
    minHeight: MIN_TAP,
    justifyContent: 'center',
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowText: {
    color: THEME.ink,
    fontSize: 15.5,
    fontWeight: '900',
  },
  leaveText: {
    // A loss — the theme's one colour for it, used sparingly.
    color: THEME.bad,
    fontSize: 15.5,
    fontWeight: '900',
  },
  askTitle: {
    ...TYPE.heading,
    color: THEME.ink,
    textAlign: 'center',
    marginBottom: 8,
  },
  askLine: {
    color: THEME.inkSoft,
    fontSize: 14.5,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  askStay: {
    marginTop: 14,
    alignSelf: 'stretch',
  },
  primaryText: {
    color: THEME.onAccent,
    fontSize: 15.5,
    fontWeight: '900',
  },
  askLeave: {
    minHeight: MIN_TAP,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  askLeaveText: {
    color: THEME.bad,
    fontSize: 14.5,
    fontWeight: '900',
    textDecorationLine: 'underline',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(29,26,46,0.15)',
    backgroundColor: THEME.ground,
  },
  footerText: {
    color: THEME.inkSoft,
    ...TYPE.small,
    flexShrink: 1,
  },
  clock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
});
