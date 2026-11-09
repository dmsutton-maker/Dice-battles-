import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Align, Justify, loadYoga } from 'yoga-layout/load';
import { assert, assertEqual, note, suite, test } from './harness';

/**
 * Does the Settings popup actually have room for its contents?
 *
 * Every other test here reads the source as TEXT — it can tell that a
 * style exists, never what that style resolves to. Two bugs shipped
 * straight through 247 such tests: the Settings popup rendered its whole
 * body at zero height, and the News popup clipped its older entries with
 * no way to scroll to them. Both were flexbox arithmetic, invisible to a
 * regex and to the typechecker.
 *
 * So this suite runs the REAL layout engine. `yoga-layout` is the same
 * algorithm React Native ships, as a dev dependency, in the same spirit as
 * the physics suite running real cannon-es rather than trusting intuition
 * about how dice fall.
 */

/** The tightest screen the game supports. */
const SE = { width: 375, height: 667 };
const HEADER = 44;
const VERSION = 25;

type Sizing = 'flex1' | 'flexShrink' | 'none';

interface Built {
  panel: number;
  body: number;
}

/**
 * The popup tree: a centred panel capped by maxHeight, holding a header, a
 * scrolling body and (for Settings) a version line under it.
 */
async function layout(opts: {
  contentHeight: number;
  scroll: Sizing;
  withVersionLine: boolean;
  panelMaxPercent?: number;
}): Promise<Built> {
  const Y = await loadYoga();
  const root = Y.Node.create();
  root.setWidth(SE.width);
  root.setHeight(SE.height);
  root.setJustifyContent(Justify.Center);
  root.setAlignItems(Align.Center);

  const panel = Y.Node.create();
  panel.setWidth('100%');
  panel.setMaxHeightPercent(opts.panelMaxPercent ?? 78);
  panel.setFlexShrink(1);
  root.insertChild(panel, 0);

  const header = Y.Node.create();
  header.setWidth('100%');
  header.setHeight(HEADER);
  header.setFlexShrink(0);
  panel.insertChild(header, 0);

  const body = Y.Node.create();
  body.setWidth('100%');
  if (opts.scroll === 'flex1') {
    body.setFlexGrow(1);
    body.setFlexShrink(1);
    body.setFlexBasis(0);
  } else if (opts.scroll === 'flexShrink') {
    body.setFlexShrink(1);
  }
  const content = Y.Node.create();
  content.setWidth('100%');
  content.setHeight(opts.contentHeight);
  body.insertChild(content, 0);
  panel.insertChild(body, 1);

  if (opts.withVersionLine) {
    const version = Y.Node.create();
    version.setWidth('100%');
    version.setHeight(VERSION);
    version.setFlexShrink(0);
    panel.insertChild(version, 2);
  }

  root.calculateLayout(SE.width, SE.height);
  return { panel: panel.getComputedHeight(), body: body.getComputedHeight() };
}

/** Roughly what the Settings body comes to: four sliders and the rest. */
const SETTINGS_CONTENT = 900;
/** Today's news list, and it only grows. */
const NEWS_CONTENT = 900;

suite('popup layout · the Settings body has real height', () => {
  test('a scrolling body sized with flexShrink gets most of the panel', async () => {
    const { panel, body } = await layout({
      contentHeight: SETTINGS_CONTENT,
      scroll: 'flexShrink',
      withVersionLine: true,
    });
    note(`iPhone SE Settings popup: panel ${panel.toFixed(0)}pt, body ${body.toFixed(0)}pt`);
    assert(panel > 400, `the panel collapsed to ${panel.toFixed(0)}pt`);
    assert(
      body > 300,
      `the Settings body is only ${body.toFixed(0)}pt — the controls would not fit`,
    );
  });

  test('flex: 1 inside a maxHeight-only panel collapses to nothing', async () => {
    /*
      This is the bug, kept as a test so the reasoning survives. `flex: 1`
      sets flexBasis to 0 — "start at nothing, grow into space my parent
      proves it has". A panel capped by maxHeight with no height of its own
      can never prove any, so the body resolves to exactly zero and the
      whole of Settings vanishes.

      Note this is the OPPOSITE of what was right when Settings was a full
      page: there the parent had a definite height, and flexBasis auto let
      the scroll swallow its sibling. Same two properties, reversed answer,
      because what changed is whether the parent's height is known.
    */
    const { body } = await layout({
      contentHeight: SETTINGS_CONTENT,
      scroll: 'flex1',
      withVersionLine: true,
    });
    assert(
      body === 0,
      `expected flex:1 to collapse here, got ${body.toFixed(0)}pt — if this ` +
        'no longer collapses, the comment above needs revisiting',
    );
  });

  test('the version line still gets its row', async () => {
    const { panel, body } = await layout({
      contentHeight: SETTINGS_CONTENT,
      scroll: 'flexShrink',
      withVersionLine: true,
    });
    const left = panel - HEADER - body;
    note(`room left under the Settings body: ${left.toFixed(0)}pt`);
    assert(
      left >= VERSION - 1,
      `only ${left.toFixed(0)}pt under the body — the version line needs ${VERSION}`,
    );
  });
});

