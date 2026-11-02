import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { StatusBadge } from '@/components/status-badge';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Reveal } from '@/motion/reveal';
import { Tap } from '@/motion/tap';
import { webTransition } from '@/motion/transition';
import { formatDate, formatMoney } from '@/services/format';
import type { Claim } from '@/services/types';

type Props = {
  claim: Claim;
  showEmployee?: boolean;
  selected?: boolean;
  onToggleSelect?: (claim: Claim) => void;
  /** Position in its list: rows arrive one after another, capped at eight steps. */
  index?: number;
};

export function ClaimRow({ claim, showEmployee, selected, onToggleSelect, index = 0 }: Props) {
  const theme = useTheme();
  const flagged = claim.policy_flags.length > 0;
  return (
    <Reveal delay={Math.min(index, 8) * 35} y={10}>
      <Tap
        accessibilityRole="button"
        accessibilityLabel={`Claim ${claim.claim_no}, ${claim.title}`}
        onPress={() => router.push({ pathname: '/claim/[id]', params: { id: claim.id } })}
        scale={0.985}
        outerStyle={styles.outer}
        style={({ pressed }) => [styles.row, { backgroundColor: pressed || selected ? theme.backgroundElement : 'transparent' }]}>
        {onToggleSelect ? (
          <Tap
            accessibilityRole="checkbox"
            accessibilityState={{ checked: !!selected }}
            hitSlop={10}
            scale={0.8}
            onPress={() => onToggleSelect(claim)}
            style={[
              styles.checkbox,
              { borderColor: selected ? theme.accent : theme.textSecondary, backgroundColor: selected ? theme.accent : 'transparent' },
              webTransition('background-color, border-color'),
            ]}>
            {selected ? <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={14} tintColor={theme.textOnAccent} /> : null}
          </Tap>
        ) : null}
        <View style={styles.main}>
          <View style={styles.titleLine}>
            <ThemedText style={styles.title} numberOfLines={1}>
              {claim.title}
            </ThemedText>
            <ThemedText style={styles.amount}>{formatMoney(claim.amount, claim.currency)}</ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {[showEmployee ? claim.employee.full_name : null, formatDate(claim.spent_on), claim.category?.name ?? 'Uncategorised', claim.vendor]
              .filter(Boolean)
              .join(' · ')}
          </ThemedText>
          <View style={styles.badges}>
            <StatusBadge status={claim.status} />
            {flagged ? (
              <View style={styles.flag}>
                <SymbolView name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }} size={13} tintColor={theme.warning} />
                <ThemedText type="small" style={{ color: theme.warning, fontSize: 12, lineHeight: 16, fontWeight: 600 }} numberOfLines={1}>
                  {claim.policy_flags.length === 1 ? claim.policy_flags[0].message : `${claim.policy_flags.length} policy flags`}
                </ThemedText>
              </View>
            ) : null}
            {claim.receipt_count === 0 ? (
              <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, lineHeight: 16 }}>
                No receipt
              </ThemedText>
            ) : null}
            <ThemedText type="small" themeColor="textSecondary" style={styles.number}>
              #{claim.claim_no}
            </ThemedText>
          </View>
        </View>
      </Tap>
    </Reveal>
  );
}

const styles = StyleSheet.create({
  outer: { marginHorizontal: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two + Spacing.half,
    borderRadius: Radius.medium,
  },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  main: { flex: 1, gap: Spacing.one },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  title: { flex: 1, fontWeight: 600 },
  amount: { fontWeight: 700, fontVariant: ['tabular-nums'] },
  badges: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap', paddingTop: Spacing.half },
  flag: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, flexShrink: 1 },
  number: { fontSize: 12, lineHeight: 16, marginLeft: 'auto' },
});
