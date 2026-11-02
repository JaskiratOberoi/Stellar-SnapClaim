import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0B1220',
    textSecondary: '#5B6472',
    textOnAccent: '#FFFFFF',
    background: '#FFFFFF',
    backgroundElement: '#F3F5F9',
    backgroundSelected: '#E3E8F1',
    border: '#E1E6EE',
    accent: '#2F6BFF',
    accentStrong: '#1F56E0',
    accentSoft: '#E8EEFF',
    success: '#1B8F4E',
    successSoft: '#E3F5E9',
    warning: '#B45309',
    warningSoft: '#FFF4E0',
    danger: '#D93025',
    dangerSoft: '#FDE8E8',
    shadow: '#0B1220',
    scrim: 'rgba(11, 18, 32, 0.48)',
  },
  dark: {
    text: '#F3F5F9',
    textSecondary: '#A3ACBA',
    textOnAccent: '#FFFFFF',
    background: '#0B0F17',
    backgroundElement: '#151B26',
    backgroundSelected: '#222A38',
    border: '#273040',
    accent: '#5B8CFF',
    accentStrong: '#7AA2FF',
    accentSoft: '#1B2A4D',
    success: '#4CC47C',
    successSoft: '#13301F',
    warning: '#F3A74C',
    warningSoft: '#3A2A10',
    danger: '#FF6B61',
    dangerSoft: '#3D1715',
    shadow: '#000000',
    scrim: 'rgba(3, 6, 12, 0.64)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', serif: 'ui-serif', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', serif: 'serif', rounded: 'normal', mono: 'monospace' },
  web: { sans: 'var(--font-display)', serif: 'var(--font-serif)', rounded: 'var(--font-rounded)', mono: 'var(--font-mono)' },
});

export const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;
export const Radius = { small: 10, medium: 16, large: 22, pill: 999 } as const;

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
