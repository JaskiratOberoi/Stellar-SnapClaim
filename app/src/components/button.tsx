import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { ActivityIndicator, StyleSheet, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Tap } from '@/motion/tap';

type Props = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  icon?: SymbolViewProps['name'];
  style?: ViewStyle;
  compact?: boolean;
};

export function Button({ title, onPress, variant = 'primary', loading, disabled, icon, style, compact }: Props) {
  const theme = useTheme();
  const bg = { primary: theme.accent, secondary: theme.backgroundElement, danger: theme.danger, ghost: 'transparent' }[variant];
  const bgPressed = { primary: theme.accentStrong, secondary: theme.backgroundSelected, danger: theme.danger, ghost: theme.backgroundElement }[variant];
  const fg = { primary: theme.textOnAccent, secondary: theme.text, danger: theme.textOnAccent, ghost: theme.accent }[variant];
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
        { backgroundColor: pressed ? bgPressed : bg, opacity: disabled && !loading ? 0.45 : 1 },
        variant === 'ghost' && { paddingHorizontal: Spacing.two },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <SymbolView name={icon} size={compact ? 15 : 17} tintColor={fg} /> : null}
          <ThemedText type={compact ? 'smallBold' : 'default'} style={{ color: fg, fontWeight: 700 }} numberOfLines={1}>
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
    paddingHorizontal: Spacing.four,
    minHeight: 48,
    borderRadius: Radius.medium,
  },
  compact: { minHeight: 38, paddingHorizontal: Spacing.three, borderRadius: Radius.small },
});
