import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'small' | 'smallBold' | 'eyebrow' | 'display' | 'displayLarge' | 'serif' | 'serifItalic' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return <Text style={[{ color: theme[themeColor ?? 'text'] }, styles[type], style]} {...rest} />;
}

const styles = StyleSheet.create({
  default: { fontSize: 16, lineHeight: 24, fontWeight: 500 },
  small: { fontSize: 14, lineHeight: 20, fontWeight: 500 },
  smallBold: { fontSize: 14, lineHeight: 20, fontWeight: 600 },
  /** Tracked caps: the small label above a figure or a section. */
  eyebrow: { fontSize: 11, lineHeight: 16, fontWeight: 600, letterSpacing: 1.1, textTransform: 'uppercase' },
  /** Screen titles. */
  display: { fontFamily: Fonts.serif, fontSize: 30, lineHeight: 34, letterSpacing: -0.4 },
  /** The one big figure on a screen. */
  displayLarge: { fontFamily: Fonts.serif, fontSize: 44, lineHeight: 48, letterSpacing: -0.8 },
  serif: { fontFamily: Fonts.serif, fontSize: 22, lineHeight: 28 },
  serifItalic: { fontFamily: Fonts.serifItalic, fontSize: 18, lineHeight: 24 },
  code: { fontFamily: Fonts.mono, fontSize: 12 },
});
