import { ColorDef } from './colors';

/**
 * The game modes from the original tabletop rules (see the project brief).
 * All modes share the same dice physics and settle detection — they differ
 * only in what a color match DOES and how the race ends.
 */
export type ModeId = 'classic' | 'ultimate' | 'skirmish' | 'colorwar';

export interface ModeDef {
  id: ModeId;
  name: string;
  /** One-line rules, kid-readable, shown under the mode picker. */
  rules: string;
}

/*
  There is no `emoji` here any more.

  Every mode carried one — ⚔️ 🔁 🤼 🎯 — and David asked on 26 Aug 2026 for
  drawn icons instead. The field is deleted rather than left unused,
  because a string sitting on the mode definition is an invitation to
  render it again somewhere new, and then half the game has icons and
  half has emoji. The drawings live in src/ui/modeIcons.ts, which is a
  Record<ModeId, …> so a fifth mode cannot be added without one.
*/
export const MODES: Record<ModeId, ModeDef> = {
  classic: {
    // The id stays 'classic' on purpose: it is the key saved progress and
    // per-mode win counts are stored under. Only the shown name changed.
    id: 'classic',
    name: 'Color Rush',
    rules: 'Match a color to rescue that prisoner. First to all six wins!',
  },
  ultimate: {
    id: 'ultimate',
    name: 'Ultimate',
    rules: 'Careful! Matching a rescued color sends that prisoner BACK to jail!',
  },
  skirmish: {
    id: 'skirmish',
    name: 'Skirmish',
    rules: 'ONE shared jail! Grab prisoners before your opponent — most wins!',
  },
  colorwar: {
    id: 'colorwar',
    name: 'Color War',
    rules: 'You each get ONE color. Rescue your three first!',
  },
};

export const MODE_ORDER: ModeId[] = ['classic', 'ultimate', 'skirmish', 'colorwar'];

/** Where a prisoner figure currently stands. */
export interface Station {
  kind: 'jail' | 'retreat' | 'wall';
  index: number;
}

/** One prisoner figure on the board. */
export interface PrisonerUnit {
  key: string;
  colorId: ColorDef['id'];
  hex: string;
  /** Fixed home slot in the jail, for modes that send prisoners back. */
  jailIndex: number;
  station: Station;
}

/** Build the round-start prisoner lineup for a mode. */
export function makeUnits(
  mode: ModeId,
  allColors: ColorDef[],
  playerColor: ColorDef | null,
  aiColor: ColorDef | null,
): PrisonerUnit[] {
  if (mode === 'colorwar' && playerColor && aiColor) {
    // Your three fill the LEFT half of the jail, your opponent's the
    // right. They used to alternate, which made it hard to see at a
    // glance whose side was emptying — sides read faster than a pattern.
    const lineup = [
      playerColor,
      playerColor,
      playerColor,
      aiColor,
      aiColor,
      aiColor,
    ];
    return lineup.map((c, i) => ({
      key: `cw-${i}`,
      colorId: c.id,
      hex: c.hex,
      jailIndex: i,
      station: { kind: 'jail', index: i },
    }));
  }
  return allColors.map((c, i) => ({
    key: c.id,
    colorId: c.id,
    hex: c.hex,
    jailIndex: i,
    station: { kind: 'jail', index: i },
  }));
}

/**
 * EVERY PRISONER KEEPS ONE LANE FOR THE WHOLE ROUND, and that lane is
 * `jailIndex`.
 *
 * David, 20 Sep 2026: "in color war and ultimate make each prisoner when
 * you free them to go to the platform of their respective color" — and,
 * in the same breath, that the platforms should BE those colours.
 *
 * The two halves are one idea. Cell 0 of the jail, pad 0 of the retreat
 * and slot 0 of the battlement are all the same lane, running straight
 * down the board from the far wall to the player's side; both rows are
 * laid out left to right in index order, so a figure freed from the
 * leftmost cell walks straight down to the leftmost pad. Give the pad the
 * lane's colour (see `laneColors`) and a rescue lands on its own colour
 * in every mode, with nothing having to know which mode is being played:
 *
 * - Color Rush, Ultimate, Skirmish — six colours, six lanes, one each.
 * - Color War — your three fill lanes 0–2 and your opponent's 3–5
 *   (see `makeUnits`), so the left half of the row is your colour and the
 *   right half theirs, whichever two colours the round drew.
 *
 * THIS REPLACES `firstFreeIndex`, which handed out the lowest free slot.
 * That existed for AJ's bug report of 24 Aug 2026 — "the soldiers
 * sometimes in ultimate go to the same spot" — because placing by COUNT
 * put a rescue on an occupied pad once an exchange had left a hole in the
 * row. A fixed lane cannot collide either, and cannot for a stronger
 * reason: `makeUnits` gives every figure its own `jailIndex`, so no two
 * figures have the same slot to be sent to. Hole-filling was tidy;
 * lanes are tidy AND meaningful.
 */
export function laneOf(unit: PrisonerUnit): number {
  return unit.jailIndex;
}

/**
 * The colour of each lane, left to right — what the arenas paint the
 * retreat pads with.
 *
 * Read off the units rather than from the mode, so the pads cannot
 * disagree with where the figures are actually sent. A pad with no lane
 * (which should not happen: `makeUnits` always fills all six) comes back
 * as null, and the arena falls back to its own scenery colour.
 */
export function laneColors(units: PrisonerUnit[], lanes: number): (string | null)[] {
  const out: (string | null)[] = new Array(lanes).fill(null);
  for (const u of units) {
    const lane = laneOf(u);
    if (lane >= 0 && lane < lanes) out[lane] = u.hex;
  }
  return out;
}
