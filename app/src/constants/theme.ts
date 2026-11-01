import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0B1220',
    textSecondary: '#5B6472',
    textOnAccent: '#FFFFFF',
    background: '#FFFFFF',
    backgroundElement: '#F2F4F8',
    backgroundSelected: '#E2E7F0',
    border: '#DDE2EA',
    accent: '#2F6BFF',
    accentSoft: '#E6EDFF',
    success: '#1B8F4E',
    successSoft: '#E3F5E9',
    warning: '#B45309',
    warningSoft: '#FFF4E0',
    danger: '#D93025',
    dangerSoft: '#FDE8E8',
  },
  dark: {
    text: '#F3F5F9',
    textSecondary: '#A3ACBA',
    textOnAccent: '#FFFFFF',
    background: '#0B0F17',
    backgroundElement: '#161C27',
    backgroundSelected: '#232B39',
    border: '#2A3342',
    accent: '#5B8CFF',
    accentSoft: '#1B2A4D',
    success: '#4CC47C',
    successSoft: '#13301F',
    warning: '#F3A74C',
    warningSoft: '#3A2A10',
    danger: '#FF6B61',
    dangerSoft: '#3D1715',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', serif: 'ui-serif', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', serif: 'serif', rounded: 'normal', mono: 'monospace' },
  web: { sans: 'var(--font-display)', serif: 'var(--font-serif)', rounded: 'var(--font-rounded)', mono: 'var(--font-mono)' },
});

export const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;
export const Radius = { small: 8, medium: 14, large: 22, pill: 999 } as const;

export const MaxContentWidth = 860;
