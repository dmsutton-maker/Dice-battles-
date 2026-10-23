import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, suite, test } from './harness';
import { ARENAS } from '../src/arena/arenas';
import { DICE_SKINS } from '../src/game/diceSkins';
import { ARENA_BLURBS, BLURB_MAX, DIE_BLURBS } from '../src/game/itemBlurbs';
import { PRODUCTS } from '../src/game/products';

/*
  David, 20 Oct 2026: "Shorten and simplify the descriptions of
  everything. Add short descriptions of all the dice and arenas."
*/
const EMOJI = /\p{Extended_Pictographic}/u;

suite('descriptions · every die and battlefield has a short line', () => {
  test('every die has one, and it is short', () => {
    for (const s of DICE_SKINS) {
      const line = DIE_BLURBS[s.id];
      assert(!!line, `${s.name} has no description`);
      assert(line.length <= BLURB_MAX, `${s.name}: "${line}" is ${line.length} characters, over ${BLURB_MAX}`);
      assert(!EMOJI.test(line), `${s.name}'s description has an emoji`);
    }
  });

  test('every battlefield has one, and it is short', () => {
    for (const [id, a] of Object.entries(ARENAS)) {
      const line = (ARENA_BLURBS as Record<string, string>)[id];
      assert(!!line, `${a.name} has no description`);
      assert(line.length <= BLURB_MAX, `${a.name}: "${line}" is ${line.length} characters, over ${BLURB_MAX}`);
      assert(!EMOJI.test(line), `${a.name}'s description has an emoji`);
    }
  });

  test('no description is left over for a die that no longer exists', () => {
    const ids = new Set(DICE_SKINS.map((s) => s.id));
    for (const id of Object.keys(DIE_BLURBS)) assert(ids.has(id), `a description for "${id}", which is not a die`);
  });

  test('the preview shows the item its own line, not one sentence for all', () => {
    const screen = readFileSync(join(__dirname, '..', 'src', 'demo', 'DiceDemoScreen.tsx'), 'utf8');
    assert(/note: arenaBlurb\(preview\.id\)/.test(screen), 'the battlefield preview does not show its description');
    assert(/note: dieBlurb\(skin\.id\)/.test(screen), 'the dice preview does not show its description');
  });

  test('the money shop stays short', () => {
    for (const p of PRODUCTS) {
      assert(p.blurb.length <= 40, `${p.id}'s one line is ${p.blurb.length} characters`);
      assert(p.details.length <= 130, `${p.id}'s full description is ${p.details.length} characters`);
    }
  });
});
