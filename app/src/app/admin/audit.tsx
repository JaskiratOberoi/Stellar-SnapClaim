import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Field } from '@/components/field';
import { Card, EmptyNote, ErrorNote, Loading, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing, Tones, type ToneName } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Reveal } from '@/motion/reveal';
import { api, describeError } from '@/services/api';
import { formatDateTime, pluralise } from '@/services/format';
import type { AuditEntry } from '@/services/types';

const GROUPS: { prefix: string; label: string; tone: ToneName }[] = [
  { prefix: '', label: 'Everything', tone: 'sage' },
  { prefix: 'claim.', label: 'Claims', tone: 'blue' },
  { prefix: 'approval.', label: 'Decisions', tone: 'indigo' },
  { prefix: 'receipt.', label: 'Receipts', tone: 'orange' },
  { prefix: 'month.', label: 'Month-end', tone: 'green' },
  { prefix: 'user.', label: 'People', tone: 'plum' },
  { prefix: 'policy.', label: 'Policy', tone: 'tan' },
  { prefix: 'auth.', label: 'Sign-ins', tone: 'amber' },
];

const PAGE = 50;

function toneFor(action: string): ToneName {
  if (action === 'approval.reject' || action === 'auth.login_failed' || action.endsWith('.delete') || action === 'user.deactivate') return 'pink';
  return GROUPS.find((g) => g.prefix && action.startsWith(g.prefix))?.tone ?? 'sage';
}

/** Every action anyone took, newest first, filtered by kind or by a word. */
export default function AuditScreen() {
  const theme = useTheme();
  const [prefix, setPrefix] = useState('');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (offset: number, replace: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
      if (prefix) params.set('prefix', prefix);
      if (query.trim()) params.set('q', query.trim());
      const page = await api<{ items: AuditEntry[]; total: number }>(`/api/v1/audit/?${params}`);
      setItems((prev) => (replace ? page.items : [...prev, ...page.items]));
      setTotal(page.total);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  }, [prefix, query]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      load(0, true);
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [load]);

  return (
    <Screen scroll title="Audit trail" subtitle="Every sign-in, claim, decision and change, newest first. Each entry names who, what and when." back>
      <>
        <View style={styles.filters}>
          {GROUPS.map((g) => (
            <Chip key={g.prefix} label={g.label} tone={g.tone} selected={prefix === g.prefix} onPress={() => setPrefix(g.prefix)} />
          ))}
        </View>
        <View style={styles.search}>
          <Field label="Find" value={query} onChangeText={setQuery} placeholder="A name, a word from the entry, or a claim id" autoCapitalize="none" />
        </View>
        {error ? <ErrorNote message={error} onRetry={() => load(0, true)} /> : null}
        {items.length === 0 && !loading ? <EmptyNote>Nothing recorded yet for this filter.</EmptyNote> : null}
        {items.length > 0 ? (
          <Card style={styles.list}>
            {items.map((e, i) => {
              const t = Tones[toneFor(e.action)];
              return (
                <Reveal key={e.id} delay={Math.min(i, 8) * 25} y={6}>
                  <View style={[styles.row, { borderBottomColor: theme.border, borderBottomWidth: i === items.length - 1 ? 0 : StyleSheet.hairlineWidth }]}>
                    <View style={[styles.dot, { backgroundColor: t.base }]} />
                    <View style={styles.text}>
                      <ThemedText type="medium">{e.summary}</ThemedText>
                      <ThemedText type="small" themeColor="textMuted" numberOfLines={1}>
                        {[e.actor_name || 'System', formatDateTime(e.created_at), e.ip].filter(Boolean).join(' · ')}
                      </ThemedText>
                    </View>
                    <View style={[styles.pill, { backgroundColor: t.soft }]}>
                      <ThemedText type="caption" style={{ color: t.ink, fontWeight: 600 }}>
                        {e.action}
                      </ThemedText>
                    </View>
                  </View>
                </Reveal>
              );
            })}
          </Card>
        ) : null}
        {loading ? <Loading /> : null}
        <View style={styles.foot}>
          <ThemedText type="caption" themeColor="textMuted">
            {total ? `${items.length} of ${pluralise(total, 'entry').replace('entrys', 'entries')}` : ''}
          </ThemedText>
          {items.length < total ? <Button title="Load more" variant="secondary" compact onPress={() => load(items.length, false)} loading={loading} /> : null}
        </View>
      </>
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.one },
  search: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  list: { padding: 0, gap: 0, overflow: 'hidden', marginTop: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + Spacing.half },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { flex: 1, gap: 2 },
  pill: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, borderRadius: 999 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.three, paddingVertical: Spacing.four },
});
