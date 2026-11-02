import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { ActivityIndicator, StyleSheet, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, Tones, type ToneName } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Tap } from '@/motion/tap';

type Props = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  /** Colour the primary pill after a tinted card it sits in. */
  tone?: ToneName;
  loading?: boolean;
  disabled?: boolean;
  icon?: SymbolViewProps['name'];
  style?: ViewStyle;
  compact?: boolean;
};

/** Pills, 40 high. Primary is sage (or the card's tone); secondary sits on the surface with a hairline; ghost is text. */
export function Button({ title, onPress, variant = 'primary', tone, loading, disabled, icon, style, compact }: Props) {
  const theme = useTheme();
  const base = tone ? Tones[tone].base : theme.accent;
  const strong = tone ? Tones[tone].ink : theme.accentStrong;
  const bg = { primary: base, secondary: theme.surface, danger: theme.danger, ghost: 'transparent' }[variant];
  const bgPressed = { primary: strong, secondary: theme.backgroundElement, danger: theme.danger, ghost: theme.backgroundElement }[variant];
  const fg = { primary: '#FFFFFF', secondary: theme.text, danger: '#FFFFFF', ghost: tone ? Tones[tone].ink : theme.text }[variant];
  const off = disabled || loading;
  return (
    <Tap
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: loading }}
      disabled={off}
      onPress={onPress}
      scale={0.96}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        variant === 'secondary' && { borderWidth: 1, borderColor: theme.border },
        { backgroundColor: pressed ? bgPressed : bg, opacity: disabled && !loading ? 0.45 : 1 },
        variant === 'ghost' && { paddingHorizontal: Spacing.two },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <SymbolView name={icon} size={16} tintColor={fg} /> : null}
          <ThemedText type="smallSemi" style={{ color: fg }} numberOfLines={1}>
            {title}
          </ThemedText>
        </>
      )}
    </Tap>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three + Spacing.one,
    minHeight: 44,
    borderRadius: Radius.pill,
  },
  compact: { minHeight: 36, paddingHorizontal: Spacing.three },
});
