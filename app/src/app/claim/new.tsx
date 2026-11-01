import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Field, FieldGroup } from '@/components/field';
import { FlagList } from '@/components/flag-list';
import { Card, Loading, Screen, SectionTitle } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, api, describeError, receiptImageUrl } from '@/services/api';
import { formatMoney, parseIsoDate, todayIso, toIso } from '@/services/format';
import { pickFile, pickFromLibrary, snapWithCamera, uploadReceipt } from '@/services/receipts';
import type { ClaimDetail, ClaimInput, Extraction, PolicyFlag, Receipt } from '@/services/types';

type Line = { key: number; description: string; quantity: string; amount: string };

let lineKey = 0;
const newLine = (description = '', quantity = '', amount = ''): Line => ({ key: ++lineKey, description, quantity, amount });

export default function NewClaimScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { categories, company, extractionEnabled } = useSession();
  const editing = typeof id === 'string' && id.length > 0;

  const [loadingExisting, setLoadingExisting] = useState(editing);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [uploading, setUploading] = useState(false);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [vendor, setVendor] = useState('');
  const [spentOn, setSpentOn] = useState(todayIso());
  const [amount, setAmount] = useState('');
  const [tax, setTax] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [flags, setFlags] = useState<PolicyFlag[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<'draft' | 'submit' | null>(null);

  // Edit mode: load the claim once.
  useEffect(() => {
    if (!editing) return;
    let cancelled = false;
    api<ClaimDetail>(`/api/v1/claims/${id}`)
      .then((d) => {
        if (cancelled) return;
        setTitle(d.claim.title);
        setCategoryId(d.claim.category?.id ?? null);
        setVendor(d.claim.vendor ?? '');
        setSpentOn(d.claim.spent_on);
        setAmount(String(d.claim.amount));
        setTax(d.claim.tax_amount ? String(d.claim.tax_amount) : '');
        setNotes(d.claim.notes ?? '');
        setLines(d.lines.map((l) => newLine(l.description, l.quantity === null ? '' : String(l.quantity), String(l.amount))));
        setReceipts(d.receipts);
      })
      .catch((err) => {
        if (!cancelled) setError(describeError(err));
      })
      .finally(() => {
        if (!cancelled) setLoadingExisting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editing, id]);

  const parsedAmount = Number(amount.replace(/[^\d.]/g, '')) || 0;
  const parsedTax = Number(tax.replace(/[^\d.]/g, '')) || 0;
  const spentDate = parseIsoDate(spentOn);
  const dateError = spentOn && !spentDate ? 'Use DD/MM/YYYY' : null;

  // Live policy check, debounced.
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (checkTimer.current) clearTimeout(checkTimer.current);
    checkTimer.current = setTimeout(() => {
      if (parsedAmount <= 0 || !spentDate) {
        setFlags([]);
        return;
      }
      api<{ flags: PolicyFlag[] }>('/api/v1/policy/check', {
        body: { claim_id: editing ? id : null, category_id: categoryId, amount: parsedAmount, spent_on: toIso(spentDate), has_receipt: receipts.length > 0, vendor: vendor || null },
      })
        .then((r) => setFlags(r.flags))
        .catch(() => undefined);
    }, 400);
    return () => {
      if (checkTimer.current) clearTimeout(checkTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedAmount, categoryId, spentOn, vendor, receipts.length]);

  const applyExtraction = (receipt: Receipt) => {
    const x = receipt.extraction;
    if (!x || !x.is_receipt) return;
    setExtraction(x);
    if (!vendor && x.vendor) setVendor(x.vendor);
    if (!title && x.vendor) setTitle(x.vendor);
    if (x.spent_on && parseIsoDate(x.spent_on)) setSpentOn(x.spent_on);
    if (!amount && x.total !== null) setAmount(String(x.total));
    if (!tax && x.tax !== null && x.tax > 0) setTax(String(x.tax));
    if (!categoryId && x.category) {
      const match = categories.find((c) => c.code === x.category);
      if (match) setCategoryId(match.id);
    }
    if (lines.length === 0 && x.lines.length > 0 && x.lines.length <= 25) {
      setLines(x.lines.map((l) => newLine(l.description, l.quantity === null ? '' : String(l.quantity), l.amount === null ? '' : String(l.amount))));
    }
  };

  const addReceipt = async (pick: () => Promise<{ base64: string; contentType: string } | null>) => {
    setError(null);
    try {
      const picked = await pick();
      if (!picked) return;
      setUploading(true);
      const receipt = await uploadReceipt(picked);
      setReceipts((prev) => [...prev, receipt]);
      applyExtraction(receipt);
      if (receipt.extraction_status === 'done' && receipt.extraction && !receipt.extraction.is_receipt) setError('That image does not look like a receipt. Keep it anyway or remove it.');
      if (receipt.extraction_status === 'failed') setError(`Receipt saved, but it could not be read automatically (${receipt.extraction_error}). Fill in the details by hand.`);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setUploading(false);
    }
  };

  const removeReceipt = async (receipt: Receipt) => {
    setReceipts((prev) => prev.filter((r) => r.id !== receipt.id));
    if (!editing) api(`/api/v1/receipts/${receipt.id}`, { method: 'DELETE' }).catch(() => undefined);
  };

  const save = async (submit: boolean) => {
    setError(null);
    if (!title.trim()) return setError('Give the claim a title');
    if (parsedAmount <= 0) return setError('Enter the amount');
    if (!spentDate) return setError('Enter the date as DD/MM/YYYY');
    const input: ClaimInput = {
      title: title.trim(),
      category_id: categoryId,
      vendor: vendor.trim() || null,
      spent_on: toIso(spentDate),
      currency: extraction?.currency ?? company?.currency ?? null,
      amount: parsedAmount,
      tax_amount: parsedTax,
      notes: notes.trim() || null,
      lines: lines
        .filter((l) => l.description.trim())
        .map((l) => ({ description: l.description.trim(), quantity: l.quantity ? Number(l.quantity) : null, unit_price: null, amount: Number(l.amount) || 0 })),
      receipt_ids: receipts.map((r) => r.id),
      submit,
    };
    setSaving(submit ? 'submit' : 'draft');
    try {
      const detail = editing
        ? await api<ClaimDetail>(`/api/v1/claims/${id}`, { method: 'PUT', body: input })
        : await api<ClaimDetail>('/api/v1/claims/', { body: input });
      router.replace({ pathname: '/claim/[id]', params: { id: detail.claim.id } });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'policy_blocked') {
        const details = err.details as { flags?: PolicyFlag[] } | undefined;
        if (details?.flags) setFlags(details.flags);
      }
      setError(describeError(err));
    } finally {
      setSaving(null);
    }
  };

  const blocked = flags.some((f) => f.severity === 'block');
  const currency = extraction?.currency ?? company?.currency ?? 'INR';

  return (
    <Screen title={editing ? 'Edit claim' : 'New claim'} subtitle={extractionEnabled ? 'Snap the bill, check the details, submit' : 'Attach the bill and fill in the details'} back>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.six }} keyboardShouldPersistTaps="handled">
          {loadingExisting ? <Loading /> : null}

          <SectionTitle>Receipt</SectionTitle>
          <View style={styles.receiptRow}>
            {receipts.map((r) => (
              <View key={r.id} style={[styles.thumb, { backgroundColor: theme.backgroundElement }]}>
                <Pressable accessibilityRole="button" accessibilityLabel="View receipt" onPress={() => router.push({ pathname: '/receipt/[id]', params: { id: r.id } })} style={styles.flex}>
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
                <Pressable accessibilityRole="button" accessibilityLabel="Remove receipt" hitSlop={8} onPress={() => removeReceipt(r)} style={[styles.remove, { backgroundColor: theme.background }]}>
                  <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={14} tintColor={theme.text} />
                </Pressable>
              </View>
            ))}
            {uploading ? (
              <View style={[styles.thumb, styles.pdf, { backgroundColor: theme.backgroundElement }]}>
                <ActivityIndicator color={theme.accent} />
                <ThemedText type="small" themeColor="textSecondary">
                  {extractionEnabled ? 'Reading…' : 'Uploading…'}
                </ThemedText>
              </View>
            ) : null}
          </View>
          <View style={styles.pickers}>
            {Platform.OS !== 'web' ? (
              <Button title="Snap" icon={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }} compact disabled={uploading} onPress={() => addReceipt(snapWithCamera)} />
            ) : null}
            <Button title="Photo" variant={Platform.OS === 'web' ? 'primary' : 'secondary'} icon={{ ios: 'photo.on.rectangle', android: 'photo_library', web: 'photo_library' }} compact disabled={uploading} onPress={() => addReceipt(pickFromLibrary)} />
            <Button title="File / PDF" variant="secondary" icon={{ ios: 'paperclip', android: 'attach_file', web: 'attach_file' }} compact disabled={uploading} onPress={() => addReceipt(pickFile)} />
          </View>
          {extraction ? (
            <Card style={[styles.extractionNote, { backgroundColor: theme.accentSoft }]}>
              <ThemedText type="small" style={{ color: theme.accent, fontWeight: 600 }}>
                Read from the receipt ({extraction.confidence} confidence). Check every field before submitting.
              </ThemedText>
              {extraction.notes ? (
                <ThemedText type="small" style={{ color: theme.accent }}>
                  {extraction.notes}
                </ThemedText>
              ) : null}
            </Card>
          ) : null}

          <SectionTitle>Details</SectionTitle>
          <View style={styles.form}>
            <Field label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Client lunch, Delhi" />
            <View style={styles.chipsWrap}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Category
              </ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chips}>
                {categories.map((c) => (
                  <Chip key={c.id} label={c.name} selected={categoryId === c.id} onPress={() => setCategoryId(categoryId === c.id ? null : c.id)} />
                ))}
              </ScrollView>
            </View>
            <Field label="Vendor" value={vendor} onChangeText={setVendor} placeholder="Who you paid" />
            <FieldGroup>
              <Field label="Date" value={spentOn} onChangeText={setSpentOn} placeholder="DD/MM/YYYY" error={dateError} keyboardType="numbers-and-punctuation" />
              <Field label={`Amount (${currency})`} value={amount} onChangeText={setAmount} placeholder="0" keyboardType="decimal-pad" />
              <Field label="Tax" value={tax} onChangeText={setTax} placeholder="0" keyboardType="decimal-pad" />
            </FieldGroup>
            <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Anything your manager should know" multiline />
          </View>

          <SectionTitle trailing={<Chip label="Add line" onPress={() => setLines((prev) => [...prev, newLine()])} />}>Line items</SectionTitle>
          {lines.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
              Optional. Itemise when the receipt lists several things.
            </ThemedText>
          ) : null}
          <View style={styles.form}>
            {lines.map((line) => (
              <View key={line.key} style={styles.lineRow}>
                <View style={styles.lineDesc}>
                  <Field label="Item" value={line.description} onChangeText={(v) => setLines((prev) => prev.map((l) => (l.key === line.key ? { ...l, description: v } : l)))} placeholder="Description" />
                </View>
                <View style={styles.lineQty}>
                  <Field label="Qty" value={line.quantity} onChangeText={(v) => setLines((prev) => prev.map((l) => (l.key === line.key ? { ...l, quantity: v } : l)))} placeholder="1" keyboardType="decimal-pad" />
                </View>
                <View style={styles.lineAmt}>
                  <Field label="Amount" value={line.amount} onChangeText={(v) => setLines((prev) => prev.map((l) => (l.key === line.key ? { ...l, amount: v } : l)))} placeholder="0" keyboardType="decimal-pad" />
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Remove line" hitSlop={8} onPress={() => setLines((prev) => prev.filter((l) => l.key !== line.key))} style={styles.lineRemove}>
                  <SymbolView name={{ ios: 'minus.circle.fill', android: 'remove_circle', web: 'remove_circle' }} size={22} tintColor={theme.danger} />
                </Pressable>
              </View>
            ))}
          </View>

          {flags.length > 0 ? (
            <>
              <SectionTitle>Policy check</SectionTitle>
              <FlagList flags={flags} />
            </>
          ) : parsedAmount > 0 ? (
            <ThemedText type="small" style={[styles.hint, { color: theme.success }]}>
              Within policy.
            </ThemedText>
          ) : null}

          {error ? (
            <ThemedText type="small" style={[styles.hint, { color: theme.danger }]}>
              {error}
            </ThemedText>
          ) : null}

          <View style={styles.actions}>
            <Button title="Save draft" variant="secondary" loading={saving === 'draft'} disabled={saving !== null || uploading} onPress={() => save(false)} />
            <Button
              title={parsedAmount > 0 ? `Submit ${formatMoney(parsedAmount, currency)}` : 'Submit'}
              loading={saving === 'submit'}
              disabled={saving !== null || uploading || blocked}
              icon={{ ios: 'paperplane.fill', android: 'send', web: 'send' }}
              onPress={() => save(true)}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  receiptRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  thumb: { width: 96, height: 120, borderRadius: Radius.medium, overflow: 'hidden' },
  pdf: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.one },
  remove: { position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pickers: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  extractionNote: { marginTop: Spacing.three },
  form: { paddingHorizontal: Spacing.three, gap: Spacing.three, paddingTop: Spacing.two },
  chipsWrap: { gap: Spacing.one },
  chipScroll: { flexGrow: 0 },
  chips: { flexDirection: 'row', gap: Spacing.two, paddingVertical: Spacing.one },
  hint: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, lineHeight: 20 },
  lineRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  lineDesc: { flex: 3 },
  lineQty: { flex: 1 },
  lineAmt: { flex: 1.4 },
  lineRemove: { height: 46, justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.four },
});
