import { router } from 'expo-router';

import type { Step } from '@/guide/guide';

type Who = {
  firstName: string;
  managerName: string | null;
  hasCap: boolean;
  approves: boolean;
  reviews: boolean;
  extraction: boolean;
};

/** The welcome tour on the home screen: the loop, in the person's own words and role. */
export function homeTour(who: Who) {
  const steps: Step[] = [
    {
      art: 'welcome',
      title: `Welcome, ${who.firstName}.`,
      body: 'Half a minute on how a claim gets from a bill in your hand to money in your account. Skip it if you have done this before.',
    },
    {
      target: 'snap',
      title: 'Start with the bill',
      body: who.extraction
        ? 'Snap it and it reads itself: vendor, date, amount, tax, even the items. You check the details and send.'
        : 'Snap it or attach a photo, then type in the amount, date and vendor. The receipt goes with the claim.',
    },
    {
      target: 'month',
      title: 'Your month at a glance',
      body: who.hasCap ? 'The bar fills against the company cap, so you know what is left before you spend it.' : 'Everything you have claimed this month, with the number of claims under it.',
    },
    {
      target: 'chips',
      title: 'Every claim moves along',
      body: 'Draft, awaiting approval, approved, then cleared at month-end. Tap a chip to see one stage on its own.',
    },
    {
      target: 'waiting',
      title: 'Who approves it',
      body: `${who.managerName ? `Your claims go to ${who.managerName}.` : 'Your administrator sets who approves your claims.'} A rejection comes back with a note; fix it and send it again.`,
    },
  ];
  if (who.approves) {
    steps.push({
      art: 'inbox',
      title: 'You approve, too',
      body: "Your team's submitted claims wait in the Approvals tab. Tick the ones you have checked and decide in one go.",
    });
  }
  if (who.reviews) {
    steps.push({
      art: 'ledger',
      title: 'And you close the month',
      body: 'Month-end shows the month by person and by category. Export the workbook for payroll, then close the month to clear what was approved.',
    });
  }
  steps.push({
    art: 'lifecycle',
    title: 'That is the whole loop',
    body: 'Snap, submit, approved, cleared. You can replay this from Settings whenever you like.',
    action: { label: 'Snap a receipt', onPress: () => router.push('/claim/new') },
  });
  return { id: 'home', steps };
}

export function approvalsTour() {
  const steps: Step[] = [
    {
      target: 'queue',
      title: 'Tick, then decide',
      body: 'Select the claims you have checked. Approve them together, or reject with a reason the employee reads word for word.',
    },
    {
      target: 'flagged',
      title: 'Flags are hints, not verdicts',
      body: 'Over a cap, late, or a possible duplicate. Filter to flagged when you are short on time; the decision is still yours.',
    },
  ];
  return { id: 'approvals', steps };
}

export function reportsTour(canClose: boolean) {
  const steps: Step[] = [
    {
      target: 'month-nav',
      title: 'One month at a time',
      body: 'Step back through earlier months. Approvals land in the current one.',
    },
    {
      target: 'month-actions',
      title: canClose ? 'Export, then close' : 'The workbook for payroll',
      body: canClose
        ? 'Export the workbook for payroll, then close the month: approved claims become cleared, and anything still pending stays open for next time.'
        : 'Export the workbook when payroll needs it. Closing the month, which clears approved claims, is for the super admin.',
    },
  ];
  return { id: 'reports', steps };
}
