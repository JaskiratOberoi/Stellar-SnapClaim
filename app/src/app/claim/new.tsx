import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Field, FieldGroup } from '@/components/field';
import { FlagList } from '@/components/flag-list';
import { Card, Loading, Screen, SectionTitle } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { PhoneWidth, Radius, Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { Presence } from '@/motion/presence';
import { Reveal } from '@/motion/reveal';
import { Sheet } from '@/motion/sheet';
import { Tap } from '@/motion/tap';
import { ApiError, api, describeError, receiptImageUrl } from '@/services/api';
import { formatMoney, parseIsoDate, todayIso, toIso } from '@/services/format';
import { pickFile, pickFromLibrary, snapWithCamera, uploadReceipt } from '@/services/receipts';
import type { ClaimDetail, ClaimInput, Extraction, PolicyFlag, Receipt } from '@/services/types';

type Line = { key: number; description: string; quantity: string; amount: string };

let lineKey = 0;
const newLine = (description = '', quantity = '', amount = ''): Line => ({ key: ++lineKey, description, quantity, amount });

export default function NewClaimScreen() {
  const theme = useTheme();
  const wide = useWindowDimensions().width >= PhoneWidth;
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
  // Bumped when a receipt fills the form, so the filled fields light up one after another.
  const [filled, setFilled] = useState(0);

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
    setFilled((n) => n + 1);
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
  const updateLine = (key: number, patch: Partial<Line>) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  return (
    <Sheet>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <Screen title={editing ? 'Edit claim' : 'New claim'} subtitle={extractionEnabled ? 'Snap the bill, check the details, submit' : 'Attach the bill and fill in the details'} back scroll>
          <>
            {loadingExisting ? <Loading /> : null}

            <SectionTitle>Receipt</SectionTitle>
            <View style={styles.receiptRow}>
              {receipts.map((r) => (
                <Reveal key={r.id} y={8}>
                  <View style={[styles.thumb, { backgroundColor: theme.backgroundElement }]}>
                    <Tap accessibilityRole="button" accessibilityLabel="View receipt" scale={0.95} onPress={() => router.push({ pathname: '/receipt/[id]', params: { id: r.id } })} outerStyle={styles.flex} style={styles.flex}>
                      {r.content_type === 'application/pdf' ? (
                        <View style={styles.pdf}>
                          <SymbolView name={{ ios: 'doc.richtext', android: 'picture_as_pdf', web: 'picture_as_pdf' }} size={32} tintColor={theme.textSecondary} />
                          <ThemedText type="small" themeColor="textSecondary">
                            PDF
                          </ThemedText>
                        </View>
                      ) : (
                        <Image source={{ uri: receiptImageUrl(r.id) }} style={styles.flex} contentFit="cover" transition={200} />
                      )}
                    </Tap>
                    <Tap
                      accessibilityRole="button"
                      accessibilityLabel="Remove receipt"
                      hitSlop={8}
                      scale={0.8}
                      onPress={() => removeReceipt(r)}
                      outerStyle={styles.removeOuter}
                      style={[styles.remove, { backgroundColor: theme.background, shadowColor: theme.shadow }]}>
                      <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={14} tintColor={theme.text} />
                    </Tap>
                  </View>
                </Reveal>
              ))}
              {uploading ? (
                <Reveal y={8}>
                  <View style={[styles.thumb, styles.pdf, { backgroundColor: theme.backgroundElement }]}>
                    <ActivityIndicator color={theme.accent} />
                    <ThemedText type="small" themeColor="textSecondary">
                      {extractionEnabled ? 'Reading…' : 'Uploading…'}
                    </ThemedText>
                  </View>
                </Reveal>
              ) : null}
            </View>
            <View style={styles.pickers}>
              {Platform.OS !== 'web' ? (
                <Button title="Snap" icon={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }} compact disabled={uploading} onPress={() => addReceipt(snapWithCamera)} />
              ) : null}
              <Button title="Photo" variant={Platform.OS === 'web' ? 'primary' : 'secondary'} icon={{ ios: 'photo.on.rectangle', android: 'photo_library', web: 'photo_library' }} compact disabled={uploading} onPress={() => addReceipt(pickFromLibrary)} />
              <Button title="File / PDF" variant="secondary" icon={{ ios: 'paperclip', android: 'attach_file', web: 'attach_file' }} compact disabled={uploading} onPress={() => addReceipt(pickFile)} />
            </View>
            <Presence visible={extraction !== null} y={8}>
              <Card style={[styles.extractionNote, { backgroundColor: theme.accentSoft }]}>
                <ThemedText type="small" style={{ color: theme.accent, fontWeight: 600 }}>
                  Read from the receipt ({extraction?.confidence} confidence). Check every field before submitting.
                </ThemedText>
                {extraction?.notes ? (
                  <ThemedText type="small" style={{ color: theme.accent }}>
                    {extraction.notes}
                  </ThemedText>
                ) : null}
              </Card>
            </Presence>

            <SectionTitle>Details</SectionTitle>
            <View style={styles.form}>
              <Field label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Client lunch, Delhi" flashKey={filled} flashDelay={0} />
              <View style={styles.chipsWrap}>
                <ThemedText type="label" themeColor="textSecondary">
                  Category
                </ThemedText>
                {wide ? (
                  <View style={[styles.chips, styles.chipsWrapped]}>
                    {categories.map((c) => (
                      <Chip key={c.id} label={c.name} selected={categoryId === c.id} onPress={() => setCategoryId(categoryId === c.id ? null : c.id)} />
                    ))}
                  </View>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chips}>
                    {categories.map((c) => (
                      <Chip key={c.id} label={c.name} selected={categoryId === c.id} onPress={() => setCategoryId(categoryId === c.id ? null : c.id)} />
                    ))}
                  </ScrollView>
                )}
              </View>
              <Field label="Vendor" value={vendor} onChangeText={setVendor} placeholder="Who you paid" flashKey={filled} flashDelay={80} />
              <FieldGroup>
                <Field label="Date" value={spentOn} onChangeText={setSpentOn} placeholder="DD/MM/YYYY" error={dateError} keyboardType="numbers-and-punctuation" flashKey={filled} flashDelay={160} />
                <Field label={`Amount (${currency})`} value={amount} onChangeText={setAmount} placeholder="0" keyboardType="decimal-pad" flashKey={filled} flashDelay={240} />
                <Field label="Tax" value={tax} onChangeText={setTax} placeholder="0" keyboardType="decimal-pad" flashKey={filled} flashDelay={320} />
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
              {lines.map((line, i) => (
                <Reveal key={line.key} y={8} delay={Math.min(i, 6) * 40}>
                  <View style={styles.lineRow}>
                    <View style={styles.lineDesc}>
                      <Field label="Item" value={line.description} onChangeText={(v) => updateLine(line.key, { description: v })} placeholder="Description" />
                    </View>
                    <View style={styles.lineQty}>
                      <Field label="Qty" value={line.quantity} onChangeText={(v) => updateLine(line.key, { quantity: v })} placeholder="1" keyboardType="decimal-pad" />
                    </View>
                    <View style={styles.lineAmt}>
                      <Field label="Amount" value={line.amount} onChangeText={(v) => updateLine(line.key, { amount: v })} placeholder="0" keyboardType="decimal-pad" />
                    </View>
                    <Tap accessibilityRole="button" accessibilityLabel="Remove line" hitSlop={8} scale={0.8} onPress={() => setLines((prev) => prev.filter((l) => l.key !== line.key))} style={styles.lineRemove}>
                      <SymbolView name={{ ios: 'minus.circle.fill', android: 'remove_circle', web: 'remove_circle' }} size={22} tintColor={theme.danger} />
                    </Tap>
                  </View>
                </Reveal>
              ))}
            </View>

            {flags.length > 0 ? (
              <Reveal y={8}>
                <SectionTitle>Policy check</SectionTitle>
                <FlagList flags={flags} />
              </Reveal>
            ) : (
              <Presence visible={parsedAmount > 0} y={4}>
                <ThemedText type="small" style={[styles.hint, { color: theme.success, fontWeight: 600 }]}>
                  Within policy.
                </ThemedText>
              </Presence>
            )}

            <Presence visible={error !== null} y={6}>
              <ThemedText type="small" style={[styles.hint, { color: theme.danger }]}>
                {error}
              </ThemedText>
            </Presence>

            <View style={styles.actions}>
              <Button title="Save draft" variant="secondary" loading={saving === 'draft'} disabled={saving !== null || uploading} onPress={() => save(false)} />
              <Button
                title={parsedAmount > 0 ? `Submit ${formatMoney(parsedAmount, currency)}` : 'Submit'}
                loading={saving === 'submit'}
                disabled={saving !== null || uploading || blocked}
                icon={{ ios: 'paperplane.fill', android: 'send', web: 'send' }}
                onPress={() => save(true)}
                style={styles.submit}
              />
            </View>
          </>
        </Screen>
      </KeyboardAvoidingView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  receiptRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  thumb: { width: 96, height: 120, borderRadius: Radius.medium, overflow: 'hidden' },
  pdf: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.one },
  removeOuter: { position: 'absolute', top: 6, right: 6 },
  remove: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  pickers: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  extractionNote: { marginTop: Spacing.three },
  form: { paddingHorizontal: Spacing.three, gap: Spacing.three, paddingTop: Spacing.two },
  chipsWrap: { gap: Spacing.one },
  chipScroll: { flexGrow: 0 },
  chips: { flexDirection: 'row', gap: Spacing.two, paddingVertical: Spacing.one },
  chipsWrapped: { flexWrap: 'wrap' },
  hint: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, lineHeight: 20 },
  lineRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  lineDesc: { flex: 3 },
  lineQty: { flex: 1 },
  lineAmt: { flex: 1.4 },
  lineRemove: { height: 48, justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.four },
  submit: { flex: 1 },
});
