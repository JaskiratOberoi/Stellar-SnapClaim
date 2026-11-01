import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Chip } from '@/components/chip';
import { DateField } from '@/components/date-field';
import { ThemedText } from '@/components/themed-text';
import { Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useStore } from '@/hooks/use-store';
import { useTheme } from '@/hooks/use-theme';
import { startOfDay } from '@/services/format';
import { EXPENSE_CATEGORIES, guessCategory, type ExpenseCategory } from '@/services/store/types';

export default function ExpenseScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { expenses, addExpense, updateExpense, deleteExpense, defaultCurrency } = useStore();
  const existing = id === 'new' ? undefined : expenses.find((expense) => expense.id === id);

  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const [currency, setCurrency] = useState(existing?.currency ?? defaultCurrency);
  const [note, setNote] = useState(existing?.note ?? '');
  const [category, setCategory] = useState<ExpenseCategory | null>(existing?.category ?? null);
  const [spentAt, setSpentAt] = useState<number | undefined>(() => existing?.spentAt ?? startOfDay(Date.now()));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const parsedAmount = Number(amount.replace(/,/g, ''));
  const canSave = Number.isFinite(parsedAmount) && parsedAmount > 0 && /^[A-Z]{3}$/.test(currency);
  const effectiveCategory = category ?? guessCategory(note);

  const save = async () => {
    if (!canSave) return;
    const payload = {
      amount: parsedAmount,
      currency,
      note,
      category: effectiveCategory,
      spentAt: spentAt ?? Date.now(),
    };
    if (existing) await updateExpense(existing.id, payload);
    else await addExpense(payload);
    router.back();
  };

  const remove = async () => {
    if (!existing) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await deleteExpense(existing.id);
    router.back();
  };

  const inputStyle = [
    styles.input,
    { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border, fontFamily: Fonts.sans },
  ];

  return (
    <>
      <Stack.Screen options={{ title: existing ? 'Edit expense' : 'New expense' }} />
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <View style={styles.column}>
          <View style={styles.amountRow}>
            <TextInput
              style={[inputStyle, styles.currencyInput]}
              value={currency}
              onChangeText={(text) => setCurrency(text.toUpperCase())}
              maxLength={3}
              autoCapitalize="characters"
              autoCorrect={false}
              accessibilityLabel="Currency"
            />
            <TextInput
              style={[inputStyle, styles.amountInput]}
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
              inputMode="decimal"
              autoFocus={!existing}
              accessibilityLabel="Amount"
            />
          </View>

          <TextInput
            style={inputStyle}
            value={note}
            onChangeText={setNote}
            placeholder="What was it for?"
            placeholderTextColor={theme.textSecondary}
            returnKeyType="done"
            accessibilityLabel="Note"
          />

          <View style={styles.field}>
            <ThemedText type="small">Category{category ? '' : ' (guessed from the note)'}</ThemedText>
            <View style={styles.chips}>
              {EXPENSE_CATEGORIES.map((item) => (
                <Chip
                  key={item.id}
                  small
                  label={item.label}
                  selected={effectiveCategory === item.id}
                  onPress={() => setCategory(item.id)}
                />
              ))}
            </View>
          </View>

          <DateField label="Date" value={spentAt} onChange={setSpentAt} />

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={!canSave}
              onPress={() => void save()}
              style={({ pressed }) => [styles.button, { backgroundColor: theme.accent, opacity: !canSave ? 0.5 : pressed ? 0.8 : 1 }]}>
              <ThemedText type="smallBold" style={{ color: theme.textOnAccent }}>
                {existing ? 'Save changes' : 'Add expense'}
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
  amountRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  currencyInput: {
    width: 84,
    textAlign: 'center',
    fontWeight: 600,
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: 700,
  },
  field: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one + Spacing.half,
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