suite('popup layout · News can reach its oldest entry', () => {
  test('the list shrinks into the panel rather than overflowing it', async () => {
    const { panel, body } = await layout({
      contentHeight: NEWS_CONTENT,
      scroll: 'flexShrink',
      withVersionLine: false,
    });
    note(`iPhone SE News popup: panel ${panel.toFixed(0)}pt, list ${body.toFixed(0)}pt`);
    assert(
      body <= panel - HEADER + 1,
      `the list is ${body.toFixed(0)}pt inside a ${panel.toFixed(0)}pt panel — ` +
        'the overflow is clipped and cannot be scrolled to',
    );
    assert(body > 300, `the list collapsed to ${body.toFixed(0)}pt`);
  });

  test('an unsized list overflows the panel, which is what lost the old entries', async () => {
    // No flex at all: a ScrollView takes its full content height, the panel
    // clips it, and the scroll believes it already fits so dragging does
    // nothing. Silent, and worse with every news item added.
    const { panel, body } = await layout({
      contentHeight: NEWS_CONTENT,
      scroll: 'none',
      withVersionLine: false,
    });
    assert(
      body > panel,
      'an unsized list no longer overflows — the comment above needs revisiting',
    );
  });
});

suite('popup layout · the code matches what was measured', () => {
  const screen = readFileSync(
    join(__dirname, '..', 'src/demo/DiceDemoScreen.tsx'),
    'utf8',
  );
  const news = readFileSync(
    join(__dirname, '..', 'src/demo/NewsScreen.tsx'),
    'utf8',
  );

  test('the Settings scroll uses flexShrink, not flex: 1', () => {
    const style = screen.match(/settingsScroll: \{[\s\S]*?\n  \},/)?.[0];
    assert(style !== undefined, 'settingsScroll is not defined');
    // Strip comments first: this block EXPLAINS why flex:1 is wrong, and
    // matching the prose instead of the code is how a test lies to you.
    const code = style!
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    assert(
      /flexShrink: 1/.test(code),
      'settingsScroll has no flexShrink, so it collapses inside the popup',
    );
    assert(
      !/\bflex: 1\b/.test(code),
      'settingsScroll is back to flex: 1, which collapses inside the popup',
    );
  });

  test('the News list is sized at all', () => {
    assert(
      /list: \{[\s\S]*?flexShrink: 1/.test(news),
      'the News list has no flexShrink, so it overflows the popup unscrollably',
    );
    assert(
      /style=\{styles\.list\}/.test(news),
      'the News ScrollView never uses that style',
    );
  });
});

suite('popup layout · Settings sits inside its panel', () => {
  const screen = readFileSync(
    join(__dirname, '..', 'src/demo/DiceDemoScreen.tsx'),
    'utf8',
  );
  const popup = readFileSync(join(__dirname, '..', 'src/demo/Popup.tsx'), 'utf8');

  test('the rows are inset, not flush against the panel border', () => {
    // They had no horizontal padding at all, so every slider and button ran
    // edge to edge against a rounded border while the title sat inside it.
    const style = screen.match(/settingsScrollContent: \{[\s\S]*?\n  \},/)?.[0];
    assert(style !== undefined, 'settingsScrollContent is not defined');
    const pad = style!.match(/paddingHorizontal: (\d+)/);
    assert(pad !== null, 'the settings rows have no horizontal inset');
    assert(
      Number(pad![1]) >= 12,
      `only ${pad![1]}px of inset — the rows still crowd the panel edge`,
    );
  });

  test('the rows line up with the popup title above them', () => {
    // Two different insets in one panel reads as a mistake even when
    // nobody can say which number is wrong.
    const rows = screen
      .match(/settingsScrollContent: \{[\s\S]*?\n  \},/)?.[0]
      .match(/paddingHorizontal: (\d+)/)?.[1];
    const header = popup
      .match(/header: \{[\s\S]*?\n  \},/)?.[0]
      .match(/paddingHorizontal: (\d+)/)?.[1];
    assert(rows !== undefined && header !== undefined, 'could not read both insets');
    assert(
      rows === header,
      `rows inset ${rows}px but the title ${header}px — they should agree`,
    );
  });

  test('the version line is inset too, though it sits outside the scroll', () => {
    // It is a sibling of the ScrollView, so the content inset does not
    // reach it. Harmless while the version is short and centred, and the
    // only line in the popup running full width the moment it is not.
    const style = screen.match(/versionLine: \{[\s\S]*?\n  \},/)?.[0];
    assert(style !== undefined, 'versionLine is not defined');
    assert(
      /paddingHorizontal: \d+/.test(style!),
      'the version line has no inset, so it runs wider than every row above it',
    );
  });

  test('the sliders still measure themselves, so narrowing them is safe', () => {
    // The whole reason this change is safe: a slider reads its live width
    // and page position from onLayout rather than assuming either.
    const slider = readFileSync(
      join(__dirname, '..', 'src/demo/VolumeSlider.tsx'),
      'utf8',
    );
    assert(
      /widthRef\.current = event\.nativeEvent\.layout\.width/.test(slider),
      'the slider no longer reads its width on layout — a resize would break the touch maths',
    );
    assert(
      /stripRef\.current\?\.measure\(/.test(slider),
      'the slider no longer re-measures its page position on layout',
    );
    assert(
      /onLayout=\{onLayout\}/.test(slider),
      'the slider never runs its layout handler',
    );
  });
});

/**
 * The tutorial popup is a harder case than Settings: it has a scrolling
 * page AND two fixed rows under it — the dots and the two buttons — that
 * must never be squeezed out. "Let's play" being pushed off the bottom
 * would leave a first-time player stuck on a tutorial with no way out
 * except the ✕, which is the exact shape of bug this file exists for.
 */
suite('popup layout · the tutorial can always be finished', () => {
  /** Dots row, then the Back / Next row with its padding. */
  const DOTS = 27;
  const BUTTONS = 61;

  async function tutorialLayout(pageContentHeight: number) {
    const Y = await loadYoga();
    const root = Y.Node.create();
    root.setWidth(SE.width);
    root.setHeight(SE.height);
    root.setJustifyContent(Justify.Center);
    root.setAlignItems(Align.Center);

    const panel = Y.Node.create();
    panel.setWidth('100%');
    panel.setMaxHeightPercent(78);
    panel.setFlexShrink(1);
    root.insertChild(panel, 0);

    const header = Y.Node.create();
    header.setWidth('100%');
    header.setHeight(HEADER);
    header.setFlexShrink(0);
    panel.insertChild(header, 0);

    // TutorialScreen's own outer View, which is flexShrink — never flex:1,
    // because the panel above it is capped by maxHeight and so never
    // proves a definite height for a flex basis of 0 to resolve against.
    const body = Y.Node.create();
    body.setWidth('100%');
    body.setFlexShrink(1);
    panel.insertChild(body, 1);

    const scroll = Y.Node.create();
    scroll.setWidth('100%');
    scroll.setFlexShrink(1);
    const content = Y.Node.create();
    content.setWidth('100%');
    content.setHeight(pageContentHeight);
    scroll.insertChild(content, 0);
    body.insertChild(scroll, 0);

    const dots = Y.Node.create();
    dots.setWidth('100%');
    dots.setHeight(DOTS);
    dots.setFlexShrink(0);
    body.insertChild(dots, 1);

    const buttons = Y.Node.create();
    buttons.setWidth('100%');
    buttons.setHeight(BUTTONS);
    buttons.setFlexShrink(0);
    body.insertChild(buttons, 2);

    root.calculateLayout(SE.width, SE.height);
    return {
      panel: panel.getComputedHeight(),
      scroll: scroll.getComputedHeight(),
      buttons: buttons.getComputedHeight(),
      buttonsBottom:
        buttons.getComputedTop() +
        body.getComputedTop() +
        panel.getComputedTop() +
        buttons.getComputedHeight(),
    };
  }

  test('the buttons keep their full height on the longest page', async () => {
    // The modes page is the tallest: four lines plus a row of emoji.
    const built = await tutorialLayout(560);
    note(
      `iPhone SE tutorial: panel ${built.panel.toFixed(0)}pt, ` +
        `page ${built.scroll.toFixed(0)}pt, buttons ${built.buttons.toFixed(0)}pt`,
    );
    assert(built.panel > 400, `the panel collapsed to ${built.panel.toFixed(0)}pt`);
    assertEqual(
      Math.round(built.buttons),
      BUTTONS,
      'the Back / Next row got squeezed — a first-time player could not finish',
    );
    assert(
      built.scroll > 200,
      `only ${built.scroll.toFixed(0)}pt left for the page itself`,
    );
  });

  test('the buttons stay on the screen', async () => {
    const built = await tutorialLayout(560);
    assert(
      built.buttonsBottom <= SE.height,
      `"Let's play" ends ${(built.buttonsBottom - SE.height).toFixed(0)}pt below the screen`,
    );
  });

  test('a short page does not stretch the panel to fill the screen', async () => {
    // Page one is two lines. A popup that is always 78% tall regardless of
    // what is in it reads as a page, not a card.
    const built = await tutorialLayout(180);
    note(`iPhone SE tutorial, short page: panel ${built.panel.toFixed(0)}pt`);
    assert(
      built.panel < SE.height * 0.78,
      'the panel is pinned at its cap even with almost nothing in it',
    );
  });
});
