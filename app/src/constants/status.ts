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

/** The heading a group of claims takes. */
export const STATUS_GROUP: Record<ClaimStatus, string> = {
  draft: 'Drafts',
  submitted: 'Awaiting approval',
  approved: 'Approved',
  cleared: 'Cleared',
  rejected: 'Rejected',
};
