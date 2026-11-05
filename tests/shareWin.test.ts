import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { assert, assertAtMost, assertEqual, note, suite, test } from './harness';
import {
  BOARD_ANCHOR,
  CARD,
  CARD_TITLE,
  cardLines,
  coverFit,
  countForCard,
  hexTint,
  layoutCard,
  ShareResult,
} from '../src/share/shareCard';
import {
  ArtId,
  DIGIT_CELLS,
  DIGIT_CELLS_SMALL,
  SHARE_ART_SIZES,
} from '../src/share/shareArtManifest';
import { readyForReset } from '../src/share/glReset';
import { MODES, MODE_ORDER } from '../src/game/modes';
import { THEME } from '../src/ui/theme';
import { pngHeader, readPng, writePng } from '../tools/share-card/pngio';
import { rasterCard } from '../tools/share-card/raster';
import { artFile, loadArtPictures } from '../tools/share-card/sample';

const root = join(__dirname, '..');
const src = (p: string) => readFileSync(join(root, p), 'utf8');
const code = (p: string) =>
  src(p)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');

/**
 * Share your win — Marc, 5 Nov 2026: "when someone wins, come up with a
 * winning exciting screenshot from their game and give them the option
 * if they want to share that screenshot of the game to like Instagram
 * or other social agencies".
 *
 * The card's words and layout are pure (src/share/shareCard.ts) and are
 * tested as numbers. The rest — the GL capture, the composer, the share
 * sheet — runs only on a phone, so what this suite can hold it to is the
 * shape of the source: the picture is taken on a win and only on a win,
 * the button is on the won screen and nowhere else, Share.share cannot
 * throw, and no package was added for any of it.
 */

suite('share your win · what the card says', () => {
  test('the score as the game counts it, the mode, the trophies', () => {
    const lines = cardLines({ mode: 'classic', score: 6, target: 6, trophies: 12 });
    assertEqual(lines.score, '6 of 6 freed', 'the score line');
    assertEqual(lines.mode, 'Color Rush', 'the mode line');
    assertEqual(lines.trophies, '+12 trophies', 'the trophies line');
    assertEqual(lines.title, 'Dice Battles: Color Rush', 'the game’s name, as everywhere');
    assertEqual(CARD_TITLE, 'Dice Battles: Color Rush', 'one name throughout');
  });

  test('every mode names itself as the menus do', () => {
    for (const mode of MODE_ORDER) {
      const target = mode === 'colorwar' ? 3 : 6;
      const lines = cardLines({ mode, score: target, target, trophies: 0 });
      assertEqual(lines.mode, MODES[mode].name, `${mode}'s name`);
      assertEqual(lines.score, `${target} of ${target} freed`, `${mode}'s score`);
    }
  });

  test('a friendly or practice win pays nothing, so the card says nothing about trophies', () => {
    assertEqual(cardLines({ mode: 'ultimate', score: 6, target: 6, trophies: 0 }).trophies, null, 'no "+0 trophies"');
    // A loss is never shared, but the card still cannot be made to say "-5".
    assertEqual(cardLines({ mode: 'ultimate', score: 6, target: 6, trophies: -5 }).trophies, null, 'never negative');
  });

  test('only whole, non-negative numbers reach the card', () => {
    assertEqual(countForCard(4.7), 4, 'floored');
    assertEqual(countForCard(-3), 0, 'never negative');
    assertEqual(countForCard(NaN), 0, 'never NaN');
    assertEqual(countForCard(Infinity), 0, 'never infinite');
    assertEqual(cardLines({ mode: 'skirmish', score: 4.9, target: 6, trophies: 7.2 }).score, '4 of 6 freed', 'score floored');
  });

  test('nothing personal can reach it: a name, a code or an id handed in is not drawn', () => {
    /*
      ShareResult is four numbers and a mode id, so there is no field for
      a name. This proves the point from the other side: a result object
      smuggling extra strings in gets none of them onto the card.
    */
    const smuggled = {
      mode: 'colorwar',
      score: 3,
      target: 3,
      trophies: 4,
      name: 'Marc',
      opponentName: 'Grandad',
      friendCode: 'K7M29XPQ',
      playerId: 'player_0123456789abcdef',
    } as unknown as ShareResult;
    const lines = cardLines(smuggled);
    const everything = [lines.score, lines.mode, lines.trophies, lines.title].join(' ');
    for (const secret of ['Marc', 'Grandad', 'K7M2', 'player_']) {
      assert(!everything.includes(secret), `"${secret}" reached the card text`);
    }
    const drawn = layoutCard({ width: 1179, height: 2556 }, smuggled);
    const arts = new Set(drawn.map((item) => item.art));
    for (const art of arts) {
      assert(art === 'board' || art in SHARE_ART_SIZES, `an unknown picture "${art}" was laid out`);
    }
  });

  test('the layout code imports nothing that knows who is playing', () => {
    const files = ['src/share/shareCard.ts', 'src/share/composeCard.ts', 'src/share/boardShot.ts', 'src/share/shareWin.ts'];
    for (const file of files) {
      const text = code(file);
      for (const word of ['playerIdentity', 'friendCode', 'opponentName', 'friends', 'profile', 'playerId']) {
        assert(!text.includes(word), `${file} mentions ${word}`);
      }
    }
    // The sheet shares the file and nothing typed by anybody.
    const share = code('src/share/shareWin.ts');
    assert(!/message:/.test(share), 'the share carries a message — it should carry only the picture');
  });
});

