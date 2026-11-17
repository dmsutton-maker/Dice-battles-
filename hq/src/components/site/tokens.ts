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
  /*
    Darkened 7 Sep 2026 from #a6a29d, which sat at 2.3-2.5:1 on white —
    the contact form's small print and the "Last updated" line were the
    two worst-measured pieces of text on the site. #767370 is 4.71:1 and
    still reads as quiet.
  */
  muted: '#767370',
  hairline: '#ece9e5',
  placeholderIcon: '#c9c5c0',

  /*
    THE BRAND COLOURS, and their text-safe siblings.

    `cyan` and `orange` are the studio's colours and stay exactly as they
    are for fills, gradients and anything big. At body size on white they
    measure 4.08:1 and 3.90:1 — both under WCAG AA's 4.5:1 — and this
    site's stated audience includes grandparents reading FAQ links and
    small-caps section labels. So every piece of TEXT uses `cyanText` or
    `orangeText`, which are the same hues a few steps deeper and clear AA
    on white (5.59:1, 6.00:1) and on their own tints (5.18:1, 5.32:1).

    Rule of thumb: a colour you READ is the Text one; a colour you look
    at is the plain one.
  */
  cyan: '#0088b0',
  cyanText: '#00718f',
  cyanGradientEnd: '#00a3cf',
  cyanTint: '#eef8fb',

  orange: '#e0503f',
  orangeText: '#b53523',
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
