import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { STATUS_LABEL } from '@/services/format';
import type { ClaimStatus } from '@/services/types';

export function StatusBadge({ status }: { status: ClaimStatus }) {
  const theme = useTheme();
  const [bg, fg] = {
    draft: [theme.backgroundSelected, theme.textSecondary],
    submitted: [theme.warningSoft, theme.warning],
    approved: [theme.accentSoft, theme.accent],
    rejected: [theme.dangerSoft, theme.danger],
    cleared: [theme.successSoft, theme.success],
  }[status];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <ThemedText type="small" style={{ color: fg, fontWeight: 700, fontSize: 12 }}>
        {STATUS_LABEL[status]}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.half, borderRadius: Radius.small, alignSelf: 'flex-start' },
});
