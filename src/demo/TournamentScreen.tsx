import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AI_DIFFICULTIES } from '../game/ai';
import { playClick } from '../audio/sounds';
import { MODES } from '../game/modes';
import { MODE_ICONS } from '../ui/modeIcons';
import { rangeLabel } from '../game/rewards';
import { resolveItem } from '../game/prizes';
import {
  TournamentDef,
  TournamentState,
  closingLabel,
  isComing,
  liveTournaments,
  stateOf,
} from '../game/tournament';
import { MENU_PAGE_EDGES, useMenuPageArea } from './BottomNav';
import { PrimaryButton } from '../ui/Card';
import { TrophyIcon } from '../ui/Icon';
import { SHAPE, THEME, TYPE } from '../ui/theme';
import { GoldCoin } from './GoldCoin';

/**
 * The Cups tab: the tournaments running right now.
 *
 * STILL CALLED CUPS, and that is a decision rather than an oversight.
 * David asked on 25 Sep 2026 to "rework the entire cups tab to be online
 * tournaments", and the obvious move — retitling the page Tournaments —
 * would leave the bottom bar saying Cups and the page saying something
 * else, which is the exact split the Ranks/Records rename existed to
 * close. "Tournaments" cannot go in the bar either: it is five cells
 * wide and the longest label in it today is six characters. A cup IS a
 * tournament in plain English, and the prize at the end of one is
 * literally a cup, so one short word does for both.
 *
 * ONE STATE, not two. The old screen had a list and a run-in-progress
 * view, because entering a cup put you inside it. Nothing is entered any
 * more: a tournament is a standing challenge and your progress in it is
 * a row of pips on its own card, so every tournament is visible at once
 * and you can be part-way through more than one.
 */
