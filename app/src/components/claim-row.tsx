import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { StatusBadge } from '@/components/status-badge';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatMoney } from '@/services/format';
import type { Claim } from '@/services/types';

type Props = {
  claim: Claim;
  showEmployee?: boolean;
  selected?: boolean;
  onToggleSelect?: (claim: Claim) => void;
};

export function ClaimRow({ claim, showEmployee, selected, onToggleSelect }: Props) {
  const theme = useTheme();
  const flagged = claim.policy_flags.length > 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Claim ${claim.claim_no}, ${claim.title}`}
      onPress={() => router.push({ pathname: '/claim/[id]', params: { id: claim.id } })}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.backgroundElement : 'transparent' }]}>
      {onToggleSelect ? (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: !!selected }}
          hitSlop={8}
          onPress={() => onToggleSelect(claim)}
          style={[styles.checkbox, { borderColor: selected ? theme.accent : theme.textSecondary, backgroundColor: selected ? theme.accent : 'transparent' }]}>
          {selected ? <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={14} tintColor={theme.textOnAccent} /> : null}
        </Pressable>
      ) : null}
      <View style={styles.main}>
        <View style={styles.titleLine}>
          <ThemedText style={styles.title} numberOfLines={1}>
            {claim.title}
          </ThemedText>
          <ThemedText style={styles.amount}>{formatMoney(claim.amount, claim.currency)}</ThemedText>
        </View>
        <View style={styles.metaLine}>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.meta}>
            {[showEmployee ? claim.employee.full_name : null, formatDate(claim.spent_on), claim.category?.name ?? 'Uncategorised', claim.vendor]
              .filter(Boolean)
              .join(' · ')}
          </ThemedText>
        </View>
        <View style={styles.badges}>
          <StatusBadge status={claim.status} />
          {flagged ? (
            <View style={styles.flag}>
              <SymbolView name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }} size={13} tintColor={theme.warning} />
              <ThemedText type="small" style={{ color: theme.warning, fontSize: 12, fontWeight: 600 }}>
                {claim.policy_flags.length === 1 ? claim.policy_flags[0].message : `${claim.policy_flags.length} policy flags`}
              </ThemedText>
            </View>
          ) : null}
          {claim.receipt_count === 0 ? (
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
              No receipt
            </ThemedText>
          ) : null}
        </View>
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.number}>
        #{claim.claim_no}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
    borderRadius: Radius.medium,
  },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  main: { flex: 1, gap: Spacing.one },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  title: { flex: 1, fontWeight: 600 },
  amount: { fontWeight: 700 },
  metaLine: { flexDirection: 'row' },
  meta: { flex: 1 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  flag: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, flexShrink: 1 },
  number: { fontSize: 12, marginTop: 2 },
});
