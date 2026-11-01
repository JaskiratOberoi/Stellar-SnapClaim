import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { FlagList } from '@/components/flag-list';
import { Card, ErrorNote, Loading, Screen, SectionTitle } from '@/components/screen';
import { StatusBadge } from '@/components/status-badge';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useRequest } from '@/hooks/use-request';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { api, describeError, receiptImageUrl } from '@/services/api';
import { formatDate, formatDateTime, formatMoney, formatNumber } from '@/services/format';
import type { ClaimDetail } from '@/services/types';

const EVENT_LABEL: Record<string, string> = {
  created: 'Created',
  updated: 'Edited',
  submitted: 'Submitted for approval',
  withdrawn: 'Withdrawn to draft',
  approved: 'Approved',
  rejected: 'Rejected',
  cleared: 'Cleared at month-end',
};

export default function ClaimDetailScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, can } = useSession();
  const { data, error, loading, reload } = useRequest(() => api<ClaimDetail>(`/api/v1/claims/${id}`), [id]);
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<unknown>, after?: () => void) => {
    setBusy(key);
    setActionError(null);
    try {
      await fn();
      if (after) after();
      else reload();
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setBusy(null);
    }
  };

  if (!data) {
    return (
      <Screen title="Claim" back>
        {error ? <ErrorNote message={error} onRetry={reload} /> : <Loading />}
      </Screen>
    );
  }

  const { claim, lines, receipts, events } = data;
  const mine = claim.employee.id === user?.id;
  const editable = mine && (claim.status === 'draft' || claim.status === 'rejected');
  const canDecide = !mine && can('claims.approve') && claim.status === 'submitted';

  return (
    <Screen title={claim.title} subtitle={`Claim #${claim.claim_no}${mine ? '' : ` · ${claim.employee.full_name}`}`} back>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.six }} keyboardShouldPersistTaps="handled">
        <Card style={styles.hero}>
          <View style={styles.heroTop}>
            <ThemedText style={styles.amount}>{formatMoney(claim.amount, claim.currency)}</ThemedText>
            <StatusBadge status={claim.status} />
          </View>
          <Meta label="Date" value={formatDate(claim.spent_on)} />
          <Meta label="Category" value={claim.category?.name ?? 'Uncategorised'} />
          {claim.vendor ? <Meta label="Vendor" value={claim.vendor} /> : null}
          {claim.tax_amount > 0 ? <Meta label="Tax included" value={formatMoney(claim.tax_amount, claim.currency)} /> : null}
          {!mine ? <Meta label="Employee" value={[claim.employee.full_name, claim.employee.employee_code, claim.employee.department].filter(Boolean).join(' · ')} /> : null}
          {claim.notes ? <Meta label="Notes" value={claim.notes} /> : null}
          {claim.decision_note ? <Meta label={claim.status === 'rejected' ? 'Rejected because' : 'Manager note'} value={`${claim.decision_note} — ${claim.decided_by_name ?? ''}`} /> : null}
        </Card>

        {claim.policy_flags.length > 0 ? (
          <>
            <SectionTitle>Policy flags</SectionTitle>
            <FlagList flags={claim.policy_flags} />
          </>
        ) : null}

        <SectionTitle>Receipts</SectionTitle>
        {receipts.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            No receipt attached.
          </ThemedText>
        ) : (
          <View style={styles.receipts}>
            {receipts.map((r) => (
              <Pressable
                key={r.id}
                accessibilityRole="button"
                accessibilityLabel="View receipt"
                onPress={() => router.push({ pathname: '/receipt/[id]', params: { id: r.id } })}
                style={[styles.thumb, { backgroundColor: theme.backgroundElement }]}>
                {r.content_type === 'application/pdf' ? (
                  <View style={styles.pdf}>
                    <SymbolView name={{ ios: 'doc.richtext', android: 'picture_as_pdf', web: 'picture_as_pdf' }} size={32} tintColor={theme.textSecondary} />
                    <ThemedText type="small" themeColor="textSecondary">
                      PDF
                    </ThemedText>
                  </View>
                ) : (
                  <Image source={{ uri: receiptImageUrl(r.id) }} style={styles.flex} contentFit="cover" />
                )}
              </Pressable>
            ))}
          </View>
        )}

        {lines.length > 0 ? (
          <>
            <SectionTitle>Line items</SectionTitle>
            <Card style={styles.lines}>
              {lines.map((l, i) => (
                <View key={l.id ?? i} style={styles.line}>
                  <ThemedText style={styles.lineDesc} numberOfLines={2}>
                    {l.description}
                  </ThemedText>
                  {l.quantity && l.quantity !== 1 ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      × {formatNumber(l.quantity)}
                    </ThemedText>
                  ) : null}
                  <ThemedText style={styles.lineAmt}>{formatMoney(l.amount, claim.currency)}</ThemedText>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        {actionError ? <ErrorNote message={actionError} /> : null}

        {editable || (mine && claim.status === 'submitted') || canDecide ? <SectionTitle>Actions</SectionTitle> : null}
        {editable ? (
          <View style={styles.actions}>
            <Button title="Edit" variant="secondary" icon={{ ios: 'pencil', android: 'edit', web: 'edit' }} onPress={() => router.push({ pathname: '/claim/new', params: { id: claim.id } })} />
            <Button title="Submit" icon={{ ios: 'paperplane.fill', android: 'send', web: 'send' }} loading={busy === 'submit'} disabled={busy !== null} onPress={() => run('submit', () => api(`/api/v1/claims/${claim.id}/submit`, { method: 'POST' }))} />
            <Button
              title={confirmDelete ? 'Confirm delete' : 'Delete'}
              variant={confirmDelete ? 'danger' : 'ghost'}
              loading={busy === 'delete'}
              disabled={busy !== null}
              onPress={() => (confirmDelete ? run('delete', () => api(`/api/v1/claims/${claim.id}`, { method: 'DELETE' }), () => router.back()) : setConfirmDelete(true))}
            />
          </View>
        ) : null}
        {mine && claim.status === 'submitted' ? (
          <View style={styles.actions}>
            <Button title="Withdraw to draft" variant="secondary" loading={busy === 'withdraw'} disabled={busy !== null} onPress={() => run('withdraw', () => api(`/api/v1/claims/${claim.id}/withdraw`, { method: 'POST' }))} />
          </View>
        ) : null}
        {canDecide ? (
          <View style={styles.decide}>
            {rejecting ? <Field label="Reason for rejection" value={note} onChangeText={setNote} placeholder="Tell the employee what to fix" autoFocus /> : null}
            <View style={styles.actions}>
              <Button
                title={rejecting ? 'Confirm reject' : 'Reject'}
                variant="danger"
                loading={busy === 'reject'}
                disabled={busy !== null || (rejecting && !note.trim())}
                onPress={() => (rejecting ? run('reject', () => api('/api/v1/approvals/decide', { body: { claim_ids: [claim.id], decision: 'reject', note: note.trim() } })) : setRejecting(true))}
              />
              {rejecting ? (
                <Button title="Cancel" variant="secondary" onPress={() => setRejecting(false)} />
              ) : (
                <Button
                  title="Approve"
                  icon={{ ios: 'checkmark', android: 'check', web: 'check' }}
                  loading={busy === 'approve'}
                  disabled={busy !== null}
                  onPress={() => run('approve', () => api('/api/v1/approvals/decide', { body: { claim_ids: [claim.id], decision: 'approve', note: note.trim() || null } }))}
                />
              )}
            </View>
          </View>
        ) : null}

        <SectionTitle>History</SectionTitle>
        <View style={styles.timeline}>
          {events.map((e) => (
            <View key={e.id} style={styles.event}>
              <View style={[styles.dot, { backgroundColor: e.action === 'rejected' ? theme.danger : e.action === 'approved' || e.action === 'cleared' ? theme.success : theme.textSecondary }]} />
              <View style={styles.eventText}>
                <ThemedText type="small">
                  {EVENT_LABEL[e.action] ?? e.action}
                  {e.actor_name ? ` · ${e.actor_name}` : ''}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatDateTime(e.created_at)}
                  {e.note ? ` · ${e.note}` : ''}
                </ThemedText>
              </View>
            </View>
          ))}
        </View>
        {loading ? <Loading /> : null}
      </ScrollView>
    </Screen>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.meta}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.metaLabel}>
        {label}
      </ThemedText>
      <ThemedText type="small" style={styles.metaValue}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { marginTop: Spacing.three },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.two },
  amount: { fontSize: 30, lineHeight: 36, fontWeight: 800 },
  meta: { flexDirection: 'row', gap: Spacing.two },
  metaLabel: { width: 110 },
  metaValue: { flex: 1 },
  hint: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  receipts: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  thumb: { width: 110, height: 140, borderRadius: Radius.medium, overflow: 'hidden' },
  pdf: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.one },
  lines: { gap: Spacing.two },
  line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  lineDesc: { flex: 1 },
  lineAmt: { fontWeight: 600 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  decide: { gap: Spacing.two, paddingTop: Spacing.two },
  timeline: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, gap: Spacing.two },
  event: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  eventText: { flex: 1 },
});
