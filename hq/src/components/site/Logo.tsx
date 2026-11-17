/**
 * The Paper Ship Studio mark, from the design handoff (logo-assets/2e-*).
 *
 * Two sails of different heights — a short one forward, the tall main
 * sail behind it in the studio's cyan. The earlier version drew both
 * sails the same height, which read as a paper hat more than a ship.
 *
 * Three variants, because a one-colour mark breaks in two places: on a
 * dark ground the near-black hull disappears, and anywhere colour is not
 * available (a stamp, a single-colour print, a system that strips fills)
 * the cyan sail vanishes with it.
 *
 * - `full`     — the default, for light backgrounds
 * - `reversed` — for dark backgrounds; the hull goes near-white
 * - `mono`     — one colour throughout
 */
export type LogoVariant = 'full' | 'reversed' | 'mono';

const INK = '#201e1d';
const PAPER = '#f3f2f2';
const SAIL = '#0088b0';

function paletteFor(variant: LogoVariant): { hull: string; sail: string } {
  if (variant === 'reversed') return { hull: PAPER, sail: SAIL };
  if (variant === 'mono') return { hull: INK, sail: INK };
  return { hull: INK, sail: SAIL };
}

export function Logo({
  size = 30,
  variant = 'full',
  title,
}: {
  size?: number;
  variant?: LogoVariant;
  /** Give it a title only where it is the sole thing naming the studio. */
  title?: string;
}) {
  const { hull, sail } = paletteFor(variant);
  // The artwork is 120 × 100.
  const height = Math.round((size * 100) / 120);

  return (
    <svg
      viewBox="0 0 120 100"
      width={size}
      height={height}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title && <title>{title}</title>}
      <polygon points="8,62 112,62 96,88 24,88" fill={hull} />
      <polygon points="56,58 56,22 22,58" fill={hull} />
      <polygon points="64,58 64,6 102,58" fill={sail} />
    </svg>
  );
}
