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

/**
 * The pale version of a colour — what the retreat platforms are painted.
 *
 * David, 25 Sep 2026: "make the platforms the much lighter more pastel
 * colors from before."
 *
 * The platforms went from the arenas' own scenery colours to the exact
 * palette hexes on 20 Sep, so a freed prisoner walks onto its own
 * colour. That part is right and stays; the shade was not. Six fully
 * saturated squares at the bottom of the screen shouted over the
 * battlefield they sit on, and they competed with the FIGURES standing
 * on them, which are the same six colours and are the thing you are
 * meant to be looking at.
 *
 * "From before" is the six pastel beach towels the castle had — pale
 * pink, pale blue, pale green, pale gold, lavender, peach — which were
 * always, by eye, soft versions of these six. So this is not a revert:
 * it puts them back in that family while keeping each pad tied to the
 * colour it belongs to.
 *
 * HUE IS KEPT EXACTLY. Only lightness and saturation move, so the pale
 * pad is unmistakably the pale version of its prisoner rather than a
 * second colour that happens to look nearby.
 *
 * The numbers are measured from those towels, which sat at L 77–92% with
 * saturation mostly at the top of the scale. 84% lands in the middle of
 * that.
 *
 * THE SATURATION FLOOR NEVER FIRES for the six colours in the game
 * today — the least saturated is Green at 60%, comfortably above it —
 * and it is here anyway, as a property of this function rather than of
 * that palette. Lifting lightness alone turns a muted colour into a grey
 * smudge, and this is handed whatever colour a round is being played
 * with. A Color War drawn from a future palette, or a themed arena
 * asking for a pale version of its own stone, would find out the hard
 * way. `tests/game.test.ts` exercises it with a muted colour directly,
 * because running it over the current six proves nothing about it.
 *
 * SEPARATION IS WEAKER UP HERE and that is accepted rather than missed.
 * The palette is engineered for a minimum CIEDE2000 distance (see above)
 * and pale tints of it are closer together — pale gold and pale peach
 * especially. It is fine because a pad is a HINT and never the game
 * signal: a roll is read from the dice faces, which are untouched, and
 * the figure standing on the pad is the full colour. Nothing is ever
 * decided by telling two pads apart.
 */
export function pastelOf(hex: string): string {
  const parsed = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  // Anything else comes back untouched. These arrive from the prisoner
  // list today, but a tournament prize or a themed arena could one day
  // hand over a name or a short hex, and a pad that fails to draw is
  // worse than one in the wrong shade.
  if (!parsed) return hex;
  const n = parseInt(parsed[1], 16);
  const [h, s] = toHsl((n >> 16) & 255, (n >> 8) & 255, n & 255);
  return fromHsl(h, Math.max(s, 0.55), 0.84);
}

/** Hue (0–1), saturation, lightness. Lightness is thrown away by callers. */
function toHsl(r8: number, g8: number, b8: number): [number, number, number] {
  const r = r8 / 255;
  const g = g8 / 255;
  const b = b8 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r
      ? ((g - b) / d + (g < b ? 6 : 0)) / 6
      : max === g
        ? ((b - r) / d + 2) / 6
        : ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function fromHsl(h: number, s: number, l: number): string {
  const hue = (p: number, q: number, t0: number) => {
    const t = t0 < 0 ? t0 + 1 : t0 > 1 ? t0 - 1 : t0;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const to = (v: number) =>
    Math.round(Math.min(255, Math.max(0, v * 255)))
      .toString(16)
      .padStart(2, '0');
  return `#${to(hue(p, q, h + 1 / 3))}${to(hue(p, q, h))}${to(hue(p, q, h - 1 / 3))}`;
}
