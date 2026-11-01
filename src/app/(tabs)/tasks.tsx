import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, SectionList, StyleSheet, View } from 'react-native';

import { Chip } from '@/components/chip';
import { IconButton } from '@/components/icon-button';
import { QuickAdd } from '@/components/quick-add';
import { EmptyNote, Screen, SectionTitle } from '@/components/screen';
import { TaskRow } from '@/components/task-row';
import { Spacing } from '@/constants/theme';
import { useStore } from '@/hooks/use-store';
import { tasksInScope } from '@/services/assistant/actions';
import { endOfDay, startOfDay } from '@/services/format';
import type { Task } from '@/services/store/types';

type Scope = 'open' | 'today' | 'reminders' | 'done';

const SCOPES: { value: Scope; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'today', label: 'Today' },
  { value: 'reminders', label: 'Reminders' },
  { value: 'done', label: 'Done' },
];

function groupOpen(tasks: Task[]): { title: string; data: Task[] }[] {
  const now = Date.now();
  const groups = { Overdue: [] as Task[], Today: [] as Task[], Upcoming: [] as Task[], 'No date': [] as Task[] };
  for (const task of tasks) {
    const when = task.dueAt ?? task.remindAt;
    if (when === undefined) groups['No date'].push(task);
    else if (when < startOfDay(now)) groups.Overdue.push(task);
    else if (when <= endOfDay(now)) groups.Today.push(task);
    else groups.Upcoming.push(task);
  }
  return Object.entries(groups)
    .filter(([, data]) => data.length > 0)
    .map(([title, data]) => ({ title, data }));
}

export default function TasksScreen() {
  const { tasks, toggleTask } = useStore();
  const [scope, setScope] = useState<Scope>('open');

  const sections = useMemo(() => {
    const inScope = tasksInScope(tasks, scope);
    if (scope === 'open') return groupOpen(inScope);
    return inScope.length ? [{ title: SCOPES.find((item) => item.value === scope)?.label ?? '', data: inScope }] : [];
  }, [tasks, scope]);

  const openCount = tasks.filter((task) => !task.done).length;

  return (
    <Screen
      title="Tasks"
      subtitle={openCount ? `${openCount} open` : 'All clear'}
      action={<IconButton ios="plus" material="add" label="New task" primary onPress={() => router.push({ pathname: '/task/[id]', params: { id: 'new' } })} />}>
      <QuickAdd
        placeholder="New task… e.g. buy milk tomorrow"
        accept={['add_task', 'complete_task', 'delete_task']}
        fallback="task"
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filters}>
        {SCOPES.map((item) => (
          <Chip key={item.value} label={item.label} selected={scope === item.value} onPress={() => setScope(item.value)} />
        ))}
      </ScrollView>
      <SectionList
        sections={sections}
        keyExtractor={(task) => task.id}
        renderItem={({ item }) => <TaskRow task={item} onToggle={(task) => void toggleTask(task.id)} />}
        renderSectionHeader={({ section }) => <SectionTitle>{section.title}</SectionTitle>}
        ListEmptyComponent={
          <EmptyNote>
            {scope === 'done'
              ? 'Nothing completed yet.'
              : scope === 'reminders'
                ? 'No upcoming reminders. Try "remind me to call Ravi tomorrow at 5pm".'
                : 'No tasks here. Add one above.'}
          </EmptyNote>
        }
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
      />
      <View />
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterScroll: {
    flexGrow: 0,
  },
  filters: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
  },
  list: {
    paddingBottom: Spacing.six,
  },
});
