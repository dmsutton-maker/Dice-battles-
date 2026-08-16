import { Dimensions, GestureResponderEvent } from 'react-native';
import { ThrowAim } from '../demo/DiceScene';

/**
 * Turn a touch into a throw aim. Taken from WHERE the screen is touched
 * rather than from a swipe's velocity, because the throw fires on
 * touch-down: velocity is only known on release, by which time the dice
 * are already in the air and binding. Touching across the screen aims the
 * throw; touching further up the board throws harder.
 */
export function aimFromTouch(
  event: GestureResponderEvent,
  options: { rotated?: boolean } = {},
): ThrowAim {
  const { width, height } = Dimensions.get('window');
  const x = event.nativeEvent.pageX;
  const y = event.nativeEvent.pageY;
  const across = (x / Math.max(width, 1)) * 2 - 1;
  // Screen y grows downward: the top of the screen is the far wall.
  const up = 1 - y / Math.max(height, 1);
  return options.rotated
    ? { aim: -across, power: 1 - up }
    : { aim: across, power: up };
}
