import React from 'react';
import { createRoot } from 'react-dom/client';
import { View } from 'react-native';
import { BottomNav } from '../../src/demo/BottomNav';
import { InventoryScreen } from '../../src/demo/InventoryScreen';
import { StoreScreen } from '../../src/demo/StoreScreen';
import { LeaderboardScreen } from '../../src/demo/LeaderboardScreen';
import { NewsScreen } from '../../src/demo/NewsScreen';
import { VolumeSlider } from '../../src/demo/VolumeSlider';
import { ColorsIcon } from '../../src/ui/Icon';
import { Text } from 'react-native';

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
  if (which === 'news') {
    return (
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, padding: 12 }}>
        <NewsScreen />
      </View>
    );
  }
  if (which === 'settings') {
    // The volume sliders and the colourblind row, which live inside a
    // popup in the real game and cannot be reached from here.
    return (
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, padding: 18, gap: 14 }}>
        <VolumeSlider label="Everything" value={0.8} onChange={() => {}} emphasis />
        <VolumeSlider label="Sound effects" value={0.5} onChange={() => {}} />
        <VolumeSlider label="Music" value={0.2} onChange={() => {}} />
        <VolumeSlider label="Voice" value={0} onChange={() => {}} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <ColorsIcon size={16} />
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#1d1a2e' }}>
            Colorblind mode
          </Text>
        </View>
      </View>
    );
  }
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
const BARE = which === 'news' || which === 'settings';

createRoot(host).render(
  // Fills the viewport, so useWindowDimensions and the absolute-positioned
  // menu pages both measure the size the window actually is.
  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
    <Screen />
    {!BARE && <BottomNav active={TAB as never} onSelect={() => {}} />}
  </View>,
);

setTimeout(() => {
  (window as never as { __ready: boolean }).__ready = true;
}, 1800);
