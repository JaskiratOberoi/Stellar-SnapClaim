import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { ActivityIndicator, Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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
  const fg = { primary: theme.textOnAccent, secondary: theme.text, danger: theme.textOnAccent, ghost: theme.accent }[variant];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        { backgroundColor: bg, opacity: off ? 0.5 : pressed ? 0.85 : 1 },
        variant === 'ghost' && { paddingHorizontal: Spacing.two },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <SymbolView name={icon} size={16} tintColor={fg} /> : null}
          <ThemedText type={compact ? 'smallBold' : 'default'} style={{ color: fg, fontWeight: 600 }}>
            {title}
          </ThemedText>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    minHeight: 46,
    borderRadius: Radius.medium,
  },
  compact: { minHeight: 36, paddingHorizontal: Spacing.three, borderRadius: Radius.small },
});
