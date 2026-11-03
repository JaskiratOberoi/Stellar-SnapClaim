import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Field, FieldGroup } from '@/components/field';
import { Card, EmptyNote, ErrorNote, Loading, Screen, SectionTitle } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing, Tones, type ToneName } from '@/constants/theme';
import { useRequest } from '@/hooks/use-request';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { Presence } from '@/motion/presence';
import { Tap } from '@/motion/tap';
import { api, describeError } from '@/services/api';
import type { Role, User } from '@/services/types';

const ROLES: { value: Role; label: string; tone: ToneName }[] = [
  { value: 'employee', label: 'Employee', tone: 'sage' },
  { value: 'approver', label: 'Approver', tone: 'green' },
  { value: 'admin', label: 'Admin', tone: 'indigo' },
  { value: 'super_admin', label: 'Super admin', tone: 'plum' },
];
const roleOf = (role: Role) => ROLES.find((r) => r.value === role) ?? ROLES[0];
const SENIOR: Role[] = ['admin', 'super_admin'];

type Form = { email: string; full_name: string; role: Role; manager_id: string | null; employee_code: string; department: string; password: string; is_active: boolean };
const blank: Form = { email: '', full_name: '', role: 'employee', manager_id: null, employee_code: '', department: '', password: '', is_active: true };

export default function UsersScreen() {
  const theme = useTheme();
  const { user: me, can } = useSession();
  // Admins onboard employees and approvers; only a super admin hands out or touches the senior roles.
  const seniorRoles = can('users.admins');
  const roles = seniorRoles ? ROLES : ROLES.filter((r) => !SENIOR.includes(r.value));
  const mayEdit = (u: User) => seniorRoles || !SENIOR.includes(u.role);
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
    <Screen
      scroll
      title="People"
      subtitle={
        seniorRoles
          ? 'Who files and who approves. The reporting line decides where a claim goes: approvers and admins decide on their direct reports; the super admin on anyone.'
          : 'Onboard employees and approvers and set who approves their claims. Admins and super admins are looked after by the super admin.'
      }
      back
      action={<Button title="Add person" compact icon={{ ios: 'plus', android: 'add', web: 'add' }} onPress={() => open('new')} />}>
      <>
        {error ? <ErrorNote message={error} onRetry={reload} /> : null}
        <Presence visible={editing !== null} y={10}>
          {editing ? (
            <>
              <SectionTitle>{editing === 'new' ? 'New person' : `Edit ${editing.full_name}`}</SectionTitle>
              <Card style={styles.form}>
                <FieldGroup>
                  <Field label="Full name" value={form.full_name} onChangeText={(v) => setForm({ ...form, full_name: v })} />
                  <Field label="Work email" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} autoCapitalize="none" keyboardType="email-address" />
                </FieldGroup>
                <FieldGroup>
                  <Field label="Employee code" value={form.employee_code} onChangeText={(v) => setForm({ ...form, employee_code: v })} placeholder="EMP01" />
                  <Field label="Department" value={form.department} onChangeText={(v) => setForm({ ...form, department: v })} placeholder="Sales" />
                </FieldGroup>
                <ThemedText type="label" themeColor="textMuted">
                  Role
                </ThemedText>
                <View style={styles.chips}>
                  {roles.map((r) => (
                    <Chip key={r.value} label={r.label} tone={r.tone} selected={form.role === r.value} onPress={() => setForm({ ...form, role: r.value })} />
                  ))}
                </View>
                <ThemedText type="label" themeColor="textMuted">
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
                    <Switch value={form.is_active} onValueChange={(v) => setForm({ ...form, is_active: v })} trackColor={{ true: theme.accent }} />
                  </View>
                ) : null}
                {notice ? (
                  <ThemedText type="small" style={{ color: theme.danger }}>
                    {notice}
                  </ThemedText>
                ) : null}
                <View style={styles.actions}>
                  <Button title="Cancel" variant="secondary" compact onPress={() => setEditing(null)} />
                  <Button title="Save" compact loading={busy} onPress={save} disabled={!form.full_name.trim() || !form.email.includes('@') || (editing === 'new' && form.password.length < 8)} />
                </View>
              </Card>
            </>
          ) : null}
        </Presence>

        <SectionTitle>Everyone</SectionTitle>
        {loading && users.length === 0 ? <Loading /> : null}
        {users.length === 0 && !loading ? <EmptyNote>No people yet.</EmptyNote> : null}
        {users.length > 0 ? (
          <Card style={styles.list}>
            {users.map((u, i) => {
              const role = roleOf(u.role);
              const t = Tones[role.tone];
              const editable = mayEdit(u);
              return (
                <Tap
                  key={u.id}
                  accessibilityRole="button"
                  disabled={!editable}
                  onPress={() => open(u)}
                  scale={editable ? 0.99 : 1}
                  style={({ pressed }) => [
                    styles.row,
                    { backgroundColor: pressed ? theme.backgroundElement : 'transparent', borderBottomColor: theme.border, borderBottomWidth: i === users.length - 1 ? 0 : StyleSheet.hairlineWidth, opacity: u.is_active ? 1 : 0.5 },
                  ]}>
                  <View style={[styles.avatar, { backgroundColor: t.soft }]}>
                    <ThemedText type="serifSmall" style={{ color: t.ink }}>
                      {initials(u.full_name)}
                    </ThemedText>
                  </View>
                  <View style={styles.rowText}>
                    <ThemedText type="medium" numberOfLines={1}>
                      {u.full_name}
                      {u.id === me?.id ? ' (you)' : ''}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textMuted" numberOfLines={1}>
                      {[u.employee_code, u.department, u.email].filter(Boolean).join(' · ')}
                    </ThemedText>
                    <ThemedText type="caption" themeColor="textMuted" numberOfLines={1}>
                      {u.manager_name ? `Claims go to ${u.manager_name}` : u.role === 'employee' ? 'No approver set' : 'Approves claims'}
                      {u.is_active ? '' : ' · Inactive'}
                      {editable ? '' : ' · Super admin only'}
                    </ThemedText>
                  </View>
                  <View style={[styles.rolePill, { backgroundColor: t.soft }]}>
                    <ThemedText type="caption" style={{ color: t.ink, fontWeight: 600 }}>
                      {role.label}
                    </ThemedText>
                  </View>
                </Tap>
              );
            })}
          </Card>
        ) : null}
      </>
    </Screen>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

const styles = StyleSheet.create({
  form: { gap: Spacing.three },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', gap: Spacing.two, justifyContent: 'flex-end', paddingTop: Spacing.two },
  list: { padding: 0, gap: 0, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + Spacing.half },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  rolePill: { paddingHorizontal: Spacing.two + Spacing.half, paddingVertical: Spacing.one, borderRadius: 999 },
});
