import { router } from 'expo-router';
import { SymbolView, type SFSymbol, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney, formatWhen } from '@/services/format';
import { categoryInfo, type Expense } from '@/services/store/types';

type MaterialSymbol = NonNullable<Extract<SymbolViewProps['name'], object>['android']>;

type Props = {
  expense: Expense;
  /** Hide the date when the list is already grouped by day. */
  hideDate?: boolean;
};

export function ExpenseRow({ expense, hideDate }: Props) {
  const theme = useTheme();
  const category = categoryInfo(expense.category);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${formatMoney(expense.amount, expense.currency)} ${expense.note || category.label}`}
      onPress={() => router.push({ pathname: '/expense/[id]', params: { id: expense.id } })}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundElement }]}>
      <View style={[styles.icon, { backgroundColor: theme.accentSoft }]}>
        <SymbolView
          name={{
            ios: category.icon.ios as SFSymbol,
            android: category.icon.material as MaterialSymbol,
            web: category.icon.material as MaterialSymbol,
          }}
          size={18}
          tintColor={theme.accent}
        />
      </View>
      <View style={styles.text}>
        <ThemedText numberOfLines={1}>{expense.note || category.label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {expense.note ? category.label : ''}
          {expense.note && !hideDate ? ' · ' : ''}
          {hideDate ? '' : formatWhen(expense.spentAt)}
        </ThemedText>
      </View>
      <ThemedText type="smallBold" style={styles.amount}>
        {formatMoney(expense.amount, expense.currency)}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
    borderRadius: Radius.medium,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
  amount: {
    fontSize: 16,
  },
});
