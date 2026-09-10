import React from 'react';
import { createRoot } from 'react-dom/client';
import { View } from 'react-native';
import { BottomNav } from '../../src/demo/BottomNav';
import { InventoryScreen } from '../../src/demo/InventoryScreen';
import { StoreScreen } from '../../src/demo/StoreScreen';
import { LeaderboardScreen } from '../../src/demo/LeaderboardScreen';

/**
 * The menus, at whatever size the browser window is, with the real
 * bottom navigation over them.
 *
 * Built 10 Sep 2026, the day after Apple announced the folding iPhone.
 * v1.72.0 adapted the layout for it by reasoning alone and said outright
 * that whether it LOOKS right had to be seen on hardware — and there is
 * no Duo to see it on, nor a Mac in this container to run a simulator.
 * This is the nearest honest thing: the real components, the real
 * `useWindowDimensions`, the real inset arithmetic, laid out by a real
 * browser at the Duo's exact point sizes.
 *
 * WHAT IT CANNOT SHOW. The battlefield. That is a GL canvas, and there
 * is no expo-gl in a browser — the camera framing at these shapes is
 * pinned by tests/foldable.test.ts instead. Fonts are the browser's
 * rather than the phone's, so treat text as roughly, not exactly, the
 * width it will be. Everything else here is the shipping code.
 */
document.body.style.margin = '0';
document.body.style.background = '#fdf6ec';
document.documentElement.style.overflow = 'hidden';
const host = document.createElement('div');
document.body.appendChild(host);

const which = new URLSearchParams(location.search).get('screen') ?? 'inventory';

/** A believable mid-game player, so the cards show owned and locked both. */
const WALLET = { coins: 2450, owned: ['skin_frost', 'skin_lava', 'arena_autumn'] };

function Screen() {
  if (which === 'store') {
    return <StoreScreen wallet={WALLET} onPreview={() => {}} onPreviewArena={() => {}} />;
  }
  if (which === 'leaderboard') {
    return (
      <LeaderboardScreen
        trophies={3300}
        wins={{ easy: 20, medium: 14, hard: 8 }}
        modeWins={{ classic: 18, ultimate: 9, skirmish: 8, colorwar: 7 }}
      />
    );
  }
  return (
    <InventoryScreen trophies={3300} arenaId="classic" skinId="ivory" onPreview={() => {}} />
  );
}

const TAB = which === 'store' ? 'store' : which === 'leaderboard' ? 'leaderboard' : 'inventory';

createRoot(host).render(
  // Fills the viewport, so useWindowDimensions and the absolute-positioned
  // menu pages both measure the size the window actually is.
  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
    <Screen />
    <BottomNav active={TAB as never} onSelect={() => {}} />
  </View>,
);

setTimeout(() => {
  (window as never as { __ready: boolean }).__ready = true;
}, 1800);
