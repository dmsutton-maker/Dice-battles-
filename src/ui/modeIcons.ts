import type { ModeId } from '../game/modes';
import {
  ColorWarIcon,
  RushIcon,
  SkirmishIcon,
  UltimateIcon,
} from './Icon';

/**
 * Which drawing belongs to which game mode.
 *
 * A `Record<ModeId, …>` on purpose: adding a fifth mode should fail to
 * compile here rather than quietly render nothing where its icon goes.
 * That is the whole reason this map exists instead of a lookup by string
 * at each of the two places modes are shown.
 *
 * It lives beside the icons rather than on ModeDef because `src/game`
 * holds the RULES and has no business importing React components — the
 * mode definitions are read by the headless test suite, which has no
 * renderer at all.
 */
export const MODE_ICONS: Record<
  ModeId,
  (props: { size?: number; color?: string }) => React.ReactElement
> = {
  classic: RushIcon,
  ultimate: UltimateIcon,
  skirmish: SkirmishIcon,
  colorwar: ColorWarIcon,
};
