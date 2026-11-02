import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Field, FieldGroup } from '@/components/field';
import { Card, EmptyNote, ErrorNote, Loading, Screen, SectionTitle } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useRequest } from '@/hooks/use-request';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { Presence } from '@/motion/presence';
import { Tap } from '@/motion/tap';
import { api, describeError } from '@/services/api';
import type { Role, User } from '@/services/types';

const ROLES: { value: Role; label: string }[] = [
  { value: 'employee', label: 'Employee' },
  { value: 'manager', label: 'Manager' },
  { value: 'director', label: 'Director' },
  { value: 'admin', label: 'Admin' },
];

type Form = { email: string; full_name: string; role: Role; manager_id: string | null; employee_code: string; department: string; password: string; is_active: boolean };
const blank: Form = { email: '', full_name: '', role: 'employee', manager_id: null, employee_code: '', department: '', password: '', is_active: true };

export default function UsersScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user: me } = useSession();
  const { data, error, loading, reload } = useRequest(() => api<{ items: User[] }>('/api/v1/users?include_inactive=true'), []);
  const [editing, setEditing] = useState<User | 'new' | null>(null);
  const [form, setForm] = useState<Form>(blank);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const users = data?.items ?? [];
  const approvers = users.filter((u) => u.role !== 'employee' && u.is_active);

  const open = (u: User | 'new') => {
    setEditing(u);
    setNotice(null);
    setForm(
      u === 'new'
        ? blank
        : { email: u.email, full_name: u.full_name, role: u.role, manager_id: u.manager_id ?? null, employee_code: u.employee_code ?? '', department: u.department ?? '', password: '', is_active: u.is_active },
    );
  };

  const save = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const body = { ...form, employee_code: form.employee_code || null, department: form.department || null, password: form.password || null };
      if (editing === 'new') await api('/api/v1/admin/users', { body });
      else if (editing) {
        await api(`/api/v1/admin/users/${editing.id}`, { method: 'PUT', body });
        if (form.password) await api(`/api/v1/admin/users/${editing.id}/reset-password`, { body: { new_password: form.password } });
      }
      setEditing(null);
      reload();
    } catch (err) {
      setNotice(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="People" subtitle={`${users.filter((u) => u.is_active).length} active`} back action={<Chip label="Add person" onPress={() => open('new')} />}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.six }} keyboardShouldPersistTaps="handled">
        {error ? <ErrorNote message={error} onRetry={reload} /> : null}
        <Presence visible={editing !== null} y={10}>
        {editing ? (
          <>
            <SectionTitle>{editing === 'new' ? 'New person' : `Edit ${editing.full_name}`}</SectionTitle>
            <Card>
              <Field label="Full name" value={form.full_name} onChangeText={(v) => setForm({ ...form, full_name: v })} />
              <Field label="Work email" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} autoCapitalize="none" keyboardType="email-address" />
              <FieldGroup>
                <Field label="Employee code" value={form.employee_code} onChangeText={(v) => setForm({ ...form, employee_code: v })} placeholder="EMP01" />
                <Field label="Department" value={form.department} onChangeText={(v) => setForm({ ...form, department: v })} placeholder="Sales" />
              </FieldGroup>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Role
              </ThemedText>
              <View style={styles.chips}>
                {ROLES.map((r) => (
                  <Chip key={r.value} label={r.label} selected={form.role === r.value} onPress={() => setForm({ ...form, role: r.value })} />
                ))}
              </View>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Approves their claims
              </ThemedText>
              <View style={styles.chips}>
                <Chip label="Nobody" selected={form.manager_id === null} onPress={() => setForm({ ...form, manager_id: null })} />
                {approvers
                  .filter((a) => editing === 'new' || a.id !== editing.id)
                  .map((a) => (
                    <Chip key={a.id} label={a.full_name} selected={form.manager_id === a.id} onPress={() => setForm({ ...form, manager_id: a.id })} />
                  ))}
              </View>
              <Field
                label={editing === 'new' ? 'Password' : 'Reset password'}
                value={form.password}
                onChangeText={(v) => setForm({ ...form, password: v })}
                secureTextEntry
                hint={editing === 'new' ? 'At least 8 characters; share it with them' : 'Leave blank to keep the current password'}
              />
              {editing !== 'new' && editing.id !== me?.id ? (
                <View style={styles.switchRow}>
                  <ThemedText>Active</ThemedText>
                  <Switch value={form.is_active} onValueChange={(v) => setForm({ ...form, is_active: v })} />
                </View>
              ) : null}
              {notice ? (
                <ThemedText type="small" style={{ color: theme.danger }}>
                  {notice}
                </ThemedText>
              ) : null}
              <View style={styles.actions}>
                <Button title="Cancel" variant="secondary" onPress={() => setEditing(null)} />
                <Button title="Save" loading={busy} onPress={save} disabled={!form.full_name.trim() || !form.email.includes('@') || (editing === 'new' && form.password.length < 8)} />
              </View>
            </Card>
          </>
        ) : null}
        </Presence>

        <SectionTitle>Everyone</SectionTitle>
        {loading && users.length === 0 ? <Loading /> : null}
        {users.length === 0 && !loading ? <EmptyNote>No people yet.</EmptyNote> : null}
        {users.map((u) => (
          <Tap key={u.id} accessibilityRole="button" onPress={() => open(u)} scale={0.98} style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.backgroundElement : 'transparent', opacity: u.is_active ? 1 : 0.5 }]}>
            <View style={styles.rowText}>
              <ThemedText style={{ fontWeight: 600 }}>
                {u.full_name}
                {u.id === me?.id ? ' (you)' : ''}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {[ROLES.find((r) => r.value === u.role)?.label, u.employee_code, u.department, u.email].filter(Boolean).join(' · ')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {u.manager_name ? `Claims go to ${u.manager_name}` : u.role === 'employee' ? 'No approver set' : ''}
                {u.is_active ? '' : ' · Inactive'}
              </ThemedText>
            </View>
          </Tap>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', gap: Spacing.two, justifyContent: 'flex-end', paddingTop: Spacing.two },
  row: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + Spacing.half, marginHorizontal: Spacing.two, borderRadius: Radius.medium },
  rowText: { gap: Spacing.half },
});
