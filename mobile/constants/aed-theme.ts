/**
 * GdzieAED tokens – same system as the web app (frontend/src/index.css), Swiss / International style:
 * white surface, black typography, medical red as the single action colour, navy only for information,
 * green only for "available / 24/7". Pill-shaped buttons, softly rounded panels.
 */
export const AED = {
  red: '#C8102E',
  redDark: '#A00D25',
  redTint: '#FDECEE',
  navy: '#0B3D91',
  navyTint: '#E8EEF9',
  green: '#0F7B3F',
  greenTint: '#E7F5EC',
  ink: '#0B0B0C',
  muted: '#555A63',
  line: '#E2E3E6',
  surface: '#FFFFFF',
  background: '#F4F4F2',
  /** panels, cards, map */
  radius: 16,
  /** buttons, badges */
  pill: 999,
  /** minimum touch target (WCAG 2.5.5 / Apple HIG) */
  touch: 48,
} as const;

/** Typography scale (system font = SF Pro on iOS, the closest Swiss grotesk available natively). */
export const TYPE = {
  display: { fontSize: 34, fontWeight: '900', letterSpacing: -1.2, lineHeight: 34 },
  title: { fontSize: 24, fontWeight: '900', letterSpacing: -0.8, lineHeight: 26 },
  figure: { fontSize: 40, fontWeight: '900', letterSpacing: -1.6, lineHeight: 40 },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6, textTransform: 'uppercase' },
  body: { fontSize: 15, lineHeight: 21 },
} as const;
