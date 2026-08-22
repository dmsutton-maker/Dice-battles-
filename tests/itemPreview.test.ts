import {
  actionLabel,
  isActionPressable,
  previewAction,
  PreviewState,
} from '../src/game/itemPreview';
import { assert, assertEqual, suite, test } from './harness';

/**
 * The preview's one button. Every path through this decides whether a
 * player can spend coins, so the wrong answer either charges twice for a
 * die they own or refuses to sell them one they can afford.
 */
const base: PreviewState = {
  trophies: 0,
  coins: 0,
  owned: false,
  unlocked: false,
  equipped: false,
};

suite('preview · what the button offers', () => {
  test('the one you are already using offers nothing to do', () => {
    const action = previewAction({ ...base, equipped: true, owned: true });
    assertEqual(action.kind, 'equipped', 'equipped item');
    assertEqual(isActionPressable(action), false, 'nothing left to press');
    // Being equipped beats every other state, including states that would
    // otherwise offer to sell it to you again.
    assertEqual(
      previewAction({ ...base, equipped: true, price: 300, coins: 9999 }).kind,
      'equipped',
      'an equipped item is never for sale',
    );
  });

  test('anything you own or have earned can be put on', () => {
    assertEqual(previewAction({ ...base, owned: true }).kind, 'equip', 'bought');
    assertEqual(previewAction({ ...base, unlocked: true }).kind, 'equip', 'earned');
    // The Store route and the ladder route both end here, which is what
    // lets family tester mode open a Store die without buying it.
    assertEqual(
      previewAction({ ...base, unlocked: true, price: 450, coins: 0 }).kind,
      'equip',
      'unlocked beats an unaffordable price',
    );
    assert(isActionPressable(previewAction({ ...base, owned: true })), 'equip is pressable');
  });

  test('a Store die you can afford is for sale', () => {
    const action = previewAction({ ...base, price: 300, coins: 300 });
    assertEqual(action.kind, 'buy', 'exactly enough is enough');
    assertEqual(actionLabel(action), 'Buy for 300', 'the label names the price');
    assert(isActionPressable(action), 'buy is pressable');
  });

  test('a Store die you cannot afford says how far off you are', () => {
    const action = previewAction({ ...base, price: 300, coins: 120 });
    assertEqual(action.kind, 'unaffordable', 'short of the price');
    assertEqual(actionLabel(action), '180 more coins to go', 'counts the gap, not the price');
    // Dead on purpose: a button that looks pressable and then refuses is
    // worse than one that plainly cannot be pressed yet.
    assertEqual(isActionPressable(action), false, 'must not be pressable');
  });

  test('a ladder item counts trophies, not coins', () => {
    const action = previewAction({ ...base, needTrophies: 430, trophies: 180, coins: 99999 });
    assertEqual(action.kind, 'locked', 'still locked');
    assertEqual(actionLabel(action), '250 more trophies to go', 'counts the trophy gap');
    // The distinction is the whole point of having two dead states: one
    // says keep playing, the other says keep saving.
    assert(!actionLabel(action).includes('coins'), 'must not send them to the Store');
    assertEqual(isActionPressable(action), false, 'must not be pressable');
  });

  test('the gap never reads as a negative number', () => {
    // A player can hold more trophies than the tier needs and still not be
    // "unlocked" if the caller got that wrong. Better a 0 than a "-90".
    const action = previewAction({ ...base, needTrophies: 100, trophies: 190 });
    assertEqual(action.kind, 'locked', 'still locked');
    assertEqual((action as { short: number }).short, 0, 'clamped at zero');
  });

  test('every action has words on it', () => {
    const states: PreviewState[] = [
      { ...base, equipped: true },
      { ...base, owned: true },
      { ...base, price: 250, coins: 250 },
      { ...base, price: 250, coins: 0 },
      { ...base, needTrophies: 40 },
    ];
    for (const state of states) {
      const label = actionLabel(previewAction(state));
      assert(label.length > 0, `${previewAction(state).kind} has a blank button`);
    }
  });
});
