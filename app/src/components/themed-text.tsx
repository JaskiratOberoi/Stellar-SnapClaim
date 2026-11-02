import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'medium' | 'semibold' | 'small' | 'smallSemi' | 'caption' | 'label' | 'display' | 'displayLarge' | 'serif' | 'serifSmall' | 'serifItalic' | 'figure' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  return <Text style={[{ color: theme[themeColor ?? 'text'], fontFamily: Fonts.sans }, styles[type], style]} {...rest} />;
}

const styles = StyleSheet.create({
  default: { fontSize: 16, lineHeight: 24, fontWeight: 400 },
  medium: { fontSize: 16, lineHeight: 24, fontWeight: 500 },
  semibold: { fontSize: 16, lineHeight: 24, fontWeight: 600 },
  small: { fontSize: 14, lineHeight: 20, fontWeight: 400 },
  smallSemi: { fontSize: 14, lineHeight: 20, fontWeight: 600 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: 400 },
  /** A field or section label: small sans, set in the muted colour by the caller. */
  label: { fontSize: 14, lineHeight: 20, fontWeight: 500 },
  /** Page titles. */
  display: { fontFamily: Fonts.serif, fontSize: 38, lineHeight: 42, letterSpacing: -0.6 },
  /** The greeting. */
  displayLarge: { fontFamily: Fonts.serif, fontSize: 48, lineHeight: 52, letterSpacing: -0.7 },
  /** Section headings and card titles. */
  serif: { fontFamily: Fonts.serif, fontSize: 26, lineHeight: 30, letterSpacing: -0.3 },
  serifSmall: { fontFamily: Fonts.serif, fontSize: 20, lineHeight: 24 },
  serifItalic: { fontFamily: Fonts.serifItalic, fontSize: 18, lineHeight: 24 },
  /** The one big number on a card. */
  figure: { fontFamily: Fonts.serif, fontSize: 52, lineHeight: 56, letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  code: { fontFamily: Fonts.mono, fontSize: 12 },
});
