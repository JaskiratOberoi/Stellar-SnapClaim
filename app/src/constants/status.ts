import type { SymbolViewProps } from 'expo-symbols';

import type { ClaimStatus } from '@/services/types';

export const STATUS_ORDER: ClaimStatus[] = ['draft', 'submitted', 'approved', 'cleared', 'rejected'];

export const STATUS_ICON: Record<ClaimStatus, SymbolViewProps['name']> = {
  draft: { ios: 'pencil', android: 'edit', web: 'edit' },
  submitted: { ios: 'clock.fill', android: 'schedule', web: 'schedule' },
  approved: { ios: 'checkmark.circle.fill', android: 'task_alt', web: 'task_alt' },
  cleared: { ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' },
  rejected: { ios: 'xmark.circle.fill', android: 'block', web: 'block' },
};

const CATEGORY_ICON: Record<string, { ios: string; android: string }> = {
  travel: { ios: 'airplane', android: 'flight' },
  fuel: { ios: 'fuelpump.fill', android: 'local_gas_station' },
  meals: { ios: 'fork.knife', android: 'restaurant' },
  accommodation: { ios: 'bed.double.fill', android: 'hotel' },
  supplies: { ios: 'shippingbox.fill', android: 'inventory_2' },
  communication: { ios: 'phone.fill', android: 'call' },
  software: { ios: 'laptopcomputer', android: 'terminal' },
  client: { ios: 'person.2.fill', android: 'handshake' },
  other: { ios: 'doc.text.fill', android: 'receipt_long' },
};

export function categoryIcon(code: string | null | undefined): SymbolViewProps['name'] {
  const icon = CATEGORY_ICON[code ?? 'other'] ?? CATEGORY_ICON.other;
  return { ios: icon.ios, android: icon.android, web: icon.android } as SymbolViewProps['name'];
}

/** The heading a group of claims takes. */
export const STATUS_GROUP: Record<ClaimStatus, string> = {
  draft: 'Drafts',
  submitted: 'Awaiting approval',
  approved: 'Approved',
  cleared: 'Cleared',
  rejected: 'Rejected',
};
