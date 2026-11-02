import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Tap } from '@/motion/tap';

type Props = { label: string; selected?: boolean; onPress?: () => void; tone?: 'default' | 'danger' | 'warning' | 'success' };

export function Chip({ label, selected, onPress, tone = 'default' }: Props) {
  const theme = useTheme();
  const soft = { default: theme.backgroundElement, danger: theme.dangerSoft, warning: theme.warningSoft, success: theme.successSoft }[tone];
  const strong = { default: theme.accent, danger: theme.danger, warning: theme.warning, success: theme.success }[tone];
  const textColor = selected ? theme.textOnAccent : tone === 'default' ? theme.text : strong;
  return (
    <Tap
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ selected }}
      disabled={!onPress}
      onPress={onPress}
      scale={0.94}
      style={({ pressed }) => [styles.chip, { backgroundColor: selected ? strong : pressed ? theme.backgroundSelected : soft }]}>
      <ThemedText type="small" style={{ color: textColor, fontWeight: 600 }} numberOfLines={1}>
        {label}
      </ThemedText>
    </Tap>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: Spacing.three, minHeight: 36, justifyContent: 'center', borderRadius: Radius.pill },
});
