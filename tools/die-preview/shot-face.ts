/**
 * One dice skin's shelf picture, straight to a PNG.
 *
 * The quickest way to look at a painter's output without a phone, a
 * browser or a bundler — it is the real `shellPreviewUri`, which is what
 * the Store and the Inventory draw, so what comes out is what a player
 * sees on a card.
 *
 *     npx tsx tools/die-preview/shot-face.ts /tmp gold silver
 */
import { writeFileSync } from 'node:fs';
import { DICE_SKINS } from '../../src/game/diceSkins';
import { shellPreviewUri } from '../../src/dice/preview';

for (const id of process.argv.slice(3)) {
  const skin = DICE_SKINS.find((s) => s.id === id);
  if (!skin) throw new Error(`no skin ${id}`);
  const uri = shellPreviewUri(skin);
  if (!uri) throw new Error(`${id} has no picture — a plain skin paints nothing`);
  const b64 = uri.slice(uri.indexOf(',') + 1);
  writeFileSync(`${process.argv[2]}/${id}.png`, Buffer.from(b64, 'base64'));
  console.log(`${process.argv[2]}/${id}.png`);
}
