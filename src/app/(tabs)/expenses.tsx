import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';

import { ExpenseRow } from '@/components/expense-row';
import { IconButton } from '@/components/icon-button';
import { QuickAdd } from '@/components/quick-add';
import { EmptyNote, Screen, SectionTitle } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { useStore } from '@/hooks/use-store';
import { useTheme } from '@/hooks/use-theme';
import { endOfMonth, formatMoney, formatMonth, formatWhen, startOfDay, startOfMonth } from '@/services/format';
import { categoryInfo, type Expense } from '@/services/store/types';

export default function ExpensesScreen() {
  const theme = useTheme();
  const { expenses, defaultCurrency } = useStore();
  const now = useNow();
  const [monthStart, setMonthStart] = useState(() => startOfMonth(Date.now()));

  const shiftMonth = (delta: number) => {
    const date = new Date(monthStart);
    date.setMonth(date.getMonth() + delta, 1);
    setMonthStart(startOfMonth(date.getTime()));
  };

  const { sections, total, byCategory } = useMemo(() => {
    const monthEnd = endOfMonth(monthStart);
    const inMonth = expenses.filter((expense) => expense.spentAt >= monthStart && expense.spentAt <= monthEnd);

    const dayGroups = new Map<number, Expense[]>();
    for (const expense of inMonth) {
      const day = startOfDay(expense.spentAt);
      dayGroups.set(day, [...(dayGroups.get(day) ?? []), expense]);
    }
    const sections = [...dayGroups.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([day, data]) => ({
        title: formatWhen(day),
        subtotal: data.filter((e) => e.currency === defaultCurrency).reduce((sum, e) => sum + e.amount, 0),
        data,
      }));

    const inDefault = inMonth.filter((expense) => expense.currency === defaultCurrency);
    const total = inDefault.reduce((sum, expense) => sum + expense.amount, 0);
    const categoryTotals = new Map<Expense['category'], number>();
    for (const expense of inDefault) {
      categoryTotals.set(expense.category, (categoryTotals.get(expense.category) ?? 0) + expense.amount);
    }
    const byCategory = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { sections, total, byCategory };
  }, [expenses, monthStart, defaultCurrency]);

  const isCurrentMonth = monthStart === startOfMonth(now);

  return (
    <Screen
      title="Expenses"
      subtitle={`${formatMoney(total, defaultCurrency)} ${isCurrentMonth ? 'this month' : `in ${formatMonth(monthStart)}`}`}
      action={<IconButton ios="plus" material="add" label="New expense" primary onPress={() => router.push({ pathname: '/expense/[id]', params: { id: 'new' } })} />}>
      <SectionList
        sections={sections}
        keyExtractor={(expense) => expense.id}
        renderItem={({ item }) => <ExpenseRow expense={item} hideDate />}
        renderSectionHeader={({ section }) => (
          <SectionTitle
            trailing={
              <ThemedText type="small" themeColor="textSecondary">
                {formatMoney(section.subtotal, defaultCurrency)}
              </ThemedText>
            }>
            {section.title}
          </SectionTitle>
        )}
        ListHeaderComponent={
          <View>
            <QuickAdd
              placeholder="Log an expense… e.g. 250 lunch"
              accept={['add_expense', 'expense_summary']}
              fallback="expense"
            />
            <View style={styles.monthRow}>
              <IconButton ios="chevron.left" material="chevron_left" label="Previous month" onPress={() => shiftMonth(-1)} size={32} />
              <ThemedText type="smallBold">{formatMonth(monthStart)}</ThemedText>
              <IconButton
                ios="chevron.right"
                material="chevron_right"
                label="Next month"
                onPress={() => shiftMonth(1)}
                size={32}
                disabled={isCurrentMonth}
              />
            </View>
            {byCategory.length > 0 ? (
              <View style={[styles.breakdown, { backgroundColor: theme.backgroundElement }]}>
                {byCategory.map(([category, amount]) => (
                  <View key={category} style={styles.barRow}>
                    <View style={styles.barLabel}>
                      <ThemedText type="small" numberOfLines={1}>
                        {categoryInfo(category).label}
                      </ThemedText>
                      <ThemedText type="smallBold">{formatMoney(amount, defaultCurrency)}</ThemedText>
                    </View>
                    <View style={[styles.barTrack, { backgroundColor: theme.backgroundSelected }]}>
                      <View
                        style={[
                          styles.barFill,
                          { backgroundColor: theme.accent, width: `${Math.max(4, Math.round((amount / total) * 100))}%` },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={<EmptyNote>{'No expenses in this month. Try "250 lunch" above or tap +.'}</EmptyNote>}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  breakdown: {
    marginHorizontal: Spacing.three,
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    gap: Spacing.two + Spacing.half,
  },
  barRow: {
    gap: Spacing.one,
  },
  barLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  list: {
    paddingBottom: Spacing.six,
  },
});
