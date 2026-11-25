import { ModeId, MODES } from '../game/modes';
import { THEME } from '../ui/theme';
import {
  ArtId,
  DIGIT_CELLS,
  DIGIT_CELLS_SMALL,
  GlyphCell,
  SHARE_ART_SIZES,
} from './shareArtManifest';

/**
 * The "Share your win" card: what it says and where everything goes.
 *
 * Marc, 5 Nov 2026: "when someone wins, come up with a winning exciting
 * screenshot from their game and give them the option if they want to
 * share that screenshot of the game to like Instagram or other social
 * agencies".
 *
 * This file is PURE: numbers in, a list of rectangles out. The phone
 * draws that list in the game's GL context (composeCard.ts) and the
 * tests draw the same list in software (tools/share-card/raster.ts), so
 * what a test looks at is what a player gets.
 *
 * NOTHING PERSONAL CAN REACH THE CARD, by construction: `ShareResult`
 * is four numbers and a mode id. No player name, no opponent or friend
 * name, no friend code, no id, because strangers and children's friends
 * can be in a battle and this picture leaves the phone.
 */

/** Instagram's portrait, 4:5. Every rectangle below is in these pixels. */
export const CARD = { width: 1080, height: 1350 } as const;

/**
 * Where the board picture is centred when it is cropped to the card.
 * The scene is a screen-tall portrait; the courtyard, the dice and the
 * pads sit a little below its middle, under the sky. 0.5 would centre
 * the crop; this leans it towards the dice.
 */
export const BOARD_ANCHOR = 0.58;

/** What a finished, WON battle is to the card. Numbers and a mode only. */
export interface ShareResult {
  mode: ModeId;
  /** Prisoners freed, as the scoreboard counted them. */
  score: number;
  /** What the mode needs: 6, or 3 in Color War. */
  target: number;
  /** Trophies the win paid. 0 for a friendly or practice battle. */
  trophies: number;
}

/** The words on the card, as strings, for the tests and the sheet's accessibility label. */
export interface CardLines {
  score: string;
  mode: string;
  /** Null when the battle paid none: a friendly never says "+0 trophies". */
  trophies: string | null;
  title: string;
}

export const CARD_TITLE = 'Dice Battles: Color Rush';

