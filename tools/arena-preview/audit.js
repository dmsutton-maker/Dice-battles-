/*
  Counts what is actually drawn along each of the four tray walls.

  Marc, 27 Aug 2026: "in volcano rim you didn't put the orange rocks
  around the entire wall, just on half of it. All these things have to go
  around the entire wall."

  He was right, and the reason it kept happening is that "does the crest
  go all the way round" had never once been MEASURED. The unit tests can
  check where a piece is placed; they cannot see that the piece was
  hidden under a slab of snow, or laid crossways, or drawn in a colour
  two shades off the wall behind it. All three of those were shipping.

  So this reads the render. It renders each battlefield straight down,
  walks the top of each wall in screen space, and reports how many
  separate pieces it can count along it and how much contrast there is
  between them. A wall with nothing countable on it is a bare wall,
  whatever the source says is there.

  Usage (from the repo root, with the preview deps installed — see
  README.md, and take them back out afterwards):

    node tools/arena-preview/audit.js            # all sixteen
    node tools/arena-preview/audit.js volcano    # just one
*/
const { chromium } = require('playwright');
const path = require('path');

const ALL = ('snow desert volcano autumn aurora cavern sky moon beach candy ' +
  'glade cove farm reef city toybox').split(' ');
const IDS = process.argv.slice(2).length ? process.argv.slice(2) : ALL;

/**
 * How much light-to-dark range a decorated wall shows, at least.
 *
 * Below this you are looking at a plain kerb — which is what the Snowy
 * Woods was, with its fence posts buried under a slab of snow.
 */
const MIN_CONTRAST = 18;

/**
 * How faint the quietest quarter of a wall may be against the liveliest.
 *
 * Reported, not enforced. It is the right idea — decoration that stops
 * part way leaves one stretch flat — but the reading is taken along a
 * single line at one height, and a piece taller than that line shifts
 * off the line as it projects, so the number dips where nothing is
 * actually missing. It is worth printing and worth looking at the render
 * when it dips; it is not worth failing a build over, and quoting it as
 * proof of anything would be dishonest.
 */
const WATCH_EVENNESS = 0.34;

/**
 * Opposite walls must match.
 *
 * This is the one that matters, and the one that needed no calibrating:
 * the two long walls of a tray are mirror images, so are the two short
 * ones, and every "it only goes round half of it" fault this project has
 * had shows up here as one number far below its opposite. With the crest
 * ring listed a wall at a time, Volcano Rim read left 105 / right 34.
 */
const MIN_SYMMETRY_SIDES = 0.75;

/**
 * The two SHORT walls get more rope, and it is not a fudge.
 *
 * The jail pen stands behind the near wall and the retreat behind the
 * far one, so those two readings carry some of the structure behind them
 * and legitimately differ by a third. The long walls have open ground
 * behind both of them and nothing to explain a gap, which is why they
 * are held to 0.75 — tight enough to have caught Volcano Rim, which read
 * left 105 / right 65 with the ring listed a wall at a time.
 */
const MIN_SYMMETRY_ENDS = 0.45;

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  page.on('pageerror', (e) => console.log('PAGE THROW:', e.message));

  const problems = [];
  const notes = [];
  for (const id of IDS) {
    await page.goto('file://' + path.resolve(__dirname, 'index.html') + '?id=' + id + '&top=1');
    await page.waitForFunction('window.__ready === true', { timeout: 20000 }).catch(() => {});

    const report = await page.evaluate(() => {
      const gl = document.querySelector('canvas');
      const flat = document.createElement('canvas');
      flat.width = gl.width;
      flat.height = gl.height;
      const ctx = flat.getContext('2d');
      ctx.drawImage(gl, 0, 0);
      const scale = gl.width / 393;
      const px = ctx.getImageData(0, 0, flat.width, flat.height).data;

      const lum = (sx, sy) => {
        const x = Math.round(sx * scale);
        const y = Math.round(sy * scale);
        if (x < 0 || y < 0 || x >= flat.width || y >= flat.height) return null;
        const o = (y * flat.width + x) * 4;
        return 0.299 * px[o] + 0.587 * px[o + 1] + 0.114 * px[o + 2];
      };

      const out = {};
      for (const [name, pts] of Object.entries(window.__walls())) {
        const series = [];
        for (const [x, z] of pts) {
          const [sx, sy] = window.__project(x, z);
          const v = lum(sx, sy);
          if (v !== null) series.push(v);
        }
        if (series.length < 60) {
          out[name] = { contrast: 0, quietest: 0, offscreen: true };
          continue;
        }
        /*
          Cut the wall into four stretches and measure each one on its
          own. A wall decorated end to end has life in all four; a wall
          whose decoration stopped at the halfway mark has two lively
          stretches and two flat ones, and no whole-wall number can tell
          those two apart.

          Four rather than more: the stretch has to be longer than the
          spacing of whatever is being counted, or a stretch that happens
          to land between two pieces reads as a hole that is not there.
        */
        const SEGS = 4;
        const per = [];
        for (let k = 0; k < SEGS; k++) {
          const part = series.slice(
            Math.floor((k * series.length) / SEGS),
            Math.floor(((k + 1) * series.length) / SEGS),
          );
          per.push(Math.max(...part) - Math.min(...part));
        }
        const sorted = [...per].sort((a, b) => a - b);
        out[name] = {
          contrast: Math.round(sorted[Math.floor(SEGS / 2)]),
          quietest: Math.round(sorted[0]),
          liveliest: Math.round(sorted[SEGS - 1]),
          offscreen: false,
        };
      }
      return out;
    });

    const line = Object.entries(report)
      .map(([w, r]) => `${w} ${r.contrast}`)
      .join('  ');

    const faults = [];
    const watch = [];
    for (const [w, r] of Object.entries(report)) {
      if (r.offscreen) faults.push(`${w} wall never reached the screen`);
      else if (r.contrast < MIN_CONTRAST)
        faults.push(`${w} wall is bare (contrast ${r.contrast})`);
      else if (r.quietest < r.liveliest * WATCH_EVENNESS)
        watch.push(
          `${w} wall dips in one stretch (${r.quietest} against ${r.liveliest})` +
            ' — worth a look at the render',
        );
    }
    for (const [a, b, limit] of [
      ['left', 'right', MIN_SYMMETRY_SIDES],
      ['near', 'far', MIN_SYMMETRY_ENDS],
    ]) {
      const lo = Math.min(report[a].contrast, report[b].contrast);
      const hi = Math.max(report[a].contrast, report[b].contrast);
      if (hi > 0 && lo < hi * limit)
        faults.push(`${a} and ${b} do not match (${report[a].contrast} vs ${report[b].contrast})`);
    }

    console.log(
      `${faults.length ? '\u2717' : '\u2713'} ${id.padEnd(8)} ${line}` +
        (watch.length ? `   (${watch.length} to look at)` : ''),
    );
    for (const f of faults) problems.push(`${id}: ${f}`);
    for (const w of watch) notes.push(`${id}: ${w}`);
  }

  await browser.close();
  console.log('');
  if (problems.length) {
    for (const p of problems) console.log('  ' + p);
    process.exitCode = 1;
  } else {
    console.log(`  all ${IDS.length} battlefields are decorated on all four walls,`);
    console.log('  and each wall matches the one opposite it');
  }
  if (notes.length) {
    console.log('\n  worth looking at (not failures):');
    for (const n of notes) console.log('    ' + n);
  }
})();
