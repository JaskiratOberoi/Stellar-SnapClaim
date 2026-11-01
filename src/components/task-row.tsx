import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { formatWhen, startOfDay } from '@/services/format';
import type { Task } from '@/services/store/types';

type Props = {
  task: Task;
  onToggle: (task: Task) => void;
};

export function TaskRow({ task, onToggle }: Props) {
  const theme = useTheme();
  const now = useNow();
  const when = task.remindAt ?? task.dueAt;
  const overdue = !task.done && when !== undefined && when < startOfDay(now);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${task.title}${task.done ? ', completed' : ''}`}
      onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundElement }]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.done }}
        accessibilityLabel={task.done ? 'Mark as not done' : 'Mark as done'}
        hitSlop={8}
        onPress={() => onToggle(task)}
        style={[
          styles.checkbox,
          { borderColor: task.done ? theme.success : task.priority === 'high' ? theme.danger : theme.textSecondary },
          task.done && { backgroundColor: theme.success },
        ]}>
        {task.done ? (
          <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={14} tintColor={theme.textOnAccent} />
        ) : null}
      </Pressable>

      <View style={styles.text}>
        <ThemedText
          style={[task.done && { textDecorationLine: 'line-through', color: theme.textSecondary }]}
          numberOfLines={2}>
          {task.title}
        </ThemedText>
        {when !== undefined || task.priority !== 'normal' ? (
          <View style={styles.meta}>
            {task.remindAt !== undefined ? (
              <SymbolView
                name={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }}
                size={12}
                tintColor={overdue ? theme.danger : theme.textSecondary}
              />
            ) : null}
            {when !== undefined ? (
              <ThemedText type="small" style={{ color: overdue ? theme.danger : theme.textSecondary }}>
                {formatWhen(when)}
              </ThemedText>
            ) : null}
            {task.priority === 'high' ? (
              <ThemedText type="smallBold" style={{ color: theme.danger }}>
                High
              </ThemedText>
            ) : task.priority === 'low' ? (
              <ThemedText type="small" themeColor="textSecondary">
                Low
              </ThemedText>
            ) : null}
          </View>
        ) : null}
      </View>
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
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + Spacing.half,
  },
});