suite('share your win · the layout maths', () => {
  test('the card is Instagram’s 4:5 portrait', () => {
    assertEqual(CARD.width, 1080, 'width');
    assertEqual(CARD.height, 1350, 'height');
  });

  test('a phone-tall board fills the card edge to edge and is cropped top and bottom', () => {
    const uv = coverFit({ width: 1179, height: 2556 }, CARD, 0.5);
    assertEqual(uv[0], 0, 'left edge');
    assertEqual(uv[2], 1, 'right edge');
    assert(uv[1] > 0 && uv[3] < 1, 'cropped vertically');
    assert(Math.abs(uv[1] - (1 - uv[3])) < 1e-9, 'centred at anchor 0.5');
    // The shown part has the card's shape.
    const shownW = (uv[2] - uv[0]) * 1179;
    const shownH = (uv[3] - uv[1]) * 2556;
    assert(Math.abs(shownW / shownH - CARD.width / CARD.height) < 1e-6, 'the crop has the card’s aspect');
  });

  test('a wide board fills the height and is cropped at the sides; a 4:5 one is used whole', () => {
    const wide = coverFit({ width: 2000, height: 1000 }, CARD, 0.5);
    assertEqual(wide[1], 0, 'top edge');
    assertEqual(wide[3], 1, 'bottom edge');
    assert(wide[0] > 0 && wide[2] < 1, 'cropped horizontally');
    const exact = coverFit({ width: 2160, height: 2700 }, CARD, 0.5);
    assertEqual(exact.join(','), '0,0,1,1', 'nothing cropped');
  });

  test('the anchor leans the crop towards the dice and never past the edge', () => {
    const shot = { width: 1179, height: 2556 };
    const low = coverFit(shot, CARD, BOARD_ANCHOR);
    const mid = coverFit(shot, CARD, 0.5);
    assert(low[1] > mid[1], 'the anchor below the middle shows a lower band');
    assert(low[3] <= 1 && low[1] >= 0, 'still inside the picture');
    assertEqual(coverFit(shot, CARD, 1)[3], 1, 'anchor 1 reaches the bottom');
    assertEqual(coverFit(shot, CARD, 0)[1], 0, 'anchor 0 starts at the top');
    assertEqual(coverFit(shot, CARD, 7)[3], 1, 'an anchor past 1 is clamped');
  });

  test('everything is drawn inside the card, back to front, with the board first and whole', () => {
    const items = layoutCard({ width: 1179, height: 2556 }, { mode: 'classic', score: 6, target: 6, trophies: 12 });
    assertEqual(items[0].art, 'board', 'the board is drawn first');
    assertEqual(`${items[0].x},${items[0].y},${items[0].w},${items[0].h}`, `0,0,${CARD.width},${CARD.height}`, 'and fills the card');
    for (const item of items) {
      assert(item.x >= 0 && item.y >= 0 && item.x + item.w <= CARD.width && item.y + item.h <= CARD.height, `${item.art} at ${item.x},${item.y} ${item.w}x${item.h} leaves the card`);
      assert(item.w > 0 && item.h > 0, `${item.art} has no size`);
      for (const c of item.uv) assert(c >= 0 && c <= 1, `${item.art} samples outside its picture`);
    }
    const order = items.map((i) => i.art);
    assert(order.indexOf('victory') < order.indexOf('panel'), 'banner before the panel');
    assert(order.indexOf('panel') < order.indexOf('digits'), 'the panel under the words');
    assert(order.lastIndexOf('title') === order.length - 1, 'the game’s name last');
  });

  test('the banner, the words and the title are centred', () => {
    const items = layoutCard({ width: 1179, height: 2556 }, { mode: 'skirmish', score: 4, target: 6, trophies: 3 });
    const centre = (art: ArtId | 'board') => {
      const parts = items.filter((i) => i.art === art);
      const left = Math.min(...parts.map((i) => i.x));
      const right = Math.max(...parts.map((i) => i.x + i.w));
      return (left + right) / 2;
    };
    for (const art of ['victory', 'panel', 'title', 'modeSkirmish'] as const) {
      assert(Math.abs(centre(art) - CARD.width / 2) <= 1, `${art} is off centre at ${centre(art)}`);
    }
    // The score line, as a whole: its digits and words together.
    const score = items.filter((i) => i.art === 'digits' || i.art === 'of' || i.art === 'freed');
    const left = Math.min(...score.map((i) => i.x));
    const right = Math.max(...score.map((i) => i.x + i.w));
    assert(Math.abs((left + right) / 2 - CARD.width / 2) <= 1, 'the score line is centred');
  });

  test('the words sit on the panel, above the title', () => {
    const items = layoutCard({ width: 1179, height: 2556 }, { mode: 'ultimate', score: 6, target: 6, trophies: 20 });
    const panel = items.find((i) => i.art === 'panel')!;
    const title = items.find((i) => i.art === 'title')!;
    const words = items.filter((i) => !['board', 'victory', 'panel', 'title'].includes(i.art));
    for (const w of words) {
      assert(w.y >= panel.y && w.y + w.h <= panel.y + panel.h, `${w.art} is off the panel`);
    }
    assert(title.y >= panel.y + panel.h - 8, 'the title is below the panel (its drop shadow may touch)');
    const banner = items.find((i) => i.art === 'victory')!;
    assert(banner.y + banner.h < panel.y, 'the banner is above the panel');
  });

  test('the words wear the game’s own ink, accent and green', () => {
    const items = layoutCard({ width: 1179, height: 2556 }, { mode: 'classic', score: 6, target: 6, trophies: 9 });
    const tintOf = (art: ArtId) => items.find((i) => i.art === art)!.tint.join(',');
    assertEqual(tintOf('freed'), hexTint(THEME.ink).join(','), 'the score in ink');
    assertEqual(tintOf('modeClassic'), hexTint(THEME.accent).join(','), 'the mode in the accent');
    assertEqual(tintOf('trophies'), hexTint(THEME.good).join(','), 'the trophies in green');
    assertEqual(items[0].tint.join(','), '1,1,1', 'the board untinted');
  });

  test('digits come from the sheet cells, and every cell is inside its sheet', () => {
    for (const [sheet, cells] of [['digits', DIGIT_CELLS], ['digitsSmall', DIGIT_CELLS_SMALL]] as const) {
      const size = SHARE_ART_SIZES[sheet];
      for (const ch of '0123456789+') {
        const cell = cells[ch];
        assert(cell !== undefined, `${sheet} has no '${ch}'`);
        assert(cell.x >= 0 && cell.x + cell.width <= size.width, `${sheet} '${ch}' leaves the sheet`);
      }
    }
    const items = layoutCard({ width: 1179, height: 2556 }, { mode: 'classic', score: 6, target: 6, trophies: 12 });
    const bigDigits = items.filter((i) => i.art === 'digits');
    assertEqual(bigDigits.length, 2, 'two score digits, 6 and 6');
    const six = DIGIT_CELLS['6'];
    assertEqual(bigDigits[0].uv[0], six.x / SHARE_ART_SIZES.digits.width, 'the first digit is a 6');
    const small = items.filter((i) => i.art === 'digitsSmall');
    assertEqual(small.length, 3, '"+12" is three small glyphs');
  });
});

