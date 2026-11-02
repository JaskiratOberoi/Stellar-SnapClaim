import { useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/button';
import { ClaimRow } from '@/components/claim-row';
import { GroupCard } from '@/components/group-card';
import { Card, EmptyNote, ErrorNote, Loading, Screen, SectionTitle } from '@/components/screen';
import { StatCard } from '@/components/stat-card';
import { ThemedText } from '@/components/themed-text';
import { STATUS_ICON } from '@/constants/status';
import { Fonts, PhoneWidth, Spacing } from '@/constants/theme';
import { useRequest } from '@/hooks/use-request';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { GrowBar } from '@/motion/grow-bar';
import { Presence } from '@/motion/presence';
import { Reveal } from '@/motion/reveal';
import { Tap } from '@/motion/tap';
import { api, describeError, downloadFile } from '@/services/api';
import { currentPeriod, formatDateTime, formatMoney, formatMonth, pluralise, shiftPeriod } from '@/services/format';
import type { MonthDetail } from '@/services/types';

export default function ReportsScreen() {
  const theme = useTheme();
  const wide = useWindowDimensions().width >= PhoneWidth;
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
  const money = useCallback((n: number) => formatMoney(Math.round(n), currency), [currency]);
  const whole = (n: number) => String(Math.round(n));

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
  const grand = m ? m.pending_amount + m.approved_amount + m.cleared_amount : 0;
  const max = data ? Math.max(...data.by_category.map((x) => x.approved_amount + x.pending_amount), 1) : 1;

  return (
    <Screen title="Month-end review" subtitle="The month by person and by category. Export the workbook, then close it to clear what was approved." scroll>
      <>
        <View style={[styles.nav, { borderColor: theme.border }]}>
          <Tap accessibilityRole="button" accessibilityLabel="Previous month" scale={0.88} hitSlop={8} onPress={() => setPeriod(shiftPeriod(period, -1))} style={styles.navButton}>
            <SymbolView name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }} size={18} tintColor={theme.textSecondary} />
          </Tap>
          <View style={styles.navTitle}>
            <Reveal key={period} y={6}>
              <ThemedText type="serifSmall">{formatMonth(period)}</ThemedText>
            </Reveal>
            {m?.closed_at ? (
              <ThemedText type="caption" style={{ color: theme.success }}>
                Closed {formatDateTime(m.closed_at)} by {m.closed_by_name}
              </ThemedText>
            ) : (
              <ThemedText type="caption" themeColor="textMuted">
                Not yet closed
              </ThemedText>
            )}
          </View>
          <Tap accessibilityRole="button" accessibilityLabel="Next month" disabled={isCurrent} scale={0.88} hitSlop={8} onPress={() => setPeriod(shiftPeriod(period, 1))} style={[styles.navButton, { opacity: isCurrent ? 0.3 : 1 }]}>
            <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={18} tintColor={theme.textSecondary} />
          </Tap>
        </View>

        {error ? <ErrorNote message={error} onRetry={reload} /> : null}
        {loading && !data ? <Loading /> : null}

        {m && data ? (
          <>
            <View style={[styles.grid, wide && styles.gridWide]}>
              <Reveal key={`p${period}`} y={10} style={styles.cell}>
                <StatCard tone="amber" icon={STATUS_ICON.submitted} label="Pending" trailing={pluralise(m.submitted, 'claim')} value={m.pending_amount} format={money} fraction={grand ? m.pending_amount / grand : 0} note="Still with a manager" />
              </Reveal>
              <Reveal key={`a${period}`} y={10} delay={50} style={styles.cell}>
                <StatCard tone="indigo" icon={STATUS_ICON.approved} label="Approved" trailing={pluralise(m.approved, 'claim')} value={m.approved_amount} format={money} fraction={grand ? m.approved_amount / grand : 0} note="Clears when the month closes" delay={50} />
              </Reveal>
            </View>
            <View style={[styles.grid, wide && styles.gridWide, styles.gridGap]}>
              <Reveal key={`c${period}`} y={10} delay={100} style={styles.cell}>
                <StatCard tone="green" icon={STATUS_ICON.cleared} label="Cleared" trailing={pluralise(m.cleared, 'claim')} value={m.cleared_amount} format={money} fraction={grand ? m.cleared_amount / grand : 0} note="Ready for payroll" delay={100} />
              </Reveal>
              <Reveal key={`r${period}`} y={10} delay={150} style={styles.cell}>
                <StatCard tone="pink" icon={STATUS_ICON.rejected} label="Rejected" trailing="Sent back" value={m.rejected} format={whole} unit={`/ ${pluralise(m.submitted + m.approved + m.cleared + m.rejected, 'claim')}`} note="With a note from the manager" delay={150} />
              </Reveal>
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
            <Presence visible={notice !== null} y={6}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.notice}>
                {notice}
              </ThemedText>
            </Presence>
            {m.submitted > 0 ? (
              <ThemedText type="small" style={[styles.notice, { color: theme.warning }]}>
                {pluralise(m.submitted, 'claim')} still await a manager. Closing clears only approved claims; the rest stay open.
              </ThemedText>
            ) : null}

            <Reveal key={`t${period}`} y={10} delay={80}>
              <SectionTitle>By employee</SectionTitle>
              {data.by_employee.length === 0 ? (
                <EmptyNote>No claims this month.</EmptyNote>
              ) : (
                <Card style={styles.table}>
                  {data.by_employee.map((e, i) => (
                    <View key={e.employee_id} style={[styles.tr, { borderBottomColor: theme.border, borderBottomWidth: i === data.by_employee.length - 1 ? 0 : StyleSheet.hairlineWidth }]}>
                      <View style={styles.tdName}>
                        <ThemedText type="medium" numberOfLines={1}>
                          {e.full_name}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textMuted" numberOfLines={1}>
                          {[e.employee_code, e.department, e.manager_name ? `→ ${e.manager_name}` : null].filter(Boolean).join(' · ')}
                        </ThemedText>
                      </View>
                      <View style={styles.tdAmount}>
                        <ThemedText style={styles.amount}>{formatMoney(e.approved_amount, currency)}</ThemedText>
                        <ThemedText type="caption" themeColor="textMuted">
                          {pluralise(e.claims, 'claim')}
                          {e.pending ? ` · ${e.pending} pending` : ''}
                        </ThemedText>
                      </View>
                    </View>
                  ))}
                </Card>
              )}

              <SectionTitle>By category</SectionTitle>
              {data.by_category.length === 0 ? (
                <EmptyNote>Nothing to break down yet.</EmptyNote>
              ) : (
                <Card style={styles.table}>
                  {data.by_category.map((k, i) => (
                    <View key={k.category} style={styles.catRow}>
                      <View style={styles.catLine}>
                        <ThemedText type="medium" style={styles.catName} numberOfLines={1}>
                          {k.category}
                        </ThemedText>
                        <ThemedText type="caption" themeColor="textMuted">
                          {pluralise(k.claims, 'claim')}
                        </ThemedText>
                        <ThemedText style={styles.amount}>{formatMoney(k.approved_amount, currency)}</ThemedText>
                      </View>
                      <GrowBar fraction={(k.approved_amount + k.pending_amount) / max} color={theme.accent} trackColor={theme.track} height={10} delay={120 + i * 50} />
                    </View>
                  ))}
                </Card>
              )}

              <SectionTitle>Flagged claims</SectionTitle>
              {data.flagged.length === 0 ? (
                <EmptyNote>No policy flags this month.</EmptyNote>
              ) : (
                <GroupCard tone="pink" icon={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }} kicker={pluralise(data.flagged.length, 'claim')} title="Flagged" subtitle="Over a cap, late, or a possible duplicate">
                  {data.flagged.map((c, i) => (
                    <ClaimRow key={c.id} claim={c} index={i} showEmployee last={i === data.flagged.length - 1} />
                  ))}
                </GroupCard>
              )}
            </Reveal>
          </>
        ) : null}
      </>
    </Screen>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginHorizontal: Spacing.three, paddingVertical: Spacing.two, borderTopWidth: 1, borderBottomWidth: 1, marginBottom: Spacing.three },
  navButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  navTitle: { flex: 1, alignItems: 'center', gap: Spacing.half },
  grid: { gap: Spacing.three, paddingHorizontal: Spacing.three },
  gridWide: { flexDirection: 'row' },
  gridGap: { paddingTop: Spacing.three },
  cell: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.four },
  notice: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, lineHeight: 20 },
  table: { gap: 0, paddingVertical: Spacing.one },
  tr: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two + Spacing.half },
  tdName: { flex: 1, gap: Spacing.half },
  tdAmount: { alignItems: 'flex-end', gap: Spacing.half },
  amount: { fontFamily: Fonts.serif, fontSize: 20, lineHeight: 24, fontVariant: ['tabular-nums'] },
  catRow: { paddingVertical: Spacing.two, gap: Spacing.two },
  catLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  catName: { flex: 1 },
});
