/** The Paper Ship Studio mark: a two-fold paper ship, from the design handoff. */
export function Logo({ size = 30 }: { size?: number }) {
  const height = Math.round((size * 110) / 120);
  return (
    <svg viewBox="0 0 120 110" width={size} height={height} aria-hidden="true">
      <polygon points="18,72 102,72 88,96 32,96" fill="#201e1d" />
      <polygon points="57,68 57,6 24,68" fill="#201e1d" />
      <polygon points="63,68 63,6 96,68" fill="#0088b0" />
    </svg>
  );
}

/** The greyed-out placeholder version, used for "more games coming" slots. */
export function LogoPlaceholder({ size = 24 }: { size?: number }) {
  const height = Math.round((size * 110) / 120);
  return (
    <svg viewBox="0 0 120 110" width={size} height={height} aria-hidden="true">
      <polygon points="18,72 102,72 88,96 32,96" fill="#c9c5c0" />
      <polygon points="57,68 57,6 24,68" fill="#c9c5c0" />
      <polygon points="63,68 63,6 96,68" fill="#c9c5c0" />
    </svg>
  );
}
