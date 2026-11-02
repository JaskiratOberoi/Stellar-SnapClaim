import '@/global.css';

import { Platform } from 'react-native';

import type { ClaimStatus } from '@/services/types';

/**
 * One light world after the Nourish reference: a warm off-white ground, a
 * lighter surface for cards, a sunken tone for fields and the active nav item,
 * sage as the action colour, and a tinted family (base / ink / soft) for each
 * status and category so a card can carry its own colour.
 */
export const Palette = {
  text: '#242321',
  textSecondary: '#6B675F',
  textMuted: '#88847D',
  textOnAccent: '#F6F4EF',
  background: '#F6F4EF',
  surface: '#FBFAF7',
  surfaceRaised: '#FBFAF7',
  backgroundElement: '#EFECE5',
  backgroundSelected: '#E5E1D9',
  field: '#EFECE5',
  border: '#E5E1D9',
  accent: '#718B78',
  accentStrong: '#5C7563',
  accentSoft: '#E7ECE6',
  success: '#2E7A68',
  successSoft: '#DCEDE6',
  warning: '#8A5A06',
  warningSoft: '#FBEBC9',
  danger: '#A3564C',
  dangerSoft: '#F3E4E1',
  shadow: '#242321',
  scrim: 'rgba(36, 35, 33, 0.45)',
  track: 'rgba(36, 35, 33, 0.08)',
} as const;

export const Colors = { light: Palette, dark: Palette } as const;
export type ThemeColor = keyof typeof Palette;

export type Tone = { base: string; ink: string; soft: string };
export const Tones = {
  sage: { base: '#718B78', ink: '#5C7563', soft: '#E7ECE6' },
  amber: { base: '#E09A1F', ink: '#8A5A06', soft: '#FBEBC9' },
  green: { base: '#2E7A68', ink: '#1F5A4C', soft: '#DCEDE6' },
  indigo: { base: '#4A5592', ink: '#323C74', soft: '#E1E3F2' },
  pink: { base: '#D0607A', ink: '#9B3A52', soft: '#F8E0E5' },
  plum: { base: '#8E4E73', ink: '#6E3858', soft: '#F1E0EA' },
  blue: { base: '#3D84B8', ink: '#285F86', soft: '#DCEAF4' },
  orange: { base: '#E06A2C', ink: '#94401A', soft: '#FBE3D4' },
  tan: { base: '#C9A57F', ink: '#7A5A3A', soft: '#F1E6DA' },
} as const satisfies Record<string, Tone>;
export type ToneName = keyof typeof Tones;

export const StatusTone: Record<ClaimStatus, ToneName> = { draft: 'tan', submitted: 'amber', approved: 'indigo', cleared: 'green', rejected: 'pink' };
export const CategoryTone: Record<string, ToneName> = {
  travel: 'blue',
  fuel: 'orange',
  meals: 'amber',
  accommodation: 'indigo',
  supplies: 'tan',
  communication: 'green',
  software: 'plum',
  client: 'pink',
  other: 'sage',
};

/** Fraunces is loaded at startup on every platform (app/_layout.tsx); the sans is the platform's own, Instrument Sans on web. */
export const Fonts = {
  sans: Platform.select({ web: 'var(--font-sans)', default: undefined }),
  serif: 'Fraunces_400Regular',
  serifItalic: 'Fraunces_400Regular_Italic',
  mono: Platform.select({ ios: 'ui-monospace', web: 'var(--font-mono)', default: 'monospace' }),
} as const;

export const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;
export const Radius = { small: 12, medium: 20, large: 24, pill: 999 } as const;

/** One easing and three durations, shared by GSAP on web and Reanimated on phones. */
export const Motion = {
  ease: 'cubic-bezier(0.16, 1, 0.3, 1)',
  fast: 120,
  base: 220,
  slow: 420,
} as const;

export const MaxContentWidth = 900;
/** Below this width the app is a phone: sheets slide up full-height, cards stack. */
export const PhoneWidth = 720;
/** From this width the nav is a sidebar on the left. */
export const SidebarWidth = 960;
