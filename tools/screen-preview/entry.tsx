import React from 'react';
import { createRoot } from 'react-dom/client';
import { View } from 'react-native';
import { LeaderboardScreen } from '../../src/demo/LeaderboardScreen';

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

const trophies = Number(new URLSearchParams(location.search).get('trophies') ?? 3300);

createRoot(host).render(
  <View style={{ width: 393, height: 3400 }}>
    <LeaderboardScreen
      trophies={trophies}
      wins={{ easy: 20, medium: 14, hard: 8 }}
      modeWins={{ classic: 18, ultimate: 9, skirmish: 8, colorwar: 7 }}
    />
  </View>,
);
setTimeout(() => { (window as any).__ready = true; }, 900);
