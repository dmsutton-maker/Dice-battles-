import React from 'react';
import { createRoot } from 'react-dom/client';
import { View } from 'react-native';
import { LeaderboardScreen } from '../../src/demo/LeaderboardScreen';
import { TournamentScreen } from '../../src/demo/TournamentScreen';
import { TOURNAMENTS, TournamentDef } from '../../src/game/tournament';

/**
 * A real screen, drawn through react-native-web.
 *
 * Built on 27 Aug 2026 for the ladder. Everything else visual in this
 * project can now be looked at before it ships — the arenas through
 * tools/arena-preview, the icons through tools/icon-preview, the dice
 * skins straight out of the painter — and the menus were the last thing
 * still going out on faith. `react-native` is aliased to
 * `react-native-web` at bundle time, so the flex, border and image rules
 * a phone would apply are the ones the browser applies.
 */
document.body.style.margin = '0';
document.body.style.background = '#fdf6ec';
const host = document.createElement('div');
document.body.appendChild(host);

const params = new URLSearchParams(location.search);
const trophies = Number(params.get('trophies') ?? 3300);

/*
  ?screen=cups draws the Cups tab instead. The tournaments are the real
  bundled four plus a dated one standing in for what the server sends,
  because the deadline, the "coming soon" state and the item prize are
  three of the four things on that card that a permanent cup never
  shows.
*/
const WEEKS: TournamentDef[] = [
  {
    id: 'skirmish-siege-w40',
    name: 'Skirmish Siege',
    blurb:
      'Five Skirmish wins in a row, on Hard. A draw will not break the run — but it will not help either.',
    mode: 'skirmish',
    difficulty: 'hard',
    target: 5,
    prize: { coins: { min: 700, max: 1000 }, trophies: 55 },
    opens: '2026-09-25',
    closes: '2026-10-08',
  },
  {
    id: 'colorwar-standoff-w40',
    name: 'Color War Standoff',
    blurb:
      'Six Color War wins in a row, on Medium. One colour each, six times, no slips.',
    mode: 'colorwar',
    difficulty: 'medium',
    target: 6,
    prize: { coins: { min: 800, max: 1100 }, trophies: 60 },
    opens: '2026-09-25',
    closes: '2026-10-08',
  },
];

if (params.get('screen') === 'cups') {
  createRoot(host).render(
    <View style={{ width: 393, height: 2200 }}>
      <TournamentScreen
        /*
          The real bundled cup plus the two really on the board, which
          is the most the tab can ever show. A fourth is deliberately
          included so the one-to-three cap is visible in the picture
          rather than only in the tests.
        */
        tournaments={[
          ...TOURNAMENTS,
          ...WEEKS,
          {
            ...WEEKS[0],
            id: 'one-too-many',
            name: 'One Too Many',
            blurb: 'Should never reach the screen — the tab holds three.',
            target: 4,
          },
        ]}
        states={{
          'skirmish-siege-w40': { streak: 2, best: 3, won: false },
          'the-gauntlet': { streak: 0, best: 4, won: false },
        }}
        today="2026-09-28"
        onPlay={() => {}}
      />
    </View>,
  );
  (window as any).__ready = true;
} else {
createRoot(host).render(
  <View style={{ width: 393, height: 3400 }}>
    <LeaderboardScreen
      trophies={trophies}
      wins={{ easy: 20, medium: 14, hard: 8 }}
      modeWins={{ classic: 18, ultimate: 9, skirmish: 8, colorwar: 7 }}
      played={{ easy: 31, medium: 24, hard: 19 }}
      modePlayed={{ classic: 30, ultimate: 17, skirmish: 15, colorwar: 12 }}
    />
  </View>,
);
}
setTimeout(() => { (window as any).__ready = true; }, 900);
