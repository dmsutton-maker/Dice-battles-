import { useWindowDimensions } from 'react-native';
import { gridCardWidth } from './gridRules';

export * from './gridRules';

/**
 * The live card width.
 *
 * A hook, because unfolding a phone changes the answer without the app
 * relaunching — the same reason useBottomInset is one. The arithmetic
 * itself is in gridRules.ts, where the tests can reach it.
 */
export function useGridCardWidth(): number {
  const { width } = useWindowDimensions();
  return gridCardWidth(width);
}
