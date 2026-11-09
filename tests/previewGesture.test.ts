import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, suite, test } from './harness';

/**
 * The throw gesture layer sits directly under the ItemPreviewBar.
 *
 * `ItemPreviewBar`'s outer layer is `pointerEvents="box-none"` on purpose —
 * see its own comment — so a tap anywhere between the top and bottom bars
 * falls straight through to whatever is behind the preview, which is the
 * board's gesture layer (`PanResponder`, `StyleSheet.absoluteFill`, mounted
 * right after the Canvas in DiceDemoScreen). That is deliberate: the whole
 * point of a preview is to show the real board.
 *
 * But `onPanResponderGrant` starts a battle the instant it fires, with no
 * guard beyond `phase === 'pick'` — and a preview only ever opens FROM
 * 'pick' and does not change it. So a stray tap or the start of a swipe
 * anywhere in that see-through middle, while browsing the Store or the
 * Inventory, silently calls `startCountdown()`: a real countdown begins,
 * running to a real battle a couple of seconds later, while the preview bar
 * (never cleared by this path — only its own ✕ clears `preview`) stays
 * rendered on top for the rest of that match with its buy/equip button
 * still live, and the board keeps showing the previewed — not the
 * equipped — skin or arena for the whole fight.
 *
 * There is no renderer in this harness to actually dispatch the touch, so
 * this reads the source for the one guard that would stop it at the root:
 * the gesture handler that starts a battle must know a preview is open.
 */
suite('preview · the throw gesture cannot fire through an open preview', () => {
  test('onPanResponderGrant does not start a battle while a preview is open', () => {
    const src = readFileSync(
      join(__dirname, '..', 'src/demo/DiceDemoScreen.tsx'),
      'utf8',
    );
    const grant = src.match(/onPanResponderGrant:[\s\S]*?\n\s*\},/)?.[0];
    assert(grant !== undefined, 'onPanResponderGrant handler not found — did it move or get renamed?');
    assert(
      /preview/.test(grant!),
      'onPanResponderGrant never checks `preview`. Because the preview bar ' +
        'is pointerEvents="box-none" over the real board, and previews only ' +
        'open while phase is \'pick\' (which this handler treats as "start a ' +
        'battle"), a stray tap on the transparent middle of an open preview ' +
        'launches a real countdown into a real battle behind it — with the ' +
        'preview (and its live buy/equip button) still on screen, and the ' +
        'board showing the previewed rather than the equipped item for the ' +
        'whole match.',
    );
  });
});

/**
 * Buying is a moment, not a state change. The button used to flip from
 * "Buy for 300" to "Use this one" in place, which meant the biggest thing
 * that happens in this game — spending coins you played for — passed
 * without anything happening on screen.
 */
suite('preview · buying closes the preview and celebrates', () => {
  const source = readFileSync('src/demo/DiceDemoScreen.tsx', 'utf8');
  // The body of the buy branch, up to its return.
  const branch = source.match(/if \(action\.kind === 'buy'\) \{([\s\S]*?)\n      return;/);

  test('the buy branch exists where the tests think it does', () => {
    assert(branch !== null, 'the buy branch has moved — this whole suite is now blind');
  });

  test('a purchase closes the preview', () => {
    assert(
      /showPreview\(null\)/.test(branch![1]),
      'the preview stays open after buying, so nothing marks the purchase',
    );
  });

  test('a purchase queues the reward popup', () => {
    assert(
      /setRewards\(/.test(branch![1]) && /PURCHASED/.test(branch![1]),
      'buying does not raise the PURCHASED popup',
    );
  });

  test('nothing is spent before the purchase is known to have worked', () => {
    // buyWithCoins refuses rather than going negative, so acting on its
    // result is the difference between a popup for something you own and a
    // popup for something you could not afford.
    const order = branch![1];
    assert(
      order.indexOf('if (!result.ok) return;') < order.indexOf('setRewards('),
      'the popup is queued before the purchase is confirmed',
    );
  });
});
