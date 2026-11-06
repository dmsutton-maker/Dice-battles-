import type { NewsIconId } from '../game/news';
import {
  ArenaIcon,
  BagIcon,
  BrushIcon,
  DieIcon,
  FriendsIcon,
  HelpIcon,
  NewsIcon,
  PatchIcon,
  PhoneIcon,
  SpeakerIcon,
  TimerIcon,
  TrophyIcon,
} from './Icon';

/**
 * Which drawing belongs to which kind of news post.
 *
 * A `Record<NewsIconId, …>` on purpose, the same as MODE_ICONS: adding a
 * kind to `NEWS_ICON_IDS` should fail to compile here rather than
 * quietly draw nothing in the list.
 *
 * Several of these are icons the game already had — a post about
 * Friends gets the same two figures as the Friends button, a post about
 * the Store gets the same bag as the Store tab. That is the point of
 * having a set: the picture in the news means the same thing as the
 * picture on the button.
 *
 * It lives beside the icons rather than in `src/game/news.ts` because
 * `src/game` holds the rules and has no business importing React
 * components — the news list is read by the headless test suite, which
 * has no renderer at all.
 */
export const NEWS_ICONS: Record<
  NewsIconId,
  (props: { size?: number; color?: string }) => React.ReactElement
> = {
  news: NewsIcon,
  dice: DieIcon,
  arena: ArenaIcon,
  look: BrushIcon,
  speed: TimerIcon,
  sound: SpeakerIcon,
  people: FriendsIcon,
  cups: TrophyIcon,
  shop: BagIcon,
  fix: PatchIcon,
  phone: PhoneIcon,
  help: HelpIcon,
};
