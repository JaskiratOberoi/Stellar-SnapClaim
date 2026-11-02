import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { ClaimRow } from '@/components/claim-row';
import { ContourRings } from '@/components/contour';
import { EmptyNote, ErrorNote, Loading, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useRequest } from '@/hooks/use-request';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { CountUp } from '@/motion/count-up';
import { Reveal } from '@/motion/reveal';
import { Tap } from '@/motion/tap';
import { api } from '@/services/api';
import { currentPeriod, formatMoney, pluralise, toIso } from '@/services/format';
import type { Claim, ClaimStatus } from '@/services/types';

import { RailWidth } from './_layout';

type Filter = 'all' | ClaimStatus;
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'submitted', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'cleared', label: 'Cleared' },
  { value: 'rejected', label: 'Rejected' },
];

type Page = { items: Claim[]; total: number };

export default function ClaimsHome() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const twoColumn = width >= RailWidth;
  const { user, company } = useSession();
  const [filter, setFilter] = useState<Filter>('all');
  const period = currentPeriod();

  const list = useRequest(() => api<Page>(`/api/v1/claims/?scope=mine${filter === 'all' ? '' : `&status=${filter}`}`), [filter]);
  const month = useRequest(() => api<Page>(`/api/v1/claims/?scope=mine&period=${period}&limit=500`), [period]);
  const reloadList = list.reload;
  const reloadMonth = month.reload;
  useFocusEffect(
    useCallback(() => {
      reloadList();
      reloadMonth();
    }, [reloadList, reloadMonth]),
  );

  const currency = company?.currency ?? 'INR';
  const money = useCallback((n: number) => formatMoney(Math.round(n), currency), [currency]);
  const items = list.data?.items ?? [];
  const monthItems = month.data?.items ?? [];
  const live = monthItems.filter((c) => c.status !== 'rejected' && c.status !== 'draft');
  const total = live.reduce((s, c) => s + c.amount, 0);
  const pending = monthItems.filter((c) => c.status === 'submitted').length;
  const drafts = monthItems.filter((c) => c.status === 'draft').length;
  const firstName = user?.full_name.split(' ')[0] ?? '';

  const greeting = !month.data
    ? `Hello, ${firstName}.`
    : monthItems.length === 0
      ? 'Nothing on the go.'
      : pending > 0
        ? `${pluralise(pending, 'claim')} awaiting approval.`
        : drafts > 0
          ? `${pluralise(drafts, 'draft')} waiting on you.`
          : 'All clear this month.';
  const heroLine = total === 0 ? 'Room for your first claim.' : `Across ${pluralise(live.length, 'claim')}${pending ? ` · ${pending} awaiting approval` : ''}`;

  // The last seven days, a dot under each day with a claim.
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    return d;
  });
  const spentDays = new Set([...monthItems, ...items].map((c) => c.spent_on));
  const monthEnd = new Date(days[6].getFullYear(), days[6].getMonth() + 1, 0);

  const top = (
    <View>
      <Reveal y={12}>
        <View style={[styles.hero, { backgroundColor: theme.backgroundElement }]}>
          <ContourRings size={420} color={theme.accent} style={styles.rings} />
          <ThemedText type="eyebrow" themeColor="textSecondary">
            This month
          </ThemedText>
          <CountUp value={total} format={money} style={[styles.heroFigure, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit />
          <ThemedText type="small" themeColor="textSecondary" style={styles.heroLine}>
            {heroLine}
          </ThemedText>
          <View style={[styles.pill, { backgroundColor: theme.background }]}>
            <ThemedText type="eyebrow" themeColor="textSecondary" style={styles.pillText}>
              Month-end · {monthEnd.getDate()} {monthEnd.toLocaleDateString('en-GB', { month: 'short' })}
            </ThemedText>
          </View>
        </View>
      </Reveal>
      <Reveal y={10} delay={80}>
        <View style={styles.week}>
          {days.map((d, i) => {
            const today = i === 6;
            const iso = toIso(d);
            return (
              <View key={iso} style={styles.day}>
                <ThemedText type="eyebrow" themeColor="textSecondary" style={styles.dayLetter}>
                  {'SMTWTFS'[d.getDay()]}
                </ThemedText>
                <View style={[styles.dayNumber, today && { backgroundColor: theme.accent }]}>
                  <ThemedText type="small" style={{ color: today ? theme.textOnAccent : theme.text, fontWeight: 600 }}>
                    {d.getDate()}
                  </ThemedText>
                </View>
                <View style={[styles.dot, { backgroundColor: spentDays.has(iso) ? theme.accent : 'transparent' }]} />
              </View>
            );
          })}
        </View>
      </Reveal>
      <Reveal y={10} delay={140}>
        <Button title="Snap a receipt" icon={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }} onPress={() => router.push('/claim/new')} style={styles.cta} />
      </Reveal>
    </View>
  );

  const listHeader = (
    <View>
      <ThemedText type="eyebrow" themeColor="textSecondary" style={[styles.listTitle, twoColumn && styles.listTitleWide]}>
        Your claims
      </ThemedText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filters}>
        {FILTERS.map((f) => (
          <Chip key={f.value} label={f.label} selected={filter === f.value} onPress={() => setFilter(f.value)} />
        ))}
      </ScrollView>
      {list.error ? <ErrorNote message={list.error} onRetry={list.reload} /> : null}
    </View>
  );

  const empty = list.loading ? (
    <Loading />
  ) : (
    <Reveal y={8}>
      <EmptyNote>{filter === 'all' ? 'No claims yet. Snap a receipt to file your first one.' : `No ${FILTERS.find((f) => f.value === filter)?.label.toLowerCase()} claims.`}</EmptyNote>
    </Reveal>
  );

  const avatar = (
    <Tap accessibilityRole="button" accessibilityLabel="You" scale={0.9} onPress={() => router.push('/more')} style={[styles.avatar, { backgroundColor: theme.accent }]}>
      <ThemedText type="serif" style={{ color: theme.textOnAccent, fontSize: 18, lineHeight: 22 }}>
        {initials(user?.full_name ?? '')}
      </ThemedText>
    </Tap>
  );

  const today = new Date();
  const dateLine = `${today.toLocaleDateString('en-GB', { weekday: 'long' })}, ${today.getDate()} ${today.toLocaleDateString('en-GB', { month: 'long' })}`;

  return (
    <Screen title={greeting} titleLines={2} subtitle={dateLine} action={avatar} wide={twoColumn}>
      {twoColumn ? (
        <View style={styles.columns}>
          <ScrollView style={styles.left} contentContainerStyle={styles.leftContent} showsVerticalScrollIndicator={false}>
            {top}
          </ScrollView>
          <FlatList
            style={styles.right}
            data={items}
            keyExtractor={(c) => c.id}
            renderItem={({ item, index }) => <ClaimRow claim={item} index={index} />}
            ListHeaderComponent={listHeader}
            ListEmptyComponent={empty}
            contentContainerStyle={styles.rightContent}
            keyboardShouldPersistTaps="handled"
          />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(c) => c.id}
          renderItem={({ item, index }) => <ClaimRow claim={item} index={index} />}
          ListHeaderComponent={
            <View>
              {top}
              {listHeader}
            </View>
          }
          ListEmptyComponent={empty}
          contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
          keyboardShouldPersistTaps="handled"
        />
      )}
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
  columns: { flex: 1, flexDirection: 'row', gap: Spacing.four, paddingHorizontal: Spacing.three },
  left: { width: 400, flexGrow: 0 },
  leftContent: { paddingBottom: Spacing.five },
  right: { flex: 1 },
  rightContent: { paddingBottom: Spacing.five },
  hero: {
    marginHorizontal: Spacing.three,
    marginTop: Spacing.two,
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
    borderRadius: 40,
    alignItems: 'center',
    gap: Spacing.one + Spacing.half,
    overflow: 'hidden',
    minHeight: 236,
    justifyContent: 'center',
  },
  rings: { position: 'absolute', top: -92 },
  heroFigure: { fontFamily: Fonts.serif, fontSize: 56, lineHeight: 62, letterSpacing: -1.2, fontVariant: ['tabular-nums'] },
  heroLine: { textAlign: 'center' },
  pill: { marginTop: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one + Spacing.half, borderRadius: Radius.pill },
  pillText: { fontSize: 10, letterSpacing: 0.9 },
  week: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: Spacing.three, marginTop: Spacing.four, paddingHorizontal: Spacing.one },
  day: { alignItems: 'center', gap: Spacing.one + Spacing.half, width: 40 },
  dayLetter: { fontSize: 10 },
  dayNumber: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3 },
  cta: { marginHorizontal: Spacing.three, marginTop: Spacing.four },
  listTitle: { paddingHorizontal: Spacing.three, paddingTop: Spacing.five, paddingBottom: Spacing.one },
  listTitleWide: { paddingTop: Spacing.two },
  filterScroll: { flexGrow: 0 },
  filters: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + Spacing.half },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
