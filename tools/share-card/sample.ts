import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { hexTint, layoutCard, ShareResult } from '../../src/share/shareCard';
import { ArtId, SHARE_ART_SIZES } from '../../src/share/shareArtManifest';
import { THEME } from '../../src/ui/theme';
import { ModeId } from '../../src/game/modes';
import { readPng, Rgba, writePng } from './pngio';
import { rasterCard } from './raster';

/**
 * A sample "Share your win" card, for looking at.
 *
 *   npx tsx tools/share-card/sample.ts <board.png> <out.png> [mode score target trophies]
 *
 * `board.png` stands in for the snapshot the phone takes at the win —
 * any portrait picture of the game will do; the App Store screenshots
 * in store/screenshots/iphone are the real board. The card goes through
 * the same layout code the phone uses (src/share/shareCard.ts); only the
 * painter is software here (raster.ts) and GL there (composeCard.ts).
 */
const ROOT = join(__dirname, '..', '..');

/** The file each art id lives in — the same naming as make_art.py. */
export function artFile(id: ArtId): string {
  const name =
    id === 'digitsSmall' ? 'digits-small' : id.startsWith('mode') ? `mode-${id.slice(4).toLowerCase()}` : id;
  return join(ROOT, 'assets', 'share', `${name}.png`);
}

/** Every picture in assets/share, decoded. */
export function loadArtPictures(): Record<string, Rgba> {
  const pictures: Record<string, Rgba> = {};
  for (const id of Object.keys(SHARE_ART_SIZES) as ArtId[]) {
    pictures[id] = readPng(new Uint8Array(readFileSync(artFile(id))));
  }
  return pictures;
}

export function sampleCard(board: Rgba, result: ShareResult): Rgba {
  const pictures = { ...loadArtPictures(), board };
  return rasterCard(layoutCard(board, result), pictures, hexTint(THEME.ground));
}

function main(): void {
  const [boardPath, outPath, mode = 'classic', score = '6', target = '6', trophies = '12'] = process.argv.slice(2);
  if (!boardPath || !outPath) {
    console.error('usage: npx tsx tools/share-card/sample.ts <board.png> <out.png> [mode score target trophies]');
    process.exit(2);
  }
  const board = readPng(new Uint8Array(readFileSync(boardPath)));
  const started = Date.now();
  const card = sampleCard(board, {
    mode: mode as ModeId,
    score: Number(score),
    target: Number(target),
    trophies: Number(trophies),
  });
  const png = writePng(card, { alpha: false });
  writeFileSync(outPath, png);
  console.log(`${outPath}: ${card.width} x ${card.height}, ${png.length} bytes, ${Date.now() - started} ms`);
}

if (require.main === module) main();
