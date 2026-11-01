import { useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ClaimRow } from '@/components/claim-row';
import { Card, EmptyNote, ErrorNote, Loading, Screen, SectionTitle } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useRequest } from '@/hooks/use-request';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { api, describeError, downloadFile } from '@/services/api';
import { currentPeriod, formatDateTime, formatMoney, formatMonth, pluralise, shiftPeriod } from '@/services/format';
import type { MonthDetail } from '@/services/types';

export default function ReportsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { company, can } = useSession();
  const [period, setPeriod] = useState(currentPeriod());
  const { data, error, loading, reload } = useRequest(() => api<MonthDetail>(`/api/v1/months/${period}`), [period]);
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
  const [busy, setBusy] = useState<'export' | 'close' | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const currency = company?.currency;

  const exportExcel = async () => {
    setBusy('export');
    setNotice(null);
    try {
      await downloadFile(`/api/v1/months/${period}/export.xlsx`, `SnapClaim-${period}.xlsx`);
      setNotice('Excel workbook downloaded.');
    } catch (err) {
      setNotice(describeError(err));
    } finally {
      setBusy(null);
    }
  };

  const closeMonth = async () => {
    if (!confirmClose) {
      setConfirmClose(true);
      return;
    }
    setBusy('close');
    setNotice(null);
    try {
      const r = await api<{ newly_cleared: number; cleared_total: number; still_pending: number }>(`/api/v1/months/${period}/close`, { body: { note: null } });
      setNotice(`Cleared ${pluralise(r.newly_cleared, 'claim')}${r.still_pending ? `; ${r.still_pending} still awaiting a manager` : ''}.`);
      setConfirmClose(false);
      reload();
    } catch (err) {
      setNotice(describeError(err));
    } finally {
      setBusy(null);
    }
  };

  const m = data?.month;
  const isCurrent = period >= currentPeriod();

  return (
    <Screen title="Month-end review" subtitle={company?.name}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.six }}>
        <View style={styles.nav}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => setPeriod(shiftPeriod(period, -1))} style={[styles.navButton, { backgroundColor: theme.backgroundElement }]}>
            <SymbolView name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }} size={18} tintColor={theme.text} />
          </Pressable>
          <View style={styles.navTitle}>
            <ThemedText style={styles.month}>{formatMonth(period)}</ThemedText>
            {m?.closed_at ? (
              <ThemedText type="small" style={{ color: theme.success }}>
                Closed {formatDateTime(m.closed_at)} by {m.closed_by_name}
              </ThemedText>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                Not yet closed
              </ThemedText>
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next month"
            disabled={isCurrent}
            onPress={() => setPeriod(shiftPeriod(period, 1))}
            style={[styles.navButton, { backgroundColor: theme.backgroundElement, opacity: isCurrent ? 0.4 : 1 }]}>
            <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={18} tintColor={theme.text} />
          </Pressable>
        </View>

        {error ? <ErrorNote message={error} onRetry={reload} /> : null}
        {loading && !data ? <Loading /> : null}

        {m ? (
          <>
            <View style={styles.tiles}>
              <Tile label="Pending" value={formatMoney(m.pending_amount, currency)} count={m.submitted} tone="warning" />
              <Tile label="Approved" value={formatMoney(m.approved_amount, currency)} count={m.approved} tone="accent" />
              <Tile label="Cleared" value={formatMoney(m.cleared_amount, currency)} count={m.cleared} tone="success" />
              <Tile label="Rejected" value={String(m.rejected)} count={m.rejected} tone="danger" />
            </View>

            <View style={styles.actions}>
              <Button title="Export Excel" variant="secondary" icon={{ ios: 'tablecells', android: 'table_chart', web: 'table_chart' }} loading={busy === 'export'} disabled={busy !== null} onPress={exportExcel} />
              {can('months.close') ? (
                <Button
                  title={confirmClose ? `Confirm: clear ${pluralise(m.approved, 'approved claim')}` : 'Close month'}
                  variant={confirmClose ? 'danger' : 'primary'}
                  icon={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }}
                  loading={busy === 'close'}
                  disabled={busy !== null || (m.approved === 0 && !confirmClose)}
                  onPress={closeMonth}
                />
              ) : null}
              {confirmClose ? <Button title="Cancel" variant="ghost" onPress={() => setConfirmClose(false)} /> : null}
            </View>
            {notice ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.notice}>
                {notice}
              </ThemedText>
            ) : null}
            {m.submitted > 0 ? (
              <ThemedText type="small" style={[styles.notice, { color: theme.warning }]}>
                {pluralise(m.submitted, 'claim')} still await a manager. Closing clears only approved claims; the rest stay open.
              </ThemedText>
            ) : null}

            <SectionTitle>By employee</SectionTitle>
            {data!.by_employee.length === 0 ? (
              <EmptyNote>No claims this month.</EmptyNote>
            ) : (
              <Card style={styles.table}>
                {data!.by_employee.map((e) => (
                  <View key={e.employee_id} style={[styles.tr, { borderBottomColor: theme.border }]}>
                    <View style={styles.tdName}>
                      <ThemedText numberOfLines={1}>{e.full_name}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                        {[e.employee_code, e.department, e.manager_name ? `→ ${e.manager_name}` : null].filter(Boolean).join(' · ')}
                      </ThemedText>
                    </View>
                    <View style={styles.tdAmount}>
                      <ThemedText style={styles.amount}>{formatMoney(e.approved_amount, currency)}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {pluralise(e.claims, 'claim')}
                        {e.pending ? ` · ${e.pending} pending` : ''}
                      </ThemedText>
                    </View>
                  </View>
                ))}
              </Card>
            )}

            <SectionTitle>By category</SectionTitle>
            {data!.by_category.length === 0 ? (
              <EmptyNote>Nothing to break down yet.</EmptyNote>
            ) : (
              <Card style={styles.table}>
                {data!.by_category.map((k) => {
                  const max = Math.max(...data!.by_category.map((x) => x.approved_amount + x.pending_amount), 1);
                  return (
                    <View key={k.category} style={styles.catRow}>
                      <View style={styles.catLine}>
                        <ThemedText style={styles.catName} numberOfLines={1}>
                          {k.category}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {pluralise(k.claims, 'claim')}
                        </ThemedText>
                        <ThemedText style={styles.amount}>{formatMoney(k.approved_amount, currency)}</ThemedText>
                      </View>
                      <View style={[styles.barTrack, { backgroundColor: theme.backgroundSelected }]}>
                        <View style={[styles.barFill, { backgroundColor: theme.accent, width: `${Math.max(2, (100 * (k.approved_amount + k.pending_amount)) / max)}%` }]} />
                      </View>
                    </View>
                  );
                })}
              </Card>
            )}

            <SectionTitle>Flagged claims</SectionTitle>
            {data!.flagged.length === 0 ? (
              <EmptyNote>No policy flags this month.</EmptyNote>
            ) : (
              data!.flagged.map((c) => <ClaimRow key={c.id} claim={c} showEmployee />)
            )}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Tile({ label, value, count, tone }: { label: string; value: string; count: number; tone: 'warning' | 'accent' | 'success' | 'danger' }) {
  const theme = useTheme();
  const color = { warning: theme.warning, accent: theme.accent, success: theme.success, danger: theme.danger }[tone];
  return (
    <View style={[styles.tile, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        {label}
      </ThemedText>
      <ThemedText style={[styles.tileValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {pluralise(count, 'claim')}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  navButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  navTitle: { flex: 1, alignItems: 'center', gap: Spacing.half },
  month: { fontSize: 20, lineHeight: 26, fontWeight: 700 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  tile: { flexBasis: '46%', flexGrow: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + Spacing.half, gap: Spacing.half },
  tileValue: { fontSize: 22, lineHeight: 28, fontWeight: 700 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  notice: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, lineHeight: 20 },
  table: { gap: 0, paddingVertical: Spacing.one },
  tr: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth },
  tdName: { flex: 1, gap: Spacing.half },
  tdAmount: { alignItems: 'flex-end', gap: Spacing.half },
  amount: { fontWeight: 700 },
  catRow: { paddingVertical: Spacing.two, gap: Spacing.one },
  catLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  catName: { flex: 1, fontWeight: 600 },
  barTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
});
