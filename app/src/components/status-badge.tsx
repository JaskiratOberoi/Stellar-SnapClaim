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
      <View style={[styles.dot, { backgroundColor: fg }]} />
      <ThemedText type="small" style={{ color: fg, fontWeight: 700, fontSize: 12, lineHeight: 16 }}>
        {STATUS_LABEL[status]}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + Spacing.half,
    paddingLeft: Spacing.two,
    paddingRight: Spacing.two + Spacing.half,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