/** A whole number for the card: never negative, never fractional, never NaN. */
export function countForCard(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

export function cardLines(result: ShareResult): CardLines {
  const score = countForCard(result.score);
  const target = countForCard(result.target);
  const trophies = countForCard(result.trophies);
  return {
    score: `${score} of ${target} freed`,
    mode: MODES[result.mode]?.name ?? MODES.classic.name,
    trophies: trophies > 0 ? `+${trophies} trophies` : null,
    title: CARD_TITLE,
  };
}

/** A corner of a picture, 0..1, with v = 0 at the TOP of the source. */
export type UvRect = readonly [u0: number, v0: number, u1: number, v1: number];

/** Multiplied into the picture; 1,1,1 leaves it alone. White glyphs take the ink this way. */
export type Tint = readonly [r: number, g: number, b: number];

export interface Size {
  width: number;
  height: number;
}

/**
 * The part of `src` that fills `dst` edge to edge with nothing left
 * uncovered — the bigger axis is cropped. `anchor` says which part of
 * the cropped axis to keep: 0 the start, 0.5 the middle, 1 the end.
 */
export function coverFit(src: Size, dst: Size, anchor = 0.5): UvRect {
  const scale = Math.max(dst.width / src.width, dst.height / src.height);
  // An axis that is not cropped shows exactly all of itself; the
  // division can land a hair either side of 1 and that hair is noise.
  const whole = (share: number) => (Math.abs(share - 1) < 1e-9 ? 1 : Math.min(1, share));
  const shownW = whole(dst.width / scale / src.width);
  const shownH = whole(dst.height / scale / src.height);
  const a = Math.min(1, Math.max(0, anchor));
  const u0 = (1 - shownW) * a;
  const v0 = (1 - shownH) * a;
  return [u0, v0, u0 + shownW, v0 + shownH];
}

const FULL: UvRect = [0, 0, 1, 1];
const PLAIN: Tint = [1, 1, 1];

export function hexTint(hex: string): Tint {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** One picture, or part of one, drawn at one place on the card. */
export interface DrawItem {
  art: ArtId | 'board';
  x: number;
  y: number;
  w: number;
  h: number;
  uv: UvRect;
  tint: Tint;
}

/* The fixed places. Every number is a card pixel. */
const BANNER_Y = 56;
const PANEL_X = 40;
const PANEL_Y = 884;
/** The paper itself; the PNG is 8px taller for its drop shadow. */
const PANEL_H = 380;
const TITLE_Y = 1281;
const LINE_GAP = 10;
/** A space between words, as a share of the line's height. */
const SPACE = 0.28;

const MODE_ART: Record<ModeId, ArtId> = {
  classic: 'modeClassic',
  ultimate: 'modeUltimate',
  skirmish: 'modeSkirmish',
  colorwar: 'modeColorwar',
};

/** A run of digits from a sheet, or a whole word picture. */
type Piece =
  | { kind: 'digits'; text: string; sheet: 'digits' | 'digitsSmall' }
  | { kind: 'word'; art: ArtId };

interface Placed {
  items: DrawItem[];
  width: number;
  height: number;
}

/**
 * Lay `pieces` left to right at their native size, sharing a top edge.
 * Every piece of a line comes from the same font size, so sharing the
 * top edge shares the baseline (see make_art.py).
 */
function typeset(pieces: Piece[], tint: Tint): Placed {
  const items: DrawItem[] = [];
  let x = 0;
  let height = 0;
  const space = (h: number) => Math.round(h * SPACE);
  pieces.forEach((piece, i) => {
    if (piece.kind === 'word') {
      const size = SHARE_ART_SIZES[piece.art];
      if (i > 0) x += space(size.height);
      items.push({ art: piece.art, x, y: 0, w: size.width, h: size.height, uv: FULL, tint });
      x += size.width;
      height = Math.max(height, size.height);
      return;
    }
    const sheet = SHARE_ART_SIZES[piece.sheet];
    const cells: Record<string, GlyphCell> = piece.sheet === 'digits' ? DIGIT_CELLS : DIGIT_CELLS_SMALL;
    if (i > 0) x += space(sheet.height);
    for (const ch of piece.text) {
      const cell = cells[ch];
      // Only what the sheet holds can be drawn; anything else is skipped
      // rather than drawn as a blank cell.
      if (!cell) continue;
      items.push({
        art: piece.sheet,
        x,
        y: 0,
        w: cell.width,
        h: sheet.height,
        uv: [cell.x / sheet.width, 0, (cell.x + cell.width) / sheet.width, 1],
        tint,
      });
      x += cell.width;
    }
    height = Math.max(height, sheet.height);
  });
  return { items, width: x, height };
}

/** Move a typeset line so its middle is at `cx` and its top at `y`. */
function place(line: Placed, cx: number, y: number): DrawItem[] {
  const left = Math.round(cx - line.width / 2);
  return line.items.map((item) => ({ ...item, x: item.x + left, y: item.y + y }));
}

/**
 * The whole card, back to front: the board filling it, the banner, the
 * paper panel, the score, the mode, the trophies if any, and the game's
 * name along the bottom.
 */
export function layoutCard(shot: Size, result: ShareResult): DrawItem[] {
  const lines = cardLines(result);
  const cx = CARD.width / 2;
  const items: DrawItem[] = [];

  items.push({
    art: 'board',
    x: 0,
    y: 0,
    w: CARD.width,
    h: CARD.height,
    uv: coverFit(shot, CARD, BOARD_ANCHOR),
    tint: PLAIN,
  });

  const banner = SHARE_ART_SIZES.victory;
  items.push({
    art: 'victory',
    x: Math.round(cx - banner.width / 2),
    y: BANNER_Y,
    w: banner.width,
    h: banner.height,
    uv: FULL,
    tint: PLAIN,
  });

  const panel = SHARE_ART_SIZES.panel;
  items.push({ art: 'panel', x: PANEL_X, y: PANEL_Y, w: panel.width, h: panel.height, uv: FULL, tint: PLAIN });

  // The text block, centred on the paper. The lines are typeset from
  // the strings in `lines`, so the strings the tests read are the
  // pictures the player gets.
  const score = typeset(
    [
      { kind: 'digits', text: String(countForCard(result.score)), sheet: 'digits' },
      { kind: 'word', art: 'of' },
      { kind: 'digits', text: String(countForCard(result.target)), sheet: 'digits' },
      { kind: 'word', art: 'freed' },
    ],
    hexTint(THEME.ink),
  );
  const mode = typeset([{ kind: 'word', art: MODE_ART[result.mode] ?? 'modeClassic' }], hexTint(THEME.accent));
  const trophies =
    lines.trophies === null
      ? null
      : typeset(
          [
            { kind: 'digits', text: `+${countForCard(result.trophies)}`, sheet: 'digitsSmall' },
            { kind: 'word', art: 'trophies' },
          ],
          hexTint(THEME.good),
        );
  const block = [score, mode, ...(trophies ? [trophies] : [])];
  const blockHeight = block.reduce((h, line) => h + line.height, 0) + LINE_GAP * (block.length - 1);
  let y = Math.round(PANEL_Y + (PANEL_H - blockHeight) / 2);
  for (const line of block) {
    items.push(...place(line, cx, y));
    y += line.height + LINE_GAP;
  }

  const title = SHARE_ART_SIZES.title;
  items.push({
    art: 'title',
    x: Math.round(cx - title.width / 2),
    y: TITLE_Y,
    w: title.width,
    h: title.height,
    uv: FULL,
    tint: PLAIN,
  });

  return items;
}
