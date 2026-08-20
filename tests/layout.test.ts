import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, assertEqual, note, suite, test } from './harness';
import {
  ANDROID_GESTURE_BAR,
  bottomInsetFor,
  IPAD_INDICATOR,
  IPHONE_INDICATOR,
  SHORTEST_INDICATOR_IPHONE,
} from '../src/game/safeAreaRules';

/**
 * Fitting on the actual phone. Every bug in here was reported from a real
 * device, and every one of them came from the app not knowing that modern
 * iPhones reserve a strip at the bottom for the home indicator.
 */

const root = join(__dirname, '..');
const nav = readFileSync(join(root, 'src/demo/BottomNav.tsx'), 'utf8');
const screen = readFileSync(join(root, 'src/demo/DiceDemoScreen.tsx'), 'utf8');
const report = readFileSync(join(root, 'src/debug/BugReportModal.tsx'), 'utf8');

suite('layout · the bottom inset matches the hardware', () => {
  test('the cutoff sits between the two families of iPhone', () => {
    const TALLEST_HOME_BUTTON = 736; // iPhone 8 Plus
    const SHORTEST_INDICATOR = 812; // iPhone X
    assert(
      SHORTEST_INDICATOR_IPHONE > TALLEST_HOME_BUTTON,
      'the cutoff would treat a home-button iPhone as having an indicator',
    );
    assert(
      SHORTEST_INDICATOR_IPHONE <= SHORTEST_INDICATOR,
      'the cutoff would treat an iPhone X as having a home button',
    );
    note(`home-indicator cutoff: ${SHORTEST_INDICATOR_IPHONE}pt tall`);
  });

  test('every real device gets the inset Apple gives it', () => {
    // Longest side in portrait, from Apple's own device metrics.
    const phones: [string, number, number][] = [
      ['iPhone SE (2nd/3rd)', 667, 0],
      ['iPhone 8 Plus', 736, 0],
      ['iPhone X', 812, IPHONE_INDICATOR],
      ['iPhone 13 mini', 812, IPHONE_INDICATOR],
      ['iPhone 15', 852, IPHONE_INDICATOR],
      ['iPhone 15 Pro Max', 932, IPHONE_INDICATOR],
    ];
    for (const [name, longSide, expected] of phones) {
      assertEqual(
        bottomInsetFor({ os: 'ios', isPad: false, longSide }),
        expected,
        name,
      );
    }
    assertEqual(
      bottomInsetFor({ os: 'ios', isPad: true, longSide: 1194 }),
      IPAD_INDICATOR,
      'iPad Pro 11"',
    );
    assertEqual(
      bottomInsetFor({ os: 'android', isPad: false, longSide: 915 }),
      ANDROID_GESTURE_BAR,
      'Android',
    );
  });

  test('an iPhone 15 gets real clearance, not a token gap', () => {
    // The whole bug: 18pt of padding against a 34pt indicator.
    const iphone15 = bottomInsetFor({ os: 'ios', isPad: false, longSide: 852 });
    assert(iphone15 >= 34, `iPhone 15 inset is only ${iphone15}pt`);
    note(`iPhone 15 bottom inset: ${iphone15}pt (was 0 before this)`);
  });
});

