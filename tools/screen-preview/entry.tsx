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
const DATED: TournamentDef = {
  id: 'autumn-rush-2026',
  name: 'Autumn Rush',
  blurb:
    'Three Color Rush wins in a row on Medium, before the month is out. Win it and the Sunny Farm is yours.',
  mode: 'classic',
  difficulty: 'medium',
  target: 3,
  prize: {
    coins: { min: 200, max: 320 },
    trophies: 20,
    item: { kind: 'arena', id: 'farm' },
  },
  opens: '2026-09-25',
  closes: '2026-10-31',
};

if (params.get('screen') === 'cups') {
  createRoot(host).render(
    <View style={{ width: 393, height: 2200 }}>
      <TournamentScreen
        tournaments={[
          ...TOURNAMENTS,
          DATED,
          // Not open yet: the fourth state a card has, and the only one
          // with no pips and no button.
          {
            ...DATED,
            id: 'winter-cup',
            name: 'Winter Cup',
            blurb: 'Six Skirmish wins in a row on Hard. Back at Christmas.',
            mode: 'skirmish',
            difficulty: 'hard',
            target: 6,
            opens: '2026-12-01',
            closes: '2026-12-26',
          },
        ]}
        states={{
          'courtyard-streak': { streak: 3, best: 3, won: true },
          'colorwar-duel': { streak: 2, best: 3, won: false },
          'ultimate-gauntlet': { streak: 0, best: 4, won: false },
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
