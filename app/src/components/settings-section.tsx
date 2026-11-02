import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { PhoneWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = { title: string; description?: string; children: ReactNode; first?: boolean };

/**
 * A settings section after the reference: a serif title and a muted line on the
 * left, the fields on the right, a hairline above. On phones the two stack.
 */
export function SettingsSection({ title, description, children, first }: Props) {
  const theme = useTheme();
  const wide = useWindowDimensions().width >= PhoneWidth;
  return (
    <View style={[styles.section, { borderTopColor: theme.border, borderTopWidth: first ? 0 : 1 }, wide && styles.sectionWide]}>
      <View style={[styles.aside, wide && styles.asideWide]}>
        <ThemedText type="serif">{title}</ThemedText>
        {description ? (
          <ThemedText type="small" themeColor="textMuted">
            {description}
          </ThemedText>
        ) : null}
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

/** One fact in a settings section: a muted label and its value. */
export function Fact({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.fact, { borderBottomColor: theme.border }]}>
      <ThemedText type="small" themeColor="textMuted" style={styles.factLabel}>
        {label}
      </ThemedText>
      <ThemedText type="small" style={styles.factValue}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginHorizontal: Spacing.three, paddingVertical: Spacing.four + Spacing.one, gap: Spacing.three },
  sectionWide: { flexDirection: 'row', gap: Spacing.five },
  aside: { gap: Spacing.one + Spacing.half },
  asideWide: { width: 200, paddingTop: Spacing.half },
  body: { flex: 1, gap: Spacing.three },
  fact: { flexDirection: 'row', gap: Spacing.three, paddingVertical: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth },
  factLabel: { width: 130 },
  factValue: { flex: 1 },
});
