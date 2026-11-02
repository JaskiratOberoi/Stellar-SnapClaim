import Constants from 'expo-constants';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Card, Screen, SectionTitle } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { Tap } from '@/motion/tap';
import { API_URL, api, describeError } from '@/services/api';
import { formatNumber } from '@/services/format';

const ROLE_LABEL = { admin: 'Administrator', director: 'Director', manager: 'Manager', employee: 'Employee' } as const;

export default function MoreScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user, company, policy, extractionEnabled, can, signOut } = useSession();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwNotice, setPwNotice] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  const changePassword = async () => {
    setPwBusy(true);
    setPwNotice(null);
    try {
      await api('/api/v1/auth/change-password', { body: { current_password: current, new_password: next } });
      setPwNotice('Password changed.');
      setCurrent('');
      setNext('');
      setShowPw(false);
    } catch (err) {
      setPwNotice(describeError(err));
    } finally {
      setPwBusy(false);
    }
  };

  if (!user) return null;
  const companyRule = policy.find((r) => r.category_id == null);

  return (
    <Screen title="You" subtitle={company?.name}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.six }}>
        <Card style={styles.profile}>
          <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
            <ThemedText type="serif" style={{ color: theme.textOnAccent, fontSize: 24 }}>{initials(user.full_name)}</ThemedText>
          </View>
          <View style={styles.profileText}>
            <ThemedText type="serif">{user.full_name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {[ROLE_LABEL[user.role], user.employee_code, user.department].filter(Boolean).join(' · ')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {user.email}
            </ThemedText>
            {user.manager_name ? (
              <ThemedText type="small" themeColor="textSecondary">
                Claims go to {user.manager_name}
              </ThemedText>
            ) : null}
          </View>
        </Card>

        {can('users') || can('policy') ? (
          <>
            <SectionTitle>Administration</SectionTitle>
            <Row icon={{ ios: 'person.2.fill', android: 'group', web: 'group' }} title="People & reporting lines" subtitle="Add employees, set managers and roles" onPress={() => router.push('/admin/users')} />
            <Row icon={{ ios: 'shield.lefthalf.filled', android: 'policy', web: 'policy' }} title="Spending policy" subtitle="Caps, receipt thresholds, submission window" onPress={() => router.push('/admin/policy')} />
          </>
        ) : null}

        <SectionTitle>Spending policy</SectionTitle>
        <Card>
          {companyRule ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.policyLine}>
              Company-wide: {describeRule(companyRule.max_per_claim, companyRule.max_per_month, companyRule.receipt_required_above, companyRule.max_days_to_submit)}
            </ThemedText>
          ) : null}
          {policy
            .filter((r) => r.category_id != null)
            .map((r) => (
              <ThemedText key={r.category_id} type="small" themeColor="textSecondary" style={styles.policyLine}>
                {r.category_name}: {describeRule(r.max_per_claim, r.max_per_month, r.receipt_required_above, r.max_days_to_submit)}
              </ThemedText>
            ))}
          {policy.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              No policy configured.
            </ThemedText>
          ) : null}
        </Card>

        <SectionTitle>Account</SectionTitle>
        <Row icon={{ ios: 'key.fill', android: 'key', web: 'key' }} title="Change password" onPress={() => setShowPw((v) => !v)} />
        {showPw ? (
          <Card>
            <Field label="Current password" value={current} onChangeText={setCurrent} secureTextEntry />
            <Field label="New password" value={next} onChangeText={setNext} secureTextEntry hint="At least 8 characters" />
            <Button title="Update password" onPress={changePassword} loading={pwBusy} disabled={next.length < 8 || !current} />
          </Card>
        ) : null}
        {pwNotice ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            {pwNotice}
          </ThemedText>
        ) : null}
        <Row icon={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }} title="Sign out" onPress={signOut} danger />

        <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
          SnapClaim {Constants.expoConfig?.version ?? ''} · {API_URL.replace(/^https?:\/\//, '')} · receipt reading {extractionEnabled ? 'on' : 'off'}
        </ThemedText>
      </ScrollView>
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

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function Row({ icon, title, subtitle, onPress, danger }: { icon: { ios: string; android: string; web: string }; title: string; subtitle?: string; onPress: () => void; danger?: boolean }) {
  const theme = useTheme();
  const color = danger ? theme.danger : theme.text;
  return (
    <Tap accessibilityRole="button" onPress={onPress} scale={0.98} style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.backgroundElement : 'transparent' }]}>
      <SymbolView name={icon as never} size={20} tintColor={color} />
      <View style={styles.rowText}>
        <ThemedText style={{ color, fontWeight: 600 }}>{title}</ThemedText>
        {subtitle ? (
          <ThemedText type="small" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={16} tintColor={theme.textSecondary} />
    </Tap>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginTop: Spacing.three },
  avatar: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  profileText: { flex: 1, gap: Spacing.half },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + Spacing.half, marginHorizontal: Spacing.two, borderRadius: Radius.medium },
  rowText: { flex: 1, gap: Spacing.half },
  policyLine: { lineHeight: 20 },
  note: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  footer: { textAlign: 'center', paddingTop: Spacing.five, paddingHorizontal: Spacing.three },
});
