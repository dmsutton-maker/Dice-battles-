import { store } from './storageMock';
import {
  activeArena,
  activeDieBody,
  equipArena,
  equipSkin,
  getLoadout,
  loadLoadout,
} from '../src/game/loadout';
import { skinById } from '../src/game/diceSkins';
import { assert, assertEqual, suite, test } from './harness';

/**
 * What the game remembers between launches. The device is the only storage
 * this game has — no accounts, no server — so a broken round trip silently
 * resets a player's choices every time they open the app.
 */
suite('persistence · loadout', () => {
  test('the battlefield you picked is still there next launch', async () => {
    equipArena('jungle');
    // A fresh launch reads from storage rather than memory.
    const reloaded = await loadLoadout();
    assertEqual(reloaded.arenaId, 'jungle', 'battlefield was forgotten');
    assertEqual(activeArena(9999), 'jungle', 'a remembered battlefield is not used');
  });

  test('the dice you equipped are still there next launch', async () => {
    equipSkin('midnight');
    const reloaded = await loadLoadout();
    assertEqual(reloaded.skinId, 'midnight', 'dice skin was forgotten');
    assertEqual(
      activeDieBody(9999),
      skinById('midnight').body,
      'a remembered dice colour is not used',
    );
  });

  test('choices survive independently of each other', async () => {
    equipArena('space');
    equipSkin('mint');
    equipArena('castleSunset');
    const reloaded = await loadLoadout();
    assertEqual(reloaded.arenaId, 'castleSunset', 'battlefield');
    assertEqual(reloaded.skinId, 'mint', 'changing battlefield reset the dice');
  });

  test('junk in storage falls back instead of crashing the game', async () => {
    store.set('dice-battles:loadout', '{"arenaId":"atlantis","skinId":"rainbow"}');
    const reloaded = await loadLoadout();
    assertEqual(reloaded.arenaId, 'castle', 'unknown battlefield should fall back');
    assertEqual(reloaded.skinId, 'ivory', 'unknown dice should fall back');

    store.set('dice-battles:loadout', 'not json at all');
    const survived = await loadLoadout();
    assert(survived.arenaId.length > 0, 'corrupt storage broke the loadout');
  });

  test('an item that is no longer unlocked is not equipped', () => {
    // Family tester mode unlocks everything; turning it off must not leave
    // a player standing in an arena they cannot use.
    store.clear();
    equipArena('space');
    equipSkin('midnight');
    assertEqual(activeArena(0), 'castle', 'a locked battlefield stayed equipped');
    assertEqual(
      activeDieBody(0),
      skinById('ivory').body,
      'locked dice stayed equipped',
    );
    // The choice is remembered, just not used until it is earned again.
    assertEqual(getLoadout().arenaId, 'space', 'the choice itself was discarded');
    assertEqual(activeArena(9999), 'space', 'earning it back does not restore it');
  });
});
