import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { StatusBadge } from '@/components/status-badge';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Reveal } from '@/motion/reveal';
import { Tap } from '@/motion/tap';
import { webTransition } from '@/motion/transition';
import { formatDate, formatMoney } from '@/services/format';
import type { Claim } from '@/services/types';

type Props = {
  claim: Claim;
  showEmployee?: boolean;
  /** Inside a group of the same status the badge is noise; hide it. */
  showStatus?: boolean;
  selected?: boolean;
  onToggleSelect?: (claim: Claim) => void;
  index?: number;
  /** The last row in a card drops its hairline. */
  last?: boolean;
};

/** One claim as a row inside a card: title and meta on the left, the amount in serif on the right, a hairline underneath. */
export function ClaimRow({ claim, showEmployee, showStatus = true, selected, onToggleSelect, index = 0, last }: Props) {
  const theme = useTheme();
  const flagged = claim.policy_flags.length > 0;
  const meta = [showEmployee ? claim.employee.full_name : null, formatDate(claim.spent_on), claim.category?.name ?? 'Uncategorised', claim.vendor, claim.receipt_count === 0 ? 'No receipt' : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <Reveal delay={Math.min(index, 8) * 30} y={6}>
      <Tap
        accessibilityRole="button"
        accessibilityLabel={`Claim ${claim.claim_no}, ${claim.title}`}
        onPress={() => router.push({ pathname: '/claim/[id]', params: { id: claim.id } })}
        scale={0.99}
        style={({ pressed }) => [styles.row, { backgroundColor: pressed || selected ? theme.backgroundElement : 'transparent', borderBottomColor: theme.border, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }]}>
        {onToggleSelect ? (
          <Tap
            accessibilityRole="checkbox"
            accessibilityState={{ checked: !!selected }}
            hitSlop={10}
            scale={0.8}
            onPress={() => onToggleSelect(claim)}
            style={[styles.checkbox, { borderColor: selected ? theme.accent : theme.textMuted, backgroundColor: selected ? theme.accent : 'transparent' }, webTransition('background-color, border-color')]}>
            {selected ? <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={14} tintColor="#FFFFFF" /> : null}
          </Tap>
        ) : null}
        <View style={styles.main}>
          <ThemedText type="medium" numberOfLines={1}>
            {claim.title}
          </ThemedText>
          <ThemedText type="small" themeColor="textMuted" numberOfLines={1}>
            {meta}
          </ThemedText>
          {flagged ? (
            <View style={styles.flag}>
              <SymbolView name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }} size={13} tintColor={theme.warning} />
              <ThemedText type="caption" style={{ color: theme.warning, fontWeight: 600, flexShrink: 1 }} numberOfLines={1}>
                {claim.policy_flags.length === 1 ? claim.policy_flags[0].message : `${claim.policy_flags.length} policy flags`}
              </ThemedText>
            </View>
          ) : null}
        </View>
        <View style={styles.side}>
          <ThemedText style={styles.amount} numberOfLines={1}>
            {formatMoney(claim.amount, claim.currency)}
          </ThemedText>
          {showStatus ? (
            <StatusBadge status={claim.status} />
          ) : (
            <ThemedText type="caption" themeColor="textMuted">
              #{claim.claim_no}
            </ThemedText>
          )}
        </View>
      </Tap>
    </Reveal>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
    paddingHorizontal: Spacing.three,
  },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  main: { flex: 1, gap: 2 },
  flag: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, paddingTop: 2 },
  side: { alignItems: 'flex-end', gap: Spacing.one },
  amount: { fontFamily: Fonts.serif, fontSize: 22, lineHeight: 28, fontVariant: ['tabular-nums'] },
});
