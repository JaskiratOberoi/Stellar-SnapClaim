import { router } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { StatusBadge } from '@/components/status-badge';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
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

const ICONS: Record<string, { ios: string; android: string }> = {
  travel: { ios: 'airplane', android: 'flight' },
  fuel: { ios: 'fuelpump.fill', android: 'local_gas_station' },
  meals: { ios: 'fork.knife', android: 'restaurant' },
  accommodation: { ios: 'bed.double.fill', android: 'hotel' },
  supplies: { ios: 'shippingbox.fill', android: 'inventory_2' },
  communication: { ios: 'phone.fill', android: 'call' },
  software: { ios: 'laptopcomputer', android: 'terminal' },
  client: { ios: 'person.2.fill', android: 'handshake' },
  other: { ios: 'doc.text.fill', android: 'receipt_long' },
};

function categoryIcon(code: string | undefined): SymbolViewProps['name'] {
  const icon = ICONS[code ?? 'other'] ?? ICONS.other;
  return { ios: icon.ios, android: icon.android, web: icon.android } as SymbolViewProps['name'];
}

/** One claim as a card: category mark, title and meta, the amount in serif, its status, a chevron. */
export function ClaimRow({ claim, showEmployee, selected, onToggleSelect, index = 0 }: Props) {
  const theme = useTheme();
  const flagged = claim.policy_flags.length > 0;
  const meta = [showEmployee ? claim.employee.full_name : null, formatDate(claim.spent_on), claim.category?.name ?? 'Uncategorised', claim.vendor, claim.receipt_count === 0 ? 'No receipt' : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <Reveal delay={Math.min(index, 8) * 35} y={10}>
      <Tap
        accessibilityRole="button"
        accessibilityLabel={`Claim ${claim.claim_no}, ${claim.title}`}
        onPress={() => router.push({ pathname: '/claim/[id]', params: { id: claim.id } })}
        scale={0.985}
        outerStyle={styles.outer}
        style={({ pressed }) => [styles.card, { backgroundColor: pressed || selected ? theme.backgroundSelected : theme.backgroundElement }]}>
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
        ) : (
          <View style={[styles.mark, { backgroundColor: theme.background }]}>
            <SymbolView name={categoryIcon(claim.category?.code)} size={18} tintColor={theme.accent} />
          </View>
        )}
        <View style={styles.main}>
          <ThemedText style={styles.title} numberOfLines={1}>
            {claim.title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {meta}
          </ThemedText>
          {flagged ? (
            <View style={styles.flag}>
              <SymbolView name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }} size={13} tintColor={theme.warning} />
              <ThemedText type="small" style={{ color: theme.warning, fontSize: 12, lineHeight: 16, fontWeight: 600, flexShrink: 1 }} numberOfLines={1}>
                {claim.policy_flags.length === 1 ? claim.policy_flags[0].message : `${claim.policy_flags.length} policy flags`}
              </ThemedText>
            </View>
          ) : null}
        </View>
        <View style={styles.side}>
          <ThemedText style={styles.amount} numberOfLines={1}>
            {formatMoney(claim.amount, claim.currency)}
          </ThemedText>
          <StatusBadge status={claim.status} />
        </View>
        <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={16} tintColor={theme.textSecondary} />
      </Tap>
    </Reveal>
  );
}

const styles = StyleSheet.create({
  outer: { marginHorizontal: Spacing.three, marginBottom: Spacing.two },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + Spacing.half,
    paddingVertical: Spacing.two + Spacing.half,
    paddingLeft: Spacing.two + Spacing.half,
    paddingRight: Spacing.two + Spacing.half,
    borderRadius: Radius.large,
  },
  mark: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginHorizontal: Spacing.two },
  main: { flex: 1, gap: 2 },
  title: { fontWeight: 600 },
  flag: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, paddingTop: 2 },
  side: { alignItems: 'flex-end', gap: Spacing.one },
  amount: { fontFamily: Fonts.serif, fontSize: 20, lineHeight: 24, fontVariant: ['tabular-nums'] },
});
