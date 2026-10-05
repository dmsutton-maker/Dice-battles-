import React from 'react';
import { createRoot } from 'react-dom/client';
import { View } from 'react-native';
import { LeaderboardScreen } from '../../src/demo/LeaderboardScreen';
import { TournamentScreen } from '../../src/demo/TournamentScreen';
import { OpponentDots } from '../../src/demo/OpponentDots';
import { RewardPopup, Reward } from '../../src/demo/RewardPopup';
import { BootSplash } from '../../src/demo/BootSplash';
import { BottomNav } from '../../src/demo/BottomNav';
import { MoneyShelf } from '../../src/demo/MoneyShelf';
import { initPurchases } from '../../src/game/purchases';
import { Text } from 'react-native';
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

/*
  ?screen=dots draws the scoreboard's opponent row on its own, through the
  REAL component. DiceDemoScreen wraps a live 3D canvas and cannot be
  rendered in a browser, and a copy of its markup here would drift — so
  the row was pulled into its own file precisely so it could be looked
  at.
*/
if (params.get('screen') === 'dots') {
  const ALL = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'] as const;
  createRoot(host).render(
    <View style={{ width: 393, padding: 24, gap: 18, backgroundColor: '#fdf6ec' }}>
      {[
        ['none taken yet', []],
        ['two taken', ['blue', 'yellow']],
        ['four taken', ['red', 'blue', 'yellow', 'purple']],
        ['every colour gone', [...ALL]],
      ].map(([label, taken]) => (
        <View key={label as string} style={{ gap: 6 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#6b6580' }}>
            {label as string}
          </Text>
          <OpponentDots taken={taken as never} />
          {/* Again at scoreboard scale, which is what a player sees. */}
          <View style={{ transform: [{ scale: 1 }] }}>
            <OpponentDots taken={taken as never} size={13} />
          </View>
        </View>
      ))}
    </View>,
  );
  (window as any).__ready = true;
} else if (params.get('screen') === 'shop') {
  /*
    ?screen=shop: the money shelf with purchases switched on and real
    prices showing — the review screenshot App Store Connect asks for
    with every in-app purchase. Added 5 Oct 2026. The bundle has to
    alias `expo-iap` to a stub that reports prices; the shelf itself
    is the real one.
  */
  initPurchases()
    .then(() => new Promise((resolve) => setTimeout(resolve, 300)))
    .then(() => {
      createRoot(host).render(
        <View style={{ width: 393, paddingHorizontal: 16, paddingVertical: 24, backgroundColor: '#fdf6ec' }}>
          <MoneyShelf />
        </View>,
      );
      setTimeout(() => ((window as any).__ready = true), 1500);
    });
} else if (params.get('screen') === 'boot') {
  // ?screen=boot: the startup card over the home tab's bottom bar — the
  // two places the Paper & Ink logo went on 30 Sep 2026.
  createRoot(host).render(
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ width: 393, height: 852, position: 'relative' }}>
        <BootSplash onDone={() => {}} />
      </View>
      <View style={{ width: 393, height: 852, position: 'relative', backgroundColor: '#fdf6ec' }}>
        <BottomNav active="play" onSelect={() => {}} />
      </View>
    </View>,
  );
  (window as any).__ready = true;
} else if (params.get('screen') === 'rewards') {
  /*
    ?screen=rewards draws the reward popup once for every kind of
    picture it can show — a die, a battlefield, a ladder rung, coins and
    a trophy — side by side. Added 30 Sep 2026 when the popup stopped
    showing emoji and started drawing the item itself.
  */
  const rewards: Reward[] = [
    { picture: { kind: 'die', id: 'fire' }, name: 'Season level 20!', kicker: 'SEASON PASS', note: 'The Fire Dice — yours to keep.' },
    { picture: { kind: 'arena', id: 'snow' }, name: 'Snowy Hollow', kicker: 'STILL YOURS', note: 'Still in your Inventory.' },
    { picture: { kind: 'tier', id: 'ruby-dice' }, name: 'Ruby Dice', kicker: 'NEW REWARD UNLOCKED', note: 'Put it on in the Inventory.' },
    { picture: { kind: 'coins' }, name: 'Season level 3!', kicker: 'SEASON PASS', note: '30 coins.' },
    { picture: { kind: 'trophy' }, name: 'Skirmish Siege won!', kicker: 'CUP WON', note: '5 in a row.' },
  ];
  createRoot(host).render(
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: 393 * 3 }}>
      {rewards.map((r, i) => (
        <View key={i} style={{ width: 393, height: 560, position: 'relative' }}>
          <RewardPopup reward={r} onClose={() => {}} />
        </View>
      ))}
    </View>,
  );
  (window as any).__ready = true;
} else if (params.get('screen') === 'cups') {
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
        // Part-way up the season pass, past the Ice dice at level 6, so
        // reached, next and still-to-come tiles all show at once.
        season={{ season: 'season-1', xp: 1460, paid: 7 }}
        onPreview={() => {}}
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
