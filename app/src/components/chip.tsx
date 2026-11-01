import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = { label: string; selected?: boolean; onPress?: () => void; tone?: 'default' | 'danger' | 'warning' | 'success' };

export function Chip({ label, selected, onPress, tone = 'default' }: Props) {
  const theme = useTheme();
  const soft = { default: theme.backgroundElement, danger: theme.dangerSoft, warning: theme.warningSoft, success: theme.successSoft }[tone];
  const strong = { default: theme.accent, danger: theme.danger, warning: theme.warning, success: theme.success }[tone];
  const textColor = selected ? theme.textOnAccent : tone === 'default' ? theme.text : strong;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ selected }}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, { backgroundColor: selected ? strong : soft, opacity: pressed ? 0.8 : 1 }]}>
      <ThemedText type="small" style={{ color: textColor, fontWeight: 600 }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one + Spacing.half, borderRadius: Radius.pill },
});
