import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import './storageMock';
import { assert, assertEqual, suite, test } from './harness';
import { rewardInfo, winsFor } from '../src/game/rewardInfo';
import { goldRewardFor, rewardFor, xpToReach } from '../src/game/seasonPass';

const root = join(__dirname, '..');
const code = (path: string) =>
  readFileSync(join(root, path), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');

/*
  David, 18 Oct 2026: "On the season pass you should be able to click on
  rewards and see a description of it."
*/
suite('season pass · every reward has a description', () => {
  test('every tile on both rows says what it is, where it is and how far away', () => {
    for (let n = 1; n <= 30; n++) {
      for (const track of ['free', 'gold'] as const) {
        const reward = track === 'free' ? rewardFor(n) : goldRewardFor(n);
        const info = rewardInfo({ level: n, track, reward, itemName: reward.item ? 'Thing' : undefined, xp: 0, gold: false });
        assert(info.title.length > 0, `level ${n} ${track} has no title`);
        assert(info.body.length >= 10, `level ${n} ${track} has no description`);
        assert(info.body.length <= 90, `level ${n} ${track} is overcomplicated (${info.body.length} chars)`);
        assert(info.where.includes(`Level ${n}`), `level ${n} ${track} does not say its level`);
        assert(info.status.length >= 5, `level ${n} ${track} does not say where the player stands`);
        assert(!/[\u{1F300}-\u{1FAFF}]/u.test(info.title + info.body + info.status), 'an emoji got into the words');
      }
    }
  });

  test('coins and trophies say what they are for', () => {
    const coins = rewardInfo({ level: 1, track: 'free', reward: { coins: 20, trophies: 0 }, xp: 0, gold: false });
    assertEqual(coins.title, '20 coins', 'the coin title is wrong');
    assert(/Store/.test(coins.body), 'coins do not say they are spent in the Store');
    const trophies = rewardInfo({ level: 2, track: 'free', reward: { coins: 0, trophies: 4 }, xp: 0, gold: false });
    assertEqual(trophies.title, '4 trophies', 'the trophy title is wrong');
    assert(/ladder/.test(trophies.body), 'trophies do not mention the ladder');
  });

  test('a die or battlefield can be seen from its description', () => {
    const fire = rewardInfo({ level: 12, track: 'gold', reward: goldRewardFor(12), itemName: 'Fire Dice', xp: 0, gold: true });
    assertEqual(fire.canPreview, true, 'a die cannot be looked at from its description');
    assert(/burn/.test(fire.body), 'the Fire dice do not mention their flames');
  });

  test('where the player stands: yours, how far, or needs the Gold Pass', () => {
    const reached = rewardInfo({ level: 3, track: 'free', reward: rewardFor(3), xp: xpToReach(3), gold: false });
    assert(/^Yours/.test(reached.status), 'a reached level is not shown as yours');
    const ahead = rewardInfo({ level: 10, track: 'free', reward: rewardFor(10), xp: 0, gold: false });
    assert(new RegExp(`${xpToReach(10).toLocaleString('en-US')} XP to go`).test(ahead.status), 'the experience to go is wrong');
    assert(new RegExp(`about ${winsFor(xpToReach(10))} wins`).test(ahead.status), 'the wins estimate is missing');
    const locked = rewardInfo({ level: 3, track: 'gold', reward: goldRewardFor(3), xp: xpToReach(5), gold: false });
    assertEqual(locked.offerGold, true, 'a locked Gold tile does not offer the Gold Pass');
    assert(/Pays out as soon as you get it/.test(locked.status), 'a reached Gold level does not say it pays out on buying');
    const owned = rewardInfo({ level: 3, track: 'gold', reward: goldRewardFor(3), xp: 0, gold: true });
    assertEqual(owned.offerGold, false, 'a Gold Pass holder is offered it again');
  });

  test('already owning the item says it pays coins instead', () => {
    const info = rewardInfo({ level: 20, track: 'free', reward: rewardFor(20), itemName: 'Ice Dice', xp: 0, gold: false, alreadyOwned: true });
    assert(/1,000 coins instead/.test(info.body), 'owning the item already is not explained');
  });

  test('every tile is tappable and opens the description', () => {
    const card = code('src/demo/SeasonPassCard.tsx');
    assert(!/if \(!l\.item \|\| !l\.reward\.item\) return body;/.test(card), 'coin and trophy tiles still do nothing when tapped');
    assert(/setOpen\(\{ l, track \}\)/.test(card), 'a tap does not open the description');
    assert(/Tap for details/.test(readFileSync(join(root, 'src/demo/SeasonPassCard.tsx'), 'utf8')), 'VoiceOver is not told a tile can be tapped');
    assert(/<Modal transparent visible/.test(card), 'the description is not drawn over the whole screen');
    assert(/See it/.test(card) && /Get the Gold Pass/.test(card), 'the description has lost its buttons');
  });
});