suite('share your win · the artwork and the finished picture', () => {
  test('the manifest matches every PNG in assets/share', () => {
    for (const id of Object.keys(SHARE_ART_SIZES) as ArtId[]) {
      const header = pngHeader(new Uint8Array(readFileSync(artFile(id))));
      assertEqual(`${header.width}x${header.height}`, `${SHARE_ART_SIZES[id].width}x${SHARE_ART_SIZES[id].height}`, `${id}'s size in the manifest`);
      assertEqual(header.bitDepth, 8, `${id} is 8-bit`);
      assertEqual(header.colorType, 6, `${id} has an alpha channel`);
    }
  });

  test('the artwork stays small: it goes into every install', () => {
    let total = 0;
    for (const id of Object.keys(SHARE_ART_SIZES) as ArtId[]) total += statSync(artFile(id)).size;
    note(`share-card artwork: ${(total / 1000).toFixed(0)} KB`);
    assertAtMost(total, 400_000, 'the share artwork grew past 400 KB');
  });

  test('a 1080 x 1350 card comes out of the same layout, as a well-formed PNG', () => {
    /*
      The phone draws the list with GL and expo-gl writes the PNG; here
      the same list is drawn in software and written with node's zlib.
      Either way, what is checked is the picture's shape, not its
      bytes — the point is that the layout produces a complete,
      correctly sized card from a real board picture.
    */
    const board = readPng(new Uint8Array(readFileSync(join(root, 'store/screenshots/iphone/02.png'))));
    const started = Date.now();
    const card = rasterCard(
      layoutCard(board, { mode: 'classic', score: 6, target: 6, trophies: 12 }),
      { ...loadArtPictures(), board },
      hexTint(THEME.ground),
    );
    const png = writePng(card, { alpha: false });
    note(`sample card composed and encoded in node in ${Date.now() - started} ms, ${(png.length / 1000).toFixed(0)} KB`);
    const header = pngHeader(png);
    assertEqual(header.width, 1080, 'width');
    assertEqual(header.height, 1350, 'height');
    assertEqual(header.bitDepth, 8, '8-bit');
    assertEqual(header.colorType, 2, 'RGB — the card is opaque');
    assertEqual(header.interlace, 0, 'not interlaced');
    assert(png.length > 50_000 && png.length < 3_000_000, `an implausible file of ${png.length} bytes`);
    // Pixels: ink where the 6 is, paper around it, the banner's gold up top.
    const at = (x: number, y: number) => Array.from(card.data.subarray((y * 1080 + x) * 4, (y * 1080 + x) * 4 + 3));
    const gold = hexTint(THEME.gold).map((c) => Math.round(c * 255));
    let goldFound = false;
    for (let x = 100; x < 980 && !goldFound; x += 4) {
      for (let y = 80; y < 260 && !goldFound; y += 4) {
        const [r, g, b] = at(x, y);
        if (Math.abs(r - gold[0]) < 12 && Math.abs(g - gold[1]) < 12 && Math.abs(b - gold[2]) < 12) goldFound = true;
      }
    }
    assert(goldFound, 'no gold in the banner area');
    const paper = at(60, 920);
    assert(paper[0] > 240 && paper[1] > 240 && paper[2] > 240, `the panel corner is not paper: ${paper}`);
  });
});