export function TournamentScreen({
  tournaments,
  states,
  today,
  onPlay,
}: {
  tournaments: TournamentDef[];
  states: Record<string, TournamentState>;
  /** YYYY-MM-DD, passed in so the screen has no clock of its own to test. */
  today: string;
  onPlay: (tournament: TournamentDef) => void;
}) {
  const showing = liveTournaments(tournaments, today);

  return (
    <View style={[styles.overlay, useMenuPageArea()]}>
      <View style={styles.header}>
        <Text style={styles.title}>Cups</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.note}>
          A cup is a run of wins in one way of playing, and they are meant to
          be hard. Win them in a row and the prize is yours — coins, trophies,
          and sometimes something for the cupboard. Lose one and you start the
          run again; a draw leaves it where it is.
        </Text>
        {/*
          Said plainly, because the alternative is letting a child believe
          they beat five strangers. David's own words were "against AI for
          now", and the game has a standing rule against inventing other
          players (see AGENTS.md).
        */}
        <Text style={styles.noteQuiet}>
          A new cup or two turns up every week or so, and they come from the
          Dice Battles website — so you never have to update the game to get
          them. The Gauntlet at the bottom is always here. You play them all
          against the game&rsquo;s own rivals.
        </Text>

        {showing.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              No cups are running just now. Have a look again in a day or two.
            </Text>
          </View>
        )}

        {showing.map((t) => (
          <TournamentCard
            key={t.id}
            tournament={t}
            state={stateOf(states, t.id)}
            today={today}
            onPlay={onPlay}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function TournamentCard({
  tournament: t,
  state,
  today,
  onPlay,
}: {
  tournament: TournamentDef;
  state: TournamentState;
  today: string;
  onPlay: (tournament: TournamentDef) => void;
}) {
  const Icon = MODE_ICONS[t.mode];
  const coming = isComing(t, today);
  const closing = closingLabel(t, today);
  const item = t.prize.item ? resolveItem(t.prize.item) : null;

  return (
    <View style={[styles.card, state.won && styles.cardWon]}>
      <View style={styles.cardHead}>
        <View style={styles.iconWell}>
          <Icon size={24} color={THEME.ink} />
        </View>
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>{t.name}</Text>
          <Text style={styles.cardMeta}>
            {t.target} in a row · {MODES[t.mode].name} ·{' '}
            {AI_DIFFICULTIES[t.difficulty].label}
          </Text>
        </View>
        {state.won && <Text style={styles.wonFlag}>WON</Text>}
      </View>

      <Text style={styles.blurb}>{t.blurb}</Text>

      {/*
        The prize, spelled out rather than summed into one number. Three
        different kinds of thing are being given away and only one of
        them is coins — a line reading "900" would hide the die entirely,
        which is the part actually worth playing for.
      */}
      <View style={styles.prizeRow}>
        <View style={styles.prizeChip}>
          <GoldCoin size={13} />
          <Text style={styles.prizeText}>{rangeLabel(t.prize.coins)}</Text>
        </View>
        <View style={styles.prizeChip}>
          <TrophyIcon size={13} />
          <Text style={styles.prizeText}>{t.prize.trophies}</Text>
        </View>
        {item && (
          <View style={[styles.prizeChip, styles.prizeChipItem]}>
            <Text style={styles.prizeEmoji}>{item.emoji}</Text>
            <Text style={styles.prizeText}>{item.name}</Text>
          </View>
        )}
      </View>

      {coming ? (
        <Text style={styles.comingText}>Opens {prettyDate(t.opens!)}</Text>
      ) : (
        <>
          <View style={styles.pipRow}>
            {Array.from({ length: t.target }, (_v, i) => (
              <View
                key={i}
                style={[styles.pip, i < state.streak && styles.pipWon]}
              />
            ))}
            <Text style={styles.pipCount}>
              {state.streak} of {t.target}
            </Text>
            {/*
              The deadline belongs on THIS row, not up beside the name.
              Alongside the title it stole enough width to wrap "3 in a
              row · Color Rush · Medium" onto two lines, so a dated cup
              read as untidier than a permanent one for no reason. Here
              it sits with the other thing that changes while you play.
            */}
            {/*
              The one that never closes says so, in the place the others
              put their deadline. Silence there would read as an
              oversight next to three cards counting down, and "always
              here" is the reason to bother with a six-in-a-row run that
              might take a fortnight.
            */}
            {closing ? (
              <Text style={styles.closing}>{closing}</Text>
            ) : t.standing ? (
              <Text style={styles.closing}>Always on</Text>
            ) : null}
          </View>

          {state.won ? (
            <Text style={styles.wonNote}>
              Already yours. Best run here: {state.best}.
            </Text>
          ) : state.best > state.streak ? (
            <Text style={styles.bestNote}>Your best run here: {state.best}.</Text>
          ) : null}

          <PrimaryButton
            style={styles.playButton}
            onPress={() => {
              playClick();
              onPlay(t);
            }}
          >
            <Text style={styles.playText}>
              Play {MODES[t.mode].name} on {AI_DIFFICULTIES[t.difficulty].label}
            </Text>
          </PrimaryButton>
        </>
      )}
    </View>
  );
}

/** "2026-10-01" → "1 Oct". Built by hand so it reads the same everywhere. */
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
export function prettyDate(stamp: string): string {
  const [y, m, d] = stamp.split('-').map((n) => Number(n));
  if (!y || !m || !d || m < 1 || m > 12) return stamp;
  return `${d} ${MONTHS[m - 1]}`;
}

const styles = StyleSheet.create({
  overlay: {
    ...MENU_PAGE_EDGES,
    // Solid, not 96%: the arena used to show faintly through every
    // menu. Only the battle screen shows the board now.
    backgroundColor: THEME.ground,
    zIndex: 20,
    paddingTop: 100,
  },
  header: { paddingHorizontal: 22, marginBottom: 10 },
  title: { color: THEME.ink, ...TYPE.title },
  scroll: { paddingHorizontal: 22, paddingBottom: 24 },
  note: {
    color: THEME.inkSoft,
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 19,
  },
  noteQuiet: {
    color: THEME.inkFaint,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    marginTop: 8,
    marginBottom: 16,
  },
  empty: {
    backgroundColor: THEME.tile,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
    borderRadius: SHAPE.radius,
    padding: 16,
  },
  emptyText: {
    color: THEME.inkSoft,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },

  card: {
    backgroundColor: THEME.surface,
    borderWidth: SHAPE.line,
    borderColor: THEME.ink,
    borderRadius: SHAPE.radius,
    padding: 16,
    marginBottom: 14,
  },
  // A cup already won keeps its ink line and takes the gold wash the
  // league card and the current rung use, so "yours" looks the same
  // wherever the game says it.
  cardWon: { backgroundColor: 'rgba(255,210,31,0.30)' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWell: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: THEME.tile,
    borderWidth: SHAPE.line,
    borderColor: 'rgba(29,26,46,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1 },
  cardTitle: { color: THEME.ink, ...TYPE.cardTitle },
  cardMeta: {
    color: THEME.inkSoft,
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 2,
  },
  wonFlag: {
    color: THEME.ink,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  closing: {
    color: THEME.inkFaint,
    fontSize: 11.5,
    fontWeight: '800',
    marginLeft: 'auto',
  },
  blurb: {
    color: THEME.inkSoft,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 10,
  },

  prizeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  prizeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: THEME.tile,
    borderWidth: SHAPE.line,
    borderColor: 'rgba(29,26,46,0.25)',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  // The item is the prize worth playing for, so it wears the ink line
  // the coins and trophies do not.
  prizeChipItem: { borderColor: THEME.ink, backgroundColor: THEME.surface },
  prizeEmoji: { fontSize: 13 },
  prizeText: { color: THEME.ink, fontSize: 12.5, fontWeight: '800' },

  pipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 14,
  },
  pip: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: SHAPE.line,
    borderColor: 'rgba(29,26,46,0.35)',
    backgroundColor: THEME.tile,
  },
  pipWon: { backgroundColor: THEME.good, borderColor: THEME.ink },
  pipCount: {
    color: THEME.inkSoft,
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 4,
  },
  bestNote: {
    color: THEME.inkFaint,
    fontSize: 11.5,
    fontWeight: '700',
    marginTop: 8,
  },
  wonNote: {
    color: THEME.ink,
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 10,
  },
  comingText: {
    color: THEME.inkSoft,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 14,
  },
  playButton: { alignSelf: 'stretch', marginTop: 14 },
  playText: {
    color: THEME.onAccent,
    fontSize: 14.5,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
});
