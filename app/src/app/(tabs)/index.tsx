import { router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { ReceiptArt } from '@/components/art';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { GetAppCard } from '@/components/get-app-card';
import { ClaimRow } from '@/components/claim-row';
import { GroupCard } from '@/components/group-card';
import { EmptyNote, ErrorNote, Screen, SectionTitle } from '@/components/screen';
import { ClaimsSkeleton } from '@/components/skeleton';
import { StatCard } from '@/components/stat-card';
import { ThemedText } from '@/components/themed-text';
import { STATUS_GROUP, STATUS_ICON, STATUS_ORDER } from '@/constants/status';
import { PhoneWidth, Radius, Spacing, StatusTone, Tones } from '@/constants/theme';
import { useTourOnce } from '@/guide/guide';
import { GuideTarget } from '@/guide/target';
import { homeTour } from '@/guide/tours';
import { useRequest } from '@/hooks/use-request';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { Reveal } from '@/motion/reveal';
import { Tap } from '@/motion/tap';
import { api } from '@/services/api';
import { currentPeriod, formatMoney, pluralise, toIso } from '@/services/format';
import type { Claim, ClaimStatus } from '@/services/types';

type Filter = 'all' | ClaimStatus;
type Page = { items: Claim[]; total: number };

export default function TodayScreen() {
  const theme = useTheme();
  const wide = useWindowDimensions().width >= PhoneWidth;
  const { user, company, policy, can, extractionEnabled } = useSession();
  const [filter, setFilter] = useState<Filter>('all');
  const list = useRequest(() => api<Page>('/api/v1/claims/?scope=mine&limit=500'), []);
  const reload = list.reload;
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const currency = company?.currency ?? 'INR';
  const money = useCallback((n: number) => formatMoney(Math.round(n), currency), [currency]);
  const whole = (n: number) => String(Math.round(n));
  const items = list.data?.items ?? [];
  const period = currentPeriod();
  const monthItems = items.filter((c) => c.period === period);
  const live = monthItems.filter((c) => c.status !== 'rejected' && c.status !== 'draft');
  const total = live.reduce((s, c) => s + c.amount, 0);
  const cap = policy.find((r) => r.category_id == null)?.max_per_month ?? null;
  const pending = items.filter((c) => c.status === 'submitted');
  const pendingAmount = pending.reduce((s, c) => s + c.amount, 0);
  const groups = STATUS_ORDER.map((status) => ({ status, items: items.filter((c) => c.status === status) })).filter((g) => g.items.length > 0 && (filter === 'all' || filter === g.status));

  // The last seven days, a tick for each day with a claim.
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    return toIso(d);
  });
  const spentDays = new Set(items.map((c) => c.spent_on));
  const weekCount = items.filter((c) => days.includes(c.spent_on)).length;

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning.' : hour < 17 ? 'Good afternoon.' : 'Good evening.';
  const dateLine = `${now.toLocaleDateString('en-GB', { weekday: 'long' })} ${now.getDate()} ${now.toLocaleDateString('en-GB', { month: 'long' })}`;
  const firstName = user?.full_name.split(' ')[0] ?? '';

  // The welcome tour, the first time this person lands here with their claims loaded.
  const tour = useMemo(
    () => (user ? homeTour({ firstName, managerName: user.manager_name ?? null, hasCap: cap !== null, approves: can('claims.approve'), reviews: can('months.review'), extraction: extractionEnabled }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id, firstName, user?.manager_name, cap, extractionEnabled],
  );
  useTourOnce(tour, list.data !== null);

  const settings = (
    <Tap accessibilityRole="button" accessibilityLabel="Settings" hitSlop={8} scale={0.9} onPress={() => router.push('/more')} style={styles.gear}>
      <SymbolView name={{ ios: 'gearshape', android: 'settings', web: 'settings' }} size={22} tintColor={theme.textSecondary} />
    </Tap>
  );

  return (
    <Screen title={greeting} eyebrow={dateLine} large action={settings} scroll>
      <>
        <GuideTarget id="chips" style={styles.chips}>
          <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
          {STATUS_ORDER.map((s) => {
            const n = items.filter((c) => c.status === s).length;
            return <Chip key={s} label={n ? `${STATUS_GROUP[s]} · ${n}` : STATUS_GROUP[s]} tone={StatusTone[s]} icon={STATUS_ICON[s]} selected={filter === s} onPress={() => setFilter(filter === s ? 'all' : s)} />;
          })}
        </GuideTarget>

        {list.error ? <ErrorNote message={list.error} onRetry={list.reload} /> : null}

        <View style={[styles.grid, wide && styles.gridWide]}>
          <Reveal y={10} style={styles.cell}>
            <GuideTarget id="month">
            <StatCard
              tone="green"
              icon={{ ios: 'indianrupeesign.circle.fill', android: 'payments', web: 'payments' }}
              label="This month"
              trailing={cap !== null ? `${money(Math.max(0, cap - total))} to go` : 'No monthly cap'}
              value={total}
              format={money}
              unit={cap !== null ? `/ ${money(cap)}` : undefined}
              fraction={cap !== null ? total / cap : undefined}
              note={live.length ? `${pluralise(live.length, 'claim')} this month` : `Nothing claimed yet, ${firstName}`}
            />
            </GuideTarget>
          </Reveal>
          <Reveal y={10} delay={60} style={styles.cell}>
            <GuideTarget id="waiting">
            <StatCard
              tone="amber"
              icon={STATUS_ICON.submitted}
              label="Awaiting approval"
              trailing={pending.length ? `${money(pendingAmount)} waiting` : 'Nothing waiting'}
              value={pending.length}
              format={whole}
              unit={`/ ${pluralise(items.length, 'claim')}`}
              fraction={items.length ? pending.length / items.length : 0}
              note={user?.manager_name ? `Goes to ${user.manager_name}` : 'No approver set'}
              delay={60}
            />
            </GuideTarget>
          </Reveal>
        </View>
        <Reveal y={10} delay={120} style={styles.full}>
          <StatCard
            tone="blue"
            icon={{ ios: 'calendar', android: 'calendar_today', web: 'calendar_today' }}
            label="Last 7 days"
            trailing={weekCount ? `${pluralise(weekCount, 'receipt')} snapped` : 'Nothing snapped'}
            value={weekCount}
            format={whole}
            unit="/ 7 days"
            delay={120}>
            <View style={styles.weekRow}>
              <View style={styles.ticks}>
                {days.map((d, i) => (
                  <Reveal key={d} delay={200 + i * 40} y={4}>
                    <View style={[styles.tick, { borderColor: Tones.blue.base, backgroundColor: spentDays.has(d) ? Tones.blue.base : 'transparent' }]} />
                  </Reveal>
                ))}
              </View>
              <GuideTarget id="snap">
                <Button title="Snap a receipt" tone="blue" compact icon={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }} onPress={() => router.push('/claim/new')} />
              </GuideTarget>
            </View>
          </StatCard>
        </Reveal>

        <GetAppCard />

        <SectionTitle>Your claims</SectionTitle>
        {list.loading && items.length === 0 ? <ClaimsSkeleton /> : null}
        {!list.loading && groups.length === 0 ? (
          <GroupCard
            tone="sage"
            icon={{ ios: 'doc.text.fill', android: 'receipt_long', web: 'receipt_long' }}
            kicker="Any time"
            title="Nothing here yet"
            subtitle={filter === 'all' ? 'Anything you snap lands here.' : `No ${STATUS_GROUP[filter].toLowerCase()} claims.`}
            footer={
              <>
                <Button title="Snap a receipt" icon={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }} onPress={() => router.push('/claim/new')} />
                <Button title="Add by hand" variant="ghost" onPress={() => router.push('/claim/new')} />
              </>
            }>
            <View style={styles.emptyArt}>
              <ReceiptArt width={168} />
            </View>
            <EmptyNote>{filter === 'all' ? 'Snap the bill and it reads itself into a claim; the policy check runs as you type.' : 'Clear the filter to see every claim.'}</EmptyNote>
          </GroupCard>
        ) : null}
        {groups.map((g, gi) => {
          const sum = g.items.reduce((s, c) => s + c.amount, 0);
          return (
            <Reveal key={g.status} y={10} delay={gi * 60} style={styles.group}>
              <GroupCard
                tone={StatusTone[g.status]}
                icon={STATUS_ICON[g.status]}
                kicker={pluralise(g.items.length, 'claim')}
                title={STATUS_GROUP[g.status]}
                subtitle={`${formatMoney(sum, currency)} in total`}
                footer={
                  g.status === 'draft' ? (
                    <>
                      <Button title="Snap a receipt" tone={StatusTone[g.status]} compact icon={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }} onPress={() => router.push('/claim/new')} />
                      <Button title="Add by hand" variant="ghost" compact tone={StatusTone[g.status]} onPress={() => router.push('/claim/new')} />
                    </>
                  ) : undefined
                }>
                {g.items.map((c, i) => (
                  <ClaimRow key={c.id} claim={c} index={i} showStatus={false} last={i === g.items.length - 1} />
                ))}
              </GroupCard>
            </Reveal>
          );
        })}
        {groups.length > 0 && !groups.some((g) => g.status === 'draft') ? (
          <View style={styles.actions}>
            <Button title="Snap a receipt" icon={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }} onPress={() => router.push('/claim/new')} />
            <Button title="Add by hand" variant="ghost" onPress={() => router.push('/claim/new')} />
          </View>
        ) : null}
        <ThemedText type="caption" themeColor="textMuted" style={styles.foot}>
          {list.data ? `${pluralise(list.data.total, 'claim')} on record` : ''}
        </ThemedText>
      </>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gear: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.one, paddingBottom: Spacing.three },
  grid: { gap: Spacing.three, paddingHorizontal: Spacing.three },
  gridWide: { flexDirection: 'row' },
  cell: { flex: 1 },
  full: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  weekRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three, flexWrap: 'wrap', paddingTop: Spacing.one },
  ticks: { flexDirection: 'row', gap: Spacing.one + Spacing.half },
  tick: { width: 14, height: 18, borderRadius: 4, borderWidth: 1.5 },
  group: { paddingTop: Spacing.three },
  emptyArt: { alignItems: 'center', paddingTop: Spacing.two },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.four },
  foot: { paddingHorizontal: Spacing.three, paddingTop: Spacing.four, textAlign: 'center' },
  pill: { borderRadius: Radius.pill },
});
