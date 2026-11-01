import { Link, router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ExpenseRow } from '@/components/expense-row';
import { QuickAdd } from '@/components/quick-add';
import { EmptyNote, Screen, SectionTitle, SettingsAction } from '@/components/screen';
import { TaskRow } from '@/components/task-row';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { useSettings } from '@/hooks/use-settings';
import { useStore } from '@/hooks/use-store';
import { useTheme } from '@/hooks/use-theme';
import { tasksInScope } from '@/services/assistant/actions';
import { endOfMonth, formatMoney, formatShortDate, startOfMonth } from '@/services/format';

export default function TodayScreen() {
  const theme = useTheme();
  const { settings } = useSettings();
  const { tasks, expenses, toggleTask, defaultCurrency } = useStore();

  const now = useNow();
  const today = tasksInScope(tasks, 'today', now);
  const overdue = tasksInScope(tasks, 'overdue', now);
  const upcomingReminders = tasksInScope(tasks, 'reminders', now).filter(
    (task) => !today.includes(task),
  );
  const monthFrom = startOfMonth(now);
  const monthTo = endOfMonth(now);
  const monthTotal = expenses
    .filter((expense) => expense.spentAt >= monthFrom && expense.spentAt <= monthTo && expense.currency === defaultCurrency)
    .reduce((sum, expense) => sum + expense.amount, 0);
  const recent = expenses.slice(0, 3);

  const name = settings.userName.trim();
  const hour = new Date(now).getHours();
  const greeting = `Good ${hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'}${name ? `, ${name}` : ''}`;

  return (
    <Screen title={greeting} subtitle={formatShortDate(now)} action={<SettingsAction onPress={() => router.push('/settings')} />}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <QuickAdd placeholder="Add anything… e.g. call Ravi tomorrow 5pm, 250 lunch" fallback="task" />

        <View style={styles.tiles}>
          <Tile label="Due today" value={String(today.length)} />
          <Tile label="Overdue" value={String(overdue.length)} tone={overdue.length ? 'danger' : undefined} />
          <Tile label="Spent this month" value={formatMoney(monthTotal, defaultCurrency)} />
        </View>

        <SectionTitle trailing={<Link href="/tasks" style={{ color: theme.accent }}>All tasks</Link>}>
          Today
        </SectionTitle>
        {today.length === 0 ? (
          <EmptyNote>Nothing due today. Type a task above or ask the assistant.</EmptyNote>
        ) : (
          today.map((task) => <TaskRow key={task.id} task={task} onToggle={(item) => void toggleTask(item.id)} />)
        )}

        {overdue.length > 0 ? (
          <>
            <SectionTitle>Overdue</SectionTitle>
            {overdue.map((task) => (
              <TaskRow key={task.id} task={task} onToggle={(item) => void toggleTask(item.id)} />
            ))}
          </>
        ) : null}

        {upcomingReminders.length > 0 ? (
          <>
            <SectionTitle>Upcoming reminders</SectionTitle>
            {upcomingReminders.slice(0, 5).map((task) => (
              <TaskRow key={task.id} task={task} onToggle={(item) => void toggleTask(item.id)} />
            ))}
          </>
        ) : null}

        <SectionTitle trailing={<Link href="/expenses" style={{ color: theme.accent }}>All expenses</Link>}>
          Recent expenses
        </SectionTitle>
        {recent.length === 0 ? (
          <EmptyNote>{'No expenses yet. Try "250 lunch" above.'}</EmptyNote>
        ) : (
          recent.map((expense) => <ExpenseRow key={expense.id} expense={expense} />)
        )}
      </ScrollView>
    </Screen>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: 'danger' }) {
  const theme = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        {label}
      </ThemedText>
      <ThemedText style={[styles.tileValue, tone === 'danger' && { color: theme.danger }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: Spacing.six,
  },
  tiles: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  tile: {
    flex: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
    gap: Spacing.half,
  },
  tileValue: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: 700,
  },
});
