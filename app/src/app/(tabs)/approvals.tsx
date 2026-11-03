import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InboxArt } from '@/components/art';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { ClaimRow } from '@/components/claim-row';
import { Field } from '@/components/field';
import { GroupCard } from '@/components/group-card';
import { EmptyNote, ErrorNote, Screen, SectionTitle } from '@/components/screen';
import { ClaimsSkeleton } from '@/components/skeleton';
import { StatCard } from '@/components/stat-card';
import { ThemedText } from '@/components/themed-text';
import { STATUS_ICON } from '@/constants/status';
import { PhoneWidth, Radius, SidebarWidth, Spacing } from '@/constants/theme';
import { useTourOnce } from '@/guide/guide';
import { GuideTarget } from '@/guide/target';
import { approvalsTour } from '@/guide/tours';
import { useRequest } from '@/hooks/use-request';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { Presence } from '@/motion/presence';
import { Reveal } from '@/motion/reveal';
import { api, describeError } from '@/services/api';
import { formatMoney, pluralise } from '@/services/format';
import type { ApprovalQueue, Claim } from '@/services/types';

export default function ApprovalsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= PhoneWidth;
  const { company } = useSession();
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
  useTourOnce(approvalsTour(), data !== null);

  const currency = company?.currency;
  const money = useCallback((n: number) => formatMoney(Math.round(n), currency), [currency]);
  const whole = (n: number) => String(Math.round(n));
  const all = data?.items ?? [];
  const items = all.filter((c) => !onlyFlagged || c.policy_flags.length > 0);
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
    <Screen title="Approvals" subtitle="Submitted claims from your team. Tick what you have checked and decide in one go." scroll bottomSpace={80}>
      <>
        <View style={[styles.grid, wide && styles.gridWide]}>
          <Reveal y={10} style={styles.cell}>
            <StatCard
              tone="amber"
              icon={STATUS_ICON.submitted}
              label="Waiting for you"
              trailing={data ? money(data.total_amount) : undefined}
              value={data?.total ?? 0}
              format={whole}
              unit={`/ ${pluralise(data?.total ?? 0, 'claim')}`}
              fraction={data && data.total ? 1 : 0}
              note={data?.total ? 'Approve, or reject with a reason the employee will see' : 'Nothing waiting on you'}
            />
          </Reveal>
          <Reveal y={10} delay={60} style={styles.cell}>
            <GuideTarget id="flagged">
            <StatCard
              tone="pink"
              icon={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
              label="Flagged by policy"
              trailing={data?.flagged ? 'Worth a closer look' : 'All within policy'}
              value={data?.flagged ?? 0}
              format={whole}
              unit={`/ ${pluralise(data?.total ?? 0, 'claim')}`}
              fraction={data && data.total ? data.flagged / data.total : 0}
              note="Over a cap, late, or a possible duplicate"
              delay={60}
            />
            </GuideTarget>
          </Reveal>
        </View>

        <SectionTitle
          trailing={
            <View style={styles.chips}>
              <Chip label="All" selected={!onlyFlagged} onPress={() => setOnlyFlagged(false)} />
              <Chip label="Flagged" tone="pink" selected={onlyFlagged} onPress={() => setOnlyFlagged(true)} />
            </View>
          }>
          Queue
        </SectionTitle>
        {error ? <ErrorNote message={error} onRetry={reload} /> : null}
        {loading && all.length === 0 ? <ClaimsSkeleton rows={2} /> : null}
        <GuideTarget id={items.length ? 'queue-card' : 'queue'}>
        <GroupCard
          tone="amber"
          icon={STATUS_ICON.submitted}
          kicker={pluralise(items.length, 'claim')}
          title={onlyFlagged ? 'Flagged' : 'Submitted'}
          subtitle={items.length ? `${formatMoney(items.reduce((s, c) => s + c.amount, 0), currency)} in total` : undefined}
          trailing={
            items.length ? (
              <GuideTarget id="queue">
                <Chip label={selected.size === items.length ? 'Clear' : 'Select all'} onPress={() => setSelected(selected.size === items.length ? new Set() : new Set(items.map((c) => c.id)))} />
              </GuideTarget>
            ) : undefined
          }>
          {items.length === 0 && !loading ? (
            <>
              <View style={styles.emptyArt}>
                <InboxArt width={168} />
              </View>
              <EmptyNote>{onlyFlagged ? 'Nothing flagged. Every submitted claim is within policy.' : 'Nothing waiting for you. Submitted claims from your team land here, ready to tick and approve.'}</EmptyNote>
            </>
          ) : null}
          {items.map((c, i) => (
            <ClaimRow key={c.id} claim={c} index={i} showEmployee showStatus={false} selected={selected.has(c.id)} onToggleSelect={toggle} last={i === items.length - 1} />
          ))}
        </GroupCard>
        </GuideTarget>
      </>
      <Presence
        visible={chosen.length > 0 || notice !== null}
        y={24}
        style={[styles.bar, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow, bottom: width >= SidebarWidth ? Spacing.four : insets.bottom + 80 }]}>
        {notice ? (
          <ThemedText type="small" themeColor="textSecondary">
            {notice}
          </ThemedText>
        ) : null}
        {chosen.length > 0 ? (
          <>
            {rejecting ? <Field label="Reason for rejection" hint="The employee sees this word for word." value={note} onChangeText={setNote} placeholder="Tell the employee what to fix" autoFocus /> : null}
            <View style={styles.actions}>
              <ThemedText type="smallSemi" style={styles.summary} numberOfLines={2}>
                {pluralise(chosen.length, 'claim')} · {formatMoney(chosenAmount, currency)}
              </ThemedText>
              <Button title={rejecting ? 'Confirm reject' : 'Reject'} variant="danger" compact loading={busy && rejecting} disabled={busy || (rejecting && !note.trim())} onPress={() => decide('reject')} />
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
  grid: { gap: Spacing.three, paddingHorizontal: Spacing.three, paddingTop: Spacing.one },
  gridWide: { flexDirection: 'row' },
  cell: { flex: 1 },
  chips: { flexDirection: 'row', gap: Spacing.two },
  emptyArt: { alignItems: 'center', paddingTop: Spacing.two },
  bar: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: 1,
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
