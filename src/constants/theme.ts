/**
 * Design tokens shared by every screen. Colours come in a light and a dark set;
 * `useTheme()` picks the right one for the current colour scheme.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0F1115',
    textSecondary: '#5B6270',
    textOnAccent: '#FFFFFF',
    background: '#FFFFFF',
    backgroundElement: '#F2F3F6',
    backgroundSelected: '#E3E5EA',
    border: '#E1E3E8',
    accent: '#2F6BFF',
    accentSoft: '#E6EDFF',
    userBubble: '#2F6BFF',
    assistantBubble: '#F2F3F6',
    danger: '#D14343',
    success: '#1E9E5A',
  },
  dark: {
    text: '#F3F4F6',
    textSecondary: '#A3A9B5',
    textOnAccent: '#FFFFFF',
    background: '#0B0C0F',
    backgroundElement: '#17191E',
    backgroundSelected: '#23262D',
    border: '#262932',
    accent: '#5B8CFF',
    accentSoft: '#15213F',
    userBubble: '#2F5FD6',
    assistantBubble: '#17191E',
    danger: '#F07171',
    success: '#3BC27A',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  small: 8,
  medium: 14,
  large: 22,
  pill: 999,
} as const;

export const MaxContentWidth = 800;
