import { skinById } from './diceSkins';
import { BATTLE_XP, LEVELS, SEASON_ITEM_WORTH, SeasonReward, xpToReach } from './seasonPass';

/**
 * What a season pass reward IS, in words, for the card that opens when a
 * tile is tapped.
 *
 * David, 18 Oct 2026: "On the season pass you should be able to click on
 * rewards and see a description of it." Until then only a die or a
 * battlefield did anything when tapped (it opened the 3D preview), and a
 * coin or trophy tile was a number with nothing to say about what it was
 * for or how far away it was. Pure words here, so they can be tested in
 * node; SeasonPassCard only draws them.
 */

export interface RewardInfoInput {
  level: number;
  track: 'free' | 'gold';
  reward: SeasonReward;
  /** The item's on-screen name, when the level holds a die or battlefield. */
  itemName?: string;
  /** The player's experience this season. */
  xp: number;
  /** Does this phone own the Gold Pass? */
  gold: boolean;
  /** Does the player already own this level's item? */
  alreadyOwned?: boolean;
}

export interface RewardInfo {
  title: string;
  /** "Level 12 · Gold Pass row" */
  where: string;
  /** What the reward is and what it is for. */
  body: string;
  /** Where the player stands with it: yours, how far, or locked. */
  status: string;
  /** Show "See it" — a die or a battlefield can be stood in. */
  canPreview: boolean;
  /** Show "Get the Gold Pass" — a Gold row reward this phone cannot get yet. */
  offerGold: boolean;
}

/** Medium wins, rounded up: the steady way through the pass. */
export function winsFor(xp: number): number {
  return Math.max(1, Math.ceil(xp / BATTLE_XP.medium.won));
}

export function rewardInfo(input: RewardInfoInput): RewardInfo {
  const { level, track, reward, itemName, xp, gold, alreadyOwned } = input;
  const goldRow = track === 'gold';
  // Short on purpose. David, 18 Oct 2026: "dont overcomplicate the
  // description" — one line for what it is, one for where you stand.
  const where = `Level ${level} · ${goldRow ? 'Gold Pass' : 'Free'}`;

  let title: string;
  let body: string;
  if (reward.item && itemName) {
    title = itemName;
    if (reward.item.kind === 'dice') {
      const effect = skinById(reward.item.id).effect;
      body =
        effect === 'fire'
          ? 'Dice that burn as they roll.'
          : effect === 'ice'
            ? 'Dice that frost over as they roll.'
            : effect === 'neon'
              ? 'Dice that leave a trail of light as they roll.'
              : 'A new look for your dice.';
    } else {
      body = 'A new battlefield to play on.';
    }
    if (alreadyOwned) {
      body += ` You have it, so you get ${SEASON_ITEM_WORTH.toLocaleString('en-US')} coins instead.`;
    }
  } else if (reward.coins > 0) {
    title = `${reward.coins.toLocaleString('en-US')} coins`;
    body = 'Spend them in the Store.';
  } else {
    title = `${reward.trophies} trophies`;
    body = 'They move you up the trophy ladder.';
  }

  const reached = xp >= xpToReach(level);
  const toGo = Math.max(0, xpToReach(level) - xp);
  const wins = winsFor(toGo);
  const away = `${toGo.toLocaleString('en-US')} XP to go, about ${wins} ${wins === 1 ? 'win' : 'wins'}.`;
  let status: string;
  if (goldRow && !gold) {
    status = reached ? 'Needs the Gold Pass. Pays out as soon as you get it.' : `Needs the Gold Pass. ${away}`;
  } else if (reached) {
    status = 'Yours.';
  } else {
    status = away;
  }

  return {
    title,
    where,
    body,
    status,
    canPreview: !!reward.item && !!itemName,
    offerGold: goldRow && !gold,
  };
}
