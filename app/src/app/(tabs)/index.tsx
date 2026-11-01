import { router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components/chip';
import { ClaimRow } from '@/components/claim-row';
import { EmptyNote, ErrorNote, Loading, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useRequest } from '@/hooks/use-request';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
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

  return (
    <Screen title="My claims" subtitle={user?.full_name}>
      <FlatList
        data={items}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => <ClaimRow claim={item} />}
        ListHeaderComponent={
          <View>
            {filter === 'all' ? (
              <View style={styles.tiles}>
                <Tile label="This month" value={formatMoney(thisMonth.reduce((s, c) => s + c.amount, 0), currency)} />
                <Tile label="Awaiting approval" value={String(pending.length)} tone={pending.length ? 'warning' : undefined} />
                <Tile label="Claims" value={String(data?.total ?? 0)} />
              </View>
            ) : null}
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
            <EmptyNote>
              {filter === 'all' ? 'No claims yet. Tap Snap receipt to file your first one.' : `No ${FILTERS.find((f) => f.value === filter)?.label.toLowerCase()} claims.`}
            </EmptyNote>
          )
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        keyboardShouldPersistTaps="handled"
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Snap receipt"
        onPress={() => router.push('/claim/new')}
        style={({ pressed }) => [styles.fab, { backgroundColor: theme.accent, bottom: insets.bottom + Spacing.three, opacity: pressed ? 0.85 : 1 }]}>
        <SymbolView name={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }} size={20} tintColor={theme.textOnAccent} />
        <ThemedText style={{ color: theme.textOnAccent, fontWeight: 700 }}>Snap receipt</ThemedText>
      </Pressable>
      {data && data.total > items.length ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.more}>
          Showing {pluralise(items.length, 'claim')} of {data.total}
        </ThemedText>
      ) : null}
    </Screen>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: 'warning' }) {
  const theme = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        {label}
      </ThemedText>
      <ThemedText style={[styles.tileValue, tone === 'warning' && { color: theme.warning }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  tile: { flex: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + Spacing.half, gap: Spacing.half },
  tileValue: { fontSize: 22, lineHeight: 28, fontWeight: 700 },
  filterScroll: { flexGrow: 0 },
  filters: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three },
  fab: {
    position: 'absolute',
    right: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    height: 52,
    borderRadius: Radius.pill,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  more: { textAlign: 'center', paddingBottom: Spacing.two },
});
