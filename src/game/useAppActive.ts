import { useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

/**
 * Is the game the thing the player is actually looking at?
 *
 * Used to stop work that has no business continuing once the phone is in
 * a pocket: the opponent's roll timer, and the 3D board's render loop.
 *
 * WHY THIS IS NOT ALREADY HANDLED. iOS suspends the GL context when an
 * app leaves the foreground, so on iPhone the board stops drawing by
 * itself — but JavaScript timers do NOT stop. `setInterval` keeps firing
 * while the phone is locked, so the opponent kept rolling dice, playing
 * haptics and setting React state for a game nobody was in. Android is
 * looser about the render loop as well.
 *
 * `AppState` is core React Native, in every binary ever built for this
 * project, so this adds no native module and does not move
 * `runtimeVersion`.
 *
 * 'inactive' counts as away. It is the iOS state during the app switcher,
 * a notification shade pull, or an incoming call — brief, but there is
 * nothing worth rendering during any of them.
 */
export function useAppActive(): boolean {
  const [active, setActive] = useState(() => AppState.currentState === 'active');

  useEffect(() => {
    const onChange = (next: AppStateStatus) => setActive(next === 'active');
    const sub = AppState.addEventListener('change', onChange);
    // The state can have moved between the first render and this effect.
    setActive(AppState.currentState === 'active');
    return () => sub.remove();
  }, []);

  return active;
}
