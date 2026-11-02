import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, StatusTone, Tones } from '@/constants/theme';
import { STATUS_LABEL } from '@/services/format';
import type { ClaimStatus } from '@/services/types';

/** A small pill in the status's tone: soft fill, ink text, a dot in the base. */
export function StatusBadge({ status }: { status: ClaimStatus }) {
  const t = Tones[StatusTone[status]];
  return (
    <View style={[styles.badge, { backgroundColor: t.soft }]}>
      <View style={[styles.dot, { backgroundColor: t.base }]} />
      <ThemedText type="caption" style={{ color: t.ink, fontWeight: 600 }}>
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
