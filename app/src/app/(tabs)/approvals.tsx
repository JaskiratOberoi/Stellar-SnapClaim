import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { ClaimRow } from '@/components/claim-row';
import { Field } from '@/components/field';
import { EmptyNote, ErrorNote, Loading, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useRequest } from '@/hooks/use-request';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { Presence } from '@/motion/presence';
import { Reveal } from '@/motion/reveal';
import { api, describeError } from '@/services/api';
import { formatMoney, pluralise } from '@/services/format';
import type { ApprovalQueue, Claim } from '@/services/types';

import { RailWidth } from './_layout';

export default function ApprovalsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { company, user } = useSession();
  const { data, error, loading, reload } = useRequest(() => api<ApprovalQueue>('/api/v1/approvals/'), []);
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const items = (data?.items ?? []).filter((c) => !onlyFlagged || c.policy_flags.length > 0);
  const chosen = items.filter((c) => selected.has(c.id));
  const chosenAmount = chosen.reduce((s, c) => s + c.amount, 0);

  const toggle = (claim: Claim) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(claim.id)) next.delete(claim.id);
      else next.add(claim.id);
      return next;
    });

  const decide = async (decision: 'approve' | 'reject') => {
    if (chosen.length === 0) return;
    if (decision === 'reject' && !note.trim()) {
      setRejecting(true);
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const result = await api<{ decided: string[]; skipped: { id: string; reason: string }[] }>('/api/v1/approvals/decide', {
        body: { claim_ids: chosen.map((c) => c.id), decision, note: note.trim() || null },
      });
      setNotice(`${decision === 'approve' ? 'Approved' : 'Rejected'} ${pluralise(result.decided.length, 'claim')}${result.skipped.length ? `, ${result.skipped.length} skipped` : ''}`);
      setSelected(new Set());
      setNote('');
      setRejecting(false);
      reload();
      setTimeout(() => setNotice(null), 4000);
    } catch (err) {
      setNotice(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      title="Approvals"
      subtitle={data ? `${pluralise(data.total, 'claim')} waiting · ${formatMoney(data.total_amount, company?.currency)}` : user?.full_name}>
      <FlatList
        data={items}
        keyExtractor={(c) => c.id}
        renderItem={({ item, index }) => <ClaimRow claim={item} index={index} showEmployee selected={selected.has(item.id)} onToggleSelect={toggle} />}
        ListHeaderComponent={
          <View style={styles.toolbar}>
            <Chip label={`All (${data?.total ?? 0})`} selected={!onlyFlagged} onPress={() => setOnlyFlagged(false)} />
            <Chip label={`Flagged (${data?.flagged ?? 0})`} selected={onlyFlagged} onPress={() => setOnlyFlagged(true)} tone="warning" />
            <View style={styles.spacer} />
            <Chip
              label={selected.size === items.length && items.length > 0 ? 'Clear' : 'Select all'}
              onPress={() => setSelected(selected.size === items.length ? new Set() : new Set(items.map((c) => c.id)))}
            />
            {error ? <ErrorNote message={error} onRetry={reload} /> : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <Loading />
          ) : (
            <Reveal y={8}>
              <EmptyNote>Nothing waiting for you. Submitted claims from your team land here.</EmptyNote>
            </Reveal>
          )
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 150 }}
        keyboardShouldPersistTaps="handled"
      />
      <Presence
        visible={chosen.length > 0 || notice !== null}
        y={24}
        style={[styles.bar, { backgroundColor: theme.surfaceRaised, shadowColor: theme.shadow, bottom: width >= RailWidth ? Spacing.four : insets.bottom + 96 }]}>
        {notice ? (
          <ThemedText type="small" themeColor="textSecondary">
            {notice}
          </ThemedText>
        ) : null}
        {chosen.length > 0 ? (
          <>
            {rejecting ? <Field label="Reason for rejection" value={note} onChangeText={setNote} placeholder="Tell the employee what to fix" autoFocus /> : null}
            <View style={styles.actions}>
              <ThemedText type="smallBold" style={styles.summary} numberOfLines={2}>
                {pluralise(chosen.length, 'claim')} · {formatMoney(chosenAmount, company?.currency)}
              </ThemedText>
              <Button title={rejecting ? 'Confirm reject' : 'Reject'} variant="danger" compact loading={busy && rejecting} disabled={busy} onPress={() => decide('reject')} />
              {rejecting ? (
                <Button title="Cancel" variant="secondary" compact onPress={() => setRejecting(false)} />
              ) : (
                <Button title="Approve" compact icon={{ ios: 'checkmark', android: 'check', web: 'check' }} loading={busy} onPress={() => decide('approve')} />
              )}
            </View>
          </>
        ) : null}
      </Presence>
    </Screen>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three },
  spacer: { flex: 1 },
  bar: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    borderRadius: Radius.large,
    padding: Spacing.three,
    gap: Spacing.two,
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  summary: { flex: 1 },
});
