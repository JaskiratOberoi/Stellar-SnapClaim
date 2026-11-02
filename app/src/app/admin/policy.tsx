import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Field, FieldGroup } from '@/components/field';
import { Screen } from '@/components/screen';
import { SettingsSection } from '@/components/settings-section';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { Presence } from '@/motion/presence';
import { api, describeError } from '@/services/api';
import type { PolicyRule } from '@/services/types';

type Row = { category_id: string | null; name: string; max_per_claim: string; max_per_month: string; receipt_required_above: string; max_days_to_submit: string; notes: string };

const str = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));
const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(/[^\d.]/g, '')) || 0);

export default function PolicyScreen() {
  const theme = useTheme();
  const { categories, policy, refresh } = useSession();
  const [rows, setRows] = useState<Row[]>(() => {
    const byCat = new Map(policy.map((r) => [r.category_id ?? null, r]));
    return [toRow(null, 'Company-wide', byCat.get(null)), ...categories.map((c) => toRow(c.id, c.name, byCat.get(c.id)))];
  });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const update = (i: number, patch: Partial<Row>) => setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const save = async () => {
    setBusy(true);
    setNotice(null);
    try {
      // Category rows left entirely blank are dropped: the company rule applies.
      const body = rows
        .filter((r, i) => i === 0 || r.max_per_claim || r.max_per_month || r.receipt_required_above || r.max_days_to_submit || r.notes)
        .map((r) => ({
          category_id: r.category_id,
          max_per_claim: num(r.max_per_claim),
          max_per_month: num(r.max_per_month),
          receipt_required_above: num(r.receipt_required_above) ?? 0,
          max_days_to_submit: num(r.max_days_to_submit) === null ? null : Math.round(num(r.max_days_to_submit)!),
          notes: r.notes.trim() || null,
        }));
      await api('/api/v1/admin/policy', { method: 'PUT', body });
      await refresh();
      setNotice('Policy saved. New submissions are checked against it immediately.');
    } catch (err) {
      setNotice(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll title="Spending policy" subtitle="Blank means no limit. A category overrides the company rule field by field, and the check runs as people type." back>
      <>
        {rows.map((row, i) => (
          <SettingsSection
            key={row.category_id ?? 'company'}
            first={i === 0}
            title={row.name}
            description={i === 0 ? 'Applies to every claim unless its category says otherwise.' : 'Leave a field blank to fall back to the company rule.'}>
            <FieldGroup>
              <Field label="Max per claim" value={row.max_per_claim} onChangeText={(v) => update(i, { max_per_claim: v })} keyboardType="decimal-pad" placeholder="No limit" />
              <Field label="Max per month" value={row.max_per_month} onChangeText={(v) => update(i, { max_per_month: v })} keyboardType="decimal-pad" placeholder="No limit" />
            </FieldGroup>
            <FieldGroup>
              <Field label="Receipt required above" value={row.receipt_required_above} onChangeText={(v) => update(i, { receipt_required_above: v })} keyboardType="decimal-pad" placeholder="0" />
              <Field label="Submit within (days)" value={row.max_days_to_submit} onChangeText={(v) => update(i, { max_days_to_submit: v })} keyboardType="number-pad" placeholder="No limit" />
            </FieldGroup>
            <Field label="Note shown to employees" value={row.notes} onChangeText={(v) => update(i, { notes: v })} placeholder="e.g. Economy class only" />
          </SettingsSection>
        ))}
        <View style={[styles.save, { borderTopColor: theme.border }]}>
          <Presence visible={notice !== null} y={6}>
            <ThemedText type="small" style={{ color: notice?.startsWith('Policy saved') ? theme.success : theme.danger }}>
              {notice}
            </ThemedText>
          </Presence>
          <Button title="Save policy" loading={busy} onPress={save} />
        </View>
      </>
    </Screen>
  );
}

function toRow(categoryId: string | null, name: string, rule?: PolicyRule): Row {
  return {
    category_id: categoryId,
    name,
    max_per_claim: str(rule?.max_per_claim),
    max_per_month: str(rule?.max_per_month),
    receipt_required_above: rule ? str(rule.receipt_required_above) : '',
    max_days_to_submit: str(rule?.max_days_to_submit),
    notes: rule?.notes ?? '',
  };
}

const styles = StyleSheet.create({
  save: { marginHorizontal: Spacing.three, paddingTop: Spacing.four, borderTopWidth: 1, gap: Spacing.three, alignItems: 'flex-start' },
});
