import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { Chip } from '@/components/chip';
import { DateField } from '@/components/date-field';
import { ThemedText } from '@/components/themed-text';
import { Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useStore } from '@/hooks/use-store';
import { useTheme } from '@/hooks/use-theme';
import type { Priority } from '@/services/store/types';

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
];

export default function TaskScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tasks, addTask, updateTask, deleteTask } = useStore();
  const existing = id === 'new' ? undefined : tasks.find((task) => task.id === id);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [dueAt, setDueAt] = useState<number | undefined>(existing?.dueAt);
  const [remindAt, setRemindAt] = useState<number | undefined>(existing?.remindAt);
  const [priority, setPriority] = useState<Priority>(existing?.priority ?? 'normal');
  const [done, setDone] = useState(existing?.done ?? false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const canSave = title.trim().length > 0;

  const save = async () => {
    if (!canSave) return;
    if (existing) {
      await updateTask(existing.id, { title, notes, dueAt, remindAt, priority, done });
    } else {
      await addTask({ title, notes, dueAt, remindAt, priority });
    }
    router.back();
  };

  const remove = async () => {
    if (!existing) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await deleteTask(existing.id);
    router.back();
  };

  const inputStyle = [
    styles.input,
    { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border, fontFamily: Fonts.sans },
  ];

  return (
    <>
      <Stack.Screen options={{ title: existing ? 'Edit task' : 'New task' }} />
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <View style={styles.column}>
          <TextInput
            style={[inputStyle, styles.titleInput]}
            value={title}
            onChangeText={setTitle}
            placeholder="What needs doing?"
            placeholderTextColor={theme.textSecondary}
            autoFocus={!existing}
            returnKeyType="done"
            accessibilityLabel="Title"
          />

          <TextInput
            style={[inputStyle, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Notes (optional)"
            placeholderTextColor={theme.textSecondary}
            multiline
            accessibilityLabel="Notes"
          />

          <DateField label="Due" value={dueAt} onChange={setDueAt} />
          <DateField label="Reminder" value={remindAt} onChange={setRemindAt} withTime />

          <View style={styles.field}>
            <ThemedText type="small">Priority</ThemedText>
            <View style={styles.chips}>
              {PRIORITIES.map((item) => (
                <Chip key={item.value} label={item.label} selected={priority === item.value} onPress={() => setPriority(item.value)} />
              ))}
            </View>
          </View>

          {existing ? (
            <View style={styles.switchRow}>
              <ThemedText>Completed</ThemedText>
              <Switch value={done} onValueChange={setDone} trackColor={{ true: theme.success }} accessibilityLabel="Completed" />
            </View>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={!canSave}
              onPress={() => void save()}
              style={({ pressed }) => [styles.button, { backgroundColor: theme.accent, opacity: !canSave ? 0.5 : pressed ? 0.8 : 1 }]}>
              <ThemedText type="smallBold" style={{ color: theme.textOnAccent }}>
                {existing ? 'Save changes' : 'Add task'}
              </ThemedText>
            </Pressable>
            {existing ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void remove()}
                style={({ pressed }) => [styles.button, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.8 : 1 }]}>
                <ThemedText type="smallBold" style={{ color: theme.danger }}>
                  {confirmDelete ? 'Tap again to delete' : 'Delete'}
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.three,
  },
  column: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.four,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
    fontSize: 16,
    ...(Platform.OS === 'web' ? { outlineWidth: 0 } : null),
  },
  titleInput: {
    fontSize: 18,
    fontWeight: 600,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  field: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  button: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three - Spacing.one,
    borderRadius: Radius.pill,
  },
});
