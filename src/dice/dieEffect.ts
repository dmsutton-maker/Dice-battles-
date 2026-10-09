import * as THREE from 'three';
import type { ObstaclePlacement } from '../game/obstacles';
import { DiceFire } from './diceFire';
import { DiceIce } from './diceIce';

/**
 * A dice skin that DOES something, rather than only looking like
 * something: the Fire dice (29 Sep 2026) and the Ice dice (30 Sep 2026).
 *
 * LOOKS ONLY, for every one of them. An effect has no body in the
 * physics world and nothing in settle.ts can see it. A die that freezes
 * the moat still sinks and is fished out exactly as any other die is, on
 * exactly the same clock — only the picture of it differs. A skin that
 * changed how a roll plays would be a skin you could buy to win.
 *
 * DiceScene owns the frame loop and already knows where every die is,
 * when a throw starts and when one sinks, so it hands those facts in and
 * the effect does the drawing.
 */

/** What an effect needs to know about one die, each frame. */
export interface DieSample {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  quaternion: THREE.Quaternion;
  /** Still tumbling, as opposed to at rest on the board. */
  moving: boolean;
}

export interface DieEffect {
  /** Add this to the scene. Everything the effect draws is inside it. */
  readonly group: THREE.Group;
  /** Both dice have just been thrown. */
  thrown(dice: readonly DieSample[]): void;
  /** Die `i` has just gone under in the moat at (x, z). */
  sank(i: number, x: number, z: number): void;
  /** Die `i` has been fished out of the moat and put back on the board. */
  fishedOut(i: number): void;
  /**
   * While die `i` is sinking, the height its PICTURE should stop at, or
   * null to let it sink as normal. The Ice dice use this to show a die
   * stuck half out of a frozen pond. The body underneath sinks and is
   * fished out on the usual clock regardless.
   */
  heldAt(i: number): number | null;
  update(dt: number, time: number, dice: readonly DieSample[], pointScale: number): void;
  dispose(): void;
}

export type DieEffectId = 'fire' | 'ice';

/** Build the effect for a skin, told where this round's moat is. */
export function createDieEffect(
  id: DieEffectId,
  dice: number,
  moat: ObstaclePlacement | null,
): DieEffect {
  return id === 'ice' ? new DiceIce(dice, moat) : new DiceFire(dice, moat);
}