suite('share your win · the screens', () => {
  const screen = code('src/demo/DiceDemoScreen.tsx');
  const duo = code('src/demo/TwoPlayerScreen.tsx');

  test('the board is photographed on a win, and only on a win', () => {
    const captures = screen.match(/captureBoard\(/g) ?? [];
    assertEqual(captures.length, 1, 'captureBoard is called from exactly one place');
    const at = screen.indexOf('captureBoard(');
    const before = screen.slice(Math.max(0, at - 200), at);
    assert(/if \(outcome === 'won'\)/.test(before), 'the capture is guarded by outcome === "won"');
    const finish = screen.indexOf("(outcome: 'won' | 'lost' | 'tie') => {");
    assert(finish !== -1 && finish < at && at - finish < 1500, 'the capture is at the top of finishRound');
    // Split screen: taken only when there is a winner.
    const duoAt = duo.indexOf('captureBoard(');
    assert(duoAt !== -1, 'the two-player screen takes the picture too');
    assert(/if \(winner === null\) return;/.test(duo.slice(duoAt - 300, duoAt)), 'a draw takes no picture');
  });

  test('the share button is on the won screen and nowhere else', () => {
    const won = screen.indexOf("{phase === 'won' && (");
    const tie = screen.indexOf("{phase === 'tie' && (");
    const button = screen.indexOf('roundOverButtons(shareWinButton)');
    assert(won !== -1 && tie !== -1 && button !== -1, 'the won block, the tie block and the button exist');
    assert(won < button && button < tie, 'the button sits inside the won block');
    assertEqual((screen.match(/roundOverButtons\(shareWinButton\)/g) ?? []).length, 1, 'and only there');
    assert(screen.includes('accessibilityLabel="Share your win"'), 'the button has an accessible label');
    assert(/const shareWinButton = winShot \?/.test(screen), 'no picture, no button');
    assert(/shareWinButton: \{\s*minHeight: MIN_TAP/.test(screen), 'the button is at least 44pt tall');
    // Split screen: the winner's half only.
    assert(/won === true && share && \(/.test(duo), 'the two-player button is for the winner only');
  });

  test('the sheet is made on the tap, and sharing is behind a second tap', () => {
    assert(!/useEffect\([^)]*composeWinCard/.test(screen), 'the card is not composed by an effect');
    const open = screen.indexOf('const openShareSheet');
    assert(open !== -1 && screen.indexOf('composeWinCard(', open) !== -1, 'the card is composed when the sheet opens');
    assert(screen.includes('onShare={() => void shareNow()}'), 'Share is the sheet’s own button');
    const sheet = code('src/demo/ShareWinSheet.tsx');
    assert(sheet.includes("'Not now'"), 'there is a Not now');
    assert(sheet.includes('Making your picture…'), 'the wait is shown');
  });

  test('Share.share cannot throw into the screen', () => {
    const share = code('src/share/shareWin.ts');
    const call = share.indexOf('Share.share(');
    const tryAt = share.lastIndexOf('try {', call);
    const catchAt = share.indexOf('catch', call);
    assert(call !== -1 && tryAt !== -1 && catchAt !== -1 && tryAt < call && call < catchAt, 'Share.share is inside try/catch');
    for (const file of ['src/share/boardShot.ts', 'src/share/composeCard.ts', 'src/share/shareArt.ts', 'src/share/tempFiles.ts']) {
      assert(code(file).includes('catch'), `${file} swallows its own failures`);
    }
  });

  test('the picture is let go of when the result screen is left', () => {
    const quit = screen.indexOf('const quitToMenu = useCallback(() => {');
    assert(screen.indexOf('forgetWinShot()', quit) - quit < 400, 'quitToMenu forgets the picture');
    const start = screen.indexOf('const startCountdown = useCallback(');
    assert(screen.indexOf('forgetWinShot()', start) - start < 2500, 'a new battle forgets the picture');
    assert(code('src/share/tempFiles.ts').includes('file.delete()'), 'the files are deleted, not left in the cache');
  });

  test('no package was added for any of this', () => {
    /*
      The whole feature rides on what the binary already has: expo-gl
      for the picture, expo-asset for the artwork, expo-file-system to
      tidy up, React Native’s own Share. A new native package would mean
      a build nobody can run from a session; a new JS package would be a
      download for a card. Both lists are pinned as they stood before.
    */
    const pkg = JSON.parse(src('package.json'));
    assertEqual(
      Object.keys(pkg.dependencies).sort().join(' '),
      [
        '@react-native-async-storage/async-storage', '@react-three/fiber', 'cannon-es', 'expo', 'expo-asset',
        'expo-audio', 'expo-constants', 'expo-file-system', 'expo-game-center', 'expo-gl', 'expo-haptics',
        'expo-iap', 'expo-notifications', 'expo-secure-store', 'expo-splash-screen', 'expo-status-bar',
        'expo-store-review', 'expo-updates', 'react', 'react-native', 'react-native-google-mobile-ads', 'three',
      ].join(' '),
      'dependencies',
    );
    assertEqual(
      Object.keys(pkg.devDependencies).sort().join(' '),
      ['@types/react', '@types/three', 'tsx', 'typescript', 'yoga-layout'].join(' '),
      'devDependencies',
    );
    for (const file of ['src/share/boardShot.ts', 'src/share/composeCard.ts', 'src/share/shareArt.ts', 'src/share/shareWin.ts', 'src/share/tempFiles.ts', 'src/demo/ShareWinSheet.tsx']) {
      for (const banned of ['react-native-view-shot', 'expo-sharing', 'expo-media-library', '@shopify/react-native-skia']) {
        assert(!src(file).includes(banned), `${file} names ${banned}`);
      }
    }
  });

  test('the picture is read from a framebuffer of our own, never the multisampled default', () => {
    /*
      expo-gl’s default framebuffer for a view is the MSAA one (fiber
      asks for 4 samples), and glReadPixels cannot read it. A snapshot
      without `framebuffer` would be noise on every phone — see
      boardShot.ts. So both snapshots name their framebuffer.
    */
    for (const file of ['src/share/boardShot.ts', 'src/share/composeCard.ts']) {
      const text = code(file);
      const calls = text.match(/takeSnapshotAsync\(gl, \{[\s\S]*?\}\)/g) ?? [];
      assert(calls.length >= 1, `${file} takes a snapshot`);
      for (const call of calls) assert(call.includes('framebuffer'), `${file}: a snapshot without a framebuffer`);
    }
    assert(code('src/share/boardShot.ts').includes('blitFramebuffer('), 'the frame is resolved with a blit first');
    assert(code('src/share/boardShot.ts').includes('resetState()'), 'three is told its context was borrowed');
  });
});

suite('share your win · never breaks the board', () => {
  /*
    Marc, 5 Nov 2026: after a win, the next battle had no floor, no
    walls, no gatehouse, no water and no dice. three's resetState() reads
    `gl.canvas.width` after it has switched the depth test off and before
    it clears its own record of that, and a phone's context has no
    `canvas`: so it threw halfway and left the depth test off until the
    app was closed. See src/share/glReset.ts.
  */
  test('a context with no canvas is given one, sized like the stand-in', () => {
    const gl: Record<string, unknown> = { drawingBufferWidth: 1179, drawingBufferHeight: 2556 };
    assert(readyForReset(gl, { width: 1179, height: 2556, style: {} }), 'ready');
    const canvas = gl.canvas as { width: number; height: number };
    assertEqual(canvas.width, 1179, 'the width three resets the viewport to');
    assertEqual(canvas.height, 2556, 'the height');
  });

  test('with no stand-in, the drawing buffer gives the size', () => {
    const gl: Record<string, unknown> = { drawingBufferWidth: 750, drawingBufferHeight: 1334 };
    assert(readyForReset(gl, undefined), 'ready');
    assertEqual((gl.canvas as { width: number }).width, 750, 'from the drawing buffer');
  });

  test('a context that already has a canvas is left alone', () => {
    const own = { width: 10, height: 20 };
    const gl = { canvas: own };
    assert(readyForReset(gl, { width: 1, height: 1 }), 'ready');
    assert(gl.canvas === own, 'not replaced');
  });

  test('a context that will not take a canvas is reported, so nothing touches it', () => {
    assert(!readyForReset(Object.freeze({ drawingBufferWidth: 1, drawingBufferHeight: 1 }), { width: 1, height: 1 }), 'frozen');
    assert(!readyForReset(null), 'no context');
    assert(!readyForReset({}, undefined), 'nothing to size it by');
  });

  test('the board capture asks before its first GL call', () => {
    const whole = code('src/share/boardShot.ts');
    const text = whole.slice(whole.indexOf('export async function'));
    const ready = text.indexOf('readyForReset(gl, renderer.domElement)');
    const firstGl = text.search(/gl\.(create|bind|texImage2D|blitFramebuffer)/);
    assert(ready > 0, 'boardShot asks readyForReset');
    assert(ready < firstGl, 'readyForReset comes before the first GL call');
  });

  test('the card is drawn by three, not by raw GL calls of its own', () => {
    /*
      Marc, 5 Nov 2026: "Share your win screen is blank". The raw-GL
      card cleared its paper and drew nothing on his iPhone, while the
      same calls draw the whole card in a browser. three draws every
      battle on that phone; the card goes through it now.
    */
    const card = code('src/share/composeCard.ts');
    for (const raw of ['drawArrays', 'createProgram', 'compileShader', 'vertexAttribPointer', 'resetState', 'gl.texImage2D']) {
      assert(!card.includes(raw), `composeCard.ts calls ${raw} itself`);
    }
    assert(card.includes('new THREE.WebGLRenderTarget('), 'a render target of its own');
    assert(card.includes('renderer.setRenderTarget(before)'), 'and three is put back on the screen afterwards');
    assert(card.includes('isDataTexture = true') && card.includes('{ localUri: '), 'pictures load the way fiber loads them on native');
    assert(card.includes('texture.flipY = false'), 'row 0 of a file is v = 0, as shareCard.ts lays it out');
    assert(card.includes('THREE.NoColorSpace'), 'uploaded raw, no colour conversion');
    assert(card.includes('toneMapped: false'), 'and not tone-mapped');
    assert(card.includes('drawn?.dispose()'), 'everything it made is freed');
  });

  test('every board gives its context a canvas when it is created', () => {
    for (const file of ['src/demo/DiceDemoScreen.tsx', 'src/demo/TwoPlayerScreen.tsx']) {
      const text = code(file);
      const created = text.slice(text.indexOf('onCreated='), text.indexOf('onCreated=') + 400);
      assert(created.includes('readyForReset(gl.getContext(), gl.domElement)'), `${file}: onCreated readies the context`);
    }
  });
});
