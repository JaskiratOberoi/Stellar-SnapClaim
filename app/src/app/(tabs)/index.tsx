import { router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components/chip';
import { ClaimRow } from '@/components/claim-row';
import { EmptyNote, ErrorNote, Loading, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useRequest } from '@/hooks/use-request';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { CountUp } from '@/motion/count-up';
import { Presence } from '@/motion/presence';
import { Reveal } from '@/motion/reveal';
import { Tap } from '@/motion/tap';
import { api } from '@/services/api';
import { currentPeriod, formatMoney, pluralise } from '@/services/format';
import type { Claim, ClaimStatus } from '@/services/types';

type Filter = 'all' | ClaimStatus;
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'submitted', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'cleared', label: 'Cleared' },
  { value: 'rejected', label: 'Rejected' },
];

const whole = (n: number) => String(Math.round(n));

export default function MyClaimsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user, company } = useSession();
  const [filter, setFilter] = useState<Filter>('all');
  const { data, error, loading, reload } = useRequest(
    () => api<{ items: Claim[]; total: number }>(`/api/v1/claims/?scope=mine${filter === 'all' ? '' : `&status=${filter}`}`),
    [filter],
  );
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const items = data?.items ?? [];
  const period = currentPeriod();
  const thisMonth = items.filter((c) => c.period === period && c.status !== 'rejected' && c.status !== 'draft');
  const pending = items.filter((c) => c.status === 'submitted');
  const currency = company?.currency ?? 'INR';
  const money = useCallback((n: number) => formatMoney(Math.round(n), currency), [currency]);

  return (
    <Screen title="My claims" subtitle={user?.full_name}>
      <FlatList
        data={items}
        keyExtractor={(c) => c.id}
        renderItem={({ item, index }) => <ClaimRow claim={item} index={index} />}
        ListHeaderComponent={
          <View>
            <Presence visible={filter === 'all'} y={8}>
              <View style={styles.tiles}>
                <Reveal delay={0} style={styles.hero}>
                  <Tile hero label="This month" value={thisMonth.reduce((s, c) => s + c.amount, 0)} format={money} />
                </Reveal>
                <Reveal delay={60} style={styles.flex}>
                  <Tile label="Awaiting" value={pending.length} format={whole} tone={pending.length ? 'warning' : undefined} />
                </Reveal>
                <Reveal delay={120} style={styles.flex}>
                  <Tile label="Claims" value={data?.total ?? 0} format={whole} />
                </Reveal>
              </View>
            </Presence>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filters}>
              {FILTERS.map((f) => (
                <Chip key={f.value} label={f.label} selected={filter === f.value} onPress={() => setFilter(f.value)} />
              ))}
            </ScrollView>
            {error ? <ErrorNote message={error} onRetry={reload} /> : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <Loading />
          ) : (
            <Reveal y={8}>
              <EmptyNote>
                {filter === 'all' ? 'No claims yet. Tap Snap receipt to file your first one.' : `No ${FILTERS.find((f) => f.value === filter)?.label.toLowerCase()} claims.`}
              </EmptyNote>
            </Reveal>
          )
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        keyboardShouldPersistTaps="handled"
      />
      <Reveal delay={200} y={20} style={[styles.fabOuter, { bottom: insets.bottom + Spacing.three }]}>
        <Tap
          accessibilityRole="button"
          accessibilityLabel="Snap receipt"
          scale={0.93}
          onPress={() => router.push('/claim/new')}
          style={({ pressed }) => [styles.fab, { backgroundColor: pressed ? theme.accentStrong : theme.accent, shadowColor: theme.shadow }]}>
          <SymbolView name={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }} size={20} tintColor={theme.textOnAccent} />
          <ThemedText style={{ color: theme.textOnAccent, fontWeight: 700 }}>Snap receipt</ThemedText>
        </Tap>
      </Reveal>
      {data && data.total > items.length ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.more}>
          Showing {pluralise(items.length, 'claim')} of {data.total}
        </ThemedText>
      ) : null}
    </Screen>
  );
}

function Tile({ label, value, format, tone, hero }: { label: string; value: number; format: (n: number) => string; tone?: 'warning'; hero?: boolean }) {
  const theme = useTheme();
  const fg = hero ? theme.textOnAccent : tone === 'warning' ? theme.warning : theme.text;
  return (
    <View style={[styles.tile, { backgroundColor: hero ? theme.accent : theme.backgroundElement }]}>
      <ThemedText type="small" style={{ color: hero ? theme.textOnAccent : theme.textSecondary, opacity: hero ? 0.85 : 1 }} numberOfLines={1}>
        {label}
      </ThemedText>
      <CountUp value={value} format={format} style={[styles.tileValue, { color: fg }]} numberOfLines={1} adjustsFontSizeToFit />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { flex: 1.5 },
  tiles: { flexDirection: 'row', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  tile: { flex: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, gap: Spacing.one, minHeight: 84, justifyContent: 'flex-end' },
  tileValue: { fontSize: 24, lineHeight: 30, fontWeight: 800, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  filterScroll: { flexGrow: 0 },
  filters: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three },
  fabOuter: { position: 'absolute', right: Spacing.three },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    height: 54,
    borderRadius: Radius.pill,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  more: { textAlign: 'center', paddingBottom: Spacing.two },
});
