/**
 * Paper Ship Studio marketing-site design tokens — from the Claude Design
 * handoff (design_handoff_marketing_site/README.md). Kept in one place so
 * the six site pages never scatter their own copies of these hex values.
 */
export const colors = {
  ink: '#201e1d',
  body: '#4a4744',
  secondary: '#6b6763',
  secondary2: '#79756f',
  muted: '#a6a29d',
  hairline: '#ece9e5',
  placeholderIcon: '#c9c5c0',

  cyan: '#0088b0',
  cyanGradientEnd: '#00a3cf',
  cyanTint: '#eef8fb',

  orange: '#e0503f',
  orangeDeep: '#c8412f',
  orangeTint: '#fdeeec',

  yellow: '#f2c53d',
  yellowTint: '#fbf4e4',
  yellowDeepText: '#8a6d1f',
  yellowDeepText2: '#a67c1f',

  cream: '#fef6ee',
  offWhite: '#f7f5f2',
  fieldBorder: '#ddd8d1',
  white: '#ffffff',
} as const;

export const heroGradient = `linear-gradient(120deg, ${colors.cyan} 0%, ${colors.cyanGradientEnd} 100%)`;

export const fonts = {
  heading: 'var(--font-baloo), system-ui, sans-serif',
  body: 'var(--font-nunito), system-ui, sans-serif',
} as const;
