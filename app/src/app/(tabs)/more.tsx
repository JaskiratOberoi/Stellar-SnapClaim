import Constants from 'expo-constants';
import { router } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Lifecycle } from '@/components/art';
import { Button } from '@/components/button';
import { Field, FieldGroup } from '@/components/field';
import { Screen } from '@/components/screen';
import { Fact, SettingsSection } from '@/components/settings-section';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useGuide } from '@/guide/guide';
import { homeTour } from '@/guide/tours';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { Presence } from '@/motion/presence';
import { Tap } from '@/motion/tap';
import { API_URL, api, describeError } from '@/services/api';
import { formatNumber } from '@/services/format';

const ROLE_LABEL = { super_admin: 'Super admin', admin: 'Admin', approver: 'Approver', employee: 'Employee' } as const;

export default function SettingsScreen() {
  const theme = useTheme();
  const { user, company, policy, extractionEnabled, can, signOut } = useSession();
  const guide = useGuide();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwNotice, setPwNotice] = useState<string | null>(null);

  const changePassword = async () => {
    setPwBusy(true);
    setPwNotice(null);
    try {
      await api('/api/v1/auth/change-password', { body: { current_password: current, new_password: next } });
      setPwNotice('Password changed.');
      setCurrent('');
      setNext('');
    } catch (err) {
      setPwNotice(describeError(err));
    } finally {
      setPwBusy(false);
    }
  };

  if (!user) return null;
  const companyRule = policy.find((r) => r.category_id == null);

  const replayTour = async () => {
    await guide.reset();
    router.navigate('/');
    const firstName = user.full_name.split(' ')[0] ?? '';
    setTimeout(() => guide.start(homeTour({ firstName, managerName: user.manager_name ?? null, hasCap: companyRule?.max_per_month != null, approves: can('claims.approve'), reviews: can('months.review'), extraction: extractionEnabled })), 400);
  };

  return (
    <Screen scroll title="Settings" subtitle="Your account, and for administrators the company setup.">
      <>
        <SettingsSection first title="You" description="Your name, your role, and where your claims go.">
          <View>
            <Fact label="Name" value={user.full_name} />
            <Fact label="Role" value={ROLE_LABEL[user.role]} />
            {user.employee_code ? <Fact label="Employee code" value={user.employee_code} /> : null}
            {user.department ? <Fact label="Department" value={user.department} /> : null}
            <Fact label="Email" value={user.email} />
            <Fact label="Approver" value={user.manager_name ?? 'Nobody yet'} />
            <Fact label="Company" value={company ? `${company.name} · ${company.currency}` : ''} />
          </View>
        </SettingsSection>

        {can('users') || can('policy') || can('audit') ? (
          <SettingsSection title="Administration" description="People, the spending policy, and the record of everything anyone did.">
            {can('users') ? <LinkCard icon={{ ios: 'person.2.fill', android: 'group', web: 'group' }} title="People & reporting lines" subtitle={can('users.admins') ? 'Onboard and offboard, set approvers and roles' : 'Onboard employees and approvers, set who approves'} onPress={() => router.push('/admin/users')} /> : null}
            {can('policy') ? <LinkCard icon={{ ios: 'shield.lefthalf.filled', android: 'policy', web: 'policy' }} title="Spending policy" subtitle="Caps, receipt thresholds, submission window" onPress={() => router.push('/admin/policy')} /> : null}
            {can('audit') ? <LinkCard icon={{ ios: 'list.bullet.rectangle', android: 'history', web: 'history' }} title="Audit trail" subtitle="Every sign-in, claim, decision and change, newest first" onPress={() => router.push('/admin/audit')} /> : null}
          </SettingsSection>
        ) : null}

        <SettingsSection title="Spending policy" description="What the policy check holds every claim to. A category rule overrides the company rule field by field.">
          <View>
            {companyRule ? <Fact label="Company-wide" value={describeRule(companyRule.max_per_claim, companyRule.max_per_month, companyRule.receipt_required_above, companyRule.max_days_to_submit)} /> : null}
            {policy
              .filter((r) => r.category_id != null)
              .map((r) => (
                <Fact key={r.category_id} label={r.category_name ?? 'Category'} value={describeRule(r.max_per_claim, r.max_per_month, r.receipt_required_above, r.max_days_to_submit)} />
              ))}
            {policy.length === 0 ? (
              <ThemedText type="small" themeColor="textMuted">
                No policy configured.
              </ThemedText>
            ) : null}
          </View>
        </SettingsSection>

        <SettingsSection title="Getting around" description="The loop every claim goes through, and the guided tour from your first day.">
          <View style={[styles.loop, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Lifecycle />
            <ThemedText type="small" themeColor="textMuted" style={styles.loopNote}>
              Snap the bill, submit the claim, your approver approves it, and month-end clears it for payroll.
            </ThemedText>
          </View>
          <View style={styles.actions}>
            <Button title="Replay the welcome tour" variant="secondary" compact icon={{ ios: 'sparkles', android: 'tour', web: 'tour' }} onPress={replayTour} />
          </View>
        </SettingsSection>

        <SettingsSection title="Account" description="Change your password, or sign out of this device.">
          <FieldGroup>
            <Field label="Current password" value={current} onChangeText={setCurrent} secureTextEntry autoComplete="current-password" />
            <Field label="New password" value={next} onChangeText={setNext} secureTextEntry autoComplete="new-password" hint="At least 8 characters" />
          </FieldGroup>
          <Presence visible={pwNotice !== null} y={6}>
            <ThemedText type="small" style={{ color: pwNotice === 'Password changed.' ? theme.success : theme.danger }}>
              {pwNotice}
            </ThemedText>
          </Presence>
          <View style={styles.actions}>
            <Button title="Update password" compact onPress={changePassword} loading={pwBusy} disabled={next.length < 8 || !current} />
            <Button title="Sign out" variant="secondary" compact icon={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }} onPress={signOut} />
          </View>
        </SettingsSection>

        <ThemedText type="caption" themeColor="textMuted" style={styles.footer}>
          SnapClaim {Constants.expoConfig?.version ?? ''} · {API_URL.replace(/^https?:\/\//, '')} · receipt reading {extractionEnabled ? 'on' : 'off'}
        </ThemedText>
      </>
    </Screen>
  );
}

function describeRule(perClaim: number | null, perMonth: number | null, receiptAbove: number, days: number | null): string {
  const parts: string[] = [];
  if (perClaim !== null) parts.push(`up to ${formatNumber(perClaim)} per claim`);
  if (perMonth !== null) parts.push(`${formatNumber(perMonth)} per month`);
  parts.push(receiptAbove > 0 ? `receipt above ${formatNumber(receiptAbove)}` : 'receipt always required');
  if (days !== null) parts.push(`submit within ${days} days`);
  return parts.join(', ');
}

/** A surface card that is a link: icon badge, title, line, chevron. */
function LinkCard({ icon, title, subtitle, onPress }: { icon: SymbolViewProps['name']; title: string; subtitle: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Tap accessibilityRole="button" onPress={onPress} scale={0.985} style={({ pressed }) => [styles.link, { backgroundColor: pressed ? theme.backgroundElement : theme.surface, borderColor: theme.border }]}>
      <View style={[styles.linkBadge, { backgroundColor: theme.accent }]}>
        <SymbolView name={icon} size={18} tintColor="#FFFFFF" />
      </View>
      <View style={styles.linkText}>
        <ThemedText type="medium">{title}</ThemedText>
        <ThemedText type="small" themeColor="textMuted">
          {subtitle}
        </ThemedText>
      </View>
      <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={16} tintColor={theme.textMuted} />
    </Tap>
  );
}

const styles = StyleSheet.create({
  link: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.medium, borderWidth: 1 },
  linkBadge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  linkText: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  loop: { padding: Spacing.three, paddingTop: Spacing.three + Spacing.one, borderRadius: Radius.medium, borderWidth: 1, gap: Spacing.three },
  loopNote: { textAlign: 'center' },
  footer: { textAlign: 'center', paddingVertical: Spacing.five, paddingHorizontal: Spacing.three },
});
