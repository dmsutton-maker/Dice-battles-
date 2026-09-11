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

/**
 * Palette engineered for separation (multi-agent audit, CIEDE2000-checked):
 * min pairwise distance 32.2 normal vision (was 23.5), 12.1 deuteranopia
 * (was 1.0 — old blue/purple were indistinguishable to colorblind players),
 * 12.7 protanopia. Separation comes from a lightness ladder as well as hue,
 * so the set survives color-vision deficiencies. Ages 5+, every color still
 * plainly reads as its name.
 */
export const PRISONER_COLORS: ColorDef[] = [
  { id: 'red', label: 'Red', hex: '#cc2533' },
  { id: 'blue', label: 'Blue', hex: '#043fe0' },
  { id: 'green', label: 'Green', hex: '#33cc6b' },
  { id: 'yellow', label: 'Yellow', hex: '#ffe521' },
  { id: 'purple', label: 'Purple', hex: '#cc79fc' },
  { id: 'orange', label: 'Orange', hex: '#fc8403' },
];

/** One entry per die face, indexed by BoxGeometry material-group order. */
export const DIE_FACE_COLORS: ColorDef[] = PRISONER_COLORS;