suite('layout · the tab bar clears the home indicator', () => {
  test('the bar reserves the inset on top of its buttons', () => {
    // A flat 18pt was about half what an iPhone 15 needs, so the labels sat
    // in the home indicator strip and the row read as not fitting.
    assert(
      /BOTTOM_NAV_HEIGHT = BAR_CONTENT_HEIGHT \+ BOTTOM_INSET/.test(nav),
      'the bar height does not include the home indicator inset',
    );
    assert(
      /paddingBottom: 18 \+ BOTTOM_INSET/.test(nav),
      'the bar padding does not clear the home indicator',
    );
  });

  test('seven labels each hold one line, whatever the system text size', () => {
    // Seven cells across the narrowest iPhone is about 53pt each. A player
    // who has turned up iOS text size must not be the one who breaks it.
    const label = nav.match(/<Text\s+style=\{\[styles\.label[\s\S]*?>/)?.[0];
    assert(label !== undefined, 'could not find the tab label');
    assert(/numberOfLines=\{1\}/.test(label!), 'tab labels can wrap to two lines');
    assert(
      /allowFontScaling=\{false\}/.test(label!),
      'tab labels scale with system text size, which breaks the row',
    );
  });

  test('there really are seven tabs to fit', () => {
    const tabs = nav.match(/\{ id: '/g) ?? [];
    assertEqual(tabs.length, 7, 'tab count');
  });
});

suite('layout · the version line cannot be pushed off', () => {
  test('it is positioned absolutely, outside the flex flow', () => {
    /*
      Twice it lived inside the flex flow and twice something took its
      space — first the scroll swallowed it, then it only appeared when the
      keyboard squeezed the panel enough to leave room. Out of the flow,
      nothing can move it.
    */
    const style = screen.match(/versionLine: \{[\s\S]*?\n  \},/)?.[0];
    assert(style !== undefined, 'versionLine is not defined');
    assert(/position: 'absolute'/.test(style!), 'the version line is still in the flex flow');
    // Anchored to the bottom of the PAGE. The page now ends at the top of
    // the tab bar, so this clears the bar and the home indicator without
    // naming either — one number to be right instead of three.
    assert(
      /bottom: \d+/.test(style!),
      'the version line is not anchored to the bottom of the page',
    );
  });

  test('it sits outside the keyboard-avoiding view', () => {
    const kavEnd = screen.indexOf('</KeyboardAvoidingView>');
    const versionAt = screen.indexOf('{GAME_VERSION}');
    assert(kavEnd > 0 && versionAt > 0, 'could not locate both');
    assert(
      versionAt > kavEnd,
      'the version line is inside the keyboard-avoiding view, so the keyboard moves it',
    );
  });

  test('the settings page reserves room for it as well as the bar', () => {
    // Absolute positioning takes no space, so without this the scrolling
    // content runs underneath the version line and the two overlap.
    const style = screen.match(/settingsPanel: \{[\s\S]*?\n  \},/)?.[0];
    assert(style !== undefined, 'settingsPanel is not defined');
    const pad = style!.match(/paddingBottom: (\d+),/);
    assert(pad !== null, 'the panel reserves nothing for the pinned version line');
    assert(
      Number(pad![1]) >= 23,
      `only ${pad![1]}px reserved — the 15pt line plus its gaps would overlap the scroll`,
    );
  });
});

suite('layout · a bug report can be abandoned', () => {
  test('the panel lifts clear of the keyboard', () => {
    // The box autofocuses and the panel is centred, so the keyboard came up
    // over the Cancel button — no way out without sending a report.
    assert(
      report.includes('KeyboardAvoidingView'),
      'the report panel does not move for the keyboard, so Cancel stays buried',
    );
  });

  test('tapping the dimmed area behind it also closes it', () => {
    const backdrop = report.match(/<Pressable\s+style=\{styles\.backdrop\}[\s\S]*?\}\}\s*>/)?.[0];
    assert(backdrop !== undefined, 'the backdrop is not pressable');
    assert(/onClose\(\)/.test(backdrop!), 'pressing the backdrop does not close the report');
  });

  test('tapping inside the panel does NOT close it', () => {
    // Otherwise missing a button by a few points throws away what you typed.
    assert(
      /<Pressable style=\{styles\.panel\} onPress=\{\(\) => \{\}\}>/.test(report),
      'the panel does not swallow taps, so a near-miss would discard the report',
    );
  });

  test('closing puts the keyboard away with it', () => {
    const closes = report.match(/Keyboard\.dismiss\(\)/g) ?? [];
    assert(
      closes.length >= 2,
      'the keyboard is not dismissed on both ways out of the report',
    );
  });
});

suite('layout · no screen hides its own way out', () => {
  const menus = ['InventoryScreen', 'StoreScreen', 'LeaderboardScreen'];

  test('no menu page draws a button underneath the tab bar', () => {
    /*
      All three used to end with a Done button placed after their scroll,
      with a flat 24pt of bottom padding. The tab bar is drawn over these
      pages at zIndex 35 with a 97%-opaque background, so the button was
      invisible AND untappable — a tap there hit whichever tab sat over it.
      The bar is the way out of these pages, as it already is on Settings
      and Cups.
    */
    for (const name of menus) {
      const src = readFileSync(join(root, `src/demo/${name}.tsx`), 'utf8');
      assert(
        !src.includes('doneButton'),
        `${name} still has a Done button under the tab bar`,
      );
      assert(
        !/onClose/.test(src),
        `${name} still takes an onClose it has no way to call`,
      );
    }
  });

  test('the in-battle HUD clears the home indicator by derivation', () => {
    // It was a hardcoded 34 — correct on a Face ID iPhone purely because
    // that is the inset, and 34pt of wasted board on a home-button phone.
    const style = screen.match(/bottomHud: \{[\s\S]*?\n  \},/)?.[0];
    assert(style !== undefined, 'bottomHud is not defined');
    assert(
      /bottom: BOTTOM_INSET \+ \d+/.test(style!),
      'the in-battle HUD still hardcodes its distance from the bottom edge',
    );
  });

  test('the report panel centres inside the avoider, not outside it', () => {
    // With behavior="padding" the view grows its own box, so centring from
    // outside makes each frame of padding re-centre the panel and it
    // settles over several layout passes instead of one.
    const backdrop = report.match(/backdrop: \{[\s\S]*?\n  \},/)?.[0];
    assert(backdrop !== undefined, 'backdrop is not defined');
    assert(
      !/justifyContent/.test(backdrop!),
      'the backdrop still centres the panel, which makes the keyboard lift settle in steps',
    );
    assert(
      /avoider: \{[\s\S]*?flex: 1[\s\S]*?justifyContent: 'center'/.test(report),
      'the keyboard-avoiding view is not full-bleed with the centring inside it',
    );
  });
});

suite('layout · the tab bar is its own section, not a thing pages dodge', () => {
  const pages = [
    'InventoryScreen',
    'StoreScreen',
    'LeaderboardScreen',
    'NewsScreen',
    'TournamentScreen',
  ];

  test('every menu page ends where the bar begins', () => {
    /*
      The bar is drawn over the pages, so each one used to be responsible
      for padding around it — and Store, Inventory and Leaderboard used a
      flat paddingBottom: 24 with no allowance at all, which cut the bottom
      off Ranks and Items. Ending each page above the bar turns that from
      something to remember into something that cannot go wrong.
    */
    for (const name of pages) {
      const src = readFileSync(join(root, `src/demo/${name}.tsx`), 'utf8');
      assert(
        src.includes('...MENU_PAGE_AREA'),
        `${name} still fills the whole screen, so the tab bar covers its bottom`,
      );
      assert(
        !src.includes('absoluteFillObject'),
        `${name} still uses absoluteFillObject for its page area`,
      );
    }
  });

  test('the Settings page ends there too', () => {
    const style = screen.match(/settingsOverlay: \{[\s\S]*?\n  \},/)?.[0];
    assert(style !== undefined, 'settingsOverlay is not defined');
    assert(
      style!.includes('...MENU_PAGE_AREA'),
      'Settings still fills the whole screen behind the tab bar',
    );
  });

  test('the page area really does stop at the top of the bar', () => {
    const nav = readFileSync(join(root, 'src/demo/BottomNav.tsx'), 'utf8');
    const area = nav.match(/MENU_PAGE_AREA = \{[\s\S]*?\} as const;/)?.[0];
    assert(area !== undefined, 'MENU_PAGE_AREA is not defined');
    assert(
      /bottom: BOTTOM_NAV_HEIGHT/.test(area!),
      'the page area does not stop at the bar',
    );
    assert(/position: 'absolute'/.test(area!), 'the page area is not positioned');
  });

  test('nobody reserves the bar height twice', () => {
    // Once a page ends above the bar, padding by the bar height again
    // leaves a dead strip the size of the bar at the bottom of the page.
    for (const name of pages) {
      const src = readFileSync(join(root, `src/demo/${name}.tsx`), 'utf8');
      assert(
        !/paddingBottom: BOTTOM_NAV_HEIGHT/.test(src),
        `${name} pads by the bar height on top of already ending above it`,
      );
    }
    const panel = screen.match(/settingsPanel: \{[\s\S]*?\n  \},/)?.[0];
    assert(
      !/paddingBottom: BOTTOM_NAV_HEIGHT/.test(panel ?? ''),
      'the Settings panel reserves the bar height twice',
    );
  });
});
