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
  emoji: string;
  /** One-line rules, kid-readable, shown under the mode picker. */
  rules: string;
}

export const MODES: Record<ModeId, ModeDef> = {
  classic: {
    // The id stays 'classic' on purpose: it is the key saved progress and
    // per-mode win counts are stored under. Only the shown name changed.
    id: 'classic',
    name: 'Color Rush',
    emoji: '⚔️',
    rules: 'Match a color to rescue that prisoner. First to all six wins!',
  },
  ultimate: {
    id: 'ultimate',
    name: 'Ultimate',
    emoji: '🔁',
    rules: 'Careful! Matching a rescued color sends that prisoner BACK to jail!',
  },
  skirmish: {
    id: 'skirmish',
    name: 'Skirmish',
    emoji: '🤼',
    rules: 'ONE shared jail! Grab prisoners before your opponent — most wins!',
  },
  colorwar: {
    id: 'colorwar',
    name: 'Color War',
    emoji: '🎯',
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
