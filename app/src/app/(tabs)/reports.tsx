import { useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ClaimRow } from '@/components/claim-row';
import { Card, EmptyNote, ErrorNote, Loading, Screen, SectionTitle } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useRequest } from '@/hooks/use-request';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { CountUp } from '@/motion/count-up';
import { GrowBar } from '@/motion/grow-bar';
import { Presence } from '@/motion/presence';
import { Reveal } from '@/motion/reveal';
import { Tap } from '@/motion/tap';
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
  const money = useCallback((n: number) => formatMoney(Math.round(n), currency), [currency]);

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
  const max = data ? Math.max(...data.by_category.map((x) => x.approved_amount + x.pending_amount), 1) : 1;

  return (
    <Screen title="Month-end review" subtitle={company?.name}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.six }}>
        <View style={styles.nav}>
          <Tap
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            scale={0.88}
            onPress={() => setPeriod(shiftPeriod(period, -1))}
            style={({ pressed }) => [styles.navButton, { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement }]}>
            <SymbolView name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }} size={18} tintColor={theme.text} />
          </Tap>
          <View style={styles.navTitle}>
            <Reveal key={period} y={6}>
              <ThemedText style={styles.month}>{formatMonth(period)}</ThemedText>
            </Reveal>
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
          <Tap
            accessibilityRole="button"
            accessibilityLabel="Next month"
            disabled={isCurrent}
            scale={0.88}
            onPress={() => setPeriod(shiftPeriod(period, 1))}
            style={({ pressed }) => [styles.navButton, { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement, opacity: isCurrent ? 0.4 : 1 }]}>
            <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={18} tintColor={theme.text} />
          </Tap>
        </View>

        {error ? <ErrorNote message={error} onRetry={reload} /> : null}
        {loading && !data ? <Loading /> : null}

        {m && data ? (
          <>
            <View style={styles.tiles}>
              <Tile label="Pending" value={m.pending_amount} format={money} count={m.submitted} tone="warning" delay={0} />
              <Tile label="Approved" value={m.approved_amount} format={money} count={m.approved} tone="accent" delay={50} />
              <Tile label="Cleared" value={m.cleared_amount} format={money} count={m.cleared} tone="success" delay={100} />
              <Tile label="Rejected" value={m.rejected} format={(n) => String(Math.round(n))} count={m.rejected} tone="danger" delay={150} />
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

            <Reveal key={period} y={10} delay={80}>
              <SectionTitle>By employee</SectionTitle>
              {data.by_employee.length === 0 ? (
                <EmptyNote>No claims this month.</EmptyNote>
              ) : (
                <Card style={styles.table}>
                  {data.by_employee.map((e) => (
                    <View key={e.employee_id} style={[styles.tr, { borderBottomColor: theme.border }]}>
                      <View style={styles.tdName}>
                        <ThemedText numberOfLines={1} style={{ fontWeight: 600 }}>
                          {e.full_name}
                        </ThemedText>
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
              {data.by_category.length === 0 ? (
                <EmptyNote>Nothing to break down yet.</EmptyNote>
              ) : (
                <Card style={styles.table}>
                  {data.by_category.map((k, i) => (
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
                      <GrowBar fraction={(k.approved_amount + k.pending_amount) / max} color={theme.accent} trackColor={theme.backgroundSelected} delay={120 + i * 50} />
                    </View>
                  ))}
                </Card>
              )}

              <SectionTitle>Flagged claims</SectionTitle>
              {data.flagged.length === 0 ? <EmptyNote>No policy flags this month.</EmptyNote> : data.flagged.map((c, i) => <ClaimRow key={c.id} claim={c} index={i} showEmployee />)}
            </Reveal>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Tile({
  label,
  value,
  format,
  count,
  tone,
  delay,
}: {
  label: string;
  value: number;
  format: (n: number) => string;
  count: number;
  tone: 'warning' | 'accent' | 'success' | 'danger';
  delay: number;
}) {
  const theme = useTheme();
  const color = { warning: theme.warning, accent: theme.accent, success: theme.success, danger: theme.danger }[tone];
  return (
    <Reveal delay={delay} y={10} style={styles.tileOuter}>
      <View style={[styles.tile, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {label}
        </ThemedText>
        <CountUp value={value} format={format} style={[styles.tileValue, { color }]} numberOfLines={1} adjustsFontSizeToFit />
        <ThemedText type="small" themeColor="textSecondary">
          {pluralise(count, 'claim')}
        </ThemedText>
      </View>
    </Reveal>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  navButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  navTitle: { flex: 1, alignItems: 'center', gap: Spacing.half },
  month: { fontSize: 20, lineHeight: 26, fontWeight: 800, letterSpacing: -0.3 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  tileOuter: { flexBasis: '46%', flexGrow: 1 },
  tile: { borderRadius: Radius.medium, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, gap: Spacing.half },
  tileValue: { fontSize: 24, lineHeight: 30, fontWeight: 800, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  notice: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, lineHeight: 20 },
  table: { gap: 0, paddingVertical: Spacing.one },
  tr: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two + Spacing.half, borderBottomWidth: StyleSheet.hairlineWidth },
  tdName: { flex: 1, gap: Spacing.half },
  tdAmount: { alignItems: 'flex-end', gap: Spacing.half },
  amount: { fontWeight: 700, fontVariant: ['tabular-nums'] },
  catRow: { paddingVertical: Spacing.two, gap: Spacing.one + Spacing.half },
  catLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  catName: { flex: 1, fontWeight: 600 },
});
