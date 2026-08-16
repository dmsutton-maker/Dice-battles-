/**
 * The six prisoner colors. Dice faces are colors, not pips — this palette is
 * the heart of the game and is shared by dice, prisoners, and UI.
 *
 * Face order matches THREE.BoxGeometry material groups: +x, -x, +y, -y, +z, -z.
 */
export type PrisonerColorId =
  | 'red'
  | 'blue'
  | 'green'
  | 'yellow'
  | 'purple'
  | 'orange';

export interface ColorDef {
  id: PrisonerColorId;
  label: string;
  hex: string;
}

export const PRISONER_COLORS: ColorDef[] = [
  { id: 'red', label: 'Red', hex: '#ff4d4d' },
  { id: 'blue', label: 'Blue', hex: '#3d8bff' },
  { id: 'green', label: 'Green', hex: '#3ecf5a' },
  { id: 'yellow', label: 'Yellow', hex: '#ffd23d' },
  { id: 'purple', label: 'Purple', hex: '#a55eea' },
  { id: 'orange', label: 'Orange', hex: '#ff8c2e' },
];

/** One entry per die face, indexed by BoxGeometry material-group order. */
export const DIE_FACE_COLORS: ColorDef[] = PRISONER_COLORS;
