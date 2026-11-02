import '@/global.css';

import { Platform } from 'react-native';

/**
 * One light world: cream ground, beige surfaces, plum as the only strong colour,
 * a high-contrast serif for display and a quiet sans for everything else.
 */
export const Palette = {
  text: '#2E2226',
  textSecondary: '#8A7B78',
  textOnAccent: '#FBF7F3',
  background: '#F8F4EF',
  backgroundElement: '#EFE6DE',
  backgroundSelected: '#E6D9CF',
  field: '#F3ECE5',
  border: '#E6DCD3',
  accent: '#4A3339',
  accentStrong: '#3A272C',
  accentSoft: '#EADCD8',
  success: '#4F7A5C',
  successSoft: '#E3EEE4',
  warning: '#A8672E',
  warningSoft: '#F6E7D6',
  danger: '#B4483C',
  dangerSoft: '#F6DFDA',
  shadow: '#3B2A2F',
  scrim: 'rgba(46, 34, 38, 0.42)',
} as const;

export const Colors = { light: Palette, dark: Palette } as const;

export type ThemeColor = keyof typeof Palette;

/** Instrument Serif is loaded at startup on every platform (see app/_layout.tsx). */
export const Fonts = {
  sans: Platform.select({ ios: 'system-ui', web: 'var(--font-sans)', default: 'normal' }),
  serif: 'InstrumentSerif_400Regular',
  serifItalic: 'InstrumentSerif_400Regular_Italic',
  mono: Platform.select({ ios: 'ui-monospace', web: 'var(--font-mono)', default: 'monospace' }),
} as const;

export const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;
export const Radius = { small: 12, medium: 20, large: 28, pill: 999 } as const;

/** One easing and three durations, shared by GSAP on web and Reanimated on phones. */
export const Motion = {
  ease: 'cubic-bezier(0.16, 1, 0.3, 1)',
  fast: 120,
  base: 220,
  slow: 420,
} as const;

export const MaxContentWidth = 860;
/** Below this width the app is a phone: sheets slide up full-height, tiles stack two across. */
export const PhoneWidth = 720;
